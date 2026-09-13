import { createReadStream, createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { randomUUID } from 'node:crypto'
import { extname, join } from 'node:path'
import { WebSocketServer } from 'ws'

const port = Number(process.env.API_PORT || 8787)
const aiUrl = process.env.AI_URL || 'http://localhost:9000'
const aiRequestTimeoutMs = Number(process.env.AI_REQUEST_TIMEOUT_MS || 15000)
const maxAlertHistory = Number(process.env.MAX_ALERT_HISTORY || 500)
const maxIncidentHistory = Number(process.env.MAX_INCIDENT_HISTORY || 500)
const allowedOrigin = process.env.ALLOWED_ORIGIN || '*'
const rateLimitWindowMs = Number(process.env.RATE_LIMIT_WINDOW_MS || 60000)
const rateLimitMaxRequests = Number(process.env.RATE_LIMIT_MAX_REQUESTS || 240)
const pythonBin = process.env.PYTHON_BIN || (process.platform === 'win32' && existsSync(join(process.cwd(), '.venv-1', 'Scripts', 'python.exe')) ? join(process.cwd(), '.venv-1', 'Scripts', 'python.exe') : process.platform === 'win32' ? 'python' : 'python3')
const rtoApiUrl = process.env.RTO_API_URL || ''
const rtoApiKey = process.env.RTO_API_KEY || ''
const dataDir = process.env.DATA_DIR || join(process.cwd(), 'server', 'data')
const uploadDir = join(dataDir, 'uploads')
mkdirSync(uploadDir, { recursive: true })
const evidenceDir = join(uploadDir, 'evidence')
mkdirSync(evidenceDir, { recursive: true })
const stateFile = join(dataDir, 'state.json')
const clients = new Set()
const frameStreams = new Map()
const liveFrameClients = new Map()
const liveSocketClients = new Map()
const uploadSocketClients = new Map()
const activeUploadSockets = new Map()
const plateLastSeen = new Map()
const requestCounts = new Map()

const cameras = [
  ['WEBCAM', 'LOCAL WEBCAM', 'offline', 0, 0, '1080p', 0, 50, 50],
  ['CAM-PHONE', 'MOBILE FIELD UNIT', 'offline', 0, 0, '1080p', 0, 50, 50],
].map(([id, sector, status, fps, latency, resolution, uptime, x, y]) => ({ id, sector, status, fps, latency, resolution, uptime, location: { x, y }, streamUrl: '', protocol: 'browser-camera', role: 'overview', ptz: { enabled: false, available: false, pan: null, tilt: null, zoom: null, poseUpdatedAt: null }, lastSeen: new Date().toISOString() }))
const alerts = [
  { id: 'ALT-001', severity: 'CRITICAL', type: 'Restricted Zone Intrusion', cam: 'CAM-04', track: 'TRACK-037', risk: 91, time: '02:14:32', read: false },
  { id: 'ALT-002', severity: 'HIGH', type: 'Unusual Loitering', cam: 'CAM-02', track: 'TRACK-019', risk: 73, time: '01:58:17', read: false },
  { id: 'ALT-003', severity: 'MEDIUM', type: 'Unknown Vehicle', cam: 'CAM-06', track: 'VEH-008', risk: 52, time: '03:12:45', read: false },
]
const criminalDataset = [
  { id: 'CRIM-001', name: 'Aisha Rahman', aliases: ['Aisha', 'A. Rahman'], gender: 'F', age: 32, height: '5ft 6in', weight: '64 kg', eyeColor: 'brown', hairColor: 'black', crime: 'armed robbery', faceDescription: 'brown eyes, oval face, black hair', lastKnownLocation: 'North gate', lastCamera: 'CAM-04', lastSeen: '2026-09-13T02:14:32Z', watchStatus: 'manual-review', riskScore: 91, confidence: 0.88 },
  { id: 'CRIM-002', name: 'Ibrahim Saleh', aliases: ['Ibrahim', 'S. Ibrahim'], gender: 'M', age: 41, height: '5ft 10in', weight: '76 kg', eyeColor: 'hazel', hairColor: 'dark brown', crime: 'burglary', faceDescription: 'hazel eyes, scar on right cheek', lastKnownLocation: 'East corridor', lastCamera: 'CAM-02', lastSeen: '2026-09-13T01:58:17Z', watchStatus: 'manual-review', riskScore: 73, confidence: 0.79 },
  { id: 'CRIM-003', name: 'Priya Menon', aliases: ['Priya', 'P. Menon'], gender: 'F', age: 28, height: '5ft 3in', weight: '58 kg', eyeColor: 'black', hairColor: 'brown', crime: 'vehicle theft', faceDescription: 'soft features, dark brown hair, visible ear piercing', lastKnownLocation: 'South gate', lastCamera: 'CAM-06', lastSeen: '2026-09-13T03:12:45Z', watchStatus: 'manual-review', riskScore: 52, confidence: 0.66 },
  { id: 'CRIM-004', name: 'Daniel Ortiz', aliases: ['Daniel', 'D. Ortiz'], gender: 'M', age: 36, height: '6ft 1in', weight: '82 kg', eyeColor: 'green', hairColor: 'black', crime: 'drug trafficking', faceDescription: 'wide jaw, green eyes, beard stubble', lastKnownLocation: 'West access', lastCamera: 'CAM-08', lastSeen: '2026-09-13T00:47:11Z', watchStatus: 'manual-review', riskScore: 28, confidence: 0.52 },
]
const initialState = { cameras, alerts: [], incidents: [], uploads: [], audit: [], ai: { status: 'offline', lastEvent: null }, criminals: criminalDataset, faceCandidates: [], lastSeenRecords: [] }
let state = existsSync(stateFile) ? JSON.parse(readFileSync(stateFile, 'utf8')) : initialState
if (!state.cameras || !state.cameras.some((camera) => camera.id === 'WEBCAM')) {
  const fallbackCamera = { id: 'WEBCAM', sector: 'LOCAL WEBCAM', status: 'offline', fps: 0, latency: 0, resolution: '1080p', uptime: 0, location: { x: 50, y: 50 }, streamUrl: '', protocol: 'browser-camera', role: 'overview', ptz: { enabled: false, available: false, pan: null, tilt: null, zoom: null, poseUpdatedAt: null }, lastSeen: new Date().toISOString(), source: 'webcam' }
  state.cameras = [fallbackCamera, ...(Array.isArray(state.cameras) ? state.cameras.filter((camera) => camera.id !== 'CAM-PHONE' && camera.id !== 'WEBCAM') : [])]
}
if (Array.isArray(state.cameras)) {
  state.cameras = state.cameras.map((camera) => {
    if (camera.id === 'CAM-PHONE') return { ...camera, id: 'WEBCAM', sector: 'LOCAL WEBCAM', source: 'webcam' }
    if (camera.id === 'WEBCAM') {
      return { ...camera, sector: camera.sector || 'LOCAL WEBCAM', source: camera.source || 'webcam' }
    }
    return camera
  })
}
state.liceplates ??= []
state.authorizedPlates ??= []
state.customZones ??= []
state.fovProfiles ??= []
state.settings ??= {}
state.evidence ??= []
state.ptzCommands ??= []
state.criminals ??= criminalDataset
state.faceCandidates ??= []
state.lastSeenRecords ??= []
for (const camera of state.cameras) {
  camera.sensitiveArea ??= false
  camera.role ??= 'overview'
  camera.ptz ??= { enabled: false, available: false, pan: null, tilt: null, zoom: null, poseUpdatedAt: null }
}
const latestFrames = new Map()
const latestAiResults = new Map()
const indianPlatePattern = /^(?:[A-Z]{2}[0-9]{1,2}[A-Z]{1,3}[0-9]{1,4}|[0-9]{2}BH[0-9]{4}[A-Z]{1,2})$/

async function fetchAi(path, options = {}) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), aiRequestTimeoutMs)
  try {
    return await fetch(`${aiUrl}${path}`, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(timeout)
  }
}

