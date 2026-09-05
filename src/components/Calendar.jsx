import React, { useState } from 'react'
import { TODAY, parseDate, isUrgent, statusById, fmtDate, relLabel, daysUntil, ils } from '../data.js'
import { StatusPill } from './ui.jsx'

const WD = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש']
const MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר']

/* ---------- מובייל: תצוגת סדר-יום ---------- */
function Agenda({ jobs, onOpen }) {
  // קדימה בזמן: היום והלאה, וגם אירועים שעברו אך לא הותקנו (באיחור)
  const relevant = jobs
    .filter(j => j.eventDate && (daysUntil(j.eventDate) >= 0 || j.status !== 'installed'))
    .sort((a, b) => daysUntil(a.eventDate) - daysUntil(b.eventDate))

  // קיבוץ לפי יום
  const byDay = []
  const idx = {}
  for (const j of relevant) {
    if (idx[j.eventDate] === undefined) { idx[j.eventDate] = byDay.length; byDay.push({ date: j.eventDate, jobs: [] }) }
    byDay[idx[j.eventDate]].jobs.push(j)
  }

  if (byDay.length === 0) {
    return (
      <div className="card" style={{ padding: 36, textAlign: 'center', borderStyle: 'dashed' }}>
        <div className="t-h2" style={{ marginBottom: 4 }}>אין אירועים קרובים</div>
        <div className="muted">אירועים עם תאריך יופיעו כאן לפי סדר.</div>
      </div>
    )
  }

  return (
    <div className="only-mobile" style={{ flexDirection: 'column', gap: 18 }}>
      {byDay.map(({ date, jobs }) => {
        const n = daysUntil(date)
        const hot = n < 0 || n === 0
        return (
          <section key={date}>
            <div className="row gap-2" style={{ marginBottom: 8, alignItems: 'baseline' }}>
              <span style={{ fontWeight: 700, fontSize: 15, color: hot ? 'var(--gold)' : 'var(--ink)' }}>{fmtDate(date)}</span>
              <span className="t-meta">{n < 0 ? `באיחור · ${relLabel(date)}` : relLabel(date)}</span>
            </div>
            <div className="card" style={{ overflow: 'hidden' }}>
              {jobs.map((j, i) => (
                <button key={j.id} onClick={() => onOpen(j)} style={{
                  appearance: 'none', border: 0, width: '100%', cursor: 'pointer', textAlign: 'start',
                  background: 'transparent', color: 'var(--ink)', font: 'inherit',
                  padding: 13, display: 'flex', alignItems: 'center', gap: 10,
                  borderTop: i ? '1px solid var(--hair)' : 0,
                }}>
                  <div className="grow" style={{ minWidth: 0 }}>
                    <div className="row gap-2" style={{ marginBottom: 3 }}>
                      <StatusPill id={j.status} size="sm" />
                      {isUrgent(j) && <span className="chip chip-signal" style={{ height: 22, fontSize: 11 }}><span className="chip-dot" />דחוף</span>}
                    </div>
                    <div style={{ fontWeight: 600, fontSize: 15 }} className="truncate">{j.title || '—'}</div>
                    <div className="t-meta">{j.client}</div>
                  </div>
                  <div className="mono" style={{ fontWeight: 600, fontSize: 15 }}>
                    {j.price ? ils(j.price) : ''}
                  </div>
                </button>
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}

/* ---------- דסקטופ: רשת חודשית ---------- */
function MonthGrid({ jobs, onOpen }) {
  const [cursor, setCursor] = useState(new Date(TODAY.getFullYear(), TODAY.getMonth(), 1))
  const year = cursor.getFullYear(), month = cursor.getMonth()
  const first = new Date(year, month, 1)
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const lead = first.getDay()
  const cells = []
  for (let i = 0; i < lead; i++) cells.push(null)
  for (let dnum = 1; dnum <= daysInMonth; dnum++) cells.push(dnum)
  while (cells.length % 7 !== 0) cells.push(null)

  const byDate = {}
  for (const j of jobs) {
    if (!j.eventDate) continue
    const dt = parseDate(j.eventDate)
    if (dt.getFullYear() === year && dt.getMonth() === month) (byDate[dt.getDate()] ||= []).push(j)
  }
  const isToday = dnum => dnum && year === TODAY.getFullYear() && month === TODAY.getMonth() && dnum === TODAY.getDate()
  const move = delta => setCursor(new Date(year, month + delta, 1))

  return (
    <div className="only-desktop" style={{ flexDirection: 'column' }}>
      <div className="row between gap-2" style={{ marginBottom: 14 }}>
        <div className="t-h2">{MONTHS[month]} {year}</div>
        <div className="row gap-2">
          <button className="btn btn-sm" onClick={() => move(1)}>‹ הבא</button>
          <button className="btn btn-sm" onClick={() => setCursor(new Date(TODAY.getFullYear(), TODAY.getMonth(), 1))}>היום</button>
          <button className="btn btn-sm" onClick={() => move(-1)}>הקודם ›</button>
        </div>
      </div>
      <div className="card" style={{ padding: 10 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 6 }}>
          {WD.map(w => <div key={w} className="t-meta" style={{ textAlign: 'center', fontWeight: 700 }}>{w}</div>)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
          {cells.map((dnum, i) => {
            const list = dnum ? (byDate[dnum] || []) : []
            return (
              <div key={i} style={{
                minHeight: 92, borderRadius: 8, padding: 5,
                background: dnum ? 'var(--paper)' : 'transparent',
                border: isToday(dnum) ? '1.5px solid var(--gold)' : dnum ? '1px solid var(--hair)' : '1px solid transparent',
              }}>
                {dnum && <div className="mono" style={{ fontSize: 12, fontWeight: isToday(dnum) ? 700 : 500, color: isToday(dnum) ? 'var(--gold)' : 'var(--ink45)', textAlign: 'end', marginBottom: 3 }}>{dnum}</div>}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {list.slice(0, 3).map(j => {
                    const urg = isUrgent(j)
                    const tone = urg ? 'signal' : statusById[j.status]?.tone
                    const bg = tone === 'signal' ? 'var(--signal-bg)' : tone === 'go' ? 'var(--go-bg)' : 'var(--hair)'
                    const fg = tone === 'signal' ? 'var(--gold-fg)' : tone === 'go' ? 'var(--go-fg)' : 'var(--ink70)'
                    return (
                      <button key={j.id} onClick={() => onOpen(j)} title={`${j.title} — ${j.client}`}
                        style={{ border: 0, cursor: 'pointer', textAlign: 'start', background: bg, color: fg, borderRadius: 4, padding: '2px 5px', fontSize: 11, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {j.client}
                      </button>
                    )
                  })}
                  {list.length > 3 && <span className="t-meta">+{list.length - 3} נוספים</span>}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default function Calendar({ jobs, onOpen }) {
  return (
    <div style={{ maxWidth: 1120, margin: '0 auto', padding: 16 }}>
      <div className="only-mobile" style={{ marginBottom: 14 }}>
        <div className="t-h2">אירועים קרובים</div>
      </div>
      <Agenda jobs={jobs} onOpen={onOpen} />
      <MonthGrid jobs={jobs} onOpen={onOpen} />
    </div>
  )
}
