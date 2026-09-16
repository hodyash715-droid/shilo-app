// ============================================================
// כללי בנייה ואימות מידות.
// כל כלל נושא סטטוס כדי שלא נציג ניחוש כעובדה:
//   'verified'   — אושר על ידי שי
//   'preference' — שיטת עבודה, ניתנת לשינוי
//   'assumption' — מספר שהמערכת הניחה. חייב אישור.
// ============================================================

import { DIMS, evalFormula, profileOf } from './geometry.js'
import { maxOrderLength } from './cuts.js'

// כמה ס״מ תופסת אנכית אחת במישור החזית.
// אושר על ידי שי (11.9.2026): בקוליסה ברוחב 120 הפנימי הוא 116,
// כלומר 2 ס״מ לכל אנכית ⇒ אורך אופקי = רוחב − 4.
export const VERTICAL_FACE_CM = 2
export const VERTICAL_FACE_STATUS = 'verified'

// אורך אופקי לפי הכלל המאושר.
export const innerWidth = (width) => Math.round((Number(width) - 2 * VERTICAL_FACE_CM) * 10) / 10

// מבנה הגיבן. אושר על ידי שי (13.9.2026):
// בכל קוליסה שני גיבנים — עליון ותחתון — וכל גיבן מורכב משתי לטות.
// סך הכול 4 לטות גיבן, כולן באורך רוחב−4.
export const GIBEN = {
  perKulisa: 2,
  membersEach: 2,
  status: 'verified',
}
export const gibenMemberCount = () => GIBEN.perKulisa * GIBEN.membersEach

// קושרת: הקורה שמחברת שתי קוליסות סמוכות מאחור.
// אושר על ידי שי (16.9.2026): שתיים לכל תפר — אחת למעלה ואחת למטה,
// צמודות לקצה או כמעט. כל קושרת עוברת לפחות 20-30 ס"מ על כל קוליסה,
// ולכן אורכה הוא פי שניים מהחפיפה. אותה לטה 4×2.
// שי נקב בטווח ולא במספר אחד — overlapCm הוא אמצע הטווח וניתן לשינוי.
export const KOSHRET = {
  perJoint: 2,
  overlapCm: 25,
  overlapRange: [20, 30],
  placement: 'rear',
  status: 'verified',
  overlapStatus: 'preference',
}
export const koshretLength = (overlapCm = KOSHRET.overlapCm) =>
  Math.round(Number(overlapCm) * 2 * 10) / 10

// מגבלות קוליסה. אושר על ידי שי (13.9.2026): מקסימום 3 מטר גובה על 1.5 מטר רוחב.
// בעיצוב חופשי (שטיח, שלט) חריגה היא אזהרה בלבד; במחולל הקוליסה היא חוסמת.
export const LIMITS = {
  maxWidth: 150,
  maxHeight: 300,
  status: 'verified',
}

// מידה לא תקינה היא שגיאה מוחלטת: אפס, שלילי, NaN או אינסוף.
function badNumber(v) {
  const n = Number(v)
  if (!Number.isFinite(n)) return 'אינו מספר'
  if (n === 0) return 'אפס'
  if (n < 0) return 'שלילי'
  return null
}

// בדיקת מידות הקוליסה. מחזיר שגיאות (חוסמות) ואזהרות (מותר להמשיך).
export function validateDims(dims, limits = LIMITS) {
  const errors = [], warnings = []
  for (const d of DIMS) {
    const bad = badNumber(dims?.[d])
    if (bad) errors.push({ field: d, message: `${d} ${bad}` })
  }
  if (!errors.length) {
    if (Number(dims.רוחב) > limits.maxWidth)
      warnings.push({ field: 'רוחב', message: `רוחב ${dims.רוחב} מעל המקסימום המוכר (${limits.maxWidth} ס״מ)` })
    if (Number(dims.גובה) > limits.maxHeight)
      warnings.push({ field: 'גובה', message: `גובה ${dims.גובה} מעל המקסימום המוכר (${limits.maxHeight} ס״מ)` })
  }
  return { ok: errors.length === 0, errors, warnings }
}

// חלקים שהנוסחה שלהם לא מניבה אורך חיובי.
// עד היום הם קיבלו בשקט אורך 8 ס״מ ונכנסו כך לרשימת החיתוך.
export function invalidParts(parts = [], dims = {}) {
  return parts
    .map(p => {
      const v = evalFormula(p.len, dims)
      if (Number.isFinite(v) && v > 0) return null
      const why = String(p.len ?? '').trim()
        ? `הנוסחה "${p.len}" לא מניבה אורך חיובי`
        : 'לא הוגדר אורך'
      return { id: p.id, name: p.name || 'חלק', len: p.len, message: why }
    })
    .filter(Boolean)
}

// חלקים ארוכים מהאורך הכי גדול שאפשר להזמין מהחומר הזה.
// לעץ זה 6.2 מטר (ולא 3 מטר) — שי קונה לפי הצורך, אז אורך 400 הוא תקין לגמרי.
export function tooLongParts(parts = [], dims = {}, materials = [], stockOverride = {}) {
  return parts
    .map(p => {
      const v = evalFormula(p.len, dims)
      if (!(Number.isFinite(v) && v > 0)) return null
      const m = materials.find(x => x.id === p.invId)
      const manual = Number(stockOverride[p.invId || m?.name])
      const ceiling = manual > 0 ? manual : maxOrderLength(m)
      if (!(ceiling > 0) || v <= ceiling) return null
      return {
        id: p.id, name: p.name || 'חלק',
        message: `${Math.round(v * 10) / 10} ס״מ — ארוך מהמקסימום שאפשר להזמין מ${m?.name || 'החומר'} (${ceiling} ס״מ)`,
      }
    })
    .filter(Boolean)
}

// עובי הפרופיל במישור החזית, בס״מ.
// בחלק אנכי הצלע הראשונה בשם החומר ("לטה 2×3" → 2) פונה לרוחב הקוליסה.
export function facePw(material) {
  return profileOf({ invId: material?.id, name: material?.name }, material ? [material] : [])[0]
}
