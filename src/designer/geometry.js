// ============================================================
// מנוע גיאומטריה ורינדור לקוליסה — canvas 2D, בלי ספריות.
// חלק = תיבה מיושרת-צירים עם אורך שהוא נוסחה ({גובה}, {רוחב}-8 …)
// ============================================================

export const DIMS = ['גובה', 'רוחב', 'עומק', 'עובי']

// ---- הערכת נוסחת אורך מול מידות התצוגה ----
export function evalFormula(expr, dims) {
  if (expr == null) return 0
  const raw = String(expr).trim()
  if (!raw) return 0
  if (/^-?\d+(\.\d+)?$/.test(raw)) return parseFloat(raw)
  let s = raw
  for (const d of DIMS) s = s.split(`{${d}}`).join(String(Number(dims?.[d]) || 0))
  if (!/^[0-9+\-*/(). ]+$/.test(s)) return 0   // רק חשבון — שום דבר אחר לא מורץ
  try {
    // eslint-disable-next-line no-new-func
    const v = Function(`"use strict";return (${s})`)()
    return Number.isFinite(v) ? v : 0
  } catch { return 0 }
}

// ---- חתך הפרופיל בס"מ, נגזר משם החומר ("לטה 2×3") ----
export function profileOf(part, materials) {
  const m = materials.find(x => x.id === part.invId)
  const nm = m?.name || part.name || ''
  const mm = nm.match(/(\d+(?:\.\d+)?)\s*[x×*]\s*(\d+(?:\.\d+)?)/)
  if (mm) return [parseFloat(mm[1]), parseFloat(mm[2])]
  return [4, 4]
}

export function colorOf(part, materials) {
  const m = materials.find(x => x.id === part.invId)
  const cat = m?.category || ''
  const nm = m?.name || ''
  if (cat === 'print') return '#B0B4B8'
  if (cat === 'carpet') return '#A8563A'
  if (/לוח|דיקט|קיר/.test(nm)) return '#D8A24A'
  return '#C4892A'
}

export const lenOf = (part, dims) => {
  const v = evalFormula(part.len, dims)
  return v > 0 ? v : 8
}

// מעבים חלקים דקים לצורך תצוגה בלבד — רשימת החיתוך משתמשת באורך האמיתי
export function displayProfile(part, dims, materials) {
  const [pw, ph] = profileOf(part, materials)
  const L = lenOf(part, dims)
  const floor = Math.max(4, L * 0.035)
  return [Math.min(40, Math.max(pw, floor)), Math.min(40, Math.max(ph, floor))]
}

// ---- 8 פינות התיבה ----
export function cornersOf(part, dims, materials) {
  const L = lenOf(part, dims)
  const [pw, ph] = displayProfile(part, dims, materials)
  let hx, hy, hz
  if (part.axis === 'x') { hx = L / 2; hy = ph / 2; hz = pw / 2 }
  else if (part.axis === 'y') { hx = pw / 2; hy = L / 2; hz = ph / 2 }
  else { hx = pw / 2; hy = ph / 2; hz = L / 2 }
  const c = part.pos, C = []
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1])
    C.push({ x: c.x + sx * hx, y: c.y + sy * hy, z: c.z + sz * hz })
  return C
}

const FACES = [
  [[0, 1, 3, 2], 'left'], [[4, 6, 7, 5], 'right'],
  [[0, 4, 5, 1], 'bottom'], [[2, 3, 7, 6], 'top'],
  [[0, 2, 6, 4], 'back'], [[1, 5, 7, 3], 'front'],
]
const SHADE = { top: 1.18, front: 1.0, right: 0.9, left: 0.8, back: 0.72, bottom: 0.58 }

