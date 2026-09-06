import React, { useEffect, useState } from 'react'
import { clientPortal, clientSubmitOrder, clientDecideQuote } from '../db.js'
import { fmtDate, relLabel, ils, CATEGORIES } from '../data.js'

const QSTATE = {
  needs_quote: { label: 'ממתין להצעת מחיר', color: '#EEC421' },
  sent:        { label: 'הצעת מחיר ממתינה לאישורך', color: '#D9822B' },
  approved:    { label: 'אושר', color: '#3E9C68' },
  rejected:    { label: 'נדחתה', color: '#A8382A' },
  none:        { label: 'בטיפול', color: '#8A8474' },
}

export default function ClientPortal({ token }) {
  const [data, setData] = useState(undefined) // undefined=טוען, null=לא תקין
  const [view, setView] = useState('list')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const load = async () => {
    try { setData(await clientPortal(token)) }
    catch (e) { setData(null) }
  }
  useEffect(() => { load() }, [token])

  // ---- טופס הזמנה ----
  const [f, setF] = useState({ title: '', eventDate: '', venue: '', note: '' })
  const [picked, setPicked] = useState({})   // name -> qty
  const set = (k, v) => setF(s => ({ ...s, [k]: v }))
  const bump = (name, d) => setPicked(p => {
    const n = Math.max(0, (p[name] || 0) + d)
    const c = { ...p }; if (n === 0) delete c[name]; else c[name] = n
    return c
  })

  const submit = async () => {
    if (!f.title.trim() && Object.keys(picked).length === 0) { setMsg('כתבי שם לאירוע או בחרי פריטים'); return }
    setBusy(true); setMsg('')
    try {
      await clientSubmitOrder(token, {
        ...f,
        items: Object.entries(picked).map(([name, qty]) => ({ name, qty, cat: 'other', price: 0 })),
      })
      setF({ title: '', eventDate: '', venue: '', note: '' }); setPicked({})
      setView('list'); await load()
      setMsg('ההזמנה נשלחה לשי ✓')
    } catch (e) { setMsg('השליחה נכשלה: ' + (e.message || e)) }
    setBusy(false)
  }

  const decide = async (jobId, approve) => {
    setBusy(true)
    try { await clientDecideQuote(token, jobId, approve); await load() }
    catch (e) { setMsg('הפעולה נכשלה') }
    setBusy(false)
  }

  if (data === undefined) return <div style={{ minHeight: '100%', display: 'grid', placeItems: 'center' }} className="muted">טוען…</div>
  if (data === null) return (
    <div style={{ minHeight: '100%', display: 'grid', placeItems: 'center', padding: 24, textAlign: 'center' }}>
      <div>
        <div className="brand-mark" style={{ margin: '0 auto 14px' }}>ש</div>
        <div className="t-h2" style={{ marginBottom: 6 }}>הקישור אינו תקין</div>
        <div className="muted">בקשי משי קישור מעודכן.</div>
      </div>
    </div>
  )

  const { client, orders = [], catalog = [] } = data
  const awaiting = orders.filter(o => o.quote_status === 'sent')

  return (
    <div style={{ minHeight: '100%', paddingBottom: 40 }}>
      <header style={{ borderBottom: '1px solid var(--line)', background: 'var(--card)' }}>
        <div style={{ maxWidth: 620, margin: '0 auto', padding: '14px 16px' }} className="row between gap-3">
          <div className="row gap-3" style={{ minWidth: 0 }}>
            <span className="brand-mark">ש</span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 16, lineHeight: 1.1 }}>שילה</div>
              <div className="t-meta truncate">עיצוב ומיתוג לאירועים</div>
            </div>
          </div>
          <div style={{ textAlign: 'end', minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 14 }} className="truncate">{client.name}</div>
            <div className="t-meta truncate">{client.company}</div>
          </div>
        </div>
      </header>

      <div style={{ maxWidth: 620, margin: '0 auto', padding: 16 }}>
        {/* התראה: הצעה ממתינה לאישור */}
        {awaiting.length > 0 && view === 'list' && (
          <div className="card" style={{ padding: 14, marginBottom: 16, border: '1px solid #D9822B', background: 'rgba(217,130,43,.10)' }}>
            <div style={{ fontWeight: 700, color: '#E0954A' }}>
              {awaiting.length === 1 ? 'הצעת מחיר ממתינה לאישורך' : `${awaiting.length} הצעות מחיר ממתינות לאישורך`}
            </div>
            <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>גללי למטה כדי לאשר או לדחות.</div>
          </div>
        )}

        {msg && (
          <div className="card" style={{ padding: 12, marginBottom: 14, textAlign: 'center', fontWeight: 600 }}>{msg}</div>
        )}

        {view === 'list' ? (
          <>
            <button className="btn btn-solid" style={{ width: '100%', height: 50, marginBottom: 18, fontSize: 16 }}
              onClick={() => { setView('new'); setMsg('') }}>
              <span style={{ fontSize: 20, marginTop: -2 }}>＋</span> הזמנה חדשה
            </button>

            <div className="row gap-2" style={{ marginBottom: 10 }}>
              <span style={{ width: 4, height: 18, background: 'var(--gold)', borderRadius: 2 }} />
              <span style={{ fontWeight: 700, fontSize: 16 }}>ההזמנות שלי</span>
              <span className="t-meta">{orders.length}</span>
            </div>

            {orders.length === 0 ? (
              <div className="card" style={{ padding: 28, textAlign: 'center' }}>
                <div style={{ fontWeight: 600, marginBottom: 2 }}>אין עדיין הזמנות</div>
                <div className="muted" style={{ fontSize: 13 }}>לחצי "הזמנה חדשה" כדי לשלוח בקשה לשי.</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {orders.map(o => {
                  const q = QSTATE[o.quote_status] || QSTATE.none
                  return (
                    <div key={o.id} className="card" style={{ padding: 14, borderColor: o.quote_status === 'sent' ? '#D9822B' : undefined }}>
                      <div className="row between gap-2" style={{ marginBottom: 6 }}>
                        <span className="chip" style={{ background: 'var(--card-2)', color: q.color }}>{q.label}</span>
                        {o.event_date && <span className="t-meta">{fmtDate(o.event_date)}</span>}
                      </div>
                      <div style={{ fontWeight: 700, fontSize: 16 }}>{o.title}</div>
                      {o.venue && <div className="t-meta" style={{ marginTop: 2 }}>{o.venue}</div>}

                      {o.items?.length > 0 && (
                        <div className="t-meta" style={{ marginTop: 8, lineHeight: 1.7 }}>
                          {o.items.map((it, i) => <div key={i}>• {it.qty} × {it.name}</div>)}
                        </div>
                      )}

                      {(o.quote_status === 'sent' || o.quote_status === 'approved') && (
                        <div className="row between" style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--hair)' }}>
                          <span style={{ fontWeight: 700 }}>סה״כ הצעה</span>
                          <span className="mono" style={{ fontSize: 19, fontWeight: 700 }}>{ils(o.total)}</span>
                        </div>
                      )}

                      {o.quote_status === 'sent' && (
                        <div className="row gap-2" style={{ marginTop: 12 }}>
                          <button className="btn btn-solid grow" style={{ height: 46 }} disabled={busy}
                            onClick={() => decide(o.id, true)}>אישור ההצעה ✓</button>
                          <button className="btn" style={{ height: 46, color: '#E5735B' }} disabled={busy}
                            onClick={() => decide(o.id, false)}>דחייה</button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </>
        ) : (
          /* ---------- טופס הזמנה ---------- */
          <>
            <div className="row gap-2" style={{ marginBottom: 12 }}>
              <span style={{ width: 4, height: 18, background: 'var(--gold)', borderRadius: 2 }} />
              <span style={{ fontWeight: 700, fontSize: 16 }}>הזמנה חדשה</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <div className="t-meta" style={{ marginBottom: 6 }}>שם האירוע</div>
                <input className="field" value={f.title} onChange={e => set('title', e.target.value)} placeholder="השקת מוצר — נגה טק" />
              </div>
              <div className="row gap-3">
                <div className="grow">
                  <div className="t-meta" style={{ marginBottom: 6 }}>תאריך</div>
                  <input className="field" type="date" dir="ltr" value={f.eventDate} onChange={e => set('eventDate', e.target.value)} />
                </div>
              </div>
              <div>
                <div className="t-meta" style={{ marginBottom: 6 }}>מיקום</div>
                <input className="field" value={f.venue} onChange={e => set('venue', e.target.value)} placeholder="הנגר 11, נמל תל אביב" />
              </div>

              <div>
                <div className="t-meta" style={{ marginBottom: 8 }}>מה נדרש? (אפשר לבחור ואפשר לכתוב)</div>
                {catalog.length > 0 && (
                  <div className="card" style={{ overflow: 'hidden', marginBottom: 10 }}>
                    {catalog.map((c, i) => {
                      const n = picked[c.name] || 0
                      return (
                        <div key={c.name} className="row gap-2" style={{
                          padding: '10px 12px', borderTop: i ? '1px solid var(--hair)' : 0,
                          background: n ? 'var(--gold-bg)' : 'transparent',
                        }}>
                          <div className="grow" style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 14, fontWeight: 600 }} className="truncate">{c.name}</div>
                            <div className="t-meta">{CATEGORIES[c.category] || ''}</div>
                          </div>
                          {n > 0 && <button className="btn btn-sm" style={{ width: 38 }} onClick={() => bump(c.name, -1)}>−</button>}
                          {n > 0 && <span className="mono" style={{ width: 22, textAlign: 'center', fontWeight: 700 }}>{n}</span>}
                          <button className="btn btn-sm" style={{ width: 38 }} onClick={() => bump(c.name, +1)}>+</button>
                        </div>
                      )
                    })}
                  </div>
                )}
                <textarea className="field" style={{ height: 90, padding: '10px 12px', resize: 'vertical' }}
                  value={f.note} onChange={e => set('note', e.target.value)}
                  placeholder="פרטים נוספים — גדלים, צבעים, שעות הקמה, כל מה שחשוב…" />
              </div>

              {msg && <div style={{ color: '#E5735B', fontSize: 13, fontWeight: 600 }}>{msg}</div>}

              <div className="row gap-2">
                <button className="btn grow" onClick={() => { setView('list'); setMsg('') }}>ביטול</button>
                <button className="btn btn-solid grow" style={{ height: 48 }} disabled={busy} onClick={submit}>
                  {busy ? 'שולח…' : 'שליחת ההזמנה'}
                </button>
              </div>
            </div>
          </>
        )}

        <div className="t-meta" style={{ textAlign: 'center', marginTop: 26, lineHeight: 1.7 }}>
          ההזמנה אינה נסגרת מיד — שי יחזור אליך עם הצעת מחיר לאישור.
        </div>
      </div>
    </div>
  )
}
