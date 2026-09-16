import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { studioParts, studioBounds } from '../designer/studio-model.js'
import './studio-room.css'

const VIEWS = [['perspective', 'פרספקטיבה'], ['front', 'חזית'], ['side', 'צד'], ['top', 'מבט על']]
const format = v => (Math.round(v * 100) / 100).toLocaleString('he-IL')

export default function StudioRoom({ name, parts, dims, materials, marks, wallView, selection,
  onSelect, onTransform, onUndo, canUndo, onSave, onClose }) {
  const dialog = useRef(null), host = useRef(null), scene = useRef(null)
  const latest = useRef(null)
  const [ready, setReady] = useState(false), [error, setError] = useState('')
  const [mode, setMode] = useState('orbit'), [view, setView] = useState('perspective')
  const [light, setLight] = useState('day'), [grid, setGrid] = useState(true)
  const [person, setPerson] = useState(true), [showMarks, setShowMarks] = useState(false)
  const [rotate, setRotate] = useState(false), [step, setStep] = useState(10)
  const [saving, setSaving] = useState(false), [saveNote, setSaveNote] = useState('')
  latest.current = { parts, dims, materials, marks, isWall: !!wallView, onSelect, onTransform }
  const items = useMemo(() => studioParts(parts, dims, materials), [parts, dims, materials])
  const bounds = useMemo(() => studioBounds(items), [items])
  const chosen = selection?.k != null ? wallView?.groups.find(g => g.k === selection.k)
    : parts.find(p => p.id === selection?.id)
  const editable = !!chosen && (!wallView || selection?.k > 0)
  const title = wallView ? (chosen?.label || 'בחירת קוליסה') : (chosen?.name || 'בחירת חלק')
  const selectOptions = wallView ? wallView.groups.map(g => ({ value: String(g.k), label: `${g.label}${g.width ? ` · ${g.width} ס״מ` : ''}` }))
    : parts.map(p => ({ value: p.id, label: p.name }))

  useEffect(() => {
    const el = dialog.current
    const previous = document.activeElement
    const overflow = document.body.style.overflow
    el.showModal()
    document.body.style.overflow = 'hidden'
    let cancelled = false, instance
    import('../designer/studio-scene.js').then(({ createStudio }) => {
      if (cancelled) return
      try {
        instance = createStudio(host.current, {
          select: value => latest.current.onSelect(value),
          translate: (value, delta) => latest.current.onTransform(value, delta),
          stopRotate: () => setRotate(false),
          error: message => setError(message),
        })
        scene.current = instance
        instance.sync(latest.current)
        setReady(true)
      } catch {
        setError('לא ניתן להפעיל תלת־ממד בדפדפן הזה. נסו דפדפן שתומך ב־WebGL או חזרו למעצב.')
      }
    }).catch(() => {
      if (!cancelled) setError('האולפן לא נטען. בדקו את החיבור לרשת ופתחו אותו שוב.')
    })
    return () => {
      cancelled = true
      instance?.dispose(); scene.current = null
      el.close(); document.body.style.overflow = overflow
      previous?.focus()
    }
  }, [])

  useEffect(() => { scene.current?.sync(latest.current); setSaveNote('') }, [parts, dims, materials, marks, wallView])
  useEffect(() => { scene.current?.select(selection) }, [selection, ready])
  useEffect(() => { scene.current?.mode(mode) }, [mode, ready])
  useEffect(() => {
    scene.current?.setOptions({ light, grid, person, marks: showMarks, rotate })
  }, [light, grid, person, showMarks, rotate, ready])

  const cameraView = value => { setView(value); setRotate(false); scene.current?.setView(value) }
  const shift = delta => { if (editable) onTransform(selection, delta) }
  const save = async () => {
    if (saving) return
    setSaving(true); setSaveNote('')
    try {
      const saved = await onSave()
      setSaveNote(saved?.id ? 'העיצוב נשמר' : 'השמירה לא הושלמה. אפשר לנסות שוב.')
    } catch { setSaveNote('השמירה לא הושלמה. אפשר לנסות שוב.') }
    finally { setSaving(false) }
  }

  return createPortal(
    <dialog ref={dialog} className="studio-room" dir="rtl" aria-labelledby="studio-title"
      onCancel={e => { e.preventDefault(); onClose() }}>
      <header className="studio-header">
        <div className="studio-brand">
          <span className="studio-emblem" aria-hidden="true">◇</span>
          <div><h2 id="studio-title">אולפן תלת־ממד</h2><p>{name || 'העיצוב שלי'}<span> / </span>תכנון בחלל</p></div>
        </div>
        <div className="studio-header-actions">
          <button type="button" onClick={save} disabled={saving || !parts.length} className="studio-save">{saving ? 'שומר…' : 'שמור עיצוב'}</button>
          <button type="button" onClick={onClose} className="studio-close" aria-label="חזרה למעצב">חזרה למעצב <span aria-hidden="true">×</span></button>
        </div>
      </header>

      <div className="studio-workspace">
        <main className="studio-stage">
          <div ref={host} className="studio-canvas" />
          <div className="studio-stage-heading"><span className="studio-live-dot" /> LIVE STUDIO <span className="studio-stage-separator">/</span> 01</div>
          <div className="studio-viewbar" role="group" aria-label="מבט מצלמה">
            {VIEWS.map(([id, label]) => <button key={id} type="button" aria-pressed={view === id} onClick={() => cameraView(id)}>{label}</button>)}
          </div>
          <div className="studio-scale"><b dir="ltr">{format(bounds.size[0])} × {format(bounds.size[1])} × {format(bounds.size[2])}</b><span>רוחב × גובה × עומק · מטר</span></div>
          <div className="studio-zoom" role="group" aria-label="זום">
            <button type="button" aria-label="התקרבות" onClick={() => scene.current?.zoom(0.82)}>+</button>
            <button type="button" aria-label="התאמת העיצוב למסך" onClick={() => cameraView('perspective')}>⌖</button>
            <button type="button" aria-label="התרחקות" onClick={() => scene.current?.zoom(1.22)}>−</button>
          </div>
          <div className="studio-help">{mode === 'edit' ? 'גררו רכיב על הרצפה · בחירה מציגה כלי הזזה וסיבוב' : 'גרירת רקע לסיבוב · גלגלת או צביטה לזום · שתי אצבעות להזזת המבט'}</div>
          {(!ready || error) && <div className="studio-status" role="status"><div><span className="studio-status-icon">◇</span><h3>{error ? 'התצוגה אינה זמינה' : 'מכינים את האולפן…'}</h3><p>{error || 'העיצוב הנוכחי נטען לתוך החדר'}</p>{error && <button onClick={onClose}>חזרה למעצב</button>}</div></div>}
          {ready && !error && !items.length && <div className="studio-status studio-empty"><div><h3>האולפן מוכן לעיצוב שלך</h3><p>הוסיפו קוליסה, קיר או חלק במעצב, ופתחו כאן את התוצאה.</p><button onClick={onClose}>חזרה למעצב</button></div></div>}
        </main>

        <aside className="studio-panel" aria-label="הגדרות האולפן">
          <section className="studio-section">
            <div className="studio-section-title"><span>01</span><h3>עבודה בחלל</h3></div>
            <div className="studio-segment" role="group" aria-label="מצב עבודה">
              <button type="button" aria-pressed={mode === 'orbit'} onClick={() => setMode('orbit')}>סיבוב המבט</button>
              <button type="button" aria-pressed={mode === 'edit'} onClick={() => { setMode('edit'); setRotate(false) }}>הזזת רכיבים</button>
            </div>
            <label className="studio-field">{wallView ? 'קוליסה נבחרת' : 'חלק נבחר'}
              <select value={selection?.k != null ? String(selection.k) : selection?.id || ''}
                onChange={e => onSelect(e.target.value === '' ? null : wallView ? { k: Number(e.target.value) } : { id: e.target.value })}>
                <option value="">בחרו מהחלל או מהרשימה</option>
                {selectOptions.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </label>
            {chosen && <div className="studio-selection"><span className="studio-live-dot" /><b>{title}</b><span>{wallView ? `${chosen.count} חלקים` : 'חלק בודד'}</span></div>}
            {editable && <>
              <label className="studio-field studio-inline">צעד הזזה<select value={step} onChange={e => setStep(Number(e.target.value))}>{[1, 5, 10, 25, 50].map(n => <option key={n} value={n}>{n} ס״מ</option>)}</select></label>
              <div className="studio-nudge" role="group" aria-label="הזזת הרכיב">
                <button onClick={() => shift({ dz: -step })}>אחורה</button>
                <button onClick={() => shift({ dz: step })}>קדימה</button>
                <button onClick={() => shift({ dx: step })}>ימינה</button>
                <button onClick={() => shift({ dx: -step })}>שמאלה</button>
                <button onClick={() => shift({ dy: step })}>הרם ↑</button>
                <button onClick={() => shift({ dy: -step })}>הורד ↓</button>
              </div>
              <div className="studio-segment studio-turn" dir="ltr">
                <button onClick={() => shift({ deg: -15 })} aria-label="סיבוב מינוס 15 מעלות">↶ 15°</button>
                <button onClick={() => shift({ deg: 15 })} aria-label="סיבוב 15 מעלות">15° ↷</button>
              </div>
            </>}
            {selection?.k === 0 && <p className="studio-caption">הקושרות נגזרות מחיבורי הקיר. להזזה בחרו קוליסה.</p>}
            <button type="button" className="studio-undo" onClick={onUndo} disabled={!canUndo}>↶ ביטול השינוי האחרון</button>
          </section>

          <section className="studio-section">
            <div className="studio-section-title"><span>02</span><h3>אווירה ותצוגה</h3></div>
            <div className="studio-lights" role="group" aria-label="תאורת האולפן">
              {[['day', 'אור יום'], ['warm', 'אור חם'], ['night', 'ערב']].map(([id, label]) => <button key={id} aria-pressed={light === id} onClick={() => setLight(id)}><span className={`studio-light-swatch studio-light-${id}`} />{label}</button>)}
            </div>
            <label className="studio-toggle"><span>רשת רצפה <small>כל משבצת = מטר</small></span><input type="checkbox" checked={grid} onChange={e => setGrid(e.target.checked)} /></label>
            <label className="studio-toggle"><span>דמות לקנה מידה <small>גובה 1.70 מ׳</small></span><input type="checkbox" checked={person} onChange={e => setPerson(e.target.checked)} /></label>
            <label className="studio-toggle"><span>סימוני ברגים <small>{marks.length} סימונים</small></span><input type="checkbox" checked={showMarks} onChange={e => setShowMarks(e.target.checked)} /></label>
            <label className="studio-toggle"><span>סיבוב תצוגה אוטומטי</span><input type="checkbox" checked={rotate} onChange={e => { setRotate(e.target.checked); if (e.target.checked) setMode('orbit') }} /></label>
          </section>
          <div className="studio-panel-footer"><span className="studio-live-dot" /><span>מחובר לעיצוב הנוכחי<br /><small>השינויים זמינים גם בחזרה למעצב. לשמירה קבועה לחצו ״שמור עיצוב״.</small></span></div>
          {!!(parts.length - items.length) && <p className="studio-caption" role="status">{parts.length - items.length} חלקים עם נתונים לא תקינים אינם מוצגים. תקנו אותם במעצב.</p>}
          {saveNote && <p className="studio-save-note" role="status">{saveNote}</p>}
        </aside>
      </div>
      <footer className="studio-footer"><span>SHILO <b> / </b> DESIGN STUDIO</span><span>הדמיית סידור וחלקים · הגיבנים מוצגים לפי מודל המעצב הקיים</span></footer>
    </dialog>, document.body)
}
