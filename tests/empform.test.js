import { test } from 'node:test'
import assert from 'node:assert/strict'
import { toForm, rateOf, blankEmp } from '../src/empform.js'

// עובד שנשמר בלי שכר, בלי תפקיד ובלי טלפון — מה שקורה בפועל במסד
const bare = { id: 'e1', name: 'שגב', role: null, phone: null, rate: null, active: true }

test('null מהמסד הופך למחרוזת, כדי שהשדה יישאר בשליטת React', () => {
  const f = toForm(bare)
  assert.equal(f.role, '')
  assert.equal(f.phone, '')
  assert.equal(f.rate, '')
})

test('trim על שדה ריק לא מפיל את השמירה', () => {
  const f = toForm(bare)
  assert.doesNotThrow(() => { f.role.trim(); f.phone.trim(); f.name.trim() })
})

// הבאג: שכר שלא נקבע נשמר חזרה כ-0 ₪ לשעה
test('שכר שלא נקבע נשאר לא נקבע ולא הופך ל-0', () => {
  assert.equal(rateOf(toForm(bare).rate), null)
  assert.equal(rateOf(''), null)
  assert.equal(rateOf(null), null)
  assert.equal(rateOf(undefined), null)
})

test('0 הוא שכר אמיתי ולא נבלע', () => {
  assert.equal(rateOf(0), 0)
  assert.equal(rateOf('0'), 0)
})

test('שכר אמיתי עובר כמספר', () => {
  assert.equal(rateOf('60'), 60)
  assert.equal(rateOf(60), 60)
  assert.equal(rateOf('60.5'), 60.5)
})

test('קלט שאינו מספר לא נשמר כ-NaN', () => {
  assert.equal(rateOf('אבג'), null)
  assert.equal(rateOf('--'), null)
})

test('ערכים אמיתיים לא נדרסים', () => {
  const f = toForm({ name: 'בן', role: 'מנהל בכיר', phone: '0509429998', rate: 90, is_manager: true })
  assert.equal(f.name, 'בן')
  assert.equal(f.role, 'מנהל בכיר')
  assert.equal(f.phone, '0509429998')
  assert.equal(f.rate, 90)
  assert.equal(f.is_manager, true)
})

test('עובד חדש מתחיל ריק ולא מנהל', () => {
  const b = blankEmp()
  assert.equal(b.rate, '')
  assert.equal(b.is_manager, false)
  assert.equal(b.active, true)
})
