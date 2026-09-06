// ==========================================================================
// הגדרות ועזרים. הנתונים מגיעים מ-Supabase (ראה db.js).
// ==========================================================================

// צינור הסטטוסים של עבודה. הסדר קובע את התקדמות ה"קדימה".
export const STATUSES = [
  { id: 'inquiry',    label: 'פנייה',       tone: 'neutral' },
  { id: 'design',     label: 'עיצוב',       tone: 'neutral' },
  { id: 'approval',   label: 'אישור לקוח',  tone: 'signal'  }, // ממתין ללקוח = דורש תשומת לב
  { id: 'production', label: 'בהפקה',        tone: 'neutral' },
  { id: 'ready',      label: 'מוכן',         tone: 'go'      },
  { id: 'installed',  label: 'הותקן',        tone: 'go'      },
]

export const statusById = Object.fromEntries(STATUSES.map(s => [s.id, s]))
export const statusIndex = id => STATUSES.findIndex(s => s.id === id)

// סוגי משמרת
export const SHIFT_KINDS = [
  { id: 'setup', label: 'הקמה' },
  { id: 'teardown', label: 'פירוק' },
]
export const shiftKindLabel = k => (SHIFT_KINDS.find(s => s.id === k) || {}).label || 'משמרת'

// מצבי זמינות של עובד ליום — צבע לכל חלק ביום
export const AVAIL = [
  { id: 'full',      label: 'פנוי כל היום',  color: '#3E9C68' },
  { id: 'morning',   label: 'בוקר בלבד',     color: '#EEC421' },
  { id: 'afternoon', label: 'צהריים עד ערב', color: '#D9822B' },
  { id: 'evening',   label: 'ערב ולילה',     color: '#6C7BD1' },
  { id: 'off',       label: 'לא פנוי',       color: '#A8382A' },
]
// טווח שעות חופשי שהעובד בוחר בעצמו
export const AVAIL_CUSTOM = { id: 'custom', label: 'שעות מותאמות', color: '#2F9E8F' }

export const availById = Object.fromEntries([...AVAIL, AVAIL_CUSTOM].map(a => [a.id, a]))

// '09:00' -> '9' , '14:30' -> '14:30'
export const shortTime = t => {
  if (!t) return ''
  const [h, m] = String(t).slice(0, 5).split(':')
  return m === '00' ? String(Number(h)) : `${Number(h)}:${m}`
}
export const availLabel = (a) => a?.status === 'custom'
  ? `${shortTime(a.start_time)}–${shortTime(a.end_time)}`
  : (availById[a?.status]?.label || '')

// קטגוריות פריטים
export const CATEGORIES = {
  backdrop: 'קוליסה',
  carpet:   'שטיח',
  sign:     'שלט כאפות',
  print:    'הדפסה',
  other:    'אחר',
}

// "היום" האמיתי, מנורמל לחצות מקומית
const _now = new Date()
export const TODAY = new Date(_now.getFullYear(), _now.getMonth(), _now.getDate())

// ---- עזרי תאריך ----
const _pad = n => String(n).padStart(2, '0')
export const isoLocal = d => `${d.getFullYear()}-${_pad(d.getMonth() + 1)}-${_pad(d.getDate())}`
export const parseDate = s => { const [y, m, dd] = String(s).split('-').map(Number); return new Date(y, m - 1, dd) }
export const daysUntil = s => Math.round((parseDate(s) - TODAY) / 86400000)

export function fmtDate(s) {
  if (!s) return 'ללא תאריך'
  const dt = parseDate(s)
  const day = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'][dt.getDay()]
  return `יום ${day} ${dt.getDate()}.${dt.getMonth() + 1}`
}

export function relLabel(s) {
  if (!s) return ''
  const n = daysUntil(s)
  if (n === 0) return 'היום'
  if (n === 1) return 'מחר'
  if (n === -1) return 'אתמול'
  if (n < 0) return `לפני ${-n} ימים`
  return `בעוד ${n} ימים`
}

// עבודה "דחופה": בתוך 7 ימים ועדיין לא מוכנה/הותקנה
export function isUrgent(job) {
  if (!job.eventDate) return false
  const n = daysUntil(job.eventDate)
  return n >= 0 && n <= 7 && job.status !== 'ready' && job.status !== 'installed'
}

export const ils = n => `${(Number(n) || 0).toLocaleString('en-US')}₪`