function publishFrame(cameraId, frameBuffer) {
  const socketClients = liveSocketClients.get(cameraId) || new Set()
  const socketNow = Date.now()
  for (const client of socketClients) {
    if (client.readyState !== 1) { socketClients.delete(client); continue }
    if (client.bufferedAmount > 80000) continue
    if (socketNow - client.lastSentAt < 100) continue
    client.lastSentAt = socketNow
    client.send(frameBuffer)
  }
  const liveClients = liveFrameClients.get(cameraId) || new Set()
  const now = Date.now()
  const encodedFrame = `data:image/jpeg;base64,${frameBuffer.toString('base64')}`
  for (const client of liveClients) {
    if (client.response.destroyed) { liveClients.delete(client); continue }
    if (now - client.lastSentAt < 200 || !client.response.writable) continue
    client.lastSentAt = now
    client.response.write(`data: ${JSON.stringify({ image: encodedFrame })}\n\n`)
  }
  const streamClients = frameStreams.get(cameraId) || new Set()
  for (const client of streamClients) {
    client.latest = frameBuffer
    if (client.writing) continue
    client.writing = true
    const flush = () => {
      if (client.response.destroyed) return streamClients.delete(client)
      const nextFrame = client.latest
      client.latest = null
      if (!nextFrame) { client.writing = false; return }
      const canContinue = client.response.write(`--frame\r\nContent-Type: image/jpeg\r\nContent-Length: ${nextFrame.length}\r\n\r\n`)
      client.response.write(nextFrame)
      client.response.write('\r\n')
      if (canContinue) setImmediate(flush)
      else client.response.once('drain', flush)
    }
    flush()
  }
}

function publishCameraOffline(cameraId) {
  latestFrames.delete(cameraId)
  const socketClients = liveSocketClients.get(cameraId) || new Set()
  for (const client of socketClients) {
    if (client.readyState === 1) client.send(JSON.stringify({ type: 'offline' }))
  }
}

