import React, { useEffect, useRef, useState } from 'react'
import { DIMS, render, hitTest, hitFace, pointOnFace, markAt, lenOf, profileOf, worldPerPixel, dragAxes, snapAlong } from '../designer/geometry.js'
import { cutList, optimize, DEFAULT_STOCK, PURCHASE, KERF_OPTIONS, DEFAULT_KERF_MM, mmToCm } from '../designer/cuts.js'
import { materialsFor, pickable } from '../designer/materials.js'
import { generateKulisa, defaultFrameMaterial, BRACE_MAX, BRACE_DEFAULT, LIMITS_PREFERRED } from '../designer/kulisa.js'
import { validateDims, invalidParts, tooLongParts, JOINT } from '../designer/rules.js'
import WallBuilder from './WallBuilder.jsx'
import { wallLayout, applyToPoint, unapplyFromPoint, normalizeT } from '../designer/wall.js'
import DrawingSheet from './DrawingSheet.jsx'
import StudioRoom from './StudioRoom.jsx'

const uid = () => Math.random().toString(36).slice(2, 10)
const AXES = [
  { id: 'x', label: 'אופקי ↔' },
  { id: 'y', label: 'אנכי ↕' },
  { id: 'z', label: 'עומק ⤢' },
]
// נוסחאות מהירות לפי ציר
const SMART = { x: '{רוחב}', y: '{גובה}', z: '{עומק}' }

