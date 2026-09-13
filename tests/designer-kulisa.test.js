import { test } from 'node:test'
import assert from 'node:assert/strict'
import { generateKulisa, bracePositions, sectionOf, defaultFrameMaterial, BRACE_DEFAULT } from '../src/designer/kulisa.js'
import { cutList } from '../src/designer/cuts.js'
import { invalidParts, innerWidth, VERTICAL_FACE_CM, GIBEN, gibenMemberCount } from '../src/designer/rules.js'
import { materialsFor } from '../src/designer/materials.js'

const MAT = { id: 'm1', name: 'לטה 2×3', stock_len: 300, category: 'material' }
const gen = (o) => generateKulisa({ material: MAT, width: 120, height: 240, ...o })

test('חתך נגזר משם החומר, לא ממספר קבוע', () => {
  assert.deepEqual(sectionOf(MAT), [2, 3])
  assert.deepEqual(sectionOf({ id: 'x', name: 'קורה 5×10' }), [5, 10])
})

test('מיקומי חיזוק בחלוקה שווה', () => {
  assert.deepEqual(bracePositions(240, 3), [60, 120, 180])
  assert.deepEqual(bracePositions(300, 4), [60, 120, 180, 240])
  assert.deepEqual(bracePositions(240, 0), [])
})

test('מסגרת פשוטה 120×240 עם 3 חיזוקים = 7 חלקים', () => {
  const r = gen({ braces: 3, giben: false })
  assert.deepEqual(r.errors, [])
  assert.equal(r.parts.length, 7)
  assert.equal(r.plan.inner, 116)          // 120 − 2×2
  assert.deepEqual(r.plan.braces, [60, 120, 180])
})

// שי בונה את כל הגיבנים (אושר 13.9.2026) — לכן זו ברירת המחדל.
test('ברירת המחדל: 2 גיבנים, 4 לטות, 120×240 = 9 חלקים', () => {
  const r = gen({ braces: 3 })
  assert.equal(r.parts.length, 9)
  assert.equal(r.plan.counts.gibens, 2)
  assert.equal(r.plan.counts.gibenMembers, 4)
  assert.equal(r.plan.counts.horizontals, 4)
  const names = r.parts.filter(p => p.name.includes('גיבן')).map(p => p.name)
  assert.equal(names.length, 4)
  assert.equal(names.filter(n => n.includes('עליון')).length, 2)
  assert.equal(names.filter(n => n.includes('תחתון')).length, 2)
})

test('בלי גיבן אין ספירת גיבנים', () => {
  const r = gen({ braces: 3, giben: false })
  assert.equal(r.plan.counts.gibens, 0)
  assert.equal(r.plan.counts.gibenMembers, 0)
  assert.equal(r.parts.filter(p => p.name.includes('גיבן')).length, 0)
})

test('אורך האופקיים הוא רוחב פחות שתי אנכיות', () => {
  const dims = { גובה: 240, רוחב: 120, עומק: 40, עובי: 2 }
  const plain = cutList(gen({ braces: 3, giben: false }).parts, dims, [MAT])
  assert.deepEqual(plain.map(x => [x.len, x.qty]), [[240, 2], [116, 5]])
  const withG = cutList(gen({ braces: 3 }).parts, dims, [MAT])
  assert.deepEqual(withG.map(x => [x.len, x.qty]), [[240, 2], [116, 7]])
})

test('הנוסחה עוקבת אחרי שינוי רוחב', () => {
  const r = gen({ braces: 3 })
  const rows = cutList(r.parts, { גובה: 240, רוחב: 150, עומק: 40, עובי: 2 }, [MAT])
  assert.equal(rows.find(x => x.len !== 240).len, 146)   // 150 − 4
})

test('גיבן מוסיף שתי לטות באותו אורך', () => {
  const plain = gen({ braces: 3, giben: false }), withG = gen({ braces: 3, giben: true })
  assert.equal(withG.parts.length - plain.parts.length, 2)
  assert.equal(withG.plan.counts.horizontals, 4)
  assert.match(withG.warnings.join(), /90°/)
})

test('כל החלקים שנוצרו תקינים', () => {
  const r = gen({ braces: 4, giben: true })
  assert.deepEqual(invalidParts(r.parts, { גובה: 240, רוחב: 120, עומק: 40, עובי: 2 }), [])
})

test('מידה לא חוקית נחסמת', () => {
  assert.match(gen({ width: 0 }).errors.join(), /אפס/)
  assert.match(gen({ height: -10 }).errors.join(), /שלילי/)
  assert.match(gen({ width: NaN }).errors.join(), /אינו מספר/)
  assert.equal(gen({ width: 0 }).parts.length, 0)
})

