// ============================================================
// רשימת ההעמסה של עבודה.
//
// אותו רכיב משרת את שי ואת העובד, בשני מצבים:
//   editable  — שי מוסיף, עורך ומוחק
//   אחרת      — העובד רק מסמן ✓ תוך כדי שהוא מעמיס
//
// הסימון עובר דרך set_loading_done ולא דרך update: עובד רשאי
// לסמן, לא לשנות מה צריך להעמיס.
// ============================================================

import React, { useEffect, useState } from 'react'
import {
  fetchJobLoading, ensureJobLoading, addLoadingItem,
  deleteLoadingItem, setLoadingDone,
} from '../db.js'

// עד שמריצים loading.sql, הטבלה לא קיימת ו-PostgREST מחזיר
// שגיאה באנגלית. עדיף לומר את מה שצריך לעשות.
export const loadingErr = (e) => {
  const s = e?.message || String(e)
  return /schema cache|does not exist|42P01|PGRST202/i.test(s)
    ? 'רשימות ההעמסה עוד לא הותקנו במסד הנתונים (loading.sql).'
    : s
}

// כמות מספרית מקבלת את הפונט החד־רוחבי; מילה כמו "קופסה" לא.
export const qtyCls = (q) => /^[\d.,/ -]+$/.test(String(q)) ? 'mono t-meta' : 't-meta'

const SOURCE = {
  kit:    { label: 'ערכה קבועה', hint: 'עולה על האוטו בכל עבודה' },
  design: { label: 'מהעיצוב',    hint: 'קוליסות וקירות ששויכו לעבודה' },
  manual: { label: 'נוסף ידנית', hint: null },
}

