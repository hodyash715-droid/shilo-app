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
