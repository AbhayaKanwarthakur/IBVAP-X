import { useEffect, useState } from 'react'
import { cameras as fallbackCameras, alerts as fallbackAlerts } from '../data/mockData'

export type CameraRecord = (typeof fallbackCameras)[number]
export type AlertRecord = (typeof fallbackAlerts)[number]

type RealtimeSnapshot = {
  cameras: CameraRecord[]
  alerts: AlertRecord[]
  health: { api: string; cameraNetwork: string; activeStreams: number }
  timestamp: string
}

const fallbackSnapshot: RealtimeSnapshot = {
  cameras: fallbackCameras,
  alerts: fallbackAlerts,
  health: { api: 'offline', cameraNetwork: 'warning', activeStreams: fallbackCameras.filter((camera) => camera.status === 'online').length },
  timestamp: new Date(0).toISOString(),
}

export function useRealtimeSnapshot() {
  const [snapshot, setSnapshot] = useState<RealtimeSnapshot>(fallbackSnapshot)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    let mounted = true
    const source = new EventSource('/api/events')

    source.onopen = () => mounted && setConnected(true)
    source.onmessage = (event) => {
      if (!mounted) return
      try {
        setSnapshot(JSON.parse(event.data) as RealtimeSnapshot)
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
