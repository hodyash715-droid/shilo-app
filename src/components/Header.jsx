import React from 'react'

export default function Header({ view, setView, onNew }) {
  const tab = (id, label) => (
    <button
      onClick={() => setView(id)}
      className="btn btn-ghost"
      style={{
        height: 34, padding: '0 14px', borderRadius: 999,
        fontWeight: 600,
        background: view === id ? 'var(--ink)' : 'transparent',
        color: view === id ? '#fff' : 'var(--ink45)',
      }}
    >{label}</button>
  )

  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 20,
      background: 'color-mix(in srgb, var(--paper) 88%, transparent)',
      backdropFilter: 'blur(8px)',
      borderBottom: '1px solid var(--line)',
    }}>
      <div style={{ maxWidth: 1120, margin: '0 auto', padding: '10px 16px' }}
        className="row between gap-3">
        <div className="row gap-3" style={{ minWidth: 0 }}>
          <span className="brand-mark">ש</span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 16, lineHeight: 1.1 }}>שילה</div>
            <div className="t-meta truncate">עיצוב ומיתוג לאירועים</div>
          </div>
        </div>

        <nav className="row gap-2" style={{
          background: 'var(--card)', border: '1px solid var(--line)',
          borderRadius: 999, padding: 3,
        }}>
          {tab('board', 'לוח עבודות')}
          {tab('calendar', 'לוח שנה')}
        </nav>

        <button className="btn btn-solid" onClick={onNew}>
          <span style={{ fontSize: 18, marginTop: -2 }}>＋</span>
          <span className="hide-sm">עבודה חדשה</span>
        </button>
      </div>
    </header>
  )
}
