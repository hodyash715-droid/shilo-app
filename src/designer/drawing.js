// ============================================================
// הוצאה לשרטוט: דף A4 לרוחב, שחור על לבן, מוכן להדפסה לנגר.
// היטלים אורתוגונליים (בלי פרספקטיבה), קווי מידה, מספור חלקים,
// קנה מידה אמיתי, טבלת חיתוך ומסגרת עם פרטי העבודה.
// ============================================================

import { lenOf, profileOf } from './geometry.js'
import { cutList, optimize } from './cuts.js'

export const SHEET = { w: 297, h: 210, px: 5 }   // מ"מ · פיקסלים למ"מ
const RATIOS = [5, 10, 20, 25, 50, 100, 200]     // קני מידה מקובלים 1:N

const INK = '#111'

// בידוד כיוון: קנבס מפעיל bidi על המחרוזת, אז "לטה 2×3" מתהפך ל-"3×2".
// עוטפים כל רצף מספרים ב-LRI…PDI כדי שיישאר משמאל לימין.
const NUMRUN = /[0-9]+(?:\s*[.,:×x*/-]\s*[0-9]+)*%?/g
const bidi = s => String(s).replace(NUMRUN, m => `⁦${m}⁩`)
const THIN = 0.2, MED = 0.35, THICK = 0.6        // עובי קו במ"מ

// חצי-מידות החלק בעולם (ס"מ), לפי הפרופיל האמיתי
function extents(part, dims, materials) {
  const L = lenOf(part, dims)
  const [pw, ph] = profileOf(part, materials)
  if (part.axis === 'x') return { hx: L / 2, hy: ph / 2, hz: pw / 2 }
  if (part.axis === 'y') return { hx: pw / 2, hy: L / 2, hz: ph / 2 }
  return { hx: pw / 2, hy: ph / 2, hz: L / 2 }
}

// היטל: מה אופקי ומה אנכי בכל מבט
const VIEWS = {
  front: { h: 'x', v: 'y', hh: 'hx', hv: 'hy', label: 'חזית' },
  side:  { h: 'z', v: 'y', hh: 'hz', hv: 'hy', label: 'צד' },
  top:   { h: 'x', v: 'z', hh: 'hx', hv: 'hz', label: 'מבט על' },
}

function boxesFor(view, parts, dims, materials) {
  const V = VIEWS[view]
  return parts.map(p => {
    const e = extents(p, dims, materials)
    const cx = p.pos[V.h] || 0, cy = p.pos[V.v] || 0
    return { part: p, x0: cx - e[V.hh], x1: cx + e[V.hh], y0: cy - e[V.hv], y1: cy + e[V.hv] }
  })
}

function bounds(boxes) {
  if (!boxes.length) return { x0: 0, x1: 10, y0: 0, y1: 10 }
  return boxes.reduce((a, b) => ({
    x0: Math.min(a.x0, b.x0), x1: Math.max(a.x1, b.x1),
    y0: Math.min(a.y0, b.y0), y1: Math.max(a.y1, b.y1),
  }), { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity })
}

// קיבוץ חלקים זהים למספור (אותו חומר + אותו אורך = אותו מספר)
export function groupParts(parts, dims, materials) {
  const map = new Map()
  parts.forEach(p => {
    const L = Math.round(lenOf(p, dims) * 10) / 10
    const m = materials.find(x => x.id === p.invId)
    const key = `${p.invId}__${L}`
    if (!map.has(key)) map.set(key, { key, mat: m?.name || p.name, len: L, qty: 0, ids: [] })
    const g = map.get(key)
    g.qty += 1; g.ids.push(p.id)
  })
  const list = [...map.values()].sort((a, b) => a.mat.localeCompare(b.mat, 'he') || b.len - a.len)
  list.forEach((g, i) => { g.no = i + 1 })
  const byPart = {}
  list.forEach(g => g.ids.forEach(id => { byPart[id] = g.no }))
  return { groups: list, byPart }
}

