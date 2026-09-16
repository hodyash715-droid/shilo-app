import { test } from 'node:test'
import assert from 'node:assert/strict'
import { wallProposals, wallCuts, assembleWall, standardCombos, arrangeSymmetric } from '../src/designer/wall.js'
import { defaultFrameMaterial, LIMITS_PREFERRED } from '../src/designer/kulisa.js'
import { LIMITS, KOSHRET } from '../src/designer/rules.js'
import { optimize } from '../src/designer/cuts.js'
import { materialsFor } from '../src/designer/materials.js'

const MATS = materialsFor([])
const MAT = defaultFrameMaterial(MATS)
const build = (widths, h = 240) => wallCuts(widths, h, { material: MAT, materials: MATS, braces: 3 })

// ---------- החוק: הסכום מדויק, אף קוליסה לא חורגת ----------
test('כל הצעה מסתכמת בדיוק לרוחב הקיר ואף קוליסה לא עוברת את המקסימום', () => {
  for (const W of [120, 240, 300, 400, 540, 660, 1000, 133, 457]) {
    const r = wallProposals(W, 240)
    assert.equal(r.ok, true, `קיר ${W} נכשל`)
    assert.ok(r.proposals.length >= 1, `קיר ${W} בלי הצעות`)
    for (const p of r.proposals) {
      const sum = p.widths.reduce((a, b) => a + b, 0)
      assert.equal(Math.round(sum), W, `קיר ${W}: ${p.label} נתן ${sum}`)
      assert.ok(p.widths.every(x => x > 0 && x <= LIMITS.maxWidth), `קיר ${W}: קוליסה חורגת`)
    }
  }
})

test('אין שתי הצעות זהות', () => {
  for (const W of [240, 400, 540, 600]) {
    const keys = wallProposals(W, 240).proposals.map(p => p.widths.join('|'))
    assert.equal(new Set(keys).size, keys.length, `קיר ${W} החזיר כפילות`)
  }
})

test('קיר רחב מקבל מספיק קוליסות', () => {
  const r = wallProposals(1000, 240)
  r.proposals.forEach(p => assert.ok(p.widths.length >= Math.ceil(1000 / LIMITS.maxWidth)))
})

// ---------- מידות שנפסלות ----------
test('מידה לא חוקית נחסמת', () => {
  assert.equal(wallProposals(0, 240).ok, false)
  assert.equal(wallProposals(-100, 240).ok, false)
  assert.equal(wallProposals(NaN, 240).ok, false)
  assert.equal(wallProposals(540, 0).ok, false)
})

test('גובה מעל המקסימום נחסם עם הסבר', () => {
  const r = wallProposals(540, 320)
  assert.equal(r.ok, false)
  assert.match(r.errors.join(), /קוליסה אחת לא מגיעה לגובה/)
})

// ---------- סידור וסימטריה ----------
test('הסידור סימטרי', () => {
  assert.deepEqual(arrangeSymmetric([150, 120, 120, 150]), [150, 120, 120, 150])
  assert.deepEqual(arrangeSymmetric([150, 150, 100]), [150, 100, 150])
  const ws = arrangeSymmetric([120, 100, 100, 120, 80])
  assert.deepEqual(ws, [...ws].reverse())
})

test('standardCombos מחזיר רק מידות סטנדרטיות שמסתכמות במדויק', () => {
  const combos = standardCombos(540)
  assert.ok(combos.length > 0)
  combos.forEach(c => {
    assert.equal(c.reduce((a, b) => a + b, 0), 540)
    assert.ok(c.every(w => LIMITS_PREFERRED.includes(w)))
  })
})

test('רוחב שאין לו צירוף סטנדרטי עדיין מקבל הצעה', () => {
  const r = wallProposals(133, 240)
  assert.equal(r.ok, true)
  assert.ok(r.proposals.length >= 1)
  assert.equal(r.proposals[0].widths.reduce((a, b) => a + b, 0), 133)
})

// ---------- רשימת החיתוך המאוחדת ----------
test('חיתוכי הקיר הם סכום הקוליסות', () => {
  const two = build([120, 120])
  const one = build([120])
  assert.equal(two.totalCuts, one.totalCuts * 2)
  assert.equal(two.kulisot.length, 2)
})

test('קוליסות ברוחב שונה מייצרות אורכים שונים', () => {
  const b = build([150, 120, 120, 150])
  const lens = b.rows.map(r => r.len).sort((a, b2) => b2 - a)
  assert.ok(lens.includes(240), 'אנכיות')
  assert.ok(lens.includes(146), '150 − 4')
  assert.ok(lens.includes(116), '120 − 4')
  // 4 קוליסות × 2 אנכיות
  assert.equal(b.rows.find(r => r.len === 240).qty, 8)
})

test('כל החיתוכים נכנסים לתוכנית הקנייה', () => {
  const b = build([150, 120, 120, 150])
  const plan = optimize(b.rows, MATS)[0]
  const placed = plan.bars.flatMap(x => x.cuts).length
  assert.equal(placed, b.totalCuts)
  assert.deepEqual(plan.tooLong, [])
})

test('קיר של קוליסה אחת זהה למחולל הבודד', () => {
  const b = build([120])
  assert.equal(b.kulisot.length, 1)
  assert.equal(b.totalParts, 9)   // 2 אנכיות + 4 גיבן + 3 חיזוקים
})

