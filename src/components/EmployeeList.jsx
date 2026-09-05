import React, { useState } from 'react'
import { EmpAvatar } from './ui.jsx'
import EmployeeEdit from './EmployeeEdit.jsx'

export default function EmployeeList({ employees, onSaved, onDeleted }) {
  const [edit, setEdit] = useState(undefined) // undefined=closed, null=new, emp=edit

  return (
    <>
      <button className="btn btn-solid" style={{ width: '100%', height: 46, marginBottom: 12 }} onClick={() => setEdit(null)}>
        <span style={{ fontSize: 18, marginTop: -2 }}>＋</span> הוסף עובד
      </button>

      {employees.length === 0 ? (
        <div className="card" style={{ padding: 24, textAlign: 'center', borderStyle: 'dashed' }}>
          <div style={{ fontWeight: 600 }}>אין עדיין עובדים</div>
          <div className="muted" style={{ fontSize: 13 }}>הוסף את חברי הצוות כדי לשבץ אותם לאירועים.</div>
        </div>
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          {employees.map((e, i) => (
            <button key={e.id} onClick={() => setEdit(e)} style={{
              appearance: 'none', border: 0, width: '100%', textAlign: 'start', cursor: 'pointer',
              background: 'transparent', color: 'var(--ink)', font: 'inherit',
              padding: 13, display: 'flex', alignItems: 'center', gap: 12,
              borderTop: i ? '1px solid var(--hair)' : 0,
            }}>
              <EmpAvatar name={e.name} />
              <div className="grow" style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 15 }} className="truncate">{e.name}</div>
                <div className="t-meta truncate">{e.role || 'ללא תפקיד'}{e.phone ? ` · ${e.phone}` : ''}</div>
              </div>
              {e.rate != null && <div className="mono t-meta" style={{ flex: 'none' }}>{e.rate}₪/שעה</div>}
            </button>
          ))}
        </div>
      )}

      {edit !== undefined && (
        <EmployeeEdit emp={edit}
          onClose={() => setEdit(undefined)}
          onSaved={(s) => { onSaved(s); setEdit(undefined) }}
          onDeleted={(id) => { onDeleted(id); setEdit(undefined) }} />
      )}
    </>
  )
}
