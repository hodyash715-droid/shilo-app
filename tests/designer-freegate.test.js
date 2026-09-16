// ============================================================
// שער עצמאי — עומד בלי עיגון.
// שי, 16.9.2026:
//   "כל רגל מורכבת מ-4 קוליסות, כאשר הצלע שפונה לתוך השער
//    בשני הצדדים קצרה יותר" — נמוכה בגובה.
//   "עוד 3 קוליסות: אחת בכל צד של השער, קבלת קהל והיציאה,
//    ועוד אחת שסוגרת מעל כדי שלא יראו עץ חשוף. לפעמים מוסיפים
//    רק 2 ורואים עץ אם מסתכלים מלמעלה."
//   "שקי חול, הכמות משתנה בין 4 ל-6 לכל רגל."
// ============================================================

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { wallLayout, layGroupFlat, groupCenter } from '../src/designer/wall.js'
import { templateById, TEMPLATE_DEFAULTS } from '../src/designer/templates.js'
import { defaultFrameMaterial } from '../src/designer/kulisa.js'
import { materialsFor } from '../src/designer/materials.js'
import { cutList } from '../src/designer/cuts.js'
import { BALLAST } from '../src/designer/rules.js'
import { rawLenOf } from '../src/designer/geometry.js'

const MATS = materialsFor([])
const MAT = defaultFrameMaterial(MATS)
const OPTS = { material: MAT, braces: 2, giben: true }
const TPL = templateById('gate-free')

const build = (over = {}) => {
  const out = TPL.build({ ...TEMPLATE_DEFAULTS['gate-free'], ...over })
  const specs = out.rows.map(r => (r.height ? { width: r.width, height: r.height } : r.width))
  return { out, r: wallLayout(specs, out.height, OPTS, out.layout) }
}
const box = (r, k) => {
  const p = r.parts.filter(x => x.k === k)
  const f = ax => [Math.min(...p.map(q => q.pos[ax])), Math.max(...p.map(q => q.pos[ax]))]
  return { x: f('x'), y: f('y'), z: f('z') }
}

test('פתח שנכנס בקוליסה אחת נותן בדיוק 11 קוליסות: 4+4 ברגליים ועוד 3', () => {
  const { r } = build()      // 270 רוחב, רגל 60 ⇒ פתח 150, קוליסה אחת
  assert.equal(r.kulisot, 11)
})

test('כל רגל היא תיבה סגורה: חזית, גב, וצלע בכל צד', () => {
  const { r } = build()
  const D = TEMPLATE_DEFAULTS['gate-free'].depth
  for (const [front, back, outer, inner] of [[1, 2, 3, 4], [5, 6, 7, 8]]) {
    const F = box(r, front), B = box(r, back), O = box(r, outer), I = box(r, inner)
    // חזית וגב באותו רוחב, בעומקים הפוכים
    assert.deepEqual(F.x, B.x, 'חזית וגב לא מיושרות')
    assert.ok(Math.abs(F.z[0]) < 3, `חזית ב-z=${F.z[0]} ולא בחזית`)
    assert.ok(Math.abs(B.z[1] + D) < 3, `גב ב-z=${B.z[1]} ולא ב-${-D}`)
    // הצלעות עומדות על הקצוות ונמתחות לעומק
    for (const S of [O, I]) {
      assert.ok(S.x[1] - S.x[0] < 5, 'צלע לא עומדת על הקצה')
      assert.ok(S.z[1] - S.z[0] > D * 0.7, 'צלע לא נמתחת לעומק')
    }
    // הצלע החיצונית מחוץ לחזית, הפנימית בתוכה
    const outward = Math.sign((F.x[0] + F.x[1]) / 2)
    assert.ok(outward * (O.x[0] - F.x[0]) >= -1, 'הצלע החיצונית לא בחוץ')
    assert.ok(outward * (I.x[1] - F.x[1]) <= 1, 'הצלע הפנימית לא בפנים')
  }
})

test('הצלע שפונה אל הפתח נמוכה משלוש האחרות', () => {
  const { r } = build()
  const D = TEMPLATE_DEFAULTS['gate-free']
  for (const [front, back, outer, inner] of [[1, 2, 3, 4], [5, 6, 7, 8]]) {
    const tall = [front, back, outer].map(k => box(r, k).y[1])
    const low = box(r, inner).y[1]
    assert.ok(tall.every(t => t > low + 20), `הפנימית ב-${low} מול ${tall}`)
    assert.ok(Math.abs(low - D.inner) < 5, `הפנימית ${low} ולא ${D.inner}`)
  }
})

