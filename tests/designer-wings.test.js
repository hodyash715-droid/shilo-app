// ============================================================
// סידור הקיר — כנפיים בצדדים.
// השאלה שחשובה כאן: מה מהסידור מגיע לנגר?
//   ברגים — בכל תפר, תמיד. הם החיבור עצמו.
//   קושרות — בתפר ישר בלבד, וניתנות לביטול.
//   הזזה בלי פינה — לא משנה אף אורך. אותו עץ בדיוק.
//   פינה — מורידה את שתי הקושרות של אותו תפר, והברגים נשארים.
// כל בדיקה כאן שומרת על ההבחנות האלה.
// ============================================================

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { wallLayout, transformGroup, groupPivot } from '../src/designer/wall.js'
import { defaultFrameMaterial } from '../src/designer/kulisa.js'
import { materialsFor } from '../src/designer/materials.js'
import { cutList, optimize } from '../src/designer/cuts.js'
import { KOSHRET, CORNER, JOINT } from '../src/designer/rules.js'
import { cornersOf, rawLenOf } from '../src/designer/geometry.js'

const MATS = materialsFor([])
const MAT = defaultFrameMaterial(MATS)
const OPTS = { material: MAT, braces: 3, giben: true }
const WIDTHS = [150, 120, 60, 30]

const build = (layout = {}, widths = WIDTHS, h = 240) =>
  wallLayout(widths, h, OPTS, layout)

const span = (r, k, ax) => {
  const g = r.parts.filter(p => p.k === k)
  const v = g.map(p => p.pos[ax])
  return [Math.min(...v), Math.max(...v)]
}
const rollup = r =>
  JSON.stringify(cutList(r.parts, r.dims, MATS)
    .map(x => [x.invId, x.len, x.qty]).sort())

test('הקבוצות: קוליסה לכל רוחב, והקושרות אחרונות ברשימה', () => {
  const r = build()
  assert.equal(r.groups.length, 5)
  // הסדר הוא מה שרואים על המסך: הקוליסות לפי מיקומן, קושרות בסוף
  assert.deepEqual(r.groups.map(g => g.k), [1, 2, 3, 4, 0])
  assert.deepEqual(r.groups.filter(g => g.k).map(g => g.width), WIDTHS)
  assert.equal(r.groups.find(g => g.k === 0).count, 6)   // 3 תפרים × 2
  assert.ok(r.groups.every(g => g.moved === false))
})

test('כנף של 90° מתקפלת אחורה ולא נשארת במישור הקיר', () => {
  const flat = build()
  const wing = build({ 4: { deg: -90 } })
  const fx = span(flat, 4, 'x'), wx = span(wing, 4, 'x')
  const fz = span(flat, 4, 'z'), wz = span(wing, 4, 'z')

  assert.ok(fx[1] - fx[0] > 25, 'לפני הסיבוב הקוליסה רחבה בציר x')
  assert.ok(wx[1] - wx[0] < 5, 'אחרי 90° היא כמעט חסרת רוחב בציר x')
  assert.ok(wz[1] - wz[0] > 25, 'ובמקום זה היא נמתחת לעומק')
  assert.ok(fz[1] - fz[0] < 5)
})

test('הסיבוב הוא סביב הקצה הפנימי — הכנף לא נעתקת מהתפר', () => {
  const flat = build()
  const wing = build({ 4: { deg: -90 } })
  // הקצה שנשאר במקום הוא זה שפונה למרכז
  assert.ok(Math.abs(span(flat, 4, 'x')[0] - span(wing, 4, 'x')[0]) <= 2)
})

test('סיבוב קוליסה אחת לא מזיז אף אחת אחרת', () => {
  const flat = build()
  const wing = build({ 4: { deg: -90 }, 3: { dz: 40 } })
  for (const k of [1, 2]) {
    assert.deepEqual(span(wing, k, 'x'), span(flat, k, 'x'), `ק${k} זזה בציר x`)
    assert.deepEqual(span(wing, k, 'z'), span(flat, k, 'z'), `ק${k} זזה בציר z`)
  }
})

