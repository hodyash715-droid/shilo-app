import React from 'react'
import { TABS } from '../nav.jsx'

export default function Header({ view, setView, onNew, email, onSignOut }) {
  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 20,
      background: 'color-mix(in srgb, var(--paper) 88%, transparent)',
      backdropFilter: 'blur(8px)',
      borderBottom: '1px solid var(--line)',
    }}>
      <div style={{ maxWidth: 1120, margin: '0 auto', padding: '10px 16px' }} className="row between gap-3">
        <div className="row gap-3" style={{ minWidth: 0 }}>
          <span className="brand-mark">ש</span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 16, lineHeight: 1.1 }}>שילה</div>
            <div className="t-meta truncate">מערכת ניהול</div>
          </div>
        </div>

        <nav className="row gap-1 only-desktop" style={{
          background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 999, padding: 3,
        }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setView(t.id)} className="btn btn-ghost"
              style={{
                height: 34, padding: '0 14px', borderRadius: 999, fontWeight: 600,
                background: view === t.id ? 'var(--gold)' : 'transparent',
                color: view === t.id ? 'var(--on-gold)' : 'var(--ink45)',
              }}>{t.label}</button>
          ))}
        </nav>

        <div className="row gap-2">
          <button className="btn btn-solid" onClick={onNew}>
            <span style={{ fontSize: 18, marginTop: -2 }}>＋</span>
            <span className="hide-sm">עבודה חדשה</span>
          </button>
          {onSignOut && (
            <button className="btn btn-ghost btn-sm" onClick={onSignOut} title={email || 'יציאה'} aria-label="יציאה">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
            </button>
          )}
        </div>
      </div>
    </header>
  )
}
