import React, { useEffect, useState } from 'react'
import { clientPortal, clientSubmitOrder, clientDecideQuote, clientPostMessage } from '../db.js'
import { Thumb } from './ui.jsx'
import Thread from './Thread.jsx'
import OrderProgress from './OrderProgress.jsx'
import FileList from './FileList.jsx'
import { filesEnabled, listClientFiles, uploadClientFile, deleteClientFile } from '../files.js'
import { fmtDate, relLabel, ils, CATEGORIES, shortTime, placeOf, wazeLink, waLink, BUSINESS } from '../data.js'

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
  useEffect(() => {
    if (!filesEnabled() || !data?.orders) return
    data.orders.forEach(o => loadFiles(o.id))
  }, [data])

  // ---- טופס הזמנה ----
  const [f, setF] = useState({ title: '', eventDate: '', time: '', venue: '', address: '', note: '' })
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
      setF({ title: '', eventDate: '', time: '', venue: '', address: '', note: '' }); setPicked({})
      setView('list'); await load()
      setMsg('ההזמנה נשלחה לשי ✓')
    } catch (e) { setMsg('השליחה נכשלה: ' + (e.message || e)) }
    setBusy(false)
  }

  const [filesBy, setFilesBy] = useState({})          // jobId -> קבצים
  const loadFiles = async (jobId) => {
    if (!filesEnabled()) return
    try {
      const rows = await listClientFiles(token, jobId)
      setFilesBy(m => ({ ...m, [jobId]: rows }))
    } catch {}
  }
  const [openFiles, setOpenFiles] = useState(null)
  const [openThread, setOpenThread] = useState(null)   // id של הזמנה שהשיחה שלה פתוחה
  const [rejecting, setRejecting] = useState(null)     // id של הזמנה שנדחית
  const [reason, setReason] = useState('')

  const decide = async (jobId, approve, why = null) => {
    setBusy(true)
    try {
      await clientDecideQuote(token, jobId, approve, why)
      setRejecting(null); setReason('')
      await load()
      setMsg(approve ? 'ההצעה אושרה ✓ שי מעודכן' : 'נשלח לשי')
    }
    catch (e) { setMsg('הפעולה נכשלה') }
    setBusy(false)
  }

  const post = async (jobId, body, kind) => {
    await clientPostMessage(token, jobId, body, kind)
    await load()
    setMsg(kind === 'change' ? 'בקשת השינוי נשלחה לשי ✓' : 'ההודעה נשלחה ✓')
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
  const pickedCount = Object.values(picked).reduce((a, b) => a + b, 0)
  const awaiting = orders.filter(o => o.quote_status === 'sent')

  return (
    <div style={{ minHeight: '100%', paddingBottom: view === 'new' ? 96 : 40 }}>
      <header style={{ borderBottom: '1px solid var(--line)', background: 'var(--card)' }}>
        <div style={{ maxWidth: 620, margin: '0 auto', padding: '14px 16px' }} className="row between gap-3">
          <div className="row gap-3" style={{ minWidth: 0 }}>
            <span className="brand-mark">ש</span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 16, lineHeight: 1.1 }}>שילה</div>
              <div className="t-meta truncate">עיצוב ומיתוג לאירועים</div>
            </div>
          </div>
          <div className="row gap-2" style={{ flex: '0 0 auto' }}>
            <div style={{ textAlign: 'end', minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 14 }} className="truncate">{client.name}</div>
              <div className="t-meta truncate">{client.company}</div>
            </div>
            {BUSINESS.phone && (
              <a className="btn btn-sm" aria-label="וואטסאפ לשי"
                style={{
                  flex: '0 0 auto', color: '#55C07E', textDecoration: 'none',
                  borderColor: 'rgba(85,192,126,.35)', gap: 5,
                }}
                href={waLink(BUSINESS.phone, `היי שי, זו ${client.name}.`)}
                target="_blank" rel="noreferrer">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2m0 2a8 8 0 1 1-4.1 14.9l-.3-.2-2.6.7.7-2.5-.2-.3A8 8 0 0 1 12 4m-3.4 4c-.2 0-.5.1-.7.4-.2.3-.8.8-.8 2s.8 2.3.9 2.5c.1.2 1.6 2.6 4 3.5 2 .8 2.4.6 2.8.6.4 0 1.4-.6 1.6-1.1.2-.6.2-1 .1-1.1l-.6-.3s-1.2-.6-1.4-.7c-.2-.1-.4-.1-.5.1l-.7.9c-.1.2-.3.2-.5.1-.2-.1-1-.4-1.9-1.2-.7-.6-1.2-1.4-1.3-1.6-.1-.2 0-.4.1-.5l.4-.5.3-.5v-.4l-.7-1.7c-.2-.4-.4-.4-.5-.4z"/>
                </svg>
                שי
              </a>
            )}
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
                      <div className="row between gap-2">
                        <span className="mono t-meta">{o.order_no ? `#${o.order_no}` : ''}</span>
                        <span className="t-meta">
                          {o.event_date ? fmtDate(o.event_date) : 'ללא תאריך'}
                          {o.event_time ? ` · ${shortTime(o.event_time)}` : ''}
                        </span>
                      </div>
                      <div style={{ fontWeight: 700, fontSize: 17, marginTop: 3 }}>{o.title}</div>
                      {(o.venue || o.address) && (
                        <a className="row gap-1" style={{
                          marginTop: 4, color: 'var(--ink70)', textDecoration: 'none', fontSize: 12.5,
                        }} href={wazeLink(placeOf({ venue: o.venue, address: o.address }))}
                          target="_blank" rel="noreferrer">
                          <span style={{ flex: '0 0 auto' }}>📍</span>
                          <span className="truncate">{o.venue || o.address}</span>
                          <span style={{ flex: '0 0 auto', color: 'var(--gold-fg)' }}>· ניווט</span>
                        </a>
                      )}

                      <OrderProgress status={o.quote_status} />

                      {/* פירוט: עם מחירים רק אם שי בחר להציג */}
                      {o.items?.length > 0 && (
                        o.itemized ? (
                          <div style={{ marginTop: 10 }}>
                            {o.items.map((it, i) => (
                              <div key={i} className="row between gap-2" style={{
                                fontSize: 13, padding: '5px 0',
                                borderTop: i ? '1px solid var(--hair)' : 0,
                              }}>
                                <span style={{ minWidth: 0 }} className="truncate">
                                  <span className="mono">{it.qty}</span> × {it.name}
                                </span>
                                {it.price != null && (
                                  <span className="mono t-meta" style={{ flex: '0 0 auto' }}>{ils(it.price)}</span>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="t-meta" style={{ marginTop: 8, lineHeight: 1.7 }}>
                            {o.items.map((it, i) => <div key={i}>• {it.qty} × {it.name}</div>)}
                          </div>
                        )
                      )}

                      {(o.quote_status === 'sent' || o.quote_status === 'approved') && (
                        <div className="row between" style={{
                          marginTop: 10, padding: '9px 11px', borderRadius: 9,
                          background: 'var(--card-2)', border: '1px solid var(--line)',
                        }}>
                          <span style={{ fontWeight: 700, fontSize: 14 }}>סה״כ הצעה</span>
                          <span className="mono" style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-.02em' }}>
                            {ils(o.total)}
                          </span>
                        </div>
                      )}

                      {o.quote_status === 'sent' && rejecting !== o.id && (
                        <div className="row gap-2" style={{ marginTop: 12 }}>
                          <button className="btn btn-solid grow" style={{ height: 46 }} disabled={busy}
                            onClick={() => decide(o.id, true)}>אישור ההצעה ✓</button>
                          <button className="btn" style={{ height: 46, color: '#E5735B' }} disabled={busy}
                            onClick={() => { setRejecting(o.id); setReason('') }}>לא מתאים</button>
                        </div>
                      )}

                      {/* דחייה עם סיבה — כדי ששי ידע מה לתקן */}
                      {o.quote_status === 'sent' && rejecting === o.id && (
                        <div style={{ marginTop: 12 }}>
                          <div className="t-meta" style={{ marginBottom: 6 }}>מה לא מתאים? (יעזור לשי לתקן)</div>
                          <textarea className="field" value={reason} onChange={e => setReason(e.target.value)}
                            placeholder="למשל: יקר לי — אפשר בלי השטיח?"
                            style={{ height: 70, padding: '9px 11px', resize: 'vertical' }} />
                          <div className="row gap-2" style={{ marginTop: 8 }}>
                            <button className="btn btn-sm" onClick={() => setRejecting(null)}>ביטול</button>
                            <div className="grow" />
                            <button className="btn btn-sm btn-solid" disabled={busy}
                              onClick={() => decide(o.id, false, reason)}>שלח לשי</button>
                          </div>
                        </div>
                      )}

                      {/* קבצים */}
                      {filesEnabled() && (openFiles === o.id || (filesBy[o.id]?.length > 0)) && (
                        <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--hair)' }}>
                          <div className="t-meta" style={{ marginBottom: 6 }}>קבצים ומיתוג</div>
                          <FileList
                            files={filesBy[o.id] || []}
                            hint="לוגו, מיתוג, השראה — תמונות, PDF או ZIP עד 10MB"
                            canDelete={f => f.from_client}
                            onUpload={async (f) => { await uploadClientFile(token, o.id, f); await loadFiles(o.id) }}
                            onDelete={async (f) => { await deleteClientFile(token, o.id, f.id); await loadFiles(o.id) }}
                          />
                        </div>
                      )}

                      {/* שיחה ובקשת שינוי */}
                      <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--hair)' }}>
                        {openThread !== o.id && (
                          <div className="row gap-2">
                            {filesEnabled() && !(filesBy[o.id]?.length) && (
                              <button className="btn btn-sm grow" onClick={() => setOpenFiles(o.id)}>📎 קבצים</button>
                            )}
                            <button className="btn btn-sm grow" onClick={() => setOpenThread(o.id)}>
                              {o.messages?.length
                                ? `💬 שיחה (${o.messages.length})`
                                : (o.quote_status === 'approved' ? '✏️ בקשת שינוי' : '💬 שאלה לשי')}
                            </button>
                          </div>
                        )}
                        {openThread === o.id ? (
                          <>
                            <div className="row between" style={{ marginBottom: 8 }}>
                              <span className="t-meta">שיחה עם שי</span>
                              <button className="btn btn-ghost btn-sm" onClick={() => setOpenThread(null)}>סגור</button>
                            </div>
                            <Thread
                              messages={o.messages || []}
                              mine="client"
                              placeholder={o.quote_status === 'approved'
                                ? 'רוצה להוסיף או לשנות משהו?'
                                : 'שאלה או הערה לשי…'}
                              onSend={(text) => post(o.id, text,
                                o.quote_status === 'approved' ? 'change' : 'message')}
                            />
                            {o.quote_status === 'approved' && (
                              <div className="t-meta" style={{ marginTop: 8, lineHeight: 1.7 }}>
                                שינוי אחרי אישור מחזיר את ההזמנה לתמחור, ושי ישלח הצעה מעודכנת.
                              </div>
                            )}
                          </>
                        ) : null}
                      </div>
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
                <div style={{ width: 118 }}>
                  <div className="t-meta" style={{ marginBottom: 6 }}>שעה</div>
                  <input className="field" type="time" dir="ltr" value={f.time} onChange={e => set('time', e.target.value)} />
                </div>
              </div>
              <div>
                <div className="t-meta" style={{ marginBottom: 6 }}>שם המקום</div>
                <input className="field" value={f.venue} onChange={e => set('venue', e.target.value)} placeholder="נמל תל אביב — האנגר 11" />
              </div>
              <div>
                <div className="t-meta" style={{ marginBottom: 6 }}>כתובת מלאה</div>
                <input className="field" value={f.address} onChange={e => set('address', e.target.value)} placeholder="הנגר 11, תל אביב" />
              </div>

              <div>
                <div className="t-meta" style={{ marginBottom: 8 }}>מה נדרש? (אפשר לבחור ואפשר לכתוב)</div>
                {catalog.length > 0 && (() => {
                  // קיבוץ לפי קטגוריה — 14 שורות זהות זה קיר, לא קטלוג
                  const groups = {}
                  catalog.forEach(c => { (groups[c.category || 'other'] ||= []).push(c) })
                  return Object.entries(groups).map(([cat, list]) => {
                    const inGroup = list.reduce((n, c) => n + (picked[c.name] || 0), 0)
                    return (
                      <div key={cat} style={{ marginBottom: 10 }}>
                        <div className="row between" style={{ margin: '0 0 6px' }}>
                          <span style={{ fontWeight: 700, fontSize: 13.5 }}>{CATEGORIES[cat] || 'אחר'}</span>
                          {inGroup > 0 && <span className="chip chip-go">{inGroup} נבחרו</span>}
                        </div>
                        <div className="card" style={{ overflow: 'hidden' }}>
                          {list.map((c, i) => {
                            const n = picked[c.name] || 0
                            return (
                              <div key={c.name} className="row gap-2" style={{
                                padding: '9px 11px', borderTop: i ? '1px solid var(--hair)' : 0,
                                background: n ? 'var(--gold-bg)' : 'transparent',
                              }}>
                                <Thumb cat={c.category} size={34} />
                                <div className="grow" style={{ minWidth: 0 }}>
                                  <div style={{ fontSize: 14, fontWeight: 600 }} className="truncate">{c.name}</div>
                                </div>
                                {n > 0 && <button className="btn btn-sm" style={{ width: 36 }} onClick={() => bump(c.name, -1)}>−</button>}
                                {n > 0 && <span className="mono" style={{ width: 20, textAlign: 'center', fontWeight: 700 }}>{n}</span>}
                                <button className="btn btn-sm" style={{ width: 36 }} onClick={() => bump(c.name, +1)}>+</button>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })
                })()}
                <textarea className="field" style={{ height: 90, padding: '10px 12px', resize: 'vertical' }}
                  value={f.note} onChange={e => set('note', e.target.value)}
                  placeholder="פרטים נוספים — גדלים, צבעים, שעות הקמה, כל מה שחשוב…" />
              </div>

              {msg && <div style={{ color: '#E5735B', fontSize: 13, fontWeight: 600 }}>{msg}</div>}

              <div style={{ height: 8 }} />
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
          {view === 'new' || orders.some(o => ['none', 'needs_quote'].includes(o.quote_status))
            ? 'הזמנה אינה נסגרת מיד — שי יחזור אליך עם הצעת מחיר לאישור.'
            : 'צריכה משהו? אפשר לפתוח שיחה בכל הזמנה, או לכתוב לשי בוואטסאפ.'}
        </div>
      </div>

      {/* פס סיכום דביק — תמיד רואים כמה נבחר ואיך שולחים */}
      {view === 'new' && (
        <div className="row between gap-3" style={{
          position: 'fixed', insetInline: 0, bottom: 0, zIndex: 30,
          background: 'color-mix(in srgb, var(--card) 95%, transparent)',
          backdropFilter: 'blur(10px)', borderTop: '1px solid var(--line)',
          padding: '10px 16px calc(10px + env(safe-area-inset-bottom))',
          boxShadow: '0 -12px 28px -18px rgba(0,0,0,.8)',
        }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>
              {pickedCount === 0 ? 'לא נבחרו פריטים' : `${pickedCount} פריטים נבחרו`}
            </div>
            <div className="t-meta truncate">{f.title || 'ללא שם אירוע'}</div>
          </div>
          <button className="btn btn-solid" style={{ height: 44, flex: '0 0 auto' }}
            disabled={busy} onClick={submit}>{busy ? 'שולח…' : 'שליחת ההזמנה'}</button>
        </div>
      )}
    </div>
  )
}
