import { useState } from 'react';
import { AlertTriangle, Clock, Camera, ChevronRight, ArrowUpDown, Play, Download, FileText, X } from 'lucide-react';
import { incidents, alerts } from '../data/mockData';

type Severity = 'ALL' | 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
type SortKey = 'severity' | 'time' | 'camera' | 'risk';

const severityOrder: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };

function RiskGauge({ score }: { score: number }) {
  const color = score >= 80 ? '#ef4444' : score >= 60 ? '#f97316' : score >= 40 ? '#f59e0b' : '#22c55e';
  const r = 28;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  return (
    <div className="flex items-center gap-2">
      <svg width={68} height={68} viewBox="0 0 68 68">
        <circle cx={34} cy={34} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={5} />
        <circle cx={34} cy={34} r={r} fill="none" stroke={color} strokeWidth={5}
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          transform="rotate(-90 34 34)" style={{ transition: 'stroke-dasharray 0.5s ease' }} />
        <text x={34} y={39} textAnchor="middle" fontFamily="JetBrains Mono" fontSize={14} fontWeight={700} fill={color}>{score}</text>
      </svg>
      <div>
        <div className="font-rajdhani font-700 text-xs tracking-widest" style={{ color, letterSpacing: '0.1em' }}>
          {score >= 80 ? 'CRITICAL' : score >= 60 ? 'HIGH' : score >= 40 ? 'MEDIUM' : 'LOW'}
        </div>
        <div className="font-mono" style={{ color: '#475569', fontSize: 9 }}>Risk Score</div>
      </div>
    </div>
  );
}

