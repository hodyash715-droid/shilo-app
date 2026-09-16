import React, { useEffect, useRef, useState } from 'react'
import { DIMS, render, hitTest, lenOf, worldPerPixel, dragAxes, snapAlong } from '../designer/geometry.js'
import { cutList, optimize, DEFAULT_STOCK, PURCHASE, KERF_OPTIONS, DEFAULT_KERF_MM, mmToCm } from '../designer/cuts.js'
import { materialsFor, pickable } from '../designer/materials.js'
import { generateKulisa, defaultFrameMaterial, BRACE_MAX, BRACE_DEFAULT, LIMITS_PREFERRED } from '../designer/kulisa.js'
import { validateDims, invalidParts, tooLongParts } from '../designer/rules.js'
import WallBuilder from './WallBuilder.jsx'
import DrawingSheet from './DrawingSheet.jsx'

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
  const [guides, setGuides] = useState([])
  const [snapOn, setSnapOn] = useState(true)
  const histRef = useRef({ past: [], future: [] })
  const [histLen, setHistLen] = useState(0)

  const materials = React.useMemo(() => materialsFor(inventory), [inventory])
  const selPart = parts.find(p => p.id === sel) || null

  // ציור מחדש בכל שינוי
  useEffect(() => {
    hitsRef.current = render(cvRef.current, { parts, dims, materials, view, selId: sel, guides })
  }, [parts, dims, materials, view, sel, guides])

  useEffect(() => {
    const on = () => { hitsRef.current = render(cvRef.current, { parts, dims, materials, view, selId: sel, guides }) }
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  })

  // מצב עדכני של החלקים גם בין רינדורים — גרירה חייבת בסיס טרי
  const partsRef = useRef(parts)
  partsRef.current = parts

  // ---- היסטוריה: בטל ----
  const snapshot = () => {
    const h = histRef.current
    h.past.push(JSON.stringify(partsRef.current))
    if (h.past.length > 40) h.past.shift()
    setHistLen(h.past.length)
  }
  const undo = () => {
    const h = histRef.current
    if (!h.past.length) return
    const prev = JSON.parse(h.past.pop())
    partsRef.current = prev
    setParts(prev); setSel(null); setGuides([]); setHistLen(h.past.length)
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
    const id = hitTest(hitsRef.current, c.x, c.y)
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
      setView(v => ({ ...v, dist: Math.max(60, Math.min(900, d.dist0 / k)) }))
      return
    }

    const q = pt(e)
    const dx = q.cx - d.lx, dy = q.cy - d.ly
    d.lx = q.cx; d.ly = q.cy

    if (d.mode === 'orbit') {
      setView(v => ({ ...v, yaw: v.yaw - dx * 0.01, pitch: Math.max(-1.2, Math.min(1.4, v.pitch + dy * 0.01)) }))
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

  const up = () => { dragRef.current = null; setGuides([]) }
  const wheel = e => { e.preventDefault(); setView(v => ({ ...v, dist: Math.max(60, Math.min(900, v.dist + e.deltaY * 0.5)) })) }

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
  const applyGen = () => {
    if (genResult.errors.length) return
    if (parts.length && !confirm('פעולה זו מחליפה את כל החלקים שעל המשטח. להמשיך?')) return
    snapshot()
    setDims(d => ({ ...d, רוחב: gen.w, גובה: gen.h }))
    setParts(genResult.parts)
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
    setSel(null); setGuides([]); setPanel(null)
    setName(`קוליסה ${index} · ${width}×${wallH}`)
    setView(v => ({ ...v, target: { x: 0, y: wallH / 2, z: 0 }, dist: Math.max(340, wallH * 1.6) }))
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

  // ---- אימות: חלק שבור לא יגיע בשקט לרשימת החיתוך ----
  const dimCheck = validateDims(dims)
  const badParts = invalidParts(parts, dims)
  const longParts = tooLongParts(parts, dims, materials, stockOv)
  const badIds = new Set(badParts.map(b => b.id))

  const resetView = () => setView({ yaw: -0.7, pitch: 0.45, dist: 340, target: { x: 0, y: dims.גובה / 2, z: 0 } })

  // ---- שמירה / טעינה ----
  const save = async () => {
    const nm = (name || '').trim() || `קוליסה ${dims.גובה}×${dims.רוחב}`
    setName(nm)
    const saved = await onSave({ id: editId, name: nm, preview: dims, parts, jobId })
    if (saved?.id) setEditId(saved.id)
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
        jobId: k.job_id || null,
      })
      setPanel('wall')
      return
    }
    setEditId(k.id); setName(k.name); setJobId(k.job_id || null)
    setDims({ ...{ גובה: 200, רוחב: 100, עומק: 40, עובי: 2 }, ...(k.preview || {}) })
    setParts(Array.isArray(k.parts) ? k.parts : [])
    setSel(null); setPanel(null)
  }
  const newK = (forJob = null) => {
    setEditId(null); setName(''); setParts([]); setSel(null); setPanel(null)
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
      <div className="card" style={{ padding: 0, overflow: 'hidden', position: 'relative' }}>
        <canvas ref={cvRef}
          style={{ width: '100%', height: 360, display: 'block', touchAction: 'none', cursor: 'grab' }}
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
        <div className="row gap-2" style={{ position: 'absolute', top: 10, insetInlineStart: 10 }}>
          <button className="btn btn-sm" onClick={resetView}>🔄 מבט</button>
          <button className="btn btn-sm" onClick={undo} disabled={!histLen}
            style={{ opacity: histLen ? 1 : .4 }}>↶ בטל</button>
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

      {/* רצועת החלקים — בחירה מהירה בלי לצוד על המשטח */}
      {parts.length > 0 && (
        <div className="row gap-2 wrap" style={{ marginTop: 10 }}>
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

      {sheet && (
        <DrawingSheet name={name} dims={dims} parts={parts} materials={materials}
          stockOv={stockOv} kerfCm={mmToCm(kerfMm)} onClose={() => setSheet(false)} />
      )}
    </div>
  )
}
