import React, { useState } from 'react'
import { createEmployee, updateEmployee, deleteEmployee } from '../db.js'

const blank = () => ({ name: '', role: '', phone: '', rate: '', active: true })
const ROLES = ['מתקין', 'נהג', 'אחראי אתר', 'כללי']

// קוד ההצטרפות הוא המפתח לכרטיס העובד — 8 תווים מאקראיות אמיתית.
// בלי 0/O/1/I/L, כדי שאפשר יהיה להכתיב אותו בטלפון בלי טעויות.
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'
const genCode = () => {
  const b = new Uint8Array(8)
  crypto.getRandomValues(b)
  return [...b].map(x => ALPHABET[x % ALPHABET.length]).join('')
}
const CODE_DAYS = 14

export default function EmployeeEdit({ emp, onClose, onSaved, onDeleted }) {
  const editing = Boolean(emp && emp.id)
  const [f, setF] = useState(() => emp ? { ...blank(), ...emp } : blank())
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [confirmDel, setConfirmDel] = useState(false)
  const [copied, setCopied] = useState(false)
  const set = (k, v) => setF(s => ({ ...s, [k]: v }))
  const label = t => <div className="t-meta" style={{ marginBottom: 6 }}>{t}</div>

  const save = async () => {
    if (!f.name.trim()) { setErr('צריך שם'); return }
    setErr(''); setBusy(true)
    try {
      const payload = {
        name: f.name.trim(), role: f.role.trim(), phone: f.phone.trim(),
        rate: f.rate === '' ? null : Number(f.rate), active: f.active,
        ...(editing ? {} : {
          join_code: genCode(),
          join_expires_at: new Date(Date.now() + CODE_DAYS * 864e5).toISOString(),
        }),
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
          {editing && (() => {
            const expired = f.join_expires_at && new Date(f.join_expires_at) < new Date()
            const issue = async () => {
              const code = genCode()
              const exp = new Date(Date.now() + CODE_DAYS * 864e5).toISOString()
              try {
                const saved = await updateEmployee(emp.id, { join_code: code, join_expires_at: exp })
                setF(s2 => ({ ...s2, join_code: code, join_expires_at: exp }))
                onSaved(saved)
              } catch (e) { setErr('הנפקת הקוד נכשלה') }
            }
            return (
              <div className="card" style={{ padding: 14, background: 'var(--card-2)' }}>
                <div className="t-meta" style={{ marginBottom: 4 }}>קוד הצטרפות לאפליקציה</div>

                {f.user_id ? (
                  <div className="muted" style={{ fontSize: 13, textAlign: 'center', padding: '8px 0' }}>
                    ✓ העובד כבר מחובר לאפליקציה
                  </div>
                ) : f.join_code && !expired ? (
                  <>
                    <button type="button" className="mono" title="העתק"
                      onClick={() => { try { navigator.clipboard.writeText(f.join_code); setCopied(true); setTimeout(() => setCopied(false), 1600) } catch { } }}
                      style={{
                        width: '100%', appearance: 'none', cursor: 'pointer',
                        background: 'transparent', border: '1px dashed var(--line)', borderRadius: 10,
                        fontSize: 22, fontWeight: 700, letterSpacing: '.14em',
                        color: 'var(--gold)', textAlign: 'center', padding: '8px 0', margin: '4px 0 8px',
                      }}>{f.join_code}</button>
                    {copied && <div style={{ textAlign: 'center', color: 'var(--go)', fontSize: 12.5, fontWeight: 600, marginBottom: 6 }}>הקוד הועתק ✓</div>}
                    <div className="muted" style={{ fontSize: 12.5, lineHeight: 1.6, textAlign: 'center' }}>
                      שלח את הקוד לעובד. הוא יפתח את האפליקציה, ילחץ "יש לי קוד הצטרפות" ויבחר סיסמה.
                      {f.join_expires_at && <><br />הקוד תקף עד {new Date(f.join_expires_at).toLocaleDateString('he-IL')}.</>}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="muted" style={{ fontSize: 12.5, lineHeight: 1.6, textAlign: 'center', marginBottom: 8 }}>
                      {expired ? 'הקוד פג תוקף.' : 'אין קוד פעיל.'} הנפק חדש כדי לצרף את העובד.
                    </div>
                    <button type="button" className="btn btn-sm" style={{ width: '100%' }} onClick={issue}>
                      הנפק קוד חדש
                    </button>
                  </>
                )}
              </div>
            )
          })()}

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
