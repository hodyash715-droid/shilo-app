import React, { useEffect, useState } from 'react'
import { supabase, isConfigured } from './supabase.js'
import { fetchJobs, updateJob } from './db.js'
import Header from './components/Header.jsx'
import Board from './components/Board.jsx'
import Calendar from './components/Calendar.jsx'
import JobDetail from './components/JobDetail.jsx'
import JobEdit from './components/JobEdit.jsx'
import Login from './components/Login.jsx'
import MobileNav from './components/MobileNav.jsx'
import { VERSION } from './version.js'

const VersionBadge = () => (
  <div className="mono version-badge" style={{
    position: 'fixed', insetInlineStart: 9, bottom: 6, zIndex: 60,
    fontSize: 10, color: 'var(--ink25)', opacity: .6, pointerEvents: 'none',
    letterSpacing: '.03em',
  }}>{VERSION}</div>
)

function Setup() {
  return (
    <div style={{ minHeight: '100%', display: 'grid', placeItems: 'center', padding: 24, textAlign: 'center' }}>
      <div style={{ maxWidth: 420 }}>
        <div className="brand-mark" style={{ margin: '0 auto 16px' }}>ש</div>
        <div className="t-h2" style={{ marginBottom: 8 }}>המערכת עדיין לא מחוברת</div>
        <div className="muted">חסרים פרטי החיבור ל‑Supabase (URL ומפתח). הם מוגדרים בזמן הבנייה.</div>
      </div>
    </div>
  )
}

export default function App() {
  const [session, setSession] = useState(null)
  const [authReady, setAuthReady] = useState(false)
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadErr, setLoadErr] = useState('')
  const [view, setView] = useState('board')
  const [openId, setOpenId] = useState(null)
  const [editTarget, setEditTarget] = useState(undefined) // undefined=closed, null=new, job=edit

  // מעקב אחר מצב התחברות
  useEffect(() => {
    if (!isConfigured) { setAuthReady(true); return }
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setAuthReady(true) })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  // טעינת עבודות כשמחוברים
  const load = async () => {
    setLoading(true); setLoadErr('')
    try { setJobs(await fetchJobs()) }
    catch (e) { setLoadErr(e.message || String(e)) }
    finally { setLoading(false) }
  }
  useEffect(() => { if (session) load() }, [session])

  const openJob = jobs.find(j => j.id === openId) || null

  const setStatus = async (id, statusId) => {
    setJobs(js => js.map(j => (j.id === id ? { ...j, status: statusId } : j)))  // אופטימי
    try { await updateJob(id, { status: statusId }) }
    catch (e) { alert('עדכון סטטוס נכשל'); load() }
  }

  const onSaved = (saved) => {
    setJobs(js => {
      const exists = js.some(j => j.id === saved.id)
      return exists ? js.map(j => (j.id === saved.id ? saved : j)) : [saved, ...js]
    })
    setEditTarget(undefined)
    setOpenId(null)
  }
  const onDeleted = (id) => {
    setJobs(js => js.filter(j => j.id !== id))
    setEditTarget(undefined); setOpenId(null)
  }

  if (!authReady) return <div style={{ minHeight: '100%' }} />
  if (!isConfigured) return <><Setup /><VersionBadge /></>
  if (!session) return <><Login /><VersionBadge /></>

  return (
    <div className="pad-tabbar" style={{ minHeight: '100%', paddingBottom: 40 }}>
      <VersionBadge />
      <Header
        view={view} setView={setView}
        onNew={() => setEditTarget(null)}
        email={session.user?.email}
        onSignOut={() => supabase.auth.signOut()}
      />

      {loadErr && (
        <div style={{ maxWidth: 1120, margin: '12px auto', padding: '0 16px' }}>
          <div className="card" style={{ padding: 14, borderColor: '#5a3320' }}>
            <div style={{ color: '#E5735B', fontWeight: 600 }}>טעינת הנתונים נכשלה</div>
            <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>{loadErr}</div>
            <button className="btn btn-sm" style={{ marginTop: 10 }} onClick={load}>נסה שוב</button>
          </div>
        </div>
      )}

      {loading
        ? <div style={{ maxWidth: 1120, margin: '40px auto', padding: 16 }} className="muted">טוען…</div>
        : view === 'board'
          ? <Board jobs={jobs} onOpen={j => setOpenId(j.id)} />
          : <Calendar jobs={jobs} onOpen={j => setOpenId(j.id)} />}

      {openJob && (
        <JobDetail
          job={openJob}
          onClose={() => setOpenId(null)}
          onStatus={setStatus}
          onEdit={() => setEditTarget(openJob)}
        />
      )}

      {editTarget !== undefined && (
        <JobEdit
          job={editTarget}
          onClose={() => setEditTarget(undefined)}
          onSaved={onSaved}
          onDeleted={onDeleted}
        />
      )}

      <MobileNav view={view} setView={setView} onNew={() => setEditTarget(null)} />
    </div>
  )
}
