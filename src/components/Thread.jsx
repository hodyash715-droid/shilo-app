import React, { useState } from 'react'

const KIND = {
  change: { label: 'בקשת שינוי', color: 'var(--warn)' },
  reject: { label: 'סיבת דחייה', color: 'var(--danger)' },
}

const when = (iso) => {
  const d = new Date(iso)
  const mins = Math.round((Date.now() - d) / 60000)
  if (mins < 1) return 'עכשיו'
  if (mins < 60) return `לפני ${mins} דק׳`
  if (mins < 1440) return `לפני ${Math.round(mins / 60)} שעות`
  return `${d.getDate()}.${d.getMonth() + 1} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

// שיחה על הזמנה. משמש גם את שי וגם את המפיקה — הצד שכותב
// מוגדר ב-mine, כדי שהבועות ייצבעו נכון בשני הכיוונים.
export default function Thread({
  messages = [], mine = 'manager', onSend, placeholder = 'כתוב הודעה…',
  extraAction = null, compact = false,
}) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [kind, setKind] = useState('message')

  const send = async () => {
    const t = text.trim()
    if (!t) return
    setBusy(true)
    try { await onSend(t, kind); setText(''); setKind('message') }
    finally { setBusy(false) }
  }

  const isMine = (m) => (mine === 'client' ? m.from_client : !m.from_client)

  return (
    <div>
      {messages.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
          {messages.map(m => {
            const k = KIND[m.kind]
            const own = isMine(m)
            return (
              <div key={m.id} style={{
                alignSelf: own ? 'flex-start' : 'flex-end',
                maxWidth: '88%',
                background: own ? 'var(--gold-bg)' : 'var(--card-2)',
                border: `1px solid ${k ? k.color : (own ? 'var(--gold)' : 'var(--line)')}`,
                borderRadius: 10, padding: '8px 11px',
              }}>
                {k && (
                  <div style={{ fontSize: 11, fontWeight: 700, color: k.color, marginBottom: 3 }}>{k.label}</div>
                )}
                <div style={{ fontSize: 13.5, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{m.body}</div>
                <div className="t-meta" style={{ marginTop: 4, fontSize: 11, opacity: .75 }}>
                  {m.author || (m.from_client ? 'לקוח' : 'שי')} · {when(m.created_at)}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {onSend && (
        <>
          <textarea className="field" value={text} onChange={e => setText(e.target.value)}
            placeholder={placeholder}
            style={{ height: compact ? 62 : 76, padding: '9px 11px', resize: 'vertical', lineHeight: 1.5 }} />
          <div className="row gap-2 wrap" style={{ marginTop: 8 }}>
            {extraAction}
            <div className="grow" />
            <button className="btn btn-sm btn-solid" onClick={send} disabled={busy || !text.trim()}>
              {busy ? 'שולח…' : 'שלח'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
