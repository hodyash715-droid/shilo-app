// ============================================================
// מחולל קוליסה: מידה חיצונית ← מסגרת שלמה, בלי שיקליד נוסחאות.
//
// מבנה מאושר: 2 אנכיות · 2 גיבנים (עליון ותחתון), כל גיבן משתי לטות
// באורך רוחב−4 ⇒ 4 לטות גיבן · חיזוקים לפי בחירה.
//
// כל האורכים נגזרים מחתך החומר שנבחר בפועל ("לטה 2×3" ⇒ 2 בחזית),
// ולא ממספר קבוע בקוד. מחליפים חומר — הנוסחאות משתנות איתו.
// ============================================================

import { profileOf } from './geometry.js'
import { LIMITS, validateDims, VERTICAL_FACE_CM, innerWidth, GIBEN, gibenMemberCount } from './rules.js'

// רוחבים נפוצים. העדפה בלבד — לא חוסמת מידה חריגה.
export const LIMITS_PREFERRED = [40, 60, 80, 100, 120, 150]

export const BRACE_DEFAULT = 3
export const BRACE_MAX = 8

const uid = () => Math.random().toString(36).slice(2, 10)
const r1 = n => Math.round(n * 10) / 10

// מיקומי החיזוקים: חלוקה שווה של הגובה. ב־240 עם 3 ⇒ 60 / 120 / 180.
// זו שיטת עבודה, לא חישוב עומסים — המשתמש יכול להזיז כל חיזוק אחר כך.
export function bracePositions(height, count) {
  const n = Math.max(0, Math.min(BRACE_MAX, Math.round(count) || 0))
  if (!(height > 0)) return []
  return Array.from({ length: n }, (_, i) => r1((height * (i + 1)) / (n + 1)))
}

// עובי הפרופיל בס"מ: [בחזית, בעומק] לפי שם החומר.
export function sectionOf(material) {
  return profileOf({ invId: material?.id, name: material?.name }, material ? [material] : [])
}

// חומר המסגרת המועדף: הראשון שתופס בחזית בדיוק את מה שאושר (2 ס"מ).
// בלי זה המחולל היה לוקח את הפריט הראשון במלאי — למשל קורה 5×5,
// ומוציא פנימי 110 במקום 116.
export function defaultFrameMaterial(materials = []) {
  const usable = materials.filter(m => !m.legacy)
  return usable.find(m => sectionOf(m)[0] === VERTICAL_FACE_CM) || usable[0] || materials[0] || null
}

/**
 * בונה את חלקי הקוליסה.
 * @returns {{ parts, errors, warnings, plan }}
 */
export function generateKulisa({ width, height, depth = 40, material, braces = BRACE_DEFAULT, giben = true }) {
  // המחולל עוסק ברוחב ובגובה בלבד. עומק שלא הוגדר לא חוסם — נופל ל-40.
  const safeDepth = Number(depth) > 0 ? Number(depth) : 40
  const dims = { גובה: Number(height), רוחב: Number(width), עומק: safeDepth, עובי: 2 }
  const base = validateDims(dims)
  const errors = base.errors.filter(e => e.field === 'רוחב' || e.field === 'גובה').map(e => e.message)
  // במחולל חריגה מהמקסימום חוסמת — קוליסה גדולה מזה לא מיוצרת כיחידה אחת.
  if (base.ok) {
    if (dims.רוחב > LIMITS.maxWidth) errors.push(`רוחב ${dims.רוחב} מעל המקסימום (${LIMITS.maxWidth} ס״מ) — פצל לשתי קוליסות`)
    if (dims.גובה > LIMITS.maxHeight) errors.push(`גובה ${dims.גובה} מעל המקסימום (${LIMITS.maxHeight} ס״מ)`)
  }
  if (!material) errors.push('לא נבחר חומר')
  if (errors.length) return { parts: [], errors, warnings: [], plan: null }

  const [pw, ph] = sectionOf(material)          // pw = בחזית, ph = בעומק
  const inner = r1(dims.רוחב - 2 * pw)          // אורך כל אופקי בין האנכיות
  const warnings = []
  if (!(inner > 0)) {
    return {
      parts: [], plan: null, warnings,
      errors: [`רוחב ${dims.רוחב} קטן מדי לשתי אנכיות של ${material.name}`],
    }
  }

  const lenH = `{רוחב}-${r1(2 * pw)}`           // נוסחה — תתעדכן עם שינוי הרוחב
  const mk = (name, axis, len, pos) => ({ id: uid(), invId: material.id, name, axis, len, pos })
  const parts = []

  // ---- אנכיות: לכל גובה הקוליסה ----
  const vx = r1(dims.רוחב / 2 - pw / 2)
  parts.push(mk('אנכית ימין', 'y', '{גובה}', { x: vx, y: r1(dims.גובה / 2), z: 0 }))
  parts.push(mk('אנכית שמאל', 'y', '{גובה}', { x: -vx, y: r1(dims.גובה / 2), z: 0 }))

  // ---- עליונה ותחתונה, נכנסות בין האנכיות ----
  const yTop = r1(dims.גובה - ph / 2), yBot = r1(ph / 2)
  const ends = [['עליון', yTop, 'עליונה'], ['תחתון', yBot, 'תחתונה']].slice(0, GIBEN.perKulisa)

  if (giben) {
    // כל גיבן הוא מכלול של GIBEN.membersEach לטות. במציאות הן מסובבות 90°
    // זו לזו; מודל החלקים שלנו לא יודע לסובב פרופיל, לכן הן מוצגות צמודות
    // בעומק. האורכים ברשימת החיתוך נכונים.
    ends.forEach(([label, y]) => {
      for (let i = 0; i < GIBEN.membersEach; i++) {
        parts.push(mk(`גיבן ${label} · לטה ${i + 1}`, 'x', lenH, { x: 0, y, z: r1(-i * pw) }))
      }
    })
    warnings.push(`כל גיבן מוצג כ-${GIBEN.membersEach} לטות צמודות בעומק ולא מסובבות 90° — האורכים ברשימת החיתוך נכונים`)
  } else {
    ends.forEach(([, y, plain]) => parts.push(mk(plain, 'x', lenH, { x: 0, y, z: 0 })))
  }

  // ---- חיזוקים ----
  const ys = bracePositions(dims.גובה, braces)
  ys.forEach((y, i) => parts.push(mk(`חיזוק ${i + 1}`, 'x', lenH, { x: 0, y, z: 0 })))

  // סטייה מהכלל המאושר — לא חוסמת, אבל חייבת להיאמר.
  if (pw !== VERTICAL_FACE_CM) {
    warnings.push(
      `${material.name} תופס ${pw} ס״מ בחזית במקום ${VERTICAL_FACE_CM} שאושרו — הפנימי יוצא ${inner} ולא ${innerWidth(dims.רוחב)}`
    )
  }

  if (dims.רוחב > 0 && !LIMITS_PREFERRED.includes(dims.רוחב))
    warnings.push(`רוחב ${dims.רוחב} אינו מידה סטנדרטית (${LIMITS_PREFERRED.join(' / ')})`)

  return {
    parts, errors: [], warnings,
    plan: {
      section: [pw, ph], inner, braces: ys,
      counts: {
        verticals: 2,
        gibens: giben ? GIBEN.perKulisa : 0,
        gibenMembers: giben ? gibenMemberCount() : 0,
        horizontals: giben ? gibenMemberCount() : 2,   // סך הלטות האופקיות במסגרת
        braces: ys.length,
      },
      totalCuts: parts.length,
    },
  }
}

