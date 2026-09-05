import React from 'react'
import { TABS } from '../nav.jsx'

export default function MobileNav({ view, setView }) {
  return (
    <nav className="tabbar only-mobile">
      {TABS.map(t => {
        const Icon = t.icon
        return (
          <button key={t.id} className="tabbar-btn" data-active={view === t.id} onClick={() => setView(t.id)}>
            <Icon width={21} height={21} />
            {t.label}
          </button>
        )
      })}
    </nav>
  )
}