// ---------- ציור ----------
export function drawSheet(canvas, { name, dims, parts, materials, stockOv = {} }) {
  const P = SHEET.px
  canvas.width = SHEET.w * P
  canvas.height = SHEET.h * P
  const ctx = canvas.getContext('2d')
  ctx.setTransform(P, 0, 0, P, 0, 0)   // מעכשיו כל היחידות במ"מ
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, SHEET.w, SHEET.h)
  ctx.lineJoin = 'miter'
  ctx.strokeStyle = INK
  ctx.fillStyle = INK

  const line = (x1, y1, x2, y2, w = MED) => {
    ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke()
  }
  const rect = (x, y, w, h, lw = MED) => {
    ctx.lineWidth = lw; ctx.strokeRect(x, y, w, h)
  }
  const txt = (s, x, y, o = {}) => {
    const size = o.size || 3
    ctx.font = `${o.bold ? 700 : 400} ${size}px Heebo, Arial, sans-serif`
    ctx.textAlign = o.align || 'right'
    ctx.textBaseline = o.base || 'alphabetic'
    ctx.direction = o.ltr ? 'ltr' : 'rtl'
    ctx.fillStyle = o.color || INK
    ctx.fillText(o.ltr ? String(s) : bidi(s), x, y)
  }
  const num = (s, x, y, o = {}) => txt(s, x, y, { ...o, ltr: true, align: o.align || 'center' })

  // ---- מסגרת ----
  rect(5, 5, SHEET.w - 10, SHEET.h - 10, THICK)

  // ---- אזורים ----
  const TB_H = 26                                  // גובה מסגרת הכותרת
  const inner = { x: 6, y: 6, w: SHEET.w - 12, h: SHEET.h - 12 }
  const tableW = 88
  const tbY = inner.y + inner.h - TB_H
  const tableX = inner.x + inner.w - tableW        // הטבלה מימין (קריאה בעברית)
  const viewsArea = { x: inner.x, y: inner.y, w: inner.w - tableW - 4, h: tbY - inner.y - 3 }

  // ---- נתונים ----
  const { groups, byPart } = groupParts(parts, dims, materials)
  const plans = optimize(cutList(parts, dims, materials), materials, stockOv)

  // ---- קנה מידה משותף לכל ההיטלים ----
  const fB = bounds(boxesFor('front', parts, dims, materials))
  const sB = bounds(boxesFor('side', parts, dims, materials))
  const frontW = viewsArea.w * 0.60, sideW = viewsArea.w * 0.36
  const padMm = 16                                  // מקום לקווי מידה
  const need = Math.max(
    (fB.x1 - fB.x0) * 10 / (frontW - padMm),
    (fB.y1 - fB.y0) * 10 / (viewsArea.h - padMm - 8),
    (sB.x1 - sB.x0) * 10 / (sideW - padMm),
  )
  const ratio = RATIOS.find(r => r >= need) || RATIOS[RATIOS.length - 1]
  const mmPerCm = 10 / ratio                        // כמה מ"מ על הנייר לכל ס"מ במציאות

  // ---- ציור היטל ----
  const drawView = (view, zone, B, opts = {}) => {
    const boxes = boxesFor(view, parts, dims, materials)
    if (!boxes.length) return
    const w = (B.x1 - B.x0) * mmPerCm, h = (B.y1 - B.y0) * mmPerCm
    const ox = zone.x + (zone.w - w) / 2
    const oy = zone.y + (zone.h - h) / 2 + 2
    const sx = v => ox + (v - B.x0) * mmPerCm
    const sy = v => oy + h - (v - B.y0) * mmPerCm   // ציר Y כלפי מעלה

    // החלקים
    boxes.forEach(b => {
      const x = sx(b.x0), y = sy(b.y1)
      const bw = Math.max(0.5, (b.x1 - b.x0) * mmPerCm)
      const bh = Math.max(0.5, (b.y1 - b.y0) * mmPerCm)
      ctx.fillStyle = '#fff'; ctx.fillRect(x, y, bw, bh)
      ctx.fillStyle = INK
      rect(x, y, bw, bh, MED)
    })

    // כותרת ההיטל
    txt(VIEWS[view].label, zone.x + zone.w - 1, zone.y + 4.5, { size: 3.4, bold: true })

    // ---- קווי מידה ----
    const arrow = (x, y, dir) => {              // dir: 1 ימין / -1 שמאל / 'u' / 'd'
      ctx.lineWidth = THIN; ctx.beginPath()
      if (dir === 'u' || dir === 'd') {
        const s = dir === 'u' ? 1 : -1
        ctx.moveTo(x, y); ctx.lineTo(x - 0.9, y + s * 2.2); ctx.lineTo(x + 0.9, y + s * 2.2)
      } else {
        ctx.moveTo(x, y); ctx.lineTo(x + dir * 2.2, y - 0.9); ctx.lineTo(x + dir * 2.2, y + 0.9)
      }
      ctx.closePath(); ctx.fill()
    }
    const dimH = (a, b, y, label) => {          // מידה אופקית
      line(a, y - 1.5, a, y + 1.5, THIN); line(b, y - 1.5, b, y + 1.5, THIN)
      line(a, y, b, y, THIN)
      arrow(a, y, 1); arrow(b, y, -1)
      const mid = (a + b) / 2
      ctx.fillStyle = '#fff'; ctx.fillRect(mid - 6, y - 3.6, 12, 3.4); ctx.fillStyle = INK
      num(label, mid, y - 1, { size: 3 })
    }
    const dimV = (a, b, x, label) => {          // מידה אנכית
      line(x - 1.5, a, x + 1.5, a, THIN); line(x - 1.5, b, x + 1.5, b, THIN)
      line(x, a, x, b, THIN)
      arrow(x, a, 'u'); arrow(x, b, 'd')
      const mid = (a + b) / 2
      ctx.save(); ctx.translate(x - 1.6, mid); ctx.rotate(-Math.PI / 2)
      ctx.fillStyle = '#fff'; ctx.fillRect(-6, -3.4, 12, 3.4); ctx.fillStyle = INK
      num(label, 0, -0.8, { size: 3 })
      ctx.restore()
    }

    const yDim = oy + h + 7
    const xDim = ox - 7
    line(sx(B.x0), oy + h, sx(B.x0), yDim + 1.5, THIN)
    line(sx(B.x1), oy + h, sx(B.x1), yDim + 1.5, THIN)
    dimH(sx(B.x0), sx(B.x1), yDim, Math.round((B.x1 - B.x0)))
    line(ox, sy(B.y0), xDim - 1.5, sy(B.y0), THIN)
    line(ox, sy(B.y1), xDim - 1.5, sy(B.y1), THIN)
    dimV(sy(B.y1), sy(B.y0), xDim, Math.round((B.y1 - B.y0)))

    // ---- בלוני מספור (רק בהיטל הראשי) ----
    if (opts.balloons) {
      const seen = new Set()
      boxes.forEach(b => {
        const no = byPart[b.part.id]
        if (!no || seen.has(no)) return
        seen.add(no)
        const cx = (sx(b.x0) + sx(b.x1)) / 2
        const cy = (sy(b.y0) + sy(b.y1)) / 2
        const bx = cx + 7, by = cy - 7
        line(cx, cy, bx, by, THIN)
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(bx, by, 3, 0, 7); ctx.fill()
        ctx.fillStyle = INK; ctx.lineWidth = MED; ctx.beginPath(); ctx.arc(bx, by, 3, 0, 7); ctx.stroke()
        num(no, bx, by + 1.2, { size: 3.2, bold: true })
      })
    }
  }

  drawView('front', { ...viewsArea, x: viewsArea.x + viewsArea.w - frontW, w: frontW }, fB, { balloons: true })
  drawView('side', { ...viewsArea, x: viewsArea.x, w: sideW }, sB)

  // קו הפרדה בין ההיטלים
  line(viewsArea.x + sideW + 2, viewsArea.y + 2, viewsArea.x + sideW + 2, viewsArea.y + viewsArea.h - 2, THIN)

  // ---- טבלת חיתוך ----
  const T = { x: tableX, y: inner.y, w: tableW, h: tbY - inner.y - 3 }
  rect(T.x, T.y, T.w, T.h, MED)
  ctx.fillStyle = '#EEE'; ctx.fillRect(T.x, T.y, T.w, 7); ctx.fillStyle = INK
  line(T.x, T.y + 7, T.x + T.w, T.y + 7, MED)
  txt('רשימת חיתוך', T.x + T.w - 2, T.y + 5, { size: 3.4, bold: true })

  // עמודות מימין לשמאל
  const cols = [
    { w: 9,  label: 'מס׳' },
    { w: 40, label: 'חומר' },
    { w: 22, label: 'אורך ס״מ' },
    { w: 17, label: 'כמות' },
  ]
  let cx = T.x + T.w
  const colX = cols.map(c => { const r = { ...c, r: cx, l: cx - c.w }; cx -= c.w; return r })
  const rowH = 6
  let ry = T.y + 7
  ctx.fillStyle = '#F6F6F6'; ctx.fillRect(T.x, ry, T.w, rowH); ctx.fillStyle = INK
  colX.forEach(c => txt(c.label, c.r - 1.5, ry + 4.2, { size: 2.6, bold: true }))
  colX.slice(1).forEach(c => line(c.r, T.y + 7, c.r, T.y + T.h, THIN))
  ry += rowH
  line(T.x, ry, T.x + T.w, ry, MED)

  groups.forEach(g => {
    if (ry + rowH > T.y + T.h - 26) return
    num(g.no, colX[0].l + colX[0].w / 2, ry + 4.2, { size: 3 })
    txt(g.mat, colX[1].r - 1.5, ry + 4.2, { size: 2.9 })
    num(g.len, colX[2].l + colX[2].w / 2, ry + 4.2, { size: 3 })
    num(g.qty, colX[3].l + colX[3].w / 2, ry + 4.2, { size: 3, bold: true })
    ry += rowH
    line(T.x, ry, T.x + T.w, ry, THIN)
  })

  // ---- סיכום קנייה בתחתית הטבלה ----
  const sumY = T.y + T.h - 24
  line(T.x, sumY, T.x + T.w, sumY, MED)
  txt('לקנייה', T.x + T.w - 2, sumY + 4.5, { size: 3, bold: true })
  let sy2 = sumY + 9
  plans.slice(0, 4).forEach(p => {
    txt(`${p.mat}`, T.x + T.w - 2, sy2, { size: 2.7 })
    txt(`${p.barCount}×${p.stock} ס״מ · פחת ${p.wastePct}%`, T.x + 2, sy2, { size: 2.7, align: 'left' })
    sy2 += 4.2
  })

  // ---- מסגרת כותרת ----
  const TB = { x: inner.x, y: tbY, w: inner.w, h: TB_H }
  rect(TB.x, TB.y, TB.w, TB.h, THICK)
  const cell = (x, w, label, value, big) => {
    line(x, TB.y, x, TB.y + TB.h, MED)
    txt(label, x + w - 2, TB.y + 5.5, { size: 2.5, color: '#666' })
    txt(value, x + w - 2, TB.y + (big ? 15 : 13), { size: big ? 6 : 4, bold: true })
  }
  const d = new Date()
  const today = `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`
  const totalBars = plans.reduce((s, p) => s + p.barCount, 0)

  let tx = TB.x + TB.w
  const put = (w, label, value, big) => { tx -= w; cell(tx, w, label, value, big) }
  put(78, 'קוליסה', name || 'ללא שם', true)
  put(52, 'מידות (ג×ר×ע ס״מ)', `${dims.גובה}×${dims.רוחב}×${dims.עומק}`)
  put(30, 'קנה מידה', `1:${ratio}`)
  put(30, 'סה״כ קורות', String(totalBars))
  put(30, 'חלקים', String(parts.length))
  put(34, 'תאריך', today)

  // חתימת העסק בקצה
  txt('שילה — מיתוג והפקות', TB.x + 2, TB.y + 9, { size: 3.6, bold: true, align: 'left' })
  txt('שרטוט ייצור', TB.x + 2, TB.y + 15, { size: 2.7, color: '#666', align: 'left' })
  txt('כל המידות בס״מ · לבדוק במקום לפני חיתוך', TB.x + 2, TB.y + 21, { size: 2.4, color: '#666', align: 'left' })

  return { ratio, groups, plans, totalBars }
}