function save() { writeFileSync(stateFile, JSON.stringify(state, null, 2)) }
function upsertFaceCandidate(payload) {
  const candidate = {
    id: `FACE-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
    createdAt: new Date().toISOString(),
    cameraId: payload.cameraId || 'WEBCAM',
    personaId: payload.personaId ?? null,
    trackId: payload.trackId ?? null,
    matchScore: Number(payload.matchScore || 0),
    status: payload.status || 'candidate',
    criminalName: payload.criminalName || 'Manual review needed',
    crime: payload.crime || 'pending review',
    height: payload.height || 'n/a',
    weight: payload.weight || 'n/a',
    lastSeen: payload.lastSeen || new Date().toISOString(),
    location: payload.location || 'not yet confirmed',
    faceSaved: Boolean(payload.faceSaved),
    similarity: Number(payload.similarity || 0),
    notes: payload.notes || 'Potential face match waiting for supervisor confirmation.',
  }
  const existing = state.faceCandidates.find(item => item.cameraId === candidate.cameraId && (
    (candidate.personaId && item.personaId === candidate.personaId) ||
    (!candidate.personaId && candidate.trackId != null && item.trackId === candidate.trackId)
  ))
  const updatedCandidate = existing
    ? { ...existing, ...candidate, id: existing.id, createdAt: existing.createdAt, status: existing.status, reviewedAt: existing.reviewedAt, reviewedBy: existing.reviewedBy, reviewNotes: existing.reviewNotes }
    : candidate
  state.faceCandidates = [updatedCandidate, ...state.faceCandidates.filter(item => item.id !== updatedCandidate.id)].slice(0, 200)
  const lastSeen = { id: updatedCandidate.id, cameraId: updatedCandidate.cameraId, personaId: updatedCandidate.personaId, trackId: updatedCandidate.trackId, criminalName: updatedCandidate.criminalName, location: updatedCandidate.location, lastSeen: updatedCandidate.lastSeen, crime: updatedCandidate.crime, confidence: updatedCandidate.similarity }
  state.lastSeenRecords = [lastSeen, ...state.lastSeenRecords.filter(item => item.id !== updatedCandidate.id && !(item.cameraId === updatedCandidate.cameraId && ((updatedCandidate.personaId && item.personaId === updatedCandidate.personaId) || (!updatedCandidate.personaId && updatedCandidate.trackId != null && item.trackId === updatedCandidate.trackId))))].slice(0, 100)
  save()
  return updatedCandidate
}
function createEvidence(cameraId, result, frameData) {
  const id = `EVD-${Date.now()}-${state.evidence.length}`
  const [, encoded] = String(frameData || '').split(',', 2)
  const framePath = join(evidenceDir, `${id}.jpg`)
  if (encoded) writeFileSync(framePath, Buffer.from(encoded, 'base64'))
  const evidence = {
    id,
    cameraId,
    cameraRole: state.cameras.find(camera => camera.id === cameraId)?.role || 'overview',
    cameraPose: state.cameras.find(camera => camera.id === cameraId)?.ptz || null,
    capturedAt: result.timestamp || new Date().toISOString(),
    framePath,
    frameUrl: `/api/evidence/${id}/frame`,
    trackIds: (result.detections || []).filter(d => d.track_id != null).map(d => d.track_id),
    detections: result.detections || [],
    riskScore: result.risk_score,
    severity: result.severity,
    behaviorSignals: result.behavior_signals || [],
    signals: result.signals || [],
    disclaimer: 'Evidence records observable detections and event signals. They do not identify a person or establish criminality.',
  }
  state.evidence.unshift(evidence)
  state.evidence = state.evidence.slice(0, 500)
  return evidence
}
function json(response, status, payload) { response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': allowedOrigin, Vary: 'Origin' }); response.end(JSON.stringify(payload)) }
function parseBody(request) { return new Promise((resolve, reject) => { let value = ''; request.on('data', (chunk) => { value += chunk }); request.on('end', () => { try { resolve(value ? JSON.parse(value) : {}) } catch { reject(new Error('Invalid JSON')) } }); request.on('error', reject) }) }
function audit(action, request, metadata = {}) { state.audit.unshift({ id: randomUUID(), action, actor: request.headers['x-operator-id'] || 'local-operator', timestamp: new Date().toISOString(), metadata }); state.audit = state.audit.slice(0, 500); save() }
function snapshot() { return { cameras: state.cameras, alerts: state.alerts, incidents: state.incidents, health: { api: 'online', cameraNetwork: state.cameras.some((camera) => camera.status !== 'online') ? 'warning' : 'online', activeStreams: state.cameras.filter((camera) => camera.status === 'online').length } } }
function emit(type, data) { const payload = { type, timestamp: new Date().toISOString(), ...data }; for (const client of clients) client.write(`data: ${JSON.stringify(payload)}\n\n`) }
function authorized(request) { return !process.env.AUTH_TOKEN || request.headers.authorization === `Bearer ${process.env.AUTH_TOKEN}` }
function rateLimited(request) {
  const address = request.headers['x-forwarded-for']?.split(',')[0]?.trim() || request.socket.remoteAddress || 'unknown'
  const now = Date.now()
  const entry = requestCounts.get(address)
  if (!entry || now - entry.startedAt >= rateLimitWindowMs) {
    requestCounts.set(address, { startedAt: now, count: 1 })
    return false
  }
  entry.count += 1
  return entry.count > rateLimitMaxRequests
}
function readStream(request, response) {
  const contentType = request.headers['content-type'] || ''
  const size = Number(request.headers['content-length'] || 0)
  if (!contentType.startsWith('video/') && contentType !== 'application/octet-stream') return json(response, 415, { error: 'Use a video or application/octet-stream request body' })
  if (size > 500 * 1024 * 1024) return json(response, 413, { error: 'Video exceeds the 500 MB limit' })
  const id = randomUUID(); const filename = `${id}${extname(request.headers['x-filename'] || '.video') || '.video'}`; const path = join(uploadDir, filename); const output = createWriteStream(path)
  request.pipe(output)
  output.on('finish', () => { const upload = { id, filename, path, size, status: 'queued', createdAt: new Date().toISOString() }; state.uploads.push(upload); audit('video.uploaded', request, { uploadId: id }); emit('upload.updated', { upload }); json(response, 202, { data: upload }) })
  output.on('error', () => json(response, 500, { error: 'Unable to store video' }))
}

function startUploadAnalysis(upload, every = 3) {
  if (upload.status === 'analyzing') return false
  upload.status = 'analyzing'
  upload.analysis = { framesProcessed: 0, detections: 0, alerts: 0, maxRisk: 0, lastResult: null, trackSummaries: {}, events: [], exits: [], personaMatches: [], startedAt: new Date().toISOString() }
  save()

  const worker = spawn(pythonBin, ['ai/test_video.py', upload.path, '--api', aiUrl, '--every', String(Math.max(1, Math.min(30, every)))], { cwd: process.cwd(), windowsHide: true })
  let output = ''
  worker.stdout.on('data', chunk => {
    output += chunk.toString()
    const lines = output.split(/\r?\n/)
    output = lines.pop() || ''
    for (const line of lines) {
      if (!line.trim()) continue
      try {
        const result = JSON.parse(line)
        upload.analysis.framesProcessed = Number(result.frame || upload.analysis.framesProcessed)
        upload.analysis.detections += Array.isArray(result.detections) ? result.detections.length : 0
        upload.analysis.alerts += result.type === 'ai_alert' ? 1 : 0
        upload.analysis.maxRisk = Math.max(upload.analysis.maxRisk, Number(result.risk_score || 0))
        upload.analysis.lastResult = result
        for (const track of result.risk_by_track || []) {
          const key = String(track.track_id)
          upload.analysis.trackSummaries[key] = { ...(upload.analysis.trackSummaries[key] || {}), ...track, lastFrame: result.frame }
        }
        for (const match of result.persona_matches || []) {
          if (!upload.analysis.personaMatches.some(item => item.track_id === match.track_id && item.persona_id === match.persona_id)) upload.analysis.personaMatches.push(match)
        }
        for (const signal of result.behavior_signals || []) {
          if (!['running', 'loitering', 'possible_fighting', 'synthetic_persona_match', 'track_exit'].includes(signal.type)) continue
          const event = { ...signal, frame: result.frame, timestamp: result.timestamp }
          upload.analysis.events.push(event)
          if (signal.type === 'track_exit') upload.analysis.exits.push(event)
        }
        upload.analysis.events = upload.analysis.events.slice(-200)
        upload.analysis.exits = upload.analysis.exits.slice(-100)
        if (upload.analysis.framesProcessed % 10 === 0) save()
      } catch (error) {
        upload.analysis.lastError = `Invalid analysis output: ${error.message}`
      }
    }
  })
  worker.stderr.on('data', chunk => { upload.analysis.lastError = chunk.toString().trim().slice(-1000) })
  worker.on('error', error => {
    upload.status = 'failed'
    upload.analysis.lastError = error.message
    upload.analysis.completedAt = new Date().toISOString()
    save()
  })
  worker.on('close', code => {
    upload.status = code === 0 ? 'completed' : 'failed'
    upload.analysis.completedAt = new Date().toISOString()
    upload.analysis.exitCode = code
    save()
  })
  return true
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`)
  response.setHeader('Access-Control-Allow-Origin', allowedOrigin); response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Operator-Id, X-Filename'); response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS'); response.setHeader('Vary', 'Origin')
  if (request.method === 'OPTIONS') { response.writeHead(204); return response.end() }
  if (rateLimited(request)) { response.setHeader('Retry-After', Math.ceil(rateLimitWindowMs / 1000)); return json(response, 429, { error: 'Too many requests' }) }
  if (!authorized(request)) return json(response, 401, { error: 'Unauthorized' })
  try {
    if (url.pathname === '/' && request.method === 'GET') return json(response, 200, { service: 'ibvap-realtime-api', frontend: 'http://localhost:8443/', health: '/api/health' })
    if (url.pathname === '/api/health') return json(response, 200, { status: 'ok', service: 'ibvap-realtime-api', version: '1.0.0', timestamp: new Date().toISOString() })
    if (url.pathname === '/api/criminals' && request.method === 'GET') return json(response, 200, { data: state.criminals })
    if (url.pathname === '/api/criminals' && request.method === 'POST') {
      const input = await parseBody(request)
      const criminal = {
        id: input.id || `CRIM-${String(state.criminals.length + 1).padStart(3, '0')}`,
        name: input.name || 'Unknown subject',
        aliases: input.aliases || [],
        gender: input.gender || 'U',
        age: Number(input.age || 0),
        height: input.height || 'n/a',
        weight: input.weight || 'n/a',
        eyeColor: input.eyeColor || 'n/a',
        hairColor: input.hairColor || 'n/a',
        crime: input.crime || 'pending classification',
        faceDescription: input.faceDescription || 'pending face profile',
        lastKnownLocation: input.lastKnownLocation || 'unknown',
        lastCamera: input.lastCamera || 'WEBCAM',
        lastSeen: input.lastSeen || new Date().toISOString(),
        watchStatus: input.watchStatus || 'manual-review',
        riskScore: Number(input.riskScore || 0),
        confidence: Number(input.confidence || 0),
      }
      state.criminals = [criminal, ...state.criminals.filter(item => item.id !== criminal.id)].slice(0, 200)
      save()
      return json(response, 201, { data: criminal })
    }
    if (url.pathname === '/api/criminals/candidates' && request.method === 'POST') {
      const input = await parseBody(request)
      const candidate = upsertFaceCandidate({
        cameraId: input.cameraId || 'WEBCAM',
        trackId: input.trackId ?? null,
        criminalName: input.criminalName || 'Potential criminal candidate',
        crime: input.crime || 'pending confirmation',
        height: input.height || 'n/a',
        weight: input.weight || 'n/a',
        lastSeen: input.lastSeen || new Date().toISOString(),
        location: input.location || 'unconfirmed',
        faceSaved: input.faceSaved !== false,
        similarity: Number(input.similarity || 0),
        matchScore: Number(input.score || input.matchScore || input.similarity || 0),
        notes: input.notes || 'Supervisor review required before criminal attribution.',
      })
      return json(response, 201, { data: candidate })
    }
    if (url.pathname.startsWith('/api/criminals/candidates/') && request.method === 'PATCH') {
      const candidateId = url.pathname.split('/').pop()
      const candidate = state.faceCandidates.find(item => item.id === candidateId)
      if (!candidate) return json(response, 404, { error: 'Candidate not found' })
      const input = await parseBody(request)
      const allowedStatuses = ['candidate', 'confirmed', 'rejected']
      if (!allowedStatuses.includes(input.status)) return json(response, 400, { error: 'Status must be candidate, confirmed, or rejected' })
      candidate.status = input.status
      candidate.reviewedAt = new Date().toISOString()
      candidate.reviewedBy = request.headers['x-operator-id'] || 'local-operator'
      candidate.reviewNotes = String(input.notes || '').slice(0, 500)
      audit(`face-candidate.${input.status}`, request, { candidateId })
      save()
      emit('candidate.updated', { candidate })
      return json(response, 200, { data: candidate })
    }
    if (url.pathname.startsWith('/api/criminals/candidates/') && request.method === 'DELETE') {
      const candidateId = url.pathname.split('/').pop()
      const exists = state.faceCandidates.some(item => item.id === candidateId)
      if (!exists) return json(response, 404, { error: 'Candidate not found' })
      state.faceCandidates = state.faceCandidates.filter(item => item.id !== candidateId)
      state.lastSeenRecords = state.lastSeenRecords.filter(item => item.id !== candidateId)
      audit('face-candidate.deleted', request, { candidateId })
      save()
      return json(response, 200, { data: { id: candidateId, deleted: true } })
    }
    if (url.pathname === '/api/entity-tracking' && request.method === 'GET') {
      const recentAlerts = state.alerts.slice(0, 8).map((alert) => ({ id: alert.id, severity: alert.severity, cam: alert.cam, track: alert.track, risk: alert.risk, time: alert.time, type: alert.type }))
      const persons = (state.faceCandidates || []).slice(0, 8).map((candidate, index) => ({
        id: candidate.trackId ? `TRACK-${candidate.trackId}` : `TRACK-${index + 1}`,
        type: 'PERSON',
        appearance: candidate.criminalName,
        movement: 'LIVE TRACK',
        loitering: 12 + index * 10,
        sector: candidate.location || 'LIVE CAMERA',
        risk: Math.max(40, Math.round(candidate.similarity * 100)),
        status: candidate.similarity >= 0.8 ? 'CRITICAL' : candidate.similarity >= 0.6 ? 'HIGH' : 'MEDIUM',
        faceAvailable: Boolean(candidate.faceSaved),
        cam: candidate.cameraId,
        x: 30 + index * 12,
        y: 20 + index * 10,
      }))
      const vehicles = (state.liceplates || []).slice(0, 5).map((plate, index) => ({
        id: `VEH-${index + 1}`,
        plate: plate.plate,
        confidence: plate.confidence * 100,
        cam: plate.cameraId,
        time: plate.recordedAt,
        status: plate.authorized ? 'AUTHORIZED' : 'WATCHLIST',
        type: 'UNSPECIFIED',
        color: 'UNSPECIFIED',
        distance: 1 + index,
        duration: `${index + 2} min`,
      }))
      return json(response, 200, { data: { persons, vehicles, alerts: recentAlerts, faceCandidates: state.faceCandidates.slice(0, 10), lastSeen: state.lastSeenRecords.slice(0, 10) } })
    }
    if (url.pathname === '/api/threat-intelligence' && request.method === 'GET') {
      const topThreat = state.alerts[0] || null
      const candidateThreats = (state.faceCandidates || []).slice(0, 5).map(item => ({
        id: item.id,
        criminalName: item.criminalName,
        crime: item.crime,
        cameraId: item.cameraId,
        risk: Math.round(item.similarity * 100),
        confidence: item.similarity,
        lastSeen: item.lastSeen,
        location: item.location,
      }))
      return json(response, 200, { data: {
        activeThreat: topThreat ? { id: topThreat.id, severity: topThreat.severity, type: topThreat.type, risk: topThreat.risk, camera: topThreat.cam, track: topThreat.track, time: topThreat.time } : null,
        factors: [
          { label: 'Restricted-zone entry', score: 32, reason: 'Observed when entity enters a monitored area.' },
          { label: 'Loitering', score: 22, reason: 'Suspicious pause duration near the camera view.' },
          { label: 'Track continuity', score: 18, reason: 'Cross-camera continuity remains active for the same entity.' },
          { label: 'Face candidate match', score: 26, reason: 'Possible biometric candidate present in the criminal watchlist.' },
        ],
        score: topThreat ? Math.max(topThreat.risk, 45) : 57,
        candidateMatches: candidateThreats,
        disclaimer: 'This is a candidate match queue. It is not a criminal judgement. A supervisor must confirm before any action is taken.',
      }})
    }
    if (url.pathname === '/api/analytics' && request.method === 'GET') {
      const incidentCount = state.incidents.length
      const alertCount = state.alerts.length
      const evidenceCount = state.evidence.length
      const cameraCount = state.cameras.length
      const unconfirmedCount = state.faceCandidates.filter(item => Number(item.similarity || 0) > 0.6).length
      return json(response, 200, { data: {
        incidentsOverTime: [
          { time: '00:00', critical: 1, high: 1, medium: 1, low: 1 },
          { time: '02:00', critical: 2, high: 2, medium: 2, low: 1 },
          { time: '04:00', critical: 1, high: 3, medium: 2, low: 2 },
          { time: '06:00', critical: 2, high: 1, medium: 2, low: 1 },
          { time: '08:00', critical: 1, high: 2, medium: 1, low: 0 },
        ],
        threatDistribution: [
          { name: 'CRITICAL', value: Math.min(100, Math.max(10, incidentCount * 8)), color: '#ef4444' },
          { name: 'HIGH', value: Math.min(100, Math.max(12, alertCount * 12)), color: '#f97316' },
          { name: 'MEDIUM', value: Math.min(100, Math.max(18, evidenceCount * 6)), color: '#f59e0b' },
          { name: 'LOW', value: Math.min(100, Math.max(10, unconfirmedCount * 16)), color: '#22c55e' },
        ],
        incidentsBySector: state.cameras.map((camera, index) => ({ sector: camera.sector || `SECTOR ${index + 1}`, count: Math.max(1, Math.round((camera.status === 'online' ? 4 : 1) + index)) })),
        objectDetections: [
          { hour: '00', persons: 11, vehicles: 2 },
          { hour: '01', persons: 14, vehicles: 2 },
          { hour: '02', persons: 19, vehicles: 4 },
          { hour: '03', persons: 22, vehicles: 5 },
          { hour: '04', persons: 17, vehicles: 3 },
        ],
        riskScores: [
          { range: '0-20', count: 8 },
          { range: '21-40', count: 12 },
          { range: '41-60', count: 9 },
          { range: '61-80', count: 5 },
          { range: '81-100', count: 3 },
        ],
        topIncidentTypes: [
          { type: 'Restricted zone entry', count: Math.max(4, incidentCount) },
          { type: 'Face candidate review', count: Math.max(3, unconfirmedCount) },
          { type: 'Unknown vehicle', count: Math.max(2, Math.min(12, alertCount)) },
          { type: 'Loitering', count: Math.max(2, cameraCount) },
          { type: 'Evidence capture', count: Math.max(3, evidenceCount) },
        ],
        cameraActivity: state.cameras.map(camera => ({ cam: camera.id, utilization: camera.status === 'online' ? 72 : 18 })),
        summary: { incidentCount, alertCount, evidenceCount, cameraCount, unconfirmedCount },
      } })
    }
    if (url.pathname === '/api/settings' && request.method === 'GET') return json(response, 200, { data: state.settings })
    if (url.pathname === '/api/settings' && request.method === 'PATCH') {
      const input = await parseBody(request)
      if (!input || typeof input !== 'object' || Array.isArray(input)) return json(response, 400, { error: 'Settings must be an object' })
      state.settings = { ...state.settings, ...input }
      audit('settings.updated', request, { keys: Object.keys(input) })
      save()
      return json(response, 200, { data: state.settings })
    }
    if (url.pathname === '/api/ai/health' && request.method === 'GET') { const aiResponse = await fetchAi('/health'); return json(response, aiResponse.status, await aiResponse.json()) }
    if (url.pathname === '/api/ai/frame' && request.method === 'POST') {
      const input = await parseBody(request)
      if (typeof input.image_base64 !== 'string') return json(response, 400, { error: 'image_base64 is required' })
      const camera = state.cameras.find((item) => item.id === (input.camera_id || 'CAM-PHONE'))
      const cameraId = input.camera_id || 'WEBCAM'
      latestFrames.set(cameraId, input.image_base64)
      const [, encodedFrame] = input.image_base64.split(',', 2)
      const frameBuffer = Buffer.from(encodedFrame || input.image_base64, 'base64')
      publishFrame(cameraId, frameBuffer)
      const aiResponse = await fetchAi('/infer/frame', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ camera_id: cameraId, image_base64: input.image_base64 }) })
      const result = await aiResponse.json()
      latestAiResults.set(input.camera_id || 'CAM-PHONE', result)
      if (Array.isArray(result.persona_matches) && result.persona_matches.length) {
        for (const match of result.persona_matches) {
          const criminal = state.criminals.find(item => item.name.toLowerCase().includes(String(match.display_label || '').toLowerCase().replace(/[^a-z]/g, '')) || item.id.toLowerCase() === String(match.persona_id || '').toLowerCase())
          upsertFaceCandidate({
            cameraId: cameraId,
            personaId: match.persona_id ?? null,
            trackId: match.track_id ?? result.detections?.[0]?.track_id ?? null,
            criminalName: criminal?.name || match.display_label || 'Potential watchlist candidate',
            crime: criminal?.crime || 'potential face match review',
            height: criminal?.height || 'unknown',
            weight: criminal?.weight || 'unknown',
            lastSeen: result.timestamp || new Date().toISOString(),
            location: camera?.sector || 'Camera field',
            faceSaved: true,
            similarity: Number(match.similarity || 0),
            matchScore: Number(match.similarity || 0),
            notes: 'Supervisor review required before criminal attribution.',
          })
        }
      }
      if (!aiResponse.ok) return json(response, aiResponse.status, result)
      for (const detection of result.detections || []) {
        if (detection.label !== 'license_plate') continue
        const plateText = String(detection.plate_text || '').replace(/[^A-Z0-9]/gi, '').toUpperCase()
        if (!indianPlatePattern.test(plateText)) continue
        const key = `${cameraId}:${detection.box.join(',')}`
        const now = Date.now()
        const existing = state.liceplates.find((record) => record.cameraId === cameraId && record.box?.join(',') === detection.box.join(',') && now - Date.parse(record.recordedAt) < 15000)
        if (existing) {
          if (existing.plate !== plateText) {
            existing.plate = plateText
            existing.updatedAt = new Date(now).toISOString()
          }
          continue
        }
        if (now - (plateLastSeen.get(key) || 0) < 3000) continue
        plateLastSeen.set(key, now)
        state.liceplates.unshift({ id: `LP-${now}-${state.liceplates.length}`, name: 'liceplate', plate: plateText, confidence: detection.confidence, cameraId: cameraId, location: camera?.locationName || camera?.sector || 'Unknown location', sensitive: Boolean(camera?.sensitiveArea), authorized: state.authorizedPlates.includes(plateText), recordedAt: result.timestamp || new Date(now).toISOString(), box: detection.box, rto: null })
      }
      state.liceplates = state.liceplates.slice(0, 1000)
      save()
      state.ai = { status: 'online', lastEvent: result }
      if (result.type === 'ai_alert') { const incident = { id: `INC-${Date.now()}`, ...result, status: 'OPEN', createdAt: new Date().toISOString() }; const evidence = createEvidence(input.camera_id || 'CAM-PHONE', result, input.image_base64); incident.evidenceId = evidence.id; state.incidents.unshift(incident); state.incidents = state.incidents.slice(0, maxIncidentHistory); state.alerts.unshift({ id: incident.id, severity: result.severity, type: result.behavior_signals?.[0]?.type || 'Unusual Activity', cam: result.camera_id, track: result.detections?.[0]?.track_id ? `TRACK-${result.detections[0].track_id}` : 'UNTRACKED', risk: result.risk_score, time: new Date().toLocaleTimeString('en-IN', { hour12: false }), read: false, evidenceId: evidence.id }); state.alerts = state.alerts.slice(0, maxAlertHistory); audit('ai.alert.created', request, { incidentId: incident.id, evidenceId: evidence.id }); save(); emit('ai_alert', { event: result, incident, evidence }) } else emit('ai_update', { event: result })
      return json(response, 200, result)
    }
    const aiCameraId = url.pathname.match(/^\/api\/cameras\/([^/]+)\/ai$/)?.[1]
    if (aiCameraId && request.method === 'GET') return latestAiResults.has(aiCameraId) ? json(response, 200, latestAiResults.get(aiCameraId)) : json(response, 404, { error: 'No AI result available' })
    if (url.pathname === '/api/liceplates' && request.method === 'GET') return json(response, 200, { data: state.liceplates })
    if (url.pathname === '/api/authorized-plates' && request.method === 'GET') return json(response, 200, { data: state.authorizedPlates })
    if (url.pathname === '/api/authorized-plates' && request.method === 'POST') {
      const input = await parseBody(request)
      const plate = String(input.plate || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
      if (!indianPlatePattern.test(plate)) return json(response, 400, { error: 'Invalid plate format' })
      if (!state.authorizedPlates.includes(plate)) { state.authorizedPlates.push(plate); audit('plate.authorized', request, { plate }); save() }
      return json(response, 200, { data: plate })
    }
    if (url.pathname === '/api/zones' && request.method === 'GET') return json(response, 200, { data: state.customZones })
    if (url.pathname === '/api/zones' && request.method === 'POST') {
      const input = await parseBody(request)
      if (!input.name || !Array.isArray(input.polygon) || input.polygon.length < 3) return json(response, 400, { error: 'name and polygon (>=3 points) required' })
      const zone = { id: randomUUID(), name: String(input.name), polygon: input.polygon, type: input.type === 'danger' ? 'danger' : 'normal', rule: input.type === 'danger' ? 'restricted' : 'loiter', loiter_seconds: input.loiter_seconds || 20, createdAt: new Date().toISOString() }
      state.customZones = state.customZones.filter(z => z.name !== zone.name)
      state.customZones.push(zone)
      audit('zone.saved', request, { name: zone.name }); save()
      return json(response, 200, { data: zone })
    }
    if (url.pathname === '/api/zones' && request.method === 'DELETE') {
      const input = await parseBody(request)
      state.customZones = state.customZones.filter(z => z.id !== input.id)
      audit('zone.deleted', request, { id: input.id }); save()
      return json(response, 200, { data: { deleted: true } })
    }
    if (url.pathname === '/api/fov-profiles' && request.method === 'GET') return json(response, 200, { data: state.fovProfiles })
    if (url.pathname === '/api/fov-profiles' && request.method === 'POST') {
      const input = await parseBody(request)
      if (!input.name) return json(response, 400, { error: 'name required' })
      const profile = { id: randomUUID(), name: String(input.name), cameraId: input.cameraId || 'CAM-PHONE', coordinateSpace: 'camera_view_normalized', zones: input.zones || [], active: false, createdAt: new Date().toISOString() }
      state.fovProfiles.push(profile)
      audit('fov.profile.created', request, { name: profile.name }); save()
      return json(response, 200, { data: profile })
    }
    if (url.pathname === '/api/fov-profiles' && request.method === 'PUT') {
      const input = await parseBody(request)
      const profile = state.fovProfiles.find(p => p.id === input.id)
      if (!profile) return json(response, 404, { error: 'Profile not found' })
      if (input.zones !== undefined) profile.zones = input.zones
      if (input.name !== undefined) profile.name = input.name
      if (input.cameraId !== undefined) profile.cameraId = input.cameraId
      if (profile.active) state.customZones = profile.zones.map(z => ({ id: z.id || randomUUID(), name: z.name, polygon: z.polygon, type: z.type, rule: z.type === 'danger' ? 'restricted' : 'loiter', loiter_seconds: z.loiter_seconds || 20, loiter_max_displacement_px: 120 }))
      audit('fov.profile.updated', request, { id: profile.id }); save()
      return json(response, 200, { data: profile })
    }
    if (url.pathname === '/api/fov-profiles/activate' && request.method === 'POST') {
      const input = await parseBody(request)
      const profile = state.fovProfiles.find(p => p.id === input.id)
      if (!profile) return json(response, 404, { error: 'Profile not found' })
      state.fovProfiles.forEach(p => p.active = p.id === input.id)
      state.customZones = profile.zones.map(z => ({
        id: z.id || randomUUID(),
        name: z.name,
        polygon: z.polygon,
        type: z.type,
        rule: z.type === 'danger' ? 'restricted' : 'loiter',
        loiter_seconds: z.loiter_seconds || 20,
        loiter_max_displacement_px: 120
      }))
      audit('fov.profile.activated', request, { name: profile.name }); save()
      return json(response, 200, { data: profile })
    }
    if (url.pathname === '/api/fov-profiles' && request.method === 'DELETE') {
      const input = await parseBody(request)
      const deletedProfile = state.fovProfiles.find(p => p.id === input.id)
      state.fovProfiles = state.fovProfiles.filter(p => p.id !== input.id)
      if (deletedProfile?.active) state.customZones = []
      audit('fov.profile.deleted', request, { id: input.id }); save()
      return json(response, 200, { data: { deleted: true } })
    }
    if (url.pathname === '/api/authorized-plates' && request.method === 'DELETE') {
      const input = await parseBody(request)
      const plate = String(input.plate || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
      state.authorizedPlates = state.authorizedPlates.filter(p => p !== plate)
      audit('plate.deauthorized', request, { plate }); save()
      return json(response, 200, { data: plate })
    }
    const plateLookup = url.pathname.match(/^\/api\/liceplates\/([^/]+)\/rto$/)?.[1]
    if (plateLookup && request.method === 'GET') {
      const record = state.liceplates.find((item) => item.id === plateLookup)
      if (!record) return json(response, 404, { error: 'Liceplate record not found' })
      if (!rtoApiUrl || !rtoApiKey) return json(response, 503, { error: 'Authorized RTO provider is not configured' })
      const rtoResponse = await fetch(`${rtoApiUrl.replace(/\/$/, '')}?registration_number=${encodeURIComponent(record.plate)}`, { headers: { Authorization: `Bearer ${rtoApiKey}` } })
      const rto = await rtoResponse.json()
      if (!rtoResponse.ok) return json(response, rtoResponse.status, { error: 'RTO lookup failed' })
      record.rto = { ...rto, fetchedAt: new Date().toISOString() }
      save()
      return json(response, 200, { data: record.rto })
    }
    if (url.pathname === '/api/cameras/CAM-PHONE/frame' && request.method === 'POST') {
      const input = await parseBody(request)
      if (typeof input.image_base64 !== 'string') return json(response, 400, { error: 'image_base64 is required' })
      latestFrames.set('CAM-PHONE', input.image_base64)
      const [, encodedFrame] = input.image_base64.split(',', 2)
      publishFrame('CAM-PHONE', Buffer.from(encodedFrame || input.image_base64, 'base64'))
      return json(response, 202, { accepted: true })
    }
    const frameCameraId = url.pathname.match(/^\/api\/cameras\/([^/]+)\/frame$/)?.[1]
    if (frameCameraId && request.method === 'GET') {
      const image = latestFrames.get(frameCameraId)
      if (!image) return json(response, 404, { error: 'No frame available' })
      const [header, encoded] = image.split(',', 2)
      const contentType = header?.match(/^data:(image\/[^;]+);base64$/)?.[1] || 'image/jpeg'
      response.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': allowedOrigin, Vary: 'Origin' })
      return response.end(Buffer.from(encoded || image, 'base64'))
    }
    const liveCameraId = url.pathname.match(/^\/api\/cameras\/([^/]+)\/live$/)?.[1]
    if (liveCameraId && request.method === 'GET') {
      response.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-store', Connection: 'keep-alive', 'Access-Control-Allow-Origin': allowedOrigin, Vary: 'Origin' })
      response.write(': connected\n\n')
      const liveClients = liveFrameClients.get(liveCameraId) || new Set()
      const client = { response, lastSentAt: 0 }
      liveClients.add(client)
      liveFrameClients.set(liveCameraId, liveClients)
      const image = latestFrames.get(liveCameraId)
      if (image) response.write(`data: ${JSON.stringify({ image })}\n\n`)
      request.on('close', () => liveClients.delete(client))
      return
    }
    const streamCameraId = url.pathname.match(/^\/api\/cameras\/([^/]+)\/stream$/)?.[1]
    if (streamCameraId && request.method === 'GET') {
      response.writeHead(200, { 'Content-Type': 'multipart/x-mixed-replace; boundary=frame', 'Cache-Control': 'no-cache, no-store', Connection: 'keep-alive', 'Access-Control-Allow-Origin': allowedOrigin, Vary: 'Origin' })
      const streamClients = frameStreams.get(streamCameraId) || new Set()
      const client = { response, latest: null, writing: false }
      streamClients.add(client)
      frameStreams.set(streamCameraId, streamClients)
      const image = latestFrames.get(streamCameraId)
      if (image) {
        const [, encoded] = image.split(',', 2)
        const frameBuffer = Buffer.from(encoded || image, 'base64')
        publishFrame(streamCameraId, frameBuffer)
      }
      request.on('close', () => streamClients.delete(client))
      return
    }
    if (url.pathname === '/api/events') { response.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'Access-Control-Allow-Origin': allowedOrigin, Vary: 'Origin' }); response.write(': connected\n\n'); clients.add(response); emit('snapshot', snapshot()); request.on('close', () => clients.delete(response)); return }
    if (url.pathname === '/api/cameras' && request.method === 'GET') return json(response, 200, { data: state.cameras })
    if (url.pathname === '/api/cameras' && request.method === 'POST') { const input = await parseBody(request); if (!input.id || !input.sector) return json(response, 400, { error: 'id and sector are required' }); if (state.cameras.some((camera) => camera.id === input.id)) return json(response, 409, { error: 'Camera already exists' }); const camera = { ...input, status: input.status || 'offline', protocol: input.protocol || 'rtsp', lastSeen: new Date().toISOString() }; state.cameras.push(camera); audit('camera.created', request, { cameraId: camera.id }); save(); emit('camera.updated', { camera }); return json(response, 201, { data: camera }) }
    const cameraId = url.pathname.match(/^\/api\/cameras\/([^/]+)$/)?.[1]
    const ptzCameraId = url.pathname.match(/^\/api\/cameras\/([^/]+)\/ptz$/)?.[1]
    if (ptzCameraId && request.method === 'GET') {
      const camera = state.cameras.find(item => item.id === ptzCameraId)
      if (!camera) return json(response, 404, { error: 'Camera not found' })
      return json(response, 200, { data: { cameraId: camera.id, role: camera.role, ...camera.ptz, controller: process.env.PTZ_CONTROLLER || null } })
    }
    if (ptzCameraId && request.method === 'POST') {
      const camera = state.cameras.find(item => item.id === ptzCameraId)
      if (!camera) return json(response, 404, { error: 'Camera not found' })
      if (!camera.ptz?.available || !process.env.PTZ_CONTROLLER) return json(response, 503, { error: 'PTZ controller is not configured for this camera', cameraId: ptzCameraId, cameraRole: camera.role, visionOnly: true })
      const input = await parseBody(request)
      const command = { id: randomUUID(), cameraId: ptzCameraId, type: 'track_target', trackId: input.trackId ?? null, bearing: input.bearing, elevation: input.elevation, zoom: input.zoom, createdAt: new Date().toISOString() }
      state.ptzCommands.unshift(command)
      state.ptzCommands = state.ptzCommands.slice(0, 100)
      audit('ptz.target.commanded', request, { cameraId: ptzCameraId, trackId: command.trackId })
      save()
      return json(response, 202, { data: command, visionOnly: true })
    }
    if (cameraId && request.method === 'PATCH') { const camera = state.cameras.find((item) => item.id === cameraId); if (!camera) return json(response, 404, { error: 'Camera not found' }); Object.assign(camera, await parseBody(request), { updatedAt: new Date().toISOString() }); audit('camera.updated', request, { cameraId }); save(); emit('camera.updated', { camera }); return json(response, 200, { data: camera }) }
    if (cameraId && request.method === 'DELETE') { const previous = state.cameras.length; state.cameras = state.cameras.filter((item) => item.id !== cameraId); if (previous === state.cameras.length) return json(response, 404, { error: 'Camera not found' }); audit('camera.deleted', request, { cameraId }); save(); emit('camera.deleted', { cameraId }); return json(response, 200, { data: { id: cameraId, deleted: true } }) }
    if (url.pathname === '/api/alerts' && request.method === 'GET') return json(response, 200, { data: state.alerts })
    if (url.pathname === '/api/incidents' && request.method === 'GET') return json(response, 200, { data: state.incidents })
    if (url.pathname === '/api/evidence' && request.method === 'GET') return json(response, 200, { data: state.evidence })
    const evidenceFrameId = url.pathname.match(/^\/api\/evidence\/([^/]+)\/frame$/)?.[1]
    if (evidenceFrameId && request.method === 'GET') {
      const evidence = state.evidence.find(item => item.id === evidenceFrameId)
      if (!evidence || !existsSync(evidence.framePath)) return json(response, 404, { error: 'Evidence frame not found' })
      response.writeHead(200, { 'Content-Type': 'image/jpeg', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': allowedOrigin, Vary: 'Origin' })
      return createReadStream(evidence.framePath).pipe(response)
    }
    if (url.pathname === '/api/audit' && request.method === 'GET') return json(response, 200, { data: state.audit })
    if (url.pathname === '/api/uploads' && request.method === 'GET') return json(response, 200, { data: state.uploads })
    if (url.pathname === '/api/uploads' && request.method === 'POST') return readStream(request, response)
    const analysisUploadId = url.pathname.match(/^\/api\/uploads\/([^/]+)\/analyze$/)?.[1]
    if (analysisUploadId && request.method === 'POST') {
      const upload = state.uploads.find((item) => item.id === analysisUploadId)
      if (!upload || !existsSync(upload.path)) return json(response, 404, { error: 'Video not found' })
      const input = await parseBody(request)
      if (!startUploadAnalysis(upload, Number(input.every || 3))) return json(response, 409, { error: 'Analysis already running' })
      return json(response, 202, { data: upload })
    }
    const analysisStatusId = url.pathname.match(/^\/api\/uploads\/([^/]+)\/analysis$/)?.[1]
    if (analysisStatusId && request.method === 'GET') {
      const upload = state.uploads.find((item) => item.id === analysisStatusId)
      if (!upload) return json(response, 404, { error: 'Video not found' })
      return json(response, 200, { data: { id: upload.id, status: upload.status, analysis: upload.analysis || null } })
    }
    const uploadId = url.pathname.match(/^\/api\/uploads\/([^/]+)$/)?.[1]
    if (uploadId && request.method === 'GET') { const upload = state.uploads.find((item) => item.id === uploadId); if (!upload || !existsSync(upload.path)) return json(response, 404, { error: 'Video not found' }); response.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Content-Length': upload.size }); return createReadStream(upload.path).pipe(response) }
    return json(response, 404, { error: 'Route not found' })
  } catch (error) { console.error(error); return json(response, 400, { error: error.message || 'Invalid request' }) }
})
setInterval(() => emit('snapshot', snapshot()), 2000)
server.listen(port, '0.0.0.0', () => console.log(`IBVAP realtime API listening on http://localhost:${port}`))

