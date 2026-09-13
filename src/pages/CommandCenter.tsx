import { useState, useEffect } from 'react';
import { Camera, Users, Truck, AlertTriangle, Zap, Activity, Clock } from 'lucide-react';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { apiUrl } from '../api/client';
import { useRealtimeSnapshot } from '../api/realtime';

function StatCard({ label, value, unit, icon: Icon, accent, trend, subtitle }: any) {
  return (
    <div className={`stat-card ${accent}`}>
      <div className="flex items-start justify-between mb-3">
        <div style={{ background: `rgba(${accent === 'cyan' ? '0,212,255' : accent === 'red' ? '239,68,68' : accent === 'amber' ? '245,158,11' : '34,197,94'},0.1)`, borderRadius: 6, padding: 8 }}>
          <Icon size={16} color={accent === 'cyan' ? '#00d4ff' : accent === 'red' ? '#ef4444' : accent === 'amber' ? '#f59e0b' : '#22c55e'} />
        </div>
        {trend !== undefined && (
          <div className="flex items-center gap-1" style={{ color: trend > 0 ? '#ef4444' : '#22c55e' }}>
            {trend > 0 ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
            <span className="font-mono text-xs" style={{ fontSize: 10 }}>{Math.abs(trend)}%</span>
          </div>
        )}
      </div>
      <div className="font-rajdhani font-700" style={{ fontSize: 28, lineHeight: 1, color: '#e2e8f0' }}>
        {value}<span className="text-sm ml-1" style={{ color: '#64748b', fontSize: 13 }}>{unit}</span>
      </div>
      <div className="font-mono mt-1" style={{ color: '#475569', fontSize: 10, letterSpacing: '0.08em' }}>{label}</div>
      {subtitle && <div className="font-mono mt-0.5" style={{ color: accent === 'red' ? '#ef4444' : '#334155', fontSize: 9 }}>{subtitle}</div>}
    </div>
  );
}

export default function CommandCenter() {
  const realtime = useRealtimeSnapshot();
  const liveCameras = realtime.cameras;
  const liveAlerts = realtime.alerts;
  const [aiHealth, setAiHealth] = useState<any>(null);
  const [liveResult, setLiveResult] = useState<any>(null);

  useEffect(() => {
    const load = async () => {
      const healthResponse = await fetch(apiUrl('/api/ai/health'), { cache: 'no-store' })
      if (healthResponse.ok) setAiHealth(await healthResponse.json())
      const cameraId = liveCameras[0]?.id
      if (cameraId) {
        const resultResponse = await fetch(apiUrl(`/api/cameras/${cameraId}/ai`), { cache: 'no-store' })
        if (resultResponse.ok) setLiveResult(await resultResponse.json())
      }
    }
    void load()
    const timer = window.setInterval(() => void load(), 3000)
    return () => window.clearInterval(timer)
  }, [liveCameras]);

  const recentAlerts = liveAlerts.slice(0, 5);
  const onlineCams = liveCameras.filter(c => c.status === 'online');
    const persons = new Map(
      (liveResult?.detections?.filter((d: any) => d.label === 'person') || [])
        .map((d: any, index: number) => [d.track_id != null ? `track-${d.track_id}` : `detection-${index}`, d])
    ).size;
  const vehicles = liveResult?.detections?.filter((d: any) => ['car', 'motorcycle', 'bus', 'truck', 'bicycle'].includes(d.label)).length || 0;
  const activeIncidents = realtime.incidents.filter(incident => incident.status === 'OPEN').length;
  const criticalAlerts = liveAlerts.filter(alert => alert.severity === 'CRITICAL').length;
  const fps = liveResult?.metrics?.inference_fps || aiHealth?.metrics?.inference_fps || 0;
  const latency = liveResult?.metrics?.total_latency_ms || aiHealth?.metrics?.total_latency_ms || 0;
  const activityData = Array.from({ length: 8 }, (_, index) => {
    const end = Date.now() - (7 - index) * 60 * 60 * 1000;
    const start = end - 60 * 60 * 1000;
    const bucket = realtime.incidents.filter(incident => {
      const timestamp = Date.parse(incident.createdAt || '')
      return timestamp >= start && timestamp < end
    });
    return { time: new Date(end).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }), critical: bucket.filter(item => item.severity === 'CRITICAL').length, high: bucket.filter(item => item.severity === 'HIGH').length, medium: bucket.filter(item => item.severity === 'MEDIUM').length };
  });
  const telemetry = [
    { label: 'INFERENCE FPS', val: Number(fps).toFixed(1), color: '#00d4ff' },
    { label: 'LATENCY MS', val: Number(latency).toFixed(0), color: '#22c55e' },
    { label: 'ACTIVE TRACKS', val: String(persons + vehicles), color: '#f59e0b' },
    { label: 'AI ZONES', val: String(aiHealth?.active_zones ?? 0), color: '#38bdf8' },
  ];

  return (
    <div className="p-5 space-y-5 fade-in">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <div className="font-rajdhani font-700 tracking-widest" style={{ fontSize: 22, color: '#e2e8f0', letterSpacing: '0.12em' }}>COMMAND CENTER</div>
          <div className="font-mono text-xs mt-0.5" style={{ color: '#475569', letterSpacing: '0.08em' }}>Real-Time Border Intelligence · {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}</div>
        </div>
        <div className="flex items-center gap-3">
          <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 5, padding: '4px 12px' }}>
            <div className="flex items-center gap-2">
              <span className="status-dot-offline pulse-red" style={{ width: 7, height: 7, borderRadius: '50%', display: 'inline-block' }} />
              <span className="font-rajdhani font-700 text-xs tracking-widest" style={{ color: '#ef4444', fontSize: 11 }}>{criticalAlerts} CRITICAL ACTIVE</span>
            </div>
          </div>
            <div style={{ background: realtime.connected ? 'rgba(34,197,94,0.08)' : 'rgba(245,158,11,0.08)', border: `1px solid ${realtime.connected ? 'rgba(34,197,94,0.2)' : 'rgba(245,158,11,0.2)'}`, borderRadius: 5, padding: '4px 12px' }}>
            <div className="flex items-center gap-2">
              <span className={realtime.connected ? 'status-dot-online blink' : 'status-dot-warning'} style={{ width: 7, height: 7, borderRadius: '50%', display: 'inline-block' }} />
              <span className="font-rajdhani font-700 text-xs tracking-widest" style={{ color: realtime.connected ? '#22c55e' : '#f59e0b', fontSize: 11 }}>{realtime.connected ? 'LIVE DATA LINK' : 'API FALLBACK'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 12 }}>
        <StatCard label="ACTIVE CAMERAS"    value={onlineCams.length} icon={Camera}        accent="cyan"  subtitle={`${liveCameras.length - onlineCams.length} offline`} />
        <StatCard label="PERSONS TRACKED"   value={persons}           icon={Users}         accent="cyan" />
        <StatCard label="VEHICLES TRACKED"  value={vehicles}          icon={Truck}         accent="amber" />
        <StatCard label="ACTIVE INCIDENTS"  value={activeIncidents}   icon={AlertTriangle} accent="red" />
        <StatCard label="CRITICAL ALERTS"   value={criticalAlerts}    icon={Zap}           accent="red"   />
        <StatCard label="SYSTEM FPS"        value={Number(fps).toFixed(1)} unit="fps" icon={Activity} accent="green" />
        <StatCard label="PROCESSING LATENCY" value={Number(latency).toFixed(0)} unit="ms" icon={Clock} accent="cyan" />
      </div>

      {/* Main grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16 }}>

        {/* Left: activity chart + camera status */}
        <div className="space-y-4">
          {/* Activity Chart */}
          <div style={{ background: 'rgba(13,17,23,0.9)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: 20 }}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="font-rajdhani font-700 text-sm tracking-widest" style={{ color: '#94a3b8', letterSpacing: '0.12em' }}>INCIDENT ACTIVITY</div>
                <div className="font-mono text-xs" style={{ color: '#334155', fontSize: 10 }}>Last 8 hours · Auto-refresh every 3s</div>
              </div>
              <div className="flex items-center gap-4">
                {[{ label: 'CRITICAL', color: '#ef4444' }, { label: 'HIGH', color: '#f97316' }, { label: 'MEDIUM', color: '#f59e0b' }].map(l => (
                  <div key={l.label} className="flex items-center gap-1.5">
                    <div style={{ width: 8, height: 2, background: l.color, borderRadius: 1 }} />
                    <span className="font-mono" style={{ color: '#475569', fontSize: 9, letterSpacing: '0.08em' }}>{l.label}</span>
                  </div>
                ))}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={140}>
              <AreaChart data={activityData}>
                <defs>
                  <linearGradient id="gc" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gh" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f97316" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="time" tick={{ fill: '#334155', fontSize: 9, fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#334155', fontSize: 9, fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} width={20} />
                <Tooltip
                  contentStyle={{ background: '#0d1117', border: '1px solid rgba(0,212,255,0.2)', borderRadius: 6, fontFamily: 'JetBrains Mono', fontSize: 11 }}
                  labelStyle={{ color: '#94a3b8' }} itemStyle={{ color: '#e2e8f0' }}
                />
                <Area type="monotone" dataKey="critical" stroke="#ef4444" fill="url(#gc)" strokeWidth={1.5} dot={false} />
                <Area type="monotone" dataKey="high" stroke="#f97316" fill="url(#gh)" strokeWidth={1.5} dot={false} />
                <Line type="monotone" dataKey="medium" stroke="#f59e0b" strokeWidth={1} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Camera Status Grid */}
          <div style={{ background: 'rgba(13,17,23,0.9)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: 20 }}>
            <div className="section-header">CAMERA STATUS OVERVIEW</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {liveCameras.map(c => (
                <div key={c.id} style={{
                  background: c.status === 'offline' ? 'rgba(239,68,68,0.05)' : c.status === 'warning' ? 'rgba(245,158,11,0.05)' : 'rgba(0,212,255,0.03)',
                  border: `1px solid ${c.status === 'offline' ? 'rgba(239,68,68,0.2)' : c.status === 'warning' ? 'rgba(245,158,11,0.2)' : 'rgba(0,212,255,0.1)'}`,
                  borderRadius: 6, padding: 10,
                }}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-rajdhani font-700 text-xs" style={{ color: c.status === 'offline' ? '#ef4444' : '#94a3b8', letterSpacing: '0.08em' }}>{c.id}</span>
                    <span className={`status-dot-${c.status === 'warning' ? 'warning' : c.status}`} style={{ width: 6, height: 6, borderRadius: '50%', display: 'inline-block' }} />
                  </div>
                  <div className="font-mono" style={{ color: '#334155', fontSize: 9 }}>{c.sector.replace('SECTOR ', '')}</div>
                  {c.status !== 'offline' && (
                    <div className="font-mono mt-1" style={{ color: '#475569', fontSize: 9 }}>{c.fps}fps · {c.latency}ms</div>
                  )}
                  {c.status === 'offline' && <div className="font-mono mt-1" style={{ color: '#ef4444', fontSize: 9 }}>DISCONNECTED</div>}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: alerts + metrics */}
        <div className="space-y-4">
          {/* Live Alerts */}
          <div style={{ background: 'rgba(13,17,23,0.9)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: 20 }}>
            <div className="section-header">LIVE ALERT FEED</div>
            <div className="space-y-2">
              {recentAlerts.map((a, i) => (
                <div key={a.id} style={{
                  background: a.severity === 'CRITICAL' ? 'rgba(239,68,68,0.06)' : a.severity === 'HIGH' ? 'rgba(249,115,22,0.06)' : 'rgba(245,158,11,0.04)',
                  border: `1px solid ${a.severity === 'CRITICAL' ? 'rgba(239,68,68,0.25)' : a.severity === 'HIGH' ? 'rgba(249,115,22,0.2)' : 'rgba(245,158,11,0.15)'}`,
                  borderRadius: 6, padding: '10px 12px',
                }}>
                  <div className="flex items-center justify-between mb-1">
                    <span className={`badge-${a.severity.toLowerCase()}`}>{a.severity}</span>
                    <span className="font-mono text-xs" style={{ color: '#334155', fontSize: 10 }}>{a.time}</span>
                  </div>
                  <div className="font-rajdhani font-700 text-xs" style={{ color: '#e2e8f0', letterSpacing: '0.02em' }}>{a.type}</div>
                  <div className="font-mono text-xs mt-0.5" style={{ color: '#475569', fontSize: 10 }}>
                    {a.cam} · {a.track} · Risk {a.risk}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* System Telemetry */}
          <div style={{ background: 'rgba(13,17,23,0.9)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: 20 }}>
            <div className="section-header">SYSTEM TELEMETRY</div>
            {telemetry.map(m => (
              <div key={m.label} className="mb-3">
                <div className="flex justify-between mb-1">
                  <span className="font-mono text-xs" style={{ color: '#475569', fontSize: 10, letterSpacing: '0.08em' }}>{m.label}</span>
                  <span className="font-mono text-xs" style={{ color: m.color, fontSize: 10 }}>{m.val}%</span>
                </div>
                <div style={{ height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min(100, Number(m.val) || 0)}%`, height: '100%', background: m.color, borderRadius: 2, transition: 'width 0.5s ease', opacity: 0.8 }} />
                </div>
              </div>
            ))}
            <div className="mt-3 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex justify-between">
                <span className="font-mono text-xs" style={{ color: '#475569', fontSize: 10 }}>NETWORK</span>
                <span className="font-mono text-xs" style={{ color: '#00d4ff', fontSize: 10 }}>{realtime.health.cameraNetwork.toUpperCase()}</span>
              </div>
              <div className="flex justify-between mt-1">
                <span className="font-mono text-xs" style={{ color: '#475569', fontSize: 10 }}>AI CONFIDENCE</span>
                <span className="font-mono text-xs" style={{ color: '#22c55e', fontSize: 10 }}>{aiHealth?.status?.toUpperCase() || 'UNKNOWN'}</span>
              </div>
            </div>
          </div>

          {/* Threat Summary */}
          <div style={{ background: 'rgba(13,17,23,0.9)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: 20 }}>
            <div className="section-header">THREAT SUMMARY</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {[
                { label: 'INTRUSION', count: realtime.incidents.filter(item => item.type?.toLowerCase().includes('zone')).length, color: '#ef4444' },
                { label: 'LOITERING', count: realtime.incidents.filter(item => item.type?.toLowerCase().includes('loiter')).length, color: '#f97316' },
                { label: 'HIGH RISK', count: realtime.incidents.filter(item => Number(item.risk_score || 0) >= 65 || item.severity === 'HIGH' || item.severity === 'CRITICAL').length, color: '#f59e0b' },
                { label: 'AI EVENTS', count: realtime.incidents.length, color: '#00d4ff' },
              ].map(t => (
                <div key={t.label} style={{ background: `rgba(${t.color === '#ef4444' ? '239,68,68' : t.color === '#f97316' ? '249,115,22' : t.color === '#f59e0b' ? '245,158,11' : '0,212,255'},0.05)`, border: `1px solid ${t.color}22`, borderRadius: 6, padding: '10px 12px' }}>
                  <div className="font-rajdhani font-700" style={{ fontSize: 20, color: t.color }}>{t.count}</div>
                  <div className="font-mono" style={{ color: '#475569', fontSize: 9, letterSpacing: '0.08em' }}>{t.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
