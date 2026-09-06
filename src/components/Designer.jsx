import React, { useEffect, useRef, useState } from 'react'
import { DIMS, render, hitTest, lenOf } from '../designer/geometry.js'
import { cutList, optimize, DEFAULT_STOCK } from '../designer/cuts.js'
import { materialsFor } from '../designer/materials.js'

const uid = () => Math.random().toString(36).slice(2, 10)
const AXES = [
  { id: 'x', label: 'אופקי ↔' },
  { id: 'y', label: 'אנכי ↕' },
  { id: 'z', label: 'עומק ⤢' },
]
// נוסחאות מהירות לפי ציר
const SMART = { x: '{רוחב}', y: '{גובה}', z: '{עומק}' }

export default function Designer({ inventory = [], koolisot = [], onSave, onDelete }) {
  const cvRef = useRef(null)
  const hitsRef = useRef([])
  const dragRef = useRef(null)

  const [name, setName] = useState('')
  const [editId, setEditId] = useState(null)
  const [dims, setDims] = useState({ גובה: 200, רוחב: 100, עומק: 40, עובי: 2 })
  const [parts, setParts] = useState([])
  const [sel, setSel] = useState(null)
  const [view, setView] = useState({ yaw: -0.7, pitch: 0.45, dist: 340, target: { x: 0, y: 90, z: 0 } })
  const [panel, setPanel] = useState(null)   // null | 'cuts' | 'load'
  const [stockOv, setStockOv] = useState({})

  const materials = React.useMemo(() => materialsFor(inventory), [inventory])
  const selPart = parts.find(p => p.id === sel) || null

  // ציור מחדש בכל שינוי
  useEffect(() => {
    hitsRef.current = render(cvRef.current, { parts, dims, materials, view, selId: sel })
  }, [parts, dims, materials, view, sel])

  useEffect(() => {
    const on = () => { hitsRef.current = render(cvRef.current, { parts, dims, materials, view, selId: sel }) }
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  })

  // ---- אינטראקציה: גרירת חלק / סיבוב תצוגה / זום ----
  const pos = e => {
    const r = cvRef.current.getBoundingClientRect()
    const t = e.touches?.[0] || e
    const dpr = cvRef.current.width / r.width
    return { x: (t.clientX - r.left) * dpr, y: (t.clientY - r.top) * dpr, cx: t.clientX, cy: t.clientY }
  }
  const down = e => {
    const p = pos(e)
    const id = hitTest(hitsRef.current, p.x, p.y)
    setSel(id)
    dragRef.current = { mode: id ? 'part' : 'orbit', id, lx: p.cx, ly: p.cy }
  }
  const move = e => {
    const d = dragRef.current; if (!d) return
    const p = pos(e)
    const dx = p.cx - d.lx, dy = p.cy - d.ly
    d.lx = p.cx; d.ly = p.cy
    if (d.mode === 'orbit') {
      setView(v => ({ ...v, yaw: v.yaw - dx * 0.01, pitch: Math.max(-1.2, Math.min(1.4, v.pitch + dy * 0.01)) }))
    } else if (d.id) {
      const k = 0.35
      setParts(ps => ps.map(x => x.id === d.id
        ? { ...x, pos: { ...x.pos, x: x.pos.x + dx * k, y: x.pos.y - dy * k } } : x))
    }
    e.preventDefault?.()
  }
  const up = () => { dragRef.current = null }
  const wheel = e => { e.preventDefault(); setView(v => ({ ...v, dist: Math.max(80, Math.min(900, v.dist + e.deltaY * 0.5)) })) }

  // ---- חלקים ----
  const addPart = (invId) => {
    const m = materials.find(x => x.id === invId)
    const axis = 'y'
    const p = {
      id: uid(), invId, name: m?.name || 'חלק',
      len: SMART[axis], axis,
      pos: { x: (parts.length % 6) * 14 - 35, y: dims.גובה / 2, z: 0 },
    }
    setParts(ps => [...ps, p]); setSel(p.id); setPanel(null)
  }
  const setField = (f, v) => setParts(ps => ps.map(p => p.id === sel ? { ...p, [f]: v } : p))
  const nudge = (axis, step) => setParts(ps => ps.map(p => p.id === sel
    ? { ...p, pos: { ...p.pos, [axis]: (p.pos[axis] || 0) + step } } : p))
  const dupPart = () => {
    if (!selPart) return
    const c = { ...selPart, id: uid(), pos: { ...selPart.pos, x: selPart.pos.x + 12 } }
    setParts(ps => [...ps, c]); setSel(c.id)
  }
  const delPart = () => { setParts(ps => ps.filter(p => p.id !== sel)); setSel(null) }

  const resetView = () => setView({ yaw: -0.7, pitch: 0.45, dist: 340, target: { x: 0, y: dims.גובה / 2, z: 0 } })

  // ---- שמירה / טעינה ----
  const save = async () => {
    const nm = (name || '').trim() || `קוליסה ${dims.גובה}×${dims.רוחב}`
    setName(nm)
    const saved = await onSave({ id: editId, name: nm, preview: dims, parts })
    if (saved?.id) setEditId(saved.id)
  }
  const loadK = k => {
    setEditId(k.id); setName(k.name)
    setDims({ ...{ גובה: 200, רוחב: 100, עומק: 40, עובי: 2 }, ...(k.preview || {}) })
    setParts(Array.isArray(k.parts) ? k.parts : [])
    setSel(null); setPanel(null)
  }
  const newK = () => { setEditId(null); setName(''); setParts([]); setSel(null); setPanel(null) }

  const cuts = cutList(parts, dims, materials)
  const plans = optimize(cuts, materials, stockOv)

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
                לחץ <b>＋ חלק</b> כדי להתחיל.<br />גרור חלק להזזה · גרור רקע לסיבוב · גלגלת לזום.
              </div>
            </div>
          </div>
        )}
        <button className="btn btn-sm" onClick={resetView}
          style={{ position: 'absolute', top: 10, insetInlineStart: 10 }}>🔄 מבט</button>
      </div>

      {/* סרגל כלים */}
      <div className="row gap-2 wrap" style={{ marginTop: 12 }}>
        {tbtn('＋ חלק', () => setPanel('add'), true)}
        {tbtn('✂️ חיתוך', () => setPanel(panel === 'cuts' ? null : 'cuts'))}
        {tbtn('📂 קוליסות', () => setPanel(panel === 'load' ? null : 'load'))}
        {tbtn('💾 שמור', save)}
        {parts.length > 0 && tbtn('חדש', newK)}
      </div>

      {/* בחירת חומר להוספה */}
      {panel === 'add' && (
        <div className="card" style={{ marginTop: 12, overflow: 'hidden' }}>
          <div className="row between" style={{ padding: 12, borderBottom: '1px solid var(--hair)' }}>
            <span style={{ fontWeight: 700 }}>בחר חומר גלם</span>
            <button className="btn btn-ghost btn-sm" onClick={() => setPanel(null)}>✕</button>
          </div>
          {materials.map((m, i) => (
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
                  <div className="t-meta">{(k.parts || []).length} חלקים · <span className="mono">{k.preview?.גובה}×{k.preview?.רוחב}</span></div>
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

          {plans.length === 0 ? (
            <div className="muted" style={{ fontSize: 13 }}>אין חלקים עם אורך.</div>
          ) : plans.map(p => (
            <div key={p.key} style={{ marginBottom: 16 }}>
              <div className="row between gap-2" style={{ marginBottom: 6 }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>{p.mat}</span>
                <span className="row gap-2">
                  <span className="t-meta">קורה</span>
                  <input className="field mono" type="number" dir="ltr"
                    style={{ height: 30, width: 74, padding: '0 8px' }}
                    value={stockOv[p.key] ?? p.stock}
                    onChange={e => setStockOv(s => ({ ...s, [p.key]: e.target.value }))} />
                </span>
              </div>

              <div className="row gap-2 wrap" style={{ marginBottom: 8 }}>
                <span className="chip chip-go">{p.barCount} קורות</span>
                <span className="chip" style={{ color: p.wastePct > 25 ? '#E5735B' : 'var(--ink70)' }}>
                  פחת {p.wastePct}% · {p.wasteCm} ס״מ
                </span>
              </div>

              {/* ויזואליזציה של כל קורה */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {p.bars.map((b, i) => {
                  const used = b.cuts.reduce((s, L) => s + L, 0)
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
            הפס הכהה בסוף כל קורה הוא הפחת. חישוב כולל 3 מ״מ לרוחב המסור בין חיתוכים.
          </div>
        </div>
      )}
    </div>
  )
}