test('חריגה מהמקסימום חוסמת במחולל', () => {
  assert.match(gen({ width: 200 }).errors.join(), /פצל לשתי קוליסות/)
  assert.match(gen({ height: 400 }).errors.join(), /מעל המקסימום/)
})

test('רוחב צר משתי אנכיות נחסם', () => {
  assert.match(gen({ width: 3 }).errors.join(), /קטן מדי/)
})

test('מידה לא סטנדרטית עוברת עם אזהרה בלבד', () => {
  const r = gen({ width: 133 })
  assert.deepEqual(r.errors, [])
  assert.match(r.warnings.join(), /אינה מידה סטנדרטית|אינו מידה סטנדרטית/)
})

test('בלי חומר לא מייצרים', () => {
  assert.match(generateKulisa({ width: 120, height: 240, material: null }).errors.join(), /חומר/)
})

test('ברירת המחדל היא 3 חיזוקים', () => {
  assert.equal(BRACE_DEFAULT, 3)
  assert.equal(gen({}).plan.braces.length, 3)
})

test('המקסימום שאושר: 150 רוחב על 300 גובה', () => {
  assert.deepEqual(gen({ width: 150, height: 300, braces: 4 }).errors, [])
  assert.equal(gen({ width: 151, height: 300 }).errors.length, 1)
  assert.equal(gen({ width: 150, height: 301 }).errors.length, 1)
})

// ---------- הכלל שאושר על ידי שי: 120 ⇒ 116 ----------
test('הכלל המאושר — אנכית תופסת 2 ס"מ, פנימי של 120 הוא 116', () => {
  assert.equal(VERTICAL_FACE_CM, 2)
  assert.equal(innerWidth(120), 116)
  assert.equal(innerWidth(150), 146)
  assert.equal(innerWidth(40), 36)
})

test('ברירת המחדל היא חומר שמקיים את הכלל, גם כשהמלאי מתחיל בחומר אחר', () => {
  const mats = materialsFor([{ id: 'inv1', name: 'קורה 5×5', stock_len: 300, category: 'material' }])
  assert.equal(mats[0].name, 'קורה 5×5', 'המלאי של שי אמור להיות ראשון')
  const pick = defaultFrameMaterial(mats)
  assert.equal(sectionOf(pick)[0], VERTICAL_FACE_CM)
  assert.equal(generateKulisa({ width: 120, height: 240, material: pick }).plan.inner, 116)
})

test('חומר שחורג מהכלל עובד — אבל מזהיר ומראה את ההפרש', () => {
  const thick = { id: 'k', name: 'קורה 5×5', stock_len: 300 }
  const r = generateKulisa({ width: 120, height: 240, material: thick })
  assert.deepEqual(r.errors, [])
  assert.equal(r.plan.inner, 110)
  assert.match(r.warnings.join(), /במקום 2 שאושרו/)
  assert.match(r.warnings.join(), /110 ולא 116/)
})

test('חומר תקין לא מייצר אזהרת סטייה', () => {
  const r = generateKulisa({ width: 120, height: 240, material: MAT })
  assert.equal(r.warnings.some(w => /שאושרו/.test(w)), false)
})

// אושר על ידי שי (13.9.2026): 2 גיבנים, כל אחד משתי לטות.
test('כלל הגיבן מוצהר ומאושר', () => {
  assert.equal(GIBEN.perKulisa, 2)
  assert.equal(GIBEN.membersEach, 2)
  assert.equal(GIBEN.status, 'verified')
  assert.equal(gibenMemberCount(), 4)
})

test('מספר לטות הגיבן שנוצרות תואם לכלל', () => {
  const r = gen({ braces: 3 })
  const gibenParts = r.parts.filter(p => p.name.includes('גיבן'))
  assert.equal(gibenParts.length, gibenMemberCount())
  // כל הלטות באותו אורך — רוחב מינוס שתי אנכיות
  assert.equal(new Set(gibenParts.map(p => p.len)).size, 1)
  assert.equal(gibenParts[0].len, `{רוחב}-${2 * VERTICAL_FACE_CM}`)
})

test('כל גיבן יושב בגובה אחד — הלטות נבדלות בעומק בלבד', () => {
  const r = gen({ braces: 3 })
  const top = r.parts.filter(p => p.name.includes('גיבן עליון'))
  assert.equal(top.length, GIBEN.membersEach)
  assert.equal(new Set(top.map(p => p.pos.y)).size, 1, 'אותו גובה')
  assert.equal(new Set(top.map(p => p.pos.z)).size, GIBEN.membersEach, 'עומק שונה')
})
