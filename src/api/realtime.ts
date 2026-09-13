import { useEffect, useState } from 'react'
import { apiUrl } from './client'

export type CameraRecord = {
  id: string
  sector: string
  status: string
  fps: number
  latency: number
  resolution: string
  location?: { x: number; y: number }
  [key: string]: unknown
}
export type AlertRecord = {
  id: string
  severity: string
  type: string
  cam: string
  track: string
  risk: number
  time: string
  read?: boolean
  [key: string]: unknown
}

type RealtimeSnapshot = {
  cameras: CameraRecord[]
  alerts: AlertRecord[]
  incidents: Array<{ id: string; severity: string; status?: string; createdAt?: string; camera_id?: string; risk_score?: number }>
  health: { api: string; cameraNetwork: string; activeStreams: number }
  timestamp: string
}

const fallbackSnapshot: RealtimeSnapshot = {
  cameras: [],
  alerts: [],
  incidents: [],
  health: { api: 'offline', cameraNetwork: 'warning', activeStreams: 0 },
  timestamp: new Date(0).toISOString(),
}

export function useRealtimeSnapshot() {
  const [snapshot, setSnapshot] = useState<RealtimeSnapshot>(fallbackSnapshot)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    let mounted = true
    const source = new EventSource(apiUrl('/api/events'))

    source.onopen = () => mounted && setConnected(true)
    source.onmessage = (event) => {
      if (!mounted) return
      try {
        const payload = JSON.parse(event.data) as Partial<RealtimeSnapshot> & { type?: string }
        if (
          payload.type === 'snapshot' &&
          Array.isArray(payload.cameras) &&
          Array.isArray(payload.alerts) &&
          Array.isArray(payload.incidents) &&
          payload.health
        ) {
          setSnapshot({
            cameras: payload.cameras,
            alerts: payload.alerts,
            incidents: payload.incidents,
            health: payload.health,
            timestamp: payload.timestamp || new Date().toISOString(),
          })
        }
      } catch {
        setConnected(false)
      }
    }
    source.onerror = () => mounted && setConnected(false)

    return () => {
      mounted = false
      source.close()
    }
  }, [])

  return { ...snapshot, connected }
}
