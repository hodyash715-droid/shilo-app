import React, { useMemo, useState } from 'react'
import { STATUSES, fmtDate, relLabel, daysUntil, isUrgent, ils } from '../data.js'
import { StatusPill, Thumb, catLabel } from './ui.jsx'

function Avatar({ name }) {
  return (
    <span title={name} style={{
      width: 24, height: 24, borderRadius: 999, flex: 'none',
      background: 'var(--hair)', color: 'var(--ink70)',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 11, fontWeight: 700, marginInlineStart: -6, border: '1.5px solid var(--card)',
    }}>{name[0]}</span>
  )
}

function JobCard({ job, onOpen }) {
  const urgent = isUrgent(job)
  const rel = relLabel(job.eventDate)
  const itemCount = job.items.reduce((s, it) => s + it.qty, 0)

  return (
    <button className="card" onClick={() => onOpen(job)} style={{
      textAlign: 'start', cursor: 'pointer', padding: 14, display: 'flex',
      flexDirection: 'column', gap: 10, border: urgent ? '1px solid var(--signal)' : undefined,
    }}>
      <div className="row between gap-2">
        <StatusPill id={job.status} />
        <span className={urgent ? 'chip chip-signal' : 't-meta'} style={{ alignSelf: 'center' }}>
          {urgent && <span className="chip-dot" />}{rel}
        </span>
      </div>

      <div>
        <div className="t-item truncate">{job.title}</div>
        <div className="t-meta">{job.client}</div>
      </div>

      <div className="row gap-2" style={{ color: 'var(--ink70)', fontSize: 13 }}>
        <span aria-hidden>🗓</span>
        <span>{fmtDate(job.eventDate)}</span>
      </div>

      {job.items.length > 0 ? (
        <div className="row gap-2">
          <div className="row">
            {job.items.slice(0, 3).map((it, i) => (
              <div key={i} style={{ marginInlineStart: i ? -8 : 0, border: '1.5px solid var(--card)', borderRadius: 7 }}>
                <Thumb cat={it.cat} size={34} />
              </div>
            ))}
          </div>
          <span className="t-meta">{itemCount} פריטים · {job.items.map(i => catLabel(i.cat)).filter((v, i, a) => a.indexOf(v) === i).slice(0, 2).join(' · ')}</span>
        </div>
      ) : (
        <span className="t-meta" style={{ fontStyle: 'italic' }}>טרם הוגדרו פריטים</span>
      )}

      <hr className="hairline" style={{ margin: '2px 0' }} />

      <div className="row between gap-2">
        <div className="mono" style={{ fontSize: 16, fontWeight: 600 }}>
          {job.price ? ils(job.price) : <span className="muted" style={{ fontSize: 13 }}>ללא הצעה</span>}
        </div>
        <div className="row">
          {job.team.length
            ? job.team.slice(0, 3).map((t, i) => <Avatar key={i} name={t} />)
            : <span className="t-meta">ללא צוות</span>}
        </div>
      </div>
    </button>
  )
}

function Stat({ label, value, tone }) {
  const color = tone === 'signal' ? 'var(--signal)' : tone === 'go' ? 'var(--go)' : 'var(--ink)'
  return (
    <div className="card" style={{ padding: '12px 14px', flex: '1 1 120px', minWidth: 120 }}>
      <div className="mono" style={{ fontSize: 24, fontWeight: 600, color }}>{value}</div>
      <div className="t-meta" style={{ marginTop: 2 }}>{label}</div>
    </div>
  )
}

export default function Board({ jobs, onOpen }) {
  const [filter, setFilter] = useState('active') // active | all | <statusId>

  const active = jobs.filter(j => j.status !== 'installed')
  const stats = {
    active: active.length,
    urgent: jobs.filter(isUrgent).length,
    approval: jobs.filter(j => j.status === 'approval').length,
    ready: jobs.filter(j => j.status === 'ready').length,
  }

  const filtered = useMemo(() => {
    let list = jobs
    if (filter === 'active') list = jobs.filter(j => j.status !== 'installed')
    else if (filter !== 'all') list = jobs.filter(j => j.status === filter)
    return [...list].sort((a, b) => daysUntil(a.eventDate) - daysUntil(b.eventDate))
  }, [jobs, filter])

  const chip = (id, label) => (
    <button key={id} onClick={() => setFilter(id)} className="btn btn-sm" style={{
      borderRadius: 999,
      background: filter === id ? 'var(--ink)' : 'var(--card)',
      color: filter === id ? '#fff' : 'var(--ink70)',
      borderColor: filter === id ? 'var(--ink)' : 'var(--line)',
    }}>{label}</button>
  )

  return (
    <div style={{ maxWidth: 1120, margin: '0 auto', padding: 16 }}>
      {/* סרגל סיכום */}
      <div className="row wrap gap-3" style={{ marginBottom: 16 }}>
        <Stat label="עבודות פעילות" value={stats.active} />
        <Stat label="דחוף השבוע" value={stats.urgent} tone={stats.urgent ? 'signal' : undefined} />
        <Stat label="ממתין ללקוח" value={stats.approval} tone={stats.approval ? 'signal' : undefined} />
        <Stat label="מוכן לאיסוף" value={stats.ready} tone={stats.ready ? 'go' : undefined} />
      </div>

      {/* סינון */}
      <div className="row wrap gap-2" style={{ marginBottom: 14 }}>
        {chip('active', 'פעילות')}
        {chip('all', 'הכל')}
        <span style={{ width: 1, height: 22, background: 'var(--line)', margin: '0 2px' }} />
        {STATUSES.map(s => chip(s.id, s.label))}
      </div>

      {filtered.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: 'center', borderStyle: 'dashed' }}>
          <div className="t-h2" style={{ marginBottom: 4 }}>אין עבודות בתצוגה הזו</div>
          <div className="muted">בחר סינון אחר או צור עבודה חדשה.</div>
        </div>
      ) : (
        <div style={{
          display: 'grid', gap: 14,
          gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
        }}>
          {filtered.map(job => <JobCard key={job.id} job={job} onOpen={onOpen} />)}
        </div>
      )}
    </div>
  )
}
