import React, { useState } from 'react'
import { createClientRec, deleteClientRec, rotateClientToken } from '../db.js'
import { waLink, portalLink, quoteOpen, relLabel, isoLocal } from '../data.js'

const rndToken = () => {
  const b = new Uint8Array(12)                       // 96 ביט
  crypto.getRandomValues(b)
  return [...b].map(x => x.toString(16).padStart(2, '0')).join('')
}

export default function ClientList({ clients = [], onSaved, onDeleted, jobs = [] }) {
  const [adding, setAdding] = useState(false)
  const [f, setF] = useState({ name: '', company: '', phone: '', email: '' })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [copied, setCopied] = useState(null)
  const [confirmDel, setConfirmDel] = useState(null)
  const [confirmRot, setConfirmRot] = useState(null)

  // אם קישור דלף או הגיע לאדם הלא נכון — מחליפים אותו
  const rotate = async (c) => {
    setConfirmRot(null)
    try { onSaved(await rotateClientToken(c.id, rndToken())) }
    catch (e) { setErr('החלפת הקישור נכשלה') }
  }

  // מה קורה עם כל מפיקה — כמה שלחה, מתי, וכמה פתוחות
  const stats = (c) => {
    const mine = jobs.filter(j => j.clientId === c.id)
    const last = mine.map(j => j.createdAt).filter(Boolean).sort().pop()
    return {
      total: mine.length,
      open: mine.filter(quoteOpen).length,
      lastLabel: last ? relLabel(isoLocal(new Date(last))) : '—',
    }
  }

  const add = async () => {
    if (!f.name.trim()) { setErr('צריך שם'); return }
    setErr(''); setBusy(true)
    try {
      const saved = await createClientRec({
        name: f.name.trim(), company: f.company.trim() || null,
        phone: f.phone.trim() || null, email: f.email.trim() || null, token: rndToken(),
      })
      onSaved(saved); setF({ name: '', company: '', phone: '', email: '' }); setAdding(false)
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
          <input className="field" type="email" dir="ltr" style={{ textAlign: 'start' }} placeholder="מייל — לשליחת הצעות מחיר" value={f.email} onChange={e => setF(s => ({ ...s, email: e.target.value }))} />
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
                    {c.email && <div className="t-meta truncate" dir="ltr" style={{ textAlign: 'start' }}>{c.email}</div>}
                  </div>
                  <div className="row gap-2" style={{ flex: 'none' }}>
                    {stats(c).open > 0 && <span className="chip chip-signal">{stats(c).open} פתוחות</span>}
                  </div>
                </div>

                {/* מה קורה איתה */}
                <div className="row gap-2 wrap" style={{ marginTop: 7 }}>
                  <span className="t-meta">
                    {stats(c).total === 0 ? 'עוד לא שלחה הזמנות'
                      : `${stats(c).total} הזמנות · אחרונה ${stats(c).lastLabel}`}
                  </span>
                </div>

                <div className="row gap-2 wrap" style={{ marginTop: 9 }}>
                  <button className="btn btn-sm" onClick={() => copy(c)}>
                    {copied === c.id ? 'הועתק ✓' : 'העתק קישור'}
                  </button>
                  {wa && <a className="btn btn-sm" href={wa} target="_blank" rel="noreferrer"
                    style={{ textDecoration: 'none', color: '#55C07E' }}>שלח בוואטסאפ</a>}
                  {confirmRot === c.id ? (
                    <>
                      <button className="btn btn-sm" onClick={() => setConfirmRot(null)}>ביטול</button>
                      <button className="btn btn-sm btn-solid" onClick={() => rotate(c)}>החלף — הישן יפסיק לעבוד</button>
                    </>
                  ) : (
                    <button className="btn btn-ghost btn-sm" style={{ color: 'var(--ink45)' }}
                      onClick={() => setConfirmRot(c.id)}>קישור חדש</button>
                  )}
                  <div className="grow" />
                  {confirmDel === c.id ? (
                    <>
                      <button className="btn btn-sm" onClick={() => setConfirmDel(null)}>ביטול</button>
                      <button className="btn btn-sm" style={{ color: '#fff', background: '#B23A2A', borderColor: '#B23A2A' }}
                        onClick={() => deleteClientRec(c.id).then(() => onDeleted(c.id))}>
                        {stats(c).total > 0 ? `מחק ו-${stats(c).total} הזמנות יישארו` : 'מחק סופית'}
                      </button>
                    </>
                  ) : (
                    <button className="btn btn-ghost btn-sm" style={{ color: 'var(--ink45)' }}
                      onClick={() => setConfirmDel(c.id)}>הסר</button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}
