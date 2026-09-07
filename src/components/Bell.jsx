import React, { useEffect, useRef, useState } from 'react'

const ICONS = { order: '📥', quote: '💰', shift: '🗓', info: '•' }

// "לפני 5 דק׳" / "אתמול 14:30"
function ago(iso) {
  const d = new Date(iso)
  const mins = Math.round((Date.now() - d) / 60000)
  if (mins < 1) return 'עכשיו'
  if (mins < 60) return `לפני ${mins} דק׳`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `לפני ${hrs} שעות`
  const days = Math.round(hrs / 24)
  if (days === 1) return 'אתמול'
  if (days < 7) return `לפני ${days} ימים`
  return `${d.getDate()}.${d.getMonth() + 1}`
}

export default function Bell({ items = [], onOpen, onRead, onReadAll }) {
  const [open, setOpen] = useState(false)
  const boxRef = useRef(null)
  const unread = items.filter(n => !n.is_read)

  useEffect(() => {
    if (!open) return
    const away = e => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', away)
    return () => document.removeEventListener('mousedown', away)
  }, [open])

  return (
    <div ref={boxRef} style={{ position: 'relative' }}>
      <button className="btn btn-ghost btn-sm" onClick={() => setOpen(v => !v)}
        aria-label={`התראות${unread.length ? ` — ${unread.length} חדשות` : ''}`}
        style={{ position: 'relative' }}>
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
        {unread.length > 0 && (
          <span className="mono" style={{
            position: 'absolute', top: 1, insetInlineEnd: 1,
            minWidth: 16, height: 16, padding: '0 4px', borderRadius: 999,
            background: 'var(--gold)', color: 'var(--on-gold)',
            fontSize: 10, fontWeight: 700, lineHeight: '16px', textAlign: 'center',
          }}>{unread.length > 9 ? '9+' : unread.length}</span>
        )}
      </button>

      {open && (
        <div className="card" style={{
          position: 'absolute', top: 'calc(100% + 8px)', insetInlineStart: 0,
          width: 'min(340px, calc(100vw - 24px))', maxHeight: 420, overflowY: 'auto',
          zIndex: 50, boxShadow: 'var(--shadow-pop)', padding: 0,
        }}>
          <div className="row between" style={{ padding: '11px 13px', borderBottom: '1px solid var(--line)', position: 'sticky', top: 0, background: 'var(--card)' }}>
            <span style={{ fontWeight: 700 }}>התראות</span>
            {unread.length > 0 && (
              <button className="btn btn-ghost btn-sm" onClick={() => onReadAll(unread.map(n => n.id))}>
                סמן הכל כנקרא
              </button>
            )}
          </div>

          {items.length === 0 ? (
            <div className="muted" style={{ padding: 22, textAlign: 'center', fontSize: 13 }}>
              אין התראות עדיין.
            </div>
          ) : items.map((n, i) => (
            <button key={n.id} onClick={() => { onRead(n); setOpen(false); if (n.job_id) onOpen?.(n.job_id) }}
              style={{
                appearance: 'none', border: 0, width: '100%', textAlign: 'start', cursor: 'pointer',
                font: 'inherit', color: 'var(--ink)', padding: '11px 13px',
                borderTop: i ? '1px solid var(--hair)' : 0,
                background: n.is_read ? 'transparent' : 'var(--gold-bg)',
                display: 'flex', gap: 10, alignItems: 'flex-start',
              }}>
              <span style={{ fontSize: 15, lineHeight: 1.4 }}>{ICONS[n.kind] || ICONS.info}</span>
              <span style={{ minWidth: 0, flex: 1 }}>
                <span style={{ display: 'block', fontWeight: n.is_read ? 500 : 700, fontSize: 14 }}>{n.title}</span>
                {n.body && <span className="t-meta" style={{ display: 'block', marginTop: 1 }}>{n.body}</span>}
                <span className="t-meta" style={{ display: 'block', marginTop: 3, opacity: .7 }}>{ago(n.created_at)}</span>
              </span>
              {!n.is_read && <span style={{ width: 7, height: 7, borderRadius: 999, background: 'var(--gold)', marginTop: 6, flex: '0 0 auto' }} />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