// ---- היטל: סיבוב yaw/pitch + פרספקטיבה ----
export function project(p, view, W, H) {
  const x0 = p.x - view.target.x, y0 = p.y - view.target.y, z0 = p.z - view.target.z
  const cy = Math.cos(view.yaw), sy = Math.sin(view.yaw)
  const x1 = x0 * cy - z0 * sy, z1 = x0 * sy + z0 * cy
  const cp = Math.cos(view.pitch), sp = Math.sin(view.pitch)
  const y2 = y0 * cp - z1 * sp, z2 = y0 * sp + z1 * cp
  const cz = view.dist - z2
  const f = Math.min(W, H) * 0.9
  const d = cz > 1 ? cz : 1
  return { x: W / 2 + x1 * f / d, y: H / 2 - y2 * f / d, depth: cz }
}

function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16)
  const cl = v => Math.max(0, Math.min(255, Math.round(v * f)))
  return `rgb(${cl(n >> 16 & 255)},${cl(n >> 8 & 255)},${cl(n & 255)})`
}

export function pointInPoly(x, y, pts) {
  let inside = false
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i].x, yi = pts[i].y, xj = pts[j].x, yj = pts[j].y
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

function drawGrid(ctx, view, W, H, dpr) {
  ctx.lineWidth = 1 * dpr
  ctx.strokeStyle = 'rgba(238,196,33,.13)'
  const g = 20, n = 6
  for (let i = -n; i <= n; i++) {
    const a = project({ x: i * g, y: 0, z: -n * g }, view, W, H)
    const b = project({ x: i * g, y: 0, z: n * g }, view, W, H)
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke()
    const c = project({ x: -n * g, y: 0, z: i * g }, view, W, H)
    const d = project({ x: n * g, y: 0, z: i * g }, view, W, H)
    ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.stroke()
  }
}

// ---- ציור מלא. מחזיר את הפאות למטרת hit-test ----
export function render(canvas, { parts, dims, materials, view, selId, guides }) {
  if (!canvas) return []
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const r = canvas.getBoundingClientRect()
  const w = r.width || 320, h = r.height || 360
  canvas.width = w * dpr; canvas.height = h * dpr
  const W = canvas.width, H = canvas.height
  const ctx = canvas.getContext('2d')
  ctx.clearRect(0, 0, W, H)
  drawGrid(ctx, view, W, H, dpr)

  const faces = []
  parts.forEach(part => {
    const C = cornersOf(part, dims, materials).map(p => project(p, view, W, H))
    const base = colorOf(part, materials)
    const sel = part.id === selId
    FACES.forEach(([idx, key]) => {
      const pts = idx.map(i => C[i])
      const depth = pts.reduce((a, p) => a + p.depth, 0) / 4
      faces.push({ pts, depth, base, key, part, sel })
    })
  })
  faces.sort((a, b) => b.depth - a.depth)

  const hit = []
  faces.forEach(fc => {
    ctx.beginPath()
    fc.pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)))
    ctx.closePath()
    ctx.fillStyle = shade(fc.base, SHADE[fc.key] || 1)
    ctx.fill()
    ctx.lineWidth = (fc.sel ? 2.5 : 1) * dpr
    ctx.strokeStyle = fc.sel ? '#EEC421' : 'rgba(0,0,0,.45)'
    ctx.stroke()
    hit.push({ pts: fc.pts, depth: fc.depth, partId: fc.part.id })
  })

  // קווי הצמדה — נמתחים לרוחב הסצנה בציר שנצמד
  if (guides && guides.length) {
    ctx.save()
    ctx.setLineDash([7 * dpr, 5 * dpr])
    ctx.strokeStyle = '#55C07E'
    ctx.lineWidth = 1.5 * dpr
    const R = Math.max(dims.רוחב, dims.גובה, dims.עומק, 60) * 1.1
    guides.forEach(g => {
      const a = { x: 0, y: dims.גובה / 2, z: 0 }, b = { x: 0, y: dims.גובה / 2, z: 0 }
      const along = g.axis === 'y' ? 'x' : 'y'   // הקו נמתח בציר אחר
      a[g.axis] = b[g.axis] = g.value
      a[along] = g.axis === 'y' ? -R : 0
      b[along] = g.axis === 'y' ? R : dims.גובה
      const pa = project(a, view, W, H), pb = project(b, view, W, H)
      ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y); ctx.stroke()
    })
    ctx.restore()
  }

  if (selId) {
    const p = parts.find(x => x.id === selId)
    if (p) {
      const c = project(p.pos, view, W, H)
      ctx.font = `700 ${13 * dpr}px Heebo, sans-serif`
      ctx.textAlign = 'center'
      ctx.fillStyle = '#F1EFE8'
      ctx.strokeStyle = 'rgba(0,0,0,.75)'; ctx.lineWidth = 3 * dpr
      const label = `${p.name} · ${Math.round(lenOf(p, dims))}`
      ctx.strokeText(label, c.x, c.y); ctx.fillText(label, c.x, c.y)
    }
  }
  return hit
}

