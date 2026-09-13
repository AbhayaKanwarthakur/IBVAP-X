import { useEffect, useRef, useState } from 'react'
import { Plus, Trash2, CheckCircle, Circle, PenTool, X, Zap } from 'lucide-react'
import { apiUrl } from '../api/client'

type ZoneType = 'danger' | 'safe'
type Point = [number, number]

interface ZoneDef {
  id?: string
  name: string
  polygon: Point[]
  type: ZoneType
  loiter_seconds?: number
}

interface FovProfile {
  id: string
  name: string
  zones: ZoneDef[]
  active: boolean
  createdAt: string
}

export default function ZoneEditor() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [snapshot, setSnapshot] = useState('')
  const [profiles, setProfiles] = useState<FovProfile[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [msg, setMsg] = useState('')
  const [msgOk, setMsgOk] = useState(true)
  const [activating, setActivating] = useState(false)
  const [movingZoneName, setMovingZoneName] = useState<string | null>(null)

  // Drawing state — all refs to avoid stale closures
  const isDrawingRef = useRef(false)
  const pointsRef = useRef<Point[]>([])
  const zoneNameRef = useRef('')
  const zoneTypeRef = useRef<ZoneType>('danger')
  const loiterRef = useRef(20)
  const dblRef = useRef(false)
  const lastClickRef = useRef(0)
  const moveRef = useRef<{ name: string; start: Point; original: Point[]; polygon?: Point[] } | null>(null)

  // Mirror to state for rendering
  const [isDrawing, setIsDrawing] = useState(false)
  const [points, setPoints] = useState<Point[]>([])
  const [zoneName, setZoneName] = useState('')
  const [zoneType, setZoneType] = useState<ZoneType>('danger')
  const [loiter, setLoiter] = useState(20)
  const [newProfileName, setNewProfileName] = useState('')

  useEffect(() => { zoneNameRef.current = zoneName }, [zoneName])
  useEffect(() => { zoneTypeRef.current = zoneType }, [zoneType])
  useEffect(() => { loiterRef.current = loiter }, [loiter])

  const selected = profiles.find(p => p.id === selectedId) ?? null

  // Snapshot polling
  useEffect(() => {
    const load = async () => {
      try {
        const r = await fetch(apiUrl('/api/cameras/CAM-PHONE/frame'), { cache: 'no-store' })
        if (r.ok) { const blob = await r.blob(); setSnapshot(prev => { URL.revokeObjectURL(prev); return URL.createObjectURL(blob) }) }
      } catch {}
    }
    load(); const t = setInterval(load, 3000); return () => clearInterval(t)
  }, [])

  // Load profiles
  useEffect(() => {
    fetch(apiUrl('/api/fov-profiles')).then(r => r.json()).then(d => {
      const list: FovProfile[] = d.data || []
      setProfiles(list)
      const active = list.find(p => p.active)
      if (active) setSelectedId(active.id)
      else if (list.length > 0) setSelectedId(list[0].id)
    }).catch(() => {})
  }, [])

  // Canvas redraw
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const W = canvas.width, H = canvas.height
    ctx.clearRect(0, 0, W, H)
    const px = (p: Point): [number, number] => [p[0] * W, p[1] * H]

    const zonesToDraw = selected?.zones ?? []
    for (const z of zonesToDraw) {
      const pts = z.polygon.map(px)
      const c = z.type === 'danger' ? '#ef4444' : '#22c55e'
      ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1])
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1])
      ctx.closePath()
      ctx.fillStyle = c + '28'; ctx.fill()
      ctx.strokeStyle = c; ctx.lineWidth = 2; ctx.setLineDash([]); ctx.stroke()
      const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length
      const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length
      ctx.fillStyle = c; ctx.font = 'bold 11px monospace'; ctx.textAlign = 'center'
      ctx.fillText(z.name.toUpperCase(), cx, cy)
      ctx.font = '9px monospace'
      ctx.fillText(z.type === 'danger' ? '⚠ RESTRICTED' : '✓ SAFE', cx, cy + 14)
    }

    if (points.length > 0) {
      const pts = points.map(px)
      const c = zoneType === 'danger' ? '#ef4444' : '#22c55e'
      ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1])
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1])
      ctx.strokeStyle = c; ctx.lineWidth = 2; ctx.setLineDash([4, 2]); ctx.stroke(); ctx.setLineDash([])
      for (const [x, y] of pts) {
        ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2)
        ctx.fillStyle = c; ctx.fill()
      }
      if (pts.length >= 3) {
        ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1])
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1])
        ctx.closePath(); ctx.fillStyle = c + '18'; ctx.fill()
      }
    }
  }, [selected, points, zoneType, snapshot])

  const notify = (text: string, ok = true) => { setMsg(text); setMsgOk(ok) }

  const createProfile = async () => {
    const n = newProfileName.trim(); if (!n) return
    const r = await fetch(apiUrl('/api/fov-profiles'), {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Operator-Id': 'zone-editor' },
      body: JSON.stringify({ name: n, cameraId: 'CAM-PHONE', zones: [] })
    })
    const d = await r.json()
    if (!r.ok) { notify(d.error, false); return }
    setProfiles(prev => [...prev, d.data])
    setSelectedId(d.data.id)
    setNewProfileName('')
    notify(`Profile "${n}" created`)
  }

  const deleteProfile = async (id: string) => {
    await fetch(apiUrl('/api/fov-profiles'), {
      method: 'DELETE', headers: { 'Content-Type': 'application/json', 'X-Operator-Id': 'zone-editor' },
      body: JSON.stringify({ id })
    })
    setProfiles(prev => prev.filter(p => p.id !== id))
    if (selectedId === id) setSelectedId(profiles.find(p => p.id !== id)?.id ?? null)
    notify('Profile deleted')
  }

  const activateProfile = async (id: string) => {
    setActivating(true)
    const r = await fetch(apiUrl('/api/fov-profiles/activate'), {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Operator-Id': 'zone-editor' },
      body: JSON.stringify({ id })
    })
    const d = await r.json()
    if (!r.ok) { notify(d.error, false); setActivating(false); return }
    setProfiles(prev => prev.map(p => ({ ...p, active: p.id === id })))
    notify(`Profile "${d.data.name}" is now active — AI updated ✓`)
    setActivating(false)
  }

  const startDraw = () => {
    if (!selected) { notify('Select or create a profile first', false); return }
    pointsRef.current = []; setPoints([])
    isDrawingRef.current = true; setIsDrawing(true)
    notify('Click to place points · Double-click to close zone')
  }

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return
    const now = Date.now()
    if (now - lastClickRef.current < 300) return // part of a double-click
    lastClickRef.current = now
    const rect = canvasRef.current!.getBoundingClientRect()
    const p: Point = [(e.clientX - rect.left) / rect.width, (e.clientY - rect.top) / rect.height]
    pointsRef.current = [...pointsRef.current, p]
    setPoints([...pointsRef.current])
  }

  const handleDblClick = () => { closePolygon() }

  const handleMoveStart = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!movingZoneName || isDrawingRef.current || !selected) return
    const rect = canvasRef.current!.getBoundingClientRect()
    const start: Point = [(e.clientX - rect.left) / rect.width, (e.clientY - rect.top) / rect.height]
    const zone = selected.zones.find(z => z.name === movingZoneName)
    if (!zone) return
    moveRef.current = { name: zone.name, start, original: zone.polygon }
    canvasRef.current?.setPointerCapture(e.nativeEvent.pointerId)
  }

  const handleMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const move = moveRef.current
    if (!move || !selected) return
    const rect = canvasRef.current!.getBoundingClientRect()
    const current: Point = [(e.clientX - rect.left) / rect.width, (e.clientY - rect.top) / rect.height]
    const dx = current[0] - move.start[0]
    const dy = current[1] - move.start[1]
    const polygon = move.original.map(([x, y]) => [Math.max(0, Math.min(1, x + dx)), Math.max(0, Math.min(1, y + dy))] as Point)
    moveRef.current = { ...move, polygon }
    setProfiles(prev => prev.map(p => p.id === selected.id ? { ...p, zones: p.zones.map(z => z.name === move.name ? { ...z, polygon } : z) } : p))
  }

  const handleMoveEnd = async () => {
    const move = moveRef.current
    moveRef.current = null
    if (!move || !selected) return
    const profile = profiles.find(p => p.id === selected.id)
    if (!profile) return
    const polygon = move.polygon || move.original
    const zones = profile.zones.map(z => z.name === move.name ? { ...z, polygon } : z)
    const r = await fetch(apiUrl('/api/fov-profiles'), {
      method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-Operator-Id': 'zone-editor' },
      body: JSON.stringify({ id: profile.id, zones })
    })
    if (!r.ok) { notify('Unable to save moved zone', false); return }
    const data = await r.json()
    setProfiles(prev => prev.map(p => p.id === data.data.id ? data.data : p))
    notify(`Zone "${move.name}" moved and saved`)
  }

  const closePolygon = async () => {
    const pts = pointsRef.current
    const n = zoneNameRef.current.trim()
    if (pts.length < 3) { notify('Need at least 3 points', false); return }
    if (!n) { notify('Enter a zone name first', false); return }
    const zone: ZoneDef = { id: crypto.randomUUID(), name: n, polygon: pts, type: zoneTypeRef.current, loiter_seconds: loiterRef.current }
    isDrawingRef.current = false; pointsRef.current = []
    setIsDrawing(false); setPoints([])

    const updatedZones = [...(selected!.zones.filter(z => z.name !== zone.name)), zone]
    const r = await fetch(apiUrl('/api/fov-profiles'), {
      method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-Operator-Id': 'zone-editor' },
      body: JSON.stringify({ id: selectedId, zones: updatedZones })
    })
    const d = await r.json()
    if (!r.ok) { notify(d.error, false); return }
    setProfiles(prev => prev.map(p => p.id === selectedId ? d.data : p))
    notify(`Zone "${zone.name}" added to profile ✓`)
    setZoneName('')
  }

  const deleteZone = async (zoneName: string) => {
    const updatedZones = selected!.zones.filter(z => z.name !== zoneName)
    const r = await fetch(apiUrl('/api/fov-profiles'), {
      method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-Operator-Id': 'zone-editor' },
      body: JSON.stringify({ id: selectedId, zones: updatedZones })
    })
    const d = await r.json()
    if (!r.ok) { notify(d.error, false); return }
    setProfiles(prev => prev.map(p => p.id === selectedId ? d.data : p))
    notify(`Zone "${zoneName}" removed`)
  }

  const cancel = () => {
    isDrawingRef.current = false; pointsRef.current = []
    setIsDrawing(false); setPoints([])
  }

  return (
    <div className="p-5 min-h-full space-y-4 fade-in">
      <div>
        <div className="font-rajdhani font-700 tracking-widest" style={{ fontSize: 22, color: '#e2e8f0', letterSpacing: '0.12em' }}>FOV ZONE EDITOR</div>
        <div className="font-mono mt-1" style={{ color: '#64748b', fontSize: 10 }}>CREATE FIELD-OF-VIEW PROFILES · DRAW ZONES · ACTIVATE TO AI ENGINE</div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        {/* Canvas */}
        <div className="glass overflow-hidden" style={{ borderRadius: 10 }}>
          <div className="relative" style={{ background: '#020507', aspectRatio: '16/9' }}>
            {snapshot && <img src={snapshot} alt="" className="absolute inset-0 w-full h-full object-contain pointer-events-none" />}
            {!snapshot && <div className="absolute inset-0 flex items-center justify-center"><span className="font-mono text-slate-500" style={{ fontSize: 11 }}>WAITING FOR CAMERA FRAME...</span></div>}
            <canvas
              ref={canvasRef} width={640} height={360}
              className="absolute inset-0 w-full h-full"
              style={{ cursor: isDrawing ? 'crosshair' : 'default', zIndex: 10, pointerEvents: 'auto' }}
              onClick={handleClick} onDoubleClick={handleDblClick}
              onMouseDown={handleMoveStart} onMouseMove={handleMove} onMouseUp={handleMoveEnd} onMouseLeave={handleMoveEnd}
            />
            {selected?.active && (
              <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1" style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid #22c55e', borderRadius: 4 }}>
                <Zap size={10} color="#22c55e" />
                <span className="font-mono" style={{ fontSize: 9, color: '#22c55e' }}>ACTIVE</span>
              </div>
            )}
          </div>
          <div className="border-t border-white/10 p-3 flex flex-wrap items-center gap-2">
            {!isDrawing
              ? <button className="btn-primary flex items-center gap-2" onClick={startDraw} disabled={!selected}><PenTool size={12} /> DRAW ZONE</button>
              : <>
                  <button className="btn-primary flex items-center gap-2" onClick={closePolygon} disabled={points.length < 3 || !zoneName.trim()}>
                    <CheckCircle size={12} /> CLOSE ({points.length} pts)
                  </button>
                  <button className="btn-ghost flex items-center gap-2" onClick={cancel}><X size={12} /> CANCEL</button>
                </>
            }
            {msg && <span className="font-mono ml-2" style={{ color: msgOk ? '#22c55e' : '#ef4444', fontSize: 10 }}>{msg}</span>}
          </div>
        </div>

        {/* Right panel */}
        <aside className="space-y-3">
          {/* Profile selector */}
          <div className="glass p-3" style={{ borderRadius: 10 }}>
            <div className="section-header mb-2">FOV PROFILES</div>
            <div className="space-y-1 mb-3 max-h-36 overflow-y-auto">
              {profiles.length === 0 && <div className="font-mono text-slate-500" style={{ fontSize: 10 }}>No profiles yet.</div>}
              {profiles.map(p => (
                <div key={p.id}
                  onClick={() => setSelectedId(p.id)}
                  className="flex items-center justify-between gap-2 px-2 py-1.5 cursor-pointer"
                  style={{ background: selectedId === p.id ? 'rgba(56,189,248,0.08)' : 'transparent', border: `1px solid ${selectedId === p.id ? 'rgba(56,189,248,0.3)' : 'rgba(255,255,255,0.06)'}`, borderRadius: 4 }}>
                  <div className="flex items-center gap-2 min-w-0">
                    {p.active
                      ? <Zap size={10} color="#22c55e" />
                      : <Circle size={10} color="#475569" />}
                    <span className="font-mono truncate" style={{ fontSize: 11, color: p.active ? '#22c55e' : '#cbd5e1' }}>{p.name.toUpperCase()}</span>
                    <span className="font-mono" style={{ fontSize: 9, color: '#475569' }}>{p.zones.length}z</span>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={e => { e.stopPropagation(); activateProfile(p.id) }} disabled={activating || p.active}
                      className="px-1.5 py-0.5 font-mono border"
                      style={{ fontSize: 8, borderColor: p.active ? '#22c55e' : 'rgba(255,255,255,0.1)', color: p.active ? '#22c55e' : '#94a3b8', background: 'transparent', borderRadius: 3 }}
                      title="Activate this profile">
                      {p.active ? 'ACTIVE' : 'USE'}
                    </button>
                    <button onClick={e => { e.stopPropagation(); deleteProfile(p.id) }}
                      className="p-0.5 text-slate-500 hover:text-red-400" title="Delete profile"><Trash2 size={10} /></button>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input value={newProfileName} onChange={e => setNewProfileName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && createProfile()}
                placeholder="New profile name..."
                className="flex-1 bg-black/30 border border-white/10 px-2 py-1 font-mono text-slate-200 focus:outline-none focus:border-cyan-400/50" style={{ fontSize: 10 }} />
              <button className="btn-primary px-2" onClick={createProfile}><Plus size={12} /></button>
            </div>
          </div>

          {/* Zone drawing controls */}
          {selected && (
            <div className="glass p-3" style={{ borderRadius: 10 }}>
              <div className="section-header mb-2">NEW ZONE</div>
              <div className="space-y-2">
                <div>
                  <div className="font-mono text-slate-500 mb-1" style={{ fontSize: 9 }}>ZONE NAME</div>
                  <input value={zoneName} onChange={e => setZoneName(e.target.value)} placeholder="e.g. armory"
                    className="w-full bg-black/30 border border-white/10 px-2 py-1.5 font-mono text-slate-200 focus:outline-none focus:border-cyan-400/50" style={{ fontSize: 11 }} />
                </div>
                <div>
                  <div className="font-mono text-slate-500 mb-1" style={{ fontSize: 9 }}>ZONE TYPE</div>
                  <div className="flex gap-2">
                    {(['danger', 'safe'] as ZoneType[]).map(t => (
                      <button key={t} onClick={() => setZoneType(t)} className="flex-1 py-1.5 font-mono border transition-colors" style={{ fontSize: 10,
                        borderColor: zoneType === t ? (t === 'danger' ? '#ef4444' : '#22c55e') : 'rgba(255,255,255,0.1)',
                        color: zoneType === t ? (t === 'danger' ? '#ef4444' : '#22c55e') : '#64748b',
                        background: zoneType === t ? (t === 'danger' ? 'rgba(239,68,68,0.08)' : 'rgba(34,197,94,0.08)') : 'transparent' }}>
                        {t === 'danger' ? '⚠ DANGER' : '✓ SAFE'}
                      </button>
                    ))}
                  </div>
                  <div className="font-mono mt-1" style={{ fontSize: 9, color: '#475569' }}>
                    {zoneType === 'danger' ? 'Outsider entry triggers alert' : 'Loiter detection only'}
                  </div>
                </div>
                {zoneType === 'safe' && (
                  <div>
                    <div className="font-mono text-slate-500 mb-1" style={{ fontSize: 9 }}>LOITER THRESHOLD (s)</div>
                    <input type="number" min={5} max={300} value={loiter} onChange={e => setLoiter(Number(e.target.value))}
                      className="w-full bg-black/30 border border-white/10 px-2 py-1.5 font-mono text-slate-200 focus:outline-none" style={{ fontSize: 11 }} />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Zones in selected profile */}
          {selected && (
            <div className="glass p-3" style={{ borderRadius: 10 }}>
              <div className="flex items-center justify-between mb-2">
                <div className="section-header">ZONES IN "{selected.name.toUpperCase()}"</div>
                <span className="font-mono" style={{ fontSize: 9, color: '#475569' }}>{selected.zones.length} zones</span>
              </div>
              {selected.zones.length === 0 && <div className="font-mono text-slate-500" style={{ fontSize: 10 }}>No zones. Draw one on the camera view.</div>}
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {selected.zones.map((z, i) => (
                  <div key={i} className="flex items-center justify-between gap-2 px-2 py-1.5 border border-white/10">
                    <div className="flex items-center gap-2 min-w-0">
                      <span style={{ color: z.type === 'danger' ? '#ef4444' : '#22c55e', fontSize: 10 }}>{z.type === 'danger' ? '⚠' : '✓'}</span>
                      <span className="font-mono truncate" style={{ fontSize: 10, color: z.type === 'danger' ? '#ef4444' : '#22c55e' }}>{z.name.toUpperCase()}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => setMovingZoneName(movingZoneName === z.name ? null : z.name)} className="font-mono px-1.5 py-0.5 border text-slate-400 hover:text-cyan-300" style={{ fontSize: 8, borderColor: movingZoneName === z.name ? '#38bdf8' : 'rgba(255,255,255,0.1)' }}>{movingZoneName === z.name ? 'MOVING' : 'MOVE'}</button>
                      <button onClick={() => deleteZone(z.name)} className="text-slate-500 hover:text-red-400 shrink-0"><Trash2 size={10} /></button>
                    </div>
                  </div>
                ))}
              </div>
              {!selected.active && selected.zones.length > 0 && (
                <button className="w-full mt-2 py-2 font-mono flex items-center justify-center gap-2 border border-green-500/40 text-green-400 hover:bg-green-500/10 transition-colors"
                  style={{ fontSize: 10 }} onClick={() => activateProfile(selected.id)} disabled={activating}>
                  <Zap size={11} /> ACTIVATE THIS PROFILE
                </button>
              )}
            </div>
          )}

          <div className="glass p-3" style={{ borderRadius: 10 }}>
            <div className="font-mono leading-relaxed" style={{ fontSize: 9, color: '#475569' }}>
              1. Create a profile (e.g. "Armory FOV")<br />
              2. Draw zones on the camera view<br />
              3. Name each zone + set DANGER or SAFE<br />
              4. Click USE / ACTIVATE to push to AI<br />
              Only one profile is active at a time
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
