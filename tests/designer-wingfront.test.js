// ============================================================
// קיר עם כנפיים — הרוחב הוא החזית.
// שי, 26.10.2026: בנה "קיר 300 עם כנפיים" לוואלי כפר סבא וקיבל
// קיר של 186. הרוחב כלל את הכנפיים (60+90+90+60), והן התקפלו
// לאחור — החזית יצאה 180 ועוד עובי הכנפיים.
// ============================================================

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { wallLayout } from '../src/designer/wall.js'
import { buildTemplate } from '../src/designer/templates.js'
import { defaultFrameMaterial } from '../src/designer/kulisa.js'
import { materialsFor } from '../src/designer/materials.js'

const MATS = materialsFor([])
const MAT = defaultFrameMaterial(MATS)

const footprint = (id, vals, opts) => {
  const out = buildTemplate(id, vals, opts)
  const specs = out.rows.map(r => (r.height ? { width: r.width, height: r.height } : r.width))
  return { out, r: wallLayout(specs, out.height, opts, out.layout) }
}

test('קיר 300 עם כנפיים של 60 יוצא 300 רוחב, לא 186', () => {
  const { out, r } = footprint('wings', { front: 300, height: 240, wing: 60 }, { material: MAT, braces: 3, giben: true })
  assert.equal(r.dims.רוחב, 300)
  assert.equal(r.dims.גובה, 240)
  // הכנפיים נשארות 60, והחזית מתחלקת לשתי קוליסות
  assert.equal(out.rows[0].width, 60)
  assert.equal(out.rows.at(-1).width, 60)
  assert.equal(r.kulisot, 4)
})

test('החזית יוצאת במידה בכל חומר ועם או בלי גיבן (עד חצי ס״מ של עיגול)', () => {
  for (const material of MATS) for (const giben of [true, false]) {
    for (const front of [150, 240, 300, 420]) {
      const { r } = footprint('wings', { front, height: 240, wing: 60 }, { material, braces: 3, giben })
      assert.ok(Math.abs(r.dims.רוחב - front) <= 0.5, `${material.id} giben=${giben} front=${front} → ${r.dims.רוחב}`)
    }
  }
})

test('דוכן: גם שם הרוחב הוא החזית', () => {
  const { r } = footprint('booth', { front: 120, height: 100, side: 40 }, { material: MAT, braces: 3, giben: true })
  assert.equal(r.dims.רוחב, 120)
})

test('בלי חומר אין מה למדוד — הבנייה לא נופלת', () => {
  const out = buildTemplate('wings', { front: 300, height: 240, wing: 60 })
  assert.equal(out.rows.length, 4)
})
