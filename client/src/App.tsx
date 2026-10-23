import { useCallback, useEffect, useState, type DragEvent, type FormEvent } from 'react'
import { api, ApiError, formatSize, join, type Item } from './api'

export default function App() {
  const [user, setUser] = useState<string | null>(null)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    api.me().then((r) => setUser(r.username)).catch(() => setUser(null)).finally(() => setChecking(false))
  }, [])

  if (checking) return null
  if (!user) return <Login onLogin={setUser} />
  return <FileManager user={user} onLogout={() => api.logout().finally(() => setUser(null))} />
}

function Login({ onLogin }: { onLogin: (u: string) => void }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError('')
    try {
      onLogin((await api.login(username, password)).username)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <form className="login" onSubmit={submit}>
      <h1>Gerenciador de arquivos</h1>
      <input placeholder="Usuário" value={username} onChange={(e) => setUsername(e.target.value)} autoFocus />
      <input placeholder="Senha" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
      {error && <p className="error">{error}</p>}
      <button type="submit">Entrar</button>
    </form>
  )
}

const PREVIEWABLE = /\.(png|jpe?g|gif|webp|pdf|mp4|mp3|txt|md|json|csv|log|js|ts|css|xml|ya?ml)$/i

function FileManager({ user, onLogout }: { user: string; onLogout: () => void }) {
  const [path, setPath] = useState('')
  const [items, setItems] = useState<Item[]>([])
  const [error, setError] = useState('')
  const [progress, setProgress] = useState<number | null>(null)
  const [dragging, setDragging] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setItems((await api.list(path)).items)
      setError('')
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return onLogout()
      setError((err as Error).message)
    }
  }, [path, onLogout])

  useEffect(() => {
    load()
  }, [load])

  async function run(action: () => Promise<unknown>) {
    try {
      await action()
      await load()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  async function upload(files: File[]) {
    if (!files.length) return
    setProgress(0)
    await run(() => api.upload(path, files, setProgress))
    setProgress(null)
  }

  function onDrop(e: DragEvent) {
    e.preventDefault()
    setDragging(false)
    upload(Array.from(e.dataTransfer.files))
  }

  const crumbs = path ? path.split('/') : []

  return (
    <div
      className={`app ${dragging ? 'dragging' : ''}`}
      onDragOver={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
    >
      <header>
        <h1>Arquivos</h1>
        <span className="user">
          {user} <button className="link" onClick={onLogout}>Sair</button>
        </span>
      </header>

      <nav className="crumbs">
        <button className="link" onClick={() => setPath('')}>Início</button>
        {crumbs.map((c, i) => (
          <span key={i}>
            {' / '}
            <button className="link" onClick={() => setPath(crumbs.slice(0, i + 1).join('/'))}>{c}</button>
          </span>
        ))}
      </nav>

      <div className="toolbar">
        <label className="button">
          Enviar arquivos
          <input type="file" multiple hidden onChange={(e) => upload(Array.from(e.target.files ?? []))} />
        </label>
        <button
          onClick={() => {
            const name = prompt('Nome da nova pasta')
            if (name) run(() => api.mkdir(path, name))
          }}
        >
          Nova pasta
        </button>
        {progress !== null && <span className="progress">Enviando… {progress}%</span>}
      </div>

      {error && <p className="error" onClick={() => setError('')}>{error}</p>}

      <table>
        <thead>
          <tr>
            <th>Nome</th>
            <th>Tamanho</th>
            <th>Modificado</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {items.length === 0 && (
            <tr>
              <td colSpan={4} className="empty">Pasta vazia. Arraste arquivos para cá.</td>
            </tr>
          )}
          {items.map((item) => {
            const full = join(path, item.name)
            return (
              <tr key={item.name}>
                <td>
                  {item.type === 'dir' ? (
                    <button className="link" onClick={() => setPath(full)}>📁 {item.name}</button>
                  ) : PREVIEWABLE.test(item.name) ? (
                    <button className="link" onClick={() => setPreview(full)}>📄 {item.name}</button>
                  ) : (
                    <span>📄 {item.name}</span>
                  )}
                </td>
                <td>{item.type === 'file' ? formatSize(item.size) : '—'}</td>
                <td>{new Date(item.modified).toLocaleString('pt-BR')}</td>
                <td>
                  <div className="actions">
                  {item.type === 'file' && <a href={api.fileUrl(full)}>Baixar</a>}
                  <button
                    className="link"
                    onClick={() => {
                      const name = prompt('Novo nome', item.name)
                      if (name && name !== item.name) run(() => api.rename(full, name))
                    }}
                  >
                    Renomear
                  </button>
                  <button
                    className="link"
                    onClick={() => {
                      const dest = prompt('Mover para a pasta (vazio = raiz)', path)
                      if (dest !== null) run(() => api.move(full, dest.replace(/^\/+|\/+$/g, '')))
                    }}
                  >
                    Mover
                  </button>
                  <button
                    className="link danger"
                    onClick={() => confirm(`Excluir "${item.name}"?`) && run(() => api.remove(full))}
                  >
                    Excluir
                  </button>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {preview && <Preview path={preview} onClose={() => setPreview(null)} />}
    </div>
  )
}

function Preview({ path, onClose }: { path: string; onClose: () => void }) {
  const url = api.fileUrl(path, true)
  const [text, setText] = useState<string | null>(null)
  const isImage = /\.(png|jpe?g|gif|webp)$/i.test(path)
  const isVideo = /\.mp4$/i.test(path)
  const isAudio = /\.mp3$/i.test(path)
  const isPdf = /\.pdf$/i.test(path)
  const isText = !isImage && !isVideo && !isAudio && !isPdf

  useEffect(() => {
    if (isText) fetch(url).then((r) => r.text()).then(setText)
  }, [url, isText])

  return (
    <div className="modal" onClick={onClose}>
      <div className="modal-body" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <strong>{path.split('/').pop()}</strong>
          <button className="link" onClick={onClose}>Fechar</button>
        </div>
        {isImage && <img src={url} alt="" />}
        {isVideo && <video src={url} controls />}
        {isAudio && <audio src={url} controls />}
        {isPdf && <iframe src={url} title="PDF" />}
        {isText && <pre>{text ?? 'Carregando…'}</pre>}
      </div>
    </div>
  )
}
