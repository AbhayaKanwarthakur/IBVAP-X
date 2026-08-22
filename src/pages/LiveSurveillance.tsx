import { useEffect, useRef, useState } from 'react'
import { Camera, CircleStop, Maximize2, RefreshCw, ShieldAlert, Video, X } from 'lucide-react'

const API_ORIGIN = ['8443', '8444'].includes(window.location.port) ? `${window.location.protocol}//${window.location.hostname}:8787` : ''
const apiUrl = (path: string) => `${API_ORIGIN}${path}`
const API_URL = apiUrl('/api/cameras/CAM-PHONE')

type CameraStatus = 'idle' | 'requesting' | 'live' | 'denied' | 'error'
type PersonaMatch = { track_id?: number; display_label: string; similarity: number; fictional_case_note: string; synthetic: true; disclaimer?: string }
type AiResult = { detections: Array<{ track_id: number | null; label: string; confidence: number; box: number[]; plate_text?: string | null; persona_match?: PersonaMatch }>; anomaly_score: number; risk_score: number; severity: string; behavior_signals?: Array<{ type: string; track_id: number; zone?: string | null; detail: string; severity: number }>; persona_matches?: PersonaMatch[]; metrics?: { inference_fps: number; total_latency_ms: number }; models?: { yolo: string; plate: string; ocr?: string }; frame_size?: { width: number; height: number } }
type LiceplateRecord = { id: string; name: 'liceplate'; plate: string | null; confidence: number; cameraId: string; location: string; sensitive: boolean; recordedAt: string; rto?: Record<string, unknown> | null }

function getDisplayedBox(video: HTMLVideoElement, feed: HTMLDivElement, box: number[]) {
  const [x1, y1, x2, y2] = box
  const feedRect = feed.getBoundingClientRect()
  const videoRect = video.getBoundingClientRect()
  const scaleX = videoRect.width / Math.max(video.videoWidth, 1)
  const scaleY = videoRect.height / Math.max(video.videoHeight, 1)
  return { left: videoRect.left - feedRect.left + x1 * scaleX, top: videoRect.top - feedRect.top + y1 * scaleY, width: (x2 - x1) * scaleX, height: (y2 - y1) * scaleY }
}

