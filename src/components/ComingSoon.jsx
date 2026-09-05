import React from 'react'
import { ICONS } from '../nav.jsx'

export default function ComingSoon({ icon, title, lines }) {
  const Icon = ICONS[icon]
  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: 16 }}>
      <div className="card" style={{ padding: 30, textAlign: 'center' }}>
        <div style={{
          width: 56, height: 56, borderRadius: 14, margin: '0 auto 14px',
          background: 'var(--gold-bg)', color: 'var(--gold)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon width={28} height={28} />
        </div>
        <div className="t-h2" style={{ marginBottom: 6 }}>{title}</div>
        <span className="chip chip-signal" style={{ marginBottom: 14 }}>בקרוב</span>
        <div className="muted" style={{ fontSize: 14, lineHeight: 1.7, marginTop: 12 }}>
          {lines.map((l, i) => <div key={i}>{l}</div>)}
        </div>
      </div>
    </div>
  )
}
