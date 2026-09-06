import React, { useState } from 'react'
import { STATUSES, statusIndex, fmtDate, relLabel, isUrgent, ils, shiftKindLabel, quoteOf, waLink } from '../data.js'
import { Thumb, catLabel, EmpAvatar } from './ui.jsx'
import ShiftEdit from './ShiftEdit.jsx'

export default function JobDetail({ job, onClose, onStatus, onEdit, shifts, employees, onShiftSaved, onShiftDeleted, onQuote }) {
  const [shiftEdit, setShiftEdit] = useState(undefined) // undefined=closed, null=new, shift=edit
  if (!job) return null
  const curIdx = statusIndex(job.status)
  const urgent = isUrgent(job)
  const next = STATUSES[curIdx + 1]
  const itemsTotal = job.items.reduce((s, it) => s + it.price, 0)
  const jobShifts = (shifts || []).filter(s => s.job_id === job.id)
    .sort((a, b) => (a.date || '').localeCompare(b.date || '') || (a.start_time || '').localeCompare(b.start_time || ''))

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 40,
      background: 'rgba(0,0,0,.5)', display: 'flex', justifyContent: 'flex-start',
    }}>
      <div onClick={e => e.stopPropagation()} className="jd-panel" style={{
        width: 'min(440px, 100%)', height: '100%', background: 'var(--card)',
        borderInlineEnd: '1px solid var(--line)', boxShadow: 'var(--shadow-pop)',
        display: 'flex', flexDirection: 'column',
      }}>
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

        <div style={{ flex: 1, overflowY: 'auto', padding: 18 }}>
          {/* צינור סטטוס */}
          <div className="t-meta" style={{ marginBottom: 8 }}>סטטוס</div>
          <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
            {STATUSES.map((s, i) => (
              <button key={s.id} onClick={() => onStatus(job.id, s.id)} title={s.label}
                style={{ flex: 1, height: 6, borderRadius: 3, border: 0, cursor: 'pointer', padding: 0, background: i <= curIdx ? 'var(--gold)' : 'var(--hair)' }} />
            ))}
          </div>
          <div className="row between gap-2" style={{ marginBottom: 18 }}>
            <div style={{ fontWeight: 700 }}>{STATUSES[curIdx].label}</div>
            {next
              ? <button className="btn btn-sm btn-solid" onClick={() => onStatus(job.id, next.id)}>קדם ל“{next.label}” ←</button>
              : <span className="chip chip-go"><span className="chip-dot" />הושלם</span>}
          </div>

          {/* הצעת מחיר */}
          {(() => {
            const q = quoteOf(job)
            const msg = `שלום ${job.client},\nמצורפת הצעת מחיר לאירוע "${job.title}" בתאריך ${fmtDate(job.eventDate)}.\nסה״כ: ${ils(job.price || itemsTotal)}\nנשמח לאישורך.`
            const wa = waLink(job.contact, msg)
            return (
              <>
                <div className="t-meta" style={{ marginBottom: 8 }}>הצעת מחיר</div>
                <div style={{
                  background: 'var(--card-2)', border: `1px solid ${q.id === 'none' ? 'var(--line)' : q.color}`,
                  borderRadius: 10, padding: 12, marginBottom: 18,
                }}>
                  <div className="row between gap-2" style={{ marginBottom: 10 }}>
                    <span style={{ fontWeight: 700, fontSize: 14, color: q.color }}>{q.label}</span>
                    <span className="mono" style={{ fontWeight: 600 }}>{ils(job.price || itemsTotal)}</span>
                  </div>
                  <div className="row gap-2 wrap">
                    {job.quoteStatus !== 'sent' && job.quoteStatus !== 'approved' && (
                      <button className="btn btn-sm btn-solid" onClick={() => onQuote(job.id, 'sent')}>סמן: ההצעה נשלחה</button>
                    )}
                    {job.quoteStatus === 'sent' && (
                      <>
                        <button className="btn btn-sm btn-solid" onClick={() => onQuote(job.id, 'approved')}>הלקוח אישר ✓</button>
                        <button className="btn btn-sm" style={{ color: '#E5735B' }} onClick={() => onQuote(job.id, 'rejected')}>נדחתה</button>
                      </>
                    )}
                    {job.quoteStatus === 'approved' && (
                      <button className="btn btn-sm" onClick={() => onQuote(job.id, 'sent')}>בטל אישור</button>
                    )}
                    {wa && (
                      <a className="btn btn-sm" href={wa} target="_blank" rel="noreferrer" style={{ textDecoration: 'none', color: '#55C07E' }}>
                        שלח בוואטסאפ
                      </a>
                    )}
                  </div>
                </div>
              </>
            )
          })()}

          {/* משמרות */}
          <div className="row between" style={{ marginBottom: 8 }}>
            <div className="t-meta">משמרות הקמה / פירוק</div>
            <button className="btn btn-sm" onClick={() => setShiftEdit(null)}>＋ משמרת</button>
          </div>
          {jobShifts.length === 0 ? (
            <div className="muted" style={{ fontSize: 13, marginBottom: 18 }}>לא הוגדרו משמרות עדיין.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
              {jobShifts.map(sh => {
                const filled = sh.assigned.length >= sh.need
                const crew = sh.assigned.map(id => employees.find(e => e.id === id)).filter(Boolean)
                return (
                  <button key={sh.id} onClick={() => setShiftEdit(sh)} style={{
                    appearance: 'none', width: '100%', textAlign: 'start', cursor: 'pointer', font: 'inherit', color: 'var(--ink)',
                    background: 'var(--card-2)', border: '1px solid var(--line)', borderRadius: 8, padding: 10,
                    display: 'flex', alignItems: 'center', gap: 10,
                  }}>
                    <span className="chip" style={{ flex: 'none' }}>{shiftKindLabel(sh.kind)}</span>
                    <div className="grow" style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 13.5 }}>
                        {fmtDate(sh.date)} · <span className="mono">{sh.start_time}–{sh.end_time}</span>
                      </div>
                      <div className="row gap-1" style={{ marginTop: 5 }}>
                        {crew.slice(0, 4).map(e => <EmpAvatar key={e.id} name={e.name} size={22} />)}
                        <span className="t-meta" style={{ marginInlineStart: 4 }}>{sh.assigned.length}/{sh.need}</span>
                      </div>
                    </div>
                    <span className={filled ? 'chip chip-go' : 'chip chip-signal'} style={{ flex: 'none' }}>{filled ? 'מלא' : 'חסר'}</span>
                  </button>
                )
              })}
            </div>
          )}

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
                <div key={i} className="row gap-3" style={{ background: 'var(--card-2)', border: '1px solid var(--line)', borderRadius: 8, padding: 8 }}>
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

          {job.note && (
            <>
              <div className="t-meta" style={{ margin: '16px 0 6px' }}>הערה</div>
              <div style={{ background: 'var(--card-2)', border: '1px solid var(--line)', borderRadius: 8, padding: '10px 12px', fontSize: 14, color: 'var(--ink70)' }}>{job.note}</div>
            </>
          )}
        </div>

        <div style={{ padding: 14, borderTop: '1px solid var(--line)' }} className="row gap-2">
          <button className="btn btn-solid grow" onClick={onEdit}>עריכת העבודה</button>
        </div>
      </div>

      {shiftEdit !== undefined && (
        <ShiftEdit shift={shiftEdit} jobId={job.id} jobDate={job.eventDate} employees={employees}
          onClose={() => setShiftEdit(undefined)}
          onSaved={(s) => { onShiftSaved(s); setShiftEdit(undefined) }}
          onDeleted={(id) => { onShiftDeleted(id); setShiftEdit(undefined) }} />
      )}
    </div>
  )
}
