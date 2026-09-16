import { rawLenOf, profileOf } from './geometry.js'

// A read-only bridge to the designer: centimetres in, metres out. Do not use
// displayProfile here: that intentionally exaggerates timber in the small canvas.
export function studioParts(parts, dims, materials) {
  return parts.flatMap(part => {
    const length = rawLenOf(part, dims)
    const [narrow, wide] = profileOf(part, materials)
    if (!(length > 0 && narrow > 0 && wide > 0) || !part.pos ||
      ![part.pos.x, part.pos.y, part.pos.z, narrow, wide].every(Number.isFinite)) return []
    const size = part.axis === 'x' ? [length, wide, narrow]
      : part.axis === 'y' ? [narrow, length, wide] : [narrow, wide, length]
    return [{
      id: part.id, k: part.k, name: part.name, invId: part.invId,
      size: size.map(v => v / 100),
      position: [part.pos.x / 100, part.pos.y / 100, part.pos.z / 100],
      // The existing engine's positive yaw rotates X towards +Z; Three uses -Z.
      rotationY: Number.isFinite(Number(part.yaw)) ? -Number(part.yaw) : 0,
    }]
  })
}

export function studioBounds(items) {
  if (!items.length) return { min: [-1, 0, -0.5], max: [1, 2.4, 0.5], center: [0, 1.2, 0], size: [2, 2.4, 1] }
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity]
  for (const p of items) {
    const c = Math.abs(Math.cos(p.rotationY)), s = Math.abs(Math.sin(p.rotationY))
    const half = [(p.size[0] * c + p.size[2] * s) / 2, p.size[1] / 2,
      (p.size[0] * s + p.size[2] * c) / 2]
    for (let i = 0; i < 3; i++) {
      min[i] = Math.min(min[i], p.position[i] - half[i])
      max[i] = Math.max(max[i], p.position[i] + half[i])
    }
  }
  return { min, max, center: min.map((v, i) => (v + max[i]) / 2), size: min.map((v, i) => max[i] - v) }
}

export function matchesSelection(part, selection) {
  return !!selection && (selection.k != null ? part.k === selection.k : part.id === selection.id)
}
