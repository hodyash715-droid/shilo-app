import React, { useState } from 'react'
import { createClientRec, deleteClientRec } from '../db.js'
import { waLink } from '../data.js'

const rndToken = () => Math.random().toString(36).slice(2, 8) + Math.random().toString(36).slice(2, 6)

export const portalLink = (token) =>
  `${window.location.origin}${window.location.pathname}#/c/${token}`

export default function ClientList({ clients, onSaved, onDeleted }) {
  const [adding, setAdding] = useState(false)
  const [f, setF] = useState({ name: '', company: '', phone: '' })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [copied, setCopied] = useState(null)
  const [confirmDel, setConfirmDel] = useState(null)

  const add = async () => {
    if (!f.name.trim()) { setErr('צריך שם'); return }
    setErr(''); setBusy(true)
    try {
      const saved = await createClientRec({
        name: f.name.trim(), company: f.company.trim() || null,
        phone: f.phone.trim() || null, token: rndToken(),
      })
      onSaved(saved); setF({ name: '', company: '', phone: '' }); setAdding(false)
    } catch (e) { setErr('שמירה נכשלה: ' + (e.message || e)) }
    setBusy(false)
  }

  const copy = (c) => {
    try { navigator.clipboard.writeText(portalLink(c.token)); setCopied(c.id); setTimeout(() => setCopied(null), 1600) } catch { }
  }

  return (
    <>
      {adding ? (
        <div className="card" style={{ padding: 14, marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input className="field" placeholder="שם המפיקה (נועם פ)" value={f.name} onChange={e => setF(s => ({ ...s, name: e.target.value }))} />
          <input className="field" placeholder="חברה (הפקות ABC)" value={f.company} onChange={e => setF(s => ({ ...s, company: e.target.value }))} />
          <input className="field" dir="ltr" style={{ textAlign: 'start' }} placeholder="050-0000000" value={f.phone} onChange={e => setF(s => ({ ...s, phone: e.target.value }))} />
          {err && <div style={{ color: '#E5735B', fontSize: 13 }}>{err}</div>}
          <div className="row gap-2">
            <button className="btn grow" onClick={() => { setAdding(false); setErr('') }}>ביטול</button>
            <button className="btn btn-solid grow" onClick={add} disabled={busy}>{busy ? 'שומר…' : 'הוספה'}</button>
          </div>
        </div>
      ) : (
        <button className="btn btn-solid" style={{ width: '100%', height: 46, marginBottom: 12 }} onClick={() => setAdding(true)}>
          <span style={{ fontSize: 18, marginTop: -2 }}>＋</span> מפיקה חדשה
        </button>
      )}

      {clients.length === 0 ? (
        <div className="card" style={{ padding: 22, textAlign: 'center', borderStyle: 'dashed' }}>
          <div style={{ fontWeight: 600 }}>אין עדיין מפיקות</div>
          <div className="muted" style={{ fontSize: 13 }}>הוסף מפיקה וקבל קישור ייעודי לשלוח לה.</div>
        </div>
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          {clients.map((c, i) => {
            const link = portalLink(c.token)
            const wa = waLink(c.phone, `שלום ${c.name}, זה הקישור האישי שלך להזמנות אצל שילה:\n${link}`)
            return (
              <div key={c.id} style={{ padding: 13, borderTop: i ? '1px solid var(--hair)' : 0 }}>
                <div className="row between gap-2">
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 15 }} className="truncate">{c.name}</div>
                    <div className="t-meta truncate">{c.company || '—'}{c.phone ? ` · ${c.phone}` : ''}</div>
                  </div>
                  <button className="btn btn-ghost btn-sm" style={{ color: '#E5735B', flex: 'none' }}
                    onClick={() => { if (confirmDel === c.id) { deleteClientRec(c.id).then(() => onDeleted(c.id)) } else setConfirmDel(c.id) }}>
                    {confirmDel === c.id ? 'בטוח?' : '✕'}
                  </button>
                </div>
                <div className="row gap-2 wrap" style={{ marginTop: 9 }}>
                  <button className="btn btn-sm" onClick={() => copy(c)}>
                    {copied === c.id ? 'הועתק ✓' : 'העתק קישור'}
                  </button>
                  {wa && <a className="btn btn-sm" href={wa} target="_blank" rel="noreferrer"
                    style={{ textDecoration: 'none', color: '#55C07E' }}>שלח בוואטסאפ</a>}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}
