import { useState } from 'react';
import { incidents } from '../data/mockData';

function ThreatGauge({ score }: { score: number }) {
  const color = score >= 80 ? '#ef4444' : score >= 60 ? '#f97316' : score >= 40 ? '#f59e0b' : '#22c55e';
  const label = score >= 80 ? 'CRITICAL' : score >= 60 ? 'HIGH' : score >= 40 ? 'MEDIUM' : 'LOW';
  const r = 70;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: 180, height: 180 }}>
        <svg width={180} height={180} viewBox="0 0 180 180">
          {/* Background arcs */}
          <circle cx={90} cy={90} r={r} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={10} />
          {/* Threat arc */}
          <circle cx={90} cy={90} r={r} fill="none" stroke={color} strokeWidth={10}
            strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
            transform="rotate(-90 90 90)"
            style={{ filter: `drop-shadow(0 0 12px ${color}88)`, transition: 'stroke-dasharray 0.8s ease' }}
          />
          {/* Tick marks */}
          {Array.from({ length: 10 }, (_, i) => {
            const angle = ((i / 10) * 360 - 90) * (Math.PI / 180);
            const x1 = 90 + (r - 8) * Math.cos(angle);
            const y1 = 90 + (r - 8) * Math.sin(angle);
            const x2 = 90 + (r + 2) * Math.cos(angle);
            const y2 = 90 + (r + 2) * Math.sin(angle);
            return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(255,255,255,0.08)" strokeWidth={1} />;
          })}
          <text x={90} y={82} textAnchor="middle" fontFamily="Rajdhani" fontSize={38} fontWeight={700} fill={color}>{score}</text>
          <text x={90} y={100} textAnchor="middle" fontFamily="JetBrains Mono" fontSize={9} fill={color} letterSpacing="2">/100</text>
        </svg>
      </div>
      <div className="font-rajdhani font-700 tracking-widest text-center" style={{ fontSize: 20, color, letterSpacing: '0.15em', marginTop: 4 }}>{label}</div>
      <div className="font-mono text-xs" style={{ color: '#475569', fontSize: 10, letterSpacing: '0.08em' }}>THREAT SCORE</div>
    </div>
  );
}

