// ============================================================
// המרת עבודה מצורת המסך (camelCase) לשורת DB (snake_case).
//
// מופרד מ-db.js כדי שיהיה אפשר לבדוק אותו: db.js מושך את
// supabase.js, שקורא import.meta.env ולא רץ תחת node --test.
//
// הסיבה שזה קיים בכלל: fromRow מחזיר עמודת שעה ריקה כמחרוזת ''
// (כדי ש-<input type="time"> יהיה מבוקר), המסך מחזיר את אותה
// מחרוזת בשמירה, ו-Postgres פוסל אותה:
//   invalid input syntax for type time: ""
// שי לא הצליח לשמור עבודה בגלל זה.
// ============================================================

// שדה המסך ← עמודה במסד
export const JOB_COLS = {
  title: 'title', client: 'client', contact: 'contact', eventDate: 'event_date',
  status: 'status', price: 'price', items: 'items', team: 'team', note: 'note',
  venue: 'venue', address: 'address', eventTime: 'event_time', clientId: 'client_id',
  showItemPrices: 'show_item_prices',
  service: 'service', setupDate: 'setup_date', setupTime: 'setup_time',
  teardownDate: 'teardown_date', teardownTime: 'teardown_time',
  contactName: 'contact_name', contactPhone: 'contact_phone',
  accessNotes: 'access_notes', referenceUrl: 'reference_url',
  quoteStatus: 'quote_status', quoteSentAt: 'quote_sent_at',
  quoteDecidedAt: 'quote_decided_at',
}

// עמודות שמחרוזת ריקה אינה ערך חוקי עבורן
export const DATETIME_COLS = new Set([
  'event_date', 'event_time', 'setup_date', 'setup_time',
  'teardown_date', 'teardown_time', 'quote_sent_at', 'quote_decided_at',
])

export const dtSafe = (col, v) => (DATETIME_COLS.has(col) && v === '' ? null : v)

// מיפוי patch חלקי — רק השדות שנשלחו, כמו ב-updateJob
export function jobPatchToRow(patch = {}) {
  const row = {}
  for (const k in patch) {
    const col = JOB_COLS[k]
    if (col !== undefined) row[col] = dtSafe(col, patch[k])
  }
  return row
}
