import React, { useRef, useState } from 'react'

const kb = (n) => !n ? '' : n < 1024 * 1024
  ? `${Math.round(n / 1024)} KB`
  : `${(n / 1024 / 1024).toFixed(1)} MB`

const icon = (mime = '') =>
  mime.startsWith('image/') ? '🖼' : mime.includes('pdf') ? '📄' : '📎'

// רשימת קבצים + העלאה. משמשת גם את שי וגם את המפיקה.
export default function FileList({
  files = [], onUpload, onDelete, canDelete = () => true,
  hint = 'לוגו, מיתוג, סקיצות — עד 10MB לקובץ',
}) {
  const inp = useRef(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [confirmId, setConfirmId] = useState(null)

  const pick = async (e) => {
    const list = [...(e.target.files || [])]
    e.target.value = ''
    if (!list.length) return
    setBusy(true); setErr('')
    for (const f of list) {
      try { await onUpload(f) }
      catch (ex) { setErr(ex.message || 'ההעלאה נכשלה'); break }
    }
    setBusy(false)
  }

  return (
    <div>
      {files.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
          {files.map(f => (
            <div key={f.id} className="row gap-2" style={{
              background: 'var(--card-2)', border: '1px solid var(--line)',
              borderRadius: 9, padding: '8px 10px',
            }}>
              <span style={{ fontSize: 17, flex: '0 0 auto' }}>{icon(f.mime)}</span>
              <a href={f.url || '#'} target="_blank" rel="noreferrer" className="grow truncate"
                style={{
                  minWidth: 0, color: 'var(--ink)', textDecoration: 'none',
                  pointerEvents: f.url ? 'auto' : 'none',
                }}>
                <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600 }} className="truncate">{f.name}</span>
                <span className="t-meta">
                  {f.from_client ? 'מהלקוח' : 'משילה'}{f.size ? ` · ${kb(f.size)}` : ''}
                </span>
              </a>
              {onDelete && canDelete(f) && (
                confirmId === f.id
                  ? <button className="btn btn-sm" style={{ flex: '0 0 auto', color: '#fff', background: '#B23A2A', borderColor: '#B23A2A' }}
                      onClick={() => { setConfirmId(null); onDelete(f) }}>בטוח?</button>
                  : <button className="btn btn-ghost btn-sm" style={{ flex: '0 0 auto', color: '#E5735B' }}
                      onClick={() => setConfirmId(f.id)}>✕</button>
              )}
            </div>
          ))}
        </div>
      )}

      {onUpload && (
        <>
          <input ref={inp} type="file" multiple hidden onChange={pick}
            accept="image/*,application/pdf,.ai,.eps,.zip,.psd" />
          <button className="btn btn-sm" style={{ width: '100%' }} disabled={busy}
            onClick={() => inp.current?.click()}>
            {busy ? 'מעלה…' : '📎 צרף קובץ'}
          </button>
          <div className="t-meta" style={{ marginTop: 6, lineHeight: 1.6 }}>{hint}</div>
        </>
      )}
      {err && <div style={{ color: '#E5735B', fontSize: 12.5, marginTop: 6 }}>{err}</div>}
    </div>
  )
}
