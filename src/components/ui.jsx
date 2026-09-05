import React from 'react'
import { statusById, CATEGORIES } from '../data.js'

// תג סטטוס — צבע לפי tone (neutral / signal / go)
export function StatusPill({ id, size }) {
  const s = statusById[id]
  if (!s) return null
  const cls = s.tone === 'signal' ? 'chip chip-signal'
    : s.tone === 'go' ? 'chip chip-go'
    : 'chip'
  return (
    <span className={cls} style={size === 'sm' ? { height: 22, fontSize: 11 } : undefined}>
      <span className="chip-dot" />
      {s.label}
    </span>
  )
}

// placeholder לתמונת פריט — נשמר hook לתמונה אמיתית בעתיד (prop src)
const catStroke = {
  backdrop: '#2C2A24', carpet: '#2E2A20', sign: '#312B1E', print: '#2A2A2E', other: '#2A2924',
}
export function Thumb({ cat, size = 48, label }) {
  return (
    <div
      style={{
        width: size, height: size, flex: 'none', borderRadius: 6, overflow: 'hidden',
        position: 'relative',
        background: `repeating-linear-gradient(135deg, #1C1C20 0 6px, ${catStroke[cat] || '#28271F'} 6px 12px)`,
        border: '1px solid var(--line)',
      }}
      aria-hidden="true"
    >
      {label && (
        <span className="mono" style={{
          position: 'absolute', insetInlineEnd: 3, bottom: 2, fontSize: 8,
          color: 'var(--ink45)', background: 'rgba(0,0,0,.55)', padding: '0 2px', borderRadius: 2,
        }}>{label}</span>
      )}
    </div>
  )
}

export const catLabel = cat => CATEGORIES[cat] || 'פריט'

export const initials = (name) => {
  const p = (name || '').trim().split(/\s+/)
  return (((p[0] || '')[0] || '') + ((p[1] || '')[0] || '')) || '?'
}

export function EmpAvatar({ name, size = 38 }) {
  return (
    <span style={{
      width: size, height: size, flex: 'none', borderRadius: 999,
      background: 'var(--gold-bg)', color: 'var(--gold-fg)',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.36, fontWeight: 700, border: '1px solid var(--line)',
    }}>{initials(name)}</span>
  )
}
