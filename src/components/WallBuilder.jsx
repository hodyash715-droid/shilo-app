// ============================================================
// הרכבת קיר. לא מחשבון — כלי הרכבה.
// מוסיפים קוליסות, מחברים בקושרות, ומקבלים מה יוצא לעבודה:
// מה עולה על הרכב, כמה חיתוכים, וכמה עץ לקנות.
// ============================================================

import React, { useMemo, useState } from 'react'
import { wallProposals, assembleWall } from '../designer/wall.js'
import { LIMITS, KOSHRET } from '../designer/rules.js'
import { LIMITS_PREFERRED, sectionOf } from '../designer/kulisa.js'
import { optimize } from '../designer/cuts.js'
import { TEMPLATES, TEMPLATE_DEFAULTS, FIELD_LABELS, templateById } from '../designer/templates.js'

const uid = () => Math.random().toString(36).slice(2, 10)
const mk = (width, height) => ({ id: uid(), width: String(width ?? ''), height: String(height ?? '') })
const num = (v) => (String(v).trim() === '' ? NaN : Number(v))

export default function WallBuilder({
  materials, material, kerfCm, braces, giben,
  jobs = [], onOpenKulisa, onSaveWall, onNewWall, onShowWall, initial,
}) {
  const [name, setName] = useState(initial?.name || '')
  const [height, setHeight] = useState(initial?.height || 240)
  const [kulisot, setKulisot] = useState(
    initial?.kulisot?.length ? initial.kulisot.map(k => mk(k.width, k.height)) : [mk(120), mk(120)]
  )
  const [overlap, setOverlap] = useState(initial?.overlapCm || KOSHRET.overlapCm)
  const [jobId, setJobId] = useState(initial?.jobId || null)
  const [target, setTarget] = useState(540)
  // גובה לכל קוליסה. כבוי = קיר ישר בגובה אחיד, וזה הרוב המוחלט.
  // דלוק = שער: רגליים גבוהות וכותרת נמוכה מעליהן.
  const [perHeight, setPerHeight] = useState(
    () => !!initial?.kulisot?.some(k => Number(k.height) > 0)
  )
  // התבנית מייצרת את הצורה מראש — רוחבים, גבהים והסידור — כדי שמה
  // שנפתח על המשטח ובאולפן כבר יהיה קרוב למה שרוצים.
  const [tplId, setTplId] = useState(null)
  const [tplVals, setTplVals] = useState({})
  // הסידור שהתבנית קבעה. נשלח יחד עם הקיר, ומתאפס ברגע שנוגעים בשורות.
  const [seedLayout, setSeedLayout] = useState(initial?.layout || null)
  // משקולות שהתבנית קבעה — שקי חול בתוך הרגליים של שער עצמאי
  const [seedBallast, setSeedBallast] = useState(initial?.ballast || null)

  const pickTemplate = (id) => {
    setTplId(id)
    setTplVals(TEMPLATE_DEFAULTS[id] || {})
  }
  const applyTemplate = () => {
    const t = templateById(tplId)
    if (!t) return
    const out = t.build({ ...TEMPLATE_DEFAULTS[tplId], ...tplVals })
    if (!out.rows.length) return
    setKulisot(out.rows.map(r => mk(r.width, r.height)))
    if (out.rows.some(r => r.height)) setPerHeight(true)
    setHeight(out.height)
    setSeedLayout(Object.keys(out.layout).length ? out.layout : null)
    setSeedBallast(out.ballast || null)
    if (!name.trim()) setName(`${t.name} ${out.height}×${out.rows.reduce((a, r) => a + r.width, 0)}`)
    setTplId(null)
  }
  const [view, setView] = useState('build')   // build | cuts | load

  const widths = kulisot.map(k => num(k.width))
  const total = widths.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0)
  // מספר = רוחב בלבד; אובייקט = גם גובה משלו
  const specs = kulisot.map(k => {
    const w = num(k.width)
    const h = perHeight ? num(k.height) : NaN
    return h > 0 ? { width: w, height: h } : w
  })
  const tallest = Math.max(
    Number(height) || 0,
    ...(perHeight ? kulisot.map(k => num(k.height)).filter(h => h > 0) : [0])
  )

  // הרוחב המינימלי שמסגרת יכולה להיבנות בו: שתי אנכיות ועוד משהו ביניהן.
  const minWidth = material ? sectionOf(material)[0] * 2 : 0
  const rowError = (k) => {
    const v = num(k.width)
    if (String(k.width).trim() === '') return 'הזן רוחב'
    if (!Number.isFinite(v) || v <= 0) return 'רוחב חייב להיות חיובי'
    if (v > LIMITS.maxWidth) return `מעל ${LIMITS.maxWidth} — פצל לשתי קוליסות`
    if (v <= minWidth) return `צר מדי למסגרת (מינימום ${minWidth + 1})`
    if (perHeight && String(k.height).trim() !== '') {
      const h = num(k.height)
      if (!Number.isFinite(h) || h <= 0) return 'גובה חייב להיות חיובי'
      if (h > LIMITS.maxHeight) return `גובה ${h} מעל המקסימום (${LIMITS.maxHeight})`
    }
    return null
  }
  const bad = kulisot.filter(k => rowError(k))

  const wall = useMemo(() => {
    if (bad.length || !kulisot.length || !(height > 0) || !material) return null
    return assembleWall(specs, Number(height), { material, materials, braces, giben, overlapCm: overlap })
  }, [JSON.stringify(specs), height, material, materials, braces, giben, overlap, bad.length])

  const plans = useMemo(
    () => (wall ? optimize(wall.rows, materials, {}, kerfCm) : []),
    [wall, materials, kerfCm]
  )

  // סידור של תבנית תקף רק לשורות שהיא יצרה. ברגע שמוסיפים, מוחקים
  // או מזיזים שורה, המספרים מצביעים על קוליסות אחרות — והוא נמחק.
  const dropSeed = () => { setSeedLayout(null); setSeedBallast(null) }
  const set = (id, width) => setKulisot(ks => ks.map(k => k.id === id ? { ...k, width } : k))
  const add = (w) => { dropSeed(); setKulisot(ks => [...ks, mk(w ?? ks.at(-1)?.width ?? 120)]) }
  const dup = (id) => { dropSeed(); setKulisot(ks => {
    const i = ks.findIndex(k => k.id === id)
    return [...ks.slice(0, i + 1), mk(ks[i].width), ...ks.slice(i + 1)]
  }) }
  const del = (id) => { dropSeed(); setKulisot(ks => ks.length > 1 ? ks.filter(k => k.id !== id) : ks) }
  const move = (id, dir) => { dropSeed(); setKulisot(ks => {
    const i = ks.findIndex(k => k.id === id)
    const j = i + dir
    if (j < 0 || j >= ks.length) return ks
    const c = [...ks]
    ;[c[i], c[j]] = [c[j], c[i]]
    return c
  }) }

  const suggest = () => {
    const r = wallProposals(target, height)
    if (!r.ok || !r.proposals.length) return
    dropSeed()
    setKulisot(r.proposals[0].widths.map(w => mk(w)))
  }

  const save = () => {
    if (!wall) return
    onSaveWall?.({
      name: name.trim() || `קיר ${total}×${height}`,
      height: Number(height),
      kulisot: specs.map(sp => (
        typeof sp === 'object' ? { width: sp.width, height: sp.height } : { width: sp }
      )),
      layout: seedLayout,
      ballast: seedBallast,
      overlapCm: overlap,
      totalWidth: total,
      jobId,
    })
  }

  // הפאנל נשאר מחובר גם כשסוגרים אותו, כדי שהקיר לא יאבד במעבר מסך.
  // לכן צריך דרך מפורשת להתחיל מחדש.
  const reset = () => {
    if (kulisot.length > 1 && !confirm('לנקות את הקיר ולהתחיל מחדש?')) return
    setName(''); setHeight(240); setKulisot([mk(120), mk(120)])
    setOverlap(KOSHRET.overlapCm); setJobId(null); setView('build')
    onNewWall?.()
  }

  const tab = (id, label) => (
    <button key={id} className="btn btn-sm" onClick={() => setView(id)} style={{
      flex: 1,
      background: view === id ? 'var(--gold)' : 'var(--card)',
      color: view === id ? 'var(--on-gold)' : 'var(--ink70)',
      borderColor: view === id ? 'var(--gold)' : 'var(--line)',
    }}>{label}</button>
  )

  return (
    <div>
      {/* שם, גובה, עבודה */}
      <div className="row gap-2" style={{ marginBottom: 10 }}>
        <input className="field" value={name} onChange={e => setName(e.target.value)}
          placeholder={`קיר ${total}×${height}`} style={{ fontWeight: 700, flex: 1, minWidth: 0 }} />
        <div style={{ width: 86 }}>
          <input className="field" type="number" dir="ltr" style={{ height: 36 }}
            value={height} onChange={e => setHeight(Number(e.target.value))} />
        </div>
      </div>
      <div className="row gap-2" style={{ marginBottom: 12 }}>
        <span className="t-meta" style={{ flex: '0 0 auto' }}>עבודה</span>
        <select className="field" value={jobId || ''} onChange={e => setJobId(e.target.value || null)}
          style={{ height: 34, flex: 1, minWidth: 0 }}>
          <option value="">— לא משויך —</option>
          {jobs.map(j => <option key={j.id} value={j.id}>{j.title}</option>)}
        </select>
      </div>

      {/* תצוגת הקיר */}
      <div className="row" style={{ gap: 2, height: 46, marginBottom: 4 }} dir="ltr">
        {kulisot.map((k, i) => {
          const w = Number(k.width) || 0
          const ok = w > 0 && w <= LIMITS.maxWidth
          return (
            <React.Fragment key={k.id}>
              {i > 0 && (
                <span title={`קושרת × ${KOSHRET.perJoint}`} style={{
                  width: 5, background: 'var(--go)', borderRadius: 2, flex: '0 0 auto',
                }} />
              )}
              <span style={{
                flex: Math.max(w, 20), minWidth: 0, display: 'grid', placeItems: 'center',
                background: ok ? 'var(--gold)' : 'var(--danger)',
                color: ok ? 'var(--on-gold)' : '#fff',
                fontSize: 11, fontWeight: 700, borderRadius: 3,
              }}>{i + 1}</span>
            </React.Fragment>
          )
        })}
      </div>
      <div className="t-meta" style={{ marginBottom: 12 }}>
        <span className="mono">{total}</span> ס״מ רוחב ·{' '}
        <span className="mono">{wall ? wall.kulisot.length : kulisot.length}</span> קוליסות
        {(wall ? wall.connections.length : kulisot.length - 1) === 1 && <> · תפר אחד</>}
        {(wall ? wall.connections.length : kulisot.length - 1) > 1 &&
          <> · <span className="mono">{wall ? wall.connections.length : kulisot.length - 1}</span> תפרים</>}
        {wall && <> · <span className="mono">{wall.koshret.count}</span> קושרות של <span className="mono">{wall.koshret.lengthCm}</span></>}
        {perHeight && tallest > Number(height) && <> · גובה עד <span className="mono">{tallest}</span></>}
        <br />לכל קוליסה: <span className="mono">{braces}</span> חיזוקים · גיבן {giben ? 'כן' : 'לא'} — נקבע במסך הקוליסה
      </div>

      {/* תבניות: הצורה מוכנה לפני שנכנסים למשטח ולאולפן */}
      <div className="card" style={{ padding: 11, marginBottom: 12, background: 'var(--bg2, var(--card))' }}>
        <div className="t-meta" style={{ marginBottom: 7 }}>התחל מצורה מוכנה</div>
        <div className="row gap-2 wrap">
          {TEMPLATES.map(t => (
            <button key={t.id} className="btn btn-sm" onClick={() => pickTemplate(t.id)}
              style={{
                minHeight: 34,
                background: tplId === t.id ? 'var(--gold-bg)' : 'var(--card)',
                color: tplId === t.id ? 'var(--gold-fg)' : 'var(--ink70)',
                borderColor: tplId === t.id ? 'var(--gold)' : 'var(--line)',
              }}>{t.name}</button>
          ))}
        </div>
        {tplId && (() => {
          const t = templateById(tplId)
          return (
            <div style={{ marginTop: 10, borderTop: '1px solid var(--line)', paddingTop: 10 }}>
              <div className="t-meta" style={{ marginBottom: 7 }}>{t.hint}</div>
              {(() => {
                // אזהרה לפני הלחיצה עדיפה על שגיאה אחריה
                const w = t.build({ ...TEMPLATE_DEFAULTS[tplId], ...tplVals })?.warning
                return w ? (
                  <div style={{ color: 'var(--warn-fg)', fontSize: 12, marginBottom: 8, lineHeight: 1.6 }}>
                    ⚠ {w}
                  </div>
                ) : null
              })()}
              <div style={{ display: 'grid', gap: 7 }}>
                {t.fields.map(f => (
                  <div key={f} className="row gap-2">
                    <span className="t-meta" style={{ flex: '0 0 84px' }}>{FIELD_LABELS[f]}</span>
                    <input className="field mono" type="number" inputMode="decimal" dir="ltr"
                      style={{ height: 34, flex: 1, minWidth: 0 }}
                      value={tplVals[f] ?? TEMPLATE_DEFAULTS[tplId][f] ?? ''}
                      onChange={e => setTplVals(v => ({ ...v, [f]: Number(e.target.value) }))} />
                    <span className="t-meta" style={{ flex: '0 0 auto' }}>ס״מ</span>
                  </div>
                ))}
              </div>
              <div className="row gap-2" style={{ marginTop: 10 }}>
                <button className="btn btn-solid grow" onClick={applyTemplate}>בנה {t.name}</button>
                <button className="btn" onClick={() => setTplId(null)}>ביטול</button>
              </div>
            </div>
          )
        })()}
      </div>

      <div className="row gap-2" style={{ marginBottom: 12 }}>
        {tab('build', 'הרכבה')}
        {tab('cuts', 'חיתוך וקנייה')}
        {tab('load', 'העמסה')}
      </div>

      {/* ---------- הרכבה ---------- */}
      {view === 'build' && (
        <>
          <div className="row between" style={{ marginBottom: 7 }}>
            <span className="t-meta">{perHeight ? 'רוחב וגובה לכל קוליסה' : 'רוחב לכל קוליסה'}</span>
            <button className="btn btn-sm" onClick={() => setPerHeight(v => !v)}
              title="גובה שונה לכל קוליסה — כך בונים שער"
              style={{
                background: perHeight ? 'var(--gold-bg)' : 'var(--card)',
                color: perHeight ? 'var(--gold-fg)' : 'var(--ink45)',
                borderColor: perHeight ? 'var(--gold)' : 'var(--line)',
              }}>⇕ גבהים שונים</button>
          </div>
          <div style={{ display: 'grid', gap: 6, marginBottom: 10 }}>
            {kulisot.map((k, i) => {
              const err = rowError(k)
              return (
                <div key={k.id}>
                <div className="row gap-2">
                  <span className="mono t-meta" style={{ width: 18, flex: '0 0 auto' }}>{i + 1}</span>
                  <input className="field mono" type="number" inputMode="decimal" dir="ltr"
                    placeholder="רוחב"
                    style={{ height: 34, flex: 1, minWidth: 0, borderColor: err ? 'var(--danger)' : undefined }}
                    value={k.width} onChange={e => set(k.id, e.target.value)} />
                  {perHeight && (
                    <input className="field mono" type="number" inputMode="decimal" dir="ltr"
                      placeholder={String(height)} title="גובה הקוליסה"
                      style={{ height: 34, flex: 1, minWidth: 0, borderColor: err ? 'var(--danger)' : undefined }}
                      value={k.height}
                      onChange={e => setKulisot(ks => ks.map(x => x.id === k.id ? { ...x, height: e.target.value } : x))} />
                  )}
                  <span className="row gap-1" dir="ltr" style={{ flex: '0 0 auto' }}>
                    <button className="btn btn-sm" title="הזז שמאלה" style={{ minWidth: 38 }}
                      onClick={() => move(k.id, -1)} disabled={i === 0}>‹</button>
                    <button className="btn btn-sm" title="הזז ימינה" style={{ minWidth: 38 }}
                      onClick={() => move(k.id, +1)} disabled={i === kulisot.length - 1}>›</button>
                  </span>
                  <button className="btn btn-sm" title="שכפל" style={{ minWidth: 38 }} onClick={() => dup(k.id)}>⧉</button>
                  <button className="btn btn-sm" title="מחק" style={{ color: 'var(--danger)', minWidth: 38 }}
                    onClick={() => del(k.id)} disabled={kulisot.length === 1}>✕</button>
                </div>
                {err && <div style={{ color: 'var(--danger)', fontSize: 12, margin: '3px 0 0 26px' }}>{err}</div>}
                </div>
              )
            })}
          </div>

          <div className="row gap-2 wrap" style={{ marginBottom: 12 }}>
            <button className="btn btn-sm" onClick={() => add()}>＋ קוליסה</button>
            {LIMITS_PREFERRED.map(w => (
              <button key={w} className="btn btn-sm" onClick={() => add(w)}>＋<span className="mono">{w}</span></button>
            ))}
          </div>

          <div className="card" style={{ padding: 10, marginBottom: 12 }}>
            <div className="t-meta" style={{ marginBottom: 6 }}>לא בטוח בחלוקה? תן מידה ואציע</div>
            <div className="row gap-2">
              <input className="field mono" type="number" dir="ltr" style={{ height: 34, flex: 1, minWidth: 0 }}
                value={target} onChange={e => setTarget(Number(e.target.value))} />
              <button className="btn btn-sm" onClick={suggest}>הצע חלוקה</button>
            </div>
          </div>

          <div className="t-meta" style={{ marginBottom: 6 }}>
            חפיפת הקושרת על כל קוליסה — שי נקב בטווח {KOSHRET.overlapRange[0]}–{KOSHRET.overlapRange[1]}
          </div>
          <div className="row gap-2 wrap" style={{ marginBottom: 6 }}>
            {[20, 25, 30, 35, 40].map(o => (
              <button key={o} className="btn btn-sm" onClick={() => setOverlap(o)} style={{
                background: overlap === o ? 'var(--gold)' : 'var(--card)',
                color: overlap === o ? 'var(--on-gold)' : 'var(--ink70)',
                borderColor: overlap === o ? 'var(--gold)' : 'var(--line)',
              }}><span className="mono">{o}</span></button>
            ))}
            <span className="t-meta" style={{ alignSelf: 'center' }}>⇐ קושרת <span className="mono">{overlap * 2}</span> ס״מ</span>
          </div>
        </>
      )}

      {/* ---------- חיתוך וקנייה ---------- */}
      {view === 'cuts' && (wall ? (
        <div>
          <div className="row gap-2 wrap" style={{ marginBottom: 8 }}>
            {wall.rows.map(r => (
              <span key={`${r.invId}-${r.len}`} className="chip">
                <span className="mono">{r.qty}× {r.len}</span>
              </span>
            ))}
          </div>
          <div className="t-meta" style={{ marginBottom: 10 }}>
            <span className="mono">{wall.totalCuts}</span> חיתוכים · כולל <span className="mono">{wall.koshret.count}</span> קושרות
          </div>
          {plans.map(p => (
            <div key={p.key} className="card" style={{ padding: 10, marginBottom: 6 }}>
              <div style={{ fontWeight: 700, fontSize: 13 }}>{p.mat}</div>
              <div className="t-meta">
                <b className="mono">{p.barCount}× {p.stock}</b> ס״מ · סה״כ{' '}
                <span className="mono">{p.barCount * p.stock}</span> · פחת {p.wastePct}%
              </div>
            </div>
          ))}
        </div>
      ) : <p className="t-meta">תקן את המידות כדי לראות חיתוך.</p>)}

      {/* ---------- העמסה ---------- */}
      {view === 'load' && (wall ? (
        <div style={{ display: 'grid', gap: 6 }}>
          {wall.loading.map((l, i) => (
            <div key={i} className="row between gap-2" style={{
              padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 8,
            }}>
              <span className="row gap-2">
                <span className="mono" style={{ fontWeight: 700 }}>{l.qty}×</span>
                <span>{l.label}</span>
              </span>
              <span className="t-meta mono">{l.detail}</span>
            </div>
          ))}
          <div className="t-meta" style={{ marginTop: 4 }}>
            סך הכול <span className="mono">{wall.loading.reduce((s, l) => s + l.qty, 0)}</span> פריטים לרכב.
            ברגים, כלים ומשקולות לא נספרים — הכללים שלהם עדיין לא הוגדרו.
          </div>
        </div>
      ) : <p className="t-meta">תקן את המידות כדי לראות העמסה.</p>)}

      {/* ---------- שגיאות ופעולות ---------- */}
      {bad.length > 0 && (
        <div style={{ color: 'var(--danger)', fontSize: 13, fontWeight: 700, marginTop: 10 }}>
          ✖ {bad.length === 1 ? 'קוליסה אחת עם מידה לא תקינה' : `${bad.length} קוליסות עם מידה לא תקינה`} — תקן כדי לראות חיתוך והעמסה
        </div>
      )}
      {wall?.warnings.map(w => (
        <div key={w} style={{ color: 'var(--warn-fg)', fontSize: 12, marginTop: 6 }}>⚠ {w}</div>
      ))}

      <div className="row gap-2" style={{ marginTop: 12 }}>
        <button className="btn btn-solid grow" disabled={!wall}
          onClick={() => onShowWall?.(specs, Number(height), overlap, seedLayout, seedBallast)}>
          🏗️ הצג את הקיר על המשטח
        </button>
      </div>
      <div className="row gap-2" style={{ marginTop: 8 }}>
        <button className="btn grow" onClick={save} disabled={!wall}>💾 שמור קיר</button>
        <button className="btn" onClick={reset}>קיר חדש</button>
      </div>

      {wall && (
        <>
          <div className="t-meta" style={{ margin: '12px 0 5px' }}>או קוליסה בודדת בלבד, לעריכה</div>
          <div className="row gap-2 wrap">
            {wall.kulisot.map(k => (
              <button key={k.index} className="btn btn-sm"
                onClick={() => onOpenKulisa?.(k.width, k.index, k.height || Number(height))}>
                {k.index} · <span className="mono">{k.width}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