// הזזת כל הקיר כגוש אחד לא יוצרת אף פינה
const SHIFT_ALL = { 1: { dx: 25, dz: 40 }, 2: { dx: 25, dz: 40 }, 3: { dx: 25, dz: 40 }, 4: { dx: 25, dz: 40 } }

test('הזזה בלי פינה לא משנה שום אורך — זה הדבר שמגיע לנגר', () => {
  const flat = build()
  const moved = build(SHIFT_ALL)
  assert.equal(moved.corners.length, 0)
  const lens = r => r.parts.map(p => rawLenOf(p, r.dims)).sort((a, b) => a - b)
  assert.deepEqual(lens(moved), lens(flat))
  assert.equal(moved.parts.length, flat.parts.length)
})

test('הזזה בלי פינה: רשימת החיתוך והקנייה זהות בדיוק', () => {
  const flat = build()
  const moved = build(SHIFT_ALL)
  assert.equal(rollup(moved), rollup(flat))
  const bars = r => optimize(cutList(r.parts, r.dims, MATS), MATS, {}, 0.32)[0]
  assert.equal(bars(moved).bars.length, bars(flat).bars.length)
  assert.equal(bars(moved).stock, bars(flat).stock)
})

test('פינה מורידה בדיוק את שתי הקושרות שלה — ולא נוגעת בכלום אחר', () => {
  const flat = build()
  const wing = build({ 4: { deg: -90 } })
  assert.equal(wing.corners.length, 1)
  assert.equal(wing.koshretDropped, KOSHRET.perJoint)
  assert.equal(wing.koshret, flat.koshret - KOSHRET.perJoint)
  assert.equal(wing.parts.length, flat.parts.length - KOSHRET.perJoint)

  // כל חלק שנשאר קיים גם בקיר הישר, באותו אורך
  const flatLens = r => r.parts.filter(p => p.k !== 0).map(p => rawLenOf(p, r.dims)).sort((a, b) => a - b)
  assert.deepEqual(flatLens(wing), flatLens(flat))
  // ורק שורת ה-50 בחיתוך קטנה
  const q50 = r => (cutList(r.parts, r.dims, MATS).find(x => x.len === 50)?.qty) || 0
  assert.equal(q50(wing), q50(flat) - KOSHRET.perJoint)
})

test('שתי כנפיים: שתי פינות, 4 קושרות פחות, והברגים לא נעלמים משום תפר', () => {
  const r = build({ 1: { deg: 90 }, 4: { deg: -90 } })
  assert.equal(r.corners.length, 2)
  assert.equal(r.koshretDropped, 2 * KOSHRET.perJoint)
  assert.equal(r.koshret, 6 - 4)
  assert.ok(r.corners.every(c => c.bolts === CORNER.bolts))
  // ברגים בכל תפר — גם בשניים הישרים שנשארו
  assert.equal(r.bolts, r.seams.reduce((n, x) => n + x.bolts, 0))
  assert.ok(r.seams.every(x => x.bolts > 0), 'תפר בלי ברגים')
})

test('קיר ישר: אפס פינות, אבל ברגים בכל תפר', () => {
  const r = build()
  assert.equal(r.corners.length, 0)
  assert.equal(r.koshretDropped, 0)
  assert.equal(r.koshret, 6)
  // שי: "בניהם מחברים ברגים ולפעמים גם קושרות" — הברגים הם החיבור
  assert.equal(r.seams.length, 3)
  assert.equal(r.bolts, 3 * JOINT.bolts)
  assert.ok(r.seams.every(x => x.koshret && !x.corner && x.canToggleKoshret))
})

test('סידור ריק זהה לקיר ישר, בייט בייט', () => {
  const a = build({})
  const b = build({ 2: { dx: 0, dz: 0, deg: 0 } })
  const strip = r => r.parts.map(p => [p.k, p.name, p.len, p.pos.x, p.pos.y, p.pos.z, p.yaw || 0])
  assert.deepEqual(strip(b), strip(a))
})

test('הסיבוב לא מצטבר על עצמו — 90 פעם אחת = 90, לא 180', () => {
  const once = build({ 4: { deg: -90 } })
  const again = build({ 4: { deg: -90 } })
  assert.deepEqual(span(again, 4, 'x'), span(once, 4, 'x'))
  assert.deepEqual(span(again, 4, 'z'), span(once, 4, 'z'))
})

