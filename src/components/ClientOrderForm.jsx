import React, { useEffect, useRef, useState } from 'react'
import { CATEGORIES, fmtDate } from '../data.js'
import {
  emptyOrder, hasDraft, localDate, orderPayload, readDraft,
  SERVICE_LABELS, validateOrder, writeDraft,
} from '../clientOrder.js'

// אשף בשלושה שלבים. הלוגיקה יושבת ב-clientOrder.js ונבדקת בנפרד;
// כאן רק התצוגה, באותה שפת עיצוב של שאר דף המפיקות.
const STEPS = ['פרטי האירוע', 'פריטים ומיתוג', 'סיכום ושליחה']
const storage = () => { try { return window.localStorage } catch { return null } }
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2))

const Err = ({ id, msg }) => msg
  ? <div id={id} className="t-meta" role="alert" style={{ color: 'var(--danger)', marginTop: 4 }}>{msg}</div>
  : null

function Field({ id, label, error, required, hint, children, ...rest }) {
  const bind = { id, 'aria-invalid': !!error, 'aria-describedby': error ? id + '-e' : undefined }
  return (
    <div style={{ marginBottom: 12 }}>
      <label htmlFor={id} className="t-meta" style={{ display: 'block', marginBottom: 5 }}>
        {label}{required && <span style={{ color: 'var(--gold-fg)' }}> *</span>}
      </label>
      {children
        ? React.cloneElement(children, bind)
        : <input className="field" {...bind} {...rest}
            style={{ borderColor: error ? 'var(--danger)' : undefined, ...(rest.style || {}) }} />}
      {hint && !error && <div className="t-meta" style={{ marginTop: 4, opacity: .8 }}>{hint}</div>}
      <Err id={id + '-e'} msg={error} />
    </div>
  )
}