test('הקוליסה שסוגרת מלמעלה שוכבת — לא עומדת', () => {
  const { r } = build()
  const cap = box(r, 11)
  const g = r.parts.filter(p => p.k === 11)
  // עובי בלבד בגובה, ונמתחת לעומק
  assert.ok(cap.y[1] - cap.y[0] < 6, `השוכבת בגובה ${cap.y[1] - cap.y[0]}`)
  assert.ok(cap.z[1] - cap.z[0] > 40, 'השוכבת לא נמתחת לעומק')
  // האנכיות הפכו לחלקי עומק
  assert.ok(g.some(p => p.axis === 'z'), 'אף חלק לא הוסב לציר העומק')
  assert.ok(!g.some(p => p.axis === 'y'), 'נשאר חלק אנכי בקוליסה שוכבת')
  assert.ok(g.every(p => p.flat), 'לא כל החלקים סומנו כשוכבים')
  // ויושבת מעל הכותרות
  assert.ok(cap.y[0] >= box(r, 9).y[1] - 1, 'השוכבת לא מעל הכותרת')
})

test('השכבה לא משנה אף אורך — אותו עץ בדיוק', () => {
  const spec = [{ width: 120, height: 200 }]
  const up = wallLayout(spec, 200, OPTS)
  const flat = wallLayout(spec, 200, OPTS, { 1: { flat: true } })
  const lens = r => r.parts.map(p => rawLenOf(p, r.dims)).sort((a, b) => a - b)
  assert.deepEqual(lens(flat), lens(up))
  const roll = r => JSON.stringify(cutList(r.parts, r.dims, MATS).map(x => [x.len, x.qty]).sort())
  assert.equal(roll(flat), roll(up))
})

test('layGroupFlat מחליף צירים ולא נוגע בחלקים זרים', () => {
  const r = wallLayout([100, 100], 240, OPTS)
  const ids = r.parts.filter(p => p.k === 1).map(p => p.id)
  const out = layGroupFlat(r.parts, ids)
  assert.equal(out.length, r.parts.length)
  for (let i = 0; i < out.length; i++) {
    if (r.parts[i].k === 1) continue
    assert.equal(out[i], r.parts[i], `${out[i].name} הוחלף בלי סיבה`)
  }
  const mine = out.filter(p => p.k === 1)
  assert.ok(mine.every(p => p.axis !== 'y'), 'נשאר ציר אנכי')
  assert.ok(mine.every(p => p.pos.y >= 0), 'חלק שוכב מתחת לרצפה')
})

test('at ממקם את מרכז הקוליסה בדיוק איפה שביקשו', () => {
  for (const at of [{ x: 100, z: -50 }, { x: -37.5, z: 12 }, { x: 0, y: 200, z: -30 }]) {
    const r = wallLayout([100, 100, 100], 240, OPTS, { 2: { deg: 90, at } })
    const c = groupCenter(r.parts.filter(p => p.k === 2))
    for (const ax of Object.keys(at)) {
      assert.ok(Math.abs(c[ax] - at[ax]) < 0.6, `${ax}: ${c[ax]} במקום ${at[ax]}`)
    }
  }
})

test('שקי חול: בטווח שנמסר, ומוכפלים בשתי רגליים', () => {
  const [lo, hi] = BALLAST.perLegRange
  assert.equal(build().out.ballast.name, BALLAST.name)
  assert.equal(build().out.ballast.legs, 2)
  for (const [asked, want] of [[4, 4], [6, 6], [5, 5], [99, hi], [0, lo], [-3, lo]]) {
    assert.equal(build({ bags: asked }).out.ballast.perLeg, want, `ביקשנו ${asked}`)
  }
})

test('פתח רחב מתפצל, והשלישייה נשארת שלישייה לכל חתיכה', () => {
  const { r } = build({ width: 420 })      // פתח 300 ⇒ שתי חתיכות
  // 8 ברגליים + 3 סוגי כותרת × 2 חתיכות
  assert.equal(r.kulisot, 8 + 6)
  const caps = r.groups.filter(g => g.k > 8).map(g => g.k)
  assert.equal(caps.length, 6)
})

test('השער עומד על הרצפה ולא חודר אותה', () => {
  for (const over of [{}, { width: 420 }, { height: 300, inner: 120 }, { depth: 40, leg: 40 }]) {
    const { r } = build(over)
    assert.ok(r.parts.length > 0, JSON.stringify(over))
    assert.ok(r.parts.every(p => p.pos.y >= 0), `חלק מתחת לרצפה: ${JSON.stringify(over)}`)
  }
})

