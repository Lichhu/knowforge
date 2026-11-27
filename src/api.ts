export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  const response = await fetch(`/api${path}`, {
    ...init,
    headers,
    credentials: 'include',
  })

  if (response.status === 204) return undefined as T

  const body = await response.json().catch(() => ({})) as { message?: string | string[] }
  if (!response.ok) {
    const message = Array.isArray(body.message) ? body.message.join('；') : body.message
    throw new ApiError(message || `请求失败（${response.status}）`, response.status)
  }
  return body as T
}
