const apiOrigin = process.env.API_ORIGIN || 'http://localhost:8787'

async function expectJson(path) {
  const response = await fetch(`${apiOrigin}${path}`)
  if (!response.ok) throw new Error(`${path} returned HTTP ${response.status}`)
  return response.json()
}

const health = await expectJson('/api/health')
if (health.status !== 'ok') throw new Error('API health status is not ok')

const cameras = await expectJson('/api/cameras')
if (!Array.isArray(cameras.data)) throw new Error('Camera response is not an array')

const plates = await expectJson('/api/liceplates')
if (!Array.isArray(plates.data)) throw new Error('Plate response is not an array')

const ptz = await expectJson('/api/cameras/CAM-PHONE/ptz')
if (ptz.data?.cameraId !== 'CAM-PHONE' || ptz.data?.visionOnly === true) throw new Error('PTZ capability response is invalid')

const controller = new AbortController()
const timeout = setTimeout(() => controller.abort(), 5000)
try {
  const response = await fetch(`${apiOrigin}/api/events`, { signal: controller.signal })
  if (!response.ok || !response.body) throw new Error(`SSE returned HTTP ${response.status}`)

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let snapshot = null
  while (!snapshot) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let separatorIndex = buffer.indexOf('\n\n')
    while (separatorIndex >= 0) {
      const block = buffer.slice(0, separatorIndex)
      buffer = buffer.slice(separatorIndex + 2)
      const line = block.split('\n').find((entry) => entry.startsWith('data: '))
      if (line) {
        const payload = JSON.parse(line.slice(6))
        if (payload.type === 'snapshot') snapshot = payload
      }
      separatorIndex = buffer.indexOf('\n\n')
    }
  }
  await reader.cancel()
  if (!snapshot || !Array.isArray(snapshot.cameras) || !Array.isArray(snapshot.alerts) || !snapshot.health) {
    throw new Error('SSE did not emit a complete snapshot')
  }
} finally {
  clearTimeout(timeout)
}

console.log('API smoke test passed')
