import test from 'node:test'
import assert from 'node:assert/strict'
import {
  draftKey, emptyOrder, hasDraft, orderPayload, readDraft, validateOrder, writeDraft,
} from '../src/clientOrder.js'

const today = '2026-09-07'
const valid = () => ({
  ...emptyOrder(), title: 'אירוע', eventDate: '2026-10-10', venue: 'אולם',
  items: [{ key: 'one', name: 'קוליסה', qty: 2, cat: 'backdrop', note: 'לבן, 3 מ׳' }],
})
const memory = () => {
  const v = new Map()
  return { getItem: k => v.get(k) ?? null, setItem: (k, x) => v.set(k, x), removeItem: k => v.delete(k) }
}

test('שם, תאריך עתידי ומקום הם חובה', () => {
  assert.deepEqual(Object.keys(validateOrder(emptyOrder(), 0, today)), ['title', 'eventDate', 'venue'])
  assert.deepEqual(validateOrder(valid(), 0, today), {})
})

test('תאריך שעבר נדחה', () => {
  const o = { ...valid(), eventDate: '2026-09-01' }
  assert.equal(validateOrder(o, 0, today).eventDate, 'תאריך האירוע כבר עבר.')
})

test('כתובת לבדה מספיקה במקום שם מקום', () => {
  const o = { ...valid(), venue: '', address: 'הרצל 1, תל אביב' }
  assert.equal(validateOrder(o, 0, today).venue, undefined)
})

test('איש קשר חייב שם וטלפון יחד', () => {
  assert.ok(validateOrder({ ...valid(), contactName: 'דנה' }, 0, today).contactPhone)
  assert.ok(validateOrder({ ...valid(), contactPhone: '050-1234567' }, 0, today).contactName)
  assert.deepEqual(validateOrder({ ...valid(), contactName: 'דנה', contactPhone: '050-1234567' }, 0, today), {})
})

test('טלפון לא תקין נדחה', () => {
  const o = { ...valid(), contactName: 'דנה', contactPhone: '123' }
  assert.ok(validateOrder(o, 0, today).contactPhone)
})

test('פירוק לפני האירוע נדחה', () => {
  const o = { ...valid(), teardownDate: '2026-10-09' }
  assert.ok(validateOrder(o, 0, today).teardownDate)
})

test('הקמה אחרי האירוע נדחית', () => {
  const o = { ...valid(), setupDate: '2026-10-11' }
  assert.ok(validateOrder(o, 0, today).setupDate)
})

test('באיסוף עצמי לא נדרשת לוגיסטיקה', () => {
  const o = { ...valid(), service: 'pickup', contactName: 'דנה', contactPhone: '1' }
  assert.deepEqual(validateOrder(o, 0, today), {})
})

test('כמות חייבת להיות שלם 1..999', () => {
  for (const qty of [0, -1, 1000, 2.5, 'שתיים']) {
    const o = { ...valid(), items: [{ key: 'a', name: 'קוליסה', qty }] }
    assert.ok(validateOrder(o, 1, today)['item-qty-0'], 'נכשל עבור ' + qty)
  }
  assert.deepEqual(validateOrder(valid(), 1, today), {})
})

test('הזמנה ריקה לגמרי נדחית, הערה לבדה מספיקה', () => {
  assert.ok(validateOrder(emptyOrder(), 1, today).items)
  assert.equal(validateOrder({ ...emptyOrder(), note: 'משהו מיוחד' }, 1, today).items, undefined)
})

test('קישור חייב להיות http/https', () => {
  assert.ok(validateOrder({ ...valid(), reference: 'לא כתובת' }, 1, today).reference)
  assert.ok(validateOrder({ ...valid(), reference: 'javascript:alert(1)' }, 1, today).reference)
  assert.equal(validateOrder({ ...valid(), reference: 'https://drive.google.com/x' }, 1, today).reference, undefined)
})

test('המטען מחזיר שדות אמיתיים, לא טקסט דחוס', () => {
  const p = orderPayload({
    ...valid(), service: 'setup', setupDate: '2026-10-09', setupTime: '08:00',
    teardownDate: '2026-10-11', teardownTime: '23:00',
    contactName: 'דנה', contactPhone: '050-1234567', access: 'מעלית משא',
    reference: 'https://drive.google.com/x', note: 'סגנון בהיר',
  })
  assert.equal(p.service, 'setup')
  assert.equal(p.setupDate, '2026-10-09')
  assert.equal(p.teardownTime, '23:00')
  assert.equal(p.contactPhone, '050-1234567')
  assert.equal(p.access, 'מעלית משא')
  assert.equal(p.note, 'סגנון בהיר')
  assert.deepEqual(p.items[0], { name: 'קוליסה', qty: 2, cat: 'backdrop', price: 0, note: 'לבן, 3 מ׳' })
})

test('איסוף עצמי מנקה לוגיסטיקה מהמטען', () => {
  const p = orderPayload({ ...valid(), service: 'pickup', setupDate: '2026-10-09', contactName: 'דנה', access: 'x' })
  assert.equal(p.setupDate, null)
  assert.equal(p.contactName, null)
  assert.equal(p.access, null)
})

test('המחיר לעולם אפס — הלקוחה לא קובעת מחיר', () => {
  const p = orderPayload({ ...valid(), items: [{ key: 'a', name: 'x', qty: 1, price: 9999 }] })
  assert.equal(p.items[0].price, 0)
})

test('טיוטה נשמרת, נקראת ונמחקת', () => {
  const s = memory(), token = 'abc/1'
  assert.equal(hasDraft(emptyOrder()), false)
  writeDraft(s, token, valid())
  assert.equal(readDraft(s, token).title, 'אירוע')
  assert.ok(s.getItem(draftKey(token)))
  writeDraft(s, token, emptyOrder())
  assert.equal(s.getItem(draftKey(token)), null)
})

test('טיוטה בת יותר מ-30 יום נזרקת', () => {
  const s = memory(), token = 't'
  s.setItem(draftKey(token), JSON.stringify({ version: 1, savedAt: Date.now() - 31 * 86400000, order: valid() }))
  assert.equal(readDraft(s, token).title, '')
})

test('טיוטה פגומה לא מפילה כלום', () => {
  const s = memory(), token = 't'
  for (const junk of ['{', 'null', '{"version":9}', '{"version":1,"order":null,"savedAt":1}']) {
    s.setItem(draftKey(token), junk)
    assert.equal(readDraft(s, token).title, '')
  }
})

test('אחסון חסום לא מפיל את הטופס', () => {
  const broken = { getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('blocked') }, removeItem: () => {} }
  assert.equal(readDraft(broken, 't').title, '')
  assert.equal(writeDraft(broken, 't', valid()), false)
})
