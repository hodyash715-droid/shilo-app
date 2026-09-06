import React, { useEffect, useRef, useState } from 'react'
import { supabase, isConfigured } from './supabase.js'
import {
  fetchJobs, updateJob, fetchEmployees, fetchShifts, fetchInventory,
  fetchAvailability, setAvailability as saveAvailability, clearAvailability,
  claimEmployeeCode, fetchMyJobTitles, fetchClients,
} from './db.js'
import Header from './components/Header.jsx'
import Home from './components/Home.jsx'
import Calendar from './components/Calendar.jsx'
import JobDetail from './components/JobDetail.jsx'
import JobEdit from './components/JobEdit.jsx'
import Login from './components/Login.jsx'
import MobileNav from './components/MobileNav.jsx'
import Settings from './components/Settings.jsx'
import Team from './components/Team.jsx'
import Field from './components/Field.jsx'
import WorkerApp from './components/WorkerApp.jsx'
import ClientPortal from './components/ClientPortal.jsx'
import { VERSION } from './version.js'

const displayName = (email) => ({ shai: 'שי' })[(email || '').split('@')[0]] || (email || '').split('@')[0] || 'שי'

// חשבונות מנהל. כל חשבון אחר הוא עובד — וללא כרטיס עובד מקושר אין גישה.
const MANAGERS = ['shai@shilo.app']