export default function LoadingList({ jobId, editable = false, koolisot = [], compact = false }) {
  const [rows, setRows] = useState(null)      // null = עוד נטען
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [label, setLabel] = useState('')
  const [qty, setQty] = useState('')

  const load = async () => {
    try {
      await ensureJobLoading(jobId)
      setRows(await fetchJobLoading(jobId))
    } catch (e) { setErr(loadingErr(e)); setRows([]) }
  }
  useEffect(() => { if (jobId) load() }, [jobId])

  const toggle = async (row) => {
    // אופטימי: הסימון חייב להרגיש מיידי כשעומדים ליד האוטו
    setRows(rs => rs.map(r => r.id === row.id ? { ...r, done: !r.done } : r))
    try { await setLoadingDone(row.id, !row.done) }
    catch (e) { setErr('הסימון לא נשמר: ' + loadingErr(e)); load() }
  }

  const add = async () => {
    const name = label.trim()
    if (!name) return
    setBusy(true); setErr('')
    try {
      const row = await addLoadingItem({
        job_id: jobId, label: name, qty: qty.trim() || null,
        source: 'manual', sort: 500,
      })
      setRows(rs => [...rs, row]); setLabel(''); setQty('')
    } catch (e) { setErr('ההוספה נכשלה: ' + loadingErr(e)) }
    setBusy(false)
  }

  // אותה ספירה בדיוק כמו בסעיף "תכנון" בכרטיס העבודה. בקיר מסודר
  // parts הם החלקים עצמם ולא הקוליסות, וספירה נאיבית הייתה אומרת
  // לעובד מספר אחר ממה שכתוב שורה מעליו.
  const koolCount = (k) =>
    k.preview?.kind === 'wall' ? `${(k.parts || []).length} קוליסות`
    : k.preview?.kind === 'wall-layout' ? `${(k.preview?.wall?.widths || []).length} קוליסות`
    : `${(k.parts || []).length} חלקים`

  // הקוליסות והקירות ששויכו לעבודה, אלה שעוד לא ברשימה
  const fromDesign = koolisot.filter(k =>
    !rows?.some(r => r.source === 'design' && r.label === k.name))
  const addDesign = async () => {
    setBusy(true); setErr('')
    try {
      const added = []
      for (const k of fromDesign) {
        added.push(await addLoadingItem({
          job_id: jobId, label: k.name,
          qty: koolCount(k),
          source: 'design', sort: 200,
        }))
      }
      setRows(rs => [...rs, ...added])
    } catch (e) { setErr('ההוספה נכשלה: ' + loadingErr(e)) }
    setBusy(false)
  }

  const remove = async (id) => {
    setRows(rs => rs.filter(r => r.id !== id))
    try { await deleteLoadingItem(id) }
    catch (e) { setErr('המחיקה נכשלה: ' + loadingErr(e)); load() }
  }

  if (rows === null) {
    return <div className="t-meta" style={{ padding: 10 }}>טוען רשימת העמסה…</div>
  }

  const doneCount = rows.filter(r => r.done).length
  const groups = ['kit', 'design', 'manual']
    .map(s => [s, rows.filter(r => r.source === s)])
    .filter(([, list]) => list.length)

  return (
    <div>
      <div className="row between" style={{ marginBottom: 8 }}>
        <div className="t-meta">רשימת העמסה</div>
        <div className="t-meta mono">
          {doneCount}/{rows.length}
        </div>
      </div>

      {rows.length > 0 && (
        <div style={{
          height: 4, borderRadius: 2, background: 'var(--hair)',
          marginBottom: 10, overflow: 'hidden',
        }}>
          <div style={{
            height: '100%', width: `${Math.round(doneCount / rows.length * 100)}%`,
            background: doneCount === rows.length ? 'var(--go)' : 'var(--gold)',
            transition: 'width .2s',
          }} />
        </div>
      )}

      {rows.length === 0 && (
        <div className="card" style={{ padding: 14, borderStyle: 'dashed', textAlign: 'center' }}>
          <div style={{ fontWeight: 600 }}>הרשימה ריקה</div>
          <div className="muted" style={{ fontSize: 13 }}>
            {editable ? 'הוסף פריטים למטה, או מלא את הערכה הקבועה בהגדרות.' : 'שי עוד לא הכין רשימה לעבודה הזו.'}
          </div>
        </div>
      )}

      {groups.map(([src, list]) => (
        <div key={src} style={{ marginBottom: 12 }}>
          <div className="t-meta" style={{ marginBottom: 5 }}>
            {SOURCE[src].label}
            {SOURCE[src].hint && <span style={{ opacity: .7 }}> · {SOURCE[src].hint}</span>}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {list.map(r => (
              <div key={r.id} className="row gap-2" style={{
                background: 'var(--card-2)', border: '1px solid var(--line)',
                borderRadius: 8, padding: compact ? '8px 10px' : 10,
                opacity: r.done ? .62 : 1,
              }}>
                <label className="row gap-2 grow" style={{ minWidth: 0, cursor: 'pointer', alignItems: 'center' }}>
                  <input type="checkbox" checked={!!r.done} onChange={() => toggle(r)}
                    style={{ accentColor: 'var(--gold)', width: 22, height: 22, flex: '0 0 auto' }} />
                  <span className="grow truncate" style={{
                    fontWeight: 600, fontSize: 14,
                    textDecoration: r.done ? 'line-through' : 'none',
                  }}>{r.label}</span>
                </label>
                {r.qty && <span className={qtyCls(r.qty)} style={{ flex: '0 0 auto' }}>{r.qty}</span>}
                {editable && (
                  <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)', flex: '0 0 auto' }}
                    onClick={() => remove(r.id)} aria-label="הסר">✕</button>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {editable && (
        <>
          {fromDesign.length > 0 && (
            <button className="btn btn-sm" style={{ width: '100%', marginBottom: 8 }}
              disabled={busy} onClick={addDesign}>
              ＋ הוסף {fromDesign.length} מהעיצוב
            </button>
          )}
          <div className="row gap-2">
            <input className="field" placeholder="תרנים · אלמניה · חולץ בזנטים"
              style={{ flex: 1, minWidth: 0, height: 38 }}
              value={label} onChange={e => setLabel(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') add() }} />
            <input className="field mono" placeholder="כמות" dir="ltr"
              style={{ width: 74, flex: '0 0 auto', height: 38 }}
              value={qty} onChange={e => setQty(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') add() }} />
            <button className="btn btn-solid" style={{ flex: '0 0 auto', height: 38 }}
              disabled={busy || !label.trim()} onClick={add}>הוסף</button>
          </div>
          <div className="t-meta" style={{ marginTop: 6 }}>
            הערכה הקבועה נערכת ב<b>הגדרות ← ערכת העמסה</b>, ומופיעה בכל עבודה.
          </div>
        </>
      )}

      {err && <div style={{ color: 'var(--danger)', fontSize: 12.5, marginTop: 8 }}>{err}</div>}
    </div>
  )
}
