// ============================================================
// רענון ברקע בלי קליטה לא מרוקן את המסך (26.11.2026).
// ============================================================

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { settle, mergeLoad } from '../src/loadmerge.js'

const ok = value => ({ ok: true, value })
const fail = { ok: false }

test('settle: הצלחה וכישלון', async () => {
  assert.deepEqual(await settle(Promise.resolve([1])), { ok: true, value: [1] })
  assert.deepEqual(await settle(Promise.reject(new Error('x'))), { ok: false })
})

test('אין קליטה בכלל — שום דבר לא מוחלף', () => {
  const { updates, failed } = mergeLoad({
    jobs: fail, myJobs: ok([]), employees: fail, shifts: fail, availability: fail,
  })
  assert.deepEqual(updates, {})
  assert.ok(failed.includes('jobs') && failed.includes('employees'))
})

test('בקשה אחת נכשלה — רק היא נשארת כמו שהייתה', () => {
  const { updates, failed } = mergeLoad({
    jobs: ok([{ id: 1 }]), myJobs: ok([]), employees: ok([{ id: 'e' }]), shifts: fail,
  })
  assert.deepEqual(updates.jobs, [{ id: 1 }])
  assert.deepEqual(updates.employees, [{ id: 'e' }])
  assert.ok(!('shifts' in updates))
  assert.deepEqual(failed, ['shifts'])
})

test('מנהל: רשימה ריקה אמיתית מהשרת כן מחליפה', () => {
  const { updates } = mergeLoad({ jobs: ok([]), myJobs: ok([]), employees: ok([]) })
  assert.deepEqual(updates.jobs, [])
  assert.deepEqual(updates.employees, [])
})

test('עובד: חסום מהעבודות ומקבל את שמות האירועים שלו', () => {
  const mine = [{ id: 7, title: 'חתונה' }]
  assert.deepEqual(mergeLoad({ jobs: ok([]), myJobs: ok(mine) }).updates.jobs, mine)
  assert.deepEqual(mergeLoad({ jobs: fail, myJobs: ok(mine) }).updates.jobs, mine)
})

test('העבודות נכשלו ושמות האירועים ריקים — משאירים את מה שהיה', () => {
  const { updates, failed } = mergeLoad({ jobs: fail, myJobs: ok([]) })
  assert.ok(!('jobs' in updates))
  assert.ok(failed.includes('jobs'))
})
