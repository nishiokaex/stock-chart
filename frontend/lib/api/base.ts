const DEFAULT_BASE_URL = 'http://localhost:8787'

const normalizeBaseUrl = (value: string) => value.replace(/\/$/, '')

const API_BASE_URL = normalizeBaseUrl(process.env.EXPO_PUBLIC_API_BASE_URL ?? DEFAULT_BASE_URL)

export const buildApiUrl = (path: string) => {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path
  }
  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`
}
