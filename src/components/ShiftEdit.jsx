import React, { useState } from 'react'
import { SHIFT_KINDS } from '../data.js'
import { createShift, updateShift, deleteShift } from '../db.js'
import { EmpAvatar } from './ui.jsx'

export default function ShiftEdit({ shift, jobId, jobDate, employees, onClose, onSaved, onDeleted }) {
  const editing = Boolean(shift && shift.id)
  const [f, setF] = useState(() => shift ? { ...shift } : {
    kind: 'setup', date: jobDate || '', start_time: '08:00', end_time: '12:00', need: 2, assigned: [],
  })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const set = (k, v) => setF(s => ({ ...s, [k]: v }))
  const label = t => <div className="t-meta" style={{ marginBottom: 6 }}>{t}</div>

  const toggle = (id) => set('assigned', f.assigned.includes(id) ? f.assigned.filter(x => x !== id) : [...f.assigned, id])

  const save = async () => {
    setErr(''); setBusy(true)
    try {
      const payload = {
        job_id: jobId, kind: f.kind, date: f.date || null,
        start_time: f.start_time, end_time: f.end_time,
        need: Number(f.need) || 1, assigned: f.assigned,
      }
      const saved = editing ? await updateShift(shift.id, payload) : await createShift(payload)
      onSaved(saved)
    } catch (e) { setErr('שמירה נכשלה: ' + (e.message || e)); setBusy(false) }
  }
  const remove = async () => {
    setBusy(true)
    try { await deleteShift(shift.id); onDeleted(shift.id) }
    catch (e) { setErr('מחיקה נכשלה: ' + (e.message || e)); setBusy(false) }
  }

  const kindBtn = (k) => (
    <button key={k.id} type="button" onClick={() => set('kind', k.id)} className="btn" style={{
      flex: 1, background: f.kind === k.id ? 'var(--gold)' : 'var(--card)',
      color: f.kind === k.id ? 'var(--on-gold)' : 'var(--ink70)',
      borderColor: f.kind === k.id ? 'var(--gold)' : 'var(--line)',
    }}>{k.label}</button>
  )

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 47, background: 'rgba(0,0,0,.55)', display: 'flex', justifyContent: 'flex-start' }}>
      <div onClick={e => e.stopPropagation()} className="jd-panel" style={{ width: 'min(430px, 100%)', height: '100%', background: 'var(--card)', borderInlineEnd: '1px solid var(--line)', boxShadow: 'var(--shadow-pop)', display: 'flex', flexDirection: 'column' }}>
        <div className="row between" style={{ padding: '16px 18px', borderBottom: '1px solid var(--line)' }}>
          <div className="t-h2">{editing ? 'עריכת משמרת' : 'משמרת חדשה'}</div>
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="סגור">✕</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>{label('סוג')}<div className="row gap-2">{SHIFT_KINDS.map(kindBtn)}</div></div>
          <div>{label('תאריך')}<input className="field" type="date" dir="ltr" value={f.date || ''} onChange={e => set('date', e.target.value)} /></div>
          <div className="row gap-3">
            <div className="grow">{label('משעה')}<input className="field" type="time" dir="ltr" value={f.start_time || ''} onChange={e => set('start_time', e.target.value)} /></div>
            <div className="grow">{label('עד שעה')}<input className="field" type="time" dir="ltr" value={f.end_time || ''} onChange={e => set('end_time', e.target.value)} /></div>
            <div style={{ width: 90 }}>{label('דרושים')}<input className="field" type="number" min="1" dir="ltr" value={f.need} onChange={e => set('need', e.target.value)} /></div>
          </div>

          <div>
            <div className="row between" style={{ marginBottom: 6 }}>
              {label('שיבוץ צוות')}
              <span className="t-meta">{f.assigned.length}/{f.need} משובצים</span>
            </div>
            {employees.length === 0
              ? <div className="muted" style={{ fontSize: 13 }}>אין עובדים. הוסף עובדים בטאב "צוות".</div>
              : <div className="card" style={{ overflow: 'hidden' }}>
                  {employees.map((e, i) => {
                    const on = f.assigned.includes(e.id)
                    return (
                      <button key={e.id} type="button" onClick={() => toggle(e.id)} style={{
                        appearance: 'none', border: 0, width: '100%', textAlign: 'start', cursor: 'pointer',
                        background: on ? 'var(--gold-bg)' : 'transparent', color: 'var(--ink)', font: 'inherit',
                        padding: 10, display: 'flex', alignItems: 'center', gap: 10, borderTop: i ? '1px solid var(--hair)' : 0,
                      }}>
                        <EmpAvatar name={e.name} size={32} />
                        <div className="grow" style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: 14 }} className="truncate">{e.name}</div>
                          <div className="t-meta truncate">{e.role || ''}</div>
                        </div>
                        <span style={{
                          width: 22, height: 22, borderRadius: 6, flex: 'none',
                          border: `1.5px solid ${on ? 'var(--gold)' : 'var(--line)'}`, background: on ? 'var(--gold)' : 'transparent',
                          color: 'var(--on-gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800,
                        }}>{on ? '✓' : ''}</span>
                      </button>
                    )
                  })}
                </div>}
          </div>

          {err && <div style={{ color: '#E5735B', fontSize: 13, fontWeight: 500 }}>{err}</div>}
        </div>

        <div className="row gap-2" style={{ padding: 14, borderTop: '1px solid var(--line)' }}>
          {editing && <button className="btn btn-sm" onClick={remove} disabled={busy} type="button" style={{ color: '#E5735B' }}>מחיקה</button>}
          <div className="grow" />
          <button className="btn" onClick={onClose} type="button">ביטול</button>
          <button className="btn btn-solid" onClick={save} disabled={busy} type="button">{busy ? 'שומר…' : 'שמירה'}</button>
        </div>
      </div>
    </div>
  )
}
