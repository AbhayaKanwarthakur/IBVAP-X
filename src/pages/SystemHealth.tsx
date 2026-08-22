import { useState, useEffect } from 'react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { cameras, systemMetrics } from '../data/mockData';

function useSparkline(base: number, variance: number) {
  const [data, setData] = useState(Array.from({ length: 20 }, () => ({ v: base + (Math.random() - 0.5) * variance })));
  useEffect(() => {
    const t = setInterval(() => {
      setData(d => [...d.slice(1), { v: Math.max(0, Math.min(100, base + (Math.random() - 0.5) * variance)) }]);
    }, 1000);
    return () => clearInterval(t);
  }, [base, variance]);
  return data;
}

function MetricCard({ label, value, unit, color, sparkBase, sparkVariance }: any) {
  const spark = useSparkline(sparkBase, sparkVariance);
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
        <div className="section-header">SERVICE STATUS</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
          {systemMetrics.services.map(s => (
            <div key={s.name} style={{ background: s.status === 'online' ? 'rgba(34,197,94,0.04)' : 'rgba(245,158,11,0.04)', border: `1px solid ${s.status === 'online' ? 'rgba(34,197,94,0.15)' : 'rgba(245,158,11,0.25)'}`, borderRadius: 7, padding: 14 }}>
              <div className="flex items-center gap-2 mb-2">
                <span className={`status-dot-${s.status === 'online' ? 'online' : 'warning'} ${s.status === 'online' ? 'blink' : ''}`} style={{ width: 7, height: 7, borderRadius: '50%', display: 'inline-block' }} />
                <span className="font-mono text-xs" style={{ color: s.status === 'online' ? '#22c55e' : '#f59e0b', fontSize: 9, letterSpacing: '0.1em' }}>{s.status.toUpperCase()}</span>
              </div>
              <div className="font-rajdhani font-700 text-xs" style={{ color: '#e2e8f0', letterSpacing: '0.06em' }}>{s.name}</div>
              <div className="font-mono mt-1" style={{ color: '#334155', fontSize: 9 }}>Uptime: {s.uptime}</div>
              <div className="font-mono" style={{ color: '#334155', fontSize: 9 }}>{s.version}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Metrics grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        <MetricCard label="CPU USAGE" value={systemMetrics.cpu} unit="%" color="#00d4ff" sparkBase={67} sparkVariance={15} />
        <MetricCard label="GPU USAGE" value={systemMetrics.gpu} unit="%" color="#a855f7" sparkBase={82} sparkVariance={10} />
        <MetricCard label="MEMORY" value={systemMetrics.memory} unit="%" color="#22c55e" sparkBase={54} sparkVariance={8} />
        <MetricCard label="DISK" value={systemMetrics.diskUsage} unit="%" color="#f59e0b" sparkBase={38} sparkVariance={3} />
        <MetricCard label="SYSTEM FPS" value={systemMetrics.fps} unit="fps" color="#00d4ff" sparkBase={75} sparkVariance={12} />
        <MetricCard label="LATENCY" value={systemMetrics.latency} unit="ms" color="#22c55e" sparkBase={41} sparkVariance={20} />
        <MetricCard label="NETWORK" value={systemMetrics.networkBandwidth} unit="Mbps" color="#00d4ff" sparkBase={80} sparkVariance={15} />
        <MetricCard label="AI CONFIDENCE" value={systemMetrics.aiConfidence} unit="%" color="#a855f7" sparkBase={94} sparkVariance={3} />
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
