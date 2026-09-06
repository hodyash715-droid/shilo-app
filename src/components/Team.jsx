import React, { useState } from 'react'
import { AVAIL, availById, TODAY, isoLocal, parseDate, fmtDate, relLabel, shiftKindLabel } from '../data.js'
import { EmpAvatar } from './ui.jsx'
import ShiftEdit from './ShiftEdit.jsx'

const WD = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש']
const startOfWeek = (d) => { const x = new Date(d); x.setDate(x.getDate() - x.getDay()); x.setHours(0, 0, 0, 0); return x }

export default function Team({ employees, shifts, jobs, availability, onSetAvail, onShiftSaved, onShiftDeleted }) {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(TODAY))
  const [picker, setPicker] = useState(null)   // {empId, date, name}
  const [shiftEdit, setShiftEdit] = useState(undefined)

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart); d.setDate(d.getDate() + i); return d
  })
  const dayIso = days.map(isoLocal)
  const todayIso = isoLocal(TODAY)

  const availMap = {}
  for (const a of availability) availMap[`${a.employee_id}|${a.date}`] = a.status

  // משמרות שחסר בהן צוות
  const understaffed = shifts
    .filter(s => (s.assigned?.length || 0) < (s.need || 1))
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''))

  const move = (n) => { const d = new Date(weekStart); d.setDate(d.getDate() + n * 7); setWeekStart(d) }
  const rangeLabel = `${days[0].getDate()}.${days[0].getMonth() + 1} – ${days[6].getDate()}.${days[6].getMonth() + 1}`

  const sectionTitle = (t, extra) => (
    <div className="row between" style={{ marginBottom: 10 }}>
      <div className="row gap-2">
        <span style={{ width: 4, height: 18, background: 'var(--gold)', borderRadius: 2 }} />
        <span style={{ fontWeight: 700, fontSize: 16 }}>{t}</span>
      </div>
      {extra}
    </div>
  )

  const NAME_W = 108, CELL_W = 74

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: 16 }}>
      {/* משמרות שחסר בהן צוות */}
      {sectionTitle('משמרות שחסר בהן צוות', <span className="t-meta">{understaffed.length}</span>)}
      {understaffed.length === 0 ? (
        <div className="card" style={{ padding: 22, textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontWeight: 600 }}>כל המשמרות מאוישות 🎯</div>
        </div>
      ) : (
        <div className="card" style={{ overflow: 'hidden', marginBottom: 24 }}>
          {understaffed.slice(0, 8).map((s, i) => {
            const job = jobs.find(j => j.id === s.job_id)
            const missing = (s.need || 1) - (s.assigned?.length || 0)
            return (
              <div key={s.id} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: 12,
                borderTop: i ? '1px solid var(--hair)' : 0,
                borderInlineStart: '3px solid var(--gold)',
              }}>
                <div style={{ flex: 'none', textAlign: 'center', width: 48 }}>
                  <div className="mono" style={{ fontSize: 14, fontWeight: 700 }}>{s.start_time}</div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink45)' }}>{shiftKindLabel(s.kind)}</div>
                </div>
                <div className="grow" style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }} className="truncate">{job ? job.title || job.client : 'עבודה'}</div>
                  <div className="t-meta">{fmtDate(s.date)} · <span style={{ color: '#E5735B', fontWeight: 600 }}>חסרים {missing}</span></div>
                </div>
                <button className="btn btn-sm btn-solid" style={{ flex: 'none' }} onClick={() => setShiftEdit(s)}>שבץ</button>
              </div>
            )
          })}
        </div>
      )}

      {/* זמינות ושיבוץ */}
      {sectionTitle('זמינות ושיבוץ', (
        <div className="row gap-2">
          <button className="btn btn-sm" onClick={() => move(1)}>‹</button>
          <span className="t-meta mono">{rangeLabel}</span>
          <button className="btn btn-sm" onClick={() => move(-1)}>›</button>
        </div>
      ))}

      {/* מקרא */}
      <div className="row wrap gap-3" style={{ marginBottom: 10 }}>
        {AVAIL.map(a => (
          <span key={a.id} className="row gap-2" style={{ fontSize: 11.5, color: 'var(--ink45)' }}>
            <span style={{ width: 12, height: 8, borderRadius: 2, background: a.color }} />{a.label}
          </span>
        ))}
      </div>

      {employees.length === 0 ? (
        <div className="card" style={{ padding: 24, textAlign: 'center', borderStyle: 'dashed' }}>
          <div style={{ fontWeight: 600 }}>אין עובדים</div>
          <div className="muted" style={{ fontSize: 13 }}>הוסף עובדים בהגדרות ← ניהול עובדים.</div>
        </div>
      ) : (
        <div className="card" style={{ overflowX: 'auto' }}>
          <div style={{ minWidth: NAME_W + CELL_W * 7 }}>
            {/* כותרת ימים */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--line)' }}>
              <div style={{ width: NAME_W, flex: 'none', position: 'sticky', insetInlineStart: 0, background: 'var(--card)', zIndex: 2 }} />
              {days.map((d, i) => (
                <div key={i} style={{
                  width: CELL_W, flex: 'none', textAlign: 'center', padding: '8px 2px',
                  background: dayIso[i] === todayIso ? 'var(--gold-bg)' : 'transparent',
                }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: dayIso[i] === todayIso ? 'var(--gold)' : 'var(--ink45)' }}>{WD[d.getDay()]}</div>
                  <div className="mono" style={{ fontSize: 12, color: dayIso[i] === todayIso ? 'var(--gold)' : 'var(--ink70)' }}>{d.getDate()}.{d.getMonth() + 1}</div>
                </div>
              ))}
            </div>

            {/* שורות עובדים */}
            {employees.map((e, r) => {
              const submitted = dayIso.some(d => availMap[`${e.id}|${d}`])
              return (
                <div key={e.id} style={{ display: 'flex', borderTop: r ? '1px solid var(--hair)' : 0 }}>
                  <div style={{
                    width: NAME_W, flex: 'none', padding: 8, position: 'sticky', insetInlineStart: 0,
                    background: 'var(--card)', zIndex: 2, borderInlineEnd: '1px solid var(--hair)',
                    display: 'flex', alignItems: 'center', gap: 7,
                  }}>
                    <EmpAvatar name={e.name} size={26} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 600 }} className="truncate">{e.name}</div>
                      <div style={{ fontSize: 10, color: submitted ? 'var(--go)' : 'var(--ink25)' }}>
                        {submitted ? 'הגיש זמינות' : 'לא הגיש'}
                      </div>
                    </div>
                  </div>

                  {dayIso.map((iso, c) => {
                    const st = availMap[`${e.id}|${iso}`]
                    const a = st ? availById[st] : null
                    const daySh = shifts.filter(s => s.date === iso && (s.assigned || []).includes(e.id))
                    return (
                      <button key={c} onClick={() => setPicker({ empId: e.id, date: iso, name: e.name })}
                        style={{
                          width: CELL_W, flex: 'none', appearance: 'none', border: 0, cursor: 'pointer',
                          background: iso === todayIso ? 'rgba(238,196,33,.05)' : 'transparent',
                          padding: 5, display: 'flex', flexDirection: 'column', gap: 3, minHeight: 56,
                          borderInlineEnd: '1px solid var(--hair)',
                        }}>
                        <div style={{ height: 5, borderRadius: 3, background: a ? a.color : 'var(--hair)' }} />
                        {daySh.map(s => (
                          <span key={s.id} className="mono" style={{
                            fontSize: 9.5, fontWeight: 700, borderRadius: 3, padding: '2px 3px',
                            background: s.kind === 'teardown' ? 'rgba(201,122,43,.22)' : 'var(--gold-bg)',
                            color: s.kind === 'teardown' ? '#E0954A' : 'var(--gold-fg)',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>{s.start_time}</span>
                        ))}
                      </button>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="t-meta" style={{ textAlign: 'center', marginTop: 12 }}>
        הקש על תא כדי לקבוע זמינות. בהמשך העובדים יגישו זמינות בעצמם.
      </div>

      {/* בוחר זמינות */}
      {picker && (
        <div onClick={() => setPicker(null)} style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} className="card" style={{ width: 'min(420px,100%)', margin: 12, padding: 16, borderRadius: 16 }}>
            <div style={{ fontWeight: 700, marginBottom: 2 }}>{picker.name}</div>
            <div className="t-meta" style={{ marginBottom: 14 }}>{fmtDate(picker.date)}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {AVAIL.map(a => (
                <button key={a.id} className="btn" style={{ justifyContent: 'flex-start', gap: 10, height: 46 }}
                  onClick={() => { onSetAvail(picker.empId, picker.date, a.id); setPicker(null) }}>
                  <span style={{ width: 14, height: 14, borderRadius: 4, background: a.color, flex: 'none' }} />
                  {a.label}
                </button>
              ))}
              <button className="btn btn-sm" style={{ color: 'var(--ink45)' }}
                onClick={() => { onSetAvail(picker.empId, picker.date, null); setPicker(null) }}>נקה</button>
            </div>
          </div>
        </div>
      )}

      {shiftEdit !== undefined && (() => {
        const job = jobs.find(j => j.id === shiftEdit?.job_id)
        return (
          <ShiftEdit shift={shiftEdit} jobId={shiftEdit?.job_id} jobDate={job?.eventDate} employees={employees}
            onClose={() => setShiftEdit(undefined)}
            onSaved={(s) => { onShiftSaved(s); setShiftEdit(undefined) }}
            onDeleted={(id) => { onShiftDeleted(id); setShiftEdit(undefined) }} />
        )
      })()}
    </div>
  )
}