test('החזרה למקום מחזירה בדיוק, גם אחרי סיבוב והזזה', () => {
  const flat = build()
  const back = build({ 4: { dx: 0, dz: 0, deg: 0 } })
  assert.deepEqual(span(back, 4, 'x'), span(flat, 4, 'x'))
  assert.deepEqual(span(back, 4, 'z'), span(flat, 4, 'z'))
  assert.ok(back.parts.filter(p => p.k === 4).every(p => !p.yaw))
})

test('הדגל moved נדלק רק על מה שבאמת זז', () => {
  const r = build({ 3: { deg: -90 }, 2: { dx: 0, dz: 0, deg: 0 } })
  const by = Object.fromEntries(r.groups.map(g => [g.k, g.moved]))
  assert.equal(by[3], true)
  assert.equal(by[2], false)
  assert.equal(by[1], false)
  assert.equal(by[0], false)
})

test('התיבה של חלק מסובב באמת מסתובבת', () => {
  const dims = { גובה: 240, רוחב: 100, עומק: 40, עובי: 2 }
  const flat = { id: 'a', invId: MAT.id, name: 'ל', axis: 'x', len: '100', pos: { x: 0, y: 10, z: 0 } }
  const turned = { ...flat, yaw: Math.PI / 2 }
  const ext = (p, ax) => {
    const c = cornersOf(p, dims, MATS).map(q => q[ax])
    return Math.round((Math.max(...c) - Math.min(...c)) * 10) / 10
  }
  assert.equal(ext(flat, 'x'), 100)
  assert.equal(ext(turned, 'x'), ext(flat, 'z'))   // התחלף
  assert.equal(ext(turned, 'z'), 100)
  assert.equal(ext(turned, 'y'), ext(flat, 'y'))   // הגובה לא נגע
})

test('yaw פסול לא מעקם את התיבה', () => {
  const dims = { גובה: 240, רוחב: 100, עומק: 40, עובי: 2 }
  const base = { id: 'a', invId: MAT.id, name: 'ל', axis: 'x', len: '100', pos: { x: 0, y: 10, z: 0 } }
  const w = p => {
    const c = cornersOf(p, dims, MATS).map(q => q.x)
    return Math.round((Math.max(...c) - Math.min(...c)) * 10) / 10
  }
  for (const bad of [null, undefined, NaN, 'abc', '']) {
    assert.equal(w({ ...base, yaw: bad }), 100, `yaw=${bad}`)
  }
})

test('ציר הסיבוב של קוליסה ימנית הוא הקצה השמאלי שלה, ולהפך', () => {
  const r = build()
  const right = r.parts.filter(p => p.k === 4)
  const left = r.parts.filter(p => p.k === 1)
  assert.equal(groupPivot(right).x, span(r, 4, 'x')[0])   // הקצה הפנימי
  assert.equal(groupPivot(left).x, span(r, 1, 'x')[1])
})

test('transformGroup לא נוגע בחלקים שלא נבחרו', () => {
  const r = build()
  const ids = r.parts.filter(p => p.k === 2).map(p => p.id)
  const out = transformGroup(r.parts, ids, { deg: 90, dx: 30 })
  for (const p of out) {
    if (p.k === 2) continue
    const orig = r.parts.find(x => x.id === p.id)
    assert.equal(p, orig, `${p.name} הוחלף בלי סיבה`)
  }
})

test('קיר בלי קוליסות תקינות לא מפיל את הסידור', () => {
  const r = wallLayout([999, 0], 240, OPTS, { 1: { deg: 90 } })
  assert.equal(r.parts.length, 0)
  assert.deepEqual(r.groups, [])
})

test('פינה מדווחת עם הזווית שלה, ותפר ישר לא', () => {
  const r = build({ 4: { deg: -90 } })
  assert.deepEqual(r.corners.map(c => c.between), [[3, 4]])
  assert.equal(r.corners[0].angle, -90)
  assert.equal(r.corners[0].bolts, CORNER.bolts)
  assert.equal(build().corners.length, 0)
})

