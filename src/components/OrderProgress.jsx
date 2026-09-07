import React from 'react'

// ארבעת השלבים שהמפיקה עוברת. תמיד ברור איפה ההזמנה עומדת ומה הלאה.
const STEPS = [
  { key: 'sent_in',  label: 'נשלחה' },
  { key: 'pricing',  label: 'בתמחור' },
  { key: 'quote',    label: 'הצעה אצלך' },
  { key: 'approved', label: 'אושרה' },
]

const AT = { none: 0, needs_quote: 1, sent: 2, approved: 3, rejected: 1 }

export default function OrderProgress({ status }) {
  const at = AT[status] ?? 0

  // סגור וגמור — ציר מלא הוא רעש
  if (status === 'approved') {
    return (
      <div className="row gap-2" style={{
        margin: '12px 0 4px', padding: '7px 10px', borderRadius: 8,
        background: 'var(--go-bg)', border: '1px solid var(--go)',
      }}>
        <span style={{ color: 'var(--go-fg)', fontWeight: 700, fontSize: 13 }}>✓ ההזמנה אושרה</span>
        <span className="t-meta">שי בהפקה</span>
      </div>
    )
  }

  const rejected = status === 'rejected'
  const tone = rejected ? '#E5735B' : 'var(--gold)'

  return (
    <div style={{ margin: '12px 0 4px' }}>
      <div className="row" style={{ gap: 0 }}>
        {STEPS.map((s, i) => {
          const done = i <= at
          const isNow = i === at
          return (
            <React.Fragment key={s.key}>
              {i > 0 && (
                <div style={{
                  flex: 1, height: 2, marginTop: 0,
                  background: i <= at ? tone : 'var(--line)',
                }} />
              )}
              <div style={{
                width: isNow ? 11 : 8, height: isNow ? 11 : 8, borderRadius: 999,
                flex: '0 0 auto',
                background: done ? tone : 'var(--card-2)',
                border: `2px solid ${done ? tone : 'var(--line)'}`,
                boxShadow: isNow ? `0 0 0 3px ${rejected ? 'rgba(229,115,91,.18)' : 'rgba(238,196,33,.18)'}` : 'none',
              }} />
            </React.Fragment>
          )
        })}
      </div>
      <div className="row between" style={{ marginTop: 6 }}>
        {STEPS.map((s, i) => (
          <span key={s.key} style={{
            fontSize: 10.5, fontWeight: i === at ? 700 : 500,
            color: i === at ? (rejected ? '#E5735B' : 'var(--gold-fg)') : 'var(--ink45)',
            flex: i === 0 || i === STEPS.length - 1 ? '0 0 auto' : 1,
            textAlign: i === 0 ? 'start' : i === STEPS.length - 1 ? 'end' : 'center',
          }}>{i === at && rejected ? 'צריך תיקון' : s.label}</span>
        ))}
      </div>
    </div>
  )
}
