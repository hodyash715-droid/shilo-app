// ============================================================
// שער: קוליסות בגבהים שונים, וכותרת שמורמת מהרצפה.
// שי: "שער מורכב מהרבה קוליסות בגדלים ורוחבים שונים",
//     "בניהם מחברים ברגים ולפעמים גם קושרות",
//     "ברגים זה משתנה בין 3-6".
// ============================================================

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { wallLayout, wallParts, kulisaSpec, assembleWall } from '../src/designer/wall.js'
import { defaultFrameMaterial } from '../src/designer/kulisa.js'
import { materialsFor } from '../src/designer/materials.js'
import { cutList } from '../src/designer/cuts.js'
import { JOINT, LIMITS } from '../src/designer/rules.js'
import { rawLenOf } from '../src/designer/geometry.js'

const MATS = materialsFor([])
const MAT = defaultFrameMaterial(MATS)
const OPTS = { material: MAT, braces: 2, giben: true }

// שער: שתי רגליים של 60 בגובה 240, כותרת של 140 בגובה 60
const GATE = [{ width: 60 }, { width: 140, height: 60 }, { width: 60 }]
const RAISE = { 2: { dy: 180 } }

const box = (r, k) => {
  const g = r.parts.filter(p => p.k === k)
  const f = ax => [Math.min(...g.map(p => p.pos[ax])), Math.max(...g.map(p => p.pos[ax]))]
  return { x: f('x'), y: f('y') }
}

test('kulisaSpec מקבל מספר או אובייקט, ונופל לגובה הקיר', () => {
  assert.deepEqual(kulisaSpec(120, 240), { width: 120, height: 240 })
  assert.deepEqual(kulisaSpec({ width: 140, height: 60 }, 240), { width: 140, height: 60 })
  assert.deepEqual(kulisaSpec({ width: 140 }, 240), { width: 140, height: 240 })
  // גובה פסול נופל לגובה הקיר ולא מייצר קוליסה באפס
  for (const bad of [0, -5, NaN, null, 'שלום']) {
    assert.equal(kulisaSpec({ width: 100, height: bad }, 240).height, 240, `height=${bad}`)
  }
})

test('קיר רגיל של מספרים לא השתנה בכלל', () => {
  const a = wallParts([150, 120, 60], 240, OPTS)
  const b = wallParts([{ width: 150 }, { width: 120 }, { width: 60 }], 240, OPTS)
  const strip = r => r.parts.map(p => [p.k, p.name, p.len, p.pos.x, p.pos.y, p.pos.z])
  assert.deepEqual(strip(b), strip(a))
  assert.deepEqual(b.dims, a.dims)
})

test('כל קוליסה נבנית בגובה שלה', () => {
  const r = wallParts(GATE, 240, OPTS)
  assert.equal(r.kulisot, 3)
  const vert = k => r.parts.filter(p => p.k === k && p.axis === 'y').map(p => Number(p.len))
  assert.deepEqual(vert(1), [240, 240])
  assert.deepEqual(vert(2), [60, 60])     // הכותרת נמוכה
  assert.deepEqual(vert(3), [240, 240])
})

test('גובה המשטח הוא הגבוה שבקוליסות, לא הממוצע ולא האחרון', () => {
  assert.equal(wallParts(GATE, 240, OPTS).dims.גובה, 240)
  assert.equal(wallParts([{ width: 100, height: 80 }, { width: 100, height: 200 }], 240, OPTS).dims.גובה, 200)
  // גובה הקיר משמש רק כברירת מחדל למי שלא ביקש גובה משלו
  assert.equal(wallParts([{ width: 100, height: 80 }], 240, OPTS).dims.גובה, 80)
})

test('הקושרת מגיעה עד ראש הנמוכה שבשתי הקוליסות', () => {
  const r = wallParts([{ width: 100 }, { width: 100, height: 120 }], 240, OPTS)
  const top = r.parts.filter(p => p.k === 0).map(p => p.pos.y).sort((a, b) => b - a)[0]
  // ph/2 מתחת לראש של 120, לא של 240
  assert.ok(top < 120 && top > 115, `קושרת עליונה ב-${top}`)
})

test('הרמה מוציאה את הכותרת מהרצפה ולא נוגעת ברגליים', () => {
  const flat = wallLayout(GATE, 240, OPTS)
  const gate = wallLayout(GATE, 240, OPTS, RAISE)
  assert.deepEqual(box(flat, 2).y, [2, 58])       // לפני: על הרצפה
  assert.deepEqual(box(gate, 2).y, [182, 238])    // אחרי: מורמת ל-180
  for (const k of [1, 3]) {
    assert.deepEqual(box(gate, k).y, box(flat, k).y, `רגל ${k} זזה בגובה`)
    assert.deepEqual(box(gate, k).x, box(flat, k).x, `רגל ${k} זזה ברוחב`)
  }
})

test('הכותרת יושבת בין הרגליים, לא מעליהן ולא מחוץ להן', () => {
  const g = wallLayout(GATE, 240, OPTS, RAISE)
  const [l, mid, r] = [box(g, 1), box(g, 2), box(g, 3)]
  assert.ok(mid.x[0] > l.x[1], 'הכותרת לא מתחילה אחרי הרגל השמאלית')
  assert.ok(mid.x[1] < r.x[0], 'הכותרת לא נגמרת לפני הרגל הימנית')
  assert.equal(g.dims.רוחב, 260)
})

test('הרמה בלבד נספרת כסידור — בלי זה היא הייתה מדולגת', () => {
  const g = wallLayout(GATE, 240, OPTS, RAISE)
  assert.equal(g.groups.find(x => x.k === 2).moved, true)
  assert.equal(g.groups.find(x => x.k === 1).moved, false)
})

