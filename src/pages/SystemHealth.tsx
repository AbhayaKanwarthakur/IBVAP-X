import { useState, useEffect } from 'react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { apiUrl } from '../api/client';

function MetricCard({ label, value, unit, color }: any) {
  const numericValue = Number(value) || 0;
  const spark = [{ v: numericValue }, { v: numericValue }, { v: numericValue }];
  return (
    <div style={{ background: 'rgba(13,17,23,0.9)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: 16 }}>
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="font-mono text-xs" style={{ color: '#475569', fontSize: 10, letterSpacing: '0.08em' }}>{label}</div>
          <div className="font-rajdhani font-700 mt-1" style={{ fontSize: 26, color, lineHeight: 1 }}>
            {typeof value === 'number' ? value.toFixed(0) : value}
            <span className="text-sm ml-1" style={{ color: '#475569', fontSize: 12 }}>{unit}</span>
          </div>
        </div>
        <div style={{ width: 80, height: 40 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={spark}>
              <Line type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div style={{ height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${spark[spark.length - 1]?.v ?? 0}%`, height: '100%', background: color, borderRadius: 2, transition: 'width 0.5s ease' }} />
      </div>
    </div>
  );
}

export default function SystemHealth() {
  const [camAction, setCamAction] = useState<Record<string, string>>({});
  const [health, setHealth] = useState<any>(null);
  const [aiHealth, setAiHealth] = useState<any>(null);
  const [cameras, setCameras] = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
      const [nodeResponse, aiResponse, cameraResponse] = await Promise.all([
        fetch(apiUrl('/api/health'), { cache: 'no-store' }),
        fetch(apiUrl('/api/ai/health'), { cache: 'no-store' }),
        fetch(apiUrl('/api/cameras'), { cache: 'no-store' }),
      ])
      if (nodeResponse.ok) setHealth(await nodeResponse.json())
      if (aiResponse.ok) setAiHealth(await aiResponse.json())
      if (cameraResponse.ok) setCameras((await cameraResponse.json()).data || [])
    }
    void load()
    const timer = window.setInterval(() => void load(), 5000)
    return () => window.clearInterval(timer)
  }, [])

  const handleAction = (camId: string, action: string) => {
    setCamAction(a => ({ ...a, [camId]: action }));
    setTimeout(() => setCamAction(a => ({ ...a, [camId]: '' })), 2000);
  };

  return (
    <div className="p-5 space-y-5 fade-in">
      <div>
        <div className="font-rajdhani font-700 tracking-widest" style={{ fontSize: 20, color: '#e2e8f0', letterSpacing: '0.12em' }}>SYSTEM HEALTH</div>
        <div className="font-mono text-xs" style={{ color: '#475569' }}>Real-Time Telemetry · Service Monitoring · Camera Management</div>
      </div>

      {/* Service status */}
      <div style={{ background: 'rgba(13,17,23,0.9)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: 20 }}>
        <div className="section-header">SERVICE & PIPELINE STATUS</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
          {[
            { name: 'NODE API', status: health?.status === 'ok' ? 'online' : 'offline', version: health?.version || '--' },
            { name: 'AI SERVICE', status: aiHealth?.status === 'ok' ? 'online' : 'offline', version: aiHealth?.service || '--' },
            { name: 'CAMERA NETWORK', status: cameras.some(c => c.status === 'online') ? 'online' : 'warning', version: `${cameras.length} configured` },
            { name: 'BYTETRACK TRACKER', status: aiHealth?.models?.bytetrack ? 'online' : 'warning', version: 'ByteTrack v1.0' },
          ].map(s => (
            <div key={s.name} style={{ background: s.status === 'online' ? 'rgba(34,197,94,0.04)' : 'rgba(245,158,11,0.04)', border: `1px solid ${s.status === 'online' ? 'rgba(34,197,94,0.15)' : 'rgba(245,158,11,0.25)'}`, borderRadius: 7, padding: 14 }}>
              <div className="flex items-center gap-2 mb-2">
                <span className={`status-dot-${s.status === 'online' ? 'online' : 'warning'} ${s.status === 'online' ? 'blink' : ''}`} style={{ width: 7, height: 7, borderRadius: '50%', display: 'inline-block' }} />
                <span className="font-mono text-xs" style={{ color: s.status === 'online' ? '#22c55e' : '#f59e0b', fontSize: 9, letterSpacing: '0.1em' }}>{s.status.toUpperCase()}</span>
              </div>
              <div className="font-rajdhani font-700 text-xs" style={{ color: '#e2e8f0', letterSpacing: '0.06em' }}>{s.name}</div>
              <div className="font-mono" style={{ color: '#334155', fontSize: 9 }}>{s.version}</div>
            </div>
          ))}
        </div>

        {/* AI Engine Sub-Models */}
        <div className="font-mono text-xs mb-2" style={{ color: '#00d4ff', fontSize: 10, letterSpacing: '0.1em' }}>COMPUTER VISION & MODEL PIPELINE</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
          {[
            { name: 'YOLO OBJECT DETECTOR', status: aiHealth?.models?.yolo ? 'online' : 'offline', detail: aiHealth?.models?.yolo ? String(aiHealth.models.yolo).split('\\').pop()?.split('/').pop() : 'not_loaded' },
            { name: 'PLATE DETECTOR', status: aiHealth?.models?.plate === 'loaded' ? 'online' : 'warning', detail: aiHealth?.models?.plate || 'not_configured' },
            { name: 'OCR ENGINE', status: aiHealth?.models?.ocr?.includes('loaded') ? 'online' : 'warning', detail: aiHealth?.models?.ocr || 'not_installed' },
            { name: 'RTFM ANOMALY', status: aiHealth?.models?.rtfm === 'loaded' ? 'online' : 'warning', detail: aiHealth?.models?.rtfm || 'disabled' },
          ].map(m => (
            <div key={m.name} style={{ background: m.status === 'online' ? 'rgba(0,212,255,0.04)' : 'rgba(245,158,11,0.04)', border: `1px solid ${m.status === 'online' ? 'rgba(0,212,255,0.2)' : 'rgba(245,158,11,0.25)'}`, borderRadius: 7, padding: 12 }}>
              <div className="flex items-center gap-2 mb-1.5">
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: m.status === 'online' ? '#00d4ff' : '#f59e0b', display: 'inline-block' }} />
                <span className="font-mono text-xs" style={{ color: m.status === 'online' ? '#00d4ff' : '#f59e0b', fontSize: 9, letterSpacing: '0.08em' }}>{m.status.toUpperCase()}</span>
              </div>
              <div className="font-rajdhani font-700 text-xs" style={{ color: '#e2e8f0', letterSpacing: '0.05em' }}>{m.name}</div>
              <div className="font-mono truncate" style={{ color: '#64748b', fontSize: 9 }} title={m.detail}>{m.detail}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Metrics grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        <MetricCard label="INFERENCE FPS" value={aiHealth?.metrics?.inference_fps || 0} unit="fps" color="#00d4ff" />
        <MetricCard label="DETECTION LATENCY" value={aiHealth?.metrics?.detection_latency_ms || 0} unit="ms" color="#22c55e" />
        <MetricCard label="TOTAL LATENCY" value={aiHealth?.metrics?.total_latency_ms || 0} unit="ms" color="#f59e0b" />
        <MetricCard label="ACTIVE ZONES" value={aiHealth?.active_zones || 0} unit="" color="#38bdf8" />
      </div>

      {/* Camera health */}
      <div style={{ background: 'rgba(13,17,23,0.9)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: 20 }}>
        <div className="section-header">CAMERA HEALTH MANAGEMENT</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {cameras.map(c => (
            <div key={c.id} style={{ background: c.status === 'offline' ? 'rgba(239,68,68,0.04)' : c.status === 'warning' ? 'rgba(245,158,11,0.04)' : 'rgba(255,255,255,0.02)', border: `1px solid ${c.status === 'offline' ? 'rgba(239,68,68,0.2)' : c.status === 'warning' ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.07)'}`, borderRadius: 8, padding: 14 }}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className={`status-dot-${c.status === 'warning' ? 'warning' : c.status}`} style={{ width: 7, height: 7, borderRadius: '50%', display: 'inline-block' }} />
                  <span className="font-rajdhani font-700 text-xs" style={{ color: '#e2e8f0', letterSpacing: '0.06em' }}>{c.id}</span>
                </div>
                <span className="font-mono text-xs" style={{ color: c.status === 'online' ? '#22c55e' : c.status === 'warning' ? '#f59e0b' : '#ef4444', fontSize: 9, letterSpacing: '0.08em' }}>{c.status.toUpperCase()}</span>
              </div>
              <div className="font-mono mb-2" style={{ color: '#334155', fontSize: 9 }}>{c.sector}</div>
              <div className="font-mono mb-2" style={{ color: '#38bdf8', fontSize: 9 }}>ROLE: {String(c.role || 'overview').toUpperCase()} · PTZ: {c.ptz?.available ? 'READY' : 'NOT CONFIGURED'}</div>
              {c.status !== 'offline' ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 10 }}>
                  {[
                    { label: 'FPS', value: `${c.fps}` },
                    { label: 'LATENCY', value: `${c.latency}ms` },
                    { label: 'RESOLUTION', value: c.resolution },
                    { label: 'UPTIME', value: `${c.uptime}%` },
                  ].map(m => (
                    <div key={m.label} style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 4, padding: '5px 7px' }}>
                      <div className="font-mono" style={{ color: '#334155', fontSize: 8, letterSpacing: '0.06em' }}>{m.label}</div>
                      <div className="font-mono font-700" style={{ color: '#94a3b8', fontSize: 11 }}>{m.value}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mb-3 font-mono text-xs text-center py-2" style={{ color: '#ef4444', background: 'rgba(239,68,68,0.05)', borderRadius: 4, fontSize: 10 }}>SIGNAL LOST</div>
              )}
              <div className="flex gap-1.5">
                {['VIEW', 'RESTART', 'CONFIG'].map(action => (
                  <button key={action}
                    onClick={() => handleAction(c.id, action)}
                    style={{
                      flex: 1, padding: '4px 0', borderRadius: 4, cursor: 'pointer', border: 'none',
                      background: camAction[c.id] === action ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.04)',
                      color: camAction[c.id] === action ? '#22c55e' : '#64748b',
                      fontFamily: 'Rajdhani', fontWeight: 700, fontSize: 10, letterSpacing: '0.06em',
                      transition: 'all 0.2s',
                    }}>
                    {camAction[c.id] === action ? '✓' : action}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
