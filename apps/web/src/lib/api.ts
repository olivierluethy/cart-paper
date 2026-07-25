export const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '')

export class ApiError extends Error {
  status: number
  detail: unknown

  constructor(status: number, message: string, detail?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.detail = detail
  }
}

type Options = {
  method?: string
  body?: unknown
  /** Draft previews carry their invite token so the API can authorise the read. */
  invite?: string | null
  signal?: AbortSignal
  raw?: boolean
  headers?: Record<string, string>
}

let refreshing: Promise<boolean> | null = null

/** One refresh at a time, shared by every request that raced into a 401. */
async function refreshSession(): Promise<boolean> {
  if (!refreshing) {
    refreshing = fetch(`${API_URL}/auth/refresh`, { method: 'POST', credentials: 'include' })
      .then((res) => res.ok)
      .catch(() => false)
      .finally(() => {
        setTimeout(() => {
          refreshing = null
        }, 0)
      })
  }
  return refreshing
}

async function toError(res: Response): Promise<ApiError> {
  let detail: unknown
  let message = res.statusText || 'Request failed'
  try {
    const data = await res.json()
    detail = data
    if (typeof data?.detail === 'string') message = data.detail
    else if (Array.isArray(data?.detail) && data.detail[0]?.msg) message = data.detail[0].msg
  } catch {
    /* body was not json — keep the status text */
  }
  return new ApiError(res.status, message, detail)
}

async function send(path: string, opts: Options, retry = true): Promise<Response> {
  const headers: Record<string, string> = { ...opts.headers }
  const isForm = opts.body instanceof FormData
  if (opts.body !== undefined && !isForm) headers['Content-Type'] = 'application/json'
  if (opts.invite) headers['X-Cart-Invite'] = opts.invite

  const res = await fetch(`${API_URL}${path}`, {
    method: opts.method ?? 'GET',
    credentials: 'include',
    signal: opts.signal,
    headers,
    body: isForm ? (opts.body as FormData) : opts.body === undefined ? undefined : JSON.stringify(opts.body),
  })

  // A stale 15-minute access token is the common case, not an error worth showing.
  if (res.status === 401 && retry && !path.startsWith('/auth/refresh')) {
    if (await refreshSession()) return send(path, opts, false)
  }
  return res
}

export async function request<T>(path: string, opts: Options = {}): Promise<T> {
  const res = await send(path, opts)
  if (!res.ok) throw await toError(res)
  if (opts.raw) return res as unknown as T
  if (res.status === 204) return undefined as T
  const text = await res.text()
  return (text ? JSON.parse(text) : undefined) as T
}

export const api = {
  get: <T>(path: string, opts?: Options) => request<T>(path, { ...opts, method: 'GET' }),
  post: <T>(path: string, body?: unknown, opts?: Options) =>
    request<T>(path, { ...opts, method: 'POST', body }),
  patch: <T>(path: string, body?: unknown, opts?: Options) =>
    request<T>(path, { ...opts, method: 'PATCH', body }),
  put: <T>(path: string, body?: unknown, opts?: Options) =>
    request<T>(path, { ...opts, method: 'PUT', body }),
  del: <T>(path: string, opts?: Options) => request<T>(path, { ...opts, method: 'DELETE' }),
  /** Absolute URL for something the API serves directly (media, exports). */
  url: (path: string) => `${API_URL}${path}`,
}

export function mediaUrl(key: string | null | undefined): string | undefined {
  if (!key) return undefined
  if (/^https?:\/\//.test(key)) return key
  return `${API_URL}${key.startsWith('/') ? key : `/media/${key}`}`
}
