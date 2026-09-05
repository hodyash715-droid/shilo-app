import React from 'react'
import { VERSION } from '../version.js'

export default function Settings({ name, email, onSignOut }) {
  const Row = ({ label, value }) => (
    <div className="row between" style={{ padding: '13px 14px', borderTop: '1px solid var(--hair)' }}>
      <span className="t-meta">{label}</span>
      <span style={{ fontWeight: 600, fontSize: 14 }}>{value}</span>
    </div>
  )
  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: 16 }}>
      <div className="row gap-2" style={{ marginBottom: 12 }}>
        <span style={{ width: 4, height: 18, background: 'var(--gold)', borderRadius: 2 }} />
        <span style={{ fontWeight: 700, fontSize: 16 }}>הגדרות</span>
      </div>

      <div className="card" style={{ overflow: 'hidden', marginBottom: 16 }}>
        <div className="row gap-3" style={{ padding: 16 }}>
          <span className="brand-mark">ש</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>{name}</div>
            <div className="t-meta mono" style={{ direction: 'ltr' }}>{email}</div>
          </div>
        </div>
        <Row label="חשבון" value="צוות שילה" />
        <Row label="גרסה" value={<span className="mono">{VERSION}</span>} />
      </div>

      <button className="btn" onClick={onSignOut} style={{ width: '100%', color: '#E5735B', height: 46 }}>
        יציאה מהחשבון
      </button>

      <div className="t-meta" style={{ textAlign: 'center', marginTop: 20, lineHeight: 1.7 }}>
        שילה — מערכת ניהול עבודות עיצוב ומיתוג לאירועים.
      </div>
    </div>
  )
}
