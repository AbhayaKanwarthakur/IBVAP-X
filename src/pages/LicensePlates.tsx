import { useEffect, useState } from 'react'
import { apiUrl } from '../api/client'
import { Download, RefreshCw } from 'lucide-react'

type LiceplateRecord = { id: string; name: 'liceplate'; plate: string; confidence: number; cameraId: string; location: string; sensitive: boolean; recordedAt: string }

type Filter = 'all' | 'sensitive' | 'normal'

export default function LicensePlates() {
  const [records, setRecords] = useState<LiceplateRecord[]>([])
  const [filter, setFilter] = useState<Filter>('all')

  const loadRecords = async () => {
    const response = await fetch(apiUrl('/api/liceplates'), { cache: 'no-store' })
    if (response.ok) setRecords((await response.json()).data as LiceplateRecord[])
  }

  useEffect(() => { void loadRecords() }, [])

  const visibleRecords = records.filter((record) => filter === 'all' || (filter === 'sensitive' ? record.sensitive : !record.sensitive))

  const downloadTxt = () => {
    const content = visibleRecords.map((record) => [
      `NAME: ${record.name}`,
      `PLATE NUMBER: ${record.plate}`,
      `DATE/TIME: ${new Date(record.recordedAt).toLocaleString()}`,
      `LOCATION: ${record.location}`,
      `CAMERA: ${record.cameraId}`,
      `CONFIDENCE: ${Math.round(record.confidence * 100)}%`,
      `SENSITIVE: ${record.sensitive ? 'YES' : 'NO'}`,
      '----------------------------------------',
    ].join('\n')).join('\n') || 'No validated license plates recorded.'
    const url = URL.createObjectURL(new Blob([content], { type: 'text/plain;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `liceplates-${new Date().toISOString().slice(0, 10)}.txt`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="p-5 min-h-full space-y-5 fade-in">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="font-rajdhani font-700 tracking-widest" style={{ fontSize: 22, color: '#e2e8f0', letterSpacing: '0.12em' }}>LICENSE PLATES</div>
          <div className="font-mono mt-1" style={{ color: '#64748b', fontSize: 10, letterSpacing: '0.08em' }}>VALIDATED CAPTURES · LOCAL RECORDS · NO OWNER DATA</div>
        </div>
        <div className="flex gap-2">
          <button className="btn-ghost flex items-center gap-2" onClick={() => void loadRecords()}><RefreshCw size={14} /> REFRESH</button>
          <button className="btn-primary flex items-center gap-2" onClick={downloadTxt}><Download size={14} /> DOWNLOAD TXT</button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(['all', 'sensitive', 'normal'] as Filter[]).map((value) => <button key={value} className={filter === value ? 'btn-primary' : 'btn-ghost'} onClick={() => setFilter(value)}>{value === 'all' ? 'ALL RECORDS' : value === 'sensitive' ? 'SENSITIVE ONLY' : 'NORMAL ONLY'}</button>)}
        <span className="font-mono ml-auto" style={{ color: '#64748b', fontSize: 10 }}>{visibleRecords.length} RECORD{visibleRecords.length === 1 ? '' : 'S'} · SAVED IN server/data/state.json</span>
      </div>

      <section className="glass overflow-x-auto" style={{ borderRadius: 10 }}>
        <table className="w-full text-left">
          <thead><tr className="border-b border-white/10"><th className="p-3 font-mono text-[10px] text-slate-500">PLATE NUMBER</th><th className="p-3 font-mono text-[10px] text-slate-500">DATE / TIME</th><th className="p-3 font-mono text-[10px] text-slate-500">LOCATION</th><th className="p-3 font-mono text-[10px] text-slate-500">CONFIDENCE</th><th className="p-3 font-mono text-[10px] text-slate-500">FIELD</th><th className="p-3 font-mono text-[10px] text-slate-500">STATUS</th></tr></thead>
          <tbody>{visibleRecords.map((record) => <tr key={record.id} className="border-b border-white/5"><td className="p-3 font-mono text-sm text-amber-300">{record.plate}</td><td className="p-3 font-mono text-[11px] text-slate-300">{new Date(record.recordedAt).toLocaleString()}</td><td className="p-3 font-mono text-[11px] text-slate-300">{record.location}</td><td className="p-3 font-mono text-[11px] text-slate-300">{Math.round(record.confidence * 100)}%</td><td className="p-3 font-mono text-[10px]" style={{ color: record.sensitive ? '#ef4444' : '#22c55e' }}>{record.sensitive ? 'SENSITIVE' : 'NORMAL'}</td><td className="p-3 font-mono text-[10px]" style={{ color: (record as any).authorized ? '#22c55e' : '#f59e0b' }}>{(record as any).authorized ? 'AUTHORIZED' : 'UNKNOWN'}</td></tr>)}</tbody>
        </table>
        {visibleRecords.length === 0 && <div className="p-8 text-center font-mono text-[11px] text-slate-500">No validated license plate records.</div>}
      </section>
    </div>
  )
}
