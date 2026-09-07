import React, { useEffect, useState } from 'react'
import { STATUSES, statusIndex, fmtDate, relLabel, isUrgent, ils, shiftKindLabel, quoteOf, waLink, placeOf, wazeLink, mapsLink, shortTime, portalLink, mailLink, quoteMessage, SERVICE_LABEL } from '../data.js'
import { Thumb, catLabel, EmpAvatar } from './ui.jsx'
import ShiftEdit from './ShiftEdit.jsx'
import Thread from './Thread.jsx'
import FileList from './FileList.jsx'
import { fetchJobMessages, postJobMessage, fetchJobFiles, uploadJobFile, deleteJobFile, signedFileUrl } from '../db.js'

export default function JobDetail({ job, onClose, onStatus, onEdit, shifts, employees, onShiftSaved, onShiftDeleted, onQuote, koolisot = [], onDesign, clients = [], onShowPrices }) {
  const [shiftEdit, setShiftEdit] = useState(undefined) // undefined=closed, null=new, shift=edit
  const [msgs, setMsgs] = useState([])
  const [files, setFiles] = useState([])
  const jobId = job?.id

  const loadFiles = async (id) => {
    const rows = await fetchJobFiles(id)
    return Promise.all(rows.map(async f => ({ ...f, url: await signedFileUrl(f.path) })))
  }

  useEffect(() => {
    if (!jobId) return
    let dead = false
    fetchJobMessages(jobId).then(r => { if (!dead) setMsgs(r) }).catch(() => {})
    loadFiles(jobId).then(r => { if (!dead) setFiles(r) }).catch(() => {})
    return () => { dead = true }
  }, [jobId])
  if (!job) return null
  const curIdx = statusIndex(job.status)
  const urgent = isUrgent(job)
  const next = STATUSES[curIdx + 1]
  const itemsTotal = job.items.reduce((s, it) => s + it.price, 0)
  const jobShifts = (shifts || []).filter(s => s.job_id === job.id)
    .sort((a, b) => (a.date || '').localeCompare(b.date || '') || (a.start_time || '').localeCompare(b.start_time || ''))
  const jobKool = (koolisot || []).filter(k => k.job_id === job.id)
  const place = placeOf(job)

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 40,
      background: 'rgba(0,0,0,.5)', display: 'flex', justifyContent: 'flex-start',
    }}>
      <div onClick={e => e.stopPropagation()} className="jd-panel" style={{
        width: 'min(440px, 100%)', height: '100%', background: 'var(--card)',
        borderInlineEnd: '1px solid var(--line)', boxShadow: 'var(--shadow-pop)',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--line)' }}>
          <div className="row between gap-2">
            <div className="t-meta truncate">{job.client} · {job.contact}</div>
            <div className="row gap-2" style={{ flex: '0 0 auto' }}>
              {job.orderNo && <span className="chip mono">#{job.orderNo}</span>}
              <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="סגור">✕</button>
            </div>
          </div>
          <div className="t-h2" style={{ marginTop: 4 }}>{job.title}</div>
          <div className="row gap-2 wrap" style={{ marginTop: 8 }}>
            <span className={urgent ? 'chip chip-signal' : 'chip'}>
              {urgent && <span className="chip-dot" />}🗓 {fmtDate(job.eventDate)}
            </span>
            {job.eventTime && <span className="chip mono">{shortTime(job.eventTime)}</span>}
            <span className="t-meta">{relLabel(job.eventDate)}</span>
          </div>

          {/* מקום האירוע + ניווט */}
          {place && (
            <div className="row between gap-2" style={{
              marginTop: 10, background: 'var(--card-2)', border: '1px solid var(--line)',
              borderRadius: 9, padding: '9px 11px',
            }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }} className="truncate">{job.venue || job.address}</div>
                {job.venue && job.address && <div className="t-meta truncate">{job.address}</div>}
              </div>
              <div className="row gap-2" style={{ flex: '0 0 auto' }}>
                <a className="btn btn-sm btn-solid" href={wazeLink(place)} target="_blank" rel="noreferrer">🧭 ניווט</a>
                <a className="btn btn-sm" href={mapsLink(place)} target="_blank" rel="noreferrer">מפות</a>
              </div>
            </div>
          )}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 18 }}>
          {/* צינור סטטוס */}
          <div className="t-meta" style={{ marginBottom: 8 }}>סטטוס</div>
          <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
            {STATUSES.map((s, i) => (
              <button key={s.id} onClick={() => onStatus(job.id, s.id)} title={s.label}
                style={{ flex: 1, height: 6, borderRadius: 3, border: 0, cursor: 'pointer', padding: 0, background: i <= curIdx ? 'var(--gold)' : 'var(--hair)' }} />
            ))}
          </div>
          <div className="row between gap-2" style={{ marginBottom: 18 }}>
            <div style={{ fontWeight: 700 }}>{STATUSES[curIdx].label}</div>
            {next
              ? <button className="btn btn-sm btn-solid" onClick={() => onStatus(job.id, next.id)}>קדם ל“{next.label}” ←</button>
              : <span className="chip chip-go"><span className="chip-dot" />הושלם</span>}
          </div>

          {/* הצעת מחיר */}
          {(() => {
            const q = quoteOf(job)
            const total = job.price || itemsTotal
            const producer = clients.find(c => c.id === job.clientId) || null
            const link = producer ? portalLink(producer.token) : null
            const msg = link
              ? quoteMessage({ ...job, price: total }, producer, link)
              : `שלום ${job.client},
מצורפת הצעת מחיר לאירוע "${job.title}" בתאריך ${fmtDate(job.eventDate)}.
סה״כ: ${ils(total)}
נשמח לאישורך.`
            const wa = waLink(producer?.phone || job.contact, msg)
            const mail = producer?.email
              ? mailLink(producer.email, `הצעת מחיר — ${job.title}`, msg)
              : null

            // שליחה וסימון באותה לחיצה — אחרת שוכחים לסמן
            const sendVia = (href) => {
              if (href) window.open(href, '_blank', 'noopener')
              if (job.quoteStatus !== 'sent') onQuote(job.id, 'sent')
            }
            const pending = job.quoteStatus !== 'sent' && job.quoteStatus !== 'approved'

            return (
              <>
                <div className="t-meta" style={{ marginBottom: 8 }}>הצעת מחיר</div>
                <div style={{
                  background: 'var(--card-2)', border: `1px solid ${q.id === 'none' ? 'var(--line)' : q.color}`,
                  borderRadius: 10, padding: 12, marginBottom: 18,
                }}>
                  <div className="row between gap-2" style={{ marginBottom: 10 }}>
                    <span style={{ fontWeight: 700, fontSize: 14, color: q.color }}>{q.label}</span>
                    <span className="mono" style={{ fontWeight: 600 }}>{ils(total)}</span>
                  </div>

                  {/* שליחה */}
                  {(pending || job.quoteStatus === 'sent') && (
                    <>
                      <div className="t-meta" style={{ marginBottom: 6 }}>
                        {pending ? 'שלח ללקוח' : 'שלח שוב'}
                      </div>
                      <div className="row gap-2 wrap" style={{ marginBottom: 10 }}>
                        {wa && <button className="btn btn-sm" style={{ color: '#55C07E' }}
                          disabled={!total} onClick={() => sendVia(wa)}>📱 וואטסאפ</button>}
                        {mail && <button className="btn btn-sm"
                          disabled={!total} onClick={() => sendVia(mail)}>✉️ מייל</button>}
                        {pending && <button className="btn btn-sm"
                          disabled={!total} onClick={() => sendVia(null)}>📞 נמסר טלפונית</button>}
                      </div>
                      {!total && (
                        <div className="t-meta" style={{ marginBottom: 10, color: '#D9822B' }}>
                          אין עדיין סכום — הוסף פריטים ומחירים בעריכת העבודה לפני שליחת ההצעה.
                        </div>
                      )}
                      {!producer && (
                        <div className="t-meta" style={{ marginBottom: 10, color: '#D9822B' }}>
                          העבודה לא משויכת למפיקה — ההודעה תישלח בלי קישור לאישור.
                          שייך אותה בעריכת העבודה.
                        </div>
                      )}
                      {producer && !producer.email && (
                        <div className="t-meta" style={{ marginBottom: 10 }}>
                          אין מייל ל{producer.name} — אפשר להוסיף בהגדרות.
                        </div>
                      )}
                    </>
                  )}

                  {/* החלטה */}
                  <div className="row gap-2 wrap">
                    {job.quoteStatus === 'sent' && (
                      <>
                        <button className="btn btn-sm btn-solid" onClick={() => onQuote(job.id, 'approved')}>הלקוח אישר ✓</button>
                        <button className="btn btn-sm" style={{ color: '#E5735B' }} onClick={() => onQuote(job.id, 'rejected')}>נדחתה</button>
                      </>
                    )}
                    {job.quoteStatus === 'approved' && (
                      <button className="btn btn-sm" onClick={() => onQuote(job.id, 'sent')}>בטל אישור</button>
                    )}
                  </div>

                  {/* רמת הפירוט שהלקוח רואה */}
                  {onShowPrices && (
                    <label className="row gap-2" style={{
                      marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--hair)',
                      cursor: 'pointer', fontSize: 13, color: 'var(--ink70)',
                    }}>
                      <input type="checkbox" checked={!!job.showItemPrices}
                        onChange={e => onShowPrices(job.id, e.target.checked)}
                        style={{ width: 16, height: 16, accentColor: 'var(--gold)' }} />
                      הצג ללקוח מחיר לכל פריט
                      <span className="t-meta">{job.showItemPrices ? '' : '(רואה סה״כ בלבד)'}</span>
                    </label>
                  )}
                </div>
              </>
            )
          })()}

          {/* משמרות */}
          <div className="row between" style={{ marginBottom: 8 }}>
            <div className="t-meta">משמרות הקמה / פירוק</div>
            <button className="btn btn-sm" onClick={() => setShiftEdit(null)}>＋ משמרת</button>
          </div>
          {jobShifts.length === 0 ? (
            <div className="muted" style={{ fontSize: 13, marginBottom: 18 }}>לא הוגדרו משמרות עדיין.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
              {jobShifts.map(sh => {
                const filled = sh.assigned.length >= sh.need
                const crew = sh.assigned.map(id => employees.find(e => e.id === id)).filter(Boolean)
                return (
                  <button key={sh.id} onClick={() => setShiftEdit(sh)} style={{
                    appearance: 'none', width: '100%', textAlign: 'start', cursor: 'pointer', font: 'inherit', color: 'var(--ink)',
                    background: 'var(--card-2)', border: '1px solid var(--line)', borderRadius: 8, padding: 10,
                    display: 'flex', alignItems: 'center', gap: 10,
                  }}>
                    <span className="chip" style={{ flex: 'none' }}>{shiftKindLabel(sh.kind)}</span>
                    <div className="grow" style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 13.5 }}>
                        {fmtDate(sh.date)} · <span className="mono">{sh.start_time}–{sh.end_time}</span>
                      </div>
                      <div className="row gap-1" style={{ marginTop: 5 }}>
                        {crew.slice(0, 4).map(e => <EmpAvatar key={e.id} name={e.name} size={22} />)}
                        <span className="t-meta" style={{ marginInlineStart: 4 }}>{sh.assigned.length}/{sh.need}</span>
                      </div>
                    </div>
                    <span className={filled ? 'chip chip-go' : 'chip chip-signal'} style={{ flex: 'none' }}>{filled ? 'מלא' : 'חסר'}</span>
                  </button>
                )
              })}
            </div>
          )}

          {/* לוגיסטיקה — מה שהמפיקה ביקשה */}
          {(job.service && job.service !== 'setup') || job.setupDate || job.teardownDate
            || job.contactName || job.accessNotes || job.referenceUrl ? (
            <>
              <div className="t-meta" style={{ margin: '18px 0 8px' }}>הגעה והקמה</div>
              <div style={{
                background: 'var(--card-2)', border: '1px solid var(--line)',
                borderRadius: 9, padding: '10px 12px', marginBottom: 4,
              }}>
                {[
                  ['שירות', SERVICE_LABEL[job.service] || SERVICE_LABEL.setup],
                  ['הגעה', job.setupDate && `${fmtDate(job.setupDate)}${job.setupTime ? ' · ' + shortTime(job.setupTime) : ''}`],
                  ['פירוק', job.teardownDate && `${fmtDate(job.teardownDate)}${job.teardownTime ? ' · ' + shortTime(job.teardownTime) : ''}`],
                ].filter(([, v]) => v).map(([k, v]) => (
                  <div key={k} className="row between gap-2" style={{ fontSize: 13.5, padding: '3px 0' }}>
                    <span className="t-meta">{k}</span><span>{v}</span>
                  </div>
                ))}
                {job.contactName && (
                  <div className="row between gap-2" style={{ fontSize: 13.5, padding: '3px 0' }}>
                    <span className="t-meta">איש קשר בשטח</span>
                    <span>
                      {job.contactName}
                      {job.contactPhone && <> · <a href={`tel:${job.contactPhone}`} className="mono"
                        style={{ color: 'var(--gold-fg)', textDecoration: 'none' }}>{job.contactPhone}</a></>}
                    </span>
                  </div>
                )}
                {job.accessNotes && (
                  <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid var(--hair)' }}>
                    <div className="t-meta" style={{ marginBottom: 2 }}>גישה ופריקה</div>
                    <div style={{ fontSize: 13, color: 'var(--ink70)', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{job.accessNotes}</div>
                  </div>
                )}
                {job.referenceUrl && (
                  <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid var(--hair)' }}>
                    <a href={job.referenceUrl} target="_blank" rel="noreferrer"
                      style={{ fontSize: 13, color: 'var(--gold-fg)', wordBreak: 'break-all' }}>
                      🔗 קבצים והשראה מהלקוחה
                    </a>
                  </div>
                )}
              </div>
            </>
          ) : null}

          {/* קבצים */}
          <div className="row between" style={{ margin: '18px 0 8px' }}>
            <div className="t-meta">קבצים ומיתוג</div>
            {files.length > 0 && <div className="t-meta">{files.length}</div>}
          </div>
          <div style={{ marginBottom: 4 }}>
            <FileList
              files={files}
              hint="לוגו, מותג, סקיצות. מה שתעלה כאן — הלקוח רואה בדף שלו."
              onUpload={async (f) => {
                await uploadJobFile(job.id, f)
                setFiles(await loadFiles(job.id))
              }}
              onDelete={async (f) => {
                await deleteJobFile(f)
                setFiles(fs => fs.filter(x => x.id !== f.id))
              }}
            />
          </div>

          {/* שיחה עם הלקוח */}
          {(() => {
            const producer = clients.find(c => c.id === job.clientId) || null
            const last = msgs[msgs.length - 1]
            const waReply = producer?.phone || job.contact
            const send = async (text) => {
              const saved = await postJobMessage(job.id, text)
              setMsgs(m => [...m, saved])
              const w = waLink(waReply, text)
              if (w) window.open(w, '_blank', 'noopener')   // שהיא באמת תראה
            }
            return (
              <>
                <div className="row between" style={{ margin: '18px 0 8px' }}>
                  <div className="t-meta">שיחה עם הלקוח</div>
                  {msgs.length > 0 && <div className="t-meta">{msgs.length} הודעות</div>}
                </div>
                {msgs.length === 0 && (
                  <div className="muted" style={{ fontSize: 13, marginBottom: 8 }}>
                    אין עדיין הודעות. מה שתכתוב כאן יישמר בכרטיס ויישלח גם בוואטסאפ.
                  </div>
                )}
                <div style={{ marginBottom: 18 }}>
                  <Thread messages={msgs} mine="manager" onSend={send} compact
                    placeholder="תשובה ללקוח…"
                    extraAction={last?.from_client
                      ? <span className="t-meta">אחרון: {last.author}</span> : null} />
                </div>
              </>
            )
          })()}

          {/* קוליסות מתוכננות */}
          {onDesign && (
            <>
              <div className="row between" style={{ margin: '18px 0 8px' }}>
                <div className="t-meta">תכנון קוליסות</div>
                <button className="btn btn-sm" onClick={() => onDesign(job.id, null)}>＋ קוליסה</button>
              </div>
              {jobKool.length === 0 ? (
                <div className="muted" style={{ fontSize: 13, marginBottom: 18 }}>
                  אין עדיין קוליסה מתוכננת לעבודה הזאת.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
                  {jobKool.map(k => (
                    <button key={k.id} onClick={() => onDesign(job.id, k.id)} className="row between gap-2" style={{
                      appearance: 'none', cursor: 'pointer', textAlign: 'start', font: 'inherit',
                      background: 'var(--card-2)', border: '1px solid var(--line)',
                      borderRadius: 9, padding: '10px 12px', color: 'var(--ink)',
                    }}>
                      <span style={{ minWidth: 0 }}>
                        <span style={{ fontWeight: 600, fontSize: 14, display: 'block' }} className="truncate">{k.name}</span>
                        <span className="t-meta">
                          {(k.parts || []).length} חלקים · <span className="mono">{k.preview?.גובה}×{k.preview?.רוחב}</span>
                        </span>
                      </span>
                      <span className="t-meta">פתח במעצב ←</span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          {/* פריטים */}
          <div className="row between" style={{ marginBottom: 8 }}>
            <div className="t-meta">פריטים</div>
            <div className="t-meta">{job.items.length} סוגים</div>
          </div>
          {job.items.length === 0 ? (
            <div className="card" style={{ padding: 16, borderStyle: 'dashed', textAlign: 'center', marginBottom: 18 }}>
              <div style={{ fontWeight: 600 }}>עוד לא הוגדרו פריטים</div>
              <div className="muted" style={{ fontSize: 13 }}>הוסף קוליסה, שטיח או שלט לעבודה.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
              {job.items.map((it, i) => (
                <div key={i} className="row gap-3" style={{ background: 'var(--card-2)', border: '1px solid var(--line)', borderRadius: 8, padding: 8 }}>
                  <Thumb cat={it.cat} size={44} />
                  <div className="grow" style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }} className="truncate">{it.name}</div>
                    <div className="t-meta">{catLabel(it.cat)} · כמות {it.qty}</div>
                    {it.note && <div style={{ fontSize: 12.5, color: 'var(--ink70)', marginTop: 5, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{it.note}</div>}
                  </div>
                  <div className="mono" style={{ fontWeight: 600 }}>{ils(it.price)}</div>
                </div>
              ))}
            </div>
          )}
          {job.items.length > 0 && (
            <div className="row between" style={{ padding: '10px 4px', borderTop: '1px solid var(--hair)' }}>
              <div style={{ fontWeight: 700 }}>סה״כ הצעה</div>
              <div className="mono" style={{ fontSize: 18, fontWeight: 600 }}>{ils(job.price || itemsTotal)}</div>
            </div>
          )}

          {job.note && (
            <>
              <div className="t-meta" style={{ margin: '16px 0 6px' }}>הערה</div>
              <div style={{ background: 'var(--card-2)', border: '1px solid var(--line)', borderRadius: 8, padding: '10px 12px', fontSize: 14, color: 'var(--ink70)', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{job.note}</div>
            </>
          )}
        </div>

        <div style={{ padding: 14, borderTop: '1px solid var(--line)' }} className="row gap-2">
          <button className="btn btn-solid grow" onClick={onEdit}>עריכת העבודה</button>
        </div>
      </div>

      {shiftEdit !== undefined && (
        <ShiftEdit shift={shiftEdit} jobId={job.id} jobDate={job.eventDate} employees={employees}
          onClose={() => setShiftEdit(undefined)}
          onSaved={(s) => { onShiftSaved(s); setShiftEdit(undefined) }}
          onDeleted={(id) => { onShiftDeleted(id); setShiftEdit(undefined) }} />
      )}
    </div>
  )
}
