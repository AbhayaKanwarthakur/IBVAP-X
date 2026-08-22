import { createReadStream, createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { randomUUID } from 'node:crypto'
import { extname, join } from 'node:path'

const port = Number(process.env.API_PORT || 8787)
const aiUrl = process.env.AI_URL || 'http://localhost:9000'
const rtoApiUrl = process.env.RTO_API_URL || ''
const rtoApiKey = process.env.RTO_API_KEY || ''
const dataDir = process.env.DATA_DIR || join(process.cwd(), 'server', 'data')
const uploadDir = join(dataDir, 'uploads')
mkdirSync(uploadDir, { recursive: true })
const stateFile = join(dataDir, 'state.json')
const clients = new Set()
const frameStreams = new Map()
const plateLastSeen = new Map()

const cameras = [
  ['CAM-PHONE', 'MOBILE FIELD UNIT', 'offline', 0, 0, '1080p', 0, 50, 50],
].map(([id, sector, status, fps, latency, resolution, uptime, x, y]) => ({ id, sector, status, fps, latency, resolution, uptime, location: { x, y }, streamUrl: '', protocol: 'browser-camera', lastSeen: new Date().toISOString() }))
const alerts = [
  { id: 'ALT-001', severity: 'CRITICAL', type: 'Restricted Zone Intrusion', cam: 'CAM-04', track: 'TRACK-037', risk: 91, time: '02:14:32', read: false },
  { id: 'ALT-002', severity: 'HIGH', type: 'Unusual Loitering', cam: 'CAM-02', track: 'TRACK-019', risk: 73, time: '01:58:17', read: false },
  { id: 'ALT-003', severity: 'MEDIUM', type: 'Unknown Vehicle', cam: 'CAM-06', track: 'VEH-008', risk: 52, time: '03:12:45', read: false },
]
const initialState = { cameras, alerts: [], incidents: [], uploads: [], audit: [], ai: { status: 'offline', lastEvent: null } }
let state = existsSync(stateFile) ? JSON.parse(readFileSync(stateFile, 'utf8')) : initialState
state.liceplates ??= []
for (const camera of state.cameras) camera.sensitiveArea ??= false
const latestFrames = new Map()
const latestAiResults = new Map()
const indianPlatePattern = /^(?:[A-Z]{2}[0-9]{1,2}[A-Z]{1,3}[0-9]{1,4}|[0-9]{2}BH[0-9]{4}[A-Z]{1,2})$/

function publishFrame(cameraId, frameBuffer) {
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

function save() { writeFileSync(stateFile, JSON.stringify(state, null, 2)) }
function json(response, status, payload) { response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' }); response.end(JSON.stringify(payload)) }
function parseBody(request) { return new Promise((resolve, reject) => { let value = ''; request.on('data', (chunk) => { value += chunk }); request.on('end', () => { try { resolve(value ? JSON.parse(value) : {}) } catch { reject(new Error('Invalid JSON')) } }); request.on('error', reject) }) }
function audit(action, request, metadata = {}) { state.audit.unshift({ id: randomUUID(), action, actor: request.headers['x-operator-id'] || 'local-operator', timestamp: new Date().toISOString(), metadata }); state.audit = state.audit.slice(0, 500); save() }
function snapshot() { return { cameras: state.cameras, alerts: state.alerts, incidents: state.incidents, health: { api: 'online', cameraNetwork: state.cameras.some((camera) => camera.status !== 'online') ? 'warning' : 'online', activeStreams: state.cameras.filter((camera) => camera.status === 'online').length } } }
function emit(type, data) { const payload = { type, timestamp: new Date().toISOString(), ...data }; for (const client of clients) client.write(`data: ${JSON.stringify(payload)}\n\n`) }
function authorized(request) { return !process.env.AUTH_TOKEN || request.headers.authorization === `Bearer ${process.env.AUTH_TOKEN}` }
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

const server = createServer(async (request, response) => {
  const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`)
  response.setHeader('Access-Control-Allow-Origin', '*'); response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Operator-Id, X-Filename'); response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS')
  if (request.method === 'OPTIONS') { response.writeHead(204); return response.end() }
  if (!authorized(request)) return json(response, 401, { error: 'Unauthorized' })
  try {
    if (url.pathname === '/api/health') return json(response, 200, { status: 'ok', service: 'ibvap-realtime-api', version: '1.0.0', timestamp: new Date().toISOString() })
    if (url.pathname === '/api/ai/health' && request.method === 'GET') { const aiResponse = await fetch(`${aiUrl}/health`); return json(response, aiResponse.status, await aiResponse.json()) }
    if (url.pathname === '/api/ai/frame' && request.method === 'POST') {
      const input = await parseBody(request)
      if (typeof input.image_base64 !== 'string') return json(response, 400, { error: 'image_base64 is required' })
      latestFrames.set(input.camera_id || 'CAM-PHONE', input.image_base64)
      const [, encodedFrame] = input.image_base64.split(',', 2)
      const frameBuffer = Buffer.from(encodedFrame || input.image_base64, 'base64')
      publishFrame(input.camera_id || 'CAM-PHONE', frameBuffer)
      const aiResponse = await fetch(`${aiUrl}/infer/frame`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ camera_id: input.camera_id || 'CAM-PHONE', image_base64: input.image_base64 }) })
      const result = await aiResponse.json()
      latestAiResults.set(input.camera_id || 'CAM-PHONE', result)
      if (!aiResponse.ok) return json(response, aiResponse.status, result)
      const camera = state.cameras.find((item) => item.id === (input.camera_id || 'CAM-PHONE'))
      for (const detection of result.detections || []) {
        if (detection.label !== 'license_plate') continue
        const plateText = String(detection.plate_text || '').replace(/[^A-Z0-9]/gi, '').toUpperCase()
        if (!indianPlatePattern.test(plateText)) continue
        const key = `${input.camera_id || 'CAM-PHONE'}:${detection.box.join(',')}`
        const now = Date.now()
        const existing = state.liceplates.find((record) => record.cameraId === (input.camera_id || 'CAM-PHONE') && record.box?.join(',') === detection.box.join(',') && now - Date.parse(record.recordedAt) < 15000)
        if (existing) {
          if (existing.plate !== plateText) {
            existing.plate = plateText
            existing.updatedAt = new Date(now).toISOString()
          }
          continue
        }
        if (now - (plateLastSeen.get(key) || 0) < 3000) continue
        plateLastSeen.set(key, now)
        state.liceplates.unshift({ id: `LP-${now}-${state.liceplates.length}`, name: 'liceplate', plate: plateText, confidence: detection.confidence, cameraId: input.camera_id || 'CAM-PHONE', location: camera?.locationName || camera?.sector || 'Unknown location', sensitive: Boolean(camera?.sensitiveArea), recordedAt: result.timestamp || new Date(now).toISOString(), box: detection.box, rto: null })
      }
      state.liceplates = state.liceplates.slice(0, 1000)
      save()
      state.ai = { status: 'online', lastEvent: result }
      if (result.type === 'ai_alert') { const incident = { id: `INC-${Date.now()}`, ...result, status: 'OPEN', createdAt: new Date().toISOString() }; state.incidents.unshift(incident); state.alerts.unshift({ id: incident.id, severity: result.severity, type: 'Unusual Activity', cam: result.camera_id, track: result.detections?.[0]?.track_id ? `TRACK-${result.detections[0].track_id}` : 'UNTRACKED', risk: result.risk_score, time: new Date().toLocaleTimeString('en-IN', { hour12: false }), read: false }); audit('ai.alert.created', request, { incidentId: incident.id }); save(); emit('ai_alert', { event: result, incident }) } else emit('ai_update', { event: result })
      return json(response, 200, result)
    }
    const aiCameraId = url.pathname.match(/^\/api\/cameras\/([^/]+)\/ai$/)?.[1]
    if (aiCameraId && request.method === 'GET') return latestAiResults.has(aiCameraId) ? json(response, 200, latestAiResults.get(aiCameraId)) : json(response, 404, { error: 'No AI result available' })
    if (url.pathname === '/api/liceplates' && request.method === 'GET') return json(response, 200, { data: state.liceplates })
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
      response.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' })
      return response.end(Buffer.from(encoded || image, 'base64'))
    }
    const streamCameraId = url.pathname.match(/^\/api\/cameras\/([^/]+)\/stream$/)?.[1]
    if (streamCameraId && request.method === 'GET') {
      response.writeHead(200, { 'Content-Type': 'multipart/x-mixed-replace; boundary=frame', 'Cache-Control': 'no-cache, no-store', Connection: 'keep-alive', 'Access-Control-Allow-Origin': '*' })
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
    if (url.pathname === '/api/events') { response.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'Access-Control-Allow-Origin': '*' }); response.write(': connected\n\n'); clients.add(response); emit('snapshot', snapshot()); request.on('close', () => clients.delete(response)); return }
    if (url.pathname === '/api/cameras' && request.method === 'GET') return json(response, 200, { data: state.cameras })
    if (url.pathname === '/api/cameras' && request.method === 'POST') { const input = await parseBody(request); if (!input.id || !input.sector) return json(response, 400, { error: 'id and sector are required' }); if (state.cameras.some((camera) => camera.id === input.id)) return json(response, 409, { error: 'Camera already exists' }); const camera = { ...input, status: input.status || 'offline', protocol: input.protocol || 'rtsp', lastSeen: new Date().toISOString() }; state.cameras.push(camera); audit('camera.created', request, { cameraId: camera.id }); save(); emit('camera.updated', { camera }); return json(response, 201, { data: camera }) }
    const cameraId = url.pathname.match(/^\/api\/cameras\/([^/]+)$/)?.[1]
    if (cameraId && request.method === 'PATCH') { const camera = state.cameras.find((item) => item.id === cameraId); if (!camera) return json(response, 404, { error: 'Camera not found' }); Object.assign(camera, await parseBody(request), { updatedAt: new Date().toISOString() }); audit('camera.updated', request, { cameraId }); save(); emit('camera.updated', { camera }); return json(response, 200, { data: camera }) }
    if (cameraId && request.method === 'DELETE') { const previous = state.cameras.length; state.cameras = state.cameras.filter((item) => item.id !== cameraId); if (previous === state.cameras.length) return json(response, 404, { error: 'Camera not found' }); audit('camera.deleted', request, { cameraId }); save(); emit('camera.deleted', { cameraId }); return json(response, 200, { data: { id: cameraId, deleted: true } }) }
    if (url.pathname === '/api/alerts' && request.method === 'GET') return json(response, 200, { data: state.alerts })
    if (url.pathname === '/api/incidents' && request.method === 'GET') return json(response, 200, { data: state.incidents })
    if (url.pathname === '/api/audit' && request.method === 'GET') return json(response, 200, { data: state.audit })
    if (url.pathname === '/api/uploads' && request.method === 'GET') return json(response, 200, { data: state.uploads })
    if (url.pathname === '/api/uploads' && request.method === 'POST') return readStream(request, response)
    const uploadId = url.pathname.match(/^\/api\/uploads\/([^/]+)$/)?.[1]
    if (uploadId && request.method === 'GET') { const upload = state.uploads.find((item) => item.id === uploadId); if (!upload || !existsSync(upload.path)) return json(response, 404, { error: 'Video not found' }); response.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Content-Length': upload.size }); return createReadStream(upload.path).pipe(response) }
    return json(response, 404, { error: 'Route not found' })
  } catch (error) { console.error(error); return json(response, 400, { error: error.message || 'Invalid request' }) }
})
setInterval(() => emit('snapshot', snapshot()), 2000)
server.listen(port, '0.0.0.0', () => console.log(`IBVAP realtime API listening on http://localhost:${port}`))
