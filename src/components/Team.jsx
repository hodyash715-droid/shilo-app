import React from 'react'
import EmployeeList from './EmployeeList.jsx'

export default function Team({ employees, onSaved, onDeleted }) {
  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: 16 }}>
      <div className="row between" style={{ marginBottom: 12 }}>
        <div className="row gap-2">
          <span style={{ width: 4, height: 18, background: 'var(--gold)', borderRadius: 2 }} />
          <span style={{ fontWeight: 700, fontSize: 16 }}>הצוות</span>
        </div>
        <span className="t-meta">{employees.length} עובדים</span>
      </div>

      <EmployeeList employees={employees} onSaved={onSaved} onDeleted={onDeleted} />

      <div className="card" style={{ padding: 18, marginTop: 18, borderStyle: 'dashed', textAlign: 'center' }}>
        <span className="chip chip-signal" style={{ marginBottom: 8 }}>בקרוב</span>
        <div style={{ fontWeight: 600, marginTop: 8 }}>זמינות ושיבוץ</div>
        <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>רשת שבועית לשיבוץ הצוות למשמרות הקמה ופירוק.</div>
      </div>
    </div>
  )
}