function IncidentModal({ incident, onClose }: { incident: typeof incidents[0]; onClose: () => void }) {
  const [selectedFactor, setSelectedFactor] = useState<number | null>(null);
  const steps = ['10s Before', 'Detection', 'Intrusion', '10s After'];
  const [timelineStep, setTimelineStep] = useState(2);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(4px)' }}>
      <div style={{ width: '90vw', maxWidth: 900, maxHeight: '90vh', overflow: 'auto', background: '#0d1117', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12 }}>
        {/* Header */}
        <div className="flex items-start justify-between p-6" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="flex items-center gap-4">
            <div>
              <div className="font-rajdhani font-700 tracking-widest" style={{ fontSize: 18, color: '#e2e8f0', letterSpacing: '0.1em' }}>INCIDENT {incident.id}</div>
              <div className="font-mono text-xs" style={{ color: '#475569', fontSize: 10 }}>{incident.type} · {incident.cam} · {incident.sector}</div>
            </div>
            <span className={`badge-${incident.severity.toLowerCase()}`}>{incident.severity}</span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}><X size={20} /></button>
        </div>

        <div className="p-6" style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 24 }}>
          {/* Left */}
          <div className="space-y-5">
            {/* Evidence viewer */}
            <div>
              <div className="section-header">EVIDENCE</div>
              <div style={{ background: '#040608', borderRadius: 8, aspectRatio: '16/9', position: 'relative', overflow: 'hidden' }}>
                <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 40% 35%, #001a10 0%, #040608 70%)' }} />
                {/* Bounding box */}
                <div style={{ position: 'absolute', left: '38%', top: '28%', width: '14%', height: '32%', border: '1.5px solid #ef4444', boxShadow: '0 0 12px #ef444444' }}>
                  <div style={{ position: 'absolute', top: -22, left: 0, background: '#ef444422', border: '1px solid #ef444466', borderRadius: 3, padding: '2px 7px', fontFamily: 'JetBrains Mono', fontSize: 9, color: '#ef4444', whiteSpace: 'nowrap' }}>
                    TRACK-037 · 96%
                  </div>
                </div>
                {/* Zone */}
                <div style={{ position: 'absolute', left: '5%', top: '15%', width: '35%', height: '55%', border: '1px dashed rgba(239,68,68,0.6)', background: 'rgba(239,68,68,0.05)' }}>
                  <span style={{ position: 'absolute', top: 4, left: 4, fontFamily: 'JetBrains Mono', fontSize: 8, color: 'rgba(239,68,68,0.7)' }}>RESTRICTED ZONE A</span>
                </div>
                <div className="absolute inset-0 pointer-events-none" style={{ background: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.1) 3px, rgba(0,0,0,0.1) 4px)' }} />
                <div className="absolute bottom-3 left-3 flex items-center gap-2">
                  <span className="font-mono" style={{ background: 'rgba(0,0,0,0.6)', borderRadius: 4, padding: '3px 7px', fontSize: 10, color: '#e2e8f0' }}>02:14:32 · CAM-04</span>
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <button className="btn-primary flex items-center gap-2"><Play size={12} /> REPLAY INCIDENT</button>
                <button className="btn-ghost flex items-center gap-2"><Download size={12} /> DOWNLOAD</button>
                <button className="btn-ghost flex items-center gap-2"><FileText size={12} /> EXPORT REPORT</button>
              </div>
            </div>

            {/* Timeline */}
            <div>
              <div className="section-header">INCIDENT TIMELINE</div>
              <div className="flex items-center gap-0">
                {steps.map((s, i) => (
                  <div key={i} className="flex items-center flex-1">
                    <button onClick={() => setTimelineStep(i)} style={{
                      flex: 'none', width: 32, height: 32, borderRadius: '50%', cursor: 'pointer',
                      background: timelineStep === i ? '#ef4444' : timelineStep > i ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.06)',
                      border: `1.5px solid ${timelineStep >= i ? '#ef4444' : 'rgba(255,255,255,0.1)'}`,
                      color: timelineStep >= i ? (timelineStep === i ? '#fff' : '#ef4444') : '#475569',
                      fontFamily: 'JetBrains Mono', fontSize: 11, fontWeight: 700,
                    }}>{i + 1}</button>
                    <div className="flex flex-col ml-2 mr-4 flex-1">
                      <span className="font-mono text-xs" style={{ color: timelineStep === i ? '#e2e8f0' : '#475569', fontSize: 10, whiteSpace: 'nowrap' }}>{s}</span>
                      {i < steps.length - 1 && <div style={{ height: 1, background: timelineStep > i ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.08)', marginTop: 4 }} />}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Description */}
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 6, padding: 14 }}>
              <div className="font-mono text-xs" style={{ color: '#64748b', lineHeight: 1.6 }}>{incident.description}</div>
            </div>
          </div>

          {/* Right */}
          <div className="space-y-4">
            <RiskGauge score={incident.risk} />

            {/* Meta */}
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: 16 }}>
              {[
                { label: 'CAMERA', value: incident.cam },
                { label: 'SECTOR', value: incident.sector },
                { label: 'ENTITY', value: incident.track },
                { label: 'TIMESTAMP', value: incident.time },
                { label: 'STATUS', value: incident.status },
                { label: 'EVIDENCE', value: `${incident.evidence.frames} frames · ${incident.evidence.clips} clip` },
              ].map(m => (
                <div key={m.label} className="flex justify-between py-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <span className="font-mono text-xs" style={{ color: '#475569', fontSize: 10, letterSpacing: '0.08em' }}>{m.label}</span>
                  <span className="font-mono text-xs" style={{ color: '#94a3b8', fontSize: 10 }}>{m.value}</span>
                </div>
              ))}
            </div>

            {/* Risk Factors */}
            <div>
              <div className="section-header">RISK FACTORS</div>
              {incident.riskFactors.map((f, i) => (
                <div key={i}>
                  <button onClick={() => setSelectedFactor(selectedFactor === i ? null : i)}
                    className="w-full text-left mb-1 py-2 px-3 rounded"
                    style={{ background: selectedFactor === i ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', cursor: 'pointer' }}>
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs" style={{ color: '#94a3b8', fontSize: 10 }}>{f.label}</span>
                      <span className="font-mono text-xs font-700" style={{ color: '#ef4444', fontSize: 10 }}>+{f.score}</span>
                    </div>
                  </button>
                  {selectedFactor === i && (
                    <div className="px-3 py-2 mb-1 rounded" style={{ background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.15)', marginTop: -1 }}>
                      <div className="font-mono text-xs" style={{ color: '#64748b', fontSize: 10, lineHeight: 1.5 }}>{f.reason}</div>
                    </div>
                  )}
                </div>
              ))}
              <div className="flex justify-between pt-2 mt-1" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                <span className="font-rajdhani font-700 text-xs tracking-widest" style={{ color: '#94a3b8' }}>TOTAL</span>
                <span className="font-rajdhani font-700 text-xs" style={{ color: '#ef4444' }}>{incident.risk}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Incidents() {
  const [filter, setFilter] = useState<Severity>('ALL');
  const [sort, setSort] = useState<SortKey>('severity');
  const [selected, setSelected] = useState<typeof incidents[0] | null>(null);

  const filtered = incidents
    .filter(i => filter === 'ALL' || i.severity === filter)
    .sort((a, b) => {
      if (sort === 'severity') return severityOrder[b.severity] - severityOrder[a.severity];
      if (sort === 'risk') return b.risk - a.risk;
      if (sort === 'camera') return a.cam.localeCompare(b.cam);
      return b.time.localeCompare(a.time);
    });

  return (
    <div className="p-5 space-y-5 fade-in">
      {selected && <IncidentModal incident={selected} onClose={() => setSelected(null)} />}

      <div className="flex items-end justify-between">
        <div>
          <div className="font-rajdhani font-700 tracking-widest" style={{ fontSize: 20, color: '#e2e8f0', letterSpacing: '0.12em' }}>INCIDENT ALERT CENTER</div>
          <div className="font-mono text-xs" style={{ color: '#475569' }}>{incidents.length} total incidents · {incidents.filter(i => i.status === 'OPEN').length} open</div>
        </div>
        <div className="flex items-center gap-3">
          {/* Severity filter */}
          <div className="flex gap-1" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, padding: 3 }}>
            {(['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as Severity[]).map(s => (
              <button key={s} onClick={() => setFilter(s)}
                style={{
                  padding: '5px 12px', borderRadius: 4, cursor: 'pointer',
                  background: filter === s ? (s === 'CRITICAL' ? 'rgba(239,68,68,0.2)' : s === 'HIGH' ? 'rgba(249,115,22,0.2)' : s === 'MEDIUM' ? 'rgba(245,158,11,0.2)' : s === 'LOW' ? 'rgba(34,197,94,0.2)' : 'rgba(0,212,255,0.15)') : 'none',
                  border: filter === s ? `1px solid ${s === 'CRITICAL' ? 'rgba(239,68,68,0.4)' : s === 'HIGH' ? 'rgba(249,115,22,0.4)' : s === 'MEDIUM' ? 'rgba(245,158,11,0.4)' : s === 'LOW' ? 'rgba(34,197,94,0.4)' : 'rgba(0,212,255,0.3)'}` : '1px solid transparent',
                  color: filter === s ? (s === 'CRITICAL' ? '#ef4444' : s === 'HIGH' ? '#f97316' : s === 'MEDIUM' ? '#f59e0b' : s === 'LOW' ? '#22c55e' : '#00d4ff') : '#64748b',
                  fontFamily: 'Rajdhani', fontWeight: 700, fontSize: 12, letterSpacing: '0.06em',
                }}>{s}</button>
            ))}
          </div>
          {/* Sort */}
          <div className="flex items-center gap-1.5">
            <ArrowUpDown size={13} color="#475569" />
            <select value={sort} onChange={e => setSort(e.target.value as SortKey)}
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#94a3b8', borderRadius: 5, padding: '5px 10px', fontFamily: 'JetBrains Mono', fontSize: 11, cursor: 'pointer', outline: 'none' }}>
              <option value="severity">Sort: Severity</option>
              <option value="time">Sort: Time</option>
              <option value="camera">Sort: Camera</option>
              <option value="risk">Sort: Risk Score</option>
            </select>
          </div>
        </div>
      </div>

      {/* Incident Cards */}
      <div className="space-y-3">
        {filtered.map(inc => (
          <div key={inc.id}
            onClick={() => setSelected(inc)}
            className="cursor-pointer"
            style={{
              background: 'rgba(13,17,23,0.9)',
              border: `1px solid ${inc.severity === 'CRITICAL' ? 'rgba(239,68,68,0.25)' : inc.severity === 'HIGH' ? 'rgba(249,115,22,0.2)' : 'rgba(255,255,255,0.08)'}`,
              borderRadius: 8, padding: 20,
              transition: 'border-color 0.15s, background 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(17,24,39,0.9)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(13,17,23,0.9)')}
          >
            <div className="flex items-start gap-5">
              <RiskGauge score={inc.risk} />

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-2 flex-wrap">
                  <span className="font-mono font-700 text-sm" style={{ color: '#e2e8f0' }}>{inc.id}</span>
                  <span className={`badge-${inc.severity.toLowerCase()}`}>{inc.severity}</span>
                  <span className="font-rajdhani font-700 text-xs" style={{ color: '#94a3b8', letterSpacing: '0.04em' }}>{inc.type}</span>
                  <span style={{
                    background: inc.status === 'OPEN' ? 'rgba(239,68,68,0.1)' : inc.status === 'ESCALATED' ? 'rgba(249,115,22,0.1)' : inc.status === 'RESOLVED' ? 'rgba(34,197,94,0.1)' : 'rgba(245,158,11,0.1)',
                    border: `1px solid ${inc.status === 'OPEN' ? 'rgba(239,68,68,0.25)' : inc.status === 'RESOLVED' ? 'rgba(34,197,94,0.25)' : 'rgba(245,158,11,0.25)'}`,
                    color: inc.status === 'OPEN' ? '#ef4444' : inc.status === 'RESOLVED' ? '#22c55e' : '#f59e0b',
                    fontFamily: 'JetBrains Mono', fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', padding: '2px 7px', borderRadius: 3,
                  }}>{inc.status}</span>
                </div>
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="flex items-center gap-1.5"><Camera size={12} color="#475569" /><span className="font-mono text-xs" style={{ color: '#64748b', fontSize: 11 }}>{inc.cam}</span></div>
                  <div className="font-mono text-xs" style={{ color: '#64748b', fontSize: 11 }}>SECTOR: {inc.sector}</div>
                  <div className="font-mono text-xs" style={{ color: '#64748b', fontSize: 11 }}>ENTITY: {inc.track}</div>
                  <div className="flex items-center gap-1.5"><Clock size={12} color="#475569" /><span className="font-mono text-xs" style={{ color: '#64748b', fontSize: 11 }}>{inc.time}</span></div>
                </div>
                <div className="font-mono text-xs mt-2" style={{ color: '#334155', fontSize: 10, lineHeight: 1.5 }}>{inc.description.slice(0, 120)}...</div>
              </div>

              <div className="flex flex-col items-end gap-2">
                <button className="btn-primary flex items-center gap-1.5">
                  <ChevronRight size={12} /> INVESTIGATE
                </button>
                <div className="font-mono text-xs" style={{ color: '#334155', fontSize: 10 }}>
                  {inc.evidence.frames} frames · {inc.evidence.clips} clip
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