test('שתי קוליסות שמסתובבות יחד לא שוברות את התפר ביניהן', () => {
  const r = build({ 3: { deg: -90 }, 4: { deg: -90 } })
  assert.deepEqual(r.corners.map(c => c.between), [[2, 3]])
  // התפר בין ק3 לק4 נשאר ישר, והקושרות שלו נשארות
  assert.equal(r.koshretDropped, KOSHRET.perJoint)
  assert.equal(r.seams.find(x => x.seam === 3).koshret, true)
})

test('הזזה שמרחיקה קוליסה משכנתה גם היא פותחת פינה', () => {
  const r = build({ 4: { dz: 60 } })
  assert.equal(r.corners.length, 1)
  assert.equal(r.corners[0].angle, 0)
  assert.equal(r.corners[0].apart, true)
  assert.equal(r.corners[0].bolts, CORNER.bolts)
})

// ---- הקושרת היא בחירה, הברגים לא ----

test('ביטול קושרת בתפר ישר מוריד בדיוק שתי לטות, והברגים נשארים', () => {
  const flat = build()
  const off = wallLayout(WIDTHS, 240, OPTS, {}, { 2: { koshret: false } })
  assert.equal(off.koshret, flat.koshret - KOSHRET.perJoint)
  assert.equal(off.bolts, flat.bolts)
  assert.equal(off.seams.find(x => x.seam === 2).koshret, false)
  assert.equal(off.seams.find(x => x.seam === 1).koshret, true)
})

test('החזרת הקושרת מחזירה בדיוק את מה שהורד', () => {
  const flat = build()
  const back = wallLayout(WIDTHS, 240, OPTS, {}, { 2: { koshret: true } })
  assert.equal(back.koshret, flat.koshret)
  assert.equal(rollup(back), rollup(flat))
})

test('פינה לא מקבלת קושרת גם אם מבקשים במפורש', () => {
  const r = wallLayout(WIDTHS, 240, OPTS, { 4: { deg: -90 } }, { 3: { koshret: true } })
  const seam = r.seams.find(x => x.seam === 3)
  assert.equal(seam.corner, true)
  assert.equal(seam.koshret, false)
  assert.equal(seam.canToggleKoshret, false)
  assert.equal(seam.bolts, CORNER.bolts)
})

test('ברגים נספרים בכל תפר, בכל צירוף', () => {
  for (const layout of [{}, { 4: { deg: -90 } }, { 1: { deg: 90 }, 4: { deg: -90 } }]) {
    for (const joints of [{}, { 1: { koshret: false } }, { 1: { koshret: false }, 2: { koshret: false } }]) {
      const r = wallLayout(WIDTHS, 240, OPTS, layout, joints)
      assert.equal(r.seams.length, WIDTHS.length - 1)
      assert.ok(r.seams.every(x => x.bolts >= JOINT.bolts))
      assert.equal(r.bolts, r.seams.reduce((n, x) => n + x.bolts, 0))
    }
  }
})

test('קוליסה אחת: אין תפרים, אין ברגים ואין קושרות', () => {
  const r = wallLayout([120], 240, OPTS)
  assert.deepEqual(r.seams, [])
  assert.equal(r.bolts, 0)
  assert.equal(r.koshret, 0)
})

// ---- סימוני ברגים: מלחיצה על המסך לנקודה על הגוף ----

import { project, cornersOf as corners8, pointOnFace, markAt } from '../src/designer/geometry.js'

const VIEW = { yaw: -0.7, pitch: 0.45, dist: 340, target: { x: 0, y: 120, z: 0 } }
const CW = 700, CH = 720
const DIMS = { גובה: 240, רוחב: 120, עומק: 40, עובי: 2 }
const POST = { id: 'p', invId: MAT.id, name: 'אנכית', axis: 'y', len: '240', pos: { x: 0, y: 120, z: 0 } }

// הפאה הקדמית, בדיוק כפי ש-render בונה אותה.
// שים לב: displayProfile מעבה חלקים דקים לצורך תצוגה, ולכן הפאה
// רחבה מ-2 ס״מ ויושבת קדימה מ-z=0. הבדיקות נמדדות מול הגוף המצויר.
const FRONT = [1, 5, 7, 3]
const faceOf = (part) => {
  const W3 = corners8(part, DIMS, MATS)
  return { world: FRONT.map(i => W3[i]), pts: FRONT.map(i => project(W3[i], VIEW, CW, CH)) }
}
const faceBox = (part) => {
  const w = faceOf(part).world
  const f = ax => [Math.min(...w.map(p => p[ax])), Math.max(...w.map(p => p[ax]))]
  return { x: f('x'), y: f('y'), z: f('z') }
}
// נקודה על מישור הפאה, לא על מרכז החלק
const onFace = (part, y) => ({ x: 0, y, z: faceBox(part).z[0] })