export default function ClientOrderForm({ token, client, catalog = [], onSubmit, onSubmitted, active }) {
  const [order, setOrder] = useState(() => readDraft(storage(), token))
  const [step, setStep] = useState(0)
  const [errors, setErrors] = useState({})
  const [sendErr, setSendErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(true)
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('all')
  const [ack, setAck] = useState(false)
  const [askReset, setAskReset] = useState(false)
  const [focusId, setFocusId] = useState('')
  const formRef = useRef(null)
  const headRef = useRef(null)
  const lock = useRef(false)

  useEffect(() => { setSaved(writeDraft(storage(), token, order)) }, [order, token])

  // מזהיר לפני סגירה רק כשבאמת יש מה לאבד
  useEffect(() => {
    if (!busy && (!hasDraft(order) || saved)) return
    const guard = e => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', guard)
    return () => window.removeEventListener('beforeunload', guard)
  }, [order, busy, saved])

  useEffect(() => {
    if (!focusId || !active) return
    const el = formRef.current?.querySelector('[id="' + focusId + '"]') || headRef.current
    el?.focus?.()
    el?.scrollIntoView?.({ block: 'center' })
    setFocusId('')
  }, [focusId, step, active])

  const set = (k, v) => {
    setOrder(c => ({ ...c, [k]: v })); setErrors(c => ({ ...c, [k]: undefined })); setAck(false)
  }
  const patchItem = (key, p) => {
    setOrder(c => ({ ...c, items: c.items.map(i => i.key === key ? { ...i, ...p } : i) })); setAck(false)
  }
  const dropItem = key => {
    setOrder(c => ({ ...c, items: c.items.filter(i => i.key !== key) })); setAck(false)
  }
  const addFromCatalog = it => {
    const key = 'catalog:' + it.category + ':' + it.name
    setOrder(c => {
      const found = c.items.find(i => i.key === key)
      return {
        ...c,
        items: found
          ? c.items.map(i => i.key === key ? { ...i, qty: Math.min(999, (Number(i.qty) || 0) + 1) } : i)
          : [...c.items, { key, name: it.name, cat: it.category || 'other', qty: 1, note: '' }],
      }
    })
    setAck(false)
  }
  const addCustom = () => {
    set('items', [...order.items, { key: 'custom:' + uid(), name: '', cat: 'other', qty: 1, note: '', custom: true }])
    setFocusId('item-name-' + order.items.length)
  }

  const go = n => { setStep(n); setErrors({}); setSendErr(''); setFocusId('cp-head'); setAskReset(false) }
  const check = n => {
    const found = validateOrder(order, n)
    setErrors(found)
    if (Object.keys(found).length) { setStep(n); setFocusId(Object.keys(found)[0]); return false }
    return true
  }

  const submit = async e => {
    e.preventDefault()
    if (lock.current) return
    if (step < 2) { if (check(step)) go(step + 1); return }
    if (!check(0) || !check(1)) return
    if (!ack) { setErrors({ ack: 'יש לאשר שהפרטים נכונים לפני השליחה.' }); setFocusId('ack'); return }

    lock.current = true; setBusy(true); setSendErr('')
    const payload = orderPayload(order)
    let id
    try {
      id = await onSubmit(token, payload)
      if (!id) throw new Error('no receipt')
    } catch {
      // לא מוחקים את הטיוטה — ייתכן שההזמנה כן נשמרה
      setSendErr('לא התקבל אישור שההזמנה נשמרה. הפרטים נשארו כאן. בדקי ב״ההזמנות שלי״ לפני שליחה נוספת, כדי לא לשלוח פעמיים.')
      setBusy(false); lock.current = false; return
    }
    const blank = emptyOrder()
    writeDraft(storage(), token, blank)
    setOrder(blank); setStep(0); setAck(false); setBusy(false); lock.current = false
    onSubmitted(id, payload)
  }

  const f = (key, label, props = {}) => (
    <Field key={key} id={key} label={label} error={errors[key]} value={order[key]}
      onChange={e => set(key, e.target.value)} maxLength={250} {...props} />
  )

  const units = order.items.reduce((n, i) => n + (Number(i.qty) || 0), 0)
  const uniq = [...new Map(catalog.filter(i => i?.name).map(i => [i.category + ':' + i.name, i])).values()]
  const cats = [...new Set(uniq.map(i => i.category || 'other'))]
  const shown = uniq.filter(i =>
    (cat === 'all' || (i.category || 'other') === cat) &&
    i.name.toLocaleLowerCase('he').includes(q.trim().toLocaleLowerCase('he')))

  const card = { background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14, padding: 14, marginBottom: 12 }
  const h3 = { fontWeight: 700, fontSize: 15 }

  return (
    <form ref={formRef} onSubmit={submit} noValidate>
      {/* מד שלבים */}
      <div className="row between gap-2" style={{ marginBottom: 12 }}>
        {STEPS.map((label, i) => (
          <button type="button" key={label} disabled={i > step || busy} onClick={() => go(i)}
            aria-current={step === i ? 'step' : undefined}
            style={{
              appearance: 'none', flex: 1, cursor: i > step ? 'default' : 'pointer',
              background: 'transparent', border: 0, padding: '0 0 8px', font: 'inherit',
              borderBottom: '2px solid ' + (i <= step ? 'var(--gold)' : 'var(--line)'),
              color: i === step ? 'var(--ink)' : 'var(--ink45)',
              fontWeight: i === step ? 700 : 500, fontSize: 12.5,
            }}>
            {i < step ? '✓ ' : ''}{label}
          </button>
        ))}
      </div>

      <div className="row between gap-2" style={{ marginBottom: 10 }}>
        <span className="serif" id="cp-head" tabIndex={-1} ref={headRef}
          style={{ fontWeight: 600, fontSize: 19, outline: 'none' }}>{STEPS[step]}</span>
        <span className="t-meta" role="status">
          {hasDraft(order) ? (saved ? '✎ טיוטה נשמרה' : '⚠ הטיוטה לא נשמרת') : (step + 1) + ' / 3'}
        </span>
      </div>

      <fieldset disabled={busy} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
        {step === 0 && (
          <>
            <div style={card}>
              <div className="row between" style={{ marginBottom: 10 }}>
                <span style={h3}>מתי ואיפה</span>
                <span className="t-meta">* חובה</span>
              </div>
              {f('title', 'שם האירוע', { required: true, placeholder: 'כנס השקה · בת מצווה · חתונה' })}
              <div className="row gap-2">
                <div className="grow">{f('eventDate', 'תאריך האירוע', { type: 'date', dir: 'ltr', required: true, min: localDate() })}</div>
                <div style={{ width: 120 }}>{f('time', 'שעת התחלה', { type: 'time', dir: 'ltr' })}</div>
              </div>
              {f('venue', 'שם המקום', { placeholder: 'אולם, גן אירועים או מתחם' })}
              {f('address', 'כתובת מלאה', { placeholder: 'רחוב, מספר ועיר', autoComplete: 'street-address' })}
            </div>

            <div style={card}>
              <div style={{ ...h3, marginBottom: 10 }}>הגעה והקמה</div>
              <Field id="service" label="שירות מבוקש">
                <select className="field" value={order.service} onChange={e => set('service', e.target.value)}>
                  {Object.entries(SERVICE_LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                </select>
              </Field>
              {order.service !== 'pickup' && (
                <>
                  <div className="row gap-2">
                    <div className="grow">{f('setupDate', order.service === 'setup' ? 'תאריך הקמה' : 'תאריך הגעה', { type: 'date', dir: 'ltr', max: order.eventDate || undefined })}</div>
                    <div style={{ width: 120 }}>{f('setupTime', 'שעה', { type: 'time', dir: 'ltr' })}</div>
                  </div>
                  {order.service === 'setup' && (
                    <div className="row gap-2">
                      <div className="grow">{f('teardownDate', 'תאריך פירוק', { type: 'date', dir: 'ltr', min: order.eventDate || undefined })}</div>
                      <div style={{ width: 120 }}>{f('teardownTime', 'שעה', { type: 'time', dir: 'ltr' })}</div>
                    </div>
                  )}
                  <div className="row gap-2">
                    <div className="grow">{f('contactName', 'איש קשר בשטח', { placeholder: 'שם מלא' })}</div>
                    <div className="grow">{f('contactPhone', 'טלפון', { type: 'tel', dir: 'ltr', placeholder: '050-0000000', maxLength: 20 })}</div>
                  </div>
                  {f('access', 'גישה ופריקה', { placeholder: 'קומה, מעלית, חניה, כניסת ספקים או מגבלת שעות', maxLength: 500 })}
                </>
              )}
              <div className="t-meta" style={{ lineHeight: 1.7 }}>מועדי ההגעה והפירוק כפופים לתיאום עם שי.</div>
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <div style={card}>
              <div style={{ ...h3, marginBottom: 10 }}>מה צריך לאירוע</div>
              <input className="field" type="search" value={q} onChange={e => setQ(e.target.value)}
                placeholder="חיפוש קוליסה, שלט, שטיח…" aria-label="חיפוש בקטלוג" style={{ marginBottom: 10 }} />
              {cats.length > 1 && (
                <div className="row gap-2 wrap" style={{ marginBottom: 10 }} role="group" aria-label="קטגוריה">
                  {['all', ...cats].map(c => (
                    <button type="button" key={c} onClick={() => setCat(c)} aria-pressed={cat === c}
                      className="btn btn-sm" style={{
                        background: cat === c ? 'var(--gold)' : 'var(--card)',
                        color: cat === c ? 'var(--on-gold)' : 'var(--ink70)',
                        borderColor: cat === c ? 'var(--gold)' : 'var(--line)',
                      }}>{c === 'all' ? 'הכל' : (CATEGORIES[c] || 'אחר')}</button>
                  ))}
                </div>
              )}
              <div style={{ maxHeight: 300, overflowY: 'auto', border: '1px solid var(--line)', borderRadius: 10 }}>
                {shown.map((it, i) => {
                  const picked = order.items.find(x => x.key === 'catalog:' + it.category + ':' + it.name)
                  return (
                    <div key={it.category + ':' + it.name} className="row between gap-2"
                      style={{
                        padding: '9px 11px', borderTop: i ? '1px solid var(--hair)' : 0,
                        background: picked ? 'var(--gold-bg)' : 'transparent',
                      }}>
                      <span style={{ minWidth: 0 }}>
                        <span style={{ display: 'block', fontSize: 14, fontWeight: 600 }} className="truncate">{it.name}</span>
                        <span className="t-meta">{CATEGORIES[it.category] || 'אחר'}</span>
                      </span>
                      <button type="button" className="btn btn-sm" style={{ flex: '0 0 auto', minWidth: 42 }}
                        aria-label={'הוספת ' + it.name} onClick={() => addFromCatalog(it)}>
                        {picked ? <span className="mono">{picked.qty}</span> : '＋'}
                      </button>
                    </div>
                  )
                })}
                {!shown.length && (
                  <div className="muted" style={{ padding: 16, fontSize: 13, textAlign: 'center' }}>
                    {uniq.length ? 'לא נמצאו פריטים בחיפוש הזה.' : 'אפשר להוסיף פריט בהתאמה אישית או לתאר בהערות.'}
                  </div>
                )}
              </div>
              <button type="button" className="btn btn-sm" style={{ width: '100%', marginTop: 10 }} onClick={addCustom}>
                ＋ פריט בהתאמה אישית
              </button>
            </div>

            <div style={card}>
              <div className="row between" style={{ marginBottom: 10 }}>
                <span style={h3}>הפריטים שבחרת</span>
                <span className="t-meta"><span className="mono">{units}</span> יחידות</span>
              </div>
              <Err id="items-e" msg={errors.items} />
              {!order.items.length && <div className="muted" style={{ fontSize: 13 }}>עדיין לא נבחרו פריטים.</div>}
              {order.items.map((it, i) => (
                <div key={it.key} style={{
                  background: 'var(--card-2)', border: '1px solid var(--line)',
                  borderRadius: 10, padding: 11, marginBottom: 8,
                }}>
                  <div className="row between gap-2" style={{ marginBottom: 8 }}>
                    <span style={{ fontWeight: 600, fontSize: 14, minWidth: 0 }} className="truncate">
                      <span className="mono t-meta">{i + 1}</span> {it.custom ? 'פריט בהתאמה אישית' : it.name}
                    </span>
                    <button type="button" className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)', flex: '0 0 auto' }}
                      aria-label={'הסרת ' + (it.name || 'הפריט')} onClick={() => dropItem(it.key)}>✕</button>
                  </div>
                  {it.custom && (
                    <Field id={'item-name-' + i} label="שם הפריט" error={errors['item-name-' + i]}
                      value={it.name} maxLength={200} onChange={e => patchItem(it.key, { name: e.target.value })} />
                  )}
                  <div className="row gap-2" style={{ marginBottom: 4 }}>
                    <span className="t-meta" style={{ flex: '0 0 auto' }}>כמות</span>
                    <button type="button" className="btn btn-sm" disabled={Number(it.qty) <= 1}
                      aria-label={'הפחתת כמות ' + it.name}
                      onClick={() => patchItem(it.key, { qty: Math.max(1, Number(it.qty) - 1) })}>−</button>
                    <input id={'item-qty-' + i} className="field mono" type="number" min="1" max="999" step="1" dir="ltr"
                      aria-label={'כמות ' + it.name} aria-invalid={!!errors['item-qty-' + i]}
                      value={it.qty} onChange={e => patchItem(it.key, { qty: e.target.value })}
                      style={{ width: 70, height: 34, textAlign: 'center', padding: 0 }} />
                    <button type="button" className="btn btn-sm" disabled={Number(it.qty) >= 999}
                      aria-label={'הגדלת כמות ' + it.name}
                      onClick={() => patchItem(it.key, { qty: Math.min(999, (Number(it.qty) || 0) + 1) })}>＋</button>
                  </div>
                  <Err id={'item-qty-' + i + '-e'} msg={errors['item-qty-' + i]} />
                  <div style={{ marginTop: 8 }}>
                    <Field id={'item-note-' + i} label="מידות, צבעים וכיתוב" value={it.note} maxLength={500}
                      placeholder="למשל: רוחב 3 מ׳, לבן, לוגו החברה"
                      onChange={e => patchItem(it.key, { note: e.target.value })} />
                  </div>
                </div>
              ))}
            </div>

            <div style={card}>
              <div style={{ ...h3, marginBottom: 10 }}>מיתוג ופרטים נוספים</div>
              {f('reference', 'קישור לקבצים או להשראה', {
                type: 'url', dir: 'ltr', placeholder: 'https://', maxLength: 2000,
                hint: 'אפשר גם לצרף קבצים אחרי השליחה, בכרטיס ההזמנה.',
              })}
              <Field id="note" label="בקשות והערות לשי">
                <textarea className="field" value={order.note} maxLength={4000} rows={4}
                  placeholder="סגנון, פריט שלא מצאת בקטלוג, או כל פרט שחשוב לאירוע"
                  onChange={e => set('note', e.target.value)}
                  style={{ height: 92, padding: '9px 11px', resize: 'vertical', lineHeight: 1.6 }} />
              </Field>
            </div>
          </>
        )}

        {step === 2 && (
          <div style={card}>
            <Summary order={order} onEdit={go} />
            <label htmlFor="ack" className="row gap-2" style={{
              marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--hair)',
              cursor: 'pointer', alignItems: 'flex-start', fontSize: 13, lineHeight: 1.6,
            }}>
              <input id="ack" type="checkbox" checked={ack}
                onChange={e => { setAck(e.target.checked); setErrors({}) }}
                style={{ width: 17, height: 17, marginTop: 2, flex: '0 0 auto', accentColor: 'var(--gold)' }} />
              <span>הפרטים נכונים. הבקשה תועבר לשי לקבלת הצעת מחיר; ההזמנה תהיה סופית רק לאחר אישור ההצעה ותיאום.</span>
            </label>
            <Err id="ack-e" msg={errors.ack} />
          </div>
        )}
      </fieldset>

      {sendErr && (
        <div role="alert" style={{
          background: 'var(--gold-bg)', border: '1px solid var(--warn)', borderRadius: 10,
          padding: 12, fontSize: 13, lineHeight: 1.7, marginBottom: 12,
        }}>{sendErr}</div>
      )}

      <div className="row gap-2">
        <button type="button" className="btn" disabled={busy || step === 0} onClick={() => go(step - 1)}>חזרה</button>
        <button type="submit" className="btn btn-solid grow" style={{ height: 46 }} disabled={busy}>
          {busy ? 'שולחת…' : step === 2 ? 'שליחת הבקשה לשי' : step === 0 ? 'לבחירת פריטים ←' : 'לסיכום ההזמנה ←'}
        </button>
      </div>

      {hasDraft(order) && (
        <div className="row gap-2" style={{ marginTop: 10, justifyContent: 'center' }}>
          {askReset ? (
            <>
              <span className="t-meta">למחוק את הטיוטה?</span>
              <button type="button" className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} disabled={busy}
                onClick={() => { setOrder(emptyOrder()); go(0); setAck(false) }}>מחק</button>
              <button type="button" className="btn btn-ghost btn-sm" disabled={busy}
                onClick={() => setAskReset(false)}>ביטול</button>
            </>
          ) : (
            <button type="button" className="btn btn-ghost btn-sm" style={{ color: 'var(--ink45)' }} disabled={busy}
              onClick={() => setAskReset(true)}>ניקוי הטיוטה</button>
          )}
        </div>
      )}
    </form>
  )
}

