import { test } from 'node:test'
import assert from 'node:assert/strict'
import { studioParts, studioBounds, matchesSelection } from '../src/designer/studio-model.js'
import { generateKulisa } from '../src/designer/kulisa.js'
import { wallLayout } from '../src/designer/wall.js'
import { cornersOf } from '../src/designer/geometry.js'

const material = { id: 'wood', name: 'לטה 4×2' }
const dims = { רוחב: 120, גובה: 240, עומק: 40, עובי: 2 }

test('studio uses actual profile and formula lengths, without modifying production data', () => {
  const { parts } = generateKulisa({ width: 120, height: 240, material })
  const before = JSON.stringify(parts)
  const items = studioParts(parts, dims, [material])
  assert.equal(items.length, 9)
  assert.deepEqual(items[0].size, [0.02, 2.4, 0.04])
  assert.deepEqual(items[2].size, [1.16, 0.04, 0.02])
  assert.equal(studioBounds(items).size[0], 1.2)
  assert.equal(JSON.stringify(parts), before)
})

test('Three rotation follows the existing positive-yaw convention', () => {
  const part = { id: 'p', axis: 'x', len: 20, name: '4×4', yaw: Math.PI / 4, pos: { x: 30, y: 10, z: 40 } }
  const [item] = studioParts([part], {}, [])
  const local = [-0.1, -0.02, -0.02]
  const c = Math.cos(item.rotationY), s = Math.sin(item.rotationY)
  const world = [item.position[0] + c * local[0] + s * local[2],
    item.position[1] + local[1], item.position[2] - s * local[0] + c * local[2]]
  const existing = cornersOf(part, {}, [])[0]
  world.forEach((v, i) => assert.ok(Math.abs(v * 100 - existing[['x', 'y', 'z'][i]]) < 1e-9))
})

test('bounds include raised gate headers and rotated wings', () => {
  const wall = wallLayout([{ width: 120, height: 240 }, { width: 120, height: 60 }, { width: 120, height: 240 }], 240,
    { material, braces: 3, giben: true, depth: 40 }, { 2: { dy: 240 }, 3: { deg: 90, dz: 30 } }, {})
  const items = studioParts(wall.parts, wall.dims, [material])
  const bounds = studioBounds(items)
  assert.ok(items.length > 0)
  assert.equal(bounds.max[1], 3)
  assert.ok(bounds.size[2] >= 1.19)
  assert.ok(items.filter(p => matchesSelection(p, { k: 2 })).every(p => p.position[1] >= 2.4))
})

test('invalid lengths and coordinates never become fake visible timber', () => {
  const p = { id: 'p', name: '4×2', axis: 'y', pos: { x: 0, y: 0, z: 0 } }
  assert.deepEqual(studioParts([{ ...p, len: '-8' }, { ...p, len: 'bad' }, { ...p, len: 12, pos: { x: NaN, y: 0, z: 0 } }], {}, []), [])
  assert.ok(studioBounds([]).size.every(Number.isFinite))
})

test('connectors are selectable as group zero, without selecting unrelated parts', () => {
  assert.equal(matchesSelection({ k: 0 }, { k: 0 }), true)
  assert.equal(matchesSelection({ k: 2 }, { k: 0 }), false)
  assert.equal(matchesSelection({ id: 'part' }, { id: 'part' }), true)
  assert.equal(matchesSelection({ id: 'part' }, null), false)
})
