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
  backdrop: '#E4DFD4', carpet: '#E9E2D6', sign: '#E7E0D2', print: '#EAE6DC', other: '#E9E5DB',
}
export function Thumb({ cat, size = 48, label }) {
  return (
    <div
      style={{
        width: size, height: size, flex: 'none', borderRadius: 6, overflow: 'hidden',
        position: 'relative',
        background: `repeating-linear-gradient(135deg, #F3EFE6 0 6px, ${catStroke[cat] || '#E6E1D6'} 6px 12px)`,
        border: '1px solid var(--hair)',
      }}
      aria-hidden="true"
    >
      {label && (
        <span className="mono" style={{
          position: 'absolute', insetInlineEnd: 3, bottom: 2, fontSize: 8,
          color: 'var(--ink45)', background: 'rgba(255,255,255,.7)', padding: '0 2px', borderRadius: 2,
        }}>{label}</span>
      )}
    </div>
  )
}

export const catLabel = cat => CATEGORIES[cat] || 'פריט'
