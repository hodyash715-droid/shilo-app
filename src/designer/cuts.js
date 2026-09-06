// ============================================================
// רשימת חיתוך + אופטימיזציה: כמה קורות סטנדרט צריך, ואיך לנסר
// אותן במינימום פחת. First-Fit-Decreasing עם התחשבות ברוחב המסור.
// ============================================================

import { lenOf } from './geometry.js'

export const DEFAULT_STOCK = 300   // ס"מ — אורך קורה סטנדרטי
export const KERF = 0.3            // ס"מ — עובי להב המסור

// רשימת חיתוך גולמית: לכל חומר, אילו אורכים וכמה מכל אחד
export function cutList(parts, dims, materials) {
  const map = {}
  parts.forEach(p => {
    const L = Math.round(lenOf(p, dims) * 10) / 10
    if (!(L > 0)) return
    const m = materials.find(x => x.id === p.invId)
    const name = m?.name || p.name || 'חומר'
    const key = `${p.invId || name}__${L}`
    if (!map[key]) map[key] = { invId: p.invId, mat: name, len: L, qty: 0 }
    map[key].qty += 1
  })
  return Object.values(map).sort((a, b) => a.mat.localeCompare(b.mat, 'he') || b.len - a.len)
}

// אריזת אורכים לקורות סטנדרט. מחזיר לכל חומר: קורות, פחת, ואחוז ניצולת.
export function optimize(cuts, materials, stockOverride = {}) {
  const byMat = {}
  cuts.forEach(c => {
    const k = c.invId || c.mat
    if (!byMat[k]) {
      const m = materials.find(x => x.id === c.invId)
      byMat[k] = {
        key: k, mat: c.mat,
        stock: Number(stockOverride[k]) || Number(m?.stock_len) || DEFAULT_STOCK,
        pieces: [],
      }
    }
    for (let i = 0; i < c.qty; i++) byMat[k].pieces.push(c.len)
  })

  return Object.values(byMat).map(g => {
    const stock = g.stock
    const tooLong = g.pieces.filter(L => L > stock)
    const fit = g.pieces.filter(L => L <= stock).sort((a, b) => b - a)  // מהארוך לקצר
    const bars = []
    fit.forEach(L => {
      // הקורה הראשונה שנשאר בה מספיק מקום (כולל בזבוז המסור)
      let bar = bars.find(b => b.left >= L + (b.cuts.length ? KERF : 0))
      if (!bar) { bar = { cuts: [], left: stock }; bars.push(bar) }
      bar.left -= L + (bar.cuts.length ? KERF : 0)
      bar.cuts.push(L)
    })
    const used = fit.reduce((s, L) => s + L, 0)
    const total = bars.length * stock
    const waste = total - used
    return {
      ...g,
      bars,
      barCount: bars.length,
      usedCm: Math.round(used),
      wasteCm: Math.round(waste),
      wastePct: total ? Math.round((waste / total) * 100) : 0,
      tooLong,
    }
  }).sort((a, b) => a.mat.localeCompare(b.mat, 'he'))
}

// סיכום כמה יחידות מכל חומר (לרשימת קניות)
export function materialTotals(plans) {
  return plans.map(p => ({ mat: p.mat, bars: p.barCount, stock: p.stock }))
}
