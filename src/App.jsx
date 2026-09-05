import React, { useEffect, useRef, useState } from 'react'
import { supabase, isConfigured } from './supabase.js'
import { fetchJobs, updateJob } from './db.js'
import Header from './components/Header.jsx'
import Home from './components/Home.jsx'
import Calendar from './components/Calendar.jsx'
import JobDetail from './components/JobDetail.jsx'
import JobEdit from './components/JobEdit.jsx'
import Login from './components/Login.jsx'
import MobileNav from './components/MobileNav.jsx'
import Settings from './components/Settings.jsx'
import ComingSoon from './components/ComingSoon.jsx'
import { VERSION } from './version.js'

const displayName = (email) => ({ shai: 'שי' })[(email || '').split('@')[0]] || (email || '').split('@')[0] || 'שי'

const VersionBadge = () => (
  <div className="mono version-badge" style={{
    position: 'fixed', left: 10, bottom: 10, zIndex: 60,
    fontSize: 11, color: 'var(--ink45)',
    background: 'var(--card)', border: '1px solid var(--line)',
    borderRadius: 999, padding: '3px 9px', pointerEvents: 'none',
    letterSpacing: '.04em', boxShadow: '0 2px 8px rgba(0,0,0,.4)',
  }}>{VERSION}</div>
)

const Toast = ({ text }) => (
  <div className="toast">
    <span className="toast-ic">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
    </span>
    {text}
  </div>
)

const SkeletonCard = () => (
  <div className="card" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
    <div className="skeleton" style={{ width: 78, height: 22 }} />
    <div className="skeleton" style={{ width: '72%', height: 18 }} />
    <div className="skeleton" style={{ width: '42%', height: 13 }} />
    <div className="skeleton" style={{ width: '100%', height: 34, borderRadius: 8 }} />
  </div>
)

const BoardSkeleton = () => (
  <div style={{ maxWidth: 1120, margin: '0 auto', padding: 16 }}>
    <div className="skeleton" style={{ height: 44, borderRadius: 9, marginBottom: 16 }} />
    <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
      {[0, 1, 2, 3, 4, 5].map(i => <SkeletonCard key={i} />)}
    </div>
  </div>
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
  const [view, setView] = useState('home')
  const [openId, setOpenId] = useState(null)
  const [editTarget, setEditTarget] = useState(undefined) // undefined=closed, null=new, job=edit
  const [toast, setToast] = useState(null)
  const toastRef = useRef()
  const showToast = (text) => {
    setToast(text)
    clearTimeout(toastRef.current)
    toastRef.current = setTimeout(() => setToast(null), 2200)
  }

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
    showToast('הסטטוס עודכן')
    try { await updateJob(id, { status: statusId }) }
    catch (e) { showToast('עדכון נכשל'); load() }
  }

  const onSaved = (saved) => {
    setJobs(js => {
      const exists = js.some(j => j.id === saved.id)
      return exists ? js.map(j => (j.id === saved.id ? saved : j)) : [saved, ...js]
    })
    setEditTarget(undefined)
    setOpenId(null)
    showToast('העבודה נשמרה')
  }
  const onDeleted = (id) => {
    setJobs(js => js.filter(j => j.id !== id))
    setEditTarget(undefined); setOpenId(null)
    showToast('העבודה נמחקה')
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
        ? <BoardSkeleton />
        : <div className="fade-in" key={view}>
            {view === 'home' && (
              <Home jobs={jobs} name={displayName(session.user?.email)}
                onOpen={j => setOpenId(j.id)} onStatus={setStatus} onEdit={j => setEditTarget(j)} />
            )}
            {view === 'calendar' && <Calendar jobs={jobs} onOpen={j => setOpenId(j.id)} />}
            {view === 'team' && <ComingSoon icon="team" title="שיבוץ צוות"
              lines={['ניהול חברי הצוות ושיבוצם לאירועים.', 'מי מתקין מה, ומתי — במבט אחד.']} />}
            {view === 'field' && <ComingSoon icon="field" title="בשטח"
              lines={['מעקב אחרי ציוד שיצא לאירועים —', 'מה בחוץ, אצל מי, ומה חזר למחסן.']} />}
            {view === 'settings' && <Settings name={displayName(session.user?.email)}
              email={session.user?.email} onSignOut={() => supabase.auth.signOut()} />}
          </div>}

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

      <MobileNav view={view} setView={setView} />
      {toast && <Toast text={toast} />}
    </div>
  )
}
