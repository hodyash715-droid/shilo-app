import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { drawSheet } from '../designer/drawing.js'

export default function DrawingSheet({ name, dims, parts, materials, stockOv, onClose }) {
  const cvRef = useRef(null)
  const [info, setInfo] = useState(null)
  const [saveErr, setSaveErr] = useState('')

  useEffect(() => {
    if (cvRef.current) setInfo(drawSheet(cvRef.current, { name, dims, parts, materials, stockOv }))
  }, [name, dims, parts, materials, stockOv])

  const savePng = () => {
    try {
      const a = document.createElement('a')
      a.download = `${(name || 'קוליסה').replace(/[\\/:*?"<>|]/g, '')}.png`
      a.href = cvRef.current.toDataURL('image/png')
      document.body.appendChild(a); a.click(); a.remove()
    } catch (e) { setSaveErr('השמירה נחסמה בדפדפן — השתמש ב“הדפס / PDF”.') }
  }

  // מחוץ לעץ של המסך — אחרת ה"fade-in" כולא את החלון מתחת לכותרת
  return createPortal((
    <div style={{
      position: 'fixed', inset: 0, zIndex: 90, background: 'rgba(0,0,0,.82)',
      display: 'flex', flexDirection: 'column',
    }}>
      <div className="row between gap-2 no-print" style={{
        padding: '10px 14px', background: 'var(--card)', borderBottom: '1px solid var(--line)',
      }}>
        <div className="row gap-2" style={{ minWidth: 0 }}>
          <span style={{ fontWeight: 700 }}>שרטוט ייצור</span>
          {info && <span className="t-meta mono">1:{info.ratio}</span>}
          {info && <span className="t-meta">· {info.totalBars} קורות</span>}
        </div>
        <div className="row gap-2">
          <button className="btn btn-sm" onClick={savePng}>שמור PNG</button>
          <button className="btn btn-sm btn-solid" onClick={() => window.print()}>הדפס / PDF</button>
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="סגור">✕</button>
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: 14, display: 'grid', placeItems: 'start center' }}>
        {/* במסך צר גוללים לצדדים — שרטוט קטן מדי לא שווה כלום */}
        <div className="print-sheet" style={{
          background: '#fff', borderRadius: 4, boxShadow: '0 20px 50px rgba(0,0,0,.6)',
          width: 'min(100%, 1100px)', minWidth: 760,
        }}>
          <canvas ref={cvRef} style={{ width: '100%', height: 'auto', display: 'block' }} />
        </div>
        {saveErr && <div className="no-print" style={{ color: '#E5735B', fontSize: 13, marginTop: 10 }}>{saveErr}</div>}
        <div className="muted no-print" style={{ fontSize: 12.5, marginTop: 10, textAlign: 'center', lineHeight: 1.7 }}>
          בהדפסה בחר <b>A4 לרוחב</b> ו“ללא שוליים”. הדף מוכן למסירה לנגר.
        </div>
      </div>
    </div>
  ), document.body)
}
