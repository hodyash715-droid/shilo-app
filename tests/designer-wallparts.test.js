// ============================================================
// wallParts — הקיר כגוף אחד על המשטח.
// כאן לא בודקים כמה עץ צריך אלא איפה כל חלק עומד: קוליסות
// צמודות בלי חפיפה ובלי חור, וקושרת שיושבת בדיוק על התפר.
// ============================================================

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { wallParts } from '../src/designer/wall.js'
import { defaultFrameMaterial, sectionOf } from '../src/designer/kulisa.js'
import { materialsFor } from '../src/designer/materials.js'
import { KOSHRET, koshretLength } from '../src/designer/rules.js'
import { rawLenOf } from '../src/designer/geometry.js'

const MATS = materialsFor([])
const MAT = defaultFrameMaterial(MATS)
const [PW, PH] = sectionOf(MAT)

const build = (widths, h = 240, o = {}) =>
  wallParts(widths, h, { material: MAT, braces: 3, giben: true, ...o })

// גבולות כל קוליסה על ציר x, לפי האנכיות שלה
const spanOf = (parts, i) => {
  const mine = parts.filter(p => p.name.startsWith(`ק${i} ·`))
  const xs = mine.map(p => p.pos.x)
  return [Math.min(...xs) - PW / 2, Math.max(...xs) + PW / 2]
}

test('קוליסה בודדת: אין קושרות, והיא ממורכזת', () => {
  const r = build([120])
  assert.equal(r.kulisot, 1)
  assert.equal(r.koshret, 0)
  assert.equal(r.parts.filter(p => p.name.startsWith('קושרת')).length, 0)
  assert.deepEqual(spanOf(r.parts, 1), [-60, 60])
  assert.equal(r.dims.רוחב, 120)
})

test('שלוש קוליסות יושבות צמודות, בלי חפיפה ובלי חור', () => {
  const r = build([150, 120, 120])
  assert.equal(r.dims.רוחב, 390)
  const a = spanOf(r.parts, 1), b = spanOf(r.parts, 2), c = spanOf(r.parts, 3)
  assert.equal(a[0], -195)            // הקצה השמאלי של הקיר
  assert.equal(c[1], 195)             // הקצה הימני
  assert.equal(a[1], b[0])            // תפר ראשון: סוף = התחלה
  assert.equal(b[1], c[0])            // תפר שני
  assert.equal(a[1] - a[0], 150)
  assert.equal(b[1] - b[0], 120)
})

test('כל קושרת יושבת בדיוק על התפר שלה', () => {
  const r = build([150, 120, 120])
  const seams = [-195 + 150, -195 + 270]
  const ks = r.parts.filter(p => p.name.startsWith('קושרת'))
  assert.equal(ks.length, 4)                       // 2 תפרים × 2
  assert.deepEqual([...new Set(ks.map(p => p.pos.x))].sort((x, y) => x - y), seams)
  for (const k of ks) {
    assert.equal(Number(k.len), koshretLength(KOSHRET.overlapCm))
    assert.equal(k.axis, 'x')
    assert.equal(k.invId, MAT.id)
    // חוצה את התפר בחפיפה שווה לשני הצדדים
    const half = Number(k.len) / 2
    assert.ok(half >= KOSHRET.overlapRange[0], `חפיפה ${half} מתחת למינימום`)
  }
})

test('קושרת אחת למעלה ואחת למטה, מאחורי המסגרת', () => {
  const r = build([120, 120], 240)
  const ks = r.parts.filter(p => p.name.startsWith('קושרת'))
  assert.equal(ks.length, KOSHRET.perJoint)
  const ys = ks.map(p => p.pos.y).sort((a, b) => a - b)
  assert.equal(ys[0], PH / 2)                      // תחתונה
  assert.equal(ys[1], 240 - PH / 2)                // עליונה
  // z שלילי יותר מכל חלק במסגרת = מאחור
  const frameZ = Math.min(...r.parts.filter(p => !p.name.startsWith('קושרת')).map(p => p.pos.z))
  assert.ok(ks.every(k => k.pos.z < frameZ), 'קושרת לא מאחורי המסגרת')
})

test('האורכים נכתבים כמספרים — {רוחב} של הקיר אינו רוחב הקוליסה', () => {
  const r = build([150, 100])
  for (const p of r.parts) {
    assert.ok(!String(p.len).includes('{'), `${p.name} נשאר נוסחה: ${p.len}`)
    assert.ok(Number(p.len) > 0, `${p.name} באורך ${p.len}`)
  }
  // האופקי של קוליסה 1 נמדד לפי 150, לא לפי 250
  const h1 = r.parts.find(p => p.name === 'ק1 · גיבן עליון · לטה 1')
  assert.equal(Number(h1.len), 150 - 2 * PW)
  const h2 = r.parts.find(p => p.name === 'ק2 · גיבן עליון · לטה 1')
  assert.equal(Number(h2.len), 100 - 2 * PW)
})

