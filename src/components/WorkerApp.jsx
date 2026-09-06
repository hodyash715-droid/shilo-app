import React, { useState } from 'react'
import { TODAY, isoLocal, fmtDate, relLabel, availById, availLabel, shiftKindLabel, daysUntil } from '../data.js'
import { EmpAvatar } from './ui.jsx'
import AvailPicker from './AvailPicker.jsx'

const DAYS_AHEAD = 28

export default function WorkerApp({ me, jobs, shifts, availability, onSetAvail, onSignOut }) {
  const [tab, setTab] = useState('avail')
  const [picker, setPicker] = useState(null)

  const days = Array.from({ length: DAYS_AHEAD }, (_, i) => {
    const d = new Date(TODAY); d.setDate(d.getDate() + i); return d
  })
  const availMap = {}
  for (const a of availability) if (a.employee_id === me.id) availMap[a.date] = a

  const myShifts = shifts
    .filter(s => (s.assigned || []).includes(me.id) && s.date && daysUntil(s.date) >= -1)
    .sort((a, b) => (a.date || '').localeCompare(b.date || '') || (a.start_time || '').localeCompare(b.start_time || ''))

  const submittedCount = days.filter(d => availMap[isoLocal(d)]).length

  const segBtn = (id, label, badge) => (
    <button onClick={() => setTab(id)} className="btn" style={{
      flex: 1, height: 40, borderRadius: 999,
      background: tab === id ? 'var(--gold)' : 'transparent',
      color: tab === id ? 'var(--on-gold)' : 'var(--ink45)',
      borderColor: 'transparent',
    }}>{label}{badge ? ` (${badge})` : ''}</button>
  )

  return (
    <div style={{ minHeight: '100%', paddingBottom: 30 }}>
      {/* כותרת */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 20,
        background: 'color-mix(in srgb, var(--paper) 88%, transparent)',
        backdropFilter: 'blur(8px)', borderBottom: '1px solid var(--line)',
      }}>
        <div style={{ maxWidth: 620, margin: '0 auto', padding: '10px 16px' }} className="row between gap-3">
          <div className="row gap-3" style={{ minWidth: 0 }}>
            <EmpAvatar name={me.name} size={40} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 16, lineHeight: 1.1 }} className="truncate">{me.name}</div>
              <div className="t-meta truncate">{me.role || 'צוות שילה'}</div>
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onSignOut} aria-label="יציאה">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
          </button>
        </div>
      </header>

      <div style={{ maxWidth: 620, margin: '0 auto', padding: 16 }}>
        <div className="row gap-2" style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 999, padding: 3, marginBottom: 18 }}>
          {segBtn('avail', 'הזמינות שלי')}
          {segBtn('shifts', 'המשמרות שלי', myShifts.length)}
        </div>

        {tab === 'avail' ? (
          <>
            <div className="card" style={{ padding: 14, marginBottom: 14 }}>
              <div style={{ fontWeight: 700, marginBottom: 3 }}>מתי אתה פנוי?</div>
              <div className="muted" style={{ fontSize: 13, lineHeight: 1.6 }}>
                סמן את הימים שאתה יכול לעבוד בהם. שי רואה את זה ומשבץ לפי מה שסימנת.
              </div>
              <div className="t-meta" style={{ marginTop: 8 }}>סימנת {submittedCount} מתוך {DAYS_AHEAD} ימים</div>
            </div>

            <div className="card" style={{ overflow: 'hidden' }}>
              {days.map((d, i) => {
                const iso = isoLocal(d)
                const av = availMap[iso]
                const a = av ? availById[av.status] : null
                const isToday = i === 0
                return (
                  <button key={iso} onClick={() => setPicker({ date: iso, current: av })} style={{
                    appearance: 'none', border: 0, width: '100%', textAlign: 'start', cursor: 'pointer',
                    background: isToday ? 'var(--gold-bg)' : 'transparent', color: 'var(--ink)', font: 'inherit',
                    padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12,
                    borderTop: i ? '1px solid var(--hair)' : 0,
                  }}>
                    <div style={{ width: 4, height: 30, borderRadius: 2, background: a ? a.color : 'var(--hair)', flex: 'none' }} />
                    <div className="grow" style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 14.5 }}>{fmtDate(iso)}</div>
                      <div className="t-meta">{isToday ? 'היום' : relLabel(iso)}</div>
                    </div>
                    {av
                      ? <span className="chip" style={{ background: 'var(--card-2)', color: a?.color, flex: 'none' }}>{availLabel(av)}</span>
                      : <span className="t-meta" style={{ flex: 'none' }}>סמן</span>}
                  </button>
                )
              })}
            </div>
          </>
        ) : (
          <>
            {myShifts.length === 0 ? (
              <div className="card" style={{ padding: 30, textAlign: 'center' }}>
                <div style={{ fontWeight: 600, marginBottom: 2 }}>אין לך משמרות</div>
                <div className="muted" style={{ fontSize: 13 }}>כששי ישבץ אותך, המשמרות יופיעו כאן.</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {myShifts.map(s => {
                  const job = jobs.find(j => j.id === s.job_id)
                  const teardown = s.kind === 'teardown'
                  return (
                    <div key={s.id} className="card" style={{ padding: 14, display: 'flex', gap: 12, alignItems: 'center' }}>
                      <div style={{ flex: 'none', textAlign: 'center', width: 56 }}>
                        <div className="mono" style={{ fontSize: 16, fontWeight: 700 }}>{s.start_time}</div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: teardown ? '#E5735B' : 'var(--gold)' }}>{shiftKindLabel(s.kind)}</div>
                      </div>
                      <div style={{ width: 1, alignSelf: 'stretch', background: 'var(--hair)' }} />
                      <div className="grow" style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 15 }} className="truncate">{job ? job.title || job.client : 'אירוע'}</div>
                        <div className="t-meta">{fmtDate(s.date)} · {relLabel(s.date)}</div>
                        <div className="t-meta mono" style={{ marginTop: 2 }}>{s.start_time}–{s.end_time}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>

      {picker && (
        <AvailPicker title={me.name} date={picker.date} current={picker.current}
          onClose={() => setPicker(null)}
          onPick={(status, from, to) => { onSetAvail(me.id, picker.date, status, from, to); setPicker(null) }} />
      )}
    </div>
  )
}
