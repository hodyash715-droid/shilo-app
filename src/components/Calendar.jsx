import React, { useState } from 'react'
import { TODAY, parseDate, isUrgent, statusById } from '../data.js'

const WD = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש']
const MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר']

export default function Calendar({ jobs, onOpen }) {
  const [cursor, setCursor] = useState(new Date(TODAY.getFullYear(), TODAY.getMonth(), 1))

  const year = cursor.getFullYear(), month = cursor.getMonth()
  const first = new Date(year, month, 1)
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const lead = first.getDay() // 0=ראשון
  const cells = []
  for (let i = 0; i < lead; i++) cells.push(null)
  for (let dnum = 1; dnum <= daysInMonth; dnum++) cells.push(dnum)
  while (cells.length % 7 !== 0) cells.push(null)

  const byDate = {}
  for (const j of jobs) {
    const dt = parseDate(j.eventDate)
    if (dt.getFullYear() === year && dt.getMonth() === month) {
      (byDate[dt.getDate()] ||= []).push(j)
    }
  }

  const isToday = dnum =>
    dnum && year === TODAY.getFullYear() && month === TODAY.getMonth() && dnum === TODAY.getDate()

  const move = delta => setCursor(new Date(year, month + delta, 1))

  return (
    <div style={{ maxWidth: 1120, margin: '0 auto', padding: 16 }}>
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
          {WD.map(w => (
            <div key={w} className="t-meta" style={{ textAlign: 'center', fontWeight: 700 }}>{w}</div>
          ))}
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
                {dnum && (
                  <div className="mono" style={{
                    fontSize: 12, fontWeight: isToday(dnum) ? 700 : 500,
                    color: isToday(dnum) ? 'var(--ink)' : 'var(--ink45)',
                    textAlign: 'end', marginBottom: 3,
                  }}>{dnum}</div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {list.slice(0, 3).map(j => {
                    const urg = isUrgent(j)
                    const tone = urg ? 'signal' : statusById[j.status]?.tone
                    const bg = tone === 'signal' ? 'var(--signal-bg)' : tone === 'go' ? 'var(--go-bg)' : 'var(--hair)'
                    const fg = tone === 'signal' ? 'var(--signal)' : tone === 'go' ? 'var(--go)' : 'var(--ink70)'
                    return (
                      <button key={j.id} onClick={() => onOpen(j)} title={`${j.title} — ${j.client}`}
                        style={{
                          border: 0, cursor: 'pointer', textAlign: 'start',
                          background: bg, color: fg, borderRadius: 4, padding: '2px 5px',
                          fontSize: 11, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
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
