import React, { useState } from 'react'
import { AVAIL, AVAIL_CUSTOM, shortTime, fmtDate } from '../data.js'

// בוחר זמינות ליום אחד — 5 אפשרויות מוכנות + טווח שעות מדויק
export default function AvailPicker({ title, date, current, onPick, onClose }) {
  const [cust, setCust] = useState({
    from: current?.start_time || '09:00',
    to: current?.end_time || '17:00',
  })

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,.6)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    }}>
      <div onClick={e => e.stopPropagation()} className="card"
        style={{ width: 'min(420px,100%)', margin: 12, padding: 16, borderRadius: 16, maxHeight: '86vh', overflowY: 'auto' }}>
        <div style={{ fontWeight: 700, marginBottom: 2 }}>{title}</div>
        <div className="t-meta" style={{ marginBottom: 14 }}>{fmtDate(date)}</div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {AVAIL.map(a => {
            const on = current?.status === a.id
            return (
              <button key={a.id} className="btn" style={{
                justifyContent: 'flex-start', gap: 10, height: 46,
                borderColor: on ? a.color : 'var(--line)',
                background: on ? 'var(--card-2)' : 'var(--card)',
              }} onClick={() => onPick(a.id)}>
                <span style={{ width: 14, height: 14, borderRadius: 4, background: a.color, flex: 'none' }} />
                {a.label}
                {on && <span style={{ marginInlineStart: 'auto', color: a.color, fontWeight: 800 }}>✓</span>}
              </button>
            )
          })}

          <div className="row gap-2" style={{ margin: '6px 0 2px' }}>
            <span style={{ height: 1, background: 'var(--hair)', flex: 1 }} />
            <span className="t-meta">או שעות מדויקות</span>
            <span style={{ height: 1, background: 'var(--hair)', flex: 1 }} />
          </div>
          <div className="row gap-2">
            <div className="grow">
              <div className="t-meta" style={{ marginBottom: 4 }}>משעה</div>
              <input className="field" type="time" dir="ltr" value={cust.from}
                onChange={e => setCust(c => ({ ...c, from: e.target.value }))} />
            </div>
            <div className="grow">
              <div className="t-meta" style={{ marginBottom: 4 }}>עד שעה</div>
              <input className="field" type="time" dir="ltr" value={cust.to}
                onChange={e => setCust(c => ({ ...c, to: e.target.value }))} />
            </div>
          </div>
          <button className="btn btn-solid" style={{ height: 46, gap: 10 }}
            onClick={() => onPick('custom', cust.from, cust.to)}>
            <span style={{ width: 14, height: 14, borderRadius: 4, background: AVAIL_CUSTOM.color, flex: 'none' }} />
            שמור {shortTime(cust.from)}–{shortTime(cust.to)}
          </button>

          <button className="btn btn-sm" style={{ color: 'var(--ink45)', marginTop: 4 }}
            onClick={() => onPick(null)}>נקה</button>
        </div>
      </div>
    </div>
  )
}