export default function ThreatIntelligence() {
  const [selectedFactor, setSelectedFactor] = useState<number | null>(null);
  const [score, setScore] = useState(91);
  const incident = incidents[0];

  return (
    <div className="p-5 space-y-5 fade-in">
      <div>
        <div className="font-rajdhani font-700 tracking-widest" style={{ fontSize: 20, color: '#e2e8f0', letterSpacing: '0.12em' }}>THREAT INTELLIGENCE</div>
        <div className="font-mono text-xs" style={{ color: '#475569' }}>AI Risk Engine · Entity #037 · Incident #0047</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr 300px', gap: 16 }}>

        {/* Gauge */}
        <div style={{ background: 'rgba(13,17,23,0.9)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <ThreatGauge score={score} />
          <div style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '12px 16px', width: '100%' }}>
            <div className="font-mono text-xs text-center" style={{ color: '#ef4444', letterSpacing: '0.08em', lineHeight: 1.5 }}>
              ⚠️ POTENTIAL THREAT DETECTED<br />
              <span style={{ color: '#475569', fontSize: 9 }}>Classification is probabilistic. System does not confirm identity.</span>
            </div>
          </div>
          <div className="font-mono text-xs text-center" style={{ color: '#334155', fontSize: 10, lineHeight: 1.6 }}>
            Entity: SUSPICIOUS ENTITY<br />
            Track: #037<br />
            Camera: CAM-04
          </div>
        </div>

        {/* Risk Factor Breakdown */}
        <div style={{ background: 'rgba(13,17,23,0.9)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: 24 }}>
          <div className="section-header">CONTRIBUTING RISK FACTORS</div>
          <div className="space-y-2">
            {incident.riskFactors.map((f, i) => {
              const pct = (f.score / score) * 100;
              const isSelected = selectedFactor === i;
              return (
                <div key={i}>
                  <button
                    onClick={() => setSelectedFactor(isSelected ? null : i)}
                    className="w-full text-left rounded-lg"
                    style={{
                      background: isSelected ? 'rgba(239,68,68,0.06)' : 'rgba(255,255,255,0.02)',
                      border: `1px solid ${isSelected ? 'rgba(239,68,68,0.25)' : 'rgba(255,255,255,0.06)'}`,
                      padding: '12px 16px', cursor: 'pointer', transition: 'all 0.15s',
                    }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-rajdhani font-700 text-xs" style={{ color: isSelected ? '#e2e8f0' : '#94a3b8', letterSpacing: '0.04em' }}>{f.label}</span>
                      <div className="flex items-center gap-3">
                        <div style={{ height: 4, width: 80, background: 'rgba(255,255,255,0.06)', borderRadius: 2 }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: '#ef4444', borderRadius: 2, transition: 'width 0.5s' }} />
                        </div>
                        <span className="font-mono font-700 text-xs" style={{ color: '#ef4444', fontSize: 11, minWidth: 24 }}>+{f.score}</span>
                      </div>
                    </div>
                    {isSelected && (
                      <div className="font-mono text-xs mt-2 pt-2" style={{ color: '#64748b', fontSize: 10, lineHeight: 1.5, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                        {f.reason}
                      </div>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
          <div className="flex justify-between items-center mt-4 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <span className="font-rajdhani font-700 tracking-widest" style={{ color: '#94a3b8', fontSize: 13, letterSpacing: '0.1em' }}>TOTAL RISK SCORE</span>
            <span className="font-rajdhani font-700" style={{ fontSize: 24, color: '#ef4444' }}>{score}<span className="text-sm" style={{ color: '#64748b', fontSize: 13 }}>/100</span></span>
          </div>
          <div className="mt-3">
            <div className="font-mono text-xs mb-1" style={{ color: '#475569', fontSize: 10 }}>Adjust threshold for demo</div>
            <input type="range" min={0} max={100} value={score} onChange={e => setScore(Number(e.target.value))}
              style={{ width: '100%', accentColor: '#ef4444' }} />
          </div>
        </div>

        {/* Face Occlusion + Re-ID */}
        <div className="space-y-4">
          <div style={{ background: 'rgba(13,17,23,0.9)', border: '1px solid rgba(0,212,255,0.15)', borderRadius: 8, padding: 20 }}>
            <div className="section-header">FACE-INDEPENDENT TRACKING</div>
            <div style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 6, padding: '10px 14px', marginBottom: 16 }}>
              <div className="flex items-center gap-2">
                <span className="status-dot-offline blink" style={{ width: 7, height: 7, borderRadius: '50%', display: 'inline-block' }} />
                <span className="font-rajdhani font-700 text-xs tracking-widest" style={{ color: '#ef4444', letterSpacing: '0.08em' }}>FACE OCCLUDED</span>
              </div>
              <div className="font-mono text-xs mt-1" style={{ color: '#64748b', fontSize: 10 }}>Facial recognition unavailable. Re-ID active.</div>
            </div>
            <div className="space-y-3">
              {[
                { label: 'Appearance Similarity', value: 87, color: '#00d4ff' },
                { label: 'Trajectory Consistency', value: 94, color: '#22c55e', text: 'HIGH' },
                { label: 'Cross-Camera Continuity', value: 89, color: '#00d4ff' },
              ].map(m => (
                <div key={m.label}>
                  <div className="flex justify-between mb-1">
                    <span className="font-mono text-xs" style={{ color: '#64748b', fontSize: 10 }}>{m.label}</span>
                    <span className="font-mono text-xs font-700" style={{ color: m.color, fontSize: 10 }}>{m.text || `${m.value}%`}</span>
                  </div>
                  <div style={{ height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 2 }}>
                    <div style={{ width: `${m.value}%`, height: '100%', background: m.color, borderRadius: 2 }} />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 p-3 rounded-lg text-center" style={{ background: 'rgba(0,212,255,0.05)', border: '1px solid rgba(0,212,255,0.15)' }}>
              <div className="font-rajdhani font-700 text-xs tracking-widest" style={{ color: '#00d4ff', letterSpacing: '0.08em' }}>FACE-INDEPENDENT TRACKING ACTIVE</div>
              <div className="font-mono mt-1" style={{ color: '#475569', fontSize: 9, lineHeight: 1.5 }}>System maintains entity continuity using<br />appearance, gait, and trajectory analysis.</div>
            </div>
          </div>

          {/* Cross-camera timeline */}
          <div style={{ background: 'rgba(13,17,23,0.9)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: 20 }}>
            <div className="section-header">CAMERA TRAIL · TRACK-037</div>
            {['CAM-01', 'CAM-04', 'CAM-07', 'CAM-09'].map((c, i) => (
              <div key={c} className="flex items-center gap-3 mb-2">
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#00d4ff', flexShrink: 0, boxShadow: '0 0 6px #00d4ff' }} />
                <div style={{ flex: 1 }}>
                  <div className="font-rajdhani font-700 text-xs" style={{ color: '#94a3b8' }}>{c}</div>
                  <div className="font-mono" style={{ color: '#334155', fontSize: 9 }}>0{i}:{10 + i * 4}:{20 + i * 2} — Match {89 - i * 2}%</div>
                </div>
                {i < 3 && <div style={{ position: 'absolute', left: 28, marginTop: 12, width: 1, height: 16, background: 'rgba(0,212,255,0.2)' }} />}
              </div>
            ))}
            <div className="mt-3 p-3 rounded" style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)' }}>
              <div className="font-mono text-xs text-center" style={{ color: '#f59e0b', fontSize: 10 }}>POSSIBLE SAME ENTITY · NOT CONFIRMED IDENTITY</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
