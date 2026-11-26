// ============================================================
// חלון עבודה: נגיעה בטעות מחוץ לחלון לא מוחקת את מה שהוקלד (26.11.2026).
// ============================================================

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isDirty } from '../src/formdirty.js'

const base = { title: '', client: '', items: [], eventDate: null, note: '' }

test('טופס שלא נגעו בו — אין שינויים', () => {
  assert.equal(isDirty(base, { ...base }), false)
})

test('ריק, null ו-undefined הם אותו דבר', () => {
  assert.equal(isDirty(base, { ...base, note: null, eventDate: '', extra: undefined }), false)
})

test('הקלדה בשם — יש שינויים', () => {
  assert.equal(isDirty(base, { ...base, title: 'חתונה' }), true)
})

test('פריט שנוסף לרשימה — יש שינויים', () => {
  assert.equal(isDirty(base, { ...base, items: [{ name: 'קוליסה', qty: 1 }] }), true)
})

test('סדר השדות לא משנה', () => {
  assert.equal(isDirty({ a: 1, b: 2 }, { b: 2, a: 1 }), false)
})
