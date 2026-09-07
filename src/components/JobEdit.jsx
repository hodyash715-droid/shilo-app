import React, { useState } from 'react'
import { STATUSES, CATEGORIES, ils } from '../data.js'
import { createJob, updateJob, deleteJob } from '../db.js'

const blank = () => ({
  title: '', client: '', contact: '', eventDate: '', eventTime: '', status: 'inquiry',
  venue: '', address: '', clientId: null,
  items: [], team: [], note: '',
})

export default function JobEdit({ job, onClose, onSaved, onDeleted, inventory = [], clients = [] }) {
  const editing = Boolean(job && job.id)
  const [f, setF] = useState(() => job ? { ...blank(), ...job } : blank())
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [confirmDel, setConfirmDel] = useState(false)

  const set = (k, v) => setF(s => ({ ...s, [k]: v }))
  const total = f.items.reduce((s, it) => s + (Number(it.price) || 0), 0)

  const addItem = () => set('items', [...f.items, { cat: 'backdrop', name: '', qty: 1, price: 0 }])
  const setItem = (i, k, v) => set('items', f.items.map((it, idx) => idx === i ? { ...it, [k]: v } : it))
  const delItem = (i) => set('items', f.items.filter((_, idx) => idx !== i))

  const save = async () => {
    if (!f.title.trim() && !f.client.trim()) { setErr('צריך לפחות שם עבודה או שם לקוח'); return }
    setErr(''); setBusy(true)
    try {
      const payload = {
        ...f,
        price: total,
        items: f.items.map(it => ({ ...it, qty: Number(it.qty) || 1, price: Number(it.price) || 0 })),
        team: Array.isArray(f.team) ? f.team : String(f.team).split(',').map(s => s.trim()).filter(Boolean),
        eventDate: f.eventDate || null,
        eventTime: f.eventTime || null,     // עמודת time לא מקבלת מחרוזת ריקה
        venue: (f.venue || '').trim() || null,
        address: (f.address || '').trim() || null,
        clientId: f.clientId || null,
      }
      const saved = editing ? await updateJob(job.id, payload) : await createJob(payload)
      onSaved(saved)
    } catch (e) {
      setErr('שמירה נכשלה: ' + (e.message || e))
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!editing) return
    setBusy(true)
    try { await deleteJob(job.id); onDeleted(job.id) }
    catch (e) { setErr('מחיקה נכשלה: ' + (e.message || e)); setBusy(false) }
  }

  const label = t => <div className="t-meta" style={{ marginBottom: 6 }}>{t}</div>
  const teamStr = Array.isArray(f.team) ? f.team.join(', ') : f.team

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 45,
      background: 'rgba(0,0,0,.55)', display: 'flex', justifyContent: 'flex-start',
    }}>
      <div onClick={e => e.stopPropagation()} className="jd-panel" style={{
        width: 'min(460px, 100%)', height: '100%', background: 'var(--card)',
        borderInlineEnd: '1px solid var(--line)', boxShadow: 'var(--shadow-pop)',
        display: 'flex', flexDirection: 'column',
      }}>
        <div className="row between" style={{ padding: '16px 18px', borderBottom: '1px solid var(--line)' }}>
          <div className="row gap-2">
            <div className="t-h2">{editing ? 'עריכת עבודה' : 'עבודה חדשה'}</div>
            {f.orderNo && <span className="chip mono">#{f.orderNo}</span>}
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="סגור">✕</button>
        </div>

        <datalist id="invnames">{inventory.map(iv => <option key={iv.id} value={iv.name} />)}</datalist>
        <div style={{ flex: 1, overflowY: 'auto', padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>{label('שם העבודה')}<input className="field" value={f.title} onChange={e => set('title', e.target.value)} placeholder="בר מצווה — אולם הגן" /></div>
          <div className="row gap-3">
            <div className="grow">{label('לקוח')}<input className="field" value={f.client} onChange={e => set('client', e.target.value)} placeholder="משפחת לוי" /></div>
            <div className="grow">{label('טלפון')}<input className="field" dir="ltr" style={{ textAlign: 'start' }} value={f.contact} onChange={e => set('contact', e.target.value)} placeholder="050-0000000" /></div>
          </div>
          <div className="row gap-3">
            <div className="grow">{label('תאריך אירוע')}<input className="field" type="date" dir="ltr" value={f.eventDate || ''} onChange={e => set('eventDate', e.target.value)} /></div>
            <div style={{ width: 118 }}>{label('שעה')}<input className="field" type="time" dir="ltr" value={f.eventTime || ''} onChange={e => set('eventTime', e.target.value)} /></div>
          </div>
          <div className="row gap-3">
            <div className="grow">{label('סטטוס')}
              <select className="field" value={f.status} onChange={e => set('status', e.target.value)}>
                {STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>
            <div className="grow">{label('מפיקה')}
              <select className="field" value={f.clientId || ''} onChange={e => set('clientId', e.target.value || null)}>
                <option value="">— ללא —</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}{c.company ? ` · ${c.company}` : ''}</option>)}
              </select>
            </div>
          </div>
          <div>{label('מקום האירוע')}<input className="field" value={f.venue || ''} onChange={e => set('venue', e.target.value)} placeholder="אולמי הדר" /></div>
          <div>{label('כתובת מלאה — לניווט')}<input className="field" value={f.address || ''} onChange={e => set('address', e.target.value)} placeholder="הרצל 12, ראשון לציון" /></div>

          {/* פריטים */}
          <div>
            <div className="row between" style={{ marginBottom: 8 }}>
              {label('פריטים')}
              <button className="btn btn-sm" onClick={addItem} type="button">＋ פריט</button>
            </div>
            {f.items.length === 0
              ? <div className="muted" style={{ fontSize: 13 }}>אין פריטים עדיין.</div>
              : <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {f.items.map((it, i) => (
                    <div key={i} style={{ background: 'var(--card-2)', border: '1px solid var(--line)', borderRadius: 8, padding: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div className="row gap-2">
                        <select className="field" style={{ height: 38, width: 110 }} value={it.cat} onChange={e => setItem(i, 'cat', e.target.value)}>
                          {Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </select>
                        <input className="field grow" style={{ height: 38 }} value={it.name} onChange={e => setItem(i, 'name', e.target.value)} placeholder="תיאור הפריט" list="invnames" />
                        <button className="btn btn-ghost btn-sm" onClick={() => delItem(i)} type="button" aria-label="מחק">✕</button>
                      </div>
                      <div className="row gap-2">
                        <div style={{ width: 110 }}>{label('כמות')}<input className="field" style={{ height: 38 }} type="number" min="1" dir="ltr" value={it.qty} onChange={e => setItem(i, 'qty', e.target.value)} /></div>
                        <div className="grow">{label('מחיר (₪)')}<input className="field" style={{ height: 38 }} type="number" min="0" dir="ltr" value={it.price} onChange={e => setItem(i, 'price', e.target.value)} /></div>
                      </div>
                    </div>
                  ))}
                </div>}
            <div className="row between" style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--hair)' }}>
              <div style={{ fontWeight: 700 }}>סה״כ</div>
              <div className="mono" style={{ fontSize: 17, fontWeight: 600 }}>{ils(total)}</div>
            </div>
          </div>

          <div>{label('צוות (מופרד בפסיקים)')}<input className="field" value={teamStr} onChange={e => set('team', e.target.value)} placeholder="רן, מאור" /></div>
          <div>{label('הערה')}<textarea className="field" style={{ height: 72, padding: '10px 12px', resize: 'vertical' }} value={f.note} onChange={e => set('note', e.target.value)} /></div>

          {err && <div style={{ color: '#E5735B', fontSize: 13, fontWeight: 500 }}>{err}</div>}
        </div>

        <div className="row gap-2" style={{ padding: 14, borderTop: '1px solid var(--line)' }}>
          {editing && (confirmDel
            ? <button className="btn btn-sm" onClick={remove} disabled={busy} type="button"
                style={{ color: '#fff', background: '#B23A2A', borderColor: '#B23A2A' }}>בטוח? מחק</button>
            : <button className="btn btn-sm" onClick={() => setConfirmDel(true)} disabled={busy} type="button"
                style={{ color: '#E5735B' }}>מחיקה</button>)}
          <div className="grow" />
          <button className="btn" onClick={onClose} type="button">ביטול</button>
          <button className="btn btn-solid" onClick={save} disabled={busy} type="button">{busy ? 'שומר…' : 'שמירה'}</button>
        </div>
      </div>
    </div>
  )
}
