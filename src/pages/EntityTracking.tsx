import { useState } from 'react';
import { persons, vehicles } from '../data/mockData';

type Tab = 'persons' | 'vehicles' | 'anpr' | 'crowd';

export default function EntityTracking() {
  const [tab, setTab] = useState<Tab>('persons');
  const [selectedPerson, setSelectedPerson] = useState(persons[0]);
  const [selectedVehicle, setSelectedVehicle] = useState(vehicles[0]);

  const tabs: { id: Tab; label: string }[] = [
    { id: 'persons', label: 'PERSON TRACKING' },
    { id: 'vehicles', label: 'VEHICLE TRACKING' },
    { id: 'anpr', label: 'ANPR MODULE' },
    { id: 'crowd', label: 'CROWD ANALYSIS' },
  ];

  return (
    <div className="p-5 space-y-5 fade-in">
      <div>
        <div className="font-rajdhani font-700 tracking-widest" style={{ fontSize: 20, color: '#e2e8f0', letterSpacing: '0.12em' }}>ENTITY TRACKING</div>
        <div className="font-mono text-xs" style={{ color: '#475569' }}>Person · Vehicle · ANPR · Crowd Intelligence</div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 7, padding: 4, width: 'fit-content' }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{
              padding: '7px 18px', borderRadius: 5, cursor: 'pointer',
              background: tab === t.id ? 'rgba(0,212,255,0.12)' : 'none',
              border: tab === t.id ? '1px solid rgba(0,212,255,0.25)' : '1px solid transparent',
              color: tab === t.id ? '#00d4ff' : '#64748b',
              fontFamily: 'Rajdhani', fontWeight: 700, fontSize: 12, letterSpacing: '0.06em',
            }}>{t.label}</button>
        ))}
      </div>

      {/* Persons tab */}
      {tab === 'persons' && (
        <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 16 }}>
          {/* Person list */}
          <div style={{ background: 'rgba(13,17,23,0.9)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: 16 }}>
            <div className="section-header">TRACKED PERSONS</div>
            <div className="space-y-2">
              {persons.map(p => (
                <button key={p.id} onClick={() => setSelectedPerson(p)} className="w-full text-left rounded-lg"
                  style={{
                    background: selectedPerson.id === p.id ? 'rgba(0,212,255,0.08)' : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${selectedPerson.id === p.id ? 'rgba(0,212,255,0.25)' : 'rgba(255,255,255,0.06)'}`,
                    padding: '10px 12px', cursor: 'pointer',
                  }}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-xs font-700" style={{ color: '#e2e8f0', fontSize: 11 }}>{p.id}</span>
                    <span className={`badge-${p.status.toLowerCase()}`}>{p.status}</span>
                  </div>
                  <div className="font-mono text-xs" style={{ color: '#475569', fontSize: 10 }}>{p.cam} · Risk {p.risk}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Person detail */}
          <div className="space-y-4">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {/* Profile */}
              <div style={{ background: 'rgba(13,17,23,0.9)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: 20 }}>
                <div className="section-header">ENTITY PROFILE</div>
                <div className="flex items-center gap-4 mb-4">
                  <div style={{ width: 60, height: 60, borderRadius: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {selectedPerson.faceAvailable ? (
                      <div style={{ width: 50, height: 50, borderRadius: 6, background: 'rgba(0,212,255,0.08)' }} />
                    ) : (
                      <div className="text-center">
                        <div style={{ fontSize: 18 }}>❓</div>
                        <div className="font-mono" style={{ color: '#475569', fontSize: 8 }}>N/A</div>
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="font-rajdhani font-700 text-sm" style={{ color: '#e2e8f0', letterSpacing: '0.08em' }}>{selectedPerson.id}</div>
                    <div className="font-mono text-xs" style={{ color: '#475569', fontSize: 10 }}>
                      {selectedPerson.faceAvailable ? 'FACE AVAILABLE' : 'FACE NOT AVAILABLE'}
                    </div>
                    <span className={`badge-${selectedPerson.status.toLowerCase()}`} style={{ marginTop: 4, display: 'inline-block' }}>{selectedPerson.status}</span>
                  </div>
                </div>
                {[
                  { label: 'TYPE', value: selectedPerson.type },
                  { label: 'APPEARANCE', value: selectedPerson.appearance },
                  { label: 'MOVEMENT', value: selectedPerson.movement },
                  { label: 'LOITERING', value: `${selectedPerson.loitering} seconds` },
                  { label: 'LOCATION', value: selectedPerson.sector },
                  { label: 'RISK SCORE', value: `${selectedPerson.risk}/100` },
                  { label: 'CAMERA', value: selectedPerson.cam },
                ].map(m => (
                  <div key={m.label} className="flex justify-between py-1.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <span className="font-mono text-xs" style={{ color: '#475569', fontSize: 10, letterSpacing: '0.06em' }}>{m.label}</span>
                    <span className="font-mono text-xs" style={{ color: m.label === 'RISK SCORE' && selectedPerson.risk > 70 ? '#ef4444' : '#94a3b8', fontSize: 10 }}>{m.value}</span>
                  </div>
                ))}
              </div>

              {/* Face Occlusion */}
              <div style={{ background: 'rgba(13,17,23,0.9)', border: '1px solid rgba(0,212,255,0.12)', borderRadius: 8, padding: 20 }}>
                <div className="section-header">RE-ID STATUS</div>
                {!selectedPerson.faceAvailable ? (
                  <>
                    <div style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 6, padding: 12, marginBottom: 16 }}>
                      <div className="flex items-center gap-2">
                        <span className="status-dot-offline blink" style={{ width: 7, height: 7, borderRadius: '50%', display: 'inline-block' }} />
                        <span className="font-rajdhani font-700 text-xs" style={{ color: '#ef4444', letterSpacing: '0.1em' }}>FACE OCCLUDED</span>
                      </div>
                    </div>
                    {[
                      { label: 'Appearance Similarity', v: 87 },
                      { label: 'Trajectory Consistency', v: 94, text: 'HIGH' },
                      { label: 'Cross-Camera Continuity', v: 89 },
                    ].map(m => (
                      <div key={m.label} className="mb-3">
                        <div className="flex justify-between mb-1">
                          <span className="font-mono text-xs" style={{ color: '#64748b', fontSize: 10 }}>{m.label}</span>
                          <span className="font-mono text-xs" style={{ color: '#00d4ff', fontSize: 10 }}>{m.text || `${m.v}%`}</span>
                        </div>
                        <div style={{ height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 2 }}>
                          <div style={{ width: `${m.v}%`, height: '100%', background: '#00d4ff', borderRadius: 2 }} />
                        </div>
                      </div>
                    ))}
                    <div className="text-center mt-4 p-3 rounded" style={{ background: 'rgba(0,212,255,0.05)', border: '1px solid rgba(0,212,255,0.15)' }}>
                      <div className="font-rajdhani font-700 text-xs" style={{ color: '#00d4ff', letterSpacing: '0.08em' }}>FACE-INDEPENDENT TRACKING ACTIVE</div>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-center h-40">
                    <div className="text-center">
                      <div style={{ fontSize: 28, marginBottom: 8 }}>✓</div>
                      <div className="font-rajdhani font-700 text-xs" style={{ color: '#22c55e', letterSpacing: '0.1em' }}>FACE DETECTED</div>
                      <div className="font-mono text-xs mt-1" style={{ color: '#475569', fontSize: 10 }}>Standard facial tracking active</div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Multi-camera trail */}
            <div style={{ background: 'rgba(13,17,23,0.9)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: 20 }}>
              <div className="section-header">MULTI-CAMERA TRACKING TRAIL</div>
              <div className="flex items-start gap-0">
                {['CAM-01', 'CAM-04', 'CAM-07', 'CAM-09'].map((c, i) => (
                  <div key={c} className="flex-1 flex flex-col items-center">
                    <div style={{ width: 40, height: 40, borderRadius: 8, background: i === 1 ? 'rgba(239,68,68,0.12)' : 'rgba(0,212,255,0.08)', border: `1px solid ${i === 1 ? 'rgba(239,68,68,0.3)' : 'rgba(0,212,255,0.2)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span className="font-mono" style={{ fontSize: 9, color: i === 1 ? '#ef4444' : '#00d4ff' }}>📹</span>
                    </div>
                    <div className="font-rajdhani font-700 text-xs mt-2 text-center" style={{ color: '#94a3b8' }}>{c}</div>
                    <div className="font-mono text-center" style={{ color: '#334155', fontSize: 9 }}>Match {89 - i * 2}%</div>
                    <div className="font-mono text-center" style={{ color: '#475569', fontSize: 9 }}>0{i}:{10 + i * 4}:00</div>
                    {i < 3 && (
                      <div style={{ position: 'relative', width: '100%', height: 2, background: 'rgba(0,212,255,0.2)', marginTop: -26, zIndex: -1 }} />
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-4 p-3 rounded text-center" style={{ background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.2)' }}>
                <div className="font-mono text-xs" style={{ color: '#f59e0b', fontSize: 10 }}>POSSIBLE SAME ENTITY · Appearance Match 89% · Temporal Consistency HIGH · NOT CONFIRMED IDENTITY</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Vehicles tab */}
      {tab === 'vehicles' && (
        <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 16 }}>
          <div style={{ background: 'rgba(13,17,23,0.9)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: 16 }}>
            <div className="section-header">TRACKED VEHICLES</div>
            <div className="space-y-2">
              {vehicles.map(v => (
                <button key={v.id} onClick={() => setSelectedVehicle(v)} className="w-full text-left rounded-lg"
                  style={{
                    background: selectedVehicle.id === v.id ? 'rgba(0,212,255,0.08)' : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${selectedVehicle.id === v.id ? 'rgba(0,212,255,0.25)' : 'rgba(255,255,255,0.06)'}`,
                    padding: '10px 12px', cursor: 'pointer',
                  }}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-xs font-700" style={{ color: '#e2e8f0', fontSize: 11 }}>{v.id}</span>
                    <span className={`badge-${v.status === 'AUTHORIZED' ? 'low' : v.status === 'WATCHLIST' ? 'critical' : 'medium'}`}>{v.status}</span>
                  </div>
                  <div className="font-mono text-xs" style={{ color: '#475569', fontSize: 10 }}>{v.plate} · {v.cam}</div>
                </button>
              ))}
            </div>
          </div>
          <div style={{ background: 'rgba(13,17,23,0.9)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: 20 }}>
            <div className="section-header">VEHICLE PROFILE · {selectedVehicle.id}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
              <div>
                {[
                  { label: 'PLATE', value: selectedVehicle.plate, highlight: true },
                  { label: 'CONFIDENCE', value: `${selectedVehicle.confidence}%` },
                  { label: 'TYPE', value: selectedVehicle.type },
                  { label: 'COLOR', value: selectedVehicle.color },
                  { label: 'CAMERA', value: selectedVehicle.cam },
                  { label: 'TIMESTAMP', value: selectedVehicle.time },
                  { label: 'STATUS', value: selectedVehicle.status },
                  { label: 'TOTAL DISTANCE', value: selectedVehicle.distance + ' km' },
                  { label: 'TIME TRACKED', value: selectedVehicle.duration },
                ].map(m => (
                  <div key={m.label} className="flex justify-between py-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <span className="font-mono text-xs" style={{ color: '#475569', fontSize: 10, letterSpacing: '0.06em' }}>{m.label}</span>
                    <span className="font-mono text-xs font-700" style={{ color: m.highlight ? '#00d4ff' : '#94a3b8', fontSize: m.highlight ? 13 : 10 }}>{m.value}</span>
                  </div>
                ))}
              </div>
              <div>
                <div className="section-header">CAMERA TRAIL</div>
                {['CAM-02', 'CAM-04', 'CAM-06'].map((c, i) => (
                  <div key={c} className="flex items-center gap-3 mb-3">
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b', flexShrink: 0 }} />
                    <div>
                      <div className="font-rajdhani font-700 text-xs" style={{ color: '#94a3b8' }}>{c}</div>
                      <div className="font-mono" style={{ color: '#334155', fontSize: 9 }}>0{i}:{30 + i * 14}:00</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ANPR tab */}
      {tab === 'anpr' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
          {vehicles.map(v => (
            <div key={v.id} style={{ background: 'rgba(13,17,23,0.9)', border: `1px solid ${v.status === 'WATCHLIST' ? 'rgba(239,68,68,0.25)' : v.status === 'AUTHORIZED' ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.07)'}`, borderRadius: 8, padding: 20 }}>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="font-rajdhani font-700 text-sm" style={{ color: '#e2e8f0', letterSpacing: '0.06em' }}>{v.id}</div>
                  <div className="font-mono mt-1" style={{ color: '#475569', fontSize: 10 }}>{v.cam} · {v.time}</div>
                </div>
                <span className={`badge-${v.status === 'AUTHORIZED' ? 'low' : v.status === 'WATCHLIST' ? 'critical' : 'medium'}`}>{v.status}</span>
              </div>
              {/* Plate */}
              <div className="text-center mb-4 py-4 rounded-lg" style={{ background: 'rgba(245,158,11,0.05)', border: '2px solid rgba(245,158,11,0.25)' }}>
                <div className="font-rajdhani font-700" style={{ fontSize: 28, color: '#f59e0b', letterSpacing: '0.2em' }}>{v.plate}</div>
                <div className="font-mono mt-1" style={{ color: '#475569', fontSize: 10 }}>ANPR CONFIDENCE: {v.confidence}%</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                <div style={{ textAlign: 'center', padding: '8px 0' }}>
                  <div className="font-rajdhani font-700 text-sm" style={{ color: '#e2e8f0' }}>{v.type}</div>
                  <div className="font-mono" style={{ color: '#475569', fontSize: 9 }}>TYPE</div>
                </div>
                <div style={{ textAlign: 'center', padding: '8px 0' }}>
                  <div className="font-rajdhani font-700 text-sm" style={{ color: '#e2e8f0' }}>{v.color}</div>
                  <div className="font-mono" style={{ color: '#475569', fontSize: 9 }}>COLOR</div>
                </div>
                <div style={{ textAlign: 'center', padding: '8px 0' }}>
                  <div className="font-rajdhani font-700 text-sm" style={{ color: '#e2e8f0' }}>{v.distance}km</div>
                  <div className="font-mono" style={{ color: '#475569', fontSize: 9 }}>DISTANCE</div>
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <button className="btn-ghost text-xs" style={{ flex: 1, padding: '5px 0' }}>VIEW HISTORY</button>
                {v.status === 'WATCHLIST' && <button className="btn-danger text-xs" style={{ flex: 1, padding: '5px 0' }}>ESCALATE</button>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Crowd tab */}
      {tab === 'crowd' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 16 }}>
          <div style={{ background: 'rgba(13,17,23,0.9)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: 20 }}>
            <div className="section-header">CROWD ANALYSIS · CAM-09 · SECTOR CENTRAL</div>
            {/* Simulated crowd heatmap */}
            <div style={{ background: '#040608', borderRadius: 8, aspectRatio: '16/9', position: 'relative', overflow: 'hidden', marginBottom: 16 }}>
              <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 30% 40%, #001a10 0%, #040608 80%)' }} />
              {/* Heat blobs */}
              {[
                { x: 30, y: 35, size: 80, opacity: 0.5, color: '#ef4444' },
                { x: 50, y: 45, size: 60, opacity: 0.35, color: '#f97316' },
                { x: 70, y: 40, size: 50, opacity: 0.25, color: '#f59e0b' },
                { x: 20, y: 60, size: 40, opacity: 0.2, color: '#22c55e' },
              ].map((b, i) => (
                <div key={i} style={{
                  position: 'absolute', left: `${b.x}%`, top: `${b.y}%`,
                  width: b.size, height: b.size, borderRadius: '50%',
                  background: `radial-gradient(circle, ${b.color}${Math.round(b.opacity * 255).toString(16).padStart(2, '0')} 0%, transparent 70%)`,
                  transform: 'translate(-50%, -50%)',
                }} />
              ))}
              {/* Person dots */}
              {Array.from({ length: 42 }, (_, i) => (
                <div key={i} style={{
                  position: 'absolute',
                  left: `${15 + Math.sin(i * 1.3) * 30 + i % 5 * 10}%`,
                  top: `${20 + Math.cos(i * 0.7) * 25 + i % 4 * 12}%`,
                  width: 4, height: 10,
                  background: i === 4 ? '#ef4444' : '#00d4ff',
                  borderRadius: 2,
                  opacity: 0.7,
                }} />
              ))}
              <div className="absolute top-3 right-3 font-mono" style={{ background: 'rgba(0,0,0,0.6)', borderRadius: 4, padding: '3px 7px', fontSize: 9, color: '#e2e8f0' }}>DENSITY HEATMAP ACTIVE</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              {[
                { label: 'DETECTED', value: 47, color: '#e2e8f0' },
                { label: 'TRACKED', value: 42, color: '#00d4ff' },
                { label: 'OCCLUDED', value: 11, color: '#f59e0b' },
                { label: 'SUSPICIOUS', value: 2, color: '#ef4444' },
              ].map(s => (
                <div key={s.label} style={{ textAlign: 'center', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 6, padding: 12 }}>
                  <div className="font-rajdhani font-700" style={{ fontSize: 28, color: s.color }}>{s.value}</div>
                  <div className="font-mono" style={{ color: '#475569', fontSize: 9, letterSpacing: '0.06em' }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ background: 'rgba(13,17,23,0.9)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: 20 }}>
            <div className="section-header">SUSPICIOUS ENTITIES</div>
            {[
              { id: 'TRACK-037', anomaly: 'HIGH', proximity: 'HIGH', risk: 84 },
              { id: 'TRACK-019', anomaly: 'MEDIUM', proximity: 'MEDIUM', risk: 61 },
            ].map(e => (
              <div key={e.id} style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: 14, marginBottom: 10 }}>
                <div className="flex items-center justify-between mb-3">
                  <span className="font-mono font-700 text-xs" style={{ color: '#e2e8f0' }}>{e.id}</span>
                  <span className="badge-critical">Risk {e.risk}</span>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="font-mono text-xs" style={{ color: '#475569', fontSize: 10 }}>Trajectory Anomaly</span>
                    <span className="font-mono text-xs" style={{ color: e.anomaly === 'HIGH' ? '#ef4444' : '#f59e0b', fontSize: 10 }}>{e.anomaly}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-mono text-xs" style={{ color: '#475569', fontSize: 10 }}>Zone Proximity</span>
                    <span className="font-mono text-xs" style={{ color: e.proximity === 'HIGH' ? '#ef4444' : '#f59e0b', fontSize: 10 }}>{e.proximity}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
