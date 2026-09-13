const localApiOrigin = import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.hostname}:8787`

export const apiUrl = (path: string) => `${localApiOrigin}${path}`