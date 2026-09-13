// ============================================================
// מחלק קיר: מידה שהמפיקה ביקשה ← לכמה קוליסות זה מתחלק.
//
// מה חוק ומה העדפה:
//   חוק     — כל קוליסה עד 150 רוחב ו-300 גובה, והסכום חייב לצאת מדויק.
//   העדפה   — מידות סטנדרטיות, פחות קוליסות, אחידות, סימטריה.
// ההעדפות משפיעות על הדירוג בלבד. שי בוחר.
// ============================================================

import { LIMITS, validateDims } from './rules.js'
import { generateKulisa, LIMITS_PREFERRED, BRACE_DEFAULT } from './kulisa.js'
import { cutList } from './cuts.js'

// כל הצירופים של מידות סטנדרטיות שמסתכמים בדיוק לרוחב הקיר.
// סדר לא-עולה מונע כפילויות של אותה קבוצה בסדר אחר.
export function standardCombos(width, preferred = LIMITS_PREFERRED, limit = 60) {
  const sorted = [...preferred].sort((a, b) => b - a)
  const out = []
  const rec = (rem, start, cur) => {
    if (out.length >= limit) return
    if (rem === 0) { out.push([...cur]); return }
    for (let i = start; i < sorted.length && out.length < limit; i++) {
      const w = sorted[i]
      if (w > rem) continue
      cur.push(w)
      rec(rem - w, i, cur)
      cur.pop()
    }
  }
  rec(width, 0, [])
  return out
}

// סידור סימטרי: זוגות מבחוץ פנימה, והבודד — אם יש — במרכז.
export function arrangeSymmetric(widths) {
  const count = new Map()
  widths.forEach(w => count.set(w, (count.get(w) || 0) + 1))
  const left = [], middle = []
  ;[...count.entries()]
    .sort((a, b) => b[0] - a[0])
    .forEach(([w, n]) => {
      for (let i = 0; i < Math.floor(n / 2); i++) left.push(w)
      if (n % 2) middle.push(w)
    })
  return [...left, ...middle.sort((a, b) => b - a), ...[...left].reverse()]
}

const isSymmetric = (ws) =>
  ws.every((w, i) => w === ws[ws.length - 1 - i])

function metricsOf(widths, preferred) {
  const distinct = new Set(widths).size
  return {
    count: widths.length,
    distinct,
    uniform: distinct === 1,
    allStandard: widths.every(w => preferred.includes(w)),
    symmetric: isSymmetric(widths),
    customCount: widths.filter(w => !preferred.includes(w)).length,
  }
}

function proposal(id, label, widths, preferred, notes = []) {
  const arranged = arrangeSymmetric(widths)
  const m = metricsOf(arranged, preferred)
  const all = [...notes]
  if (m.count === 1) all.push(`קוליסה אחת בלבד`)
  else if (m.uniform) all.push(`${m.count} קוליסות זהות — הכי פשוט לייצר`)
  if (m.allStandard) all.push(m.count === 1 ? 'מידה סטנדרטית' : 'רק מידות סטנדרטיות')
  else if (m.uniform) all.push(`המידה ${arranged[0]} אינה סטנדרטית`)
  else if (m.customCount === 1) all.push(`קוליסה אחת במידה חריגה (${arranged.find(w => !preferred.includes(w))})`)
  else all.push(`${m.customCount} קוליסות במידה חריגה`)
  return { id, label, widths: arranged, metrics: m, notes: all }
}

/**
 * מציע דרכים לחלק קיר לקוליסות.
 * @returns {{ ok, errors, warnings, proposals }}
 */
