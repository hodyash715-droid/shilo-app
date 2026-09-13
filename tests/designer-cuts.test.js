import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cutList, optimize, orderLengths, maxOrderLength, isBoard, PURCHASE, KERF_OPTIONS, DEFAULT_KERF_MM, mmToCm } from '../src/designer/cuts.js'
import { generateKulisa } from '../src/designer/kulisa.js'
import { materialsFor } from '../src/designer/materials.js'

const MATS = materialsFor([])
const LATA = MATS.find(m => m.name === 'לטה 2×3')
const DIKET = MATS.find(m => /דיקט/.test(m.name))
const DIMS = { גובה: 240, רוחב: 120, עומק: 40, עובי: 2 }

// ---------- טווח הקנייה שאושר ----------
test('טווח הקנייה: 3 עד 6.2 מטר', () => {
  assert.equal(PURCHASE.min, 300)
  assert.equal(PURCHASE.max, 620)
  assert.equal(PURCHASE.status, 'verified')
})

test('לעץ יש טווח, ללוח יש מידה אחת', () => {
  assert.equal(isBoard(LATA), false)
  assert.equal(isBoard(DIKET), true)
  assert.equal(maxOrderLength(LATA), 620)
  assert.equal(maxOrderLength(DIKET), 244)
  assert.deepEqual(orderLengths(DIKET), [244])
  const lens = orderLengths(LATA)
  assert.equal(lens[0], 300)
  assert.equal(lens.at(-1), 620)
  assert.ok(lens.every(L => L >= 300 && L <= 620))
})

// ---------- בחירת אורך הקנייה ----------
test('בוחר את האורך שקונה הכי פחות עץ', () => {
  const cuts = cutList(generateKulisa({ width: 120, height: 240, material: LATA, braces: 3 }).parts, DIMS, MATS)
  const auto = optimize(cuts, MATS)[0]
  const locked300 = optimize(cuts, MATS, { [LATA.id]: 300 })[0]

  assert.equal(auto.chosenLength, 'auto')
  assert.equal(locked300.chosenLength, 'manual')
  assert.ok(
    auto.barCount * auto.stock < locked300.barCount * locked300.stock,
    `אוטומטי ${auto.barCount}×${auto.stock} אמור לקנות פחות מ-${locked300.barCount}×${locked300.stock}`
  )
  assert.ok(auto.wastePct < locked300.wastePct)
})

test('האורך שנבחר תמיד בתוך הטווח', () => {
  for (const w of [40, 60, 80, 100, 120, 150]) {
    const parts = generateKulisa({ width: w, height: 240, material: LATA, braces: 3 }).parts
    const p = optimize(cutList(parts, { ...DIMS, רוחב: w }, MATS), MATS)[0]
    assert.ok(p.stock >= PURCHASE.min && p.stock <= PURCHASE.max, `רוחב ${w} בחר ${p.stock}`)
  }
})

test('כל החתיכות נכנסות לקורות שנבחרו', () => {
  const cuts = cutList(generateKulisa({ width: 150, height: 300, material: LATA, braces: 4 }).parts,
    { ...DIMS, רוחב: 150, גובה: 300 }, MATS)
  const p = optimize(cuts, MATS)[0]
  const placed = p.bars.flatMap(b => b.cuts).sort((a, b) => a - b)
  const wanted = cuts.flatMap(c => Array(c.qty).fill(c.len)).sort((a, b) => a - b)
  assert.deepEqual(placed, wanted, 'אסור שחתיכה תיעלם מהאריזה')
  p.bars.forEach(b => assert.ok(b.cuts.reduce((s, L) => s + L, 0) <= p.stock, 'קורה לא יכולה לגלוש'))
})

test('לוח נשאר במידה הקבועה שלו', () => {
  const p = optimize([{ invId: DIKET.id, mat: DIKET.name, len: 200, qty: 3 }], MATS)[0]
  assert.equal(p.stock, 244)
  assert.equal(p.chosenLength, 'fixed')
})

test('חתיכה ארוכה מהמקסימום מדווחת ולא נעלמת', () => {
  const p = optimize([{ invId: LATA.id, mat: LATA.name, len: 700, qty: 1 }], MATS)[0]
  assert.deepEqual(p.tooLong, [700])
  assert.equal(p.barCount, 0)
})

// ---------- רוחב חתך המסור ----------
test('אפשרויות הלהב תקינות וברירת המחדל ביניהן', () => {
  assert.ok(KERF_OPTIONS.length >= 4)
  assert.ok(KERF_OPTIONS.every(o => o.mm > 0 && o.mm < 10))
  assert.ok(KERF_OPTIONS.some(o => o.mm === DEFAULT_KERF_MM))
  assert.equal(mmToCm(3.2), 0.32)
  assert.equal(mmToCm(1.6), 0.16)
})

test('רוחב חתך גדול יותר לא יכול לקנות פחות עץ', () => {
  const cuts = [{ invId: LATA.id, mat: LATA.name, len: 200, qty: 3 }]
  let prev = 0
  for (const o of KERF_OPTIONS) {
    const p = optimize(cuts, MATS, { [LATA.id]: 600 }, mmToCm(o.mm))[0]
    const bought = p.barCount * p.stock
    assert.ok(bought >= prev, `להב ${o.mm} קנה פחות מלהב צר יותר`)
    prev = bought
  }
})

test('המסור נספר בין חתיכות בלבד, ולא אחרי האחרונה', () => {
  // קורה 300 בדיוק, חתיכה אחת של 300 — בלי מסור בכלל
  const one = optimize([{ invId: LATA.id, mat: LATA.name, len: 300, qty: 1 }], MATS, { [LATA.id]: 300 }, 0.32)[0]
  assert.equal(one.barCount, 1)
})

test('התוכנית מדווחת באיזה רוחב חתך חושבה', () => {
  const p = optimize([{ invId: LATA.id, mat: LATA.name, len: 116, qty: 4 }], MATS, {}, mmToCm(2.4))[0]
  assert.equal(p.kerf, 0.24)
})

test('רוחב חתך לא תקין נופל לברירת המחדל', () => {
  const cuts = [{ invId: LATA.id, mat: LATA.name, len: 116, qty: 4 }]
  for (const bad of [null, undefined, NaN, 'אבג', -1]) {
    assert.equal(optimize(cuts, MATS, {}, bad)[0].kerf, mmToCm(DEFAULT_KERF_MM), `kerf=${bad}`)
  }
})