// ---------- הבאג: קיר שלא מתחלק בשלמים ----------
test('רוחב שלא מתחלק בשלמים עדיין מקבל מספר קוליסות מינימלי', () => {
  // קיר 305 קיבל פעם 5 קוליסות של 61 במקום 3 של 102/102/101
  const r = wallProposals(305, 240)
  assert.equal(Math.min(...r.proposals.map(p => p.widths.length)), 3)
  const eq = r.proposals.find(p => p.label.includes('שווה'))
  assert.deepEqual([...eq.widths].sort((a, b) => a - b), [101, 102, 102])
})

test('כל רוחב מ-40 עד 1500 מקבל חלוקה תקינה במינימום קוליסות', () => {
  for (let W = 40; W <= 1500; W++) {
    const r = wallProposals(W, 240)
    assert.equal(r.ok, true, `קיר ${W}`)
    const min = Math.ceil(W / LIMITS.maxWidth)
    assert.equal(Math.min(...r.proposals.map(p => p.widths.length)), min, `קיר ${W}`)
    r.proposals.forEach(p => {
      assert.equal(p.widths.reduce((a, b) => a + b, 0), W, `קיר ${W}: ${p.label}`)
      assert.ok(p.widths.every(x => x > 0 && x <= LIMITS.maxWidth), `קיר ${W}: ${p.label}`)
    })
  }
})

// ---------- הרכבת קיר: קוליסות + קושרות ----------
test('קיר של N קוליסות מקבל N−1 תפרים ו-2 קושרות לכל תפר', () => {
  for (const n of [1, 2, 3, 4, 7]) {
    const w = assembleWall(Array(n).fill(120), 240, { material: MAT, materials: MATS, braces: 3 })
    assert.equal(w.kulisot.length, n)
    assert.equal(w.connections.length, Math.max(0, n - 1))
    assert.equal(w.koshret.count, Math.max(0, n - 1) * KOSHRET.perJoint)
    w.connections.forEach(c => assert.equal(c.pieces.length, KOSHRET.perJoint))
  }
})

test('קוליסה בודדת — בלי תפרים ובלי קושרות', () => {
  const w = assembleWall([120], 240, { material: MAT, materials: MATS })
  assert.equal(w.connections.length, 0)
  assert.equal(w.koshret.count, 0)
  assert.equal(w.loading.filter(l => l.kind === 'koshret').length, 0)
})

test('אורך הקושרת הוא פי שניים מהחפיפה, והיא נכנסת לרשימת החיתוך', () => {
  const w = assembleWall([120, 120], 240, { material: MAT, materials: MATS, braces: 3, overlapCm: 30 })
  assert.equal(w.koshret.lengthCm, 60)
  const row = w.rows.find(r => r.len === 60)
  assert.ok(row, 'הקושרות חייבות להופיע בחיתוך')
  assert.equal(row.qty, 2)
})

test('הקושרות מוסיפות חיתוכים מעל מה שהקוליסות לבדן צריכות', () => {
  const plain = build([120, 120])
  const w = assembleWall([120, 120], 240, { material: MAT, materials: MATS, braces: 3 })
  assert.equal(w.totalCuts - plain.totalCuts, KOSHRET.perJoint)
})

test('חפיפה רחבה מהקוליסה הצרה מזהירה', () => {
  const w = assembleWall([40, 120], 240, { material: MAT, materials: MATS, overlapCm: 50 })
  assert.match(w.warnings.join(), /רחבה מהקוליסה הצרה/)
})

test('רשימת ההעמסה מונה כל קוליסה ואת הקושרות', () => {
  const w = assembleWall([150, 120, 120], 240, { material: MAT, materials: MATS })
  const kul = w.loading.filter(l => l.kind === 'kulisa')
  const kosh = w.loading.find(l => l.kind === 'koshret')
  assert.equal(kul.length, 3)
  assert.equal(kul.reduce((s, l) => s + l.qty, 0), 3)
  assert.equal(kosh.qty, 4)   // 2 תפרים × 2
})

test('כל חיתוכי הקיר כולל הקושרות נכנסים לקורות', () => {
  const w = assembleWall([150, 120, 120, 150], 240, { material: MAT, materials: MATS, braces: 3 })
  const plan = optimize(w.rows, MATS)[0]
  assert.equal(plan.bars.flatMap(b => b.cuts).length, w.totalCuts)
  assert.deepEqual(plan.tooLong, [])
})

// ---------- QA: קצוות ----------
test('קוליסה פסולה מדולגת והרוחב משקף רק את מה שנבנה', () => {
  const w = assembleWall([200, 120], 240, { material: MAT, materials: MATS, braces: 3 })
  assert.equal(w.kulisot.length, 1)
  assert.equal(w.totalWidth, 120)
  assert.match(w.warnings.join(), /מעל המקסימום/)
})

test('רוחב NaN לא מזהם את סיכום הקיר', () => {
  const w = assembleWall([NaN, 120], 240, { material: MAT, materials: MATS })
  assert.ok(Number.isFinite(w.totalWidth))
  assert.equal(w.totalWidth, 120)
})

test('רשימה ריקה לא קורסת', () => {
  const w = assembleWall([], 240, { material: MAT, materials: MATS })
  assert.equal(w.kulisot.length, 0)
  assert.equal(w.connections.length, 0)
  assert.equal(w.koshret.count, 0)
  assert.equal(w.totalWidth, 0)
})

test('חפיפה לא תקינה נופלת לברירת המחדל', () => {
  for (const bad of [0, -5, null, NaN, 'אבג']) {
    const w = assembleWall([120, 120], 240, { material: MAT, materials: MATS, overlapCm: bad })
    assert.equal(w.koshret.overlapCm, KOSHRET.overlapCm, `overlap=${bad}`)
  }
})
