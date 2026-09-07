import React, { useState } from 'react'

const supported = typeof window !== 'undefined' && 'Notification' in window

// בקשת הרשאה להתראות דפדפן. נשאלת רק בלחיצה — דפדפנים חוסמים בקשות ספונטניות.
export default function NotifOptIn({ hideWhenSettled = false }) {
  const [state, setState] = useState(supported ? Notification.permission : 'unsupported')

  const ask = async () => {
    try { setState(await Notification.requestPermission()) }
    catch { setState('denied') }
  }

  if (hideWhenSettled && state !== 'default') return null

  const text = {
    unsupported: 'הדפדפן הזה לא תומך בהתראות.',
    granted: 'התראות פעילות — תקבל חיווי כשהאפליקציה פתוחה.',
    denied: 'ההתראות חסומות. אפשר לפתוח אותן בהגדרות האתר בדפדפן.',
    default: 'הפעל התראות כדי לקבל חיווי על הזמנות, אישורי הצעות ושיבוצים.',
  }[state] || ''

  return (
    <div className="card" style={{ padding: 14, marginBottom: 20 }}>
      <div className="row between gap-3">
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>🔔 התראות</div>
          <div className="muted" style={{ fontSize: 12.5, marginTop: 3, lineHeight: 1.6 }}>{text}</div>
        </div>
        {state === 'default' && (
          <button className="btn btn-sm btn-solid" style={{ flex: '0 0 auto' }} onClick={ask}>הפעל</button>
        )}
        {state === 'granted' && <span className="chip chip-go" style={{ flex: '0 0 auto' }}>פעיל</span>}
      </div>
      <div className="t-meta" style={{ marginTop: 10, lineHeight: 1.7 }}>
        הפעמון באפליקציה עובד תמיד. ההרשאה מוסיפה חיווי של הדפדפן כשהאפליקציה פתוחה.
      </div>
    </div>
  )
}
