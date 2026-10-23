export interface Item {
  name: string
  type: 'dir' | 'file'
  size: number
  modified: string
}

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: 'same-origin', ...init })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(res.status, data.error ?? `Erro ${res.status}`)
  return data as T
}

const post = <T,>(url: string, body: unknown) =>
  call<T>(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

export const api = {
  me: () => call<{ username: string }>('/api/me'),
  login: (username: string, password: string) => post<{ username: string }>('/api/login', { username, password }),
  logout: () => post('/api/logout', {}),
  list: (path: string) => call<{ items: Item[] }>(`/api/files/list?path=${encodeURIComponent(path)}`),
  mkdir: (path: string, name: string) => post('/api/files/mkdir', { path, name }),
  rename: (path: string, newName: string) => post('/api/files/rename', { path, newName }),
  move: (path: string, dest: string) => post('/api/files/move', { path, dest }),
  remove: (path: string) => post('/api/files/delete', { path }),
  upload: (path: string, files: File[], onProgress?: (pct: number) => void) =>
    new Promise<void>((resolve, reject) => {
      const form = new FormData()
      form.append('path', path)
      files.forEach((f) => form.append('files', f))
      const xhr = new XMLHttpRequest()
      xhr.open('POST', '/api/files/upload')
      xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(Math.round((e.loaded / e.total) * 100))
      xhr.onload = () => (xhr.status < 300 ? resolve() : reject(new ApiError(xhr.status, 'Falha no envio')))
      xhr.onerror = () => reject(new ApiError(0, 'Falha de rede'))
      xhr.send(form)
    }),
  fileUrl: (path: string, inline = false) =>
    `/api/files/download?path=${encodeURIComponent(path)}${inline ? '&inline=1' : ''}`,
}

export const join = (dir: string, name: string) => (dir ? `${dir}/${name}` : name)

export function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let v = bytes / 1024
  let i = 0
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${v.toFixed(v < 10 ? 1 : 0)} ${units[i]}`
}
