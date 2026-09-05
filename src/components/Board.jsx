import React, { useMemo, useState } from 'react'
import { STATUSES, statusIndex, fmtDate, relLabel, daysUntil, isUrgent, ils } from '../data.js'
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

function JobCard({ job, onOpen, onStatus }) {
  const urgent = isUrgent(job)
  const rel = relLabel(job.eventDate)
  const overdue = job.eventDate && daysUntil(job.eventDate) < 0 && job.status !== 'installed'
  const itemCount = job.items.reduce((s, it) => s + it.qty, 0)
  const next = STATUSES[statusIndex(job.status) + 1]

  const advance = (e) => { e.stopPropagation(); if (next) onStatus(job.id, next.id) }

  return (
    <div role="button" tabIndex={0} className="card" onClick={() => onOpen(job)}
      onKeyDown={e => { if (e.key === 'Enter') onOpen(job) }}
      style={{
        textAlign: 'start', cursor: 'pointer', padding: 14, display: 'flex',
        flexDirection: 'column', gap: 10,
        border: (urgent || overdue) ? '1px solid var(--gold)' : undefined,
      }}>
      <div className="row between gap-2">
        <StatusPill id={job.status} />
        <span className={(urgent || overdue) ? 'chip chip-signal' : 't-meta'} style={{ alignSelf: 'center' }}>
          {(urgent || overdue) && <span className="chip-dot" />}{overdue ? `באיחור · ${rel}` : rel}
        </span>
      </div>

      <div>
        <div className="t-item truncate">{job.title || '—'}</div>
        <div className="t-meta">{job.client}</div>
      </div>

      <div className="row gap-2" style={{ color: 'var(--ink70)', fontSize: 13 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
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

      {next && (
        <button onClick={advance} title={`קדם ל“${next.label}”`}
          style={{
            appearance: 'none', cursor: 'pointer', width: '100%',
            marginTop: 2, padding: '7px 10px', borderRadius: 8,
            background: 'var(--gold-bg)', color: 'var(--gold-fg)',
            border: '1px solid transparent', font: 'inherit', fontSize: 12.5, fontWeight: 600,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}>
          קדם ל“{next.label}”
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
        </button>
      )}
    </div>
  )
}

function Stat({ label, value, tone, active, onClick }) {
  const color = tone === 'signal' ? 'var(--gold)' : tone === 'go' ? 'var(--go)' : 'var(--ink)'
  return (
    <button onClick={onClick} className="card" style={{
      textAlign: 'start', cursor: 'pointer', padding: '12px 14px', flex: '1 1 120px', minWidth: 108,
      border: active ? '1px solid var(--gold)' : undefined,
    }}>
      <div className="mono" style={{ fontSize: 24, fontWeight: 600, color }}>{value}</div>
      <div className="t-meta" style={{ marginTop: 2 }}>{label}</div>
    </button>
  )
}

// קיבוץ העבודות לפי קרבה בזמן
function groupByTime(list) {
  const buckets = { overdue: [], week: [], next: [], later: [], nodate: [], done: [] }
  for (const j of list) {
    if (j.status === 'installed') { buckets.done.push(j); continue }
    if (!j.eventDate) { buckets.nodate.push(j); continue }
    const n = daysUntil(j.eventDate)
    if (n < 0) buckets.overdue.push(j)
    else if (n <= 7) buckets.week.push(j)
    else if (n <= 14) buckets.next.push(j)
    else buckets.later.push(j)
  }
  return [
    { key: 'overdue', label: 'באיחור', hot: true, items: buckets.overdue },
    { key: 'week', label: 'השבוע', items: buckets.week },
    { key: 'next', label: 'השבוע הבא', items: buckets.next },
    { key: 'later', label: 'בהמשך', items: buckets.later },
    { key: 'nodate', label: 'ללא תאריך', items: buckets.nodate },
    { key: 'done', label: 'הסתיים', items: buckets.done },
  ].filter(g => g.items.length)
}

export default function Board({ jobs, onOpen, onStatus }) {
  const [filter, setFilter] = useState('active') // active | all | urgent | <statusId>
  const [q, setQ] = useState('')

  const stats = {
    active: jobs.filter(j => j.status !== 'installed').length,
    urgent: jobs.filter(isUrgent).length,
    approval: jobs.filter(j => j.status === 'approval').length,
    ready: jobs.filter(j => j.status === 'ready').length,
  }

  const filtered = useMemo(() => {
    let list = jobs
    if (filter === 'active') list = jobs.filter(j => j.status !== 'installed')
    else if (filter === 'urgent') list = jobs.filter(isUrgent)
    else if (filter !== 'all') list = jobs.filter(j => j.status === filter)
    const s = q.trim()
    if (s) list = list.filter(j => `${j.title} ${j.client} ${j.contact}`.includes(s))
    return [...list].sort((a, b) => {
      const da = a.eventDate ? daysUntil(a.eventDate) : 9e9
      const db = b.eventDate ? daysUntil(b.eventDate) : 9e9
      return da - db
    })
  }, [jobs, filter, q])

  const groups = useMemo(() => groupByTime(filtered), [filtered])

  const chip = (id, label) => (
    <button key={id} onClick={() => setFilter(id)} className="btn btn-sm" style={{
      borderRadius: 999,
      background: filter === id ? 'var(--gold)' : 'var(--card)',
      color: filter === id ? 'var(--on-gold)' : 'var(--ink70)',
      borderColor: filter === id ? 'var(--gold)' : 'var(--line)',
    }}>{label}</button>
  )

  return (
    <div style={{ maxWidth: 1120, margin: '0 auto', padding: 16 }}>
      {/* חיפוש */}
      <div style={{ position: 'relative', marginBottom: 14 }}>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
          style={{ position: 'absolute', insetInlineStart: 12, top: 13, color: 'var(--ink45)', pointerEvents: 'none' }}>
          <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input className="field" value={q} onChange={e => setQ(e.target.value)}
          placeholder="חיפוש לפי לקוח או עבודה…" style={{ paddingInlineStart: 38 }} />
      </div>

      {/* סטטיסטיקה לחיצה */}
      <div className="row wrap gap-3" style={{ marginBottom: 16 }}>
        <Stat label="עבודות פעילות" value={stats.active} active={filter === 'active'} onClick={() => setFilter('active')} />
        <Stat label="דחוף השבוע" value={stats.urgent} tone={stats.urgent ? 'signal' : undefined} active={filter === 'urgent'} onClick={() => setFilter('urgent')} />
        <Stat label="ממתין ללקוח" value={stats.approval} tone={stats.approval ? 'signal' : undefined} active={filter === 'approval'} onClick={() => setFilter('approval')} />
        <Stat label="מוכן לאיסוף" value={stats.ready} tone={stats.ready ? 'go' : undefined} active={filter === 'ready'} onClick={() => setFilter('ready')} />
      </div>

      {/* סינון */}
      <div className="row wrap gap-2" style={{ marginBottom: 16 }}>
        {chip('active', 'פעילות')}
        {chip('all', 'הכל')}
        <span style={{ width: 1, height: 22, background: 'var(--line)', margin: '0 2px' }} />
        {STATUSES.map(s => chip(s.id, s.label))}
      </div>

      {groups.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: 'center', borderStyle: 'dashed' }}>
          <div className="t-h2" style={{ marginBottom: 4 }}>{q ? 'אין תוצאות לחיפוש' : 'אין עבודות בתצוגה הזו'}</div>
          <div className="muted">{q ? 'נסה מונח אחר.' : 'בחר סינון אחר או צור עבודה חדשה.'}</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          {groups.map(g => (
            <section key={g.key}>
              <div className="row gap-2" style={{ marginBottom: 10 }}>
                <span style={{ fontWeight: 700, fontSize: 14, color: g.hot ? 'var(--gold)' : 'var(--ink)' }}>{g.label}</span>
                <span className="count-dot" style={g.hot ? undefined : { background: 'var(--hair)', color: 'var(--ink70)' }}>{g.items.length}</span>
              </div>
              <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
                {g.items.map(job => <JobCard key={job.id} job={job} onOpen={onOpen} onStatus={onStatus} />)}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
