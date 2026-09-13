import { useEffect, useState } from 'react';
import { apiUrl } from '../api/client'

type Section = 'appearance' | 'alerts' | 'cameras' | 'risk' | 'notifications' | 'operator' | 'zones';

export default function Settings() {
  const [section, setSection] = useState<Section>('appearance');
  const [saved, setSaved] = useState(false);

  const [appearance, setAppearance] = useState({ theme: 'dark', density: 'comfortable', animations: true, scanlines: true, gridBg: true });
  const [alertThresholds, setAlertThresholds] = useState({ critical: 80, high: 60, medium: 40, alertSound: true, autoEscalate: true });
  const [riskParams, setRiskParams] = useState({ anomaly: 45, restricted_zone_entry: 30, loitering: 20, running: 20, abandoned_object: 35, activity_anomaly_rtfm: 40, suspicious_objects: 35 });
  const [notifications, setNotifications] = useState({ email: true, sms: false, inApp: true, criticalOnly: false });
  const [operator, setOperator] = useState({ name: 'OP. SHARMA', badge: 'BSF-4421', clearance: 'LEVEL 3', shift: 'NIGHT' });
  const [aiConfig, setAiConfig] = useState<any>(null)
  const [authorizedPlates, setAuthorizedPlates] = useState<string[]>([])
  const [newPlate, setNewPlate] = useState('')
  const [cameras, setCameras] = useState<any[]>([])
  const [camSaved, setCamSaved] = useState<Record<string, boolean>>({})

  useEffect(() => {
    fetch(apiUrl('/api/ai/health')).then(r => r.json()).then(d => setAiConfig(d)).catch(() => {})
    fetch(apiUrl('/api/authorized-plates')).then(r => r.json()).then(d => setAuthorizedPlates(d.data || [])).catch(() => {})
    fetch(apiUrl('/api/cameras')).then(r => r.json()).then(d => setCameras(d.data || [])).catch(() => {})
    fetch(apiUrl('/api/settings')).then(r => r.json()).then(d => {
      const settings = d.data || {}
      if (settings.appearance) setAppearance(a => ({ ...a, ...settings.appearance }))
      if (settings.alertThresholds) setAlertThresholds(a => ({ ...a, ...settings.alertThresholds }))
      if (settings.riskParams) setRiskParams(r => ({ ...r, ...settings.riskParams }))
      if (settings.notifications) setNotifications(n => ({ ...n, ...settings.notifications }))
      if (settings.operator) setOperator(o => ({ ...o, ...settings.operator }))
    }).catch(() => {})
  }, [])

  const patchCamera = async (id: string, patch: Record<string, unknown>) => {
    const r = await fetch(apiUrl(`/api/cameras/${id}`), {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', 'X-Operator-Id': 'settings' },
      body: JSON.stringify(patch)
    })
    if (!r.ok) return
    const d = await r.json()
    setCameras(prev => prev.map(c => c.id === id ? d.data : c))
    setCamSaved(prev => ({ ...prev, [id]: true }))
    setTimeout(() => setCamSaved(prev => ({ ...prev, [id]: false })), 2000)
  }

  const sections: { id: Section; label: string }[] = [
    { id: 'appearance', label: 'APPEARANCE' },
    { id: 'alerts', label: 'ALERT THRESHOLDS' },
    { id: 'cameras', label: 'CAMERA CONFIG' },
    { id: 'risk', label: 'RISK PARAMETERS' },
    { id: 'zones', label: 'ZONE CONFIG' },
    { id: 'notifications', label: 'NOTIFICATIONS' },
    { id: 'operator', label: 'OPERATOR SETTINGS' },
  ];

  const handleSave = async () => {
    const response = await fetch(apiUrl('/api/settings'), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'X-Operator-Id': 'settings' },
      body: JSON.stringify({ appearance, alertThresholds, riskParams, notifications, operator }),
    }).catch(() => null)
    if (!response?.ok) return
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  };

  const Toggle = ({ val, onChange }: { val: boolean; onChange: (v: boolean) => void }) => (
    <button onClick={() => onChange(!val)} style={{
      width: 40, height: 22, borderRadius: 11, cursor: 'pointer', border: 'none', position: 'relative',
      background: val ? 'rgba(0,212,255,0.35)' : 'rgba(255,255,255,0.08)', transition: 'background 0.2s',
    }}>
      <div style={{ width: 16, height: 16, borderRadius: '50%', background: val ? '#00d4ff' : '#334155', position: 'absolute', top: 3, left: val ? 20 : 3, transition: 'left 0.2s' }} />
    </button>
  );

  const Slider = ({ label, val, min, max, onChange, color = '#00d4ff' }: any) => (
    <div className="mb-4">
      <div className="flex justify-between mb-2">
        <span className="font-mono text-xs" style={{ color: '#64748b', fontSize: 11 }}>{label}</span>
        <span className="font-mono text-xs" style={{ color, fontSize: 11, fontWeight: 700 }}>{val}</span>
      </div>
      <input type="range" min={min} max={max} value={val} onChange={e => onChange(Number(e.target.value))}
        style={{ width: '100%', accentColor: color }} />
    </div>
  );

  return (
    <div className="p-5 space-y-5 fade-in">
      <div className="flex items-end justify-between">
        <div>
          <div className="font-rajdhani font-700 tracking-widest" style={{ fontSize: 20, color: '#e2e8f0', letterSpacing: '0.12em' }}>SETTINGS</div>
          <div className="font-mono text-xs" style={{ color: '#475569' }}>System Configuration · Operator Preferences</div>
        </div>
        <button onClick={handleSave} style={{
          background: saved ? 'rgba(34,197,94,0.15)' : 'rgba(0,212,255,0.12)',
          border: `1px solid ${saved ? 'rgba(34,197,94,0.4)' : 'rgba(0,212,255,0.3)'}`,
          color: saved ? '#22c55e' : '#00d4ff',
          padding: '8px 24px', borderRadius: 6, cursor: 'pointer',
          fontFamily: 'Rajdhani', fontWeight: 700, fontSize: 13, letterSpacing: '0.08em',
          transition: 'all 0.3s',
        }}>{saved ? '✓ SAVED' : 'SAVE CHANGES'}</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 16 }}>
        {/* Nav */}
        <div style={{ background: 'rgba(13,17,23,0.9)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: 8 }}>
          {sections.map(s => (
            <button key={s.id} onClick={() => setSection(s.id)}
              className="nav-item w-full text-left"
              style={section === s.id ? { color: '#00d4ff', background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.2)' } : {}}>
              {s.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ background: 'rgba(13,17,23,0.9)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: 24 }}>

          {section === 'appearance' && (
            <div>
              <div className="section-header">APPEARANCE SETTINGS</div>
              <div className="space-y-5">
                <div>
                  <div className="font-mono text-xs mb-3" style={{ color: '#64748b', fontSize: 11 }}>THEME</div>
                  <div className="flex gap-3">
                    {['dark', 'darker', 'midnight'].map(t => (
                      <button key={t} onClick={() => setAppearance(a => ({ ...a, theme: t }))}
                        style={{ padding: '10px 20px', borderRadius: 6, cursor: 'pointer', background: appearance.theme === t ? 'rgba(0,212,255,0.1)' : 'rgba(255,255,255,0.03)', border: `1px solid ${appearance.theme === t ? 'rgba(0,212,255,0.3)' : 'rgba(255,255,255,0.08)'}`, color: appearance.theme === t ? '#00d4ff' : '#64748b', fontFamily: 'Rajdhani', fontWeight: 700, fontSize: 12, letterSpacing: '0.06em' }}>
                        {t.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="font-mono text-xs mb-3" style={{ color: '#64748b', fontSize: 11 }}>INFORMATION DENSITY</div>
                  <div className="flex gap-3">
                    {['compact', 'comfortable', 'spacious'].map(d => (
                      <button key={d} onClick={() => setAppearance(a => ({ ...a, density: d }))}
                        style={{ padding: '10px 20px', borderRadius: 6, cursor: 'pointer', background: appearance.density === d ? 'rgba(0,212,255,0.1)' : 'rgba(255,255,255,0.03)', border: `1px solid ${appearance.density === d ? 'rgba(0,212,255,0.3)' : 'rgba(255,255,255,0.08)'}`, color: appearance.density === d ? '#00d4ff' : '#64748b', fontFamily: 'Rajdhani', fontWeight: 700, fontSize: 12, letterSpacing: '0.06em' }}>
                        {d.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>
                {[
                  { label: 'Animations & Transitions', key: 'animations' },
                  { label: 'CRT Scanline Effect', key: 'scanlines' },
                  { label: 'Tactical Grid Background', key: 'gridBg' },
                ].map(opt => (
                  <div key={opt.key} className="flex items-center justify-between py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <span className="font-mono text-xs" style={{ color: '#64748b', fontSize: 12 }}>{opt.label}</span>
                    <Toggle val={appearance[opt.key as keyof typeof appearance] as boolean} onChange={v => setAppearance(a => ({ ...a, [opt.key]: v }))} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {section === 'alerts' && (
            <div>
              <div className="section-header">ALERT THRESHOLD CONFIGURATION</div>
              <Slider label="CRITICAL THRESHOLD" val={alertThresholds.critical} min={50} max={100} onChange={(v: number) => setAlertThresholds(a => ({ ...a, critical: v }))} color="#ef4444" />
              <Slider label="HIGH THRESHOLD" val={alertThresholds.high} min={30} max={90} onChange={(v: number) => setAlertThresholds(a => ({ ...a, high: v }))} color="#f97316" />
              <Slider label="MEDIUM THRESHOLD" val={alertThresholds.medium} min={10} max={60} onChange={(v: number) => setAlertThresholds(a => ({ ...a, medium: v }))} color="#f59e0b" />
              {[
                { label: 'Alert Sound', key: 'alertSound' },
                { label: 'Auto-Escalate Critical Alerts', key: 'autoEscalate' },
              ].map(opt => (
                <div key={opt.key} className="flex items-center justify-between py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <span className="font-mono text-xs" style={{ color: '#64748b', fontSize: 12 }}>{opt.label}</span>
                  <Toggle val={alertThresholds[opt.key as keyof typeof alertThresholds] as boolean} onChange={v => setAlertThresholds(a => ({ ...a, [opt.key]: v }))} />
                </div>
              ))}
            </div>
          )}

          {section === 'risk' && (
            <div>
              <div className="section-header">RISK ENGINE PARAMETERS</div>
              <div className="font-mono mb-4" style={{ color: '#475569', fontSize: 10, lineHeight: 1.6 }}>These operator preferences are persisted by the Node API. They do not change the active AI model weights.</div>
              <Slider label="ANOMALY (FRAME MOTION)" val={riskParams.anomaly} min={0} max={100} onChange={(v: number) => setRiskParams(r => ({ ...r, anomaly: v }))} color="#f59e0b" />
              <Slider label="RESTRICTED ZONE ENTRY" val={riskParams.restricted_zone_entry} min={0} max={100} onChange={(v: number) => setRiskParams(r => ({ ...r, restricted_zone_entry: v }))} color="#ef4444" />
              <Slider label="LOITERING" val={riskParams.loitering} min={0} max={100} onChange={(v: number) => setRiskParams(r => ({ ...r, loitering: v }))} color="#f97316" />
              <Slider label="RUNNING" val={riskParams.running} min={0} max={100} onChange={(v: number) => setRiskParams(r => ({ ...r, running: v }))} color="#f59e0b" />
              <Slider label="ABANDONED OBJECT" val={riskParams.abandoned_object} min={0} max={100} onChange={(v: number) => setRiskParams(r => ({ ...r, abandoned_object: v }))} color="#ef4444" />
              <Slider label="RTFM VISUAL ANOMALY" val={riskParams.activity_anomaly_rtfm} min={0} max={100} onChange={(v: number) => setRiskParams(r => ({ ...r, activity_anomaly_rtfm: v }))} color="#38bdf8" />
              <Slider label="SUSPICIOUS OBJECTS" val={riskParams.suspicious_objects} min={0} max={100} onChange={(v: number) => setRiskParams(r => ({ ...r, suspicious_objects: v }))} color="#f43f5e" />
              {aiConfig && <div className="mt-4 border border-white/10 p-3"><div className="font-mono text-[9px] text-slate-500 mb-2">LIVE AI SERVICE STATUS</div><div className="font-mono text-[10px] text-slate-300">YOLO: {aiConfig.models?.yolo?.split('\\').pop()} · RTFM: {aiConfig.models?.rtfm} · PLATE: {aiConfig.models?.plate}</div></div>}
            </div>
          )}

          {section === 'zones' && (
            <div>
              <div className="section-header">ZONE CONFIGURATION</div>
              <div className="font-mono mb-3" style={{ color: '#475569', fontSize: 10, lineHeight: 1.6 }}>Zones are defined in ai/config.json under zone_engine.zones. Active zones from the running AI service are shown below.</div>
              {aiConfig?.config?.zone_engine?.zones?.length > 0
                ? aiConfig.config.zone_engine.zones.map((z: any, i: number) => <div key={i} className="mb-2 border border-white/10 p-3"><div className="flex justify-between"><span className="font-mono text-[11px] text-cyan-300">{z.name?.toUpperCase()}</span><span className="font-mono text-[9px]" style={{ color: z.rule === 'restricted' ? '#ef4444' : '#f59e0b' }}>{z.rule?.toUpperCase()}</span></div><div className="font-mono text-[9px] text-slate-500 mt-1">{z.polygon?.length} vertices{z.suppress_rtfm ? ' · RTFM SUPPRESSED' : ''}</div></div>)
                : <div className="border border-white/10 p-4">
                    <div className="font-mono text-[10px] text-slate-400 mb-3">3 default zones active in ai/config.json:</div>
                    {[{name:'ARMORY',rule:'RESTRICTED',desc:'Top-left quadrant'},{name:'COMMAND POST',rule:'RESTRICTED',desc:'Top-right quadrant'},{name:'PERIMETER',rule:'LOITER (20s)',desc:'Full frame'}].map((z,i) => <div key={i} className="mb-2 flex justify-between border-b border-white/5 pb-2"><span className="font-mono text-[10px] text-cyan-300">{z.name} <span className="text-slate-500">· {z.desc}</span></span><span className="font-mono text-[9px]" style={{color: z.rule.includes('RESTRICTED') ? '#ef4444':'#f59e0b'}}>{z.rule}</span></div>)}
                    <div className="font-mono text-[9px] text-slate-500 mt-3">Edit polygon coordinates in ai/config.json to match your actual camera view.</div>
                  </div>
              }
              <div className="mt-4 border border-white/10 p-3">
                <div className="section-header mb-3">AUTHORIZED VEHICLE PLATES</div>
                <div className="font-mono text-[9px] text-slate-500 mb-3">Plates on this list are tagged AUTHORIZED in the license plate log.</div>
                <div className="flex gap-2 mb-3">
                  <input value={newPlate} onChange={e => setNewPlate(e.target.value.toUpperCase())} placeholder="e.g. DL7CR2146" className="flex-1 bg-black/30 border border-white/10 p-2 font-mono text-[11px] text-slate-200" />
                  <button className="btn-primary" onClick={async () => {
                    if (!newPlate) return
                    await fetch(apiUrl('/api/authorized-plates'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ plate: newPlate }) })
                    setAuthorizedPlates(p => [...p, newPlate]); setNewPlate('')
                  }}>ADD</button>
                </div>
                {authorizedPlates.map(p => <div key={p} className="flex justify-between items-center border-b border-white/5 py-1.5">
                  <span className="font-mono text-[11px] text-amber-300">{p}</span>
                  <button className="font-mono text-[9px] text-red-400 hover:text-red-300" onClick={async () => {
                    await fetch(apiUrl('/api/authorized-plates'), { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ plate: p }) })
                    setAuthorizedPlates(plates => plates.filter(x => x !== p))
                  }}>REMOVE</button>
                </div>)}
                {authorizedPlates.length === 0 && <div className="font-mono text-[10px] text-slate-500">No authorized plates. Add plates above.</div>}
              </div>
            </div>
          )}

          {section === 'notifications' && (
            <div>
              <div className="section-header">NOTIFICATION SETTINGS</div>
              {[
                { label: 'In-App Notifications', key: 'inApp' },
                { label: 'Email Alerts', key: 'email' },
                { label: 'SMS Alerts', key: 'sms' },
                { label: 'Critical Incidents Only', key: 'criticalOnly' },
              ].map(opt => (
                <div key={opt.key} className="flex items-center justify-between py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <div>
                    <div className="font-mono text-xs" style={{ color: '#94a3b8', fontSize: 12 }}>{opt.label}</div>
                  </div>
                  <Toggle val={notifications[opt.key as keyof typeof notifications] as boolean} onChange={v => setNotifications(n => ({ ...n, [opt.key]: v }))} />
                </div>
              ))}
            </div>
          )}

          {section === 'operator' && (
            <div>
              <div className="section-header">OPERATOR PROFILE</div>
              <div className="space-y-4">
                {[
                  { label: 'OPERATOR NAME', key: 'name' },
                  { label: 'BADGE NUMBER', key: 'badge' },
                  { label: 'CLEARANCE LEVEL', key: 'clearance' },
                  { label: 'SHIFT', key: 'shift' },
                ].map(f => (
                  <div key={f.key}>
                    <div className="font-mono text-xs mb-1.5" style={{ color: '#475569', fontSize: 10, letterSpacing: '0.08em' }}>{f.label}</div>
                    <input
                      value={operator[f.key as keyof typeof operator]}
                      onChange={e => setOperator(o => ({ ...o, [f.key]: e.target.value }))}
                      style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '10px 14px', color: '#e2e8f0', fontFamily: 'JetBrains Mono', fontSize: 13, outline: 'none' }}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {section === 'cameras' && (
            <div>
              <div className="section-header">CAMERA CONFIGURATION</div>
              <div className="font-mono mb-4" style={{ color: '#475569', fontSize: 10, lineHeight: 1.6 }}>
                Mark cameras covering sensitive areas (armories, vaults, restricted zones). Plates captured by sensitive cameras are tagged SENSITIVE in the license plate log and can be filtered separately.
              </div>
              {cameras.length === 0 && <div className="font-mono text-slate-500" style={{ fontSize: 10 }}>No cameras registered.</div>}
              {cameras.map(cam => (
                <div key={cam.id} className="mb-3 border border-white/10 p-3" style={{ borderRadius: 6 }}>
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <span className="font-mono" style={{ fontSize: 12, color: '#e2e8f0' }}>{cam.id}</span>
                      <span className="font-mono ml-2" style={{ fontSize: 10, color: '#475569' }}>{cam.sector}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {camSaved[cam.id] && <span className="font-mono" style={{ fontSize: 9, color: '#22c55e' }}>SAVED ✓</span>}
                      <span className="font-mono" style={{ fontSize: 9, color: cam.status === 'online' ? '#22c55e' : '#475569' }}>{cam.status?.toUpperCase()}</span>
                    </div>
                  </div>
                  <div className="mb-2">
                    <div className="font-mono mb-1" style={{ fontSize: 9, color: '#64748b' }}>LOCATION NAME (shown on plate records)</div>
                    <input
                      defaultValue={cam.locationName || ''}
                      onBlur={e => { if (e.target.value !== (cam.locationName || '')) patchCamera(cam.id, { locationName: e.target.value }) }}
                      placeholder="e.g. North Gate, Armory Block A"
                      className="w-full bg-black/30 border border-white/10 px-2 py-1.5 font-mono text-slate-200 focus:outline-none focus:border-cyan-400/50"
                      style={{ fontSize: 11 }}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-mono" style={{ fontSize: 10, color: '#94a3b8' }}>SENSITIVE AREA</div>
                      <div className="font-mono" style={{ fontSize: 9, color: '#475569' }}>Plates from this camera tagged SENSITIVE in log</div>
                    </div>
                    <Toggle val={Boolean(cam.sensitiveArea)} onChange={v => patchCamera(cam.id, { sensitiveArea: v })} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
