import React, { useEffect, useState } from 'react'
import { pushState, subscribePush, unsubscribePush } from '../push.js'

// כרטיס הפעלת התראות. Push אמיתי כשאפשר, אחרת נופל בעדינות
// להתראת דפדפן בזמן שהאפליקציה פתוחה.
export default function NotifOptIn({ hideWhenSettled = false, employeeId = null, isManager = false }) {
  const [state, setState] = useState('loading')   // loading|on|off|denied|ios-install|unsupported
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const refresh = () => pushState().then(setState)
  useEffect(() => { refresh() }, [])

  const turnOn = async () => {
    setBusy(true); setErr('')
    const r = await subscribePush({ employeeId, isManager })
    if (!r.ok && r.reason && !['denied', 'default', 'ios-install'].includes(r.reason)) {
      setErr('ההפעלה נכשלה: ' + r.reason)
    }
    await refresh(); setBusy(false)
  }
  const turnOff = async () => {
    setBusy(true); await unsubscribePush(); await refresh(); setBusy(false)
  }

  if (state === 'loading') return null
  if (hideWhenSettled && (state === 'on' || state === 'denied' || state === 'unsupported')) return null

  const TEXT = {
    on: 'התראות פעילות — יגיעו לטלפון גם כשהאפליקציה סגורה.',
    off: 'הפעל כדי לקבל התראה על הזמנות, אישורי הצעות ושיבוצים.',
    denied: 'ההתראות חסומות בדפדפן. פתח את הגדרות האתר והרשה התראות.',
    'ios-install': 'באייפון צריך קודם להוסיף את שילה למסך הבית: שתף ← "הוסף למסך הבית", ואז לפתוח משם.',
    unsupported: 'הדפדפן הזה לא תומך בהתראות. הפעמון באפליקציה עובד כרגיל.',
  }

  return (
    <div className="card" style={{ padding: 14, marginBottom: 20 }}>
      <div className="row between gap-3">
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>🔔 התראות לטלפון</div>
          <div className="muted" style={{ fontSize: 12.5, marginTop: 3, lineHeight: 1.6 }}>
            {TEXT[state]}
          </div>
        </div>
        <div style={{ flex: '0 0 auto' }}>
          {state === 'off' && (
            <button className="btn btn-sm btn-solid" onClick={turnOn} disabled={busy}>
              {busy ? 'מפעיל…' : 'הפעל'}
            </button>
          )}
          {state === 'on' && (
            <div className="row gap-2">
              <span className="chip chip-go">פעיל</span>
              <button className="btn btn-ghost btn-sm" onClick={turnOff} disabled={busy}>כבה</button>
            </div>
          )}
        </div>
      </div>
      {err && <div style={{ color: '#E5735B', fontSize: 12.5, marginTop: 8 }}>{err}</div>}
      <div className="t-meta" style={{ marginTop: 10, lineHeight: 1.7 }}>
        הפעמון באפליקציה עובד תמיד, גם בלי זה.
      </div>
    </div>
  )
}
