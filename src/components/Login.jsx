import React, { useState } from 'react'
import { supabase } from '../supabase.js'

// שם משתמש → אימייל (Supabase עובד עם אימייל; המשתמש מקליד שם בלבד).
// כינויים בעברית ממופים ללטינית, ואז מוסיפים דומיין קבוע.
const ALIASES = { 'שי': 'shai' }
const toEmail = (u) => {
  const raw = u.trim()
  if (raw.includes('@')) return raw
  const local = (ALIASES[raw] || raw).toLowerCase()
  return `${local}@shilo.app`
}

export default function Login() {
  const [user, setUser] = useState('')
  const [pass, setPass] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    setErr(''); setBusy(true)
    const { error } = await supabase.auth.signInWithPassword({ email: toEmail(user), password: pass })
    setBusy(false)
    if (error) setErr('שם משתמש או סיסמה שגויים')
  }

  const darkField = {
    width: '100%', height: 52, borderRadius: 10, background: '#1A1A1D',
    border: '1px solid #2E2E33', color: 'var(--ink)', padding: '0 14px',
    font: 'inherit', fontSize: 16,
  }

  return (
    <div style={{
      minHeight: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20, background: 'var(--paper)',
    }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 13, marginBottom: 28 }}>
          <span className="brand-mark" style={{ width: 48, height: 48, fontSize: 26 }}>ש</span>
          <div>
            <div style={{ fontFamily: '"Secular One", sans-serif', fontSize: 22, lineHeight: 1 }}>שילה</div>
            <div className="t-meta" style={{ marginTop: 3 }}>עיצוב ומיתוג לאירועים</div>
          </div>
        </div>

        <div className="t-h1" style={{ marginBottom: 4 }}>בוקר טוב.</div>
        <div className="muted" style={{ fontSize: 15, marginBottom: 24 }}>מה על הלוח היום?</div>

        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label className="t-meta" style={{ display: 'block', marginBottom: 6 }}>שם משתמש</label>
            <input type="text" required value={user} onChange={e => setUser(e.target.value)}
              autoComplete="username" placeholder="שי" style={darkField} />
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

        <div className="t-meta" style={{ marginTop: 22, textAlign: 'center', lineHeight: 1.6 }}>
          הכניסה מיועדת לצוות שילה בלבד.
        </div>
      </div>
    </div>
  )
}
