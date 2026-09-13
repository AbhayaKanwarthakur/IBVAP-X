import { useEffect, useRef, useState } from 'react'
import { Camera, CircleStop, Maximize2, RefreshCw, ShieldAlert, Video, X } from 'lucide-react'
import { apiUrl } from '../api/client'

const ACTIVE_CAMERA_ID = 'WEBCAM'
const API_URL = apiUrl(`/api/cameras/${ACTIVE_CAMERA_ID}`)
type CameraWindow = Window & { __ibvapCameraStream?: MediaStream }

type CameraStatus = 'idle' | 'requesting' | 'live' | 'denied' | 'error'
type PersonaMatch = { track_id?: number; display_label: string; similarity: number; fictional_case_note: string; synthetic: true; disclaimer?: string; reference_angle?: string }
type AiResult = { detections: Array<{ track_id: number | null; label: string; confidence: number; box: number[]; plate_text?: string | null; persona_match?: PersonaMatch }>; anomaly_score: number; risk_score: number; severity: string; behavior_signals?: Array<{ type: string; track_id: number; zone?: string | null; detail: string; severity: number }>; risk_by_track?: Array<{ track_id: number; risk_score: number; severity: string }>; persona_matches?: PersonaMatch[]; persona_diagnostics?: { matches: number; person_candidates: number; face_embeddings: number; threshold?: number }; metrics?: { inference_fps: number; total_latency_ms: number }; models?: { yolo: string; plate: string; ocr?: string }; frame_size?: { width: number; height: number } }
type LiceplateRecord = { id: string; name: 'liceplate'; plate: string | null; confidence: number; cameraId: string; location: string; sensitive: boolean; recordedAt: string; rto?: Record<string, unknown> | null }
type ZoneDef = { id?: string; name: string; polygon: number[][]; rule: string; type?: 'danger' | 'safe' }

function ZoneOverlay({ feed, fw, fh, zones, activeZones }: { feed: HTMLDivElement; fw: number; fh: number; zones: ZoneDef[]; activeZones: Set<string> }) {
  const rect = feed.getBoundingClientRect()
  const elW = rect.width, elH = rect.height
  const videoAR = fw / Math.max(fh, 1), elAR = elW / Math.max(elH, 1)
  let rendW: number, rendH: number, offX: number, offY: number
  if (videoAR > elAR) { rendW = elW; rendH = elW / videoAR; offX = 0; offY = (elH - rendH) / 2 }
  else { rendH = elH; rendW = elH * videoAR; offY = 0; offX = (elW - rendW) / 2 }
  const toPixel = (nx: number, ny: number) => [offX + nx * rendW, offY + ny * rendH]
  return (
    <svg className="absolute inset-0 pointer-events-none" width={elW} height={elH}>
      {zones.map(zone => {
        const pts = zone.polygon.map(([nx, ny]) => toPixel(nx, ny))
        const points = pts.map(p => p.join(',')).join(' ')
        const active = activeZones.has(zone.name)
        const danger = zone.rule === 'restricted' || zone.type === 'danger'
        const color = danger ? (active ? '#ef4444' : '#f97316') : '#38bdf8'
        const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length
        const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length
        return (
          <g key={zone.name}>
            <polygon points={points} fill={`${color}18`} stroke={color} strokeWidth={active ? 2 : 1} strokeDasharray={danger ? undefined : '6 3'} />
            <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" fill={color} fontSize={10} fontFamily="monospace" style={{ textTransform: 'uppercase', letterSpacing: 1 }}>{zone.name.replace(/_/g, ' ')}</text>
          </g>
        )
      })}
    </svg>
  )
}

function getDisplayedBox(video: HTMLVideoElement, feed: HTMLDivElement, box: number[], fw: number, fh: number) {
  const [x1, y1, x2, y2] = box
  const feedRect = feed.getBoundingClientRect()
  // object-contain: compute the actual rendered video rect inside the element
  const elW = feedRect.width
  const elH = feedRect.height
  const videoAR = fw / Math.max(fh, 1)
  const elAR = elW / Math.max(elH, 1)
  let rendW: number, rendH: number, offX: number, offY: number
  if (videoAR > elAR) {
    rendW = elW
    rendH = elW / videoAR
    offX = 0
    offY = (elH - rendH) / 2
  } else {
    rendH = elH
    rendW = elH * videoAR
    offY = 0
    offX = (elW - rendW) / 2
  }
  const scaleX = rendW / fw
  const scaleY = rendH / fh
  return { left: offX + x1 * scaleX, top: offY + y1 * scaleY, width: (x2 - x1) * scaleX, height: (y2 - y1) * scaleY }
}

