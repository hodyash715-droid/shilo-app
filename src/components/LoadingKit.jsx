// ============================================================
// ערכת ההעמסה הקבועה — מה שעולה על האוטו בכל עבודה.
//
// נערכת פעם אחת כאן, ומשם נזרעת לכל רשימת העמסה חדשה. שינוי כאן
// לא נוגע ברשימות שכבר נפתחו: עבודה שהרשימה שלה הוכנה לא משתנה
// מתחת לידיים של העובד ביום העבודה.
//
// פריט שמפסיקים לקחת מכובה (active=false) ולא נמחק, כדי שרשימות
// עבר יישארו כמו שהיו.
// ============================================================

import React, { useEffect, useState } from 'react'
import {
  fetchLoadingDefaults, createLoadingDefault,
  updateLoadingDefault, deleteLoadingDefault,
} from '../db.js'
import { loadingErr, qtyCls } from './LoadingList.jsx'

export default function LoadingKit() {
  const [rows, setRows] = useState(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [label, setLabel] = useState('')
  const [qty, setQty] = useState('')

  const load = async () => {
    try { setRows(await fetchLoadingDefaults()) }
    catch (e) { setErr(loadingErr(e)); setRows([]) }
  }
  useEffect(() => { load() }, [])

  const add = async () => {
    const name = label.trim()
    if (!name) return
    setBusy(true); setErr('')
    try {
      const sort = (rows?.reduce((m, r) => Math.max(m, r.sort || 0), 0) || 0) + 10
      const row = await createLoadingDefault({ label: name, qty: qty.trim() || null, sort })
      setRows(rs => [...rs, row]); setLabel(''); setQty('')
    } catch (e) { setErr('ההוספה נכשלה: ' + loadingErr(e)) }
    setBusy(false)
  }

  const toggleActive = async (row) => {
    setRows(rs => rs.map(r => r.id === row.id ? { ...r, active: !r.active } : r))
    try { await updateLoadingDefault(row.id, { active: !row.active }) }
    catch (e) { setErr('השינוי לא נשמר: ' + loadingErr(e)); load() }
  }

  const remove = async (row) => {
    if (!confirm(`למחוק "${row.label}" מהערכה הקבועה?`)) return
    setRows(rs => rs.filter(r => r.id !== row.id))
    try { await deleteLoadingDefault(row.id) }
    catch (e) { setErr('המחיקה נכשלה: ' + loadingErr(e)); load() }
  }

  if (rows === null) return <div className="t-meta" style={{ padding: 10 }}>טוען…</div>

  return (
    <div className="card" style={{ padding: 14 }}>
      <div className="t-meta" style={{ marginBottom: 10 }}>
        הפריטים האלה נוספים אוטומטית לכל רשימת העמסה חדשה.
      </div>

      {rows.length === 0 ? (
        <div className="muted" style={{ fontSize: 13, marginBottom: 10 }}>
          הערכה ריקה. הוסף למטה את מה שתמיד עולה על האוטו.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
          {rows.map(r => (
            <div key={r.id} className="row gap-2" style={{
              background: 'var(--card-2)', border: '1px solid var(--line)',
              borderRadius: 8, padding: 10, opacity: r.active ? 1 : .55,
            }}>
              <label className="row gap-2 grow" style={{ minWidth: 0, cursor: 'pointer', alignItems: 'center' }}>
                <input type="checkbox" checked={!!r.active} onChange={() => toggleActive(r)}
                  style={{ accentColor: 'var(--gold)', width: 20, height: 20, flex: '0 0 auto' }} />
                <span className="grow truncate" style={{ fontWeight: 600, fontSize: 14 }}>{r.label}</span>
              </label>
              {r.qty && <span className={qtyCls(r.qty)} style={{ flex: '0 0 auto' }}>{r.qty}</span>}
              <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)', flex: '0 0 auto' }}
                onClick={() => remove(r)} aria-label="מחק">✕</button>
            </div>
          ))}
        </div>
      )}

      <div className="row gap-2">
        <input className="field" placeholder="מברגה · ברגים · אקדח סיכות"
          style={{ flex: 1, minWidth: 0, height: 38 }}
          value={label} onChange={e => setLabel(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') add() }} />
        <input className="field mono" placeholder="כמות" dir="ltr"
          style={{ width: 74, flex: '0 0 auto', height: 38 }}
          value={qty} onChange={e => setQty(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') add() }} />
        <button className="btn btn-solid" style={{ flex: '0 0 auto', height: 38 }}
          disabled={busy || !label.trim()} onClick={add}>הוסף</button>
      </div>
      <div className="t-meta" style={{ marginTop: 6 }}>
        הכמות היא טקסט חופשי — "2", "קופסה", "לפי הצורך".
        הסרת הסימון מכבה פריט בלי למחוק רשימות עבר.
      </div>

      {err && <div style={{ color: 'var(--danger)', fontSize: 12.5, marginTop: 8 }}>{err}</div>}
    </div>
  )
}
