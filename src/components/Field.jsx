import React, { useState } from 'react'
import { fmtDate, relLabel, daysUntil, shiftKindLabel } from '../data.js'
import { Thumb } from './ui.jsx'
import InventoryEdit from './InventoryEdit.jsx'

const notReturned = it => !it.returned

export default function Field({ jobs, shifts, inventory, onItemReturn, onAllReturned, onInvSaved, onInvDeleted }) {
  const [invEdit, setInvEdit] = useState(undefined)

  // עבודות שהציוד שלהן בשטח: הותקן, ועוד לא הכול חזר
  const inField = jobs.filter(j => j.status === 'installed' && j.items.some(notReturned))
  const unitsOut = inField.reduce((s, j) => s + j.items.filter(notReturned).reduce((n, it) => n + (Number(it.qty) || 0), 0), 0)

  // כמה יחידות בחוץ לכל פריט מלאי (התאמה לפי שם)
  const outByName = {}
  for (const j of inField) for (const it of j.items.filter(notReturned)) {
    outByName[it.name] = (outByName[it.name] || 0) + (Number(it.qty) || 0)
  }

  const sectionTitle = (t, extra) => (
    <div className="row between" style={{ marginBottom: 10 }}>
      <div className="row gap-2">
        <span style={{ width: 4, height: 18, background: 'var(--gold)', borderRadius: 2 }} />
        <span style={{ fontWeight: 700, fontSize: 16 }}>{t}</span>
      </div>
      {extra}
    </div>
  )

  return (
    <div style={{ maxWidth: 820, margin: '0 auto', padding: 16 }}>
      {sectionTitle('ציוד בשטח', <span className="t-meta">{unitsOut} יחידות</span>)}

      {inField.length === 0 ? (
        <div className="card" style={{ padding: 28, textAlign: 'center', marginBottom: 26 }}>
          <div style={{ fontWeight: 600, marginBottom: 2 }}>אין ציוד בשטח</div>
          <div className="muted" style={{ fontSize: 13 }}>כשעבודה עוברת ל“הותקן”, הציוד שלה יופיע כאן עד שיחזור למחסן.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 26 }}>
          {inField.map(job => {
            const teardown = shifts.find(s => s.job_id === job.id && s.kind === 'teardown')
            const setup = shifts.find(s => s.job_id === job.id && s.kind === 'setup')
            const late = teardown?.date && daysUntil(teardown.date) < 0
            return (
              <div key={job.id} className="card" style={{ overflow: 'hidden', border: late ? '1px solid #B23A2A' : undefined }}>
                <div style={{ padding: 14, borderBottom: '1px solid var(--hair)' }}>
                  <div className="row between gap-2">
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 15.5 }} className="truncate">{job.title || job.client}</div>
                      <div className="t-meta truncate">{job.client}</div>
                    </div>
                    {teardown && (
                      <div style={{ textAlign: 'end', flex: 'none' }}>
                        <div className="mono" style={{ fontWeight: 700, fontSize: 14, color: late ? '#E5735B' : 'var(--ink)' }}>
                          {teardown.start_time}
                        </div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: late ? '#E5735B' : 'var(--ink45)' }}>
                          {late ? `פירוק באיחור · ${relLabel(teardown.date)}` : `פירוק ${fmtDate(teardown.date)}`}
                        </div>
                      </div>
                    )}
                  </div>
                  {setup && (
                    <div className="t-meta" style={{ marginTop: 6 }}>
                      בשטח מאז <span className="mono">{setup.start_time}</span> · {fmtDate(setup.date)}
                    </div>
                  )}
                </div>

                {job.items.map((it, i) => (
                  <div key={i} className="row gap-3" style={{
                    padding: '10px 14px', borderTop: i ? '1px solid var(--hair)' : 0,
                    opacity: it.returned ? .5 : 1,
                  }}>
                    <Thumb cat={it.cat} size={34} />
                    <div className="grow" style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }} className="truncate">
                        <span className="mono">{it.qty}×</span> {it.name}
                      </div>
                    </div>
                    {it.returned
                      ? <span className="chip chip-go" style={{ flex: 'none' }}>חזר ✓</span>
                      : <button className="btn btn-sm" style={{ flex: 'none' }} onClick={() => onItemReturn(job.id, i)}>חזר למחסן</button>}
                  </div>
                ))}

                <div className="row gap-2" style={{ padding: 12, borderTop: '1px solid var(--hair)' }}>
                  <button className="btn btn-solid grow" onClick={() => onAllReturned(job.id)}>הכל חזר למחסן ✓</button>
                  {job.contact && <a className="btn" href={`tel:${job.contact}`} style={{ flex: 'none', textDecoration: 'none' }}>איש קשר</a>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* מלאי */}
      {sectionTitle('מלאי', <button className="btn btn-sm" onClick={() => setInvEdit(null)}>＋ פריט</button>)}

      {inventory.length === 0 ? (
        <div className="card" style={{ padding: 24, textAlign: 'center', borderStyle: 'dashed' }}>
          <div style={{ fontWeight: 600 }}>המלאי ריק</div>
          <div className="muted" style={{ fontSize: 13 }}>הוסף את הציוד הרב-פעמי (קוליסות, שטיחים, טראס…).</div>
        </div>
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div className="row" style={{ padding: '9px 14px', borderBottom: '1px solid var(--line)', background: 'var(--card-2)' }}>
            <div className="grow t-meta">פריט</div>
            <div className="t-meta" style={{ width: 52, textAlign: 'center' }}>סה״כ</div>
            <div className="t-meta" style={{ width: 52, textAlign: 'center' }}>בחוץ</div>
            <div className="t-meta" style={{ width: 52, textAlign: 'center' }}>פנוי</div>
          </div>
          {inventory.map((inv, i) => {
            const out = outByName[inv.name] || 0
            const free = (inv.total || 0) - out
            return (
              <button key={inv.id} onClick={() => setInvEdit(inv)} style={{
                appearance: 'none', border: 0, width: '100%', textAlign: 'start', cursor: 'pointer',
                background: 'transparent', color: 'var(--ink)', font: 'inherit',
                padding: '11px 14px', display: 'flex', alignItems: 'center',
                borderTop: i ? '1px solid var(--hair)' : 0,
              }}>
                <div className="grow truncate" style={{ fontSize: 14, fontWeight: 500 }}>{inv.name}</div>
                <div className="mono" style={{ width: 52, textAlign: 'center', color: 'var(--ink45)' }}>{inv.total}</div>
                <div className="mono" style={{ width: 52, textAlign: 'center', color: out ? 'var(--gold)' : 'var(--ink45)' }}>{out}</div>
                <div className="mono" style={{ width: 52, textAlign: 'center', fontWeight: 700, color: free < 0 ? '#E5735B' : free === 0 ? 'var(--ink45)' : 'var(--go)' }}>{free}</div>
              </button>
            )
          })}
        </div>
      )}

      {invEdit !== undefined && (
        <InventoryEdit item={invEdit}
          onClose={() => setInvEdit(undefined)}
          onSaved={(s) => { onInvSaved(s); setInvEdit(undefined) }}
          onDeleted={(id) => { onInvDeleted(id); setInvEdit(undefined) }} />
      )}
    </div>
  )
}
