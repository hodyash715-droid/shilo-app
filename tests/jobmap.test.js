import { test } from 'node:test'
import assert from 'node:assert/strict'
import { jobPatchToRow, dtSafe, JOB_COLS, DATETIME_COLS } from '../src/jobmap.js'

// הבאג שהגיע לשי: שעת התקנה ריקה נשלחה כמחרוזת '' ו-Postgres פסל
// אותה עם "invalid input syntax for type time". השמירה נכשלה לגמרי.
test('שעה ריקה הופכת ל-null ולא למחרוזת ריקה', () => {
  const row = jobPatchToRow({ setupTime: '', teardownTime: '', eventTime: '' })
  assert.equal(row.setup_time, null)
  assert.equal(row.teardown_time, null)
  assert.equal(row.event_time, null)
})

test('תאריך ריק הופך ל-null', () => {
  const row = jobPatchToRow({ eventDate: '', setupDate: '', teardownDate: '' })
  assert.equal(row.event_date, null)
  assert.equal(row.setup_date, null)
  assert.equal(row.teardown_date, null)
})

test('שעה אמיתית עוברת כמו שהיא', () => {
  const row = jobPatchToRow({ eventTime: '19:30', teardownDate: '2026-11-20' })
  assert.equal(row.event_time, '19:30')
  assert.equal(row.teardown_date, '2026-11-20')
})

// מחרוזת ריקה בשדה טקסט היא ערך לגיטימי — מחיקת הערה, למשל.
// אסור שהתיקון יבלע אותה ויהפוך אותה ל-null.
test('מחרוזת ריקה בשדה טקסט נשארת מחרוזת ריקה', () => {
  const row = jobPatchToRow({ note: '', venue: '', title: '' })
  assert.equal(row.note, '')
  assert.equal(row.venue, '')
  assert.equal(row.title, '')
})

test('שדה שלא נשלח לא נכנס לשורה', () => {
  const row = jobPatchToRow({ title: 'בת מצווה' })
  assert.deepEqual(Object.keys(row), ['title'])
})

test('שדה שאינו מוכר נזרק ולא מפיל את השמירה', () => {
  const row = jobPatchToRow({ title: 'א', somethingElse: 1 })
  assert.equal(row.somethingElse, undefined)
  assert.equal(row.title, 'א')
})

test('0 ו-false אינם נבלעים', () => {
  const row = jobPatchToRow({ price: 0, showItemPrices: false })
  assert.equal(row.price, 0)
  assert.equal(row.showItemPrices, undefined)
  assert.equal(row.show_item_prices, false)
})

// רשת ביטחון: כל עמודת זמן שמוכרזת חייבת להיות עמודה שקיימת במיפוי,
// אחרת הגנה על שם עמודה שגוי נראית כאילו היא עובדת ולא עושה כלום.
test('כל עמודת זמן מוגנת היא עמודה שבאמת ממופה', () => {
  const mapped = new Set(Object.values(JOB_COLS))
  for (const col of DATETIME_COLS) {
    assert.ok(mapped.has(col), `${col} מוגנת אבל לא קיימת במיפוי`)
  }
})

test('dtSafe לא נוגע בעמודה שאינה זמן', () => {
  assert.equal(dtSafe('note', ''), '')
  assert.equal(dtSafe('event_time', ''), null)
})
