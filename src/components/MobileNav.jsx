import React from 'react'

const IconBoard = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" />
  </svg>
)
const IconCal = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
  </svg>
)

export default function MobileNav({ view, setView, onNew }) {
  return (
    <nav className="tabbar only-mobile">
      <button className="tabbar-btn" data-active={view === 'board'} onClick={() => setView('board')}>
        <IconBoard />עבודות
      </button>

      <button className="fab" onClick={onNew} aria-label="עבודה חדשה">＋</button>

      <button className="tabbar-btn" data-active={view === 'calendar'} onClick={() => setView('calendar')}>
        <IconCal />לוח שנה
      </button>
    </nav>
  )
}
