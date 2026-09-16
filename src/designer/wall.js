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
      detail: `${k.width}×${height} ס״מ`,
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

  widths.forEach((width, i) => {
    const g = generateKulisa({ width, height, depth, material, braces, giben })
    if (g.errors.length) return
    built.push({ index: built.length + 1, width, start: cursor, parts: g.parts })
    cursor += Number(width)
  })

  const totalWidth = cursor
  const dims = { גובה: Number(height), רוחב: totalWidth, עומק: depth, עובי: 2 }
  const parts = []

  built.forEach(k => {
    // כל קוליסה ממורכזת סביב 0 בפני עצמה; מזיזים אותה למקומה בקיר.
    const kd = { גובה: Number(height), רוחב: k.width, עומק: depth, עובי: 2 }
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
    ;[['עליונה', r1(Number(height) - ph / 2)], ['תחתונה', r1(ph / 2)]].forEach(([at, y]) => {
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
  return { parts, dims, kulisot: built.length, koshret: joints * KOSHRET.perJoint }
}

// ============================================================
// סידור הקיר: כנפיים בצדדים.
// קוליסה זזה ומסתובבת כיחידה אחת. האורכים לא משתנים, ולכן
// רשימת החיתוך והקנייה זהות לפני הסידור ואחריה — רק ההרכבה משתנה.
// ============================================================

const rr = n => Math.round(n * 10) / 10

// ציר הסיבוב של קוליסה: הקצה הפנימי שלה, זה שפונה למרכז הקיר.
// כנף שמתקפלת סביב החיבור לשכנה לא משאירה חור בתפר.
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
    y: p.y,
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
    y: p.y,
    z: rr(pivot.z + ox * s + oz * c),
  }
}

// סיבוב והזזה של קבוצת חלקים סביב ציר נתון.
export function transformGroup(parts, ids, { dx = 0, dz = 0, deg = 0 } = {}, pivot) {
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
export function seamsOf(count, layout = {}, joints = {}) {
  const at = k => {
    const t = layout[k] || {}
    return { deg: Number(t.deg) || 0, dx: Number(t.dx) || 0, dz: Number(t.dz) || 0 }
  }
  const out = []
  for (let i = 1; i < count; i++) {
    const a = at(i), b = at(i + 1)
    const angle = rr(b.deg - a.deg)
    const apart = a.dx !== b.dx || a.dz !== b.dz
    const corner = !!(angle || apart)
    // על פינה אין קושרת גם אם ביקשו — אין מישור משותף שהיא תשב עליו.
    const wanted = joints[i]?.koshret
    const koshret = corner ? false : (wanted === undefined ? JOINT.koshretByDefault : !!wanted)
    out.push({
      seam: i,
      between: [i, i + 1],
      corner, angle, apart, koshret,
      bolts: corner ? CORNER.bolts : JOINT.bolts,
      canToggleKoshret: !corner,
    })
  }
  return out
}

export function wallLayout(widths, height, opts = {}, layout = {}, joints = {}) {
  const base = wallParts(widths, height, opts)
  if (!base.parts.length) {
    return { ...base, groups: [], seams: [], corners: [], bolts: 0, koshretDropped: 0 }
  }

  const seams = seamsOf(base.kulisot, layout, joints)
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

  const [faceCm] = opts.material ? sectionOf(opts.material) : [2, 4]

  let parts = kept
  for (const [k, group] of byK) {
    const t = layout[k]
    if (!t || (!t.dx && !t.dz && !t.deg)) continue
    // הציר נלקח מהמצב הישר, לפני כל סיבוב — לכן הוא יציב.
    parts = transformGroup(parts, group.map(p => p.id), t, groupPivot(group))
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
      moved: !!layout[k] && !!(layout[k].dx || layout[k].dz || layout[k].deg),
    }))

  const koshret = kept.filter(p => p.k === 0).length
  return {
    ...base, parts, groups, koshret, seams, corners,
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