function NotLinked({ email, onSignOut }) {
  return (
    <div style={{ minHeight: '100%', display: 'grid', placeItems: 'center', padding: 24, textAlign: 'center' }}>
      <div style={{ maxWidth: 380 }}>
        <div className="brand-mark" style={{ margin: '0 auto 16px' }}>ש</div>
        <div className="t-h2" style={{ marginBottom: 8 }}>החשבון לא מקושר לעובד</div>
        <div className="muted" style={{ lineHeight: 1.7 }}>
          החשבון <span className="mono">{email}</span> אינו משויך לכרטיס עובד.
          בקש משי קוד הצטרפות מעודכן.
        </div>
        <button className="btn" style={{ marginTop: 20 }} onClick={onSignOut}>יציאה</button>
      </div>
    </div>
  )
}

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
  const [employees, setEmployees] = useState([])
  const [shifts, setShifts] = useState([])
  const [inventory, setInventory] = useState([])
  const [availability, setAvailabilityState] = useState([])
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(false)
  const [dataReady, setDataReady] = useState(false)
  const [loadErr, setLoadErr] = useState('')
  const [view, setView] = useState('home')
  const [openId, setOpenId] = useState(null)
  const [editTarget, setEditTarget] = useState(undefined) // undefined=closed, null=new, job=edit
  const [route, setRoute] = useState(() => window.location.hash || '')
  const [toast, setToast] = useState(null)
  const toastRef = useRef()
  const showToast = (text) => {
    setToast(text)
    clearTimeout(toastRef.current)
    toastRef.current = setTimeout(() => setToast(null), 2200)
  }

  // ניתוב פשוט לפי כתובת: #/c/<token> = דף הלקוח
  useEffect(() => {
    const h = () => setRoute(window.location.hash || '')
    window.addEventListener('hashchange', h)
    return () => window.removeEventListener('hashchange', h)
  }, [])

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
    try {
      const [j, mj, e, sh, inv, av] = await Promise.all([
        fetchJobs().catch(() => []),          // עובד חסום מהעבודות — יקבל []
        fetchMyJobTitles().catch(() => []),   // ולכן מקבל רק שמות האירועים שלו
        fetchEmployees().catch(() => []),
        fetchShifts().catch(() => []),
        fetchInventory().catch(() => []),
        fetchAvailability().catch(() => []),
      ])
      const cl = await fetchClients().catch(() => [])
      setJobs(j.length ? j : mj)
      setEmployees(e); setShifts(sh); setInventory(inv); setAvailabilityState(av); setClients(cl)
    }
    catch (e) { setLoadErr(e.message || String(e)) }
    finally { setLoading(false); setDataReady(true) }
  }
  useEffect(() => { if (session) load() }, [session])

  // קישור עצמי: עובד שנכנס עם הקוד שלו ועדיין לא מקושר — נקשר אוטומטית
  useEffect(() => {
    if (!session || !dataReady) return
    const email = (session.user?.email || '').toLowerCase()
    if (MANAGERS.includes(email)) return
    if (employees.some(e => e.user_id === session.user?.id)) return
    let cancelled = false
    ;(async () => {
      try {
        const empId = await claimEmployeeCode(email.split('@')[0].toUpperCase(), session.user.id)
        if (!cancelled && empId) load()
      } catch (e) { /* אין קוד תואם — יוצג מסך "לא מקושר" */ }
    })()
    return () => { cancelled = true }
  }, [session, dataReady, employees])

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

  const onEmpSaved = (s) => {
    setEmployees(es => (es.some(x => x.id === s.id) ? es.map(x => x.id === s.id ? s : x) : [...es, s])
      .sort((a, b) => a.name.localeCompare(b.name, 'he')))
    showToast('העובד נשמר')
  }
  const onEmpDeleted = (id) => { setEmployees(es => es.filter(x => x.id !== id)); showToast('העובד נמחק') }

  const onShiftSaved = (s) => {
    setShifts(ss => ss.some(x => x.id === s.id) ? ss.map(x => x.id === s.id ? s : x) : [...ss, s])
    showToast('המשמרת נשמרה')
  }
  const onShiftDeleted = (id) => { setShifts(ss => ss.filter(x => x.id !== id)); showToast('המשמרת נמחקה') }

  const onClientSaved = (c) => {
    setClients(xs => (xs.some(x => x.id === c.id) ? xs.map(x => x.id === c.id ? c : x) : [...xs, c])
      .sort((a, b) => a.name.localeCompare(b.name, 'he')))
    showToast('המפיקה נוספה')
  }
  const onClientDeleted = (id) => { setClients(xs => xs.filter(x => x.id !== id)); showToast('נמחקה') }

  // ציר הצעת המחיר
  const onQuote = async (jobId, status) => {
    const patch = { quoteStatus: status }
    if (status === 'sent') patch.quoteSentAt = new Date().toISOString()
    if (status === 'approved' || status === 'rejected') patch.quoteDecidedAt = new Date().toISOString()
    setJobs(js => js.map(j => (j.id === jobId ? { ...j, ...patch } : j)))
    showToast(status === 'approved' ? 'ההצעה אושרה' : status === 'sent' ? 'סומן: ההצעה נשלחה' : 'הסטטוס עודכן')
    try { await updateJob(jobId, patch) }
    catch (e) { showToast('עדכון נכשל'); load() }
  }

  // החזרת ציוד למחסן
  const markReturned = async (jobId, which) => {
    const job = jobs.find(j => j.id === jobId)
    if (!job) return
    const items = job.items.map((it, i) => (which === 'all' || i === which) ? { ...it, returned: true } : it)
    setJobs(js => js.map(j => j.id === jobId ? { ...j, items } : j))
    showToast(which === 'all' ? 'הכל חזר למחסן' : 'הפריט חזר למחסן')
    try { await updateJob(jobId, { items }) }
    catch (e) { showToast('עדכון נכשל'); load() }
  }

  const onInvSaved = (s) => {
    setInventory(xs => (xs.some(x => x.id === s.id) ? xs.map(x => x.id === s.id ? s : x) : [...xs, s])
      .sort((a, b) => a.name.localeCompare(b.name, 'he')))
    showToast('הפריט נשמר')
  }
  const onInvDeleted = (id) => { setInventory(xs => xs.filter(x => x.id !== id)); showToast('הפריט נמחק') }

  // זמינות עובד ליום (status קבוע, או 'custom' עם טווח שעות)
  const onSetAvail = async (employee_id, date, status, start_time = null, end_time = null) => {
    const match = a => a.employee_id === employee_id && a.date === date
    if (!status) {
      setAvailabilityState(av => av.filter(a => !match(a)))
      try { await clearAvailability(employee_id, date) }
      catch (e) { showToast('עדכון נכשל'); load() }
      return
    }
    const row = { employee_id, date, status, start_time, end_time }
    setAvailabilityState(av => av.some(match) ? av.map(a => match(a) ? { ...a, ...row } : a) : [...av, row])
    try { await saveAvailability(employee_id, date, status, start_time, end_time) }
    catch (e) { showToast('עדכון נכשל'); load() }
  }

  // דף הלקוח — ללא התחברות, לפני כל בדיקת הרשאות
  const clientToken = (route.match(/^#\/c\/(.+)$/) || [])[1]
  if (clientToken) return <><ClientPortal token={decodeURIComponent(clientToken)} /><VersionBadge /></>

  if (!authReady) return <div style={{ minHeight: '100%' }} />
  if (!isConfigured) return <><Setup /><VersionBadge /></>
  if (!session) return <><Login /><VersionBadge /></>
  if (!dataReady) return <><BoardSkeleton /><VersionBadge /></>

  // תפקיד: מנהל רק לפי רשימה מפורשת. כל השאר — עובד.
  const email = (session.user?.email || '').toLowerCase()
  const isManager = MANAGERS.includes(email)
  const me = employees.find(e => e.user_id === session.user?.id) || null

  if (!isManager) {
    if (!me) return <><NotLinked email={email} onSignOut={() => supabase.auth.signOut()} /><VersionBadge /></>
    return (
      <>
        <WorkerApp me={me} jobs={jobs} shifts={shifts} availability={availability}
          onSetAvail={onSetAvail} onSignOut={() => supabase.auth.signOut()} />
        <VersionBadge />
        {toast && <Toast text={toast} />}
      </>
    )
  }

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
                onOpen={j => setOpenId(j.id)} onStatus={setStatus} onEdit={j => setEditTarget(j)}
                shifts={shifts} employees={employees} />
            )}
            {view === 'calendar' && <Calendar jobs={jobs} onOpen={j => setOpenId(j.id)} />}
            {view === 'team' && <Team employees={employees} shifts={shifts} jobs={jobs}
              availability={availability} onSetAvail={onSetAvail}
              onShiftSaved={onShiftSaved} onShiftDeleted={onShiftDeleted} />}
            {view === 'field' && <Field jobs={jobs} shifts={shifts} inventory={inventory}
              onItemReturn={(jobId, i) => markReturned(jobId, i)}
              onAllReturned={(jobId) => markReturned(jobId, 'all')}
              onInvSaved={onInvSaved} onInvDeleted={onInvDeleted} />}
            {view === 'settings' && <Settings name={displayName(session.user?.email)}
              email={session.user?.email} onSignOut={() => supabase.auth.signOut()}
              employees={employees} onEmpSaved={onEmpSaved} onEmpDeleted={onEmpDeleted}
              clients={clients} onClientSaved={onClientSaved} onClientDeleted={onClientDeleted} />}
          </div>}

      {openJob && (
        <JobDetail
          job={openJob}
          onClose={() => setOpenId(null)}
          onStatus={setStatus}
          onEdit={() => setEditTarget(openJob)}
          shifts={shifts} employees={employees}
          onShiftSaved={onShiftSaved} onShiftDeleted={onShiftDeleted}
          onQuote={onQuote}
        />
      )}

      {editTarget !== undefined && (
        <JobEdit
          job={editTarget}
          onClose={() => setEditTarget(undefined)}
          onSaved={onSaved}
          onDeleted={onDeleted}
          inventory={inventory}
        />
      )}

      <MobileNav view={view} setView={setView} />
      {toast && <Toast text={toast} />}
    </div>
  )
}