export function wallProposals(width, height, opts = {}) {
  const preferred = opts.preferred || LIMITS_PREFERRED
  const maxW = opts.maxWidth || LIMITS.maxWidth
  const w = Number(width), h = Number(height)

  const base = validateDims({ גובה: h, רוחב: w, עומק: 40, עובי: 2 })
  const errors = base.errors
    .filter(e => e.field === 'רוחב' || e.field === 'גובה')
    .map(e => e.message.replace('רוחב', 'רוחב הקיר').replace('גובה', 'גובה הקיר'))
  if (!errors.length && h > LIMITS.maxHeight) {
    errors.push(`גובה ${h} מעל ${LIMITS.maxHeight} ס״מ — קוליסה אחת לא מגיעה לגובה הזה`)
  }
  if (errors.length) return { ok: false, errors, warnings: [], proposals: [] }

  const warnings = []
  if (!Number.isInteger(w)) warnings.push(`רוחב הקיר עוגל ל-${Math.round(w)} ס״מ`)
  const W = Math.round(w)
  const minCount = Math.ceil(W / maxW)
  const found = []

  // 1. הכי מעט קוליסות, ואז הכי מעט מידות שונות.
  const combos = standardCombos(W, preferred)
  if (combos.length) {
    const best = combos.slice().sort((a, b) =>
      a.length - b.length ||
      new Set(a).size - new Set(b).size ||
      Math.max(...b) - Math.max(...a)
    )[0]
    found.push(proposal('fewest', 'הכי מעט קוליסות', best, preferred))

    // 2. הצירוף הסטנדרטי עם הכי מעט מידות שונות, אם הוא אחר.
    const simplest = combos.slice().sort((a, b) =>
      new Set(a).size - new Set(b).size ||
      a.length - b.length
    )[0]
    found.push(proposal('simplest', 'הכי אחיד', simplest, preferred))
  }

  // 3. חלוקה שווה במספר הקוליסות המינימלי.
  // כשהרוחב לא מתחלק בשלמים מחלקים כמעט שווה — הפרש של עד 1 ס"מ.
  // אסור לדרוש חלוקה מדויקת: קיר 305 היה מקבל 5 קוליסות של 61
  // במקום 3 של 102/102/101.
  const baseW = Math.floor(W / minCount)
  const extra = W - baseW * minCount
  const nearEqual = Array.from({ length: minCount }, (_, i) => (i < extra ? baseW + 1 : baseW))
  if (nearEqual.every(x => x > 0 && x <= maxW)) {
    found.push(proposal('equal', extra === 0 ? 'חלוקה שווה' : 'חלוקה כמעט שווה', nearEqual, preferred))
  }

  // הסרת כפילויות — אותה חלוקה בדיוק לא צריכה להופיע פעמיים.
  const seen = new Set()
  const proposals = found.filter(p => {
    const key = p.widths.join('|')
    if (seen.has(key)) return false
    seen.add(key)
    return true
  }).slice(0, 3)

  if (proposals.length === 1) warnings.push('נמצאה חלוקה אחת בלבד למידה הזו')
  return { ok: true, errors: [], warnings, proposals }
}

/**
 * רשימת החיתוך המאוחדת של קיר שלם.
 * כל קוליסה נבנית בנפרד עם הרוחב שלה, והשורות מתמזגות.
 */
export function wallCuts(widths, height, { material, materials = [], braces = BRACE_DEFAULT, giben = true } = {}) {
  const merged = new Map()
  const kulisot = []
  const warnings = new Set()

  widths.forEach((width, i) => {
    const g = generateKulisa({ width, height, material, braces, giben })
    if (g.errors.length) { warnings.add(`קוליסה ${i + 1} (${width}): ${g.errors[0]}`); return }
    g.warnings.forEach(x => warnings.add(x))
    kulisot.push({ index: i + 1, width, parts: g.parts, plan: g.plan })

    const dims = { גובה: height, רוחב: width, עומק: 40, עובי: 2 }
    cutList(g.parts, dims, materials).forEach(row => {
      const key = `${row.invId}__${row.len}`
      if (!merged.has(key)) merged.set(key, { ...row })
      else merged.get(key).qty += row.qty
    })
  })

  const rows = [...merged.values()].sort(
    (a, b) => a.mat.localeCompare(b.mat, 'he') || b.len - a.len
  )
  return {
    kulisot,
    rows,
    totalParts: kulisot.reduce((s, k) => s + k.parts.length, 0),
    totalCuts: rows.reduce((s, r) => s + r.qty, 0),
    warnings: [...warnings],
  }
}
