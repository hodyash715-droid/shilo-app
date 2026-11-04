import React, { useState } from 'react'
import { supabase } from '../supabase.js'
import { claimEmployeeCode, loginEmailFor } from '../db.js'

// שם משתמש → אימייל. עובדים נכנסים עם השם שבכרטיס שלהם (login_email
// במסד מתרגם אותו לחשבון), ועם קוד ההצטרפות כגיבוי — כך נוצר החשבון.
const ALIASES = { 'שי': 'shai' }
const toEmail = (u) => {
  const raw = u.trim()
  if (raw.includes('@')) return raw
  const local = (ALIASES[raw] || raw).toLowerCase()
  return `${local}@shilo.app`
}

const darkField = {
  width: '100%', height: 52, borderRadius: 10, background: '#1A1A1D',
  border: '1px solid #2E2E33', color: 'var(--ink)', padding: '0 14px',
  font: 'inherit', fontSize: 16,
}

export default function Login() {
  const [mode, setMode] = useState('login')      // login | join
  const [user, setUser] = useState('')
  const [pass, setPass] = useState('')
  const [code, setCode] = useState('')
  const [pass2, setPass2] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const login = async (e) => {
    e.preventDefault()
    setErr(''); setBusy(true)
    const raw = user.trim()
    // שי ואימייל מלא — ישירות. כל השאר: קודם כשם עובד, ואם אין כזה — כקוד.
    const direct = raw.includes('@') || ALIASES[raw]
    const found = direct ? null : await loginEmailFor(raw)
    const email = found || toEmail(raw)
    const { error } = await supabase.auth.signInWithPassword({ email, password: pass })
    setBusy(false)
    // המסך כבר יודע להבדיל: אם השם תורגם לחשבון, הכישלון הוא בסיסמה.
    // הודעה אחת לשני המקרים השאירה את העובד בלי דרך לדעת מה לתקן,
    // ואת שי בלי דרך לעזור לו מרחוק.
    if (error) {
      setErr(found || direct
        ? 'הסיסמה שגויה.'
        : 'לא נמצא עובד בשם הזה. בדוק את השם שבכרטיס, או היכנס עם קוד ההצטרפות.')
    }
  }

  const join = async (e) => {
    e.preventDefault()
    setErr('')
    const c = code.trim().toUpperCase()
    if (c.length < 4) { setErr('קוד לא תקין'); return }
    if (pass.length < 6) { setErr('הסיסמה חייבת להיות לפחות 6 תווים'); return }
    if (pass !== pass2) { setErr('הסיסמאות לא זהות'); return }
    setBusy(true)
    try {
      const email = `${c.toLowerCase()}@shilo.app`
      const { data: up, error: upErr } = await supabase.auth.signUp({ email, password: pass })
      if (upErr) {
        setBusy(false)
        setErr(/already|exists|registered/i.test(upErr.message)
          ? 'הקוד הזה כבר בשימוש. התחבר עם השם והסיסמה שלך.'
          : 'ההרשמה נכשלה: ' + upErr.message)
        return
      }
      // מוודאים סשן פעיל (יש הגדרות שבהן signUp לא מחבר אוטומטית)
      let uid = up?.user?.id
      if (!up?.session) {
        const { data: si, error: siErr } = await supabase.auth.signInWithPassword({ email, password: pass })
        if (siErr) { setBusy(false); setErr('ההרשמה הצליחה אך הכניסה נכשלה. נסה להתחבר עם השם והסיסמה.'); return }
        uid = si?.user?.id
      }
      // מקשרים את החשבון לכרטיס העובד
      const empId = await claimEmployeeCode(c, uid)
      if (!empId) {
        await supabase.auth.signOut()
        setBusy(false)
        setErr('הקוד לא נמצא או כבר שויך לחשבון אחר. בקש קוד מעודכן משי.')
        return
      }
      window.location.reload()
    } catch (e2) {
      setBusy(false); setErr('ההרשמה נכשלה: ' + (e2.message || e2))
    }
  }

  return (
    <div style={{ minHeight: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: 'var(--paper)' }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 13, marginBottom: 28 }}>
          <span className="brand-mark" style={{ width: 48, height: 48, fontSize: 26 }}>ש</span>
          <div>
            <div style={{ fontFamily: '"Secular One", sans-serif', fontSize: 22, lineHeight: 1 }}>שילה</div>
            <div className="t-meta" style={{ marginTop: 3 }}>עיצוב ומיתוג לאירועים</div>
          </div>
        </div>

        {mode === 'login' ? (
          <>
            <div className="t-h1" style={{ marginBottom: 4 }}>בוקר טוב.</div>
            <div className="muted" style={{ fontSize: 15, marginBottom: 24 }}>מה על הלוח היום?</div>
            <form onSubmit={login} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label className="t-meta" style={{ display: 'block', marginBottom: 6 }}>שם</label>
                <input type="text" required value={user} onChange={e => setUser(e.target.value)}
                  autoComplete="username" placeholder="השם שלך" style={darkField} />
              </div>
              <div>
                <label className="t-meta" style={{ display: 'block', marginBottom: 6 }}>סיסמה</label>
                <input type="password" required value={pass} onChange={e => setPass(e.target.value)}
                  autoComplete="current-password" dir="ltr" style={{ ...darkField, textAlign: 'start' }} />
              </div>
              {err && <div style={{ color: '#E5735B', fontSize: 13, fontWeight: 500 }}>{err}</div>}
              <button type="submit" disabled={busy} className="btn btn-solid"
                style={{ height: 52, fontSize: 16, marginTop: 4, opacity: busy ? .7 : 1 }}>
                {busy ? 'מתחבר…' : 'כניסה'}
              </button>
            </form>
            <button className="btn btn-ghost" style={{ width: '100%', marginTop: 14, color: 'var(--gold)' }}
              onClick={() => { setMode('join'); setErr('') }}>
              יש לי קוד הצטרפות ←
            </button>
          </>
        ) : (
          <>
            <div className="t-h1" style={{ marginBottom: 4 }}>ברוך הבא לצוות.</div>
            <div className="muted" style={{ fontSize: 15, marginBottom: 24 }}>הזן את הקוד שקיבלת ובחר סיסמה.</div>
            <form onSubmit={join} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label className="t-meta" style={{ display: 'block', marginBottom: 6 }}>קוד הצטרפות</label>
                <input type="text" required value={code} onChange={e => setCode(e.target.value)}
                  placeholder="ABC123" dir="ltr"
                  style={{ ...darkField, textAlign: 'center', letterSpacing: '.18em', fontWeight: 700, textTransform: 'uppercase' }} />
              </div>
              <div>
                <label className="t-meta" style={{ display: 'block', marginBottom: 6 }}>בחר סיסמה</label>
                <input type="password" required value={pass} onChange={e => setPass(e.target.value)}
                  autoComplete="new-password" dir="ltr" style={{ ...darkField, textAlign: 'start' }} />
              </div>
              <div>
                <label className="t-meta" style={{ display: 'block', marginBottom: 6 }}>אימות סיסמה</label>
                <input type="password" required value={pass2} onChange={e => setPass2(e.target.value)}
                  autoComplete="new-password" dir="ltr" style={{ ...darkField, textAlign: 'start' }} />
              </div>
              {err && <div style={{ color: '#E5735B', fontSize: 13, fontWeight: 500 }}>{err}</div>}
              <button type="submit" disabled={busy} className="btn btn-solid"
                style={{ height: 52, fontSize: 16, marginTop: 4, opacity: busy ? .7 : 1 }}>
                {busy ? 'מצטרף…' : 'הצטרפות'}
              </button>
            </form>
            <button className="btn btn-ghost" style={{ width: '100%', marginTop: 14, color: 'var(--ink45)' }}
              onClick={() => { setMode('login'); setErr('') }}>
              → חזרה לכניסה
            </button>
            <div className="t-meta" style={{ marginTop: 16, textAlign: 'center', lineHeight: 1.7 }}>
              אחרי ההצטרפות תיכנס עם <b>השם שלך</b> והסיסמה שבחרת.
            </div>
          </>
        )}
      </div>
    </div>
  )
}
