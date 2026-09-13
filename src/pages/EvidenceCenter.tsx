import { useEffect, useState } from 'react';
import { Download, Eye, Play, FileText, Filter } from 'lucide-react';
import { apiUrl } from '../api/client';

export default function EvidenceCenter() {
  const [view, setView] = useState<'grid' | 'report'>('grid');
  const [evidence, setEvidence] = useState<any[]>([]);
  const [reportInc, setReportInc] = useState<any>(null);
  const [filterSev, setFilterSev] = useState('ALL');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const load = async () => {
      const response = await fetch(apiUrl('/api/evidence'), { cache: 'no-store' })
      if (response.ok) setEvidence((await response.json()).data || [])
    }
    void load()
    const timer = window.setInterval(() => void load(), 3000)
    return () => window.clearInterval(timer)
  }, [])

  const records = evidence.map(item => ({
    id: item.id,
    severity: item.severity || 'LOW',
    type: item.behaviorSignals?.[0]?.type || 'AI event',
    cam: item.cameraId,
    sector: item.cameraId,
    track: item.trackIds?.[0] == null ? 'UNTRACKED' : `TRACK-${item.trackIds[0]}`,
    risk: item.riskScore || 0,
    time: item.capturedAt ? new Date(item.capturedAt).toLocaleTimeString('en-IN', { hour12: false }) : '--:--:--',
    status: 'OPEN',
    description: item.disclaimer,
    evidence: { frames: 1, clips: 0 },
    riskFactors: Object.entries(item.signals || {}).map(([label, value]) => ({ label, score: Number(value) || 0, reason: 'AI signal contributing to the event.' })),
    frameUrl: apiUrl(item.frameUrl),
  }))
  const filtered = records.filter(i => filterSev === 'ALL' || i.severity === filterSev);

  useEffect(() => {
    if (!reportInc && records[0]) setReportInc(records[0])
  }, [records, reportInc])

  const handleExport = () => {
    setExporting(true);
    setTimeout(() => setExporting(false), 2000);
  };

  return (
    <div className="p-5 space-y-5 fade-in">
      <div className="flex items-end justify-between">
        <div>
          <div className="font-rajdhani font-700 tracking-widest" style={{ fontSize: 20, color: '#e2e8f0', letterSpacing: '0.12em' }}>EVIDENCE CENTER</div>
          <div className="font-mono text-xs" style={{ color: '#475569' }}>{records.length} evidence events · {records.length} captured frames</div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-1" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, padding: 3 }}>
            {['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map(s => (
              <button key={s} onClick={() => setFilterSev(s)}
                style={{
                  padding: '5px 10px', borderRadius: 4, cursor: 'pointer',
                  background: filterSev === s ? 'rgba(0,212,255,0.15)' : 'none',
                  border: filterSev === s ? '1px solid rgba(0,212,255,0.3)' : '1px solid transparent',
                  color: filterSev === s ? '#00d4ff' : '#64748b',
                  fontFamily: 'Rajdhani', fontWeight: 700, fontSize: 11, letterSpacing: '0.06em',
                }}>{s}</button>
            ))}
          </div>
          <button onClick={() => setView(view === 'grid' ? 'report' : 'grid')} className="btn-primary">
            {view === 'grid' ? 'VIEW REPORT' : 'VIEW GRID'}
          </button>
        </div>
      </div>

      {view === 'grid' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
          {filtered.map(inc => (
            <div key={inc.id} style={{ background: 'rgba(13,17,23,0.9)', border: `1px solid ${inc.severity === 'CRITICAL' ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.07)'}`, borderRadius: 8, overflow: 'hidden' }}>
              {/* Thumbnail */}
              <div style={{ background: '#040608', aspectRatio: '16/7', position: 'relative', overflow: 'hidden' }}>
                <img src={inc.frameUrl} alt="Captured AI event frame" className="absolute inset-0 h-full w-full object-contain" />
                {/* Detection box */}
                <div style={{ position: 'absolute', left: '38%', top: '20%', width: '15%', height: '50%', border: `1.5px solid ${inc.severity === 'CRITICAL' ? '#ef4444' : '#f59e0b'}` }}>
                  <div style={{ position: 'absolute', top: -18, left: 0, background: 'rgba(239,68,68,0.2)', borderRadius: 3, padding: '1px 5px', fontFamily: 'JetBrains Mono', fontSize: 8, color: '#ef4444', whiteSpace: 'nowrap' }}>
                    {inc.track}
                  </div>
                </div>
                <div className="absolute inset-0 pointer-events-none" style={{ background: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.12) 3px, rgba(0,0,0,0.12) 4px)' }} />
                {/* Play button overlay */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity" style={{ background: 'rgba(0,0,0,0.5)' }}>
                  <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(0,212,255,0.2)', border: '1px solid rgba(0,212,255,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Play size={20} color="#00d4ff" />
                  </div>
                </div>
                <div className="absolute bottom-2 left-2 flex items-center gap-2">
                  <span className="font-mono" style={{ background: 'rgba(0,0,0,0.7)', borderRadius: 3, padding: '2px 6px', fontSize: 9, color: '#94a3b8' }}>{inc.cam} · {inc.time}</span>
                </div>
              </div>

              {/* Info */}
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-700 text-xs" style={{ color: '#e2e8f0' }}>{inc.id}</span>
                    <span className={`badge-${inc.severity.toLowerCase()}`}>{inc.severity}</span>
                  </div>
                  <div className="font-mono text-xs" style={{ color: '#334155', fontSize: 10 }}>Risk {inc.risk}/100</div>
                </div>
                <div className="font-rajdhani font-700 text-xs mb-2" style={{ color: '#94a3b8', letterSpacing: '0.04em' }}>{inc.type}</div>
                <div className="font-mono text-xs mb-3" style={{ color: '#475569', fontSize: 10 }}>
                  {inc.sector} · {inc.evidence.frames} frames · {inc.evidence.clips} video clip
                </div>
                <div className="flex gap-2">
                  <button className="btn-primary flex items-center gap-1.5" style={{ flex: 1, justifyContent: 'center', padding: '6px 0' }}>
                    <Eye size={11} /> VIEW
                  </button>
                  <button className="btn-ghost flex items-center gap-1.5" style={{ flex: 1, justifyContent: 'center', padding: '6px 0' }}>
                    <Play size={11} /> REPLAY
                  </button>
                  <button className="btn-ghost flex items-center gap-1.5" style={{ flex: 1, justifyContent: 'center', padding: '6px 0' }}>
                    <Download size={11} /> DL
                  </button>
                  <button onClick={() => { setReportInc(inc); setView('report'); }}
                    className="btn-ghost flex items-center gap-1.5" style={{ flex: 1, justifyContent: 'center', padding: '6px 0' }}>
                    <FileText size={11} /> RPT
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Report view */
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 16 }}>
          <div style={{ background: 'rgba(13,17,23,0.9)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: 32 }}>
            {/* Report header */}
            <div className="text-center mb-8 pb-6" style={{ borderBottom: '2px solid rgba(0,212,255,0.2)' }}>
              <div className="font-mono mb-2" style={{ color: '#475569', fontSize: 10, letterSpacing: '0.15em' }}>GOVERNMENT OF INDIA · BORDER SECURITY FORCE</div>
              <div className="font-rajdhani font-700 tracking-widest" style={{ fontSize: 22, color: '#e2e8f0', letterSpacing: '0.15em' }}>BORDER SECURITY INCIDENT REPORT</div>
              <div className="font-mono mt-2" style={{ color: '#475569', fontSize: 10 }}>GENERATED: {new Date().toLocaleString('en-IN')} · CLASSIFICATION: RESTRICTED</div>
            </div>

            {/* Report body */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
              <div>
                <div className="section-header">INCIDENT DETAILS</div>
                {[
                  { label: 'Incident Number', value: reportInc.id },
                  { label: 'Severity', value: reportInc.severity },
                  { label: 'Event Type', value: reportInc.type },
                  { label: 'Timestamp', value: `${new Date().toLocaleDateString()} ${reportInc.time}` },
                  { label: 'Camera', value: reportInc.cam },
                  { label: 'Sector', value: reportInc.sector },
                ].map(m => (
                  <div key={m.label} className="flex justify-between py-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <span className="font-mono text-xs" style={{ color: '#475569', fontSize: 11 }}>{m.label}</span>
                    <span className="font-mono text-xs" style={{ color: '#94a3b8', fontSize: 11 }}>{m.value}</span>
                  </div>
                ))}
              </div>
              <div>
                <div className="section-header">ENTITY INFORMATION</div>
                {[
                  { label: 'Track ID', value: reportInc.track },
                  { label: 'Risk Score', value: `${reportInc.risk}/100` },
                  { label: 'Incident Status', value: reportInc.status },
                  { label: 'Evidence Frames', value: String(reportInc.evidence.frames) },
                  { label: 'Video Clips', value: String(reportInc.evidence.clips) },
                  { label: 'Report Generated By', value: 'OP. SHARMA · AI SYSTEM' },
                ].map(m => (
                  <div key={m.label} className="flex justify-between py-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <span className="font-mono text-xs" style={{ color: '#475569', fontSize: 11 }}>{m.label}</span>
                    <span className="font-mono text-xs" style={{ color: '#94a3b8', fontSize: 11 }}>{m.value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mb-6">
              <div className="section-header">INCIDENT DESCRIPTION</div>
              <div className="font-mono text-xs p-4 rounded-lg" style={{ color: '#64748b', lineHeight: 1.7, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                {reportInc.description}
              </div>
            </div>

            <div>
              <div className="section-header">RISK FACTOR ANALYSIS</div>
              <div className="space-y-2">
                {reportInc.riskFactors.map((f, i) => (
                  <div key={i} className="flex justify-between p-3 rounded" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <span className="font-mono text-xs" style={{ color: '#64748b', fontSize: 11 }}>{f.label}</span>
                    <span className="font-mono text-xs font-700" style={{ color: '#ef4444', fontSize: 11 }}>+{f.score}</span>
                  </div>
                ))}
                <div className="flex justify-between p-3 rounded" style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)' }}>
                  <span className="font-rajdhani font-700 text-xs tracking-widest" style={{ color: '#ef4444' }}>TOTAL RISK SCORE</span>
                  <span className="font-rajdhani font-700" style={{ color: '#ef4444', fontSize: 16 }}>{reportInc.risk}/100</span>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 text-center" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="font-mono text-xs" style={{ color: '#334155', fontSize: 9 }}>
                DISCLAIMER: Risk scores are probabilistic assessments. This report does not constitute legal identification or confirmed criminal attribution. All determinations must be verified by authorized personnel.
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <div style={{ background: 'rgba(13,17,23,0.9)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: 16 }}>
              <div className="section-header">SELECT INCIDENT</div>
              <div className="space-y-1">
                {records.map(i => (
                  <button key={i.id} onClick={() => setReportInc(i)} className="w-full text-left rounded" style={{
                    background: reportInc.id === i.id ? 'rgba(0,212,255,0.08)' : 'none',
                    border: reportInc.id === i.id ? '1px solid rgba(0,212,255,0.2)' : '1px solid transparent',
                    padding: '8px 10px', cursor: 'pointer',
                  }}>
                    <div className="font-mono text-xs" style={{ color: reportInc.id === i.id ? '#00d4ff' : '#64748b', fontSize: 11 }}>{i.id} · {i.type.slice(0, 25)}</div>
                  </button>
                ))}
              </div>
            </div>
            <button onClick={handleExport}
              className="w-full flex items-center justify-center gap-2"
              style={{
                background: exporting ? 'rgba(34,197,94,0.1)' : 'rgba(0,212,255,0.1)',
                border: `1px solid ${exporting ? 'rgba(34,197,94,0.3)' : 'rgba(0,212,255,0.3)'}`,
                color: exporting ? '#22c55e' : '#00d4ff',
                padding: '12px 0', borderRadius: 7, cursor: 'pointer',
                fontFamily: 'Rajdhani', fontWeight: 700, fontSize: 13, letterSpacing: '0.08em',
                transition: 'all 0.3s',
              }}>
              <FileText size={14} />
              {exporting ? '✓ REPORT EXPORTED' : 'EXPORT PDF REPORT'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
