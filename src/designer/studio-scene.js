import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { studioParts, studioBounds, matchesSelection } from './studio-model.js'

// This scene owns GPU resources only. Edits are sent back to Designer on release,
// so its existing history, wall assembly, cutting and save paths remain authoritative.
export function createStudio(host, callbacks) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.15
  renderer.domElement.setAttribute('aria-label', 'תצוגת העיצוב באולפן תלת־ממדי')
  host.appendChild(renderer.domElement)
  const canvas = renderer.domElement
  const scene = new THREE.Scene()
  scene.background = new THREE.Color('#e6e3dc')
  const camera = new THREE.PerspectiveCamera(42, 1, 0.02, 500)
  const controls = new OrbitControls(camera, canvas)
  controls.enableDamping = true
  controls.dampingFactor = 0.1
  controls.minDistance = 0.35
  controls.maxPolarAngle = Math.PI / 2 - 0.015
  controls.screenSpacePanning = true
  controls.autoRotateSpeed = 0.65

  const room = new THREE.Group(), design = new THREE.Group(), annotations = new THREE.Group()
  scene.add(room, design, annotations)
  const hemi = new THREE.HemisphereLight('#ffffff', '#9a8b76', 2.5)
  const key = new THREE.DirectionalLight('#fff2d7', 3)
  key.castShadow = true
  key.shadow.mapSize.set(2048, 2048)
  key.shadow.normalBias = 0.02
  key.shadow.bias = -0.0001
  const fill = new THREE.DirectionalLight('#d3e8ff', 1.6)
  scene.add(hemi, key, key.target, fill, fill.target)
  const outline = new THREE.Box3Helper(new THREE.Box3(), '#e1ad23')
  outline.visible = false
  outline.material.depthTest = false
  outline.material.transparent = true
  outline.renderOrder = 10
  scene.add(outline)

  let data = {}, meshes = [], wallMeshes = [], grid, human, bounds = studioBounds([])
  let selection = null, mode = 'orbit', drag = null, pointerStart = null, disposed = false
  let roomKey = '', roomAnchor = null, roomSize = [0, 0, 0], framed = false, raf = 0, framesLeft = 0
  let settings = { light: 'day', grid: true, person: true, marks: false, rotate: false }
  const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2()
  const unitBox = new THREE.BoxGeometry(1, 1, 1)
  const timber = new THREE.MeshStandardMaterial({ color: '#c49a65', roughness: 0.76 })
  const selectedMat = new THREE.MeshStandardMaterial({ color: '#dfb056', roughness: 0.65, emissive: '#6b4611', emissiveIntensity: 0.12 })
  const round = n => Math.round(n * 10) / 10

  function clearGroup(group) {
    group.traverse(o => {
      if (o.geometry && o.geometry !== unitBox) o.geometry.dispose()
      if (o.material && o.material !== timber && o.material !== selectedMat) {
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
          m.map?.dispose(); m.dispose()
        }
      }
    })
    group.clear()
  }

  function box(group, size, position, color, roughness = 0.8) {
    const mesh = new THREE.Mesh(unitBox, new THREE.MeshStandardMaterial({ color, roughness }))
    mesh.scale.set(...size); mesh.position.set(...position)
    mesh.receiveShadow = true
    group.add(mesh)
    return mesh
  }

  function buildRoom() {
    // Keep the room anchored while objects move; enlarge it only when needed.
    // Otherwise moving a single frame would also move its entire room.
    if (!roomAnchor) roomAnchor = [bounds.center[0], bounds.center[2]]
    const [cx, cz] = roomAnchor
    const width = Math.max(roomSize[0], 10, 2 * Math.max(bounds.max[0] - cx, cx - bounds.min[0]) + 6)
    const depth = Math.max(roomSize[2], 9, 2 * Math.max(bounds.max[2] - cz, cz - bounds.min[2]) + 6)
    const height = Math.max(roomSize[1], 4.5, bounds.max[1] + 1.5)
    roomSize = [width, height, depth]
    const signature = [width, depth, height, cx, cz].map(v => round(v)).join('/')
    if (signature === roomKey) return
    roomKey = signature
    clearGroup(room)
    box(room, [width, 0.12, depth], [cx, -0.07, cz], '#d0ccc3')
    // Four walls fade out from the exterior, like an architectural cutaway.
    wallMeshes = [
      box(room, [width, height, 0.12], [cx, height / 2, cz - depth / 2], '#edeae3'),
      box(room, [width, height, 0.12], [cx, height / 2, cz + depth / 2], '#edeae3'),
      box(room, [0.12, height, depth], [cx - width / 2, height / 2, cz], '#e3dfd5'),
      box(room, [0.12, height, depth], [cx + width / 2, height / 2, cz], '#e3dfd5'),
    ]
    wallMeshes.forEach((wall, i) => {
      wall.userData.side = i
      wall.material.transparent = true
      // Skirting and light strips inherit the wall's cutaway visibility.
      const trim = new THREE.Mesh(unitBox, new THREE.MeshStandardMaterial({ color: '#b7b3aa' }))
      trim.scale.set(i < 2 ? 1 : 1.08, 0.018, i < 2 ? 1.08 : 1)
      trim.position.y = -0.489
      wall.add(trim)
      const strip = new THREE.Mesh(unitBox, new THREE.MeshBasicMaterial({ color: '#fff7dc' }))
      strip.scale.set(i < 2 ? 0.83 : 1.15, 0.008, i < 2 ? 1.15 : 0.83)
      strip.position.y = 0.35
      wall.add(strip)
    })
    const lines = []
    for (let x = Math.ceil(-width / 2); x <= width / 2; x++) lines.push(x, 0, -depth / 2, x, 0, depth / 2)
    for (let z = Math.ceil(-depth / 2); z <= depth / 2; z++) lines.push(-width / 2, 0, z, width / 2, 0, z)
    grid = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(lines, 3)),
      new THREE.LineBasicMaterial({ color: '#a7a294', transparent: true, opacity: 0.4 }))
    grid.position.set(cx, 0.004, cz)
    grid.visible = settings.grid
    room.add(grid)
    human = new THREE.Group()
    const personMaterial = new THREE.MeshStandardMaterial({ color: '#737b79', roughness: 0.9 })
    const body = (geo, pos) => {
      const m = new THREE.Mesh(geo, personMaterial.clone())
      m.position.set(...pos); m.castShadow = true; human.add(m)
    }
    body(new THREE.SphereGeometry(0.1, 20, 14), [0, 1.6, 0])
    body(new THREE.CapsuleGeometry(0.17, 0.35, 6, 12), [0, 1.15, 0])
    for (const sign of [-1, 1]) {
      body(new THREE.CapsuleGeometry(0.065, 0.68, 5, 10), [sign * 0.09, 0.415, 0])
      body(new THREE.CapsuleGeometry(0.048, 0.51, 5, 10), [sign * 0.245, 1.12, 0])
    }
    personMaterial.dispose()
    human.position.set(bounds.min[0] - 0.7, 0, bounds.max[2] + 0.3)
    human.visible = settings.person
    room.add(human)
    key.position.set(cx - width * 0.25, height + 2, cz + depth * 0.4)
    key.target.position.set(cx, 1, cz)
    const shadowSpan = Math.max(width, depth) * 0.7
    Object.assign(key.shadow.camera, { left: -shadowSpan, right: shadowSpan, top: shadowSpan, bottom: -shadowSpan, far: Math.max(50, shadowSpan * 5) })
    key.shadow.camera.updateProjectionMatrix()
    fill.position.set(cx + width / 2, height, cz - depth / 2)
    fill.target.position.set(cx, 1, cz)
    controls.maxDistance = Math.max(width, depth) * 3
    camera.far = Math.max(500, controls.maxDistance * 3)
    camera.updateProjectionMatrix()
  }

  function updateOutline() {
    const selected = meshes.filter(m => matchesSelection(m.userData.part, selection))
    outline.visible = selected.length > 0
    outline.box.makeEmpty()
    selected.forEach(m => { m.updateMatrixWorld(); outline.box.expandByObject(m) })
    meshes.forEach(m => { m.material = selected.includes(m) ? selectedMat : timber })
  }

  function sync(next) {
    data = next
    const items = studioParts(next.parts, next.dims, next.materials)
    bounds = studioBounds(items)
    clearGroup(design); clearGroup(annotations)
    meshes = items.map(part => {
      const m = new THREE.Mesh(unitBox, timber)
      m.scale.set(...part.size); m.position.set(...part.position); m.rotation.y = part.rotationY
      m.castShadow = true; m.receiveShadow = true; m.userData.part = part
      design.add(m)
      return m
    })
    for (const mark of next.marks || []) {
      if (!mark.pos || ![mark.pos.x, mark.pos.y, mark.pos.z].every(Number.isFinite)) continue
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.025, 10, 8), new THREE.MeshBasicMaterial({ color: '#e844a5', depthTest: false }))
      m.position.set(mark.pos.x / 100, mark.pos.y / 100, mark.pos.z / 100)
      m.renderOrder = 9; annotations.add(m)
    }
    annotations.visible = settings.marks
    buildRoom(); updateOutline()
    if (!framed) { framed = true; setView('perspective') }
    invalidate()
  }

  function setView(view) {
    const target = new THREE.Vector3(...bounds.center)
    const radius = Math.max(1, Math.hypot(...bounds.size) / 2)
    const vfov = THREE.MathUtils.degToRad(camera.fov / 2)
    const angle = Math.min(vfov, Math.atan(Math.tan(vfov) * camera.aspect))
    const distance = radius / Math.sin(angle) * 1.17
    const directions = {
      perspective: [0.85, 0.42, 1.3], front: [0, 0.04, 1],
      side: [1, 0.06, 0.01], top: [0, 1, 0.001],
    }
    camera.position.copy(target).add(new THREE.Vector3(...(directions[view] || directions.perspective)).normalize().multiplyScalar(distance))
    controls.target.copy(target); controls.update(); invalidate()
  }

  function setOptions(next) {
    settings = { ...settings, ...next }
    if (grid) grid.visible = settings.grid
    if (human) human.visible = settings.person
    annotations.visible = settings.marks
    controls.autoRotate = settings.rotate
    const warm = settings.light === 'warm', night = settings.light === 'night'
    key.color.set(warm ? '#ffcc86' : '#fff2e4')
    key.intensity = night ? 2 : 3
    hemi.intensity = night ? 0.65 : 2.5
    fill.color.set(night ? '#7a9dff' : '#d3e8ff')
    scene.background.set(night ? '#373e49' : '#e6e3dc')
    renderer.toneMappingExposure = night ? 0.85 : 1.15
    invalidate()
  }

  function cast(event) {
    const rect = canvas.getBoundingClientRect()
    pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1)
    raycaster.setFromCamera(pointer, camera)
    return raycaster.intersectObjects(meshes, false)[0]
  }

  function down(e) {
    if (e.button !== 0 || drag) return
    pointerStart = { x: e.clientX, y: e.clientY }
    const hit = cast(e)
    if (mode !== 'edit' || !hit) return
    const part = hit.object.userData.part
    const chosen = data.isWall ? { k: part.k } : { id: part.id }
    callbacks.select(chosen)
    selection = chosen; updateOutline()
    if (data.isWall && !part.k) { invalidate(); return }
    e.stopImmediatePropagation()
    controls.enabled = false
    canvas.setPointerCapture(e.pointerId)
    const moving = meshes.filter(m => matchesSelection(m.userData.part, chosen))
    drag = { pointerId: e.pointerId, chosen, start: hit.point.clone(),
      plane: new THREE.Plane(new THREE.Vector3(0, 1, 0), -hit.point.y),
      moving: moving.map(m => ({ mesh: m, start: m.position.clone() })), delta: new THREE.Vector3() }
    canvas.style.cursor = 'grabbing'
    invalidate()
  }

  function move(e) {
    if (!drag || e.pointerId !== drag.pointerId) return
    cast(e)
    const point = raycaster.ray.intersectPlane(drag.plane, new THREE.Vector3())
    if (!point) return
    const delta = point.sub(drag.start)
    // Sub-millimetre jitter is discarded; no scene-dependent material constraints.
    drag.delta.set(round(delta.x * 100) / 100, 0, round(delta.z * 100) / 100)
    drag.moving.forEach(({ mesh, start }) => mesh.position.copy(start).add(drag.delta))
    updateOutline(); invalidate()
  }

  function finish(e) {
    if (drag && e.pointerId === drag.pointerId) {
      const done = drag
      drag = null; controls.enabled = true
      if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId)
      canvas.style.cursor = mode === 'edit' ? 'crosshair' : 'grab'
      done.moving.forEach(({ mesh, start }) => mesh.position.copy(start))
      if (e.type !== 'pointercancel' && done.delta.length() > 0.001) {
        callbacks.translate(done.chosen, { dx: round(done.delta.x * 100), dz: round(done.delta.z * 100) })
      }
      updateOutline(); invalidate()
    } else if (e.type === 'pointerup' && pointerStart && Math.hypot(e.clientX - pointerStart.x, e.clientY - pointerStart.y) < 5) {
      const hit = cast(e)
      const part = hit?.object.userData.part
      callbacks.select(part ? (data.isWall ? { k: part.k } : { id: part.id }) : null)
    }
    pointerStart = null
  }

  function renderFrame() {
    raf = 0
    if (disposed) return
    controls.update()
    // Hide only walls between the camera and the room centre.
    wallMeshes.forEach(w => {
      const i = w.userData.side
      w.visible = i === 0 ? camera.position.z > w.position.z
        : i === 1 ? camera.position.z < w.position.z
          : i === 2 ? camera.position.x > w.position.x : camera.position.x < w.position.x
    })
    renderer.render(scene, camera)
    if ((settings.rotate || --framesLeft > 0) && !raf) raf = window.requestAnimationFrame(renderFrame)
  }
  function invalidate() {
    if (disposed) return
    framesLeft = 24
    if (!raf) raf = window.requestAnimationFrame(renderFrame)
  }
  function resize() {
    const { width, height } = host.getBoundingClientRect()
    if (!width || !height) return
    camera.aspect = width / height; camera.updateProjectionMatrix()
    renderer.setSize(width, height)
    if (framed) setView('perspective')
    invalidate()
  }
  const observer = new window.ResizeObserver(resize)
  observer.observe(host)
  controls.addEventListener('change', invalidate)
  controls.addEventListener('start', () => { if (settings.rotate) callbacks.stopRotate() })
  canvas.addEventListener('pointerdown', down, true)
  canvas.addEventListener('pointermove', move)
  canvas.addEventListener('pointerup', finish)
  canvas.addEventListener('pointercancel', finish)
  const contextLost = e => { e.preventDefault(); callbacks.error('התצוגה התלת־ממדית נעצרה. אפשר לסגור ולפתוח את האולפן מחדש; העיצוב נשמר במעצב.') }
  canvas.addEventListener('webglcontextlost', contextLost)
  resize()

  return {
    sync, setView, setOptions,
    select(value) { selection = value; updateOutline(); invalidate() },
    mode(value) { mode = value; canvas.style.cursor = value === 'edit' ? 'crosshair' : 'grab' },
    zoom(factor) {
      const offset = camera.position.clone().sub(controls.target)
      offset.setLength(THREE.MathUtils.clamp(offset.length() * factor, controls.minDistance, controls.maxDistance))
      camera.position.copy(controls.target).add(offset); controls.update(); invalidate()
    },
    dispose() {
      disposed = true
      if (raf) window.cancelAnimationFrame(raf)
      observer.disconnect(); controls.dispose()
      canvas.removeEventListener('pointerdown', down, true)
      canvas.removeEventListener('pointermove', move)
      canvas.removeEventListener('pointerup', finish)
      canvas.removeEventListener('pointercancel', finish)
      canvas.removeEventListener('webglcontextlost', contextLost)
      clearGroup(design); clearGroup(annotations); clearGroup(room)
      outline.geometry.dispose(); outline.material.dispose()
      unitBox.dispose(); timber.dispose(); selectedMat.dispose()
      key.shadow.map?.dispose()
      renderer.dispose(); renderer.forceContextLoss(); canvas.remove()
    },
  }
}