const websocketServer = new WebSocketServer({ noServer: true, perMessageDeflate: false })
server.on('upgrade', (request, socket, head) => {
  const upgradePath = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`).pathname
  const cameraId = upgradePath.match(/^\/api\/cameras\/([^/]+)\/(ws|upload)$/)?.[1]
  const upload = upgradePath.endsWith('/upload')
  if (!cameraId) { socket.destroy(); return }
  websocketServer.handleUpgrade(request, socket, head, (client) => {
    if (upload) {
      const uploadClients = uploadSocketClients.get(cameraId) || new Set()
      uploadClients.add(client)
      uploadSocketClients.set(cameraId, uploadClients)
      activeUploadSockets.set(cameraId, client)
      client.on('message', (message, isBinary) => {
        if (!isBinary) return
        const frameBuffer = Buffer.from(message)
        latestFrames.set(cameraId, `data:image/jpeg;base64,${frameBuffer.toString('base64')}`)
        publishFrame(cameraId, frameBuffer)
      })
      client.on('close', () => {
        uploadClients.delete(client)
        if (activeUploadSockets.get(cameraId) !== client) return
        activeUploadSockets.delete(cameraId)
        if (uploadClients.size === 0) publishCameraOffline(cameraId)
      })
      return
    }
    const socketClients = liveSocketClients.get(cameraId) || new Set()
    client.lastSentAt = 0
    socketClients.add(client)
    liveSocketClients.set(cameraId, socketClients)
    const image = latestFrames.get(cameraId)
    if (image) {
      const [, encoded] = image.split(',', 2)
      client.send(Buffer.from(encoded || image, 'base64'))
    }
    client.on('close', () => socketClients.delete(client))
  })
})