export function hitTest(hits, x, y) {
  const found = hits.filter(f => pointInPoly(x, y, f.pts))
  if (!found.length) return null
  found.sort((a, b) => a.depth - b.depth)
  return found[0].partId
}

// ============================================================
// עזרי עריכה: גרירה מדויקת והצמדות
// ============================================================

// כמה ס"מ בעולם שווה פיקסל אחד על המסך (במישור המטרה)
export function worldPerPixel(view, W, H) {
  const f = Math.min(W, H) * 0.9
  return view.dist / f
}

// לאיזה ציר בעולם מתאימה תנועה אופקית של העכבר, לפי סיבוב התצוגה
export function dragAxes(view) {
  const cy = Math.cos(view.yaw), sy = Math.sin(view.yaw)
  return Math.abs(cy) >= Math.abs(sy)
    ? { h: 'x', hs: Math.sign(cy) || 1 }
    : { h: 'z', hs: -(Math.sign(sy) || 1) }
}

// תיבת החלק בעולם (ס"מ) — לצורך הצמדות
export function aabb(part, dims, materials) {
  const [pw, ph] = displayProfile(part, dims, materials)
  const L = lenOf(part, dims)
  let hx, hy, hz
  if (part.axis === 'x') { hx = L / 2; hy = ph / 2; hz = pw / 2 }
  else if (part.axis === 'y') { hx = pw / 2; hy = L / 2; hz = ph / 2 }
  else { hx = pw / 2; hy = ph / 2; hz = L / 2 }
  const c = part.pos
  return {
    x: [c.x - hx, c.x, c.x + hx],
    y: [c.y - hy, c.y, c.y + hy],
    z: [c.z - hz, c.z, c.z + hz],
  }
}

// מועמדים להצמדה לאורך ציר: קצוות ומרכזים של שאר החלקים + גבולות הקוליסה
export function snapTargets(axis, parts, movingId, dims, materials) {
  const t = []
  parts.forEach(p => {
    if (p.id === movingId) return
    aabb(p, dims, materials)[axis].forEach(v => t.push(v))
  })
  if (axis === 'y') { t.push(0, dims.גובה, dims.גובה / 2) }
  if (axis === 'x') { t.push(0, -dims.רוחב / 2, dims.רוחב / 2) }
  if (axis === 'z') { t.push(0, -dims.עומק / 2, dims.עומק / 2) }
  return t
}

// מצמיד חלק לאורך ציר. מחזיר את המרכז החדש ואת קו העזר להצגה.
export function snapAlong(axis, part, dims, materials, parts, tol) {
  const box = aabb(part, dims, materials)[axis]      // [min, center, max]
  const targets = snapTargets(axis, parts, part.id, dims, materials)
  let best = null
  box.forEach((edge, i) => {
    targets.forEach(t => {
      const d = Math.abs(edge - t)
      if (d <= tol && (!best || d < best.d)) best = { d, delta: t - edge, guide: t }
    })
  })
  if (!best) return null
  return { center: part.pos[axis] + best.delta, guide: best.guide }
}
