import React from 'react'
import { daysUntil, relLabel, shiftKindLabel, fmtDate, quoteApproved, quoteOf } from '../data.js'
import { EmpAvatar } from './ui.jsx'
import Board from './Board.jsx'

const greeting = () => {
  const h = new Date().getHours()
  if (h < 5) return 'לילה טוב'
  if (h < 12) return 'בוקר טוב'
  if (h < 18) return 'צהריים טובים'
  if (h < 22) return 'ערב טוב'
  return 'לילה טוב'
}

const isOverdue = j => j.eventDate && daysUntil(j.eventDate) < 0 && j.status !== 'installed'
const needsTeam = j => j.team.length === 0 && !['inquiry', 'installed'].includes(j.status)

// מה כל עבודה צריכה — לפי עדיפות
function needOf(j) {
  if (isOverdue(j)) return { kind: 'overdue', reason: `באיחור · ${relLabel(j.eventDate)}`, action: 'עדכן', hot: true }
  if (j.quoteStatus === 'needs_quote') return { kind: 'quote', reason: 'יש לשלוח הצעת מחיר', action: 'הצעה', hot: true }
  if (j.quoteStatus === 'sent') return { kind: 'waiting', reason: 'ממתין לאישור הלקוח', action: 'פתח' }
  if (j.status === 'approval') return { kind: 'approval', reason: 'ממתין לאישור', action: 'אשר', hot: true }
  if (needsTeam(j)) return { kind: 'team', reason: 'חסר צוות', action: 'שבץ' }
  if (j.status === 'inquiry') return quoteApproved(j)
    ? { kind: 'start', reason: 'ההצעה אושרה — אפשר להתחיל', action: 'התחל' }
    : { kind: 'inquiry', reason: 'פנייה חדשה — לתמחר', action: 'הצעה' }
  return null
}
const RANK = { overdue: 0, quote: 1, waiting: 2, approval: 3, start: 4, team: 5, inquiry: 6 }

// עבודה שצריך לשבץ לה צוות: פעילה, ויש משמרת לא מאוישת (או שאין משמרות בכלל)
function needsStaffing(j, shifts) {
  if (j.status === 'installed') return false
  const own = shifts.filter(s => s.job_id === j.id)
  if (own.length === 0) return true
  return own.some(s => (s.assigned?.length || 0) < (s.need || 1))
}

function StaffingLists({ jobs, shifts, onOpen }) {
  const toStaff = jobs.filter(j => needsStaffing(j, shifts))
  if (toStaff.length === 0) return null
  const ok = toStaff.filter(quoteApproved)
  const risky = toStaff.filter(j => !quoteApproved(j))

  const List = ({ items, hot, title }) => (
    <div className="grow" style={{ minWidth: 250 }}>
      <div className="row gap-2" style={{ marginBottom: 8 }}>
        <span style={{ width: 8, height: 8, borderRadius: 999, background: hot ? '#A8382A' : '#3E9C68' }} />
        <span style={{ fontWeight: 700, fontSize: 14, color: hot ? '#E5735B' : 'var(--go-fg)' }}>{title}</span>
        <span className="t-meta">{items.length}</span>
      </div>
      {items.length === 0
        ? <div className="muted" style={{ fontSize: 13, padding: '6px 2px' }}>אין</div>
        : <div className="card" style={{ overflow: 'hidden' }}>
            {items.map((j, i) => (
              <button key={j.id} onClick={() => onOpen(j)} style={{
                appearance: 'none', border: 0, width: '100%', textAlign: 'start', cursor: 'pointer',
                background: 'transparent', color: 'var(--ink)', font: 'inherit',
                padding: 11, display: 'flex', alignItems: 'center', gap: 10,
                borderTop: i ? '1px solid var(--hair)' : 0,
                borderInlineStart: `3px solid ${hot ? '#A8382A' : '#3E9C68'}`,
              }}>
                <div className="grow" style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }} className="truncate">{j.title || j.client}</div>
                  <div className="t-meta truncate">
                    {j.eventDate ? fmtDate(j.eventDate) : 'ללא תאריך'}
                    {hot && <span style={{ color: '#E5735B', fontWeight: 600 }}> · {quoteOf(j).short}</span>}
                  </div>
                </div>
              </button>
            ))}
          </div>}
    </div>
  )

  return (
    <div style={{ marginBottom: 26 }}>
      <div className="row gap-2" style={{ marginBottom: 10 }}>
        <span style={{ width: 4, height: 18, background: 'var(--gold)', borderRadius: 2 }} />
        <span style={{ fontWeight: 700, fontSize: 16 }}>לשיבוץ צוות</span>
        <span className="t-meta">{toStaff.length}</span>
      </div>
      <div className="row wrap gap-4" style={{ alignItems: 'flex-start' }}>
        <List items={ok} title="הצעה אושרה" />
        <List items={risky} title="טרם אושרה הצעה" hot />
      </div>
    </div>
  )
}

