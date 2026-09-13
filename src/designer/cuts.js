// ============================================================
// רשימת חיתוך + אופטימיזציה: כמה קורות צריך לקנות, באיזה אורך,
// ואיך לנסר אותן במינימום פחת. First-Fit-Decreasing עם רוחב המסור.
// ============================================================

import { rawLenOf } from './geometry.js'

// אורכי קנייה. אושר על ידי שי (13.9.2026): הוא קונה עץ באורכים שונים
// לפי הצורך — מינימום 3 מטר, מקסימום 6.2 מטר. בשימוש חותכים גם קצר בהרבה.
export const PURCHASE = { min: 300, max: 620, step: 10, status: 'verified' }

export const DEFAULT_STOCK = PURCHASE.min   // ס"מ — האורך הקצר ביותר שנקנה

// רוחב החתך של המסור ("נסורת"): כמה עץ הלהב הופך לאבק בכל חתך.
// המספר כתוב על הדיסק עצמו, בדרך כלל באמצע — לדוגמה 250×3.2×30.
// היחידות כאן מ"מ כי כך זה מסומן; המנוע עובד בס"מ.
export const KERF_OPTIONS = [
  { mm: 1.6, note: 'להב דק מאוד' },
  { mm: 2.0 },
  { mm: 2.4, note: 'להב דק נפוץ' },
  { mm: 2.8 },
  { mm: 3.2, note: 'הנפוץ ביותר' },
  { mm: 4.0 },
]

// ברירת מחדל עד שיבחרו: הרוחב הנפוץ ביותר במסורי דיסק לעץ.
// עדיין הנחה — לא נמדד על המסור של שי.
export const DEFAULT_KERF_MM = 3.2
export const KERF_STATUS = 'assumption'
export const mmToCm = (mm) => Math.round(Number(mm) * 10) / 100
export const KERF = mmToCm(DEFAULT_KERF_MM)   // ס"מ

// רוחב חתך תקין בס"מ, עם נפילה לברירת המחדל.
// שים לב: Number(null) ו-Number("") הם 0, ולכן חייבים לפסול אותם במפורש —
// אחרת ערך חסר היה נחשב "מסור ללא רוחב" ומחזיר תוכנית קנייה אופטימית מדי.
const safeKerf = (cm) => {
  if (cm === null || cm === undefined || cm === '') return KERF
  const n = Number(cm)
  return Number.isFinite(n) && n >= 0 ? n : KERF
}

// לוחות (דיקט, MDF) נמכרים במידה קבועה ולא בטווח. הזיהוי לפי אורך:
// כל מה שקצר ממינימום הקנייה הוא לוח, לא קורה.
export function isBoard(material) {
  if (material?.kind) return material.kind === 'board'
  const len = Number(material?.stock_len)
  return len > 0 && len < PURCHASE.min
}

// אורכי הקנייה האפשריים לחומר.
export function orderLengths(material) {
  if (isBoard(material)) return [Number(material.stock_len)]
  const out = []
  for (let L = PURCHASE.min; L <= PURCHASE.max; L += PURCHASE.step) out.push(L)
  return out
}

// האורך המקסימלי שאפשר להזמין מהחומר הזה.
export const maxOrderLength = (material) =>
  isBoard(material) ? Number(material.stock_len) : PURCHASE.max

// רשימת חיתוך גולמית: לכל חומר, אילו אורכים וכמה מכל אחד
export function cutList(parts, dims, materials) {
  const map = {}
  parts.forEach(p => {
    // rawLenOf ולא lenOf: חלק עם נוסחה שבורה יוחרג מהרשימה,
    // ולא ייכנס אליה בשקט כאורך תצוגה של 8 ס"מ.
    const L = Math.round(rawLenOf(p, dims) * 10) / 10
    if (!(L > 0)) return
    const m = materials.find(x => x.id === p.invId)
    const name = m?.name || p.name || 'חומר'
    const key = `${p.invId || name}__${L}`
    if (!map[key]) map[key] = { invId: p.invId, mat: name, len: L, qty: 0 }
    map[key].qty += 1
  })
  return Object.values(map).sort((a, b) => a.mat.localeCompare(b.mat, 'he') || b.len - a.len)
}

// אריזת אורכים לקורה אחת באורך נתון. First-Fit-Decreasing.
// kerf נספר רק בין חתיכה לחתיכה — החתך הראשון לא "עולה" מקום.
function packInto(pieces, stock, kerf = KERF) {
  const bars = []
  pieces.forEach(L => {
    let bar = bars.find(b => b.left >= L + (b.cuts.length ? kerf : 0))
    if (!bar) { bar = { cuts: [], left: stock }; bars.push(bar) }
    bar.left -= L + (bar.cuts.length ? kerf : 0)
    bar.cuts.push(L)
  })
  const used = pieces.reduce((s, L) => s + L, 0)
  const total = bars.length * stock
  return { bars, used, total, waste: total - used }
}

// אריזת אורכים. לכל חומר נבחר אורך הקנייה שמביא למינימום עץ שנקנה.
export function optimize(cuts, materials, stockOverride = {}, kerfCm = KERF) {
  const kerf = safeKerf(kerfCm)
  const byMat = {}
  cuts.forEach(c => {
    const k = c.invId || c.mat
    if (!byMat[k]) {
      byMat[k] = { key: k, mat: c.mat, material: materials.find(x => x.id === c.invId) || null, pieces: [] }
    }
    for (let i = 0; i < c.qty; i++) byMat[k].pieces.push(c.len)
  })

  return Object.values(byMat).map(g => {
    const manual = Number(stockOverride[g.key])
    const candidates = manual > 0 ? [manual] : orderLengths(g.material)
    const ceiling = manual > 0 ? manual : maxOrderLength(g.material)
    const tooLong = g.pieces.filter(L => L > ceiling)
    const fit = g.pieces.filter(L => L <= ceiling).sort((a, b) => b - a)

    // מנסים כל אורך קנייה אפשרי ובוחרים את מי שקונה הכי פחות עץ.
    // שוויון — פחות קורות, ואז קורה קצרה יותר (נוחה להובלה).
    const better = (a, b) => {
      if (!b) return true
      if (a.p.total !== b.p.total) return a.p.total < b.p.total
      if (a.p.bars.length !== b.p.bars.length) return a.p.bars.length < b.p.bars.length
      return a.stock < b.stock
    }
    let best = null
    candidates.forEach(stock => {
      if (fit.some(L => L > stock)) return
      const option = { stock, p: packInto(fit, stock, kerf) }
      if (better(option, best)) best = option
    })
    if (!best) {
      const fallback = candidates[0] || DEFAULT_STOCK
      best = { stock: fallback, p: packInto([], fallback, kerf) }
    }

    const { stock, p } = best
    return {
      key: g.key, mat: g.mat, stock,
      bars: p.bars,
      barCount: p.bars.length,
      usedCm: Math.round(p.used),
      wasteCm: Math.round(p.waste),
      wastePct: p.total ? Math.round((p.waste / p.total) * 100) : 0,
      tooLong,
      chosenLength: manual > 0 ? 'manual' : (isBoard(g.material) ? 'fixed' : 'auto'),
      kerf,
    }
  }).sort((a, b) => a.mat.localeCompare(b.mat, 'he'))
}

// סיכום כמה יחידות מכל חומר (לרשימת קניות)
export function materialTotals(plans) {
  return plans.map(p => ({ mat: p.mat, bars: p.barCount, stock: p.stock }))
}
