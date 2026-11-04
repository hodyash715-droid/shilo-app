// ============================================================
// כניסה בשם העובד. 4.11.2026: אדם לא הצליח להיכנס — הקליד "אדם",
// והאפליקציה חיפשה את קוד ההצטרפות שלו.
// ============================================================

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normName, firstName, resolveLogin, loginHint } from '../src/loginname.js'

const E = (id, name, linked = true) => ({ id, name, user_id: linked ? 'u-' + id : null })
const TEAM = [E(1, 'אדם כהן'), E(2, 'דני לוי'), E(3, 'דני ברק'), E(4, 'שירה'), E(5, 'יוסי אבן', false)]

test('רווחים ואותיות גדולות לא משנים', () => {
  assert.equal(normName('  אדם   כהן '), 'אדם כהן')
  assert.equal(normName('Adam Cohen'), 'adam cohen')
  assert.equal(firstName(' אדם כהן'), 'אדם')
})

test('"אדם" מכניס את אדם כהן — שם פרטי מספיק כשאין עוד אדם', () => {
  assert.equal(resolveLogin(TEAM, 'אדם')?.id, 1)
  assert.equal(resolveLogin(TEAM, 'אדם כהן')?.id, 1)
  assert.equal(resolveLogin(TEAM, ' אדם  כהן ')?.id, 1)
})

test('שני דני — שם פרטי לא מספיק, שם מלא כן', () => {
  assert.equal(resolveLogin(TEAM, 'דני'), null)
  assert.equal(resolveLogin(TEAM, 'דני לוי')?.id, 2)
  assert.equal(resolveLogin(TEAM, 'דני ברק')?.id, 3)
})

test('שם מילה אחת', () => {
  assert.equal(resolveLogin(TEAM, 'שירה')?.id, 4)
})

test('עובד שעוד לא הצטרף לא נכנס בשם — אין לו חשבון', () => {
  assert.equal(resolveLogin(TEAM, 'יוסי'), null)
})

test('שני עובדים באותו שם מלא — אף אחד לא נכנס בשם', () => {
  const t = [E(1, 'אדם כהן'), E(2, 'אדם כהן')]
  assert.equal(resolveLogin(t, 'אדם כהן'), null)
  assert.equal(resolveLogin(t, 'אדם'), null)
})

test('שם מלא גובר על שם פרטי של מישהו אחר', () => {
  // "אדם" הוא גם שם מלא של עובד אחד וגם שם פרטי של אחר
  const t = [E(1, 'אדם'), E(2, 'אדם כהן')]
  assert.equal(resolveLogin(t, 'אדם')?.id, 1)
  assert.equal(resolveLogin(t, 'אדם כהן')?.id, 2)
})

test('ריק לא מכניס אף אחד', () => {
  assert.equal(resolveLogin(TEAM, '   '), null)
})

test('הכרטיס: באיזה שם נכנסים, ומתי שם פרטי מספיק', () => {
  assert.deepEqual(loginHint(TEAM[0], TEAM), { full: 'אדם כהן', first: 'אדם', clash: false })
  assert.deepEqual(loginHint(TEAM[1], TEAM), { full: 'דני לוי', first: null, clash: false })
  assert.deepEqual(loginHint(TEAM[3], TEAM), { full: 'שירה', first: null, clash: false })
})

test('הכרטיס מזהיר כשיש עוד עובד באותו שם', () => {
  const t = [E(1, 'אדם כהן'), E(2, 'אדם  כהן')]
  assert.equal(loginHint(t[0], t).clash, true)
})
