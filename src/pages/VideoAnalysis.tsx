import { useState, useRef, useEffect } from 'react';
import { Upload, Play, Pause, Square, RotateCcw, Camera, CheckCircle, AlertTriangle } from 'lucide-react';
import { cameras } from '../data/mockData';

export default function VideoAnalysis() {
  const [source, setSource] = useState<'live' | 'upload'>('live');
  const [selectedCam, setSelectedCam] = useState(cameras[0]);
  const [file, setFile] = useState<File | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentFrame, setCurrentFrame] = useState(0);
  const totalFrames = 5400;
  const fileRef = useRef<HTMLInputElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [overlayToggles, setOverlayToggles] = useState({
    boxes: true, ids: true, trajectories: true, confidence: true, zones: true, risk: true,
  });

  useEffect(() => {
    if (analyzing && !paused) {
      intervalRef.current = setInterval(() => {
        setCurrentFrame(f => {
          const next = f + 45;
          if (next >= totalFrames) {
            setAnalyzing(false);
            setProgress(100);
            return totalFrames;
          }
          setProgress(Math.round((next / totalFrames) * 100));
          return next;
        });
      }, 300);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [analyzing, paused]);

  const startAnalysis = () => {
    setCurrentFrame(0);
    setProgress(0);
    setAnalyzing(true);
    setPaused(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f && f.type.startsWith('video/')) setFile(f);
  };

  const detections = [
    { type: 'PERSON',  id: '037', conf: 96, x: 38, y: 28, w: 13, h: 30, threat: 'CRITICAL' },
    { type: 'PERSON',  id: '019', conf: 89, x: 62, y: 40, w: 11, h: 25, threat: 'HIGH' },
    { type: 'VEHICLE', id: '008', conf: 94, x: 8,  y: 62, w: 26, h: 14, threat: 'MEDIUM' },
    { type: 'PLATE',   id: 'PB10AB1234', conf: 91, x: 9, y: 72, w: 14, h: 5, threat: 'MEDIUM' },
  ];

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
                {cameras.filter(c => c.status !== 'offline').map(c => (
                  <button key={c.id} onClick={() => setSelectedCam(c)}
                    style={{
                      background: selectedCam.id === c.id ? 'rgba(0,212,255,0.1)' : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${selectedCam.id === c.id ? 'rgba(0,212,255,0.35)' : 'rgba(255,255,255,0.08)'}`,
                      borderRadius: 6, padding: '10px 12px', cursor: 'pointer', textAlign: 'left',
                    }}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-rajdhani font-700 text-xs" style={{ color: selectedCam.id === c.id ? '#00d4ff' : '#94a3b8' }}>{c.id}</span>
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
              {!analyzing || progress === 100 ? (
                <button onClick={startAnalysis} className="btn-primary flex items-center gap-2">
                  <Play size={12} /> {progress === 100 ? 'RE-ANALYZE' : 'START AI ANALYSIS'}
                </button>
              ) : (
                <>
                  <button onClick={() => setPaused(!paused)} className="btn-primary flex items-center gap-2">
                    {paused ? <Play size={12} /> : <Pause size={12} />} {paused ? 'RESUME' : 'PAUSE'}
                  </button>
                  <button onClick={() => { setAnalyzing(false); setProgress(0); setCurrentFrame(0); }} className="btn-danger flex items-center gap-2">
                    <Square size={12} /> STOP
                  </button>
                  <button onClick={() => { setCurrentFrame(0); setProgress(0); }} className="btn-ghost flex items-center gap-2">
                    <RotateCcw size={12} /> RESTART
                  </button>
                </>
              )}
            </div>

            {/* Progress */}
            {analyzing && progress < 100 && (
              <div className="mt-4 p-4 rounded-lg" style={{ background: 'rgba(0,212,255,0.04)', border: '1px solid rgba(0,212,255,0.15)' }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-rajdhani font-700 text-xs tracking-widest" style={{ color: '#00d4ff' }}>
                    {paused ? 'ANALYSIS PAUSED' : 'ANALYZING VIDEO'}
                  </span>
                  <span className="font-mono text-xs" style={{ color: '#00d4ff', fontSize: 10 }}>{progress}%</span>
                </div>
                <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ width: `${progress}%`, height: '100%', background: 'linear-gradient(90deg, #00d4ff, #0099cc)', borderRadius: 2, transition: 'width 0.3s ease' }} />
                </div>
                <div className="font-mono text-xs mt-2" style={{ color: '#475569', fontSize: 10 }}>
                  Frame {currentFrame.toLocaleString()} / {totalFrames.toLocaleString()} · {paused ? 'Paused' : 'Processing...'}
                </div>
              </div>
            )}
            {progress === 100 && (
              <div className="mt-4 p-4 rounded-lg flex items-center gap-3" style={{ background: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.2)' }}>
                <CheckCircle size={16} color="#22c55e" />
                <div>
                  <div className="font-rajdhani font-700 text-xs" style={{ color: '#22c55e' }}>ANALYSIS COMPLETE</div>
                  <div className="font-mono text-xs" style={{ color: '#475569', fontSize: 10 }}>5,400 frames processed · 4 detections · 2 incidents flagged</div>
                </div>
              </div>
            )}
          </div>

          {/* Video feed with detections */}
          <div style={{ background: '#040608', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, overflow: 'hidden', aspectRatio: '16/9', position: 'relative' }}>
            {/* Simulated feed */}
            <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 30% 40%, #001a10 0%, #040608 70%)' }} />
            <div className="absolute bottom-0 left-0 right-0" style={{ height: '35%', background: 'rgba(15,20,10,0.7)' }} />
            {/* Scan line */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div style={{ position: 'absolute', left: 0, right: 0, height: 2, background: 'rgba(0,212,255,0.07)', animation: 'scan 4s linear infinite' }} />
            </div>
            {/* Restricted zone */}
            <div style={{ position: 'absolute', left: '5%', top: '15%', width: '32%', height: '52%', border: '1px dashed rgba(239,68,68,0.5)', background: 'rgba(239,68,68,0.04)' }}>
              <span style={{ position: 'absolute', top: 4, left: 4, fontFamily: 'JetBrains Mono', fontSize: 9, color: 'rgba(239,68,68,0.7)' }}>RESTRICTED ZONE A</span>
            </div>
            {/* Detection boxes */}
            {detections.map((d, i) => {
              const colors: Record<string, string> = { CRITICAL: '#ef4444', HIGH: '#f97316', MEDIUM: '#f59e0b', LOW: '#22c55e' };
              const c = colors[d.threat];
              return (
                <div key={i} style={{ position: 'absolute', left: `${d.x}%`, top: `${d.y}%`, width: `${d.w}%`, height: `${d.h}%`, border: `1.5px solid ${c}`, boxShadow: `0 0 10px ${c}33`, pointerEvents: 'none' }}>
                  <div style={{ position: 'absolute', top: -22, left: 0, background: `${c}22`, border: `1px solid ${c}66`, borderRadius: 3, padding: '2px 7px', fontFamily: 'JetBrains Mono', fontSize: 9, color: c, whiteSpace: 'nowrap' }}>
                    {d.type} {d.id.length < 5 ? `#${d.id}` : d.id} · {d.conf}%
                  </div>
                </div>
              );
            })}
            {/* Scanlines texture */}
            <div className="absolute inset-0 pointer-events-none" style={{ background: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.1) 3px, rgba(0,0,0,0.1) 4px)' }} />
            {/* Status */}
            <div className="absolute top-3 left-3">
              <div className="flex items-center gap-2" style={{ background: 'rgba(0,0,0,0.6)', borderRadius: 4, padding: '4px 8px' }}>
                <span className="status-dot-offline blink" style={{ width: 6, height: 6, borderRadius: '50%', display: 'inline-block' }} />
                <span className="font-mono" style={{ color: '#ef4444', fontSize: 10 }}>LIVE</span>
                <span className="font-mono" style={{ color: '#64748b', fontSize: 10 }}>· {selectedCam.id} · {selectedCam.fps}fps</span>
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
                      <span className="font-mono text-xs" style={{ color: colors[d.threat], fontSize: 10 }}>{d.conf}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Virtual fence */}
          <div style={{ background: 'rgba(13,17,23,0.9)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: 16 }}>
            <div className="section-header">VIRTUAL FENCE STATUS</div>
            {[
              { name: 'RESTRICTED ZONE A', severity: 'HIGH SECURITY', active: true, breached: true },
              { name: 'SECURE PERIMETER B', severity: 'MEDIUM SECURITY', active: true, breached: false },
              { name: 'BUFFER ZONE C', severity: 'LOW SECURITY', active: false, breached: false },
            ].map((z, i) => (
              <div key={i} className="mb-2" style={{ background: z.breached ? 'rgba(239,68,68,0.06)' : 'rgba(255,255,255,0.02)', border: `1px solid ${z.breached ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.07)'}`, borderRadius: 6, padding: '10px 12px' }}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-rajdhani font-700 text-xs" style={{ color: z.breached ? '#ef4444' : '#94a3b8' }}>{z.name}</div>
                    <div className="font-mono" style={{ color: '#475569', fontSize: 9 }}>{z.severity}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {z.breached && <AlertTriangle size={12} color="#ef4444" />}
                    <span style={{ fontFamily: 'JetBrains Mono', fontSize: 9, color: z.active ? '#22c55e' : '#475569' }}>{z.active ? 'ACTIVE' : 'INACTIVE'}</span>
                  </div>
                </div>
                {z.breached && (
                  <div className="font-mono mt-1" style={{ color: '#ef4444', fontSize: 9, letterSpacing: '0.05em' }}>
                    🚨 INTRUSION DETECTED · TRACK-037
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