function Hero({ name, jobs }) {
  const overdue = jobs.filter(isOverdue).length
  const approval = jobs.filter(j => j.status === 'approval').length
  const team = jobs.filter(needsTeam).length
  return (
    <div className="card" style={{ position: 'relative', overflow: 'hidden', padding: '20px 20px 18px', marginBottom: 18 }}>
      <div aria-hidden style={{
        position: 'absolute', insetInlineStart: 0, top: 0, bottom: 0, width: 120, opacity: .5,
        background: 'repeating-linear-gradient(135deg, transparent 0 10px, var(--gold-bg) 10px 20px)',
        maskImage: 'linear-gradient(to left, black, transparent)', WebkitMaskImage: 'linear-gradient(to left, black, transparent)',
      }} />
      <div style={{ position: 'relative' }}>
        <div className="t-h1">{greeting()}, {name}.</div>
        <div className="muted" style={{ marginTop: 6, fontSize: 14 }}>
          <b style={{ color: 'var(--gold)' }}>{approval}</b> לאישור · <b style={{ color: 'var(--gold)' }}>{team}</b> לשיבוץ · <b style={{ color: overdue ? '#E5735B' : 'var(--ink70)' }}>{overdue}</b> באיחור
        </div>
      </div>
    </div>
  )
}

function InboxRow({ job, need, onOpen, act }) {
  return (
    <div role="button" tabIndex={0} onClick={() => onOpen(job)}
      onKeyDown={e => { if (e.key === 'Enter') onOpen(job) }}
      style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', cursor: 'pointer',
        borderInlineStart: `3px solid ${need.hot ? 'var(--gold)' : 'var(--line)'}`,
      }}>
      <div className="grow" style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 14.5 }} className="truncate">{job.title || job.client}</div>
        <div className="t-meta" style={{ marginTop: 2 }}>
          <span style={{ color: need.hot ? 'var(--gold-fg)' : 'var(--ink45)', fontWeight: 600 }}>{need.reason}</span>
          {job.title ? ` · ${job.client}` : ''}
        </div>
      </div>
      <button onClick={e => { e.stopPropagation(); act(job, need) }} className="btn btn-sm btn-solid"
        style={{ flex: 'none' }}>{need.action}</button>
    </div>
  )
}

