import { useEffect, useState } from 'react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, ResponsiveContainer, Tooltip
} from 'recharts';
import { apiUrl } from '../api/client';

const TT = ({ contentStyle, labelStyle, itemStyle }: any) => null;
const tooltipStyle = {
  contentStyle: { background: '#0d1117', border: '1px solid rgba(0,212,255,0.2)', borderRadius: 6, fontFamily: 'JetBrains Mono', fontSize: 11 },
  labelStyle: { color: '#94a3b8' }, itemStyle: { color: '#e2e8f0' },
};

export default function Analytics() {
  const [period, setPeriod] = useState('24H');
  const [analyticsData, setAnalyticsData] = useState<any>({
    incidentsOverTime: [],
    threatDistribution: [],
    incidentsBySector: [],
    objectDetections: [],
    riskScores: [],
    topIncidentTypes: [],
    cameraActivity: [],
    summary: {},
  });

  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetch(apiUrl('/api/analytics'), { cache: 'no-store' });
        if (response.ok) {
          const payload = await response.json();
          setAnalyticsData(payload.data || analyticsData);
        }
      } catch {}
    };
    void load();
    const timer = window.setInterval(() => void load(), 5000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="p-5 space-y-5 fade-in">
      <div className="flex items-end justify-between">
        <div>
          <div className="font-rajdhani font-700 tracking-widest" style={{ fontSize: 20, color: '#e2e8f0', letterSpacing: '0.12em' }}>ANALYTICS</div>
          <div className="font-mono text-xs" style={{ color: '#475569' }}>Border Intelligence · Incident & Detection Analytics</div>
        </div>
        <div className="flex gap-1" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, padding: 3 }}>
          {['1H', '6H', '24H', '7D', '30D'].map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              style={{
                padding: '5px 12px', borderRadius: 4, cursor: 'pointer',
                background: period === p ? 'rgba(0,212,255,0.15)' : 'none',
                border: period === p ? '1px solid rgba(0,212,255,0.3)' : '1px solid transparent',
                color: period === p ? '#00d4ff' : '#64748b',
                fontFamily: 'Rajdhani', fontWeight: 700, fontSize: 12, letterSpacing: '0.06em',
              }}>{p}</button>
          ))}
        </div>
      </div>

      {/* Charts grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>

        {/* Incidents over time */}
        <div style={{ background: 'rgba(13,17,23,0.9)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: 20 }}>
          <div className="font-rajdhani font-700 text-xs tracking-widest mb-4" style={{ color: '#94a3b8', letterSpacing: '0.12em' }}>INCIDENTS OVER TIME</div>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={analyticsData.incidentsOverTime}>
              <defs>
                <linearGradient id="gc2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gh2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f97316" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="time" tick={{ fill: '#334155', fontSize: 9, fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#334155', fontSize: 9, fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} width={20} />
              <Tooltip {...tooltipStyle} />
              <Area type="monotone" dataKey="critical" stroke="#ef4444" fill="url(#gc2)" strokeWidth={1.5} dot={false} />
              <Area type="monotone" dataKey="high" stroke="#f97316" fill="url(#gh2)" strokeWidth={1.5} dot={false} />
              <Area type="monotone" dataKey="medium" stroke="#f59e0b" fill="none" strokeWidth={1} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Threat distribution */}
        <div style={{ background: 'rgba(13,17,23,0.9)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: 20 }}>
          <div className="font-rajdhani font-700 text-xs tracking-widest mb-4" style={{ color: '#94a3b8', letterSpacing: '0.12em' }}>THREAT DISTRIBUTION</div>
          <div className="flex items-center">
            <ResponsiveContainer width={160} height={160}>
              <PieChart>
                <Pie data={analyticsData.threatDistribution} cx={75} cy={75} innerRadius={45} outerRadius={70} dataKey="value" strokeWidth={0}>
                  {analyticsData.threatDistribution.map((entry, i) => (
                    <Cell key={i} fill={entry.color} opacity={0.85} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle.contentStyle} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 space-y-2">
              {analyticsData.threatDistribution.map(d => (
                <div key={d.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: d.color }} />
                    <span className="font-mono text-xs" style={{ color: '#64748b', fontSize: 10 }}>{d.name}</span>
                  </div>
                  <span className="font-mono text-xs" style={{ color: '#94a3b8', fontSize: 10 }}>{d.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Incidents by sector */}
        <div style={{ background: 'rgba(13,17,23,0.9)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: 20 }}>
          <div className="font-rajdhani font-700 text-xs tracking-widest mb-4" style={{ color: '#94a3b8', letterSpacing: '0.12em' }}>INCIDENTS BY SECTOR</div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={analyticsData.incidentsBySector} barSize={20}>
              <XAxis dataKey="sector" tick={{ fill: '#334155', fontSize: 9, fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#334155', fontSize: 9, fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} width={20} />
              <Tooltip {...tooltipStyle} />
              <Bar dataKey="count" fill="#00d4ff" opacity={0.7} radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Object detections */}
        <div style={{ background: 'rgba(13,17,23,0.9)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: 20 }}>
          <div className="font-rajdhani font-700 text-xs tracking-widest mb-4" style={{ color: '#94a3b8', letterSpacing: '0.12em' }}>OBJECT DETECTIONS · PERSONS vs VEHICLES</div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={analyticsData.objectDetections} barSize={12}>
              <XAxis dataKey="hour" tick={{ fill: '#334155', fontSize: 9, fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#334155', fontSize: 9, fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} width={20} />
              <Tooltip {...tooltipStyle} />
              <Bar dataKey="persons" fill="#00d4ff" opacity={0.7} radius={[2, 2, 0, 0]} />
              <Bar dataKey="vehicles" fill="#f59e0b" opacity={0.7} radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="flex gap-4 mt-2">
            <div className="flex items-center gap-1.5"><div style={{ width: 8, height: 3, background: '#00d4ff', borderRadius: 1 }} /><span className="font-mono" style={{ color: '#475569', fontSize: 9 }}>PERSONS</span></div>
            <div className="flex items-center gap-1.5"><div style={{ width: 8, height: 3, background: '#f59e0b', borderRadius: 1 }} /><span className="font-mono" style={{ color: '#475569', fontSize: 9 }}>VEHICLES</span></div>
          </div>
        </div>

        {/* Risk score distribution */}
        <div style={{ background: 'rgba(13,17,23,0.9)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: 20 }}>
          <div className="font-rajdhani font-700 text-xs tracking-widest mb-4" style={{ color: '#94a3b8', letterSpacing: '0.12em' }}>RISK SCORE DISTRIBUTION</div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={analyticsData.riskScores} barSize={28}>
              <XAxis dataKey="range" tick={{ fill: '#334155', fontSize: 9, fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#334155', fontSize: 9, fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} width={20} />
              <Tooltip {...tooltipStyle} />
              <Bar dataKey="count" radius={[2, 2, 0, 0]}>
                {analyticsData.riskScores.map((_, i) => (
                  <Cell key={i} fill={['#22c55e', '#a3e635', '#f59e0b', '#f97316', '#ef4444'][i]} opacity={0.75} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Top incident types */}
        <div style={{ background: 'rgba(13,17,23,0.9)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: 20 }}>
          <div className="font-rajdhani font-700 text-xs tracking-widest mb-4" style={{ color: '#94a3b8', letterSpacing: '0.12em' }}>TOP INCIDENT TYPES</div>
          <div className="space-y-3">
            {analyticsData.topIncidentTypes.map((t, i) => {
              const max = Math.max(...analyticsData.topIncidentTypes.map(x => x.count));
              const pct = (t.count / max) * 100;
              const colors = ['#ef4444', '#f97316', '#f59e0b', '#00d4ff', '#22c55e'];
              return (
                <div key={t.type}>
                  <div className="flex justify-between mb-1">
                    <span className="font-rajdhani font-700 text-xs" style={{ color: '#94a3b8', letterSpacing: '0.04em' }}>{t.type}</span>
                    <span className="font-mono text-xs" style={{ color: colors[i], fontSize: 11, fontWeight: 700 }}>{t.count}</span>
                  </div>
                  <div style={{ height: 4, background: 'rgba(255,255,255,0.04)', borderRadius: 2 }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: colors[i], borderRadius: 2, transition: 'width 0.5s ease', opacity: 0.75 }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
