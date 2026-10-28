// ============================================================
// רשימת ההעמסה של עבודה.
//
// אותו רכיב בשלושה מצבים:
//   editable  — שי מוסיף, עורך ומוחק
//   רגיל      — העובד המשובץ מסמן ✓ תוך כדי שהוא מעמיס
//   readOnly  — צוות הפירוק רואה מה יצא, בלי לגעת בסימונים
//
// הסימון עובר דרך set_loading_done ולא דרך update: עובד רשאי
// לסמן, לא לשנות מה צריך להעמיס.
//
// הקוליסות נזרעות בצד השרת (ensure_job_loading), כי על koolisot
// יש מדיניות "מנהל בלבד" והעובד לא יכול לקרוא את התכנון בעצמו.
// קיר נשבר לשורה לכל קוליסה — מעמיסים קוליסה-קוליסה.
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
  design: { label: 'מהתכנון',    hint: null },
  manual: { label: 'נוסף ידנית', hint: null },
}

// קיבוץ לתצוגה: הערכה הקבועה, אחר כך כל קיר בנפרד תחת שמו,
// ובסוף מה שנוסף ידנית. grp הוא שם הקיר שהשורה מרכיבה.
const groupRows = (rows) => {
  const out = []
  const push = (key, title, hint, list) => { if (list.length) out.push({ key, title, hint, list }) }

  push('kit', SOURCE.kit.label, SOURCE.kit.hint, rows.filter(r => r.source === 'kit'))

  const design = rows.filter(r => r.source === 'design')
  const seen = []
  for (const r of design) {
    const g = r.grp || SOURCE.design.label
    if (!seen.includes(g)) seen.push(g)
  }
  for (const g of seen) {
    const list = design.filter(r => (r.grp || SOURCE.design.label) === g)
    push('d:' + g, g, `${list.length} ${list.length === 1 ? 'פריט' : 'קוליסות'}`, list)
  }

  push('manual', SOURCE.manual.label, SOURCE.manual.hint, rows.filter(r => r.source === 'manual'))
  return out
}

export default function LoadingList({ jobId, editable = false, readOnly = false, compact = false }) {
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
    if (readOnly) return
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

  const remove = async (id) => {
    setRows(rs => rs.filter(r => r.id !== id))
    try { await deleteLoadingItem(id) }
    catch (e) { setErr('המחיקה נכשלה: ' + loadingErr(e)); load() }
  }

  if (rows === null) {
    return <div className="t-meta" style={{ padding: 10 }}>טוען רשימת העמסה…</div>
  }

  const doneCount = rows.filter(r => r.done).length
  const groups = groupRows(rows)

  return (
    <div>
      <div className="row between" style={{ marginBottom: 8 }}>
        <div className="t-meta">{readOnly ? 'מה שיצא לאירוע' : 'רשימת העמסה'}</div>
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

      {groups.map(g => (
        <div key={g.key} style={{ marginBottom: 12 }}>
          <div className="t-meta" style={{ marginBottom: 5 }}>
            {g.title}
            {g.hint && <span style={{ opacity: .7 }}> · {g.hint}</span>}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {g.list.map(r => (
              <div key={r.id} className="row gap-2" style={{
                background: 'var(--card-2)', border: '1px solid var(--line)',
                borderRadius: 8, padding: compact ? '8px 10px' : 10,
                opacity: r.done ? .62 : 1,
              }}>
                <label className="row gap-2 grow" style={{
                  minWidth: 0, cursor: readOnly ? 'default' : 'pointer', alignItems: 'center',
                }}>
                  <input type="checkbox" checked={!!r.done} disabled={readOnly} onChange={() => toggle(r)}
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

      {readOnly && rows.length > 0 && (
        <div className="t-meta">
          הסימונים הם של צוות ההתקנה. בפירוק הרשימה לבדיקה בלבד, כדי שלא יימחק מה שהם סימנו.
        </div>
      )}

      {editable && (
        <>
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
            הקוליסות נכנסות לבד מהתכנון. הערכה הקבועה נערכת ב<b>הגדרות ← ערכת העמסה</b>.
          </div>
        </>
      )}

      {err && <div style={{ color: 'var(--danger)', fontSize: 12.5, marginTop: 8 }}>{err}</div>}
    </div>
  )
}
