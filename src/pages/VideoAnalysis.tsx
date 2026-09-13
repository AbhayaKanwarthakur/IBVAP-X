import { useState, useRef, useEffect } from 'react';
import { Upload, Play, Camera, CheckCircle, AlertTriangle } from 'lucide-react';
import { apiUrl } from '../api/client';
import { useRealtimeSnapshot } from '../api/realtime';

export default function VideoAnalysis() {
  const [source, setSource] = useState<'live' | 'upload'>('live');
  const realtime = useRealtimeSnapshot();
  const liveCameras = realtime.cameras.map(camera => camera.id === 'CAM-PHONE'
    ? { ...camera, id: 'WEBCAM', sector: 'LOCAL WEBCAM', source: 'webcam' }
    : camera
  );
  const [selectedCamId, setSelectedCamId] = useState('WEBCAM');
  const [file, setFile] = useState<File | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [analysisUploadId, setAnalysisUploadId] = useState<string | null>(null);
  const [analysisStatus, setAnalysisStatus] = useState('idle');
  const [analysis, setAnalysis] = useState<any>(null);
  const [liveResult, setLiveResult] = useState<any>(null);
  const [liveFrame, setLiveFrame] = useState('');
  const [sharedStream, setSharedStream] = useState<MediaStream | null>(() => (window as Window & { __ibvapCameraStream?: MediaStream }).__ibvapCameraStream || null);
  const [sharedCameraError, setSharedCameraError] = useState('');
  const sharedVideoRef = useRef<HTMLVideoElement>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState('');
  const [activeZones, setActiveZones] = useState<any[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const selectedCam = liveCameras.find(camera => camera.id === selectedCamId) || liveCameras[0];

  useEffect(() => {
    const handleSharedStream = (event: Event) => {
      setSharedStream((event as CustomEvent<MediaStream | null>).detail ?? null);
    };
    window.addEventListener('ibvap:camera-stream', handleSharedStream);
    return () => window.removeEventListener('ibvap:camera-stream', handleSharedStream);
  }, []);

  useEffect(() => {
    const handleCameraStatus = (event: Event) => {
      const detail = (event as CustomEvent<{ status?: string; error?: string }>).detail || {}
      setSharedCameraError(detail.error || '')
    }
    window.addEventListener('ibvap:camera-status', handleCameraStatus)
    return () => window.removeEventListener('ibvap:camera-status', handleCameraStatus)
  }, [])

  useEffect(() => {
    const video = sharedVideoRef.current;
    if (!video) return;
    video.srcObject = sharedStream;
    if (sharedStream) void video.play().catch(() => undefined);
    return () => {
      if (video.srcObject === sharedStream) video.srcObject = null;
    };
  }, [sharedStream]);

  const [overlayToggles, setOverlayToggles] = useState({
    boxes: true, ids: true, trajectories: true, confidence: true, zones: true, risk: true,
  });

  useEffect(() => {
    if (!selectedCamId && liveCameras[0]) setSelectedCamId(liveCameras[0].id)
  }, [liveCameras, selectedCamId])

  useEffect(() => {
    if (!file) {
      setVideoPreviewUrl('')
      return
    }
    const url = URL.createObjectURL(file)
    setVideoPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  useEffect(() => {
    if (source !== 'live' || !selectedCam) return
    if (sharedStream) return

    const setFrameFromBlob = (blob: Blob) => {
      if (!blob.size) return
      const url = URL.createObjectURL(blob)
      setLiveFrame(previous => {
        if (previous) URL.revokeObjectURL(previous)
        return url
      })
    }

    let active = true
    const socket = new WebSocket(apiUrl(`/api/cameras/${selectedCam.id}/ws`).replace(/^http/, 'ws'))
    socket.binaryType = 'blob'
    socket.onmessage = (event) => {
      if (!active || typeof event.data === 'string') return
      setFrameFromBlob(event.data instanceof Blob ? event.data : new Blob([event.data], { type: 'image/jpeg' }))
    }
    socket.onerror = () => active && setLiveFrame('')
    socket.onclose = () => active && setLiveFrame('')



    return () => {
      active = false
      socket.close()
      setLiveFrame(previous => {
        if (previous) URL.revokeObjectURL(previous)
        return ''
      })
    }
  }, [selectedCam?.id, source, sharedStream])

  useEffect(() => {
    if (source !== 'live' || !selectedCam) return
    let active = true
    const load = async () => {
      const response = await fetch(apiUrl(`/api/cameras/${selectedCam.id}/ai`), { cache: 'no-store' })
      if (response.ok && active) setLiveResult(await response.json())
    }
    void load()
    const timer = window.setInterval(() => void load(), 4000)
    return () => { active = false; window.clearInterval(timer) }
  }, [selectedCam?.id, source])

  useEffect(() => {
    const loadZones = async () => {
      const response = await fetch(apiUrl('/api/fov-profiles'), { cache: 'no-store' })
      if (!response.ok) return
      const profiles = (await response.json()).data || []
      setActiveZones(profiles.find((profile: any) => profile.active)?.zones || [])
    }
    void loadZones()
    const timer = window.setInterval(() => void loadZones(), 10000)
    return () => window.clearInterval(timer)
  }, [])

  const startAnalysis = async () => {
    if (source === 'live') {
      setAnalysisStatus(liveResult ? 'completed' : 'waiting')
      return
    }
    if (!file) return
    setCurrentFrame(0); setProgress(0); setAnalyzing(true); setPaused(false); setAnalysis(null); setAnalysisStatus('uploading')
    const uploadResponse = await fetch(apiUrl('/api/uploads'), { method: 'POST', headers: { 'Content-Type': file.type || 'application/octet-stream', 'X-Filename': file.name }, body: file })
    if (!uploadResponse.ok) { setAnalyzing(false); setAnalysisStatus('failed'); return }
    const upload = (await uploadResponse.json()).data
    const analysisResponse = await fetch(apiUrl(`/api/uploads/${upload.id}/analyze`), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ every: 1 }) })
    if (!analysisResponse.ok) { setAnalyzing(false); setAnalysisStatus('failed'); return }
    setAnalysisUploadId(upload.id)
    setAnalysisStatus('analyzing')
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f && f.type.startsWith('video/')) setFile(f);
  };

  const currentResult = source === 'live' ? liveResult : analysis?.lastResult;
  const trackSummaries = source === 'upload' ? analysis?.trackSummaries || {} : Object.fromEntries((liveResult?.risk_by_track || []).map((track: any) => [String(track.track_id), track]));
  const analysisEvents = source === 'upload' ? analysis?.events || [] : (liveResult?.behavior_signals || []);
  const frameWidth = currentResult?.frame_size?.width || 1;
  const frameHeight = currentResult?.frame_size?.height || 1;
  const detections = (currentResult?.detections || []).map((d: any) => {
    const [x1, y1, x2, y2] = d.box || [0, 0, 0, 0];
    const risk = Number(trackSummaries[String(d.track_id)]?.risk_score ?? currentResult?.risk_score ?? 0);
    return {
      type: String(d.label || 'object').toUpperCase(),
      id: d.track_id == null ? '—' : String(d.track_id),
      conf: Math.round(Number(d.confidence || 0) * 100),
      x: (x1 / frameWidth) * 100, y: (y1 / frameHeight) * 100,
      w: ((x2 - x1) / frameWidth) * 100, h: ((y2 - y1) / frameHeight) * 100,
      threat: risk >= 85 ? 'CRITICAL' : risk >= 65 ? 'HIGH' : risk >= 35 ? 'MEDIUM' : 'LOW',
      risk,
      persona: d.persona_match?.synthetic ? d.persona_match : null,
    };
  });

  return (
    <div className="p-5 space-y-5 fade-in">
      <div className="flex items-end justify-between">
        <div>
          <div className="font-rajdhani font-700 tracking-widest" style={{ fontSize: 20, color: '#e2e8f0', letterSpacing: '0.12em' }}>VIDEO ANALYSIS</div>
          <div className="font-mono text-xs" style={{ color: '#475569' }}>AI-Powered Detection & Tracking</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16 }}>

        {/* Main Panel */}
        <div className="space-y-4">
          {/* Source selector */}
          <div style={{ background: 'rgba(13,17,23,0.9)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: 16 }}>
            <div className="section-header">VIDEO SOURCE</div>
            <div className="flex gap-2 mb-4">
              {(['live', 'upload'] as const).map(s => (
                <button key={s} onClick={() => setSource(s)} className={s === source ? 'btn-primary' : 'btn-ghost'}>
                  {s === 'live' ? <><Camera size={12} className="inline mr-1" /> LIVE CAMERA</> : <><Upload size={12} className="inline mr-1" /> UPLOAD VIDEO</>}
                </button>
              ))}
            </div>

            {source === 'live' ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                  {liveCameras.filter(c => c.status !== 'offline').map(c => (
                    <button key={c.id} onClick={() => setSelectedCamId(c.id)}
                    style={{
                      background: selectedCam?.id === c.id ? 'rgba(0,212,255,0.1)' : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${selectedCam?.id === c.id ? 'rgba(0,212,255,0.35)' : 'rgba(255,255,255,0.08)'}`,
                      borderRadius: 6, padding: '10px 12px', cursor: 'pointer', textAlign: 'left',
                    }}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-rajdhani font-700 text-xs" style={{ color: selectedCam?.id === c.id ? '#00d4ff' : '#94a3b8' }}>{c.id}</span>
                      <span className={`status-dot-${c.status}`} style={{ width: 6, height: 6, borderRadius: '50%', display: 'inline-block' }} />
                    </div>
                    <div className="font-mono" style={{ color: '#475569', fontSize: 9 }}>{c.fps}fps · {c.latency}ms · {c.resolution}</div>
                  </button>
                ))}
              </div>
            ) : (
              <div
                onDrop={handleDrop}
                onDragOver={e => e.preventDefault()}
                onClick={() => fileRef.current?.click()}
                style={{
                  border: `2px dashed ${file ? 'rgba(34,197,94,0.4)' : 'rgba(0,212,255,0.2)'}`,
                  borderRadius: 8, padding: 32, textAlign: 'center', cursor: 'pointer',
                  background: file ? 'rgba(34,197,94,0.03)' : 'rgba(0,212,255,0.02)',
                  transition: 'all 0.2s',
                }}
              >
                <input ref={fileRef} type="file" accept="video/*" className="hidden" onChange={e => setFile(e.target.files?.[0] || null)} />
                {file ? (
                  <div>
                    <CheckCircle size={28} color="#22c55e" className="mx-auto mb-2" />
                    <div className="font-rajdhani font-700 text-sm" style={{ color: '#22c55e' }}>{file.name}</div>
                    <div className="font-mono text-xs mt-1" style={{ color: '#475569', fontSize: 10 }}>
                      {(file.size / 1024 / 1024).toFixed(1)} MB · Video ready for analysis
                    </div>
                  </div>
                ) : (
                  <div>
                    <Upload size={28} color="#00d4ff" className="mx-auto mb-2" />
                    <div className="font-rajdhani font-700 text-sm" style={{ color: '#94a3b8' }}>DROP VIDEO FILE HERE</div>
                    <div className="font-mono text-xs mt-1" style={{ color: '#475569', fontSize: 10 }}>or click to browse · MP4, AVI, MOV supported</div>
                  </div>
                )}
              </div>
            )}

            {/* Analysis controls */}
            <div className="mt-4 flex items-center gap-3">
              {!analyzing ? (
                <button onClick={startAnalysis} className="btn-primary flex items-center gap-2">
                  <Play size={12} /> {analysisStatus === 'completed' ? 'RE-ANALYZE' : 'START AI ANALYSIS'}
                </button>
              ) : (
                <span className="font-mono text-xs" style={{ color: '#00d4ff', fontSize: 10 }}>ANALYSIS JOB RUNNING</span>
              )}
            </div>

            {/* Progress */}
            {analyzing && (
              <div className="mt-4 p-4 rounded-lg" style={{ background: 'rgba(0,212,255,0.04)', border: '1px solid rgba(0,212,255,0.15)' }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-rajdhani font-700 text-xs tracking-widest" style={{ color: '#00d4ff' }}>
                    ANALYZING VIDEO
                  </span>
                  <span className="font-mono text-xs" style={{ color: '#00d4ff', fontSize: 10 }}>{analysisStatus.toUpperCase()}</span>
                </div>
                <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ width: '100%', height: '100%', background: 'linear-gradient(90deg, #00d4ff, #0099cc)', borderRadius: 2, animation: 'pulse-ring 1.5s ease-in-out infinite' }} />
                </div>
                <div className="font-mono text-xs mt-2" style={{ color: '#475569', fontSize: 10 }}>
                  Frame {currentFrame.toLocaleString()} · Processing...
                </div>
              </div>
            )}
            {analysisStatus === 'completed' && analysis && (
              <div className="mt-4 p-4 rounded-lg flex items-center gap-3" style={{ background: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.2)' }}>
                <CheckCircle size={16} color="#22c55e" />
                <div>
                  <div className="font-rajdhani font-700 text-xs" style={{ color: '#22c55e' }}>ANALYSIS COMPLETE</div>
                  <div className="font-mono text-xs" style={{ color: '#475569', fontSize: 10 }}>{analysis.framesProcessed || 0} frames processed · {analysis.detections || 0} detections · {analysis.alerts || 0} alerts · max risk {analysis.maxRisk || 0}</div>
                </div>
              </div>
            )}
            {source === 'live' && liveResult?.persona_diagnostics && <div className="mt-3 font-mono text-[9px] text-slate-500">Persona check: {liveResult.persona_diagnostics.matches} match · {liveResult.persona_diagnostics.face_embeddings} usable face crop{liveResult.persona_diagnostics.face_embeddings === 1 ? '' : 's'} · threshold {liveResult.persona_diagnostics.threshold ?? '--'}</div>}
          </div>

          {/* Video feed with detections */}
          <div style={{ background: '#040608', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, overflow: 'hidden', aspectRatio: '16/9', position: 'relative' }}>
            {source === 'upload' && videoPreviewUrl
              ? <video src={videoPreviewUrl} controls className="absolute inset-0 z-0 w-full h-full object-contain" />
              : source === 'live' && selectedCam
                ? sharedStream
                  ? <video ref={sharedVideoRef} autoPlay muted playsInline className="absolute inset-0 z-0 w-full h-full object-contain" />
                  : liveFrame
                    ? <><img src={liveFrame} alt="Live camera frame" className="absolute inset-0 z-0 w-full h-full object-contain" /><div className="absolute inset-0 flex flex-col items-center justify-center gap-3 font-mono text-slate-300"><span>{sharedCameraError || 'CAMERA PREVIEW RELAY'}</span><button className="btn-primary" onClick={() => window.dispatchEvent(new Event('ibvap:start-camera'))}><Camera size={12} className="mr-1 inline" /> START SHARED CAMERA</button></div></> : <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 font-mono text-slate-500"><span>{sharedCameraError || 'WAITING FOR CAMERA DATA'}</span><button className="btn-primary" onClick={() => window.dispatchEvent(new Event('ibvap:start-camera'))}><Camera size={12} className="mr-1 inline" /> START SHARED CAMERA</button></div>
                : <div className="absolute inset-0 flex items-center justify-center font-mono text-slate-500">WAITING FOR CAMERA DATA</div>}
            {/* Scan line */}
            <div className="absolute inset-0 z-10 overflow-hidden pointer-events-none">
              <div style={{ position: 'absolute', left: 0, right: 0, height: 2, background: 'rgba(0,212,255,0.07)', animation: 'scan 4s linear infinite' }} />
            </div>
            {activeZones.map((zone, index) => {
              const points = (zone.polygon || []).map(([x, y]: [number, number]) => `${x * 100}% ${y * 100}%`).join(', ')
              const color = zone.type === 'danger' ? '#ef4444' : '#22c55e'
              return <div key={zone.id || zone.name || index} style={{ position: 'absolute', inset: 0, clipPath: `polygon(${points})`, background: `${color}18`, border: `1px dashed ${color}99`, pointerEvents: 'none' }}>
                <span className="absolute font-mono" style={{ left: `${(zone.polygon?.[0]?.[0] || 0) * 100}%`, top: `${(zone.polygon?.[0]?.[1] || 0) * 100}%`, color, fontSize: 9 }}>{zone.name?.toUpperCase()}</span>
              </div>
            })}
            {/* Detection boxes */}
            {detections.map((d, i) => {
              const colors: Record<string, string> = { CRITICAL: '#ef4444', HIGH: '#f97316', MEDIUM: '#f59e0b', LOW: '#22c55e' };
              const c = colors[d.threat];
              return (
                <div key={i} style={{ position: 'absolute', left: `${d.x}%`, top: `${d.y}%`, width: `${d.w}%`, height: `${d.h}%`, border: `1.5px solid ${c}`, boxShadow: `0 0 10px ${c}33`, pointerEvents: 'none' }}>
                  <div style={{ position: 'absolute', top: -22, left: 0, background: `${c}22`, border: `1px solid ${c}66`, borderRadius: 3, padding: '2px 7px', fontFamily: 'JetBrains Mono', fontSize: 9, color: c, whiteSpace: 'nowrap' }}>
                    {d.type} {d.id.length < 5 ? `#${d.id}` : d.id} · {d.conf}%
                    {d.persona ? ` · ${d.persona.display_label}` : ''}
                  </div>
                </div>
              );
            })}
            {/* Scanlines texture */}
            <div className="absolute inset-0 z-10 pointer-events-none" style={{ background: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.1) 3px, rgba(0,0,0,0.1) 4px)' }} />
            {/* Status */}
            <div className="absolute top-3 left-3">
              <div className="flex items-center gap-2" style={{ background: 'rgba(0,0,0,0.6)', borderRadius: 4, padding: '4px 8px' }}>
                <span className="status-dot-offline blink" style={{ width: 6, height: 6, borderRadius: '50%', display: 'inline-block' }} />
                <span className="font-mono" style={{ color: '#ef4444', fontSize: 10 }}>LIVE</span>
                <span className="font-mono" style={{ color: '#64748b', fontSize: 10 }}>· {selectedCam?.id || 'NO CAMERA'} · {selectedCam?.fps || 0}fps</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right panel */}
        <div className="space-y-4">
          {/* Overlay toggles */}
          <div style={{ background: 'rgba(13,17,23,0.9)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: 16 }}>
            <div className="section-header">AI OVERLAY CONTROLS</div>
            <div className="space-y-2.5">
              {Object.entries({ boxes: 'Bounding Boxes', ids: 'Tracking IDs', trajectories: 'Trajectories', confidence: 'Confidence Score', zones: 'Restricted Zones', risk: 'Risk Indicators' }).map(([k, label]) => (
                <div key={k} className="flex items-center justify-between">
                  <span className="font-mono text-xs" style={{ color: '#64748b', fontSize: 11 }}>{label}</span>
                  <button
                    onClick={() => setOverlayToggles(t => ({ ...t, [k]: !t[k as keyof typeof t] }))}
                    style={{
                      width: 36, height: 20, borderRadius: 10, cursor: 'pointer', border: 'none',
                      background: overlayToggles[k as keyof typeof overlayToggles] ? 'rgba(0,212,255,0.3)' : 'rgba(255,255,255,0.06)',
                      position: 'relative', transition: 'background 0.2s',
                    }}
                  >
                    <div style={{
                      width: 14, height: 14, borderRadius: '50%',
                      background: overlayToggles[k as keyof typeof overlayToggles] ? '#00d4ff' : '#334155',
                      position: 'absolute', top: 3, transition: 'all 0.2s',
                      left: overlayToggles[k as keyof typeof overlayToggles] ? 18 : 3,
                    }} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Detection list */}
          <div style={{ background: 'rgba(13,17,23,0.9)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: 16 }}>
            <div className="section-header">ACTIVE DETECTIONS</div>
            <div className="space-y-2">
              {detections.map((d, i) => {
                const colors: Record<string, string> = { CRITICAL: '#ef4444', HIGH: '#f97316', MEDIUM: '#f59e0b', LOW: '#22c55e' };
                return (
                  <div key={i} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 6, padding: '10px 12px' }}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-rajdhani font-700 text-xs" style={{ color: '#e2e8f0' }}>{d.type} {d.id.length < 5 ? `#${d.id}` : d.id}</span>
                      <span className={`badge-${d.threat.toLowerCase()}`}>{d.threat}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div style={{ flex: 1, height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 2 }}>
                        <div style={{ width: `${d.conf}%`, height: '100%', background: colors[d.threat], borderRadius: 2 }} />
                      </div>
                      <span className="font-mono text-xs" style={{ color: colors[d.threat], fontSize: 10 }}>{d.risk}/100 risk · {d.conf}%</span>
                    </div>
                    {d.persona && <div className="mt-2 border border-amber-300/30 bg-amber-300/5 p-2 font-mono text-[9px] text-amber-200">{d.persona.display_label}<br /><span className="text-amber-100/60">Synthetic consenting demo profile only · {Math.round(Number(d.persona.similarity || 0) * 100)}% match</span></div>}
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ background: 'rgba(13,17,23,0.9)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: 16 }}>
            <div className="section-header">TRACK INTELLIGENCE</div>
            {Object.values(trackSummaries).length === 0
              ? <div className="font-mono text-slate-500" style={{ fontSize: 10 }}>Track summaries will appear as people are detected.</div>
              : Object.values(trackSummaries).map((track: any) => <div key={track.track_id} className="mb-2 border border-white/10 p-2">
                <div className="flex items-center justify-between font-mono text-[10px]"><span className="text-slate-200">TRACK #{track.track_id}</span><span className={track.severity === 'CRITICAL' || track.severity === 'HIGH' ? 'text-red-400' : 'text-cyan-300'}>{track.risk_score}/100 · {track.severity}</span></div>
              </div>)}
          </div>

          {source === 'upload' && (analysis?.personaMatches || []).length > 0 && <div style={{ background: 'rgba(13,17,23,0.9)', border: '1px solid rgba(251,191,36,0.3)', borderRadius: 8, padding: 16 }}>
            <div className="section-header" style={{ color: '#fbbf24' }}>SYNTHETIC PERSONA NOTIFICATIONS</div>
            <div className="space-y-2">{analysis.personaMatches.map((match: any) => <div key={`${match.track_id}-${match.persona_id}`} className="border border-amber-300/20 bg-amber-300/5 p-3 font-mono text-[10px]"><div className="flex items-center justify-between text-amber-200"><span>{match.display_label}</span><span>TRACK #{match.track_id ?? '--'} · {Math.round(Number(match.similarity || 0) * 100)}%</span></div><div className="mt-1 text-amber-100/70">REFERENCE ANGLE: {match.reference_angle || '--'}</div><div className="mt-1 text-slate-400">{match.fictional_case_note}</div><div className="mt-1 text-slate-500">{match.disclaimer}</div></div>)}</div>
          </div>}

          <div style={{ background: 'rgba(13,17,23,0.9)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: 16 }}>
            <div className="section-header">ANOMALY TIMELINE</div>
            {analysisEvents.length === 0
              ? <div className="font-mono text-slate-500" style={{ fontSize: 10 }}>No running, loitering, possible-fighting, or exit events recorded.</div>
              : analysisEvents.slice(-12).reverse().map((event: any, index: number) => <div key={`${event.type}-${event.track_id}-${event.frame}-${index}`} className="mb-2 border border-white/10 p-2 font-mono text-[10px]"><div className="flex items-center justify-between"><span className={event.type === 'possible_fighting' ? 'text-red-400' : event.type === 'track_exit' ? 'text-amber-300' : 'text-cyan-300'}>{event.type.replace(/_/g, ' ').toUpperCase()}</span><span className="text-slate-500">{event.frame ? `FRAME ${event.frame}` : ''}</span></div><div className="mt-1 text-slate-400">{event.detail}</div>{event.type === 'track_exit' && <div className="mt-1 text-amber-200">Last seen: {event.last_seen_side} · ({Math.round(event.last_seen_point.x * 100)}%, {Math.round(event.last_seen_point.y * 100)}%)</div>}</div>)}
          </div>

          <div style={{ background: 'rgba(13,17,23,0.9)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: 16 }}>
            <div className="section-header">ACTIVE ZONES</div>
            {activeZones.length === 0
              ? <div className="font-mono text-slate-500" style={{ fontSize: 10 }}>No active zones configured.</div>
              : activeZones.map((zone, index) => <div key={zone.id || zone.name || index} className="mb-2 flex items-center justify-between border border-white/10 p-2"><span className="font-mono text-xs" style={{ color: zone.type === 'danger' ? '#ef4444' : '#38bdf8', fontSize: 10 }}>{zone.name?.toUpperCase()}</span><span className="font-mono text-slate-500" style={{ fontSize: 9 }}>{zone.type === 'danger' ? 'DANGER / INTRUSION' : 'SAFE / BEHAVIOR'}</span></div>)}
          </div>
        </div>
      </div>
    </div>
  );
}