test('לחיצה על נקודה בפאה מחזירה בדיוק אותה נקודה', () => {
  const face = faceOf(POST)
  for (const y of [20, 60, 120, 180, 220]) {
    const p3 = onFace(POST, y)
    const scr = project(p3, VIEW, CW, CH)
    const got = pointOnFace(face, scr.x, scr.y, VIEW, CW, CH)
    assert.ok(Math.abs(got.y - y) < 0.2, `גובה ${got.y} במקום ${y}`)
    assert.ok(Math.abs(got.x) < 0.2, `סטייה רוחבית ${got.x}`)
  }
})

test('הסימון עוקב אחרי הלחיצה גם על חלק מסובב', () => {
  const turned = { ...POST, yaw: Math.PI / 4 }
  const face = faceOf(turned)
  const mid = faceOf(turned).world.reduce((a, p) => ({
    x: a.x + p.x / 4, y: a.y + p.y / 4, z: a.z + p.z / 4,
  }), { x: 0, y: 0, z: 0 })
  const scr = project(mid, VIEW, CW, CH)
  const got = pointOnFace(face, scr.x, scr.y, VIEW, CW, CH)
  assert.ok(Math.abs(got.y - mid.y) < 0.2, `${got.y} מול ${mid.y}`)
  assert.ok(Math.abs(got.x - mid.x) < 0.2, `${got.x} מול ${mid.x}`)
  assert.ok(Math.abs(got.z - mid.z) < 0.2, `${got.z} מול ${mid.z}`)
})

test('לחיצה מחוץ לפאה נצמדת לגבול שלה ולא בורחת לחלל', () => {
  const face = faceOf(POST)
  const B = faceBox(POST)
  for (const [x, y] of [[0, 0], [CW, 0], [0, CH], [CW, CH], [-500, -500]]) {
    const p = pointOnFace(face, x, y, VIEW, CW, CH)
    assert.ok(p, `לחיצה ב-${x},${y} לא החזירה נקודה`)
    assert.ok(p.y >= B.y[0] - 0.1 && p.y <= B.y[1] + 0.1, `y=${p.y} מחוץ ל-${B.y}`)
    assert.ok(p.x >= B.x[0] - 0.1 && p.x <= B.x[1] + 0.1, `x=${p.x} מחוץ ל-${B.x}`)
  }
})

test('פאה חסרה או תצוגה חסרה לא מפילות', () => {
  assert.equal(pointOnFace(null, 10, 10, VIEW, CW, CH), null)
  assert.equal(pointOnFace({ pts: [], world: [] }, 10, 10, VIEW, CW, CH), null)
  assert.equal(pointOnFace(faceOf(POST), 10, 10, null, CW, CH), null)
})

test('markAt מוצא סימון בטווח ומתעלם ממה שרחוק', () => {
  const marks = [{ pos: { x: 0, y: 200, z: 2 } }, { pos: { x: 0, y: 40, z: 2 } }]
  const a = project(marks[0].pos, VIEW, CW, CH)
  assert.equal(markAt(marks, VIEW, CW, CH, a.x, a.y), 0)
  assert.equal(markAt(marks, VIEW, CW, CH, a.x + 6, a.y - 5), 0)
  assert.equal(markAt(marks, VIEW, CW, CH, a.x + 90, a.y), null)
  assert.equal(markAt([], VIEW, CW, CH, a.x, a.y), null)
})

test('markAt בוחר את הקרוב ביותר כששניים צמודים', () => {
  const marks = [{ pos: { x: 0, y: 120, z: 2 } }, { pos: { x: 0, y: 128, z: 2 } }]
  const b = project(marks[1].pos, VIEW, CW, CH)
  assert.equal(markAt(marks, VIEW, CW, CH, b.x, b.y), 1)
})
