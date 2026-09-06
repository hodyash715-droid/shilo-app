import React, { useState } from 'react'
import { createEmployee, updateEmployee, deleteEmployee } from '../db.js'

const blank = () => ({ name: '', role: '', phone: '', rate: '', active: true })
const ROLES = ['מתקין', 'נהג', 'אחראי אתר', 'כללי']

// קוד קצר וברור — בלי תווים מתבלבלים (0/O, 1/I)
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const genCode = () => Array.from({ length: 6 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join('')

export default function EmployeeEdit({ emp, onClose, onSaved, onDeleted }) {
  const editing = Boolean(emp && emp.id)
  const [f, setF] = useState(() => emp ? { ...blank(), ...emp } : blank())
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [confirmDel, setConfirmDel] = useState(false)
  const set = (k, v) => setF(s => ({ ...s, [k]: v }))
  const label = t => <div className="t-meta" style={{ marginBottom: 6 }}>{t}</div>

  const save = async () => {
    if (!f.name.trim()) { setErr('צריך שם'); return }
    setErr(''); setBusy(true)
    try {
      const payload = {
        name: f.name.trim(), role: f.role.trim(), phone: f.phone.trim(),
        rate: f.rate === '' ? null : Number(f.rate), active: f.active,
        ...(editing ? {} : { join_code: genCode() }),
      }
      const saved = editing ? await updateEmployee(emp.id, payload) : await createEmployee(payload)
      onSaved(saved)
    } catch (e) { setErr('שמירה נכשלה: ' + (e.message || e)); setBusy(false) }
  }
  const remove = async () => {
    setBusy(true)
    try { await deleteEmployee(emp.id); onDeleted(emp.id) }
    catch (e) { setErr('מחיקה נכשלה: ' + (e.message || e)); setBusy(false) }
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 46, background: 'rgba(0,0,0,.55)', display: 'flex', justifyContent: 'flex-start' }}>
      <div onClick={e => e.stopPropagation()} className="jd-panel" style={{ width: 'min(420px, 100%)', height: '100%', background: 'var(--card)', borderInlineEnd: '1px solid var(--line)', boxShadow: 'var(--shadow-pop)', display: 'flex', flexDirection: 'column' }}>
        <div className="row between" style={{ padding: '16px 18px', borderBottom: '1px solid var(--line)' }}>
          <div className="t-h2">{editing ? 'עריכת עובד' : 'עובד חדש'}</div>
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="סגור">✕</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>{label('שם מלא')}<input className="field" value={f.name} onChange={e => set('name', e.target.value)} placeholder="יוסי כהן" /></div>
          <div>{label('תפקיד')}
            <input className="field" value={f.role} onChange={e => set('role', e.target.value)} placeholder="מתקין · אחראי אתר" list="roles" />
            <datalist id="roles">{ROLES.map(r => <option key={r} value={r} />)}</datalist>
          </div>
          <div className="row gap-3">
            <div className="grow">{label('טלפון')}<input className="field" dir="ltr" style={{ textAlign: 'start' }} value={f.phone} onChange={e => set('phone', e.target.value)} placeholder="050-0000000" /></div>
            <div style={{ width: 120 }}>{label('שכר לשעה (₪)')}<input className="field" type="number" dir="ltr" value={f.rate} onChange={e => set('rate', e.target.value)} placeholder="60" /></div>
          </div>
          {editing && f.join_code && (
            <div className="card" style={{ padding: 14, background: 'var(--card-2)' }}>
              <div className="t-meta" style={{ marginBottom: 4 }}>קוד הצטרפות לאפליקציה</div>
              <div className="mono" style={{
                fontSize: 26, fontWeight: 700, letterSpacing: '.16em',
                color: 'var(--gold)', textAlign: 'center', padding: '6px 0',
              }}>{f.join_code}</div>
              <div className="muted" style={{ fontSize: 12.5, lineHeight: 1.6, textAlign: 'center' }}>
                {f.user_id
                  ? '✓ העובד כבר מחובר לאפליקציה'
                  : 'שלח את הקוד לעובד. הוא יפתח את האפליקציה, ילחץ "יש לי קוד הצטרפות" ויבחר סיסמה.'}
              </div>
            </div>
          )}

          {err && <div style={{ color: '#E5735B', fontSize: 13, fontWeight: 500 }}>{err}</div>}
        </div>

        <div className="row gap-2" style={{ padding: 14, borderTop: '1px solid var(--line)' }}>
          {editing && (confirmDel
            ? <button className="btn btn-sm" onClick={remove} disabled={busy} type="button" style={{ color: '#fff', background: '#B23A2A', borderColor: '#B23A2A' }}>בטוח? מחק</button>
            : <button className="btn btn-sm" onClick={() => setConfirmDel(true)} disabled={busy} type="button" style={{ color: '#E5735B' }}>מחיקה</button>)}
          <div className="grow" />
          <button className="btn" onClick={onClose} type="button">ביטול</button>
          <button className="btn btn-solid" onClick={save} disabled={busy} type="button">{busy ? 'שומר…' : 'שמירה'}</button>
        </div>
      </div>
    </div>
  )
}