export default function LiveSurveillance() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const feedRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const uploadSocketRef = useRef<WebSocket | null>(null)
  const sendingRef = useRef(false)
  const aiBusyRef = useRef(false)
  const lastAiAtRef = useRef(0)
  const [status, setStatus] = useState<CameraStatus>('idle')
  const [error, setError] = useState('')
  const [startedAt, setStartedAt] = useState<Date | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment')
  const [aiResult, setAiResult] = useState<AiResult | null>(null)
  const [aiError, setAiError] = useState('')
  const [remoteFrame, setRemoteFrame] = useState('')
  const remoteObjectUrlRef = useRef('')
  const lastRemoteFrameAtRef = useRef(0)
  const [remoteConnected, setRemoteConnected] = useState(false)
  const [liceplates, setLiceplates] = useState<LiceplateRecord[]>([])
  const [sensitiveArea, setSensitiveArea] = useState(false)
  const [personaNotice, setPersonaNotice] = useState<PersonaMatch[] | null>(null)
  const [zones, setZones] = useState<ZoneDef[]>([])
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([])
  const [selectedDeviceId, setSelectedDeviceId] = useState('')
  const lastPersonaNoticeRef = useRef('')
  const notifiedZonesRef = useRef<Set<string>>(new Set())
  const live = status === 'live'

  const refreshVideoDevices = async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return
    const devices = (await navigator.mediaDevices.enumerateDevices()).filter(device => device.kind === 'videoinput')
    setVideoDevices(devices)
    setSelectedDeviceId(current => current || devices[0]?.deviceId || '')
  }

  useEffect(() => {
    void refreshVideoDevices()
    navigator.mediaDevices?.addEventListener('devicechange', refreshVideoDevices)
    return () => navigator.mediaDevices?.removeEventListener('devicechange', refreshVideoDevices)
  }, [])

  useEffect(() => {
    const loadZones = async () => {
      const response = await fetch(apiUrl('/api/fov-profiles'), { cache: 'no-store' })
      if (!response.ok) return
      const profiles = (await response.json()).data || []
      setZones(profiles.find((profile: { active?: boolean }) => profile.active)?.zones || [])
    }
    void loadZones()
    const timer = window.setInterval(() => void loadZones(), 5000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    const matches = aiResult?.persona_matches || []
    if (!matches.length) {
      lastPersonaNoticeRef.current = ''
      return
    }
    const noticeKey = matches.map(match => `${match.track_id}-${match.persona_id || match.display_label}`).join('|')
    if (noticeKey !== lastPersonaNoticeRef.current) {
      lastPersonaNoticeRef.current = noticeKey
      setPersonaNotice(matches)
    }
  }, [aiResult])

  // Zone entry notifications for danger zones
  useEffect(() => {
    const dangerSignals = (aiResult?.behavior_signals || []).filter(
      s => s.type === 'restricted_zone_entry' && s.zone
    )
    for (const sig of dangerSignals) {
      const key = `${sig.zone}-${sig.track_id}`
      if (notifiedZonesRef.current.has(key)) continue
      notifiedZonesRef.current.add(key)
      // Browser notification
      if (Notification.permission === 'granted') {
        new Notification(`⚠ ZONE BREACH: ${sig.zone?.toUpperCase()}`, {
          body: `Track #${sig.track_id} entered restricted zone. Risk score: ${aiResult?.risk_score ?? '--'}/100`,
          icon: '/favicon.ico',
        })
      } else if (Notification.permission === 'default') {
        Notification.requestPermission()
      }
    }
    // Clear stale keys when zone is no longer active
    const activeKeys = new Set(dangerSignals.map(s => `${s.zone}-${s.track_id}`))
    for (const key of notifiedZonesRef.current) {
      if (!activeKeys.has(key)) notifiedZonesRef.current.delete(key)
    }
  }, [aiResult])

  useEffect(() => {
    if (live) return
    const source = new WebSocket(apiUrl(`/api/cameras/${ACTIVE_CAMERA_ID}/ws`).replace(/^http/, 'ws'))
    source.binaryType = 'blob'
    source.onopen = () => setRemoteConnected(false)
    source.onmessage = (event) => {
      if (typeof event.data === 'string') {
        try {
          if ((JSON.parse(event.data) as { type?: string }).type === 'offline') {
            setRemoteFrame('')
            setRemoteConnected(false)
            setAiResult(null)
          }
        } catch {}
        return
      }
      const blob = event.data instanceof Blob ? event.data : new Blob([event.data], { type: 'image/jpeg' })
      const objectUrl = URL.createObjectURL(blob)
      if (remoteObjectUrlRef.current) URL.revokeObjectURL(remoteObjectUrlRef.current)
      remoteObjectUrlRef.current = objectUrl
      lastRemoteFrameAtRef.current = Date.now()
      setRemoteFrame(objectUrl)
      setRemoteConnected(true)
    }
    const staleTimer = window.setInterval(() => {
      if (lastRemoteFrameAtRef.current && Date.now() - lastRemoteFrameAtRef.current > 1500) {
        if (remoteObjectUrlRef.current) URL.revokeObjectURL(remoteObjectUrlRef.current)
        remoteObjectUrlRef.current = ''
        lastRemoteFrameAtRef.current = 0
        setRemoteFrame('')
        setRemoteConnected(false)
        setAiResult(null)
      }
    }, 500)
    source.onerror = () => {
      setRemoteConnected(false)
      setRemoteFrame('')
    }
    source.onclose = () => {
      setRemoteConnected(false)
      setRemoteFrame('')
    }
    return () => {
      source.close()
      window.clearInterval(staleTimer)
      lastRemoteFrameAtRef.current = 0
      setRemoteFrame('')
      setRemoteConnected(false)
      if (remoteObjectUrlRef.current) URL.revokeObjectURL(remoteObjectUrlRef.current)
      remoteObjectUrlRef.current = ''
    }
  }, [live])

  useEffect(() => {
    let active = true
    const timer = window.setInterval(async () => {
      try {
        const response = await fetch(apiUrl(`/api/cameras/${ACTIVE_CAMERA_ID}/ai`), { cache: 'no-store' })
        if (response.ok && active) setAiResult(await response.json() as AiResult)
      } catch {}
    }, 2000)
    return () => { active = false; window.clearInterval(timer) }
  }, [])

  useEffect(() => {
    let active = true
    const timer = window.setInterval(async () => {
      try {
        const response = await fetch(apiUrl('/api/liceplates'), { cache: 'no-store' })
        if (response.ok && active) setLiceplates((await response.json()).data as LiceplateRecord[])
      } catch {}
    }, 2000)
    return () => { active = false; window.clearInterval(timer) }
  }, [])

  const updateSensitiveArea = async (value: boolean) => {
    setSensitiveArea(value)
    await fetch(API_URL, { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'X-Operator-Id': 'field-operator' }, body: JSON.stringify({ sensitiveArea: value, locationName: value ? 'Selected sensitive field' : 'Mobile field' }) }).catch(() => undefined)
  }

  useEffect(() => {
    return () => streamRef.current?.getTracks().forEach((track) => track.stop())
  }, [])

  useEffect(() => {
    if (!live) return
    const socket = new WebSocket(apiUrl(`/api/cameras/${ACTIVE_CAMERA_ID}/upload`).replace(/^http/, 'ws'))
    uploadSocketRef.current = socket
    return () => {
      if (uploadSocketRef.current === socket) uploadSocketRef.current = null
      socket.close()
    }
  }, [live])

  useEffect(() => {
    if (!startedAt) return
    const timer = window.setInterval(() => setElapsed(Math.floor((Date.now() - startedAt.getTime()) / 1000)), 1000)
    return () => window.clearInterval(timer)
  }, [startedAt])

  useEffect(() => {
    if (!live) return
    let active = true
    let lastUploadAt = 0
    const timer = window.setInterval(async () => {
      if (sendingRef.current) return
      const now = Date.now()
      const video = videoRef.current
      const canvas = canvasRef.current
      if (!video || !canvas || video.readyState < 2 || video.videoWidth === 0) return

      if (now - lastUploadAt < 350) return
      lastUploadAt = now
      sendingRef.current = true

      const targetWidth = Math.min(video.videoWidth, 360)
      canvas.width = targetWidth
      canvas.height = Math.round((targetWidth / Math.max(video.videoWidth, 1)) * video.videoHeight)
      canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height)

      try {
        const uploadSocket = uploadSocketRef.current
        if (uploadSocket?.readyState === WebSocket.OPEN && uploadSocket.bufferedAmount < 120000) {
          canvas.toBlob((blob) => {
            if (blob && uploadSocket.readyState === WebSocket.OPEN && uploadSocket.bufferedAmount < 120000) {
              uploadSocket.send(blob)
            }
          }, 'image/jpeg', 0.48)
        }

        if (!aiBusyRef.current && now - lastAiAtRef.current >= 2000) {
          lastAiAtRef.current = now
          aiBusyRef.current = true
          const analysisCanvas = document.createElement('canvas')
          analysisCanvas.width = Math.min(video.videoWidth, 360)
          analysisCanvas.height = Math.round((analysisCanvas.width / Math.max(video.videoWidth, 1)) * video.videoHeight)
          analysisCanvas.getContext('2d')?.drawImage(video, 0, 0, analysisCanvas.width, analysisCanvas.height)
          const imageBase64 = analysisCanvas.toDataURL('image/jpeg', 0.55)
          void fetch(apiUrl('/api/ai/frame'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ camera_id: ACTIVE_CAMERA_ID, image_base64: imageBase64 }) })
            .then(async (response) => {
              if (!response.ok) throw new Error('AI service unavailable')
              return response.json() as Promise<AiResult>
            })
            .then((result) => { if (active) { setAiResult(result); setAiError('') } })
            .catch(() => { if (active) setAiError('AI service unavailable. Camera remains live; inference will retry.') })
            .finally(() => { aiBusyRef.current = false })
        }
      } catch {
        if (active) setAiError('Camera relay unavailable. Retrying.')
      } finally {
        sendingRef.current = false
      }
    }, 250)
    return () => { active = false; window.clearInterval(timer) }
  }, [live])

  const startCamera = async (requestedFacingMode = facingMode, requestedDeviceId = selectedDeviceId) => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('error')
      setError('Camera access is unavailable. Use HTTPS or localhost in a supported browser.')
      return
    }
    setStatus('requesting')
    setError('')
    window.dispatchEvent(new CustomEvent('ibvap:camera-status', { detail: { status: 'requesting', error: '' } }))
    streamRef.current?.getTracks().forEach((track) => track.stop())
    try {
      const videoConstraints = requestedDeviceId
        ? { deviceId: { exact: requestedDeviceId }, width: { ideal: 1920 }, height: { ideal: 1080 } }
        : { facingMode: { ideal: requestedFacingMode }, width: { ideal: 1920 }, height: { ideal: 1080 } }
      const stream = await navigator.mediaDevices.getUserMedia({ video: videoConstraints, audio: false })
      streamRef.current = stream
      ;(window as CameraWindow).__ibvapCameraStream = stream
      window.dispatchEvent(new CustomEvent<MediaStream>('ibvap:camera-stream', { detail: stream }))
      await refreshVideoDevices()
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setStartedAt(new Date())
      setElapsed(0)
      setStatus('live')
      window.dispatchEvent(new CustomEvent('ibvap:camera-status', { detail: { status: 'live', error: '' } }))
      await fetch(API_URL, { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'X-Operator-Id': 'webcam-operator' }, body: JSON.stringify({ status: 'online', protocol: 'browser-camera', source: 'webcam', lastSeen: new Date().toISOString() }) }).catch(() => undefined)
    } catch (cameraError) {
      if (requestedDeviceId) {
        setSelectedDeviceId('')
        void startCamera(requestedFacingMode, '')
        return
      }
      const denied = cameraError instanceof DOMException && (cameraError.name === 'NotAllowedError' || cameraError.name === 'SecurityError')
      setStatus(denied ? 'denied' : 'error')
      const message = denied ? 'Camera permission was denied. Allow camera access in the browser and try again.' : 'The webcam could not be started.'
      setError(message)
      window.dispatchEvent(new CustomEvent('ibvap:camera-status', { detail: { status: denied ? 'denied' : 'error', error: message } }))
    }
  }

  useEffect(() => {
    const handleSharedStart = () => {
        if (live && streamRef.current) {
          window.dispatchEvent(new CustomEvent<MediaStream>('ibvap:camera-stream', { detail: streamRef.current }))
          return
        }
        if (!live && status !== 'requesting') void startCamera()
    }
    window.addEventListener('ibvap:start-camera', handleSharedStart)
    return () => window.removeEventListener('ibvap:start-camera', handleSharedStart)
  }, [live, status, selectedDeviceId, facingMode])

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    delete (window as CameraWindow).__ibvapCameraStream
    window.dispatchEvent(new CustomEvent<MediaStream | null>('ibvap:camera-stream', { detail: null }))
    window.dispatchEvent(new CustomEvent('ibvap:camera-status', { detail: { status: 'idle', error: '' } }))
    if (videoRef.current) videoRef.current.srcObject = null
    setStartedAt(null)
    setElapsed(0)
    setStatus('idle')
    setAiResult(null)
    setAiError('')
    void fetch(API_URL, { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'X-Operator-Id': 'phone-operator' }, body: JSON.stringify({ status: 'offline', lastSeen: new Date().toISOString() }) }).catch(() => undefined)
  }

  const switchCamera = () => {
    const nextFacingMode = facingMode === 'environment' ? 'user' : 'environment'
    setFacingMode(nextFacingMode)
    if (status === 'live') void startCamera(nextFacingMode)
  }

  const formatElapsed = `${String(Math.floor(elapsed / 60)).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}`
  return (
    <div className="p-5 min-h-full space-y-5 fade-in">
      {personaNotice && <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-5" role="dialog" aria-modal="true" aria-label="Synthetic demo profile notification"><div className="glass w-full max-w-lg border border-amber-300/50 bg-[#0b1015] p-5 shadow-2xl" style={{ borderRadius: 10 }}><div className="flex items-start justify-between gap-4"><div><div className="font-mono text-[10px] tracking-widest text-amber-300">DEMO / SYNTHETIC PROFILES DETECTED</div><div className="mt-2 font-rajdhani text-2xl font-700 text-amber-100">{personaNotice.length} consenting demo match{personaNotice.length === 1 ? '' : 'es'}</div></div><button title="Close notification" aria-label="Close notification" className="border-0 bg-transparent p-1 text-slate-400 hover:text-white" onClick={() => setPersonaNotice(null)}><X size={18} /></button></div><div className="mt-4 max-h-72 space-y-2 overflow-auto">{personaNotice.map(match => <div key={`${match.track_id}-${match.persona_id}`} className="border border-amber-300/20 p-3 font-mono text-[10px]"><div className="flex justify-between text-amber-200"><span>{match.display_label}</span><span>TRACK #{match.track_id ?? '--'} · {Math.round(match.similarity * 100)}%</span></div><div className="mt-1 text-amber-100/70">REFERENCE ANGLE: {match.reference_angle || '--'}</div><div className="mt-1 text-slate-400">{match.fictional_case_note}</div></div>)}</div><p className="mt-4 font-mono text-[10px] leading-relaxed text-slate-400">Synthetic consenting demo profiles only. This is not a real identification or criminal record. Review the risk, behavior, and anomaly signals separately.</p><button className="btn-primary mt-4 w-full" onClick={() => setPersonaNotice(null)}>ACKNOWLEDGE DEMO NOTIFICATION</button></div></div>}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="font-rajdhani font-700 tracking-widest" style={{ fontSize: 22, color: '#e2e8f0', letterSpacing: '0.12em' }}>FIELD CAMERA</div>
          <div className="font-mono mt-1" style={{ color: '#64748b', fontSize: 10, letterSpacing: '0.08em' }}>PHONE SOURCE · REAL-TIME CAPTURE · AI PROCESSING READY</div>
        </div>
        <div className="flex items-center gap-2 glass px-3 py-2">
          <span className={live ? 'status-dot-online blink' : 'status-dot-warning'} style={{ width: 7, height: 7, borderRadius: '50%' }} />
          <span className="font-mono" style={{ color: live ? '#22c55e' : '#f59e0b', fontSize: 10 }}>{live ? `CAPTURING ${formatElapsed}` : 'CAMERA OFFLINE'}</span>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <section className="glass overflow-hidden" style={{ borderRadius: 10 }}>
          <div ref={feedRef} className="camera-feed relative aspect-video" style={{ background: '#020507' }}>
            <video ref={videoRef} muted playsInline className={`absolute inset-0 h-full w-full object-contain ${live ? 'opacity-100' : 'opacity-0'}`} />
            {!live && remoteFrame && <img src={remoteFrame} alt="Phone camera view" onLoad={() => setRemoteConnected(true)} onError={() => setRemoteConnected(false)} className="absolute inset-0 h-full w-full object-contain" />}
            <canvas ref={canvasRef} className="hidden" />
            {feedRef.current && (() => {
              const fw = aiResult?.frame_size?.width || 640
              const fh = aiResult?.frame_size?.height || 360
              const activeZones = new Set((aiResult?.behavior_signals || []).map(s => s.zone).filter(Boolean) as string[])
              return <ZoneOverlay feed={feedRef.current!} fw={fw} fh={fh} zones={zones} activeZones={activeZones} />
            })()}
            {aiResult?.detections.map((detection, index) => {
              const feed = feedRef.current
              const video = videoRef.current
              const fw = aiResult.frame_size?.width || 640
              const fh = aiResult.frame_size?.height || 360
              const displayed = feed ? getDisplayedBox(video!, feed, detection.box, fw, fh) : { left: `${detection.box[0] / fw * 100}%`, top: `${detection.box[1] / fh * 100}%`, width: `${(detection.box[2] - detection.box[0]) / fw * 100}%`, height: `${(detection.box[3] - detection.box[1]) / fh * 100}%` }
              return <div key={`${detection.track_id}-${index}`} className="absolute border border-cyan-300" style={{ left: displayed.left, top: displayed.top, width: displayed.width, height: displayed.height }}><span className="absolute -top-5 left-0 whitespace-nowrap bg-cyan-400/80 px-1 font-mono text-[9px] text-black">{detection.label === 'license_plate' ? detection.plate_text || 'PLATE' : detection.label} {detection.track_id ? `#${detection.track_id}` : ''} · {Math.round(detection.confidence * 100)}%</span>{detection.persona_match && <span className="absolute left-0 top-full mt-1 whitespace-nowrap border border-amber-300/60 bg-black/85 px-1 font-mono text-[9px] text-amber-200">{detection.persona_match.display_label} · {Math.round(detection.persona_match.similarity * 100)}%</span>}</div>
            })}
            {!live && !remoteConnected && !aiResult && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
                <div style={{ width: 64, height: 64, borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.35)' }}><Camera size={28} color="#00d4ff" /></div>
                <div className="font-rajdhani font-700 tracking-widest" style={{ color: '#e2e8f0', fontSize: 18 }}>CONNECT PHONE CAMERA</div>
                <div className="font-mono" style={{ color: '#64748b', maxWidth: 440, fontSize: 11 }}>Start the camera to grant browser permission and begin a real local video stream. No simulated footage or detections are shown.</div>
                {error && <div className="font-mono" style={{ color: '#ef4444', maxWidth: 440, fontSize: 11 }}>{error}</div>}
              </div>
            )}
            {live && <div className="absolute left-4 top-4 flex items-center gap-2 bg-black/60 px-3 py-2"><span className="status-dot-offline blink" style={{ width: 6, height: 6, borderRadius: '50%' }} /><span className="font-mono" style={{ color: '#ef4444', fontSize: 10 }}>LIVE · PHONE CAMERA</span></div>}
            {live && <button title="Fullscreen camera" onClick={() => void videoRef.current?.requestFullscreen()} className="absolute right-4 top-4 border-0 bg-black/60 p-2 text-slate-400 hover:text-cyan-300"><Maximize2 size={15} /></button>}
          </div>
          <div className="flex flex-wrap items-center gap-3 border-t border-white/10 p-4">
            {!live ? <button className="btn-primary flex items-center gap-2" onClick={() => void startCamera()} disabled={status === 'requesting'}><Video size={14} /> {status === 'requesting' ? 'REQUESTING ACCESS...' : 'START CAMERA'}</button> : <button className="btn-danger flex items-center gap-2" onClick={stopCamera}><CircleStop size={14} /> STOP CAMERA</button>}
            {videoDevices.length > 0 && <select aria-label="Camera device" value={selectedDeviceId} onChange={(event) => { const deviceId = event.target.value; setSelectedDeviceId(deviceId); if (live) void startCamera(facingMode, deviceId) }} className="max-w-xs bg-black/30 p-2 font-mono text-[10px] text-slate-200"><option value="">DEFAULT CAMERA</option>{videoDevices.map((device, index) => <option key={device.deviceId || index} value={device.deviceId}>{device.label || `CAMERA ${index + 1}`}</option>)}</select>}
            <button className="btn-ghost flex items-center gap-2" onClick={switchCamera}><RefreshCw size={14} /> SWITCH LENS</button>
            <span className="font-mono ml-auto" style={{ color: '#475569', fontSize: 10 }}>{facingMode === 'environment' ? 'REAR LENS' : 'FRONT LENS'} · AUDIO DISABLED</span>
          </div>
        </section>

        <aside className="space-y-4">
          <div className="glass p-4" style={{ borderRadius: 10 }}>
            <div className="section-header">PROCESSING STATUS</div>
            <div className="flex items-center gap-3"><ShieldAlert size={18} color={aiResult ? '#22c55e' : '#f59e0b'} /><div><div className="font-rajdhani font-700" style={{ color: aiResult ? '#22c55e' : '#f59e0b' }}>{aiResult ? `AI ACTIVE · ${aiResult.severity}` : 'AI ENGINE CONNECTING'}</div><div className="font-mono mt-1" style={{ color: '#64748b', fontSize: 10 }}>{aiError || (aiResult ? `Anomaly ${(aiResult.anomaly_score * 100).toFixed(1)}% · Risk ${aiResult.risk_score}/100 · ${aiResult.metrics?.inference_fps || 0} FPS` : 'Start the camera to begin inference.')}</div></div></div>
            {aiResult && <div className="mt-3 border border-white/10 p-2"><div className="font-mono text-[9px] text-slate-500">SUSPICIOUS OBJECTS</div><div className="font-rajdhani text-xl" style={{ color: aiResult.detections.some((detection) => detection.label === 'knife') ? '#ef4444' : '#22c55e' }}>{aiResult.detections.filter((detection) => detection.label === 'knife').length}</div><div className="mt-2 font-mono text-[9px] text-slate-500">PERSONA CHECK</div><div className="font-mono text-[9px] text-slate-400">{aiResult.persona_diagnostics?.matches ? 'PROFILE MATCH CONFIRMED' : aiResult.persona_diagnostics?.person_candidates ? aiResult.persona_diagnostics.face_embeddings ? 'FACE FOUND · BELOW MATCH THRESHOLD' : 'PERSON FOUND · FACE NOT USABLE' : 'NO TRACKED PERSON'}</div></div>}
            {aiResult?.persona_matches && aiResult.persona_matches.length > 0 && <div className="mt-3 border border-red-300/40 bg-red-300/10 p-2"><div className="font-mono text-[9px] text-red-300">SYNTHETIC PROFILE MATCHED · REVIEW REQUIRED</div>{aiResult.persona_matches.map((match, index) => { const trackRisk = aiResult.risk_by_track?.find((track: { track_id: number }) => track.track_id === match.track_id); const behaviors = (aiResult.behavior_signals || []).filter(signal => signal.track_id === match.track_id).map(signal => signal.type.replace(/_/g, ' ')); return <div className="mt-2 border-t border-red-300/10 pt-2" key={`${match.track_id}-${index}`}><div className="font-mono text-[10px] text-red-200">{match.display_label} · TRACK #{match.track_id ?? '--'}</div><div className="mt-1 font-mono text-[9px] text-amber-100/70">REFERENCE {match.reference_angle || '--'} · MATCH {Math.round(match.similarity * 100)}% · RISK {trackRisk?.risk_score ?? aiResult.risk_score}/100</div><div className="mt-1 font-mono text-[9px] text-slate-400">{behaviors.length ? `Signals: ${behaviors.join(', ')}` : 'Profile matched; no violent behavior signal detected.'}</div><div className="mt-1 font-mono text-[9px] text-slate-400">{match.fictional_case_note || match.disclaimer || 'Synthetic demo match only. Not a real identification or criminal record.'}</div></div>})}</div>}
            {aiResult && <div className="mt-4 grid grid-cols-2 gap-2"><div className="border border-white/10 p-2"><div className="font-mono text-[9px] text-slate-500">ANOMALY</div><div className="font-rajdhani text-2xl text-amber-300">{(aiResult.anomaly_score * 100).toFixed(0)}%</div></div><div className="border border-white/10 p-2"><div className="font-mono text-[9px] text-slate-500">RISK SCORE</div><div className="font-rajdhani text-2xl text-red-300">{aiResult.risk_score}</div></div><div className="col-span-2 border border-white/10 p-2"><div className="font-mono text-[9px] text-slate-500">PLATE MODEL</div><div className="font-mono text-[10px]" style={{ color: aiResult.models?.plate === 'loaded' ? '#22c55e' : '#f59e0b' }}>{aiResult.models?.plate === 'not_configured' ? 'NOT CONFIGURED · YOLOv8 COCO HAS NO PLATE CLASS' : aiResult.models?.plate || 'NOT REPORTED'}</div></div></div>}
            <div className="mt-4 border border-white/10 p-2"><div className="font-mono text-[9px] text-slate-500">SENSITIVE AREA FIELD</div><select value={sensitiveArea ? 'sensitive' : 'normal'} onChange={(event) => void updateSensitiveArea(event.target.value === 'sensitive')} className="mt-2 w-full bg-black/30 p-2 font-mono text-[10px] text-slate-200"><option value="normal">NORMAL FIELD</option><option value="sensitive">SENSITIVE AREA</option></select></div>
            {aiResult && (() => {
              const signals: { label: string; value: number; color: string }[] = [
                { label: 'FRAME MOTION', value: aiResult.anomaly_score, color: '#f59e0b' },
                { label: 'RISK', value: aiResult.risk_score / 100, color: aiResult.risk_score >= 85 ? '#ef4444' : aiResult.risk_score >= 65 ? '#f97316' : aiResult.risk_score >= 35 ? '#f59e0b' : '#22c55e' },
                ...(Object.entries((aiResult as any).signals || {}).map(([k, v]) => ({ label: k === 'motion' ? 'CROWD DENSITY' : k === 'anomaly' ? 'ANOMALY WEIGHT' : k.toUpperCase().replace(/_/g, ' '), value: Number(v), color: '#38bdf8' }))),
                ...((aiResult.behavior_signals || []).map(s => ({ label: s.type.replace(/_/g, ' ').toUpperCase(), value: s.severity, color: '#f43f5e' }))),
              ]
              return <div className="mt-3 space-y-1">
                <div className="font-mono text-[9px] text-slate-500 mb-2">LIVE SIGNALS</div>
                {signals.map((s, i) => <div key={i}>
                  <div className="flex justify-between font-mono text-[9px]"><span style={{ color: '#94a3b8' }}>{s.label}</span><span style={{ color: s.color }}>{(s.value * 100).toFixed(0)}%</span></div>
                  <div className="mt-0.5 h-1 w-full rounded-full bg-white/10"><div className="h-1 rounded-full transition-all duration-300" style={{ width: `${Math.min(s.value * 100, 100)}%`, background: s.color }} /></div>
                </div>)}
              </div>
            })()}
          </div>
          <div className="glass p-4"><div className="section-header">RECENT LICEPLATES</div><div className="space-y-2">{liceplates.slice(0, 6).map((record) => <div key={record.id} className="border-b border-white/5 pb-2"><div className="flex items-center justify-between"><span className="font-mono text-[11px] text-amber-300">{record.plate || 'PLATE DETECTED'}</span><span className="font-mono text-[9px]" style={{ color: record.sensitive ? '#ef4444' : '#22c55e' }}>{record.sensitive ? 'SENSITIVE' : 'NORMAL'}</span></div><div className="font-mono text-[9px] text-slate-500">{new Date(record.recordedAt).toLocaleString()} · {record.location} · {Math.round(record.confidence * 100)}%</div></div>)}{liceplates.length === 0 && <div className="font-mono text-[10px] text-slate-500">No license plates recorded yet. Open License Plates for the full register.</div>}</div></div>
          <div className="glass p-4" style={{ borderRadius: 10 }}>
            <div className="section-header">CAPTURE SESSION</div>
            {[['SOURCE', live ? 'PHONE CAMERA' : 'NOT CONNECTED'], ['STREAM', live ? 'LOCAL BROWSER STREAM' : 'STOPPED'], ['STARTED', startedAt ? startedAt.toLocaleTimeString('en-IN', { hour12: false }) : '--'], ['AUDIO', 'DISABLED']].map(([label, value]) => <div className="flex justify-between border-b border-white/5 py-2 last:border-0" key={label}><span className="font-mono" style={{ color: '#64748b', fontSize: 10 }}>{label}</span><span className="font-mono" style={{ color: '#cbd5e1', fontSize: 10 }}>{value}</span></div>)}
          </div>
        </aside>
      </div>
    </div>
  )
}
