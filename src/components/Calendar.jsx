import React, { useState } from 'react'
import {
  TODAY, isoLocal, parseDate, fmtDate, relLabel, daysUntil,
  isUrgent, statusById, shiftKindLabel, availById, availLabel, ils,
} from '../data.js'
import { StatusPill, EmpAvatar } from './ui.jsx'
import ShiftEdit from './ShiftEdit.jsx'

const WD = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש']
const MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר']

/* ---------- הפאנל: מה קורה ביום הזה ומי פנוי ---------- */
function DayPanel({ iso, jobs, shifts, employees, availability, onOpen, onAssign }) {
  const daySh = shifts.filter(s => s.date === iso)
    .sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''))

  const availMap = {}
  for (const a of availability) if (a.date === iso) availMap[a.employee_id] = a
  const free = employees.filter(e => availMap[e.id] && availMap[e.id].status !== 'off')
  const off = employees.filter(e => availMap[e.id]?.status === 'off')
  const silent = employees.filter(e => !availMap[e.id])

  return (
    <div className="card" style={{ padding: 14, marginTop: 14 }}>
      <div className="row between gap-2" style={{ marginBottom: 12 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 16 }}>{fmtDate(iso)}</div>
          <div className="t-meta">{relLabel(iso)}</div>
        </div>
        <span className="chip">{daySh.length} משמרות</span>
      </div>

      {/* משמרות היום */}
      {daySh.length === 0 ? (
        <div className="muted" style={{ fontSize: 13, marginBottom: 14 }}>אין משמרות ביום הזה.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          {daySh.map(s => {
            const job = jobs.find(j => j.id === s.job_id)
            const crew = (s.assigned || []).map(id => employees.find(e => e.id === id)).filter(Boolean)
            const filled = crew.length >= (s.need || 1)
            const teardown = s.kind === 'teardown'
            return (
              <div key={s.id} style={{
                background: 'var(--card-2)', border: '1px solid var(--line)', borderRadius: 9, padding: 10,
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <div style={{ flex: 'none', textAlign: 'center', width: 52 }}>
                  <div className="mono" style={{ fontSize: 14, fontWeight: 700 }}>{s.start_time}</div>
                  <div style={{ fontSize: 10.5, fontWeight: 600, color: teardown ? '#E5735B' : 'var(--gold)' }}>
                    {shiftKindLabel(s.kind)}
                  </div>
                </div>
                <div className="grow" style={{ minWidth: 0 }}>
                  <button onClick={() => job && onOpen(job)} style={{
                    appearance: 'none', border: 0, background: 'transparent', padding: 0, cursor: 'pointer',
                    color: 'var(--ink)', font: 'inherit', fontWeight: 600, fontSize: 14, textAlign: 'start',
                  }} className="truncate">{job ? job.title || job.client : 'אירוע'}</button>
                  <div className="row gap-1" style={{ marginTop: 4 }}>
                    {crew.slice(0, 4).map(e => <EmpAvatar key={e.id} name={e.name} size={22} />)}
                    <span className="t-meta" style={{ marginInlineStart: 4 }}>{crew.length}/{s.need || 1}</span>
                  </div>
                </div>
                <button className={filled ? 'btn btn-sm' : 'btn btn-sm btn-solid'} style={{ flex: 'none' }}
                  onClick={() => onAssign(s)}>{filled ? 'ערוך' : 'שבץ'}</button>
              </div>
            )
          })}
        </div>
      )}

      {/* מי פנוי היום */}
      <div className="row between" style={{ marginBottom: 8 }}>
        <div className="t-meta">מי פנוי היום</div>
        <span className="t-meta">{free.length} מתוך {employees.length}</span>
      </div>

      {employees.length === 0 ? (
        <div className="muted" style={{ fontSize: 13 }}>אין עובדים.</div>
      ) : (
        <div className="row wrap gap-2">
          {free.map(e => {
            const a = availMap[e.id]
            const c = availById[a.status]?.color || 'var(--go)'
            return (
              <span key={e.id} className="row gap-2" style={{
                border: `1px solid ${c}`, borderRadius: 999, padding: '4px 10px 4px 4px', background: 'var(--card-2)',
              }}>
                <EmpAvatar name={e.name} size={22} />
                <span style={{ fontSize: 12.5, fontWeight: 600 }}>{e.name}</span>
                <span className="mono" style={{ fontSize: 10.5, color: c }}>{availLabel(a)}</span>
              </span>
            )
          })}
          {free.length === 0 && <span className="muted" style={{ fontSize: 13 }}>אף אחד לא סימן זמינות ליום הזה.</span>}
        </div>
      )}

      {(off.length > 0 || silent.length > 0) && (
        <div className="t-meta" style={{ marginTop: 10, lineHeight: 1.7 }}>
          {off.length > 0 && <div>לא פנויים: {off.map(e => e.name).join(', ')}</div>}
          {silent.length > 0 && <div style={{ color: 'var(--ink25)' }}>לא הגישו: {silent.map(e => e.name).join(', ')}</div>}
        </div>
      )}
    </div>
  )
}

/* ---------- מובייל: סדר-יום ---------- */
function Agenda({ jobs, onOpen, sel, setSel }) {
  const relevant = jobs
    .filter(j => j.eventDate && (daysUntil(j.eventDate) >= 0 || j.status !== 'installed'))
    .sort((a, b) => daysUntil(a.eventDate) - daysUntil(b.eventDate))

  const byDay = []; const idx = {}
  for (const j of relevant) {
    if (idx[j.eventDate] === undefined) { idx[j.eventDate] = byDay.length; byDay.push({ date: j.eventDate, jobs: [] }) }
    byDay[idx[j.eventDate]].jobs.push(j)
  }

  if (byDay.length === 0) {
    return (
      <div className="card only-mobile" style={{ padding: 30, textAlign: 'center', borderStyle: 'dashed', flexDirection: 'column' }}>
        <div className="t-h2" style={{ marginBottom: 4 }}>אין אירועים קרובים</div>
        <div className="muted">אירועים עם תאריך יופיעו כאן.</div>
      </div>
    )
  }

  return (
    <div className="only-mobile" style={{ flexDirection: 'column', gap: 18 }}>
      {byDay.map(({ date, jobs }) => {
        const n = daysUntil(date); const hot = n <= 0
        const on = sel === date
        return (
          <section key={date}>
            <button onClick={() => setSel(date)} style={{
              appearance: 'none', border: 0, background: 'transparent', padding: '0 0 8px', cursor: 'pointer',
              display: 'flex', alignItems: 'baseline', gap: 8, width: '100%', textAlign: 'start',
            }}>
              <span style={{ fontWeight: 700, fontSize: 15, color: on ? 'var(--gold)' : hot ? 'var(--gold)' : 'var(--ink)' }}>
                {fmtDate(date)}
              </span>
              <span className="t-meta">{n < 0 ? `באיחור · ${relLabel(date)}` : relLabel(date)}</span>
              <span className="t-meta" style={{ marginInlineStart: 'auto', color: 'var(--gold)' }}>{on ? '▾' : 'פרטים'}</span>
            </button>
            <div className="card" style={{ overflow: 'hidden' }}>
              {jobs.map((j, i) => (
                <button key={j.id} onClick={() => onOpen(j)} style={{
                  appearance: 'none', border: 0, width: '100%', textAlign: 'start', cursor: 'pointer',
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
                  <div className="mono" style={{ fontWeight: 600, fontSize: 15 }}>{j.price ? ils(j.price) : ''}</div>
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
function MonthGrid({ jobs, onOpen, sel, setSel }) {
  const [cursor, setCursor] = useState(new Date(TODAY.getFullYear(), TODAY.getMonth(), 1))
  const year = cursor.getFullYear(), month = cursor.getMonth()
  const first = new Date(year, month, 1)
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const lead = first.getDay()
  const cells = []
  for (let i = 0; i < lead; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)

  const byDate = {}
  for (const j of jobs) {
    if (!j.eventDate) continue
    const dt = parseDate(j.eventDate)
    if (dt.getFullYear() === year && dt.getMonth() === month) (byDate[dt.getDate()] ||= []).push(j)
  }
  const isoOf = d => isoLocal(new Date(year, month, d))
  const todayIso = isoLocal(TODAY)
  const move = delta => setCursor(new Date(year, month + delta, 1))

  return (
    <div className="only-desktop" style={{ flexDirection: 'column' }}>
      <div className="row between gap-2" style={{ marginBottom: 14 }}>
        <div className="t-h2">{MONTHS[month]} {year}</div>
        <div className="row gap-2">
          <button className="btn btn-sm" onClick={() => move(1)}>‹ הבא</button>
          <button className="btn btn-sm" onClick={() => { setCursor(new Date(TODAY.getFullYear(), TODAY.getMonth(), 1)); setSel(todayIso) }}>היום</button>
          <button className="btn btn-sm" onClick={() => move(-1)}>הקודם ›</button>
        </div>
      </div>
      <div className="card" style={{ padding: 10 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 6 }}>
          {WD.map(w => <div key={w} className="t-meta" style={{ textAlign: 'center', fontWeight: 700 }}>{w}</div>)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
          {cells.map((d, i) => {
            if (!d) return <div key={i} style={{ minHeight: 92 }} />
            const iso = isoOf(d)
            const list = byDate[d] || []
            const isToday = iso === todayIso
            const on = iso === sel
            return (
              <div key={i} onClick={() => setSel(iso)} style={{
                minHeight: 92, borderRadius: 8, padding: 5, cursor: 'pointer',
                background: on ? 'var(--gold-bg)' : 'var(--paper)',
                border: on ? '1.5px solid var(--gold)' : isToday ? '1.5px solid var(--gold-fg)' : '1px solid var(--hair)',
              }}>
                <div className="mono" style={{
                  fontSize: 12, fontWeight: isToday || on ? 700 : 500,
                  color: isToday || on ? 'var(--gold)' : 'var(--ink45)', textAlign: 'end', marginBottom: 3,
                }}>{d}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {list.slice(0, 3).map(j => {
                    const urg = isUrgent(j)
                    const tone = urg ? 'signal' : statusById[j.status]?.tone
                    const bg = tone === 'signal' ? 'var(--signal-bg)' : tone === 'go' ? 'var(--go-bg)' : 'var(--hair)'
                    const fg = tone === 'signal' ? 'var(--gold-fg)' : tone === 'go' ? 'var(--go-fg)' : 'var(--ink70)'
                    return (
                      <button key={j.id} onClick={e => { e.stopPropagation(); onOpen(j) }} title={`${j.title} — ${j.client}`}
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

export default function Calendar({ jobs, shifts = [], employees = [], availability = [], onOpen, onShiftSaved, onShiftDeleted }) {
  const [sel, setSel] = useState(() => isoLocal(TODAY))
  const [shiftEdit, setShiftEdit] = useState(undefined)

  return (
    <div style={{ maxWidth: 1120, margin: '0 auto', padding: 16 }}>
      <div className="only-mobile" style={{ marginBottom: 14 }}>
        <div className="t-h2">אירועים קרובים</div>
      </div>

      <Agenda jobs={jobs} onOpen={onOpen} sel={sel} setSel={setSel} />
      <MonthGrid jobs={jobs} onOpen={onOpen} sel={sel} setSel={setSel} />

      <DayPanel iso={sel} jobs={jobs} shifts={shifts} employees={employees}
        availability={availability} onOpen={onOpen} onAssign={s => setShiftEdit(s)} />

      {shiftEdit !== undefined && (() => {
        const job = jobs.find(j => j.id === shiftEdit?.job_id)
        return (
          <ShiftEdit shift={shiftEdit} jobId={shiftEdit?.job_id} jobDate={job?.eventDate} employees={employees}
            onClose={() => setShiftEdit(undefined)}
            onSaved={s => { onShiftSaved(s); setShiftEdit(undefined) }}
            onDeleted={id => { onShiftDeleted(id); setShiftEdit(undefined) }} />
        )
      })()}
    </div>
  )
}
