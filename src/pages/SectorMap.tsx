import { useState } from 'react';
import { cameras, sectors, restrictedZones, incidents, persons } from '../data/mockData';

export default function SectorMap() {
  const [selectedCam, setSelectedCam] = useState<string | null>(null);
  const [selectedSector, setSelectedSector] = useState<string | null>(null);

  const cam = cameras.find(c => c.id === selectedCam);

  return (
    <div className="p-5 space-y-5 fade-in">
      <div className="flex items-end justify-between">
        <div>
          <div className="font-rajdhani font-700 tracking-widest" style={{ fontSize: 20, color: '#e2e8f0', letterSpacing: '0.12em' }}>SECTOR MAP</div>
          <div className="font-mono text-xs" style={{ color: '#475569' }}>Tactical Border Overview · Real-Time Entity Positions</div>
        </div>
        <div className="flex gap-3">
          {[
            { label: 'CAMERAS', color: '#00d4ff' },
            { label: 'RESTRICTED ZONES', color: '#ef444466' },
            { label: 'INCIDENTS', color: '#f97316' },
            { label: 'ENTITIES', color: '#22c55e' },
          ].map(l => (
            <div key={l.label} className="flex items-center gap-1.5">
              <div style={{ width: 10, height: 10, borderRadius: 2, background: l.color }} />
              <span className="font-mono" style={{ color: '#475569', fontSize: 9, letterSpacing: '0.06em' }}>{l.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 16 }}>
        {/* MAP */}
        <div style={{ background: 'rgba(13,17,23,0.9)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ position: 'relative', width: '100%', paddingBottom: '65%' }}>
            <div className="absolute inset-0 grid-bg" style={{ background: '#070c10' }}>
              {/* Tactical grid */}
              <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 65" preserveAspectRatio="none">
                {/* Border outline */}
                <rect x={2} y={2} width={96} height={61} fill="none" stroke="rgba(0,212,255,0.08)" strokeWidth={0.3} />
                {/* Sector regions */}
                <rect x={2} y={2} width={48} height={30} fill="rgba(0,212,255,0.02)" stroke="rgba(0,212,255,0.06)" strokeWidth={0.2} />
                <rect x={50} y={2} width={48} height={30} fill="rgba(0,212,255,0.02)" stroke="rgba(0,212,255,0.06)" strokeWidth={0.2} />
                <rect x={2} y={32} width={48} height={31} fill="rgba(0,212,255,0.02)" stroke="rgba(0,212,255,0.06)" strokeWidth={0.2} />
                <rect x={50} y={32} width={48} height={31} fill="rgba(0,212,255,0.02)" stroke="rgba(0,212,255,0.06)" strokeWidth={0.2} />
                {/* Sector labels */}
                <text x={8} y={8} fontFamily="JetBrains Mono" fontSize={1.8} fill="rgba(0,212,255,0.2)" letterSpacing={0.1}>NORTH BORDER</text>
                <text x={54} y={8} fontFamily="JetBrains Mono" fontSize={1.8} fill="rgba(0,212,255,0.2)" letterSpacing={0.1}>EAST CORRIDOR</text>
                <text x={8} y={38} fontFamily="JetBrains Mono" fontSize={1.8} fill="rgba(0,212,255,0.2)" letterSpacing={0.1}>WEST ACCESS</text>
                <text x={54} y={38} fontFamily="JetBrains Mono" fontSize={1.8} fill="rgba(0,212,255,0.2)" letterSpacing={0.1}>SOUTH GATE</text>
                <text x={42} y={35} fontFamily="JetBrains Mono" fontSize={1.8} fill="rgba(0,212,255,0.15)" letterSpacing={0.1}>CENTRAL</text>

                {/* Restricted zones */}
                <rect x={8} y={12} width={18} height={16} fill="rgba(239,68,68,0.06)" stroke="rgba(239,68,68,0.35)" strokeWidth={0.3} strokeDasharray="1 0.5" />
                <text x={9} y={14.5} fontFamily="JetBrains Mono" fontSize={1.5} fill="rgba(239,68,68,0.7)">RESTRICTED ZONE A</text>
                <rect x={55} y={10} width={20} height={18} fill="rgba(245,158,11,0.04)" stroke="rgba(245,158,11,0.25)" strokeWidth={0.3} strokeDasharray="1 0.5" />
                <text x={56} y={12} fontFamily="JetBrains Mono" fontSize={1.5} fill="rgba(245,158,11,0.6)">SECURE PERIMETER B</text>

                {/* Road/path lines */}
                <line x1={50} y1={0} x2={50} y2={65} stroke="rgba(255,255,255,0.04)" strokeWidth={0.5} />
                <line x1={0} y1={32} x2={100} y2={32} stroke="rgba(255,255,255,0.04)" strokeWidth={0.5} />

                {/* Camera positions */}
                {cameras.map(c => (
                  <g key={c.id} onClick={() => setSelectedCam(selectedCam === c.id ? null : c.id)} style={{ cursor: 'pointer' }}>
                    <circle
                      cx={c.location.x} cy={c.location.y} r={1.5}
                      fill={c.status === 'offline' ? '#ef4444' : c.status === 'warning' ? '#f59e0b' : '#00d4ff'}
                      opacity={0.9}
                    />
                    {/* Camera range cone */}
                    <path
                      d={`M${c.location.x},${c.location.y} L${c.location.x - 4},${c.location.y + 6} L${c.location.x + 4},${c.location.y + 6} Z`}
                      fill={c.status === 'offline' ? 'rgba(239,68,68,0.1)' : 'rgba(0,212,255,0.06)'}
                      stroke={c.status === 'offline' ? 'rgba(239,68,68,0.2)' : 'rgba(0,212,255,0.15)'}
                      strokeWidth={0.2}
                    />
                    <text x={c.location.x + 2} y={c.location.y - 2} fontFamily="JetBrains Mono" fontSize={1.4} fill={selectedCam === c.id ? '#00d4ff' : 'rgba(255,255,255,0.4)'}>{c.id}</text>
                  </g>
                ))}

                {/* Person positions */}
                {persons.map(p => (
                  <g key={p.id}>
                    <circle cx={p.x} cy={p.y} r={1.2} fill={p.risk > 70 ? '#ef4444' : '#22c55e'} opacity={0.8} />
                    <circle cx={p.x} cy={p.y} r={p.risk > 70 ? 3 : 2} fill="none" stroke={p.risk > 70 ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.2)'} strokeWidth={0.3} />
                    <text x={p.x + 1.5} y={p.y - 1} fontFamily="JetBrains Mono" fontSize={1.2} fill="rgba(255,255,255,0.4)">{p.id.replace('TRACK-', '#')}</text>
                  </g>
                ))}

                {/* Incident marker */}
                <g>
                  <circle cx={80} cy={50} r={2.5} fill="rgba(239,68,68,0.2)" stroke="#ef4444" strokeWidth={0.3} />
                  <text x={77} y={47} fontFamily="JetBrains Mono" fontSize={1.5} fill="#ef4444">⚠ INCIDENT</text>
                </g>

                {/* Compass */}
                <text x={95} y={5} fontFamily="JetBrains Mono" fontSize={2.5} fill="rgba(0,212,255,0.4)" fontWeight="bold">N</text>
                <line x1={96} y1={6} x2={96} y2={9} stroke="rgba(0,212,255,0.3)" strokeWidth={0.3} />
              </svg>

              {/* Selected cam popup */}
              {selectedCam && cam && (
                <div style={{
                  position: 'absolute', top: `${cam.location.y + 2}%`, left: `${cam.location.x + 2}%`,
                  background: 'rgba(9,12,17,0.95)', border: '1px solid rgba(0,212,255,0.3)', borderRadius: 6, padding: 10, minWidth: 160, zIndex: 10,
                }}>
                  <div className="font-rajdhani font-700 text-xs" style={{ color: '#00d4ff', letterSpacing: '0.08em' }}>{cam.id}</div>
                  <div className="font-mono" style={{ color: '#475569', fontSize: 9 }}>{cam.sector}</div>
                  <div className="flex items-center gap-1 mt-1">
                    <span className={`status-dot-${cam.status === 'warning' ? 'warning' : cam.status}`} style={{ width: 5, height: 5, borderRadius: '50%', display: 'inline-block' }} />
                    <span className="font-mono" style={{ color: '#64748b', fontSize: 9 }}>{cam.fps}fps · {cam.latency}ms · {cam.resolution}</span>
                  </div>
                  <button className="btn-primary mt-2 w-full" style={{ padding: '4px 0' }}>VIEW FEED</button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right panel */}
        <div className="space-y-4">
          {/* Sector status */}
          <div style={{ background: 'rgba(13,17,23,0.9)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: 16 }}>
            <div className="section-header">SECTOR STATUS</div>
            {sectors.map(s => (
              <div key={s.id}
                onClick={() => setSelectedSector(selectedSector === s.id ? null : s.id)}
                className="mb-2 rounded-lg cursor-pointer"
                style={{ background: selectedSector === s.id ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', padding: '10px 12px' }}>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-rajdhani font-700 text-xs" style={{ color: '#94a3b8' }}>{s.name}</span>
                  <span style={{ color: s.color, fontFamily: 'JetBrains Mono', fontSize: 9, fontWeight: 700, letterSpacing: '0.08em' }}>{s.threatLevel}</span>
                </div>
                <div className="font-mono" style={{ color: '#334155', fontSize: 9 }}>{s.cameras.length} cameras · {s.incidents} incidents</div>
              </div>
            ))}
          </div>

          {/* Active incidents on map */}
          <div style={{ background: 'rgba(13,17,23,0.9)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: 16 }}>
            <div className="section-header">MAP INCIDENTS</div>
            {incidents.slice(0, 3).map(inc => (
              <div key={inc.id} className="mb-2 rounded-lg" style={{ background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.15)', padding: '10px 12px' }}>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-700" style={{ color: '#e2e8f0', fontSize: 11 }}>{inc.id}</span>
                  <span className={`badge-${inc.severity.toLowerCase()}`}>{inc.severity}</span>
                </div>
                <div className="font-mono mt-1" style={{ color: '#475569', fontSize: 9 }}>{inc.cam} · {inc.sector}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