test('הרמה מנתקת את התפר: ברגים במקום קושרות', () => {
  const flat = wallLayout(GATE, 240, OPTS)
  const gate = wallLayout(GATE, 240, OPTS, RAISE)
  assert.ok(flat.seams.every(s => !s.corner))
  assert.ok(gate.seams.every(s => s.corner), 'תפר של כותרת מורמת נשאר ישר')
  assert.equal(gate.koshret, 0)
  assert.equal(gate.koshretDropped, flat.koshret)
})

test('הרמה לא משנה אף אורך — אותו עץ בדיוק', () => {
  const flat = wallLayout(GATE, 240, OPTS)
  const gate = wallLayout(GATE, 240, OPTS, RAISE)
  const wood = r => r.parts.filter(p => p.k !== 0).map(p => rawLenOf(p, r.dims)).sort((a, b) => a - b)
  assert.deepEqual(wood(gate), wood(flat))
})

test('ברגים לכל תפר, בטווח 3–6', () => {
  const r = wallLayout(GATE, 240, OPTS, {}, { 1: { bolts: 6 }, 2: { bolts: 4 } })
  assert.equal(r.seams.find(s => s.seam === 1).bolts, 6)
  assert.equal(r.seams.find(s => s.seam === 2).bolts, 4)
  assert.equal(r.bolts, 10)
  assert.deepEqual(r.seams[0].boltsRange, JOINT.boltsRange)
})

test('מספר ברגים מחוץ לטווח נחסם, לא מתקבל', () => {
  const [lo, hi] = JOINT.boltsRange
  for (const [asked, want] of [[99, hi], [0, lo], [-4, lo], [7, hi], [2, lo]]) {
    const r = wallLayout(GATE, 240, OPTS, {}, { 1: { bolts: asked } })
    assert.equal(r.seams.find(s => s.seam === 1).bolts, want, `ביקשנו ${asked}`)
  }
  // ערך לא מספרי נופל לברירת המחדל
  for (const bad of [NaN, null, 'שש', undefined]) {
    const r = wallLayout(GATE, 240, OPTS, {}, { 1: { bolts: bad } })
    assert.equal(r.seams.find(s => s.seam === 1).bolts, JOINT.bolts, `bolts=${bad}`)
  }
})

test('כותרת רחבה מהמקסימום נחסמת — שער רחב מפוצל לכמה חתיכות', () => {
  const r = wallParts([{ width: 60 }, { width: LIMITS.maxWidth + 50, height: 60 }, { width: 60 }], 240, OPTS)
  assert.equal(r.kulisot, 2)
  assert.equal(r.dims.רוחב, 120)
})

test('רשימת החיתוך של שער מכילה את שני הגבהים', () => {
  const g = wallLayout(GATE, 240, OPTS, RAISE)
  const lens = cutList(g.parts, g.dims, MATS).map(r => r.len)
  assert.ok(lens.includes(240), 'חסרות אנכיות של 240')
  assert.ok(lens.includes(60), 'חסרות אנכיות של 60')
})

test('מסך ההרכבה מסכים עם המשטח על גבהים שונים', () => {
  const panel = assembleWall(GATE, 240, { ...OPTS, materials: MATS })
  const canvas = wallParts(GATE, 240, OPTS)
  const roll = rows => JSON.stringify(
    [...rows.reduce((m, r) => m.set(`${r.invId}|${r.len}`, (m.get(`${r.invId}|${r.len}`) || 0) + r.qty), new Map())].sort()
  )
  assert.equal(roll(cutList(canvas.parts, canvas.dims, MATS)), roll(panel.rows))
  assert.deepEqual(panel.kulisot.map(k => k.height), [240, 60, 240])
})

test('העמסה מציגה את הגובה האמיתי של כל קוליסה', () => {
  const w = assembleWall(GATE, 240, { ...OPTS, materials: MATS })
  const details = w.loading.filter(l => l.kind === 'kulisa').map(l => l.detail)
  assert.deepEqual(details, ['60×240 ס״מ', '140×60 ס״מ', '60×240 ס״מ'])
})

// ---- מה ש-fuzz תפס ----

test('קוליסה נמוכה משתי אופקיות נחסמת, ולא מייצרת חלקים מחוץ לגובה', () => {
  for (const h of [1, 3, 8]) {
    const r = wallParts([{ width: 100, height: h }], 240, OPTS)
    assert.equal(r.parts.length, 0, `גובה ${h} נבנה`)
  }
  // ומעל הסף היא כן נבנית
  const ok = wallParts([{ width: 100, height: 30 }], 240, OPTS)
  assert.ok(ok.parts.length > 0)
  assert.ok(ok.parts.every(p => p.pos.y >= 0 && p.pos.y <= 30))
})

test('הרמה שלילית לא שוקעת קוליסה מתחת לרצפה', () => {
  const flat = wallLayout(GATE, 240, OPTS)
  for (const dy of [-1, -50, -500]) {
    const r = wallLayout(GATE, 240, OPTS, { 2: { dy } })
    assert.deepEqual(box(r, 2).y, box(flat, 2).y, `dy=${dy} הזיז את הקוליסה`)
    assert.ok(r.parts.every(p => p.pos.y >= 0), `dy=${dy} הוריד חלק מתחת לרצפה`)
  }
})

test('הרמה שלילית גם לא נספרת כסידור ולא שוברת תפר', () => {
  const r = wallLayout(GATE, 240, OPTS, { 2: { dy: -80 } })
  assert.equal(r.groups.find(g => g.k === 2).moved, false)
  assert.ok(r.seams.every(s => !s.corner))
  assert.equal(r.koshret, wallLayout(GATE, 240, OPTS).koshret)
})