function Today({ shifts, jobs, employees, onOpen }) {
  const today = (shifts || []).filter(s => s.date && daysUntil(s.date) === 0)
    .sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''))
  if (today.length === 0) return null
  return (
    <div style={{ marginBottom: 26 }}>
      <div className="row between" style={{ marginBottom: 10 }}>
        <div className="row gap-2">
          <span style={{ width: 4, height: 18, background: 'var(--gold)', borderRadius: 2 }} />
          <span style={{ fontWeight: 700, fontSize: 16 }}>לוח היום</span>
        </div>
        <span className="t-meta">{today.length} משמרות</span>
      </div>
      <div className="card" style={{ overflow: 'hidden' }}>
        {today.map((sh, i) => {
          const job = jobs.find(j => j.id === sh.job_id)
          const crew = sh.assigned.map(id => employees.find(e => e.id === id)).filter(Boolean)
          const teardown = sh.kind === 'teardown'
          return (
            <button key={sh.id} onClick={() => job && onOpen(job)} style={{
              appearance: 'none', border: 0, width: '100%', textAlign: 'start', cursor: 'pointer',
              background: 'transparent', color: 'var(--ink)', font: 'inherit',
              padding: 12, display: 'flex', alignItems: 'center', gap: 12, borderTop: i ? '1px solid var(--hair)' : 0,
            }}>
              <div style={{ flex: 'none', textAlign: 'center', width: 52 }}>
                <div className="mono" style={{ fontSize: 15, fontWeight: 700 }}>{sh.start_time}</div>
                <div style={{ fontSize: 11, fontWeight: 600, color: teardown ? '#E5735B' : 'var(--gold)' }}>{shiftKindLabel(sh.kind)}</div>
              </div>
              <div style={{ width: 1, alignSelf: 'stretch', background: 'var(--hair)' }} />
              <div className="grow" style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14.5 }} className="truncate">{job ? job.title || job.client : 'עבודה'}</div>
                <div className="t-meta truncate">{job?.client}</div>
              </div>
              <div className="row" style={{ flex: 'none' }}>
                {crew.length
                  ? crew.slice(0, 3).map((e, k) => <span key={e.id} style={{ marginInlineStart: k ? -6 : 0 }}><EmpAvatar name={e.name} size={26} /></span>)
                  : <span className="chip chip-signal">חסר צוות</span>}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default function Home({ jobs, name, onOpen, onStatus, onEdit, shifts, employees }) {
  const inbox = jobs
    .map(j => ({ job: j, need: needOf(j) }))
    .filter(x => x.need)
    .sort((a, b) => (RANK[a.need.kind] - RANK[b.need.kind])
      || ((a.job.eventDate ? daysUntil(a.job.eventDate) : 9e9) - (b.job.eventDate ? daysUntil(b.job.eventDate) : 9e9)))

  const act = (job, need) => {
    if (need.kind === 'approval') onStatus(job.id, 'production')
    else if (need.kind === 'start') onStatus(job.id, 'design')
    else if (need.kind === 'quote' || need.kind === 'waiting') onOpen(job)  // מסך ההצעה
    else onEdit(job)              // overdue / team / inquiry → פתיחה לעריכה
  }

  return (
    <div style={{ maxWidth: 1120, margin: '0 auto', padding: 16 }}>
      <Hero name={name} jobs={jobs} />

      <div className="row between" style={{ marginBottom: 10 }}>
        <div className="row gap-2">
          <span style={{ width: 4, height: 18, background: 'var(--gold)', borderRadius: 2 }} />
          <span style={{ fontWeight: 700, fontSize: 16 }}>דורש טיפול</span>
        </div>
        <span className="t-meta">{inbox.length} פתוחים</span>
      </div>

      {inbox.length === 0 ? (
        <div className="card" style={{ padding: 28, textAlign: 'center', marginBottom: 26 }}>
          <div style={{ fontWeight: 600, marginBottom: 2 }}>הכל תחת שליטה 🎯</div>
          <div className="muted" style={{ fontSize: 13 }}>אין כרגע עבודות שדורשות פעולה מיידית.</div>
        </div>
      ) : (
        <div className="card" style={{ overflow: 'hidden', marginBottom: 26 }}>
          {inbox.slice(0, 8).map(({ job, need }, i) => (
            <div key={job.id} style={{ borderTop: i ? '1px solid var(--hair)' : 0 }}>
              <InboxRow job={job} need={need} onOpen={onOpen} act={act} />
            </div>
          ))}
        </div>
      )}

      <StaffingLists jobs={jobs} shifts={shifts || []} onOpen={onOpen} />

      <Today shifts={shifts} jobs={jobs} employees={employees} onOpen={onOpen} />

      {/* כל העבודות */}
      <div className="row gap-2" style={{ marginBottom: 4 }}>
        <span style={{ width: 4, height: 18, background: 'var(--ink45)', borderRadius: 2 }} />
        <span style={{ fontWeight: 700, fontSize: 16 }}>כל העבודות</span>
      </div>
      <div style={{ marginInline: -16 }}>
        <Board jobs={jobs} onOpen={onOpen} onStatus={onStatus} />
      </div>
    </div>
  )
}
