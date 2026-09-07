// ============================================================
// לוגיקת טופס ההזמנה של המפיקה: ולידציה, טיוטה מקומית, ובניית
// המטען לשרת. מופרד מהתצוגה כדי שאפשר יהיה לבדוק אותו בלי דפדפן.
// ============================================================

export const SERVICE_LABELS = {
  setup: 'הובלה והקמה',
  delivery: 'הובלה בלבד',
  pickup: 'איסוף עצמי',
}

export const emptyOrder = () => ({
  title: '', eventDate: '', time: '', venue: '', address: '', service: 'setup',
  setupDate: '', setupTime: '', teardownDate: '', teardownTime: '',
  contactName: '', contactPhone: '', access: '', reference: '', note: '', items: [],
})

export const localDate = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const realDate = v => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false
  const d = new Date(`${v}T12:00:00Z`)
  return Number.isFinite(+d) && d.toISOString().slice(0, 10) === v
}
const validTime = v => !v || /^([01]\d|2[0-3]):[0-5]\d$/.test(v)

// ולידציה לפי שלב. מחזירה מפה של שדה -> הודעה.
export function validateOrder(order, step, today = localDate()) {
  const e = {}

  if (step === 0) {
    if (!order.title.trim()) e.title = 'מה שם האירוע?'
    if (!realDate(order.eventDate)) e.eventDate = 'יש לבחור תאריך לאירוע.'
    else if (order.eventDate < today) e.eventDate = 'תאריך האירוע כבר עבר.'
    if (!order.venue.trim() && !order.address.trim()) e.venue = 'יש לציין שם מקום או כתובת.'
    if (!validTime(order.time)) e.time = 'יש להזין שעה תקינה.'

    if (order.service !== 'pickup') {
      // שם בלי טלפון (או להפך) לא שווה כלום כשצריך להתקשר מהשטח
      if (Boolean(order.contactName.trim()) !== Boolean(order.contactPhone.trim())) {
        e[order.contactName.trim() ? 'contactPhone' : 'contactName'] = 'יש להשלים שם וטלפון של איש הקשר.'
      }
      if (order.contactPhone && (!/^\+?[\d\s()-]{8,20}$/.test(order.contactPhone.trim())
        || !/^\d{8,15}$/.test(order.contactPhone.replace(/\D/g, '')))) {
        e.contactPhone = 'יש להזין מספר טלפון תקין.'
      }
      for (const p of order.service === 'setup' ? ['setup', 'teardown'] : ['setup']) {
        const date = order[`${p}Date`], time = order[`${p}Time`]
        if (date && !realDate(date)) e[`${p}Date`] = 'יש לבחור תאריך תקין.'
        if (time && !date) e[`${p}Date`] = 'יש לציין גם תאריך.'
        if (!validTime(time)) e[`${p}Time`] = 'יש להזין שעה תקינה.'
      }
      if (order.setupDate && order.eventDate && order.setupDate > order.eventDate) {
        e.setupDate = 'מועד ההגעה צריך להיות לפני האירוע או ביום האירוע.'
      }
      if (order.setupDate === order.eventDate && order.setupTime && order.time && order.setupTime > order.time) {
        e.setupTime = 'שעת ההגעה מאוחרת משעת האירוע.'
      }
      if (order.service === 'setup' && order.teardownDate && order.teardownDate < order.eventDate) {
        e.teardownDate = 'מועד הפירוק צריך להיות ביום האירוע או אחריו.'
      }
      if (order.service === 'setup' && order.teardownDate === order.eventDate
        && order.teardownTime && order.time && order.teardownTime < order.time) {
        e.teardownTime = 'שעת הפירוק מוקדמת משעת האירוע.'
      }
    }
  }

  if (step === 1) {
    if (!order.items.length && !order.note.trim()) e.items = 'יש לבחור פריט או לתאר את הבקשה בהערות.'
    order.items.forEach((it, i) => {
      if (!it.name.trim()) e[`item-name-${i}`] = 'יש לתת שם לפריט.'
      const q = Number(it.qty)
      if (!Number.isInteger(q) || q < 1 || q > 999) e[`item-qty-${i}`] = 'הכמות צריכה להיות מספר שלם בין 1 ל־999.'
    })
    if (order.reference.trim()) {
      try {
        const u = new URL(order.reference.trim())
        if (!['http:', 'https:'].includes(u.protocol)) throw new Error('bad protocol')
      } catch { e.reference = 'יש להזין קישור מלא שמתחיל ב־https:// או http://.' }
    }
  }

  return e
}

// המטען לשרת. הלוגיסטיקה נשמרת בשדות אמיתיים, לא נדחסת ל-note,
// כדי ששי יוכל לשאול "למי יש פירוק מחר".
export function orderPayload(order) {
  const t = s => (s || '').trim()
  return {
    title: t(order.title), eventDate: order.eventDate, time: order.time,
    venue: t(order.venue), address: t(order.address),
    note: t(order.note) || null,
    service: SERVICE_LABELS[order.service] ? order.service : 'setup',
    setupDate: order.service === 'pickup' ? null : (order.setupDate || null),
    setupTime: order.service === 'pickup' ? null : (order.setupTime || null),
    teardownDate: order.service === 'setup' ? (order.teardownDate || null) : null,
    teardownTime: order.service === 'setup' ? (order.teardownTime || null) : null,
    contactName: order.service === 'pickup' ? null : (t(order.contactName) || null),
    contactPhone: order.service === 'pickup' ? null : (t(order.contactPhone) || null),
    access: order.service === 'pickup' ? null : (t(order.access) || null),
    reference: t(order.reference) || null,
    items: order.items.map(it => ({
      name: t(it.name), qty: Number(it.qty), cat: it.cat || 'other', price: 0,
      ...(t(it.note) ? { note: t(it.note) } : {}),
    })),
  }
}

// ---------- טיוטה מקומית ----------
export const hasDraft = order =>
  order.items.length > 0 || order.service !== 'setup' ||
  Object.entries(order).some(([k, v]) =>
    k !== 'items' && k !== 'service' && typeof v === 'string' && v.trim())

export const draftKey = token => `shilo:order-draft:v1:${encodeURIComponent(token)}`

export function readDraft(storage, token) {
  try {
    const raw = JSON.parse(storage.getItem(draftKey(token)))
    // טיוטה בת חודש כבר לא רלוונטית לאירוע
    if (raw?.version !== 1 || !raw.order || !Number.isFinite(raw.savedAt)
      || Date.now() - raw.savedAt > 30 * 86400000) return emptyOrder()
    const order = emptyOrder()
    for (const k of Object.keys(order)) {
      if (k !== 'items' && typeof raw.order[k] === 'string') order[k] = raw.order[k]
    }
    if (!SERVICE_LABELS[order.service]) order.service = 'setup'
    order.items = Array.isArray(raw.order.items)
      ? raw.order.items
        .filter(it => it && typeof it.name === 'string' && typeof it.key === 'string')
        .map(it => ({
          key: it.key, name: it.name,
          qty: ['number', 'string'].includes(typeof it.qty) ? it.qty : 1,
          cat: typeof it.cat === 'string' ? it.cat : 'other',
          note: typeof it.note === 'string' ? it.note : '',
          custom: Boolean(it.custom),
        }))
      : []
    return order
  } catch { return emptyOrder() }
}

export function writeDraft(storage, token, order) {
  try {
    if (hasDraft(order)) storage.setItem(draftKey(token), JSON.stringify({ version: 1, savedAt: Date.now(), order }))
    else storage.removeItem(draftKey(token))
    return true
  } catch { return false }
}
