import React from 'react'
import { STATUSES, statusIndex, fmtDate, relLabel, isUrgent, ils } from '../data.js'
import { Thumb, catLabel } from './ui.jsx'

export default function JobDetail({ job, onClose, onStatus }) {
  if (!job) return null
  const curIdx = statusIndex(job.status)
  const urgent = isUrgent(job)
  const next = STATUSES[curIdx + 1]
  const itemsTotal = job.items.reduce((s, it) => s + it.price, 0)

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 40,
      background: 'rgba(24,19,16,.32)', display: 'flex', justifyContent: 'flex-start',
    }}>
      <div onClick={e => e.stopPropagation()} className="jd-panel" style={{
        width: 'min(440px, 100%)', height: '100%', background: 'var(--card)',
        borderInlineEnd: '1px solid var(--line)', boxShadow: 'var(--shadow-pop)',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* כותרת */}
        <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--line)' }}>
          <div className="row between gap-2">
            <div className="t-meta">{job.client} · {job.contact}</div>
            <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="סגור">✕</button>
          </div>
          <div className="t-h2" style={{ marginTop: 4 }}>{job.title}</div>
          <div className="row gap-2" style={{ marginTop: 8 }}>
            <span className={urgent ? 'chip chip-signal' : 'chip'}>
              {urgent && <span className="chip-dot" />}🗓 {fmtDate(job.eventDate)}
            </span>
            <span className="t-meta">{relLabel(job.eventDate)}</span>
          </div>
        </div>

        {/* גוף גליל */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 18 }}>
          {/* צינור סטטוס */}
          <div className="t-meta" style={{ marginBottom: 8 }}>סטטוס</div>
          <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
            {STATUSES.map((s, i) => (
              <button key={s.id} onClick={() => onStatus(job.id, s.id)}
                title={s.label}
                style={{
                  flex: 1, height: 6, borderRadius: 3, border: 0, cursor: 'pointer', padding: 0,
                  background: i <= curIdx ? 'var(--gold)' : 'var(--hair)',
                }} />
            ))}
          </div>
          <div className="row between gap-2" style={{ marginBottom: 18 }}>
            <div style={{ fontWeight: 700 }}>{STATUSES[curIdx].label}</div>
            {next
              ? <button className="btn btn-sm btn-solid" onClick={() => onStatus(job.id, next.id)}>
                  קדם ל“{next.label}” ←
                </button>
              : <span className="chip chip-go"><span className="chip-dot" />הושלם</span>}
          </div>

          {/* פריטים */}
          <div className="row between" style={{ marginBottom: 8 }}>
            <div className="t-meta">פריטים</div>
            <div className="t-meta">{job.items.length} סוגים</div>
          </div>
          {job.items.length === 0 ? (
            <div className="card" style={{ padding: 16, borderStyle: 'dashed', textAlign: 'center', marginBottom: 18 }}>
              <div style={{ fontWeight: 600 }}>עוד לא הוגדרו פריטים</div>
              <div className="muted" style={{ fontSize: 13 }}>הוסף קוליסה, שטיח או שלט לעבודה.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
              {job.items.map((it, i) => (
                <div key={i} className="row gap-3" style={{
                  background: 'var(--card-2)', border: '1px solid var(--line)',
                  borderRadius: 8, padding: 8,
                }}>
                  <Thumb cat={it.cat} size={44} />
                  <div className="grow" style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }} className="truncate">{it.name}</div>
                    <div className="t-meta">{catLabel(it.cat)} · כמות {it.qty}</div>
                  </div>
                  <div className="mono" style={{ fontWeight: 600 }}>{ils(it.price)}</div>
                </div>
              ))}
            </div>
          )}

          {job.items.length > 0 && (
            <div className="row between" style={{ padding: '10px 4px', borderTop: '1px solid var(--hair)' }}>
              <div style={{ fontWeight: 700 }}>סה״כ הצעה</div>
              <div className="mono" style={{ fontSize: 18, fontWeight: 600 }}>{ils(job.price || itemsTotal)}</div>
            </div>
          )}

          {/* צוות + הערה */}
          <div className="t-meta" style={{ margin: '16px 0 8px' }}>צוות התקנה</div>
          <div className="row gap-2 wrap">
            {job.team.length
              ? job.team.map((t, i) => <span key={i} className="chip">{t}</span>)
              : <span className="muted" style={{ fontSize: 13 }}>טרם שובץ צוות</span>}
          </div>

          {job.note && (
            <>
              <div className="t-meta" style={{ margin: '16px 0 6px' }}>הערה</div>
              <div style={{
                background: 'var(--paper)', border: '1px solid var(--hair)',
                borderRadius: 8, padding: '10px 12px', fontSize: 14, color: 'var(--ink70)',
              }}>{job.note}</div>
            </>
          )}
        </div>

        {/* פוטר */}
        <div style={{ padding: 14, borderTop: '1px solid var(--line)' }} className="row gap-2">
          <button className="btn grow">עריכה</button>
          <button className="btn grow">שיבוץ צוות</button>
        </div>
      </div>
    </div>
  )
}