export default function Designer({ inventory = [], koolisot = [], jobs = [], onSave, onDelete, target, onTargetUsed }) {
  const cvRef = useRef(null)
  const hitsRef = useRef([])
  const dragRef = useRef(null)

  const [name, setName] = useState('')
  const [editId, setEditId] = useState(null)
  const [jobId, setJobId] = useState(null)
  const [dims, setDims] = useState({ גובה: 200, רוחב: 100, עומק: 40, עובי: 2 })
  const [parts, setParts] = useState([])
  const [sel, setSel] = useState(null)
  const [view, setView] = useState({ yaw: -0.7, pitch: 0.45, dist: 340, target: { x: 0, y: 90, z: 0 } })
  const [panel, setPanel] = useState(null)   // null | 'add' | 'cuts' | 'load' | 'gen' | 'wall'
  const [wallInit, setWallInit] = useState(null)   // קיר שנטען לעריכה
  // סיכום הקיר שעל המשטח, או null אם מה שמוצג הוא קוליסה בודדת.
  // בלעדיו "רוחב 690 מעל המקסימום" היה מוצג כאזהרה על קיר תקין לגמרי.
  const [wallView, setWallView] = useState(null)
  // הקוליסה שנבחרה מהרשימה שמתחת למשטח (0 = הקושרות)
  const [selK, setSelK] = useState(null)
  const [stepDeg, setStepDeg] = useState(45)
  const [stepCm, setStepCm] = useState(10)
  // סימוני ברגים: איפה מחברים בפועל. נשמרים עם הקוליסה או הקיר.
  // pos נשמר במצב הישר של הקיר; המקום האמיתי מחושב לפי הסידור הנוכחי.
  const [marks, setMarks] = useState([])
  const [markMode, setMarkMode] = useState(false)
  // המזהה נשמר ב-ref ולא ב-state: שינוי state היה מרענן את key של
  // WallBuilder ומאפס את העריכה באמצע.
  const wallIdRef = useRef(null)
  const [gen, setGen] = useState({ w: 120, h: 240, matId: '', braces: BRACE_DEFAULT, giben: true })
  const [stockOv, setStockOv] = useState({})
  // רוחב להב המסור, במ"מ. נשמר במכשיר — זו תכונה של המסור, לא של הקוליסה.
  const [kerfMm, setKerfMm] = useState(() => {
    try { return Number(localStorage.getItem('shilo:kerfMm')) || DEFAULT_KERF_MM } catch { return DEFAULT_KERF_MM }
  })
  const pickKerf = (mm) => {
    setKerfMm(mm)
    try { localStorage.setItem('shilo:kerfMm', String(mm)) } catch { /* מצב פרטי — לא נורא */ }
  }
  const [sheet, setSheet] = useState(false)
  const [studioOpen, setStudioOpen] = useState(false)
  const [guides, setGuides] = useState([])
  const [snapOn, setSnapOn] = useState(true)
  const histRef = useRef({ past: [], future: [] })
  const [histLen, setHistLen] = useState(0)

  const materials = React.useMemo(() => materialsFor(inventory), [inventory])
  const selPart = parts.find(p => p.id === sel) || null

  // ציור מחדש בכל שינוי
  // הציר והסידור של הקוליסה שעליה יושב הסימון
  const markFrame = (k) => {
    const g = wallView?.groups?.find(x => x.k === k)
    return g ? { t: normalizeT(wallView.layout?.[k]), pivot: g.pivot } : null
  }
  // הסימון במקומו האמיתי על המשטח
  const markWorld = (m) => {
    const fr = m.k ? markFrame(m.k) : null
    return fr ? applyToPoint(m.pos, fr.t, fr.pivot) : m.pos
  }
  const placedMarks = React.useMemo(
    () => marks.map(m => ({ ...m, pos: markWorld(m) })),
    [marks, wallView?.layout, wallView?.groups]
  )

  // מה מודגש על המשטח: חלק בודד, או כל הקוליסה שנבחרה מהרשימה
  const highlight = React.useMemo(() => (
    selK === null ? sel : new Set(parts.filter(p => p.k === selK).map(p => p.id))
  ), [selK, sel, parts])

  useEffect(() => {
    hitsRef.current = render(cvRef.current, { parts, dims, materials, view, selId: highlight, guides, marks: placedMarks })
  }, [parts, dims, materials, view, highlight, guides, placedMarks])

  useEffect(() => {
    const on = () => { hitsRef.current = render(cvRef.current, { parts, dims, materials, view, selId: highlight, guides, marks: placedMarks }) }
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  })

  // מצב עדכני של החלקים גם בין רינדורים — גרירה חייבת בסיס טרי
  const partsRef = useRef(parts)
  partsRef.current = parts
  const marksRef = useRef(marks)
  marksRef.current = marks
  const wallViewRef = useRef(wallView)
  wallViewRef.current = wallView

  // ---- היסטוריה: בטל ----
  // ההיסטוריה מחזיקה גם חלקים וגם סימוני ברגים: מחיקת סימון בטעות
  // היא בדיוק הדבר שרוצים לבטל.
  // ההיסטוריה מחזיקה חלקים, סימוני ברגים, וסידור הקיר. בלי הסידור,
  // "בטל" אחרי גרירת קוליסה החזיר את החלקים למקומם אבל השאיר את
  // הרשימה, התפרים והשלט על המצב שאחרי הגרירה — שני מצבים על מסך אחד.
  const snapshot = () => {
    const h = histRef.current
    const wv = wallViewRef.current
    h.past.push(JSON.stringify({
      p: partsRef.current, m: marksRef.current,
      w: wv ? { layout: wv.layout || {}, joints: wv.joints || {} } : null,
    }))
    if (h.past.length > 40) h.past.shift()
    setHistLen(h.past.length)
  }
  const undo = () => {
    const h = histRef.current
    if (!h.past.length) return
    const prev = JSON.parse(h.past.pop())
    marksRef.current = prev.m || []
    setMarks(prev.m || [])
    setSel(null); setGuides([]); setHistLen(h.past.length)
    // על קיר, החלקים נגזרים מהסידור — מחזירים את הסידור ובונים מחדש,
    // כדי שהרשימה, התפרים והמשטח יחזרו יחד.
    if (prev.w && wallViewRef.current) { rebuildWall(prev.w.layout, prev.w.joints); return }
    partsRef.current = prev.p
    setParts(prev.p)
  }

  // ---- אינטראקציה: גרירת חלק / סיבוב תצוגה / זום ----
  const pt = e => { const t = e.touches?.[0] || e; return { cx: t.clientX, cy: t.clientY } }
  const canvasXY = e => {
    const r = cvRef.current.getBoundingClientRect()
    const t = e.touches?.[0] || e
    const k = cvRef.current.width / r.width
    return { x: (t.clientX - r.left) * k, y: (t.clientY - r.top) * k }
  }
  const twoDist = e => {
    const [a, b] = e.touches
    return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
  }
  // ס"מ בעולם לכל פיקסל CSS
  const worldPerCss = () => {
    const cv = cvRef.current
    const k = cv.width / cv.getBoundingClientRect().width
    return worldPerPixel(view, cv.width, cv.height) * k
  }

  const down = e => {
    if (e.touches?.length === 2) {
      dragRef.current = { mode: 'pinch', d0: twoDist(e), dist0: view.dist }
      return
    }
    const c = canvasXY(e), q = pt(e)

    // מצב סימון: הסימון מונח רק כשמרימים את האצבע בלי לגרור. באצבע
    // על טלפון, כל סיבוב מבט מתחיל בנגיעה — בלי ההמתנה הזו כל ניסיון
    // להסתובב היה משאיר בורג מיותר.
    if (markMode) {
      dragRef.current = { mode: 'mark', lx: q.cx, ly: q.cy, sx: q.cx, sy: q.cy, cx: c.x, cy: c.y }
      return
    }

    const id = hitTest(hitsRef.current, c.x, c.y)

    // על קיר עובדים עם קוליסות, לא עם לטות: נגיעה בוחרת את הקוליסה
    // כולה, וגרירה מזיזה אותה על הרצפה. הקושרות לא נגררות — הן
    // שייכות לתפר, לא לקוליסה.
    if (wallView && id) {
      const part = parts.find(p => p.id === id)
      const k = Number(part?.k) || 0
      if (k) {
        setSelK(k); setSel(null)
        snapshot()
        const cur = wallView.layout?.[k] || { dx: 0, dz: 0, deg: 0 }
        dragRef.current = {
          mode: 'group', k, lx: q.cx, ly: q.cy,
          base: { dx: cur.dx || 0, dz: cur.dz || 0, deg: cur.deg || 0 },
          acc: { dx: 0, dz: 0 },
        }
        return
      }
    }

    setSel(id)
    if (id) snapshot()
    dragRef.current = { mode: id ? 'part' : 'orbit', id, lx: q.cx, ly: q.cy }
  }

  const move = e => {
    const d = dragRef.current; if (!d) return
    e.preventDefault?.()

    if (d.mode === 'pinch') {
      if (e.touches?.length !== 2) return
      const k = twoDist(e) / (d.d0 || 1)
      setView(v => ({ ...v, dist: Math.max(60, Math.min(2000, d.dist0 / k)) }))
      return
    }

    const q = pt(e)
    const dx = q.cx - d.lx, dy = q.cy - d.ly
    d.lx = q.cx; d.ly = q.cy

    // זזה האצבע יותר מכמה פיקסלים? זו גרירה, לא נגיעה — והסימון מבוטל.
    if (d.mode === 'mark') {
      if (Math.hypot(q.cx - d.sx, q.cy - d.sy) > 8) d.mode = 'orbit'
      else return
    }

    if (d.mode === 'orbit') {
      setView(v => ({ ...v, yaw: v.yaw - dx * 0.01, pitch: Math.max(-1.2, Math.min(1.4, v.pitch + dy * 0.01)) }))
      return
    }

    // גרירת קוליסה על הרצפה. תנועה אופקית של האצבע היא הציר שפונה
    // ימינה במבט הנוכחי; תנועה אנכית היא הציר שפונה לעומק. חלק
    // בודד נגרר גם למעלה-למטה, קוליסה לא — היא עומדת על הרצפה.
    if (d.mode === 'group') {
      const w = worldPerCss()
      const { h, hs } = dragAxes(view)
      const cy = Math.cos(view.yaw), sy = Math.sin(view.yaw)
      const v = h === 'x' ? 'z' : 'x'
      const vs = h === 'x' ? (Math.sign(cy) || 1) : (Math.sign(sy) || 1)
      // ככל שמסתכלים יותר מהצד, פיקסל אחד על המסך הוא יותר ס״מ לעומק.
      // ממבט חזיתי ממש העומק לא נראה — מגבילים כדי שלא יברח לאינסוף.
      const spRaw = Math.sin(view.pitch)
      const sp = (Math.sign(spRaw) || 1) * Math.max(0.25, Math.abs(spRaw))
      d.acc[h === 'x' ? 'dx' : 'dz'] += dx * w * hs
      d.acc[v === 'x' ? 'dx' : 'dz'] += dy * w / sp * vs
      const next = {
        dx: Math.round((d.base.dx + d.acc.dx) * 10) / 10,
        dz: Math.round((d.base.dz + d.acc.dz) * 10) / 10,
        deg: d.base.deg,
      }
      rebuildWall({ ...(wallView?.layout || {}), [d.k]: next })
      return
    }
    if (!d.id) return

    const w = worldPerCss()
    const { h, hs } = dragAxes(view)
    const cp = Math.max(0.25, Math.cos(view.pitch))
    let next = partsRef.current.map(x => x.id !== d.id ? x : {
      ...x,
      pos: {
        ...x.pos,
        [h]: (x.pos[h] || 0) + dx * w * hs,
        y: (x.pos.y || 0) - dy * w / cp,
      },
    })

    let g = []
    if (snapOn) {
      const me = next.find(x => x.id === d.id)
      const snapped = { ...me, pos: { ...me.pos } }
      const tol = Math.max(1, 14 * w)
      ;[h, 'y'].forEach(ax => {
        const r = snapAlong(ax, snapped, dims, materials, next, tol)
        if (r) { snapped.pos[ax] = r.center; g.push({ axis: ax, value: r.guide }) }
      })
      next = next.map(x => x.id === d.id ? snapped : x)
    }
    partsRef.current = next
    setParts(next); setGuides(g)
  }

  const up = () => {
    const d = dragRef.current
    if (d?.mode === 'mark') placeMark(d.cx, d.cy)
    dragRef.current = null; setGuides([])
  }

  // הנחה או מחיקה של סימון בנקודה שנלחצה
  const placeMark = (cx, cy) => {
    const cv = cvRef.current
    const hitIdx = markAt(placedMarks, view, cv.width, cv.height, cx, cy)
    if (hitIdx !== null) {
      snapshot()
      setMarks(ms => ms.filter((_, i) => i !== hitIdx))
      return
    }
    const face = hitFace(hitsRef.current, cx, cy)
    if (!face) return
    const p = pointOnFace(face, cx, cy, view, cv.width, cv.height)
    if (!p) return
    // לאיזו קוליסה הסימון שייך, וכיצד הוא נראה במצב הישר
    const part = parts.find(x => x.id === face.partId)
    const k = Number(part?.k) || 0
    const fr = k ? markFrame(k) : null
    snapshot()
    setMarks(ms => [...ms, {
      id: uid(), k,
      pos: fr ? unapplyFromPoint(p, fr.t, fr.pivot) : p,
    }])
  }
  const wheel = e => { e.preventDefault(); setView(v => ({ ...v, dist: Math.max(60, Math.min(2000, v.dist + e.deltaY * 0.5)) })) }

  // ---- חלקים ----
  const addPart = (invId) => {
    const m = materials.find(x => x.id === invId)
    const axis = 'y'
    const p = {
      id: uid(), invId, name: m?.name || 'חלק',
      len: SMART[axis], axis,
      pos: { x: (parts.length % 6) * 14 - 35, y: dims.גובה / 2, z: 0 },
    }
    snapshot()
    setParts(ps => [...ps, p]); setSel(p.id); setPanel(null)
  }
  const setField = (f, v) => {
    snapshot()
    setParts(ps => ps.map(p => p.id === sel ? { ...p, [f]: v } : p))
  }
  const nudge = (axis, step) => {
    snapshot()
    setParts(ps => ps.map(p => p.id === sel
      ? { ...p, pos: { ...p.pos, [axis]: Math.round(((p.pos[axis] || 0) + step) * 10) / 10 } } : p))
  }
  const dupPart = () => {
    if (!selPart) return
    snapshot()
    const c = { ...selPart, id: uid(), pos: { ...selPart.pos, x: selPart.pos.x + 12 } }
    setParts(ps => [...ps, c]); setSel(c.id)
  }
  const delPart = () => {
    snapshot()
    setParts(ps => ps.filter(p => p.id !== sel)); setSel(null)
  }

  // ---- מחולל קוליסה ----
  // ברירת המחדל היא החומר שמקיים את הכלל המאושר (2 ס"מ בחזית), ולא סתם הראשון במלאי.
  const genMat = materials.find(m => m.id === gen.matId) || defaultFrameMaterial(materials)
  const genResult = React.useMemo(
    () => generateKulisa({ width: gen.w, height: gen.h, depth: dims.עומק, material: genMat, braces: gen.braces, giben: gen.giben }),
    [gen.w, gen.h, gen.braces, gen.giben, genMat, dims.עומק]
  )
  const r1 = n => Math.round(n * 10) / 10

  // מרחק המצלמה. עד היום נגזר מהגובה בלבד — קיר של 7 מטר נחתך בצדדים.
  const frameFor = (d) => ({
    target: { x: 0, y: (Number(d.גובה) || 0) / 2, z: 0 },
    dist: Math.max(340, (Number(d.רוחב) || 0) * 1.2, (Number(d.גובה) || 0) * 1.6),
  })

  const applyGen = () => {
    if (genResult.errors.length) return
    if (parts.length && !confirm('פעולה זו מחליפה את כל החלקים שעל המשטח. להמשיך?')) return
    snapshot()
    setDims(d => ({ ...d, רוחב: gen.w, גובה: gen.h }))
    setParts(genResult.parts)
    setWallView(null); setSelK(null); setMarks([])
    setSel(null); setGuides([]); setPanel(null)
    if (!name.trim()) setName(`קוליסה ${gen.h}×${gen.w}`)
    setView(v => ({ ...v, target: { x: 0, y: gen.h / 2, z: 0 }, dist: Math.max(340, gen.h * 1.6) }))
  }

  // ---- קיר ----
  // פתיחת קוליסה בודדת מתוך הקיר, על המשטח
  const openFromWall = (width, index, wallH) => {
    if (parts.length && !confirm('פעולה זו מחליפה את כל החלקים שעל המשטח. להמשיך?')) return
    const g = generateKulisa({ width, height: wallH, depth: dims.עומק, material: genMat, braces: gen.braces, giben: gen.giben })
    if (g.errors.length) return
    snapshot()
    setDims(d => ({ ...d, רוחב: width, גובה: wallH }))
    setParts(g.parts)
    setWallView(null); setSelK(null); setMarks([])
    setSel(null); setGuides([]); setPanel(null)
    setName(`קוליסה ${index} · ${width}×${wallH}`)
    setView(v => ({ ...v, target: { x: 0, y: wallH / 2, z: 0 }, dist: Math.max(340, wallH * 1.6) }))
  }

  // כל הקיר על המשטח: הקוליסות זו לצד זו, והקושרות מאחור על התפרים.
  // האורכים נכתבים כמספרים ולא כנוסחאות — {רוחב} כאן הוא רוחב הקיר
  // כולו, ואילו כל אופקי נמדד לפי הקוליסה שלו.
  // אפשרויות הייצור של הקיר. נקבעות פעם אחת כשהקיר עולה למשטח,
  // ונשמרות איתו — כדי שבנייה מחדש תיתן בדיוק את אותו קיר.
  const prodNow = () => ({ braces: gen.braces, giben: gen.giben, depth: dims.עומק, matId: genMat?.id })
  const wallOpts = (prod) => {
    const p = prod || prodNow()
    return {
      material: materials.find(m => m.id === p.matId) || genMat,
      braces: p.braces, giben: p.giben, depth: p.depth,
    }
  }

  const showWallOnCanvas = (widths, wallH, overlapCm, seedLayout, ballast) => {
    if (parts.length && !confirm('פעולה זו מחליפה את כל החלקים שעל המשטח. להמשיך?')) return
    const base = { widths: widths.map(w => (w && typeof w === 'object' ? { ...w } : w)), height: Number(wallH), overlapCm, prod: prodNow() }
    // הסידור שהתבנית קבעה הוא נקודת הפתיחה, לא כלוב: משם ממשיכים
    // לגרור ולסובב כרגיל.
    const layout = seedLayout && typeof seedLayout === 'object' ? seedLayout : {}
    const r = wallLayout(base.widths, base.height, { ...wallOpts(base.prod), overlapCm }, layout, {})
    if (!r.parts.length) return
    snapshot()
    setDims(r.dims)
    setParts(r.parts)
    setSel(null); setSelK(null); setGuides([]); setPanel(null)
    setWallView({
      base, layout, joints: {}, groups: r.groups, ballast: ballast || null, linear: r.linear,
      seams: r.seams, bolts: r.bolts, koshretDropped: r.koshretDropped,
      kulisot: r.kulisot, koshret: r.koshret, width: r.dims.רוחב,
    })
    setName(n => n.trim() || `קיר ${r.dims.רוחב}×${r.dims.גובה}`)
    setView(v => ({ ...v, ...frameFor(r.dims) }))
    setTimeout(() => cvRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 0)
  }

  // סידור: הזזה או סיבוב של קוליסה שלמה. הקיר נבנה מחדש מהמצב הישר
  // ומהסידור המצטבר, כדי ששום לחיצה לא תיפול על תוצאה של קודמתה.
  const arrange = (k, delta) => {
    if (!wallView) return
    const cur = wallView.layout[k] || { dx: 0, dz: 0, dy: 0, deg: 0 }
    const next = {
      dx: r1((cur.dx || 0) + (delta.dx || 0)),
      dz: r1((cur.dz || 0) + (delta.dz || 0)),
      // הרמה לא יורדת מתחת לרצפה — קוליסה תלויה באוויר שלילי היא שטות
      dy: Math.max(0, r1((cur.dy || 0) + (delta.dy || 0))),
      deg: r1((cur.deg || 0) + (delta.deg || 0)),
    }
    applyLayout({ ...wallView.layout, [k]: next })
  }

  // מספר הברגים בתפר. שי: משתנה בין 3 ל-6 לפי הצורך.
  const setSeamBolts = (seam, n) => {
    const cur = (wallView.joints || {})[seam] || {}
    applyLayout(wallView.layout, { ...(wallView.joints || {}), [seam]: { ...cur, bolts: n } })
  }

  // בנייה מחדש של הקיר לפי סידור. בלי היסטוריה — הגרירה קוראת לזה
  // בכל תזוזת אצבע, ורשומה אחת בהיסטוריה לכל גרירה היא מה שרוצים.
  const rebuildWall = (layout, joints) => {
    const b = wallView.base
    const nextJoints = joints || wallView.joints || {}
    const r = wallLayout(b.widths, b.height,
      { ...wallOpts(b.prod), overlapCm: b.overlapCm }, layout, nextJoints)
    if (!r.parts.length) return false
    partsRef.current = r.parts
    setParts(r.parts)
    setWallView(w => ({
      ...w, layout, joints: nextJoints, groups: r.groups, linear: r.linear,
      seams: r.seams, bolts: r.bolts, koshret: r.koshret, koshretDropped: r.koshretDropped,
    }))
    return true
  }

  const applyLayout = (layout, joints) => {
    snapshot()
    rebuildWall(layout, joints)
  }

  // The studio edits the same state as the canvas, including wall height and
  // hinge rotation. A drag commits once, so Undo restores the whole gesture.
  const studioSelect = selection => {
    setSelK(selection?.k ?? null)
    setSel(selection?.id ?? null)
  }
  const studioTransform = (selection, delta) => {
    if (wallView) {
      if (selection?.k > 0) arrange(selection.k, delta)
      return
    }
    const part = parts.find(p => p.id === selection?.id)
    if (!part) return
    snapshot()
    const [, wide] = profileOf(part, materials)
    const halfHeight = part.axis === 'y' ? lenOf(part, dims) / 2 : wide / 2
    const next = parts.map(p => p.id !== part.id ? p : {
      ...p, yaw: (Number(p.yaw) || 0) + (delta.deg || 0) * Math.PI / 180,
      pos: { x: r1(p.pos.x + (delta.dx || 0)),
        y: delta.dy ? Math.max(halfHeight, r1(p.pos.y + delta.dy)) : p.pos.y,
        z: r1(p.pos.z + (delta.dz || 0)) },
    })
    partsRef.current = next
    setParts(next)
  }

  // קושרת בתפר ישר היא בחירה: "בניהם מחברים ברגים ולפעמים גם קושרות".
  const toggleKoshret = (seam, on) => {
    applyLayout(wallView.layout, { ...(wallView.joints || {}), [seam]: { koshret: on } })
  }

  const resetArrange = () => {
    if (!confirm('להחזיר את כל הקוליסות לקו ישר?')) return
    applyLayout({}, wallView.joints || {})
  }

  // שמירת קיר. אותה טבלה כמו קוליסה — preview.kind מבדיל ביניהם,
  // כך שלא נדרש שינוי סכמה במסד.
  const saveWall = async (w) => {
    const saved = await onSave({
      id: wallIdRef.current,   // עריכה מעדכנת; שמירה חוזרת לא משכפלת
      name: w.name,
      preview: {
        kind: 'wall', גובה: w.height, רוחב: w.totalWidth, עומק: dims.עומק, עובי: dims.עובי,
        overlapCm: w.overlapCm, braces: gen.braces, giben: gen.giben,
      },
      parts: w.kulisot,
      jobId: w.jobId,
    })
    if (saved?.id) wallIdRef.current = saved.id
  }

  // פרזול לשרטוט: מה שלא נחתך מעץ אבל בלעדיו אי אפשר להרכיב.
  // פרזול לשרטוט. סימון ידני גובר על ההערכה לפי תפרים — אם סומן
  // איפה מבריגים, זו הכמות האמיתית ולא חישוב.
  const hardware = React.useMemo(() => {
    if (marks.length) {
      return [{ name: JOINT.bolt, qty: marks.length, note: 'מסומנים בשרטוט' }, ...extra]
    }
    // משקולות: לא עץ, אבל בלעדיהן השער לא עומד.
    const bal = wallView?.ballast
    const extra = bal && bal.perLeg > 0 && bal.legs > 0
      ? [{ name: bal.name, qty: bal.perLeg * bal.legs, note: `${bal.perLeg} לכל רגל` }]
      : []
    const seams = wallView?.linear === false ? [] : (wallView?.seams || [])
    if (!seams.length) return extra
    const corners = seams.filter(x => x.corner).length
    return [{
      name: JOINT.bolt,
      qty: seams.reduce((n, x) => n + x.bolts, 0),
      note: corners ? `${seams.length} תפרים · ${corners} פינות` : `${seams.length} תפרים`,
    }, ...extra]
  }, [marks.length, wallView?.seams, wallView?.ballast])

  // ---- אימות: חלק שבור לא יגיע בשקט לרשימת החיתוך ----
  const dimCheckRaw = validateDims(dims)
  // על קיר, "רוחב מעל 150" הוא סכום הקוליסות ולא חריגה. כל שאר
  // הבדיקות נשארות בתוקף.
  const dimCheck = wallView
    ? { ...dimCheckRaw, warnings: dimCheckRaw.warnings.filter(w => w.field !== 'רוחב') }
    : dimCheckRaw
  const badParts = invalidParts(parts, dims)
  const longParts = tooLongParts(parts, dims, materials, stockOv)
  const badIds = new Set(badParts.map(b => b.id))

  const resetView = () => setView({ yaw: -0.7, pitch: 0.45, ...frameFor(dims) })

  // ---- שמירה / טעינה ----
  const save = async () => {
    const isWall = !!wallView
    const nm = (name || '').trim() ||
      (isWall ? `קיר ${dims.רוחב}×${dims.גובה}` : `קוליסה ${dims.גובה}×${dims.רוחב}`)
    setName(nm)
    // קיר מסודר נשמר עם הסידור עצמו ולא רק עם התוצאה, כדי שאפשר
    // יהיה לפתוח אותו שוב ולהזיז כנף — ולא רק להסתכל עליה.
    const preview = isWall
      ? { ...dims, kind: 'wall-layout', marks, wall: { ...wallView.base, layout: wallView.layout, joints: wallView.joints || {}, ballast: wallView.ballast || null } }
      : { ...dims, marks }
    const saved = await onSave({ id: editId, name: nm, preview, parts, jobId })
    if (saved?.id) setEditId(saved.id)
    return saved
  }
  const loadK = k => {
    // קיר שמור נפתח במסך ההרכבה, לא כחלקים על המשטח
    if (k.preview?.kind === 'wall') {
      wallIdRef.current = k.id
      setWallInit({
        id: k.id, name: k.name,
        height: k.preview.גובה || 240,
        kulisot: Array.isArray(k.parts) ? k.parts : [],
        overlapCm: k.preview.overlapCm,
        layout: k.preview.wall?.layout || null,
        ballast: k.preview.wall?.ballast || null,
        jobId: k.job_id || null,
      })
      setPanel('wall')
      return
    }
    setEditId(k.id); setName(k.name); setJobId(k.job_id || null)
    setDims({ ...{ גובה: 200, רוחב: 100, עומק: 40, עובי: 2 }, ...(k.preview || {}) })
    setParts(Array.isArray(k.parts) ? k.parts : [])
    setSel(null); setPanel(null); setSelK(null)
    setMarks(Array.isArray(k.preview?.marks) ? k.preview.marks : [])
    setMarkMode(false)

    // קיר מסודר: בונים מחדש את הקבוצות כדי שהכנפיים יהיו ניתנות
    // להזזה שוב. אם הבנייה נכשלת נשארים עם החלקים בלבד — עדיף
    // מאשר כפתורים שמצביעים על כלום.
    const w = k.preview?.wall
    if (k.preview?.kind === 'wall-layout' && w?.widths?.length) {
      const r = wallLayout(w.widths, w.height,
        { ...wallOpts(w.prod), overlapCm: w.overlapCm }, w.layout || {}, w.joints || {})
      // החלקים נלקחים מהבנייה מחדש ולא מהשמירה: אחרת רשימת הקוליסות
      // הייתה מצביעה על מזהים שכבר לא על המשטח, והכפתורים היו משקרים.
      if (r.parts.length) setParts(r.parts)
      setWallView(r.parts.length ? {
        base: { widths: w.widths, height: w.height, overlapCm: w.overlapCm, prod: w.prod },
        layout: w.layout || {}, joints: w.joints || {}, groups: r.groups, ballast: w.ballast || null, linear: r.linear,
        seams: r.seams, bolts: r.bolts, koshretDropped: r.koshretDropped,
        kulisot: r.kulisot, koshret: r.koshret, width: r.dims.רוחב,
      } : null)
      return
    }
    setWallView(null)
  }
  const newK = (forJob = null) => {
    // אחרי קיר, המידות נשארו על 330 רוחב — ועל משטח ריק זו הייתה
    // אזהרת חריגה על כלום. חוזרים למידות שמסך הקוליסה בונה בהן.
    if (wallView) setDims(d => ({ ...d, רוחב: gen.w, גובה: gen.h }))
    setEditId(null); setName(''); setParts([]); setSel(null); setPanel(null); setWallView(null); setSelK(null); setMarks([]); setMarkMode(false)
    setJobId(forJob)
    histRef.current = { past: [], future: [] }; setHistLen(0)
  }

  // פתיחה מתוך כרטיס עבודה
  useEffect(() => {
    if (!target) return
    const k = target.koolisaId && koolisot.find(x => x.id === target.koolisaId)
    if (k) loadK(k)
    else newK(target.jobId || null)
    onTargetUsed?.()
  }, [target])

  const cuts = cutList(parts, dims, materials)
  const plans = optimize(cuts, materials, stockOv, mmToCm(kerfMm))

  const tbtn = (label, onClick, primary) => (
    <button className={primary ? 'btn btn-sm btn-solid' : 'btn btn-sm'} onClick={onClick} style={{ flex: '1 1 auto' }}>{label}</button>
  )

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: 16 }}>
      <div className="row gap-2" style={{ marginBottom: 12 }}>
        <span style={{ width: 4, height: 22, background: 'var(--gold)', borderRadius: 2, flex: '0 0 auto' }} />
        <input className="field" value={name} onChange={e => setName(e.target.value)}
          placeholder="שם הקוליסה" style={{ fontWeight: 700, flex: 1, minWidth: 0 }} />
        <span className="t-meta" style={{ flex: '0 0 auto' }}>{parts.length} חלקים</span>
      </div>

      {/* שיוך לעבודה */}
      <div className="row gap-2" style={{ marginBottom: 12 }}>
        <span className="t-meta" style={{ flex: '0 0 auto' }}>עבודה</span>
        <select className="field" value={jobId || ''} onChange={e => setJobId(e.target.value || null)}
          style={{ height: 36, flex: 1, minWidth: 0 }}>
          <option value="">— לא משויכת —</option>
          {jobs.map(j => <option key={j.id} value={j.id}>{j.title}</option>)}
        </select>
      </div>

      {/* מידות פרמטריות */}
      <div className="card" style={{ padding: 12, marginBottom: 12 }}>
        <div className="t-meta" style={{ marginBottom: 8 }}>מידות הקוליסה (ס״מ) — כל החלקים מתעדכנים לפי הנוסחאות</div>
        <div className="row gap-2 wrap">
          {DIMS.map(d => (
            <div key={d} style={{ flex: '1 1 70px', minWidth: 70 }}>
              <div className="t-meta" style={{ marginBottom: 4 }}>{d}</div>
              <input className="field" type="number" dir="ltr" style={{ height: 38 }}
                value={dims[d]} onChange={e => setDims(s => ({ ...s, [d]: Number(e.target.value) || 0 }))} />
            </div>
          ))}
        </div>
      </div>

      {/* אימות */}
      {(dimCheck.errors.length > 0 || dimCheck.warnings.length > 0 || badParts.length > 0 || longParts.length > 0) && (
        <div className="card" style={{
          padding: 12, marginBottom: 12,
          borderColor: dimCheck.errors.length || badParts.length ? 'var(--danger)' : 'var(--warn)',
        }}>
          {dimCheck.errors.map(e => (
            <div key={e.field} style={{ color: 'var(--danger)', fontWeight: 700, fontSize: 13, marginBottom: 4 }}>
              ✖ {e.message}
            </div>
          ))}
          {badParts.map(b => (
            <div key={b.id} style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 4 }}>
              ✖ <b>{b.name}</b> — {b.message}. לא ייכנס לרשימת החיתוך.
            </div>
          ))}
          {longParts.map(b => (
            <div key={b.id} style={{ color: 'var(--warn-fg)', fontSize: 13, marginBottom: 4 }}>
              ⚠ <b>{b.name}</b> — {b.message}
            </div>
          ))}
          {dimCheck.warnings.map(w => (
            <div key={w.field} style={{ color: 'var(--warn-fg)', fontSize: 13, marginBottom: 4 }}>
              ⚠ {w.message}
            </div>
          ))}
        </div>
      )}

      {/* המשטח */}
      <button type="button" className="btn" onClick={() => setStudioOpen(true)}
        style={{ width: '100%', marginBottom: 12, minHeight: 54, justifyContent: 'space-between',
          background: 'linear-gradient(115deg, #29392c, #1b271e)', borderColor: '#617348', color: '#f2edda' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m12 2 9 5v10l-9 5-9-5V7zM3 7l9 5 9-5M12 12v10M7.5 4.5l9 5v10" /></svg>
          <span>אולפן תלת־ממד</span>
        </span>
        <span style={{ fontSize: 12, fontWeight: 400 }}>העיצוב בתוך חדר ←</span>
      </button>
      <div className="card" style={{ padding: 0, overflow: 'hidden', position: 'relative' }}>
        <canvas ref={cvRef}
          // בטלפון מסובב הגובה הוא 375: משטח קבוע של 360 בלע את כל המסך
          // ולא נשאר מקום לכפתורים. בזקוף שום דבר לא משתנה.
          style={{
            width: '100%', height: 'min(360px, 62vh)', minHeight: 190,
            display: 'block', touchAction: 'none', cursor: 'grab',
          }}
          onMouseDown={down} onMouseMove={move} onMouseUp={up} onMouseLeave={up}
          onTouchStart={down} onTouchMove={move} onTouchEnd={up}
          onWheel={wheel} />
        {parts.length === 0 && (
          <div style={{
            position: 'absolute', inset: 0, display: 'grid', placeItems: 'center',
            textAlign: 'center', pointerEvents: 'none', padding: 20,
          }}>
            <div>
              <div style={{ fontSize: 34, marginBottom: 6 }}>🪚</div>
              <div style={{ fontWeight: 700 }}>המשטח ריק</div>
              <div className="muted" style={{ fontSize: 13, marginTop: 4, lineHeight: 1.7 }}>
                <b>🧱 קוליסה</b> בונה מסגרת לייצור · <b>🏗️ קיר</b> מרכיב קוליסות ומחבר בקושרות.<br />
                גרור חלק להזזה · גרור רקע לסיבוב · שתי אצבעות לזום.
              </div>
            </div>
          </div>
        )}
        {markMode && (
          <div style={{
            position: 'absolute', bottom: 10, insetInlineStart: 10, insetInlineEnd: 10,
            pointerEvents: 'none', textAlign: 'center',
            background: 'rgba(255,61,190,.14)', border: '1px solid #FF3DBE', borderRadius: 8,
            padding: '3px 8px', fontSize: 11, fontWeight: 700, color: 'var(--ink)',
          }}>
            לחץ לסמן בורג · לחיצה על סימון מוחקת
            {marks.length > 0 && <> · <span className="mono">{marks.length}</span> עד כה</>}
          </div>
        )}
        {wallView && !markMode && (
          <div style={{
            position: 'absolute', bottom: 10, insetInlineStart: 10, pointerEvents: 'none',
            background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 8,
            padding: '4px 9px', fontSize: 12, fontWeight: 700,
          }}>
            🏗️ קיר · <span className="mono">{wallView.kulisot}</span> קוליסות ·{' '}
            <span className="mono">{wallView.koshret}</span> קושרות
            {wallView.linear !== false && wallView.bolts > 0 && <> · <span className="mono">{wallView.bolts}</span> ברגים</>}
            {' '}· <span className="mono">{wallView.width}</span> ס״מ
          </div>
        )}
        {/* ארבעה כפתורים לא נכנסים בשורה אחת ברוחב 375 — מותר להם לרדת שורה */}
        <div className="row gap-2 wrap" style={{ position: 'absolute', top: 10, insetInlineStart: 10, insetInlineEnd: 10 }}>
          <button className="btn btn-sm" onClick={resetView}>🔄 מבט</button>
          <button className="btn btn-sm" onClick={undo} disabled={!histLen}
            style={{ opacity: histLen ? 1 : .4 }}>↶ בטל</button>
          <button className="btn btn-sm" onClick={() => { setMarkMode(v => !v); setSel(null) }}
            title="סימון מקומות הברגים"
            style={{
              background: markMode ? '#FF3DBE' : 'var(--card)',
              color: markMode ? '#fff' : 'var(--ink45)',
              borderColor: markMode ? '#FF3DBE' : 'var(--line)',
            }}>🔩 ברגים{marks.length > 0 && <> <span className="mono">{marks.length}</span></>}</button>
          <button className="btn btn-sm" onClick={() => setSnapOn(v => !v)} title="הצמדה לחלקים אחרים"
            style={{
              background: snapOn ? 'var(--go-bg)' : 'var(--card)',
              color: snapOn ? 'var(--go-fg)' : 'var(--ink45)',
              borderColor: snapOn ? 'var(--go)' : 'var(--line)',
            }}>🧲 הצמדה</button>
        </div>
      </div>

      {/* סרגל כלים */}
      <div className="row gap-2 wrap" style={{ marginTop: 12 }}>
        {tbtn('🧱 קוליסה', () => setPanel(panel === 'gen' ? null : 'gen'), true)}
        {tbtn('🏗️ קיר', () => setPanel(panel === 'wall' ? null : 'wall'), true)}
        {tbtn('＋ חלק', () => setPanel('add'))}
        {tbtn('✂️ חיתוך', () => setPanel(panel === 'cuts' ? null : 'cuts'))}
        {parts.length > 0 && tbtn('📐 שרטוט', () => setSheet(true))}
        {tbtn('📂 קוליסות', () => setPanel(panel === 'load' ? null : 'load'))}
        {tbtn('💾 שמור', save)}
        {parts.length > 0 && tbtn('חדש', () => newK(jobId))}
      </div>

      {/* הקוליסות שמרכיבות את הקיר — בחירה והזזה כיחידה שלמה */}
      {wallView && (
        <div className="card" style={{ marginTop: 10, padding: 12 }}>
          <div className="t-meta" style={{ marginBottom: 7 }}>
            הקוליסות בקיר — לחץ על אחת (כאן או על המשטח), גרור אותה על המשטח, או פתח אותה ככנף
          </div>
          <div className="row gap-2 wrap">
            {wallView.groups.map(g => {
              const on = selK === g.k
              return (
                <button key={g.k} className="btn btn-sm"
                  onClick={() => { setSelK(on ? null : g.k); setSel(null) }}
                  style={{
                    minHeight: 34,
                    background: on ? 'var(--gold-bg)' : 'var(--card)',
                    color: on ? 'var(--gold-fg)' : 'var(--ink70)',
                    borderColor: on ? 'var(--gold)' : 'var(--line)',
                  }}>
                  {g.label}
                  {g.width != null && <> · <span className="mono">{g.width}</span></>}
                  {g.k === 0 && <> · <span className="mono">{g.count}</span></>}
                  {g.moved && ' ✳'}
                </button>
              )
            })}
          </div>

          {selK !== null && (() => {
            const g = wallView.groups.find(x => x.k === selK)
            const t = wallView.layout[selK] || { dx: 0, dz: 0, deg: 0 }
            const small = { minHeight: 34, flex: '1 1 0' }
            return (
              <div style={{ marginTop: 11, borderTop: '1px solid var(--line)', paddingTop: 11 }}>
                <div className="row between" style={{ marginBottom: 8 }}>
                  <span style={{ fontWeight: 700 }}>
                    {g?.label}{g?.width != null && <> · <span className="mono">{g.width}</span> ס״מ</>}
                  </span>
                  <span className="t-meta mono">
                    {t.deg ? `${t.deg}°` : 'ישר'}
                    {(t.dx || t.dz) ? ` · ${t.dx}/${t.dz}` : ''}
                    {t.dy ? ` · מורמת ${t.dy}` : ''}
                  </span>
                </div>

                <div className="t-meta" style={{ marginBottom: 4 }}>
                  סיבוב — נפתחת סביב הקצה הפנימי, כמו דלת. בחר זווית ולחץ על החץ.
                </div>
                <div className="row gap-2" dir="ltr" style={{ marginBottom: 8 }}>
                  <button className="btn btn-sm" style={small}
                    onClick={() => arrange(selK, { deg: -stepDeg })}>⟲</button>
                  {[15, 45, 90].map(d => (
                    <button key={d} className="btn btn-sm mono" onClick={() => setStepDeg(d)}
                      style={{
                        ...small,
                        background: stepDeg === d ? 'var(--gold-bg)' : 'var(--card)',
                        color: stepDeg === d ? 'var(--gold-fg)' : 'var(--ink45)',
                        borderColor: stepDeg === d ? 'var(--gold)' : 'var(--line)',
                      }}>{d}°</button>
                  ))}
                  <button className="btn btn-sm" style={small}
                    onClick={() => arrange(selK, { deg: +stepDeg })}>⟳</button>
                </div>

                <div className="t-meta" style={{ marginBottom: 4 }}>הזזה</div>
                <div className="row gap-2" dir="ltr" style={{ marginBottom: 8, fontSize: 12 }}>
                  <button className="btn btn-sm" style={small}
                    onClick={() => arrange(selK, { dx: -stepCm })}>← שמאלה</button>
                  <button className="btn btn-sm" style={small}
                    onClick={() => arrange(selK, { dz: -stepCm })}>↑ אחורה</button>
                  <button className="btn btn-sm" style={small}
                    onClick={() => arrange(selK, { dz: +stepCm })}>↓ קדימה</button>
                  <button className="btn btn-sm" style={small}
                    onClick={() => arrange(selK, { dx: +stepCm })}>→ ימינה</button>
                </div>
                <div className="t-meta" style={{ marginBottom: 4 }}>צעד ההזזה (ס״מ)</div>
                <div className="row gap-2" dir="ltr" style={{ marginBottom: 8 }}>
                  {[5, 10, 25, 50].map(c => (
                    <button key={c} className="btn btn-sm mono" onClick={() => setStepCm(c)}
                      style={{
                        ...small,
                        background: stepCm === c ? 'var(--gold-bg)' : 'var(--card)',
                        color: stepCm === c ? 'var(--gold-fg)' : 'var(--ink45)',
                        borderColor: stepCm === c ? 'var(--gold)' : 'var(--line)',
                      }}>{c}</button>
                  ))}
                </div>

                <div className="t-meta" style={{ marginBottom: 4 }}>
                  גובה מהרצפה — כך מרימים כותרת של שער
                </div>
                <div className="row gap-2" dir="ltr">
                  <button className="btn btn-sm" style={small}
                    onClick={() => arrange(selK, { dy: -stepCm })} disabled={!t.dy}>▼ הורד</button>
                  <span className="mono t-meta" style={{
                    flex: '1 1 0', textAlign: 'center', alignSelf: 'center',
                  }}>{t.dy ? `${t.dy} ס״מ` : 'על הרצפה'}</span>
                  <button className="btn btn-sm" style={small}
                    onClick={() => arrange(selK, { dy: +stepCm })}>▲ הרם</button>
                </div>

                <div className="row gap-2" style={{ marginTop: 10 }}>
                  <button className="btn btn-sm grow" disabled={!g?.moved}
                    onClick={() => applyLayout({ ...wallView.layout, [selK]: { dx: 0, dz: 0, dy: 0, deg: 0 } })}>
                    ↺ החזר את {g?.label} למקום
                  </button>
                </div>
              </div>
            )
          })()}

          {wallView.ballast && (
            <div style={{ fontSize: 12, marginTop: 10 }}>
              🧱 <span className="mono">{wallView.ballast.perLeg * wallView.ballast.legs}</span>{' '}
              {wallView.ballast.name} — <span className="mono">{wallView.ballast.perLeg}</span> בתוך כל רגל.
            </div>
          )}
          {wallView.linear === false && (
            <div style={{ fontSize: 12, marginTop: 12, borderTop: '1px solid var(--line)', paddingTop: 11, lineHeight: 1.7 }}>
              🔩 במבנה הזה הקוליסות לא עומדות בשורה, ולכן אין שרשרת תפרים
              לספור ממנה ברגים. סמן אותם על המשטח עם <b>🔩 ברגים</b> —
              מה שתסמן הוא מה שייכנס לרשימה.
            </div>
          )}
          {wallView.linear !== false && wallView.seams?.length > 0 && (
            <div style={{ marginTop: 12, borderTop: '1px solid var(--line)', paddingTop: 11 }}>
              <div className="t-meta" style={{ marginBottom: 6 }}>
                חיבורים — ברגים בכל תפר (3–6), וקושרת לפי הצורך.
              </div>
              <div style={{ display: 'grid', gap: 6 }}>
                {wallView.seams.map(sm => {
                  const [lo, hi] = sm.boltsRange || [3, 6]
                  return (
                    <div key={sm.seam} className="row gap-2" style={{ fontSize: 12 }}>
                      <span style={{ fontWeight: 700, flex: '0 0 auto', minWidth: 52 }}>
                        ק{sm.between[0]}–ק{sm.between[1]}
                      </span>
                      <span className="row gap-1" dir="ltr" style={{ flex: '0 0 auto' }}>
                        <button className="btn btn-sm" style={{ minHeight: 32, minWidth: 30 }}
                          disabled={sm.bolts <= lo}
                          onClick={() => setSeamBolts(sm.seam, sm.bolts - 1)}>−</button>
                        <span className="mono" style={{ minWidth: 34, textAlign: 'center', alignSelf: 'center' }}>
                          🔩{sm.bolts}
                        </span>
                        <button className="btn btn-sm" style={{ minHeight: 32, minWidth: 30 }}
                          disabled={sm.bolts >= hi}
                          onClick={() => setSeamBolts(sm.seam, sm.bolts + 1)}>+</button>
                      </span>
                      <button className="btn btn-sm"
                        disabled={!sm.canToggleKoshret}
                        onClick={() => toggleKoshret(sm.seam, !sm.koshret)}
                        style={{
                          minHeight: 32, fontSize: 12, flex: 1,
                          background: sm.koshret ? 'var(--gold-bg)' : 'var(--card)',
                          color: sm.corner ? 'var(--ink45)' : (sm.koshret ? 'var(--gold-fg)' : 'var(--ink70)'),
                          borderColor: sm.koshret ? 'var(--gold)' : 'var(--line)',
                          opacity: sm.canToggleKoshret ? 1 : .75,
                        }}>
                        {sm.corner
                          ? <>פינה{sm.angle ? <> <span className="mono">{Math.abs(sm.angle)}°</span></> : null}</>
                          : <>{sm.koshret ? 'קושרות ✓' : 'בלי קושרות'}</>}
                      </button>
                    </div>
                  )
                })}
              </div>
              <div className="t-meta" style={{ marginTop: 7, lineHeight: 1.6 }}>
                סה״כ <span className="mono">{wallView.bolts}</span> × {JOINT.bolt} ·{' '}
                <span className="mono">{wallView.koshret}</span> קושרות.
                {wallView.seams.some(x => x.corner) &&
                  ' על פינה לא יושבת קושרת — שם הברגים לבדם.'}
              </div>
            </div>
          )}

          {wallView.groups.some(g => g.moved) && (
            <>
              <div className="t-meta" style={{ marginTop: 10, lineHeight: 1.6 }}>
                ✳ הזזה בלי פינה לא משנה את העץ ברשימה. פינה כן:
                שם יורדות הקושרות ונשארים הברגים.
              </div>
              <button className="btn btn-sm" style={{ marginTop: 8 }} onClick={resetArrange}>
                ↺ החזר הכול לקו ישר
              </button>
            </>
          )}
        </div>
      )}

      {/* רצועת החלקים — בחירה מהירה בלי לצוד על המשטח */}
      {parts.length > 0 && (
        // קיר של 5 קוליסות הוא 53 חלקים. בלי תקרה הרצועה דוחפת את
        // רשימת החיתוך ואת הכפתורים אל מחוץ למסך בטלפון.
        <div className="row gap-2 wrap" style={{
          marginTop: 10, maxHeight: 132, overflowY: 'auto',
        }}>
          {parts.map((p, i) => (
            <button key={p.id} className="chip" onClick={() => setSel(p.id)} style={{
              cursor: 'pointer', border: '1px solid',
              borderColor: badIds.has(p.id) ? 'var(--danger)' : p.id === sel ? 'var(--gold)' : 'var(--line)',
              background: p.id === sel ? 'var(--gold-bg)' : 'var(--card)',
              color: badIds.has(p.id) ? 'var(--danger)' : p.id === sel ? 'var(--gold-fg)' : 'var(--ink70)',
            }}>
              <span className="mono">{i + 1}</span> · {p.name} · <span className="mono">{badIds.has(p.id) ? '✖' : Math.round(lenOf(p, dims))}</span>
            </button>
          ))}
        </div>
      )}

      {/* הרכבת קיר — נשאר מחובר גם כשסוגרים, אחרת הקיר שנבנה אובד */}
      <div className="card" hidden={panel !== 'wall'} style={{ marginTop: 12, padding: 14 }}>
          <div className="row between" style={{ marginBottom: 4 }}>
            <span style={{ fontWeight: 700 }}>קיר — הרכבה מקוליסות</span>
            <button className="btn btn-ghost btn-sm" onClick={() => { setPanel(null); setWallInit(null); wallIdRef.current = null }}>✕</button>
          </div>
          <div className="t-meta" style={{ marginBottom: 12 }}>
            הקוליסה היא יחידת הייצור · הקיר הוא מה שיוצא לעבודה
          </div>
          <WallBuilder
            key={wallInit?.id || 'new'}
            materials={materials}
            material={genMat}
            kerfCm={mmToCm(kerfMm)}
            braces={gen.braces}
            giben={gen.giben}
            jobs={jobs}
            initial={wallInit}
            onOpenKulisa={openFromWall}
            onSaveWall={saveWall}
            onNewWall={() => { wallIdRef.current = null; setWallInit(null) }}
            onShowWall={showWallOnCanvas}
          />
      </div>

      {/* מחולל קוליסה */}
      {panel === 'gen' && (
        <div className="card" style={{ marginTop: 12, padding: 14 }}>
          <div className="row between" style={{ marginBottom: 10 }}>
            <span style={{ fontWeight: 700 }}>קוליסה חדשה ממידה</span>
            <button className="btn btn-ghost btn-sm" onClick={() => setPanel(null)}>✕</button>
          </div>

          <div className="row gap-2" style={{ marginBottom: 10 }}>
            <div style={{ flex: 1 }}>
              <div className="t-meta" style={{ marginBottom: 4 }}>רוחב</div>
              <input className="field" type="number" dir="ltr" style={{ height: 38 }}
                value={gen.w} onChange={e => setGen(g => ({ ...g, w: Number(e.target.value) }))} />
            </div>
            <div style={{ flex: 1 }}>
              <div className="t-meta" style={{ marginBottom: 4 }}>גובה</div>
              <input className="field" type="number" dir="ltr" style={{ height: 38 }}
                value={gen.h} onChange={e => setGen(g => ({ ...g, h: Number(e.target.value) }))} />
            </div>
          </div>

          <div className="row gap-2 wrap" style={{ marginBottom: 10 }}>
            {LIMITS_PREFERRED.map(w => (
              <button key={w} className="btn btn-sm" onClick={() => setGen(g => ({ ...g, w }))}
                style={{
                  background: gen.w === w ? 'var(--gold)' : 'var(--card)',
                  color: gen.w === w ? 'var(--on-gold)' : 'var(--ink70)',
                  borderColor: gen.w === w ? 'var(--gold)' : 'var(--line)',
                }}>{w}</button>
            ))}
          </div>

          <div className="t-meta" style={{ marginBottom: 4 }}>חומר המסגרת</div>
          <select className="field" style={{ height: 38, marginBottom: 10 }}
            value={genMat?.id || ''} onChange={e => setGen(g => ({ ...g, matId: e.target.value }))}>
            {pickable(materials).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>

          <div className="t-meta" style={{ marginBottom: 6 }}>חיזוקים פנימיים</div>
          <div className="row gap-2 wrap" style={{ marginBottom: 10 }}>
            {Array.from({ length: BRACE_MAX + 1 }, (_, n) => n).map(n => (
              <button key={n} className="btn btn-sm" onClick={() => setGen(g => ({ ...g, braces: n }))}
                style={{
                  minWidth: 34,
                  background: gen.braces === n ? 'var(--gold)' : 'var(--card)',
                  color: gen.braces === n ? 'var(--on-gold)' : 'var(--ink70)',
                  borderColor: gen.braces === n ? 'var(--gold)' : 'var(--line)',
                }}>{n}</button>
            ))}
          </div>

          <label className="row gap-2" style={{ marginBottom: 10, cursor: 'pointer', alignItems: 'flex-start' }}>
            <input type="checkbox" checked={gen.giben} style={{ marginTop: 3 }}
              onChange={e => setGen(g => ({ ...g, giben: e.target.checked }))} />
            <span>
              <span style={{ fontWeight: 600 }}>2 גיבנים — עליון ותחתון</span>
              <span className="muted" style={{ display: 'block', fontSize: 12 }}>
                כל גיבן משתי לטות ⇒ 4 לטות. כך שי בונה.
              </span>
            </span>
          </label>

          {genResult.errors.length > 0 ? (
            <div style={{ color: 'var(--danger)', fontSize: 13, fontWeight: 700, marginBottom: 10 }}>
              {genResult.errors.map(e => <div key={e}>✖ {e}</div>)}
            </div>
          ) : (
            <div className="card" style={{ padding: 10, marginBottom: 10, background: 'var(--gold-bg)' }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>
                {genResult.parts.length} חלקים · <span className="mono">{genMat?.name}</span>
              </div>
              <div className="t-meta">
                2 אנכיות × <span className="mono">{gen.h}</span>
                {genResult.plan.counts.gibens > 0
                  ? <> · {genResult.plan.counts.gibens} גיבנים ({genResult.plan.counts.gibenMembers} לטות) × <span className="mono">{genResult.plan.inner}</span></>
                  : <> · עליונה ותחתונה × <span className="mono">{genResult.plan.inner}</span></>}
                {genResult.plan.braces.length > 0 && <> · {genResult.plan.braces.length} חיזוקים בגובה <span className="mono">{genResult.plan.braces.join(' / ')}</span></>}
              </div>
              {genResult.warnings.map(w => (
                <div key={w} style={{ color: 'var(--warn-fg)', fontSize: 12, marginTop: 6 }}>⚠ {w}</div>
              ))}
            </div>
          )}

          <button className="btn btn-solid" style={{ width: '100%' }}
            disabled={genResult.errors.length > 0} onClick={applyGen}>
            {parts.length ? 'החלף את המשטח' : 'צור קוליסה'}
          </button>
        </div>
      )}

      {/* בחירת חומר להוספה */}
      {panel === 'add' && (
        <div className="card" style={{ marginTop: 12, overflow: 'hidden' }}>
          <div className="row between" style={{ padding: 12, borderBottom: '1px solid var(--hair)' }}>
            <span style={{ fontWeight: 700 }}>בחר חומר גלם</span>
            <button className="btn btn-ghost btn-sm" onClick={() => setPanel(null)}>✕</button>
          </div>
          {pickable(materials).map((m, i) => (
            <button key={m.id} onClick={() => addPart(m.id)} className="row between gap-2" style={{
              appearance: 'none', border: 0, width: '100%', textAlign: 'start', cursor: 'pointer',
              background: 'transparent', color: 'var(--ink)', font: 'inherit', padding: 11,
              borderTop: i ? '1px solid var(--hair)' : 0,
            }}>
              <span>{m.name}</span>
              <span className="t-meta mono">
                {m.stock_len || DEFAULT_STOCK}{String(m.id).startsWith('std:') ? '' : ' ★'}
              </span>
            </button>
          ))}
          <div className="muted" style={{ padding: '10px 12px', fontSize: 12, borderTop: '1px solid var(--hair)' }}>
            החומרים שלך (★) נוספים בטאב "בשטח" בקטגוריה <b>חומר גלם</b>. השאר — פרופילים סטנדרטיים.
          </div>
        </div>
      )}

      {/* קוליסות שמורות */}
      {panel === 'load' && (
        <div className="card" style={{ marginTop: 12, overflow: 'hidden' }}>
          <div className="row between" style={{ padding: 12, borderBottom: '1px solid var(--hair)' }}>
            <span style={{ fontWeight: 700 }}>קוליסות שמורות</span>
            <button className="btn btn-ghost btn-sm" onClick={() => setPanel(null)}>✕</button>
          </div>
          {koolisot.length === 0
            ? <div className="muted" style={{ padding: 16, fontSize: 13 }}>עוד לא שמרת קוליסות.</div>
            : koolisot.map((k, i) => (
              <div key={k.id} className="row between gap-2" style={{ padding: 11, borderTop: i ? '1px solid var(--hair)' : 0 }}>
                <button onClick={() => loadK(k)} style={{
                  appearance: 'none', border: 0, background: 'transparent', cursor: 'pointer',
                  color: 'var(--ink)', font: 'inherit', textAlign: 'start', flex: 1, minWidth: 0,
                }}>
                  <div style={{ fontWeight: 600 }} className="truncate">{k.name}</div>
                  <div className="t-meta">
                    {k.preview?.kind === 'wall'
                      ? <>🏗️ {(k.parts || []).length} קוליסות · <span className="mono">{k.preview?.רוחב}×{k.preview?.גובה}</span></>
                      : k.preview?.kind === 'wall-layout'
                      // קיר מסודר: parts הם החלקים עצמם, ומספר הקוליסות בא מהסידור
                      ? <>🏗️ {(k.preview?.wall?.widths || []).length} קוליסות{
                          Object.values(k.preview?.wall?.layout || {}).some(t => t?.deg || t?.dx || t?.dz || t?.dy) && (Object.values(k.preview?.wall?.layout || {}).some(t => t?.deg) ? ' · עם כנפיים' : ' · מסודר')
                        } · <span className="mono">{k.preview?.רוחב}×{k.preview?.גובה}</span></>
                      : <>{(k.parts || []).length} חלקים · <span className="mono">{k.preview?.גובה}×{k.preview?.רוחב}</span></>}
                  </div>
                </button>
                <button className="btn btn-ghost btn-sm" style={{ color: '#E5735B' }} onClick={() => onDelete(k.id)}>✕</button>
              </div>
            ))}
        </div>
      )}

      {/* פאנל חלק נבחר */}
      {selPart && (
        <div className="card" style={{ marginTop: 12, padding: 14 }}>
          <div className="row between gap-2" style={{ marginBottom: 10 }}>
            <span style={{ fontWeight: 700 }}>{selPart.name}</span>
            <span className="mono t-meta">{Math.round(lenOf(selPart, dims))} ס״מ</span>
          </div>
          <div className="t-meta" style={{ marginBottom: 6 }}>כיוון</div>
          <div className="row gap-2" style={{ marginBottom: 10 }}>
            {AXES.map(a => (
              <button key={a.id} className="btn btn-sm" style={{
                flex: 1,
                background: selPart.axis === a.id ? 'var(--gold)' : 'var(--card)',
                color: selPart.axis === a.id ? 'var(--on-gold)' : 'var(--ink70)',
                borderColor: selPart.axis === a.id ? 'var(--gold)' : 'var(--line)',
              }} onClick={() => { setField('axis', a.id); setField('len', SMART[a.id]) }}>{a.label}</button>
            ))}
          </div>
          <div className="t-meta" style={{ marginBottom: 6 }}>אורך — מספר או נוסחה</div>
          <input className="field" value={selPart.len} onChange={e => setField('len', e.target.value)}
            placeholder="{גובה}  ·  {רוחב}-8  ·  120" />
          <div className="row gap-2 wrap" style={{ marginTop: 8 }}>
            {['{גובה}', '{רוחב}', '{עומק}', `{רוחב}-${(dims.עובי || 2) * 2}`].map(f => (
              <button key={f} className="btn btn-sm" onClick={() => setField('len', f)}>{f}</button>
            ))}
          </div>
          <div className="t-meta" style={{ margin: '12px 0 6px' }}>הזזה</div>
          <div className="row gap-2 wrap">
            {[['x', '↔'], ['y', '↕'], ['z', '⤢']].map(([ax, ic]) => (
              <span key={ax} className="row gap-1">
                <button className="btn btn-sm" onClick={() => nudge(ax, -5)}>−</button>
                <span className="t-meta" style={{ width: 26, textAlign: 'center' }}>{ic}</span>
                <button className="btn btn-sm" onClick={() => nudge(ax, +5)}>+</button>
              </span>
            ))}
          </div>
          <div className="row gap-2" style={{ marginTop: 12 }}>
            <button className="btn btn-sm grow" onClick={dupPart}>שכפל</button>
            <button className="btn btn-sm grow" style={{ color: '#E5735B' }} onClick={delPart}>מחק חלק</button>
          </div>
        </div>
      )}

      {/* חיתוך ואופטימיזציה */}
      {panel === 'cuts' && (
        <div className="card" style={{ marginTop: 12, padding: 14 }}>
          <div className="row between" style={{ marginBottom: 10 }}>
            <span style={{ fontWeight: 700 }}>✂️ תוכנית חיתוך</span>
            <span className="t-meta mono">{dims.גובה}×{dims.רוחב}×{dims.עומק}</span>
          </div>

          <div className="t-meta" style={{ marginBottom: 10 }}>
            אורך הקנייה נבחר אוטומטית בטווח <span className="mono">{PURCHASE.min}–{PURCHASE.max}</span> ס״מ,
            כדי לקנות כמה שפחות עץ. אפשר לנעול אורך ידנית.
          </div>

          <div style={{ marginBottom: 12 }}>
            <div className="t-meta" style={{ marginBottom: 6 }}>
              רוחב החתך של המסור — המספר האמצעי שכתוב על הדיסק (למשל <span className="mono">250×3.2×30</span>)
            </div>
            <div className="row gap-2 wrap">
              {KERF_OPTIONS.map(o => (
                <button key={o.mm} className="btn btn-sm" title={o.note || undefined}
                  onClick={() => pickKerf(o.mm)}
                  style={{
                    background: kerfMm === o.mm ? 'var(--gold)' : 'var(--card)',
                    color: kerfMm === o.mm ? 'var(--on-gold)' : 'var(--ink70)',
                    borderColor: kerfMm === o.mm ? 'var(--gold)' : 'var(--line)',
                  }}>
                  <span className="mono">{o.mm}</span> מ״מ
                </button>
              ))}
            </div>
            {KERF_OPTIONS.find(o => o.mm === kerfMm)?.note && (
              <div className="t-meta" style={{ marginTop: 5 }}>{KERF_OPTIONS.find(o => o.mm === kerfMm).note}</div>
            )}
          </div>

          {plans.length === 0 ? (
            <div className="muted" style={{ fontSize: 13 }}>אין חלקים עם אורך.</div>
          ) : plans.map(p => (
            <div key={p.key} style={{ marginBottom: 16 }}>
              <div className="row between gap-2" style={{ marginBottom: 6 }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>{p.mat}</span>
                <span className="row gap-2">
                  <span className="t-meta">{p.chosenLength === 'auto' ? 'קורה · מומלץ' : 'קורה'}</span>
                  <input className="field mono" type="number" dir="ltr"
                    style={{ height: 30, width: 74, padding: '0 8px' }}
                    value={stockOv[p.key] ?? p.stock}
                    onChange={e => setStockOv(s => ({ ...s, [p.key]: e.target.value }))} />
                  {stockOv[p.key] != null && (
                    <button className="btn btn-ghost btn-sm" title="חזרה לאורך המומלץ"
                      onClick={() => setStockOv(s => { const { [p.key]: _, ...rest } = s; return rest })}>↺</button>
                  )}
                </span>
              </div>

              <div className="row gap-2 wrap" style={{ marginBottom: 8 }}>
                <span className="chip chip-go">{p.barCount}× <span className="mono">{p.stock}</span> ס״מ</span>
                <span className="chip">סה״כ <span className="mono">{p.barCount * p.stock}</span> ס״מ</span>
                <span className="chip" style={{ color: p.wastePct > 25 ? '#E5735B' : 'var(--ink70)' }}>
                  פחת {p.wastePct}% · {p.wasteCm} ס״מ
                </span>
              </div>

              {/* ויזואליזציה של כל קורה */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {p.bars.map((b, i) => {
                  // כולל את רוחב המסור בין החיתוכים — אחרת השארית נראית גדולה מהאמת
                  const used = b.cuts.reduce((s, L) => s + L, 0) + Math.max(0, b.cuts.length - 1) * p.kerf
                  return (
                    <div key={i} className="row gap-2">
                      <span className="mono t-meta" style={{ width: 22 }}>{i + 1}</span>
                      <div style={{ flex: 1, display: 'flex', height: 22, borderRadius: 4, overflow: 'hidden', border: '1px solid var(--line)' }}>
                        {b.cuts.map((L, j) => (
                          <div key={j} title={`${L} ס״מ`} style={{
                            width: `${(L / p.stock) * 100}%`,
                            background: j % 2 ? 'var(--gold)' : 'var(--gold-fg)',
                            color: 'var(--on-gold)', fontSize: 9.5, fontWeight: 700,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            borderInlineEnd: '1px solid rgba(0,0,0,.35)',
                          }}>{(L / p.stock) > 0.09 ? L : ''}</div>
                        ))}
                        <div style={{ flex: 1, background: 'repeating-linear-gradient(45deg,#2A2A2F 0 4px,#1D1D21 4px 8px)' }} />
                      </div>
                      <span className="mono t-meta" style={{ width: 52, textAlign: 'end' }}>
                        {Math.round(p.stock - used)}↯
                      </span>
                    </div>
                  )
                })}
              </div>

              {p.tooLong.length > 0 && (
                <div style={{ color: '#E5735B', fontSize: 12.5, marginTop: 6 }}>
                  ⚠ {p.tooLong.length} חלקים ארוכים מהקורה ({p.tooLong.map(Math.round).join(', ')} ס״מ)
                </div>
              )}
            </div>
          ))}

          <div className="t-meta" style={{ marginTop: 4, lineHeight: 1.7 }}>
            הפס הכהה בסוף כל קורה הוא הפחת. החישוב כולל <span className="mono">{kerfMm}</span> מ״מ לרוחב המסור בין חיתוכים.
          </div>
        </div>
      )}

      {studioOpen && (
        <StudioRoom name={name} dims={dims} parts={parts} materials={materials} marks={placedMarks}
          wallView={wallView} selection={selK !== null ? { k: selK } : sel ? { id: sel } : null}
          onSelect={studioSelect} onTransform={studioTransform} onUndo={undo} canUndo={!!histLen}
          onSave={save} onClose={() => setStudioOpen(false)} />
      )}
      {sheet && (
        <DrawingSheet name={name} dims={dims} parts={parts} materials={materials}
          stockOv={stockOv} kerfCm={mmToCm(kerfMm)} hardware={hardware} marks={placedMarks}
          onClose={() => setSheet(false)} />
      )}
    </div>
  )
}