function Summary({ order, onEdit }) {
  const p = orderPayload(order)
  const row = { display: 'flex', justifyContent: 'space-between', gap: 10, padding: '5px 0', fontSize: 13.5 }
  const units = order.items.reduce((n, i) => n + (Number(i.qty) || 0), 0)
  return (
    <>
      <div className="row between" style={{ marginBottom: 8 }}>
        <span className="serif" style={{ fontWeight: 600, fontSize: 18 }}>{order.title || 'אירוע חדש'}</span>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => onEdit(0)}>עריכה</button>
      </div>
      <div style={row}>
        <span className="t-meta">תאריך</span>
        <span>{order.eventDate ? fmtDate(order.eventDate) : '—'}{order.time ? <> · <span className="mono">{order.time}</span></> : null}</span>
      </div>
      <div style={row}>
        <span className="t-meta">מקום</span>
        <span className="truncate">{[order.venue, order.address].filter(Boolean).join(', ') || '—'}</span>
      </div>
      <div style={row}><span className="t-meta">שירות</span><span>{SERVICE_LABELS[order.service]}</span></div>
      {p.setupDate && (
        <div style={row}><span className="t-meta">הגעה</span>
          <span className="mono">{p.setupDate}{p.setupTime ? ' ' + p.setupTime : ''}</span></div>
      )}
      {p.teardownDate && (
        <div style={row}><span className="t-meta">פירוק</span>
          <span className="mono">{p.teardownDate}{p.teardownTime ? ' ' + p.teardownTime : ''}</span></div>
      )}
      {p.contactName && (
        <div style={row}><span className="t-meta">איש קשר</span>
          <span>{p.contactName} · <span className="mono">{p.contactPhone}</span></span></div>
      )}

      <div className="row between" style={{ margin: '12px 0 6px', paddingTop: 10, borderTop: '1px solid var(--hair)' }}>
        <span style={{ fontWeight: 700, fontSize: 14 }}>פריטים</span>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => onEdit(1)}>עריכה</button>
      </div>
      {!order.items.length ? (
        <div className="muted" style={{ fontSize: 13 }}>
          {order.note.trim() ? 'בקשה מיוחדת לפי ההערות' : 'לא נבחרו פריטים'}
        </div>
      ) : order.items.map(it => (
        <div key={it.key} style={row}>
          <span style={{ minWidth: 0 }}>
            <span className="truncate" style={{ display: 'block' }}>{it.name || 'פריט בהתאמה אישית'}</span>
            {it.note && <span className="t-meta">{it.note}</span>}
          </span>
          <span className="mono t-meta" style={{ flex: '0 0 auto' }}>×{it.qty || 0}</span>
        </div>
      ))}
      <div className="row between" style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--hair)' }}>
        <span style={{ fontWeight: 700, fontSize: 14 }}>סה״כ יחידות</span>
        <span className="mono" style={{ fontWeight: 700 }}>{units}</span>
      </div>
      <div className="t-meta" style={{ marginTop: 8, lineHeight: 1.7 }}>המחיר ייקבע בהצעה של שי.</div>
    </>
  )
}
