import { test } from 'node:test'
import assert from 'node:assert/strict'
import { rawLenOf, lenOf } from '../src/designer/geometry.js'
import { cutList } from '../src/designer/cuts.js'
import { groupParts } from '../src/designer/drawing.js'
import { validateDims, invalidParts, tooLongParts, LIMITS, KOSHRET, koshretLength } from '../src/designer/rules.js'

const MATS = [{ id: 'm1', name: 'לטה 4×2', stock_len: 300, category: 'material' }]
const DIMS = { גובה: 240, רוחב: 120, עומק: 40, עובי: 2 }
const part = (o) => ({ id: 'p', invId: 'm1', name: 'לטה', axis: 'x', pos: { x: 0, y: 0, z: 0 }, ...o })

// ---------- אורך ----------
test('rawLenOf מחזיר את האורך האמיתי', () => {
  assert.equal(rawLenOf(part({ len: '{רוחב}-4' }), DIMS), 116)
  assert.equal(rawLenOf(part({ len: '{גובה}' }), DIMS), 240)
})

test('rawLenOf מחזיר 0 על נוסחה לא תקינה — ולא ממציא אורך', () => {
  for (const bad of ['{רוחב}-999', '', null, undefined, 'שלום', '0', '-5'])
    assert.equal(rawLenOf(part({ len: bad }), DIMS), 0, `len=${bad}`)
})

test('lenOf נשאר 8 לתצוגה בלבד', () => {
  assert.equal(lenOf(part({ len: '{רוחב}-999' }), DIMS), 8)
})

// ---------- הבאג ----------
test('חלק שבור לא נכנס לרשימת החיתוך כ-8 ס״מ', () => {
  const rows = cutList([
    part({ id: 'a', len: '{גובה}' }),
    part({ id: 'b', len: '{רוחב}-999' }),
    part({ id: 'c', len: '' }),
  ], DIMS, MATS)
  assert.equal(rows.length, 1)
  assert.equal(rows[0].len, 240)
  assert.equal(rows.some(r => r.len === 8), false)
})

test('בשרטוט חלק שבור מסומן bad ולא מקבל אורך', () => {
  const { groups } = groupParts([
    part({ id: 'a', len: '{גובה}' }),
    part({ id: 'b', len: '{רוחב}-999' }),
  ], DIMS, MATS)
  const bad = groups.find(g => g.bad)
  assert.ok(bad, 'חייבת להיות קבוצה מסומנת')
  assert.equal(bad.len, 0)
  assert.equal(groups.find(g => !g.bad).len, 240)
})

// ---------- אימות מידות ----------
test('מידה תקינה עוברת', () => {
  const r = validateDims(DIMS)
  assert.equal(r.ok, true)
  assert.deepEqual(r.errors, [])
  assert.deepEqual(r.warnings, [])
})

test('אפס, שלילי ו-NaN נחסמים', () => {
  assert.equal(validateDims({ ...DIMS, גובה: 0 }).ok, false)
  assert.equal(validateDims({ ...DIMS, רוחב: -5 }).ok, false)
  assert.equal(validateDims({ ...DIMS, עומק: NaN }).ok, false)
  assert.equal(validateDims({ ...DIMS, עובי: 'אבג' }).ok, false)
})

test('חריגה מהמקסימום היא אזהרה, לא חסימה', () => {
  const r = validateDims({ ...DIMS, רוחב: LIMITS.maxWidth + 1 })
  assert.equal(r.ok, true)
  assert.equal(r.warnings.length, 1)
  assert.match(r.warnings[0].message, /מעל המקסימום/)
})

test('invalidParts מאתר בדיוק את החלקים השבורים', () => {
  const bad = invalidParts([
    part({ id: 'ok', len: '{גובה}' }),
    part({ id: 'x', len: '{רוחב}-999' }),
    part({ id: 'y', len: '' }),
  ], DIMS)
  assert.deepEqual(bad.map(b => b.id), ['x', 'y'])
  assert.match(bad[1].message, /לא הוגדר אורך/)
})

// שי קונה עד 6.2 מטר לפי הצורך, לכן 400 ס"מ תקין ורק מעל 620 חורג.
test('tooLongParts מודד מול האורך המקסימלי שאפשר להזמין', () => {
  const long = tooLongParts([
    part({ id: 'ok', len: '250' }),
    part({ id: 'fine', len: '400' }),
    part({ id: 'big', len: '700' }),
  ], DIMS, MATS)
  assert.deepEqual(long.map(b => b.id), ['big'])
  assert.match(long[0].message, /ארוך מהמקסימום שאפשר להזמין/)
  assert.match(long[0].message, /620/)
})

test('נעילת אורך ידנית מחזירה את החסם לאורך שנבחר', () => {
  const long = tooLongParts([part({ id: 'p400', len: '400' })], DIMS, MATS, { m1: 300 })
  assert.deepEqual(long.map(b => b.id), ['p400'])
})

// ---------- כלל הקושרת ----------
test('קושרת: שתיים לתפר, אורך פי שניים מהחפיפה', () => {
  assert.equal(KOSHRET.perJoint, 2)
  assert.equal(KOSHRET.status, 'verified')
  assert.equal(koshretLength(25), 50)
  assert.equal(koshretLength(20), 40)
  assert.equal(koshretLength(30), 60)
})

test('החפיפה שנבחרה נמצאת בטווח ששי נקב', () => {
  const [lo, hi] = KOSHRET.overlapRange
  assert.ok(KOSHRET.overlapCm >= lo && KOSHRET.overlapCm <= hi)
  // הערך המדויק הוא העדפה, לא כלל — שי נתן טווח
  assert.equal(KOSHRET.overlapStatus, 'preference')
})
