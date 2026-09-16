// ============================================================
// מחלק קיר: מידה שהמפיקה ביקשה ← לכמה קוליסות זה מתחלק.
//
// מה חוק ומה העדפה:
//   חוק     — כל קוליסה עד 150 רוחב ו-300 גובה, והסכום חייב לצאת מדויק.
//   העדפה   — מידות סטנדרטיות, פחות קוליסות, אחידות, סימטריה.
// ההעדפות משפיעות על הדירוג בלבד. שי בוחר.
// ============================================================

import { LIMITS, validateDims, KOSHRET, koshretLength, CORNER, JOINT } from './rules.js'
import { generateKulisa, LIMITS_PREFERRED, BRACE_DEFAULT, sectionOf } from './kulisa.js'
import { cutList } from './cuts.js'
import { rawLenOf } from './geometry.js'

const rr = n => Math.round(n * 10) / 10

// קוליסה בקיר נמסרת כמספר (רוחב בלבד) או כאובייקט עם גובה משלה.
// שער הוא בדיוק המקרה השני: רגליים של 240 וכותרת של 60.
export const kulisaSpec = (w, fallbackH) => {
  const h = w && typeof w === 'object' ? Number(w.height) : NaN
  return {
    width: Number(w && typeof w === 'object' ? w.width : w),
    height: h > 0 ? h : Number(fallbackH),
  }
}

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

  // 1. הצירוף הקצר ביותר ממידות סטנדרטיות.
  // שים לב: זה לא בהכרח הכי מעט קוליסות בסך הכל — חלוקה שווה
  // במידה חריגה יכולה לתת פחות. לכן הכותרת מדברת על המידות.
  const combos = standardCombos(W, preferred)
  if (combos.length) {
    const best = combos.slice().sort((a, b) =>
      a.length - b.length ||
      new Set(a).size - new Set(b).size ||
      Math.max(...b) - Math.max(...a)
    )[0]
    found.push(proposal('standard', 'מידות סטנדרטיות', best, preferred))

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
  const proposals = found
    .sort((a, b) => a.widths.length - b.widths.length)
    .filter(p => {
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

  widths.forEach((w, i) => {
    const { width, height: kh } = kulisaSpec(w, height)
    const g = generateKulisa({ width, height: kh, material, braces, giben })
    if (g.errors.length) { warnings.add(`קוליסה ${i + 1} (${width}): ${g.errors[0]}`); return }
    g.warnings.forEach(x => warnings.add(x))
    kulisot.push({ index: i + 1, width, height: kh, parts: g.parts, plan: g.plan })

    const dims = { גובה: kh, רוחב: width, עומק: 40, עובי: 2 }
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

/**
 * הרכבת קיר: הקוליסות, החיבורים ביניהן, ומה יוצא לדרך.
 *
 * קושרת אינה חיזוק פנימי — היא מחברת שתי קוליסות סמוכות מאחור,
 * ולכן היא שייכת לקיר ולא לקוליסה. שתיים לכל תפר: אחת למעלה ואחת למטה.
 */
export function assembleWall(widths, height, {
  material, materials = [], braces = BRACE_DEFAULT, giben = true,
  overlapCm = KOSHRET.overlapCm,
} = {}) {
  const base = wallCuts(widths, height, { material, materials, braces, giben })
  const warnings = [...base.warnings]
  const n = base.kulisot.length
  const joints = Math.max(0, n - 1)
  const overlap = Number(overlapCm) > 0 ? Number(overlapCm) : KOSHRET.overlapCm
  const lengthCm = koshretLength(overlap)

  // כל תפר מקבל שתי קושרות — עליונה ותחתונה.
  const connections = []
  for (let i = 0; i < joints; i++) {
    const left = base.kulisot[i], right = base.kulisot[i + 1]
    const narrow = Math.min(left.width, right.width)
    if (overlap > narrow) {
      warnings.push(`תפר ${i + 1}: חפיפה ${overlap} ס״מ רחבה מהקוליסה הצרה (${narrow} ס״מ)`)
    }
    connections.push({
      index: i + 1,
      betweenKulisot: [left.index, right.index],
      label: `קושרת בין ${left.index} ל-${right.index}`,
      placement: KOSHRET.placement,
      overlapCm: overlap,
      pieces: Array.from({ length: KOSHRET.perJoint }, (_, j) => ({
        at: j === 0 ? 'עליונה' : 'תחתונה',
        lengthCm,
      })),
    })
  }

  const koshretCount = joints * KOSHRET.perJoint

  // הקושרות נכנסות לרשימת החיתוך — הן עץ שצריך לקנות ולנסר.
  const rows = base.rows.map(r => ({ ...r }))
  if (koshretCount > 0 && material) {
    const same = rows.find(r => r.invId === material.id && r.len === lengthCm)
    if (same) same.qty += koshretCount
    else rows.push({ invId: material.id, mat: material.name, len: lengthCm, qty: koshretCount })
    rows.sort((a, b) => a.mat.localeCompare(b.mat, "he") || b.len - a.len)
  }

  // מה עולה על הרכב.
  const loading = [
    ...base.kulisot.map(k => ({
      kind: 'kulisa',
      label: `קוליסה ${k.index}`,
      detail: `${k.width}×${k.height ?? height} ס״מ`,
      qty: 1,
    })),
    ...(koshretCount > 0 ? [{
      kind: 'koshret',
      label: 'קושרות',
      detail: `${lengthCm} ס״מ · ${KOSHRET.perJoint} לכל תפר`,
      qty: koshretCount,
    }] : []),
  ]

  return {
    kulisot: base.kulisot,
    connections,
    koshret: { count: koshretCount, lengthCm, overlapCm: overlap, perJoint: KOSHRET.perJoint },
    rows,
    loading,
    // מסכמים את הקוליסות שנבנו בפועל ולא את הקלט הגולמי:
    // קוליסה פסולה מדולגת, ואסור שהקיר יתיימר להיות רחב ממה שהורכב.
    totalWidth: base.kulisot.reduce((a, k) => a + k.width, 0),
    height,
    totalCuts: rows.reduce((s2, r) => s2 + r.qty, 0),
    warnings,
  }
}

/**
 * הקיר כולו כחלקים על המשטח: כל הקוליסות זו לצד זו, והקושרות מאחור.
 *
 * האורכים כאן מספרים ולא נוסחאות — נוסחה כמו {רוחב} הייתה מתייחסת
 * לרוחב הקיר כולו במקום לרוחב הקוליסה שאליה החלק שייך.
 */
export function wallParts(widths, height, {
  material, braces = BRACE_DEFAULT, giben = true, overlapCm = KOSHRET.overlapCm, depth = 40,
} = {}) {
  const r1 = n => Math.round(n * 10) / 10
  const uid = () => Math.random().toString(36).slice(2, 10)
  const built = []
  let cursor = 0

  // המזהה הוא מספר השורה, ולא סדר הבנייה: שורה שנחסמה הייתה מזיזה
  // את כל מי שאחריה מספר אחד אחורה, וכל הסידור היה נדבק לקוליסה
  // הלא נכונה — בשקט, בלי שאף אחד יידע.
  const dropped = []
  widths.forEach((w, i) => {
    const { width, height: kh } = kulisaSpec(w, height)
    const g = generateKulisa({ width, height: kh, depth, material, braces, giben })
    if (g.errors.length) {
      dropped.push({ row: i + 1, width, height: kh, error: g.errors[0] })
      return
    }
    built.push({ index: i + 1, width, height: kh, start: cursor, parts: g.parts })
    cursor += width
  })

  const totalWidth = cursor
  // גובה המשטח הוא הגבוה שבקוליסות — בשער זו הרגל, לא הכותרת.
  const topH = built.length ? Math.max(...built.map(k => k.height)) : Number(height)
  const dims = { גובה: topH, רוחב: totalWidth, עומק: depth, עובי: 2 }
  const parts = []

  built.forEach(k => {
    // כל קוליסה ממורכזת סביב 0 בפני עצמה; מזיזים אותה למקומה בקיר.
    const kd = { גובה: k.height, רוחב: k.width, עומק: depth, עובי: 2 }
    const offset = r1(-totalWidth / 2 + k.start + k.width / 2)
    k.parts.forEach(p => parts.push({
      ...p,
      id: uid(),
      k: k.index,                 // לאיזו קוליסה החלק שייך
      name: `ק${k.index} · ${p.name}`,
      len: String(r1(rawLenOf(p, kd))),
      pos: { ...p.pos, x: r1(p.pos.x + offset) },
    }))
  })

  // קושרות: שתיים לכל תפר, מאחורי המסגרת, חוצות את התפר.
  const overlap = Number(overlapCm) > 0 ? Number(overlapCm) : KOSHRET.overlapCm
  const kLen = koshretLength(overlap)
  const [pw, ph] = material ? sectionOf(material) : [2, 4]
  const zBack = r1(-(pw + ph))
  for (let i = 0; i < built.length - 1; i++) {
    const seam = r1(-totalWidth / 2 + built[i].start + built[i].width)
    // הקושרת מונחת על שתי הקוליסות, ולכן היא מגיעה עד ראש הנמוכה שבהן.
    const shared = Math.min(built[i].height, built[i + 1].height)
    ;[['עליונה', r1(shared - ph / 2)], ['תחתונה', r1(ph / 2)]].forEach(([at, y]) => {
      parts.push({
        id: uid(),
        k: 0,                     // 0 = קושרת, לא שייכת לקוליסה אחת
        seam: i + 1,              // התפר שהיא סוגרת
        invId: material?.id,
        name: `קושרת ${i + 1} ${at}`,
        axis: 'x',
        len: String(kLen),
        pos: { x: seam, y, z: zBack },
      })
    })
  }

  // Math.max: קיר בלי אף קוליסה תקינה נתן (0-1)*2 = מינוס שתי קושרות,
  // והמספר הזה הוצג על המשטח.
  const joints = Math.max(0, built.length - 1)
  // מיקום כל תפר במצב הישר. משמש לבדוק אם הסידור השאיר אותו שלם.
  const seamXs = []
  for (let i = 0; i < built.length - 1; i++) {
    seamXs.push(r1(-totalWidth / 2 + built[i].start + built[i].width))
  }
  return {
    parts, dims, seamXs, dropped,
    // הסדר שבו הקוליסות באמת עומדות, לפי המזהים שלהן
    order: built.map(b => b.index),
    kulisot: built.length,
    koshret: joints * KOSHRET.perJoint,
  }
}

// ============================================================
// סידור הקיר: כנפיים בצדדים.
// קוליסה זזה ומסתובבת כיחידה אחת. האורכים לא משתנים, ולכן
// רשימת החיתוך והקנייה זהות לפני הסידור ואחריה — רק ההרכבה משתנה.
// ============================================================


// ציר הסיבוב של קוליסה: הקצה הפנימי שלה, זה שפונה למרכז הקיר.
// כנף שמתקפלת סביב החיבור לשכנה לא משאירה חור בתפר.
// מרכז התיבה החוסמת של קבוצה
export function groupCenter(group) {
  const mid = ax => {
    const v = group.map(p => p.pos[ax])
    return (Math.min(...v) + Math.max(...v)) / 2
  }
  return { x: mid('x'), y: mid('y'), z: mid('z') }
}

export function groupPivot(group) {
  if (!group.length) return { x: 0, z: 0 }
  const xs = group.map(p => p.pos.x), zs = group.map(p => p.pos.z)
  const minX = Math.min(...xs), maxX = Math.max(...xs)
  const mid = (minX + maxX) / 2
  return { x: mid >= 0 ? minX : maxX, z: (Math.min(...zs) + Math.max(...zs)) / 2 }
}

// הזזת נקודה בודדת עם הקוליסה שלה, ובחזרה. סימון בורג נשמר במצב
// הישר של הקיר ומומר למקומו האמיתי בכל בנייה — אחרת פתיחת כנף
// הייתה משאירה את הסימון תלוי באוויר במקום שבו הקוליסה כבר לא נמצאת.
export function applyToPoint(p, t = {}, pivot = { x: 0, z: 0 }) {
  const rad = (Number(t.deg) || 0) * Math.PI / 180
  const c = Math.cos(rad), s = Math.sin(rad)
  const ox = p.x - pivot.x, oz = p.z - pivot.z
  return {
    x: rr(pivot.x + ox * c - oz * s + (Number(t.dx) || 0)),
    y: rr(p.y + (Number(t.dy) || 0)),
    z: rr(pivot.z + ox * s + oz * c + (Number(t.dz) || 0)),
  }
}

export function unapplyFromPoint(p, t = {}, pivot = { x: 0, z: 0 }) {
  const rad = -(Number(t.deg) || 0) * Math.PI / 180
  const c = Math.cos(rad), s = Math.sin(rad)
  const ox = p.x - (Number(t.dx) || 0) - pivot.x
  const oz = p.z - (Number(t.dz) || 0) - pivot.z
  return {
    x: rr(pivot.x + ox * c - oz * s),
    y: rr(p.y - (Number(t.dy) || 0)),
    z: rr(pivot.z + ox * s + oz * c),
  }
}

// סידור תקין של קוליסה אחת. הרמה שלילית הייתה שוקעת את הקוליסה אל
// מתחת לרצפה — היא כבר עומדת עליה, אין לאן לרדת.
export const normalizeT = (t = {}) => ({
  dx: Number(t.dx) || 0,
  dz: Number(t.dz) || 0,
  dy: Math.max(0, Number(t.dy) || 0),
  deg: Number(t.deg) || 0,
  flat: !!t.flat,
})

// קוליסה שוכבת: אותה מסגרת בדיוק, מונחת על הגב.
// זה סיבוב של 90° סביב ציר אופקי, ובמודל שלנו הוא רק החלפת צירים —
// לטה שרצה לגובה ('y') רצה עכשיו לעומק ('z') ולהפך. אין צורך במנוע
// סיבוב כללי, והאורכים כמובן לא משתנים.
// אחרי ההנחה הקוליסה יושבת על הרצפה ונמתחת אחורה; dy ו-dz מציבים אותה.
// refZ: נקודת הייחוס להשכבה. הקושרת של תפר בין שתי שוכבות חייבת
// להישכב לפי אותה נקודה כמו הקוליסות עצמן — אחרת היא נוחתת בגובה
// אחר ומרחפת מעל המבנה.
export function layGroupFlat(parts, ids, refZ) {
  const set = ids instanceof Set ? ids : new Set(ids)
  if (!set.size) return parts
  const mine = parts.filter(p => set.has(p.id))
  if (!mine.length) return parts
  const minZ = Number.isFinite(refZ) ? refZ : Math.min(...mine.map(p => p.pos.z))
  const swap = { y: 'z', z: 'y' }
  return parts.map(p => {
    if (!set.has(p.id)) return p
    return {
      ...p,
      axis: swap[p.axis] || p.axis,
      flat: true,
      pos: { ...p.pos, y: rr(p.pos.z - minZ), z: rr(-p.pos.y) },
    }
  })
}

// סיבוב והזזה של קבוצת חלקים סביב ציר נתון.
export function transformGroup(parts, ids, { dx = 0, dz = 0, dy = 0, deg = 0 } = {}, pivot) {
  const set = ids instanceof Set ? ids : new Set(ids)
  if (!set.size) return parts
  const rad = (Number(deg) || 0) * Math.PI / 180
  const c = Math.cos(rad), sn = Math.sin(rad)
  const p0 = pivot || groupPivot(parts.filter(p => set.has(p.id)))
  return parts.map(p => {
    if (!set.has(p.id)) return p
    const ox = p.pos.x - p0.x, oz = p.pos.z - p0.z
    return {
      ...p,
      yaw: (Number(p.yaw) || 0) + rad,
      pos: {
        ...p.pos,
        x: rr(p0.x + ox * c - oz * sn + Number(dx || 0)),
        y: rr((p.pos.y || 0) + Number(dy || 0)),
        z: rr(p0.z + ox * sn + oz * c + Number(dz || 0)),
      },
    }
  })
}

// הקיר על המשטח אחרי סידור. נבנה כל פעם מחדש מהמצב הישר ומהסידור
// המבוקש, ולא מצטבר על עצמו — לחיצה שישית על "סובב" מסתובבת סביב
// אותו ציר כמו הראשונה, ו"החזר למקום" הוא פשוט סידור ריק.
// כל תפר בקיר, ומה מחזיק אותו.
//   ברגים — בכל תפר, תמיד. זה החיבור.
//   קושרת — בתפר ישר בלבד, וניתנת לביטול. על פינה היא לא יושבת.
// joints[i] = { koshret: false } מבטל את הקושרות של תפר i.
// geom = { frames: { [k]: { t, pivot } }, seamXs: [] } — כשהוא נמסר,
// התפר נבחן לפי מה שקרה בפועל ולא לפי הפרמטרים. שתי קוליסות שסובבו
// באותה זווית סביב צירים שונים נפרדות זו מזו, והשוואת מספרים הייתה
// מכריזה עליהן "ישר" ושולחת קושרת של 50 לגשר על מטר וחצי.
// order = מזהי הקוליסות לפי סדר עמידתן. תפר j הוא בין order[j-1]
// ל-order[j]. מספר בלבד נתמך לתאימות לאחור.
export function seamsOf(order, layout = {}, joints = {}, geom = null) {
  const ks = Array.isArray(order)
    ? order
    : Array.from({ length: Number(order) || 0 }, (_, i) => i + 1)
  const at = k => geom?.frames?.[k]?.t || normalizeT(layout[k])

  // האם התפר נשאר שלם: אותה זווית, ושתי הקוליסות ממפות את נקודת
  // התפר לאותו מקום בדיוק.
  const intact = (i) => {
    const [ka, kb] = [ks[i - 1], ks[i]]
    const a = at(ka), b = at(kb)
    if (rr(b.deg - a.deg)) return false
    // אחת שוכבת והשנייה עומדת — אין ביניהן מישור משותף.
    if (a.flat !== b.flat) return false
    const fa = geom?.frames?.[ka], fb = geom?.frames?.[kb]
    if (!fa || !fb) return a.dx === b.dx && a.dz === b.dz && a.dy === b.dy
    const p = { x: geom.seamXs?.[i - 1] ?? 0, y: 0, z: 0 }
    const A = applyToPoint(p, fa.t, fa.pivot)
    const B = applyToPoint(p, fb.t, fb.pivot)
    return Math.hypot(A.x - B.x, A.y - B.y, A.z - B.z) < 0.5
  }
  const clampBolts = n => {
    const [lo, hi] = JOINT.boltsRange
    const v = Math.round(Number(n))
    return Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : JOINT.bolts
  }
  const out = []
  for (let i = 1; i < ks.length; i++) {
    const [ka, kb] = [ks[i - 1], ks[i]]
    const a = at(ka), b = at(kb)
    const angle = rr(b.deg - a.deg)
    const corner = !intact(i)
    const apart = corner && !angle
    // על פינה אין קושרת גם אם ביקשו — אין מישור משותף שהיא תשב עליו.
    const wanted = joints[i]?.koshret
    const koshret = corner ? false : (wanted === undefined ? JOINT.koshretByDefault : !!wanted)
    out.push({
      seam: i,
      between: [ka, kb],
      corner, angle, apart, koshret,
      bolts: clampBolts(joints[i]?.bolts ?? (corner ? CORNER.bolts : JOINT.bolts)),
      canToggleKoshret: !corner,
      boltsRange: JOINT.boltsRange,
    })
  }
  return out
}

export function wallLayout(widths, height, opts = {}, layout = {}, joints = {}) {
  const base = wallParts(widths, height, opts)
  if (!base.parts.length) {
    return { ...base, groups: [], seams: [], corners: [], bolts: 0, koshretDropped: 0 }
  }

  // המסגרות של כל קוליסה: הסידור המלא שלה והציר שלה. נפתר פעם אחת,
  // ומשמש גם לבדיקת התפרים, גם להזזת הקושרות וגם לחלקים עצמם.
  const frames = {}
  {
    const straight = new Map()
    for (const p of base.parts) {
      const k = Number(p.k) || 0
      if (!k) continue
      if (!straight.has(k)) straight.set(k, [])
      straight.get(k).push(p)
    }
    for (const [k, group] of straight) {
      let t = normalizeT(layout[k])
      // המצב שממנו מודדים: אחרי השכבה, לפני הזזה.
      const ids = group.map(p => p.id)
      const refZ = t.flat ? Math.min(...group.map(p => p.pos.z)) : null
      const rest = t.flat ? layGroupFlat(group, ids, refZ) : group
      const pivot = groupPivot(rest)
      // at = "שים את מרכז הקוליסה כאן". התבניות מדברות במיקומים
      // ולא בהפרשים, ולכן הן לא צריכות לדעת איך נבנה הרצף הליניארי.
      const at = layout[k]?.at
      if (at) {
        // מסובבים את כל החלקים ואז מודדים מרכז. סיבוב של מרכז התיבה
        // אינו מרכז התיבה המסובבת — בזווית שאינה 90° זו סטייה של סנטימטר.
        const c = groupCenter(rest.map(p => (
          { ...p, pos: applyToPoint(p.pos, { deg: t.deg }, pivot) }
        )))
        t = {
          ...t,
          dx: rr(Number(at.x ?? c.x) - c.x),
          dy: Math.max(0, rr(Number(at.y ?? c.y) - c.y)),
          dz: rr(Number(at.z ?? c.z) - c.z),
        }
      }
      frames[k] = { t, pivot, ids, refZ }
    }
  }
  const seams = seamsOf(base.order, layout, joints, { frames, seamXs: base.seamXs })
  const corners = seams.filter(s => s.corner)
  const noKoshret = new Set(seams.filter(s => !s.koshret).map(s => s.seam))
  const kept = noKoshret.size
    ? base.parts.filter(p => !(p.k === 0 && noKoshret.has(p.seam)))
    : base.parts

  const byK = new Map()
  for (const p of kept) {
    const k = Number(p.k) || 0
    if (!byK.has(k)) byK.set(k, [])
    byK.get(k).push(p)
  }

  const [faceCm, deepCm] = opts.material ? sectionOf(opts.material) : [2, 4]

  let parts = kept
  for (const [k] of byK) {
    const fr = frames[k]
    if (!fr) continue
    const { t, pivot, ids } = fr
    if (!t.dx && !t.dz && !t.dy && !t.deg && !t.flat) continue
    // קודם משכיבים, אחר כך מזיזים — אחרת ההזזה הייתה מתפרשת על הצירים הישנים.
    if (t.flat) parts = layGroupFlat(parts, ids, fr.refZ)
    parts = transformGroup(parts, ids, t, pivot)
  }

  // קושרת שייכת לתפר. אם התפר נשאר שלם והקוליסות שלו זזו — הקושרת
  // זזה איתן. בלי זה כותרת של שער עולה למעלה והקושרות נשארות על
  // הרצפה, מרחפות מתחת לכלום.
  for (const sm of seams) {
    if (sm.corner || !sm.koshret) continue
    const fr = frames[sm.between[0]]
    if (!fr || (!fr.t.dx && !fr.t.dz && !fr.t.dy && !fr.t.deg && !fr.t.flat)) continue
    const koIds = parts.filter(p => p.k === 0 && p.seam === sm.seam).map(p => p.id)
    if (!koIds.length) continue
    // הקושרת עוברת בדיוק את אותה תנועה כמו הקוליסות שהיא מחברת,
    // כולל השכבה — אחרת היא נשארת עומדת ומרחפת מעל מבנה שוכב.
    if (fr.t.flat) parts = layGroupFlat(parts, koIds, fr.refZ)
    const koSet = new Set(koIds)
    parts = parts.map(p => (
      koSet.has(p.id)
        ? { ...p, yaw: (Number(p.yaw) || 0) + fr.t.deg * Math.PI / 180, pos: applyToPoint(p.pos, fr.t, fr.pivot) }
        : p
    ))
  }

  // הקוליסות לפי הסדר, והקושרות בסוף — הן לא חלק מהרצף.
  const groups = [...byK.entries()]
    .sort((a, b) => (a[0] || Infinity) - (b[0] || Infinity))
    .map(([k, group]) => ({
      k,
      count: group.length,
      label: k === 0 ? `קושרות` : `ק${k}`,
      width: k === 0 ? null : widthOfGroup(group, faceCm),
      pivot: groupPivot(group),          // במצב הישר — יציב בין בנייה לבנייה
      moved: (() => {
        const t = frames[k]?.t
        return !!t && !!(t.dx || t.dz || t.dy || t.deg || t.flat)
      })(),
    }))

  // המידות המוצגות הן מה שהמבנה באמת תופס, ולא סכום הרוחבים
  // הליניארי. בשער עצמאי הקוליסות מסודרות בתיבה, והסכום הליניארי
  // (930) לא מתאר שום דבר במציאות (270).
  const span = (ax) => {
    const v = parts.map(p => p.pos[ax])
    return rr(Math.max(...v) - Math.min(...v) + faceCm)
  }
  const dims = parts.length ? {
    ...base.dims,
    רוחב: span('x'),
    // הלטה העליונה שוכבת, ולכן חצי-הגובה שלה הוא הצלע הרחבה.
    גובה: rr(Math.max(...parts.map(p => p.pos.y)) + deepCm / 2),
    עומק: Math.max(base.dims.עומק, span('z')),
  } : base.dims

  const koshret = kept.filter(p => p.k === 0).length
  // מבנה שקוליסות בו הוצבו במיקום מוחלט (at) אינו שרשרת תפרים:
  // בתיבה של שער עצמאי, "ק4–ק5" הן שתי רגליים נפרדות ואין ביניהן
  // תפר כלל. ספירת ברגים משרשרת כזו היא מספר מומצא.
  const linear = !Object.values(layout).some(t => t && t.at)

  return {
    ...base, dims, parts, groups, koshret, seams, corners, linear,
    bolts: seams.reduce((n, s) => n + s.bolts, 0),
    // כמה קושרות ירדו, כדי שאפשר יהיה להסביר את ההפרש ברשימת החיתוך
    koshretDropped: base.koshret - koshret,
  }
}
// רוחב הקוליסה לפי האנכיות שלה, בלי להסתמך על סדר הקלט
function widthOfGroup(group, faceCm) {
  const v = group.filter(p => p.axis === 'y')
  if (v.length < 2) return null
  const xs = v.map(p => p.pos.x)
  // מרכזי האנכיות מרוחקים רוחב−פאה זה מזה.
  return rr(Math.max(...xs) - Math.min(...xs) + faceCm)
}
