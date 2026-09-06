import React, { useState } from 'react'
import { CATEGORIES } from '../data.js'
import { createInvItem, updateInvItem, deleteInvItem } from '../db.js'

export default function InventoryEdit({ item, onClose, onSaved, onDeleted }) {
  const editing = Boolean(item && item.id)
  const [f, setF] = useState(() => item ? { ...item } : { name: '', total: 1, category: 'backdrop' })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [confirmDel, setConfirmDel] = useState(false)
  const set = (k, v) => setF(s => ({ ...s, [k]: v }))
  const label = t => <div className="t-meta" style={{ marginBottom: 6 }}>{t}</div>

  const save = async () => {
    if (!f.name.trim()) { setErr('צריך שם פריט'); return }
    setErr(''); setBusy(true)
    try {
      const payload = { name: f.name.trim(), total: Number(f.total) || 0, category: f.category }
      const saved = editing ? await updateInvItem(item.id, payload) : await createInvItem(payload)
      onSaved(saved)
    } catch (e) { setErr('שמירה נכשלה: ' + (e.message || e)); setBusy(false) }
  }
  const remove = async () => {
    setBusy(true)
    try { await deleteInvItem(item.id); onDeleted(item.id) }
    catch (e) { setErr('מחיקה נכשלה: ' + (e.message || e)); setBusy(false) }
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 46, background: 'rgba(0,0,0,.55)', display: 'flex', justifyContent: 'flex-start' }}>
      <div onClick={e => e.stopPropagation()} className="jd-panel" style={{ width: 'min(400px, 100%)', height: '100%', background: 'var(--card)', borderInlineEnd: '1px solid var(--line)', boxShadow: 'var(--shadow-pop)', display: 'flex', flexDirection: 'column' }}>
        <div className="row between" style={{ padding: '16px 18px', borderBottom: '1px solid var(--line)' }}>
          <div className="t-h2">{editing ? 'עריכת פריט מלאי' : 'פריט מלאי חדש'}</div>
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="סגור">✕</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>{label('שם הפריט')}<input className="field" value={f.name} onChange={e => set('name', e.target.value)} placeholder="קוליסה 2×3 מ׳" /></div>
          <div className="row gap-3">
            <div style={{ width: 120 }}>{label('כמות במלאי')}<input className="field" type="number" min="0" dir="ltr" value={f.total} onChange={e => set('total', e.target.value)} /></div>
            <div className="grow">{label('קטגוריה')}
              <select className="field" value={f.category || 'other'} onChange={e => set('category', e.target.value)}>
                {Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>
          <div className="muted" style={{ fontSize: 12.5, lineHeight: 1.6 }}>
            טיפ: כשתשתמש באותו שם בדיוק בפריטי העבודה, המערכת תדע לספור כמה יחידות בחוץ.
          </div>
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