export default function LiveSurveillance() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const feedRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
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
  const [remoteFrame, setRemoteFrame] = useState(apiUrl('/api/cameras/CAM-PHONE/stream'))
  const [remoteConnected, setRemoteConnected] = useState(false)
  const [liceplates, setLiceplates] = useState<LiceplateRecord[]>([])
  const [sensitiveArea, setSensitiveArea] = useState(false)
  const [personaNotice, setPersonaNotice] = useState<PersonaMatch | null>(null)
  const lastPersonaNoticeRef = useRef('')
  const live = status === 'live'

  useEffect(() => {
    const match = aiResult?.persona_matches?.[0]
    if (!match) return
    const noticeKey = `${match.track_id}-${match.persona_id || match.display_label}`
    if (noticeKey !== lastPersonaNoticeRef.current) {
      lastPersonaNoticeRef.current = noticeKey
      setPersonaNotice(match)
    }
  }, [aiResult])

  useEffect(() => {
    let active = true
    const timer = window.setInterval(async () => {
      try {
        const response = await fetch(apiUrl('/api/cameras/CAM-PHONE/ai'), { cache: 'no-store' })
        if (response.ok && active) setAiResult(await response.json() as AiResult)
      } catch {}
    }, 700)
    return () => { active = false; window.clearInterval(timer) }
  }, [])

  useEffect(() => {
    let active = true
    const timer = window.setInterval(async () => {
      try {
        const response = await fetch(apiUrl('/api/liceplates'), { cache: 'no-store' })
        if (response.ok && active) setLiceplates((await response.json()).data as LiceplateRecord[])
      } catch {}
    }, 1000)
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
    if (!startedAt) return
    const timer = window.setInterval(() => setElapsed(Math.floor((Date.now() - startedAt.getTime()) / 1000)), 1000)
    return () => window.clearInterval(timer)
  }, [startedAt])

  useEffect(() => {
    if (!live) return
    let active = true
    const timer = window.setInterval(async () => {
      if (sendingRef.current) return
      const video = videoRef.current
      const canvas = canvasRef.current
      if (!video || !canvas || video.readyState < 2 || video.videoWidth === 0) return
      sendingRef.current = true
      canvas.width = Math.min(video.videoWidth, 640)
      canvas.height = Math.round(canvas.width * video.videoHeight / video.videoWidth)
      canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height)
      const imageBase64 = canvas.toDataURL('image/jpeg', 0.68)
      try {
        await fetch(apiUrl('/api/cameras/CAM-PHONE/frame'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image_base64: imageBase64 }) })
        if (!aiBusyRef.current && Date.now() - lastAiAtRef.current >= 1000) {
          lastAiAtRef.current = Date.now()
          aiBusyRef.current = true
          void fetch(apiUrl('/api/ai/frame'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ camera_id: 'CAM-PHONE', image_base64: imageBase64 }) })
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
    }, 120)
    return () => { active = false; window.clearInterval(timer) }
  }, [live])

  const startCamera = async (requestedFacingMode = facingMode) => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('error')
      setError('Camera access is unavailable. Use HTTPS or localhost in a supported browser.')
      return
    }
    setStatus('requesting')
    setError('')
    streamRef.current?.getTracks().forEach((track) => track.stop())
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: requestedFacingMode, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setStartedAt(new Date())
      setElapsed(0)
      setStatus('live')
      await fetch(API_URL, { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'X-Operator-Id': 'phone-operator' }, body: JSON.stringify({ status: 'online', protocol: 'browser-camera', source: 'phone', lastSeen: new Date().toISOString() }) }).catch(() => undefined)
    } catch (cameraError) {
      const denied = cameraError instanceof DOMException && (cameraError.name === 'NotAllowedError' || cameraError.name === 'SecurityError')
      setStatus(denied ? 'denied' : 'error')
      setError(denied ? 'Camera permission was denied. Allow camera access in the browser and try again.' : 'The phone camera could not be started.')
    }
  }

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
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
      {personaNotice && <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-5" role="dialog" aria-modal="true" aria-label="Synthetic demo profile notification"><div className="glass w-full max-w-md border border-amber-300/50 bg-[#0b1015] p-5 shadow-2xl" style={{ borderRadius: 10 }}><div className="flex items-start justify-between gap-4"><div><div className="font-mono text-[10px] tracking-widest text-amber-300">DEMO / SYNTHETIC PROFILE DISCOVERED</div><div className="mt-2 font-rajdhani text-2xl font-700 text-amber-100">{personaNotice.display_label}</div></div><button title="Close notification" aria-label="Close notification" className="border-0 bg-transparent p-1 text-slate-400 hover:text-white" onClick={() => setPersonaNotice(null)}><X size={18} /></button></div><div className="mt-4 grid grid-cols-2 gap-2 font-mono text-[10px]"><div className="border border-white/10 p-2"><div className="text-slate-500">CAMERA</div><div className="mt-1 text-slate-200">CAM-PHONE</div></div><div className="border border-white/10 p-2"><div className="text-slate-500">TRACK</div><div className="mt-1 text-slate-200">#{personaNotice.track_id ?? '--'}</div></div><div className="col-span-2 border border-white/10 p-2"><div className="text-slate-500">MATCH SIMILARITY</div><div className="mt-1 text-amber-200">{Math.round(personaNotice.similarity * 100)}%</div></div></div><p className="mt-4 font-mono text-[10px] leading-relaxed text-slate-400">{personaNotice.disclaimer || 'Synthetic demo match only. Not a real identification or criminal record.'}</p><p className="mt-2 font-mono text-[10px] leading-relaxed text-slate-500">{personaNotice.fictional_case_note}</p><button className="btn-primary mt-4 w-full" onClick={() => setPersonaNotice(null)}>ACKNOWLEDGE DEMO NOTIFICATION</button></div></div>}
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
            {!live && <img src={remoteFrame} alt="Phone camera view" onLoad={() => setRemoteConnected(true)} onError={() => setRemoteConnected(false)} className="absolute inset-0 h-full w-full object-fill" />}
            <canvas ref={canvasRef} className="hidden" />
            {aiResult?.detections.map((detection, index) => {
              const [x1, y1, x2, y2] = detection.box
              const feed = feedRef.current
              const video = videoRef.current
              const displayed = live && video && feed ? getDisplayedBox(video, feed, detection.box) : { left: detection.box[0] / (aiResult.frame_size?.width || 640) * 100 + '%', top: detection.box[1] / (aiResult.frame_size?.height || 360) * 100 + '%', width: (detection.box[2] - detection.box[0]) / (aiResult.frame_size?.width || 640) * 100 + '%', height: (detection.box[3] - detection.box[1]) / (aiResult.frame_size?.height || 360) * 100 + '%' }
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
            <button className="btn-ghost flex items-center gap-2" onClick={switchCamera}><RefreshCw size={14} /> SWITCH LENS</button>
            <span className="font-mono ml-auto" style={{ color: '#475569', fontSize: 10 }}>{facingMode === 'environment' ? 'REAR LENS' : 'FRONT LENS'} · AUDIO DISABLED</span>
          </div>
        </section>

        <aside className="space-y-4">
          <div className="glass p-4" style={{ borderRadius: 10 }}>
            <div className="section-header">PROCESSING STATUS</div>
            <div className="flex items-center gap-3"><ShieldAlert size={18} color={aiResult ? '#22c55e' : '#f59e0b'} /><div><div className="font-rajdhani font-700" style={{ color: aiResult ? '#22c55e' : '#f59e0b' }}>{aiResult ? `AI ACTIVE · ${aiResult.severity}` : 'AI ENGINE CONNECTING'}</div><div className="font-mono mt-1" style={{ color: '#64748b', fontSize: 10 }}>{aiError || (aiResult ? `Anomaly ${(aiResult.anomaly_score * 100).toFixed(1)}% · Risk ${aiResult.risk_score}/100 · ${aiResult.metrics?.inference_fps || 0} FPS` : 'Start the camera to begin inference.')}</div></div></div>
            {aiResult && <div className="mt-3 border border-white/10 p-2"><div className="font-mono text-[9px] text-slate-500">SUSPICIOUS OBJECTS</div><div className="font-rajdhani text-xl" style={{ color: aiResult.detections.some((detection) => detection.label === 'knife') ? '#ef4444' : '#22c55e' }}>{aiResult.detections.filter((detection) => detection.label === 'knife').length}</div></div>}
            {aiResult?.persona_matches && aiResult.persona_matches.length > 0 && <div className="mt-3 border border-amber-300/30 bg-amber-300/5 p-2"><div className="font-mono text-[9px] text-amber-300">DEMO / SYNTHETIC PERSONA MATCH</div>{aiResult.persona_matches.map((match, index) => <div className="mt-2 border-t border-amber-300/10 pt-2" key={`${match.track_id}-${index}`}><div className="font-mono text-[10px] text-amber-200">{match.display_label} · {Math.round(match.similarity * 100)}%</div><div className="mt-1 font-mono text-[9px] text-slate-400">{match.disclaimer || 'Synthetic demo match only. Not a real identification or criminal record.'}</div></div>)}</div>}
            {aiResult && <div className="mt-4 grid grid-cols-2 gap-2"><div className="border border-white/10 p-2"><div className="font-mono text-[9px] text-slate-500">ANOMALY</div><div className="font-rajdhani text-2xl text-amber-300">{(aiResult.anomaly_score * 100).toFixed(0)}%</div></div><div className="border border-white/10 p-2"><div className="font-mono text-[9px] text-slate-500">RISK SCORE</div><div className="font-rajdhani text-2xl text-red-300">{aiResult.risk_score}</div></div><div className="col-span-2 border border-white/10 p-2"><div className="font-mono text-[9px] text-slate-500">PLATE MODEL</div><div className="font-mono text-[10px]" style={{ color: aiResult.models?.plate === 'loaded' ? '#22c55e' : '#f59e0b' }}>{aiResult.models?.plate === 'not_configured' ? 'NOT CONFIGURED · YOLOv8 COCO HAS NO PLATE CLASS' : aiResult.models?.plate || 'NOT REPORTED'}</div></div></div>}
            <div className="mt-4 border border-white/10 p-2"><div className="font-mono text-[9px] text-slate-500">SENSITIVE AREA FIELD</div><select value={sensitiveArea ? 'sensitive' : 'normal'} onChange={(event) => void updateSensitiveArea(event.target.value === 'sensitive')} className="mt-2 w-full bg-black/30 p-2 font-mono text-[10px] text-slate-200"><option value="normal">NORMAL FIELD</option><option value="sensitive">SENSITIVE AREA</option></select></div>
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