test('האורכים על המשטח שורדים את rawLenOf', () => {
  const r = build([120, 120])
  for (const p of r.parts) {
    assert.ok(rawLenOf(p, r.dims) > 0, `${p.name} יוצא 0 — היה מוצג כ-8 ס״מ מזויפים`)
  }
})

test('מזהי החלקים ייחודיים — אחרת הזזה תזיז שני חלקים', () => {
  const r = build([120, 120, 120, 120])
  const ids = r.parts.map(p => p.id)
  assert.equal(new Set(ids).size, ids.length)
})

test('מספר החלקים: 9 לקוליסה עם גיבן ו-3 חיזוקים, ועוד 2 לכל תפר', () => {
  const r = build([120, 120, 120])
  assert.equal(r.parts.length, 3 * (2 + 4 + 3) + 2 * 2)
  assert.equal(r.kulisot, 3)
  assert.equal(r.koshret, 4)
})

test('קוליסה פסולה נופלת מהקיר ולא מזייפת את הרוחב', () => {
  const r = build([120, 999, 120])     // 999 מעל המקסימום
  assert.equal(r.kulisot, 2)
  assert.equal(r.koshret, KOSHRET.perJoint)
  assert.equal(r.dims.רוחב, 240)
  // השורה השנייה נחסמה, ומדווחת
  assert.equal(r.dropped.length, 1)
  assert.equal(r.dropped[0].row, 2)
  assert.ok(r.dropped[0].error.includes('רוחב'))
})

test('שורה שנחסמה לא מזיזה את המזהים של מי שאחריה', () => {
  // זה היה באג שקט: ק3 הפכה ל-ק2, וקיבלה את הסידור של ק2.
  const r = build([120, 999, 80])
  assert.deepEqual(r.order, [1, 3], 'המזהים לא נשמרו לפי השורה')
  assert.equal(r.parts.filter(p => p.k === 2).length, 0, 'שורה חסומה ייצרה חלקים')
  assert.ok(r.parts.some(p => p.k === 3), 'השורה השלישית איבדה את מזהה השורה שלה')
  // והרוחב של ק3 הוא 80, לא של מישהו אחר
  const v = r.parts.filter(p => p.k === 3 && p.axis === 'y').map(p => p.pos.x)
  assert.equal(Math.round(Math.max(...v) - Math.min(...v) + 2), 80)
})

test('קלט ריק לא מפיל ולא מחזיר חלקים', () => {
  for (const widths of [[], [0], [NaN], [-5]]) {
    const r = build(widths)
    assert.equal(r.parts.length, 0, JSON.stringify(widths))
    assert.equal(r.koshret, 0)
  }
})

test('חפיפה גדולה יותר מאריכה את הקושרת, לא מזיזה אותה', () => {
  const a = build([120, 120], 240, { overlapCm: 20 })
  const b = build([120, 120], 240, { overlapCm: 30 })
  const ka = a.parts.find(p => p.name.startsWith('קושרת'))
  const kb = b.parts.find(p => p.name.startsWith('קושרת'))
  assert.equal(Number(ka.len), 40)
  assert.equal(Number(kb.len), 60)
  assert.equal(ka.pos.x, kb.pos.x)
})

test('חפיפה פסולה נופלת לברירת המחדל במקום לייצר קושרת באפס', () => {
  for (const bad of [0, -5, NaN, null, undefined]) {
    const r = build([120, 120], 240, { overlapCm: bad })
    const k = r.parts.find(p => p.name.startsWith('קושרת'))
    assert.equal(Number(k.len), koshretLength(KOSHRET.overlapCm), `overlap=${bad}`)
  }
})

test('קיר רחב: הרוחב הוא סכום הקוליסות והקצוות סימטריים', () => {
  const widths = [150, 150, 150, 150, 90]
  const r = build(widths)
  const total = widths.reduce((a, b) => a + b, 0)
  assert.equal(r.dims.רוחב, total)
  assert.equal(spanOf(r.parts, 1)[0], -total / 2)
  assert.equal(spanOf(r.parts, 5)[1], total / 2)
  assert.equal(r.koshret, 4 * KOSHRET.perJoint)
})

test('הגובה נשמר: כל אנכית לגובה הקיר', () => {
  const r = build([120, 120], 260)
  assert.equal(r.dims.גובה, 260)
  const v = r.parts.filter(p => p.name.includes('אנכית'))
  assert.equal(v.length, 4)
  assert.ok(v.every(p => Number(p.len) === 260))
})
