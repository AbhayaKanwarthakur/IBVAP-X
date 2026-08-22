import { useState } from 'react';

type Section = 'appearance' | 'alerts' | 'cameras' | 'risk' | 'notifications' | 'operator';

export default function Settings() {
  const [section, setSection] = useState<Section>('appearance');
  const [saved, setSaved] = useState(false);

  const [appearance, setAppearance] = useState({ theme: 'dark', density: 'comfortable', animations: true, scanlines: true, gridBg: true });
  const [alertThresholds, setAlertThresholds] = useState({ critical: 80, high: 60, medium: 40, alertSound: true, autoEscalate: true });
  const [riskParams, setRiskParams] = useState({ intrusionWeight: 30, loiteringWeight: 20, movementWeight: 15, approachWeight: 20, repeatWeight: 6 });
  const [notifications, setNotifications] = useState({ email: true, sms: false, inApp: true, criticalOnly: false });
  const [operator, setOperator] = useState({ name: 'OP. SHARMA', badge: 'BSF-4421', clearance: 'LEVEL 3', shift: 'NIGHT' });

  const sections: { id: Section; label: string }[] = [
    { id: 'appearance', label: 'APPEARANCE' },
    { id: 'alerts', label: 'ALERT THRESHOLDS' },
    { id: 'cameras', label: 'CAMERA CONFIG' },
    { id: 'risk', label: 'RISK PARAMETERS' },
    { id: 'notifications', label: 'NOTIFICATIONS' },
    { id: 'operator', label: 'OPERATOR SETTINGS' },
  ];

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
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
              <div className="font-mono mb-4" style={{ color: '#475569', fontSize: 10, lineHeight: 1.6 }}>Adjust the weight each factor contributes to the overall risk score. Total weights determine relative contribution to final score out of 100.</div>
              <Slider label="RESTRICTED ZONE INTRUSION WEIGHT" val={riskParams.intrusionWeight} min={0} max={50} onChange={(v: number) => setRiskParams(r => ({ ...r, intrusionWeight: v }))} color="#ef4444" />
              <Slider label="LOITERING WEIGHT" val={riskParams.loiteringWeight} min={0} max={40} onChange={(v: number) => setRiskParams(r => ({ ...r, loiteringWeight: v }))} color="#f97316" />
              <Slider label="UNUSUAL MOVEMENT WEIGHT" val={riskParams.movementWeight} min={0} max={30} onChange={(v: number) => setRiskParams(r => ({ ...r, movementWeight: v }))} color="#f59e0b" />
              <Slider label="SENSITIVE ZONE APPROACH WEIGHT" val={riskParams.approachWeight} min={0} max={40} onChange={(v: number) => setRiskParams(r => ({ ...r, approachWeight: v }))} color="#f97316" />
              <Slider label="REPEATED ACTIVITY WEIGHT" val={riskParams.repeatWeight} min={0} max={20} onChange={(v: number) => setRiskParams(r => ({ ...r, repeatWeight: v }))} color="#00d4ff" />
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
              <div className="font-mono" style={{ color: '#475569', fontSize: 11, marginBottom: 16 }}>Configure recording quality, retention, and detection sensitivity per camera.</div>
              {[
                { label: 'RECORDING QUALITY', options: ['720p', '1080p', '4K'], current: '1080p' },
                { label: 'FRAME RATE', options: ['15fps', '24fps', '30fps'], current: '30fps' },
                { label: 'RETENTION PERIOD', options: ['7 days', '30 days', '90 days'], current: '30 days' },
              ].map(s => (
                <div key={s.label} className="mb-5">
                  <div className="font-mono text-xs mb-2" style={{ color: '#64748b', fontSize: 11, letterSpacing: '0.08em' }}>{s.label}</div>
                  <div className="flex gap-2">
                    {s.options.map(o => (
                      <button key={o} style={{ padding: '8px 16px', borderRadius: 5, cursor: 'pointer', background: s.current === o ? 'rgba(0,212,255,0.1)' : 'rgba(255,255,255,0.03)', border: `1px solid ${s.current === o ? 'rgba(0,212,255,0.3)' : 'rgba(255,255,255,0.08)'}`, color: s.current === o ? '#00d4ff' : '#64748b', fontFamily: 'Rajdhani', fontWeight: 700, fontSize: 12, letterSpacing: '0.06em' }}>
                        {o}
                      </button>
                    ))}
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