test('רשימת החיתוך מכילה את גובה הרגל ואת הצלע הנמוכה', () => {
  const { r, out } = build()
  const lens = cutList(r.parts, r.dims, MATS).map(x => x.len)
  // out.height הוא גובה הרגליים אחרי שהופחת עובי השוכבת
  assert.ok(lens.includes(out.height), `חסרות אנכיות של ${out.height}`)
  assert.ok(lens.includes(TEMPLATE_DEFAULTS['gate-free'].inner), 'חסרות אנכיות של הצלע הנמוכה')
})

test('"שער 3 מטר" יוצא 3 מטר — הגובה שנמסר הוא של השער כולו', () => {
  for (const asked of [200, 240, 290, 300]) {
    const { r } = build({ height: asked })
    assert.equal(r.dropped.length, 0, `גובה ${asked} נחסם`)
    assert.equal(r.dims.גובה, asked, `ביקשנו ${asked} וקיבלנו ${r.dims.גובה}`)
  }
})

test('הרגליים נמוכות מהשער בדיוק בעובי השוכבת', () => {
  const { r, out } = build({ height: 300 })
  const legTop = Math.max(...r.parts.filter(p => p.k === 1).map(p => p.pos.y))
  const capBottom = Math.min(...r.parts.filter(p => p.flat).map(p => p.pos.y))
  assert.ok(capBottom >= legTop - 1, 'השוכבת שוקעת לתוך הרגל')
  assert.ok(out.height < 300, 'גובה הרגל לא הופחת')
})

// ---- מה שהתגלה בשער של 604×360 ----

test('קושרת בין שתי קוליסות שוכבות נשכבת איתן ולא מרחפת', () => {
  for (const width of [420, 604, 800]) {
    const { r } = build({ width, height: 240 })
    const top = Math.max(...r.parts.map(p => p.pos.y))
    const ko = r.parts.filter(p => p.k === 0)
    const floating = ko.filter(p => p.pos.y > top + 1)
    assert.equal(floating.length, 0,
      `רוחב ${width}: ${floating.length} קושרות מרחפות ב-${floating.map(p => p.pos.y)}`)
    // הקושרות של השוכבות אכן סומנו כשוכבות
    const flat = ko.filter(p => p.flat)
    assert.ok(flat.every(p => p.axis !== 'y'), 'קושרת שוכבת נשארה בציר אנכי')
  }
})

test('כל חלק — כולל קושרות — נמצא בתוך התיבה של המבנה', () => {
  const { r } = build({ width: 604, height: 240 })
  const ext = ax => {
    const v = r.parts.filter(p => p.k !== 0).map(p => p.pos[ax])
    return [Math.min(...v), Math.max(...v)]
  }
  for (const ax of ['x', 'y', 'z']) {
    const [lo, hi] = ext(ax)
    for (const p of r.parts.filter(q => q.k === 0)) {
      assert.ok(p.pos[ax] >= lo - 8 && p.pos[ax] <= hi + 8,
        `קושרת מחוץ למבנה ב-${ax}: ${p.pos[ax]} מול [${lo}..${hi}]`)
    }
  }
})

test('שורה שנחסמה מדווחת, ולא נבלעת', () => {
  // רגליים ב-360 חורגות מהמקסימום ולכן נחסמות
  const { r, out } = build({ width: 604, height: 360 })
  assert.ok(r.dropped.length > 0, 'שורות נחסמו בלי דיווח')
  assert.equal(r.kulisot + r.dropped.length, out.rows.length,
    'סכום הנבנו והנחסמו לא מכסה את כל השורות')
  for (const d of r.dropped) {
    assert.ok(d.row >= 1 && d.row <= out.rows.length, `שורה ${d.row} מחוץ לטווח`)
    assert.ok(typeof d.error === 'string' && d.error.length > 0, 'חסר הסבר')
  }
})

test('הסידור נדבק לשורה שביקשה אותו, גם כששורות אחרות נחסמו', () => {
  const { r, out } = build({ width: 604, height: 360 })
  // כל קוליסה שנבנתה שומרת את מזהה השורה שלה
  const built = new Set(r.order)
  for (const d of r.dropped) assert.ok(!built.has(d.row), `שורה ${d.row} גם נחסמה וגם נבנתה`)
  for (const k of r.order) {
    const rowW = out.rows[k - 1].width
    const v = r.parts.filter(p => p.k === k && p.axis !== 'x').map(p => p.pos)
    assert.ok(v.length > 0, `ק${k} בלי חלקים`)
    // והסידור שהוחל עליה הוא זה שנכתב לשורה שלה
    if (out.layout[k]?.at) {
      assert.ok(rowW > 0, `ק${k} איבדה את השורה שלה`)
    }
  }
})
