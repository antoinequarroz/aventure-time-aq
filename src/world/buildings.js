import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { mat, mesh } from './helpers.js'

// Bâtiments low-poly dans l'esprit de mike-fernandez.dev : formes anguleuses, pierre lavande,
// toits sombres, colombages, fenêtres qui luisent et torches.

const rand = (seed) => {
  let s = Math.abs(Math.floor(seed * 9973)) % 2147483647 || 1
  return () => (s = (s * 16807) % 2147483647) / 2147483647
}

const STONE = 0x9893b8
const STONE_DARK = 0x6f6a92
const ROOF = 0x3a3270
const WOOD = 0x5a3a2c
const GLOW = { emissive: 0xffa95a, emissiveIntensity: 2.2 }

// Pierres en saillie sur un mur : petits blocs de nuances différentes, fusionnés en un seul objet.
function stoneBlocks(group, { w, h, z, x = 0, y0 = 0, count, seed, rotY = 0 }) {
  const r = rand(seed)
  const geos = []
  const c = new THREE.Color()
  for (let i = 0; i < count; i++) {
    const g = new THREE.BoxGeometry(0.5 + r() * 0.5, 0.25 + r() * 0.15, 0.08)
    g.translate((r() - 0.5) * (w - 0.6), y0 + 0.3 + r() * (h - 0.6), 0)
    g.rotateY(rotY)
    g.translate(x, 0, z)
    c.set(STONE).offsetHSL(0, 0, (r() - 0.5) * 0.12)
    const n = g.attributes.position.count
    g.setAttribute('color', new THREE.Float32BufferAttribute(Array.from({ length: n }, () => [c.r, c.g, c.b]).flat(), 3))
    g.deleteAttribute('uv')
    geos.push(g.toNonIndexed())
  }
  group.add(mesh(mergeGeometries(geos), mat(0xffffff, { vertexColors: true }), { shadow: false }))
}

// Fenêtre en ogive qui luit.
function gothicWindow(group, x, y, z, rotY = 0, scale = 1) {
  const w = new THREE.Group()
  w.position.set(x, y, z)
  w.rotation.y = rotY
  const glass = mat(0xffd9a0, GLOW)
  w.add(mesh(new THREE.BoxGeometry(0.5 * scale, 0.7 * scale, 0.1), glass, { shadow: false }))
  const top = mesh(new THREE.BoxGeometry(0.36 * scale, 0.36 * scale, 0.1), glass, { y: 0.35 * scale, shadow: false })
  top.rotation.z = Math.PI / 4
  w.add(top)
  w.add(mesh(new THREE.BoxGeometry(0.7 * scale, 0.1, 0.18), mat(STONE_DARK), { y: -0.4 * scale }))
  group.add(w)
}

// Torche murale : support, flamme lumineuse qui vacille.
export function torch(group, x, y, z, animated, { light = false } = {}) {
  group.add(mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.5, 5), mat(0x3a2a20), { x, y, z }))
  const flame = mesh(new THREE.ConeGeometry(0.12, 0.35, 5), mat(0xffc46b, { emissive: 0xff7a1a, emissiveIntensity: 3 }), { x, y: y + 0.38, z, shadow: false })
  group.add(flame)
  let l = null
  if (light) {
    l = new THREE.PointLight(0xff9a40, 5, 8, 1.6)
    l.position.set(x, y + 0.6, z)
    group.add(l)
  }
  animated.push((dt, t) => {
    const k = 1 + Math.sin(t * 13 + x * 3) * 0.12 + Math.sin(t * 7.3 + z) * 0.08
    flame.scale.set(1, k, 1)
    if (l) l.intensity = 5 * k
  })
}

// Tour hexagonale : socle, fût, chemin de ronde crénelé et toit pointu.
function tower(group, x, z, { r = 1.4, h = 8, roof = ROOF, seed = 1 } = {}) {
  const sides = 6
  group.add(mesh(new THREE.CylinderGeometry(r + 0.25, r + 0.35, 1, sides), mat(STONE_DARK), { x, y: 0.5, z }))
  group.add(mesh(new THREE.CylinderGeometry(r, r + 0.12, h, sides), mat(STONE), { x, y: h / 2, z }))
  group.add(mesh(new THREE.CylinderGeometry(r + 0.3, r, 0.5, sides), mat(STONE_DARK), { x, y: h + 0.1, z }))
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * Math.PI * 2 + Math.PI / 6
    const m = mesh(new THREE.BoxGeometry(0.45, 0.55, 0.3), mat(STONE), { x: x + Math.cos(a) * (r + 0.15), y: h + 0.6, z: z + Math.sin(a) * (r + 0.15) })
    m.rotation.y = -a
    group.add(m)
  }
  const cap = mesh(new THREE.ConeGeometry(r + 0.55, h * 0.45, sides), mat(roof), { x, y: h + 0.35 + (h * 0.45) / 2, z })
  group.add(cap)
  group.add(mesh(new THREE.ConeGeometry(0.08, 0.9, 4), mat(0xd9b45a, { metalness: 0.6, roughness: 0.4 }), { x, y: h + 0.35 + h * 0.45 + 0.4, z }))
  // Meurtrières lumineuses.
  const r2 = rand(seed)
  for (let k = 0; k < 2; k++) {
    const a = Math.PI / 2 + (r2() - 0.5) * 1.2
    gothicWindow(group, x + Math.cos(a) * (r + 0.02), 3 + k * 2.6, z + Math.sin(a) * (r + 0.02), -a + Math.PI / 2, 0.6)
  }
}

// Château : donjon, quatre tours, courtines crénelées, porte en ogive, torches et bannières.
export function castle(ctx, x, z) {
  const { group, animated } = ctx
  const castle = new THREE.Group()
  castle.position.set(x, 0, z)
  const W = 9
  const D = 6
  // Courtines entre les tours.
  for (const [wx, wz, len, rot] of [[0, D / 2, W, 0], [0, -D / 2, W, 0], [-W / 2, 0, D, Math.PI / 2], [W / 2, 0, D, Math.PI / 2]]) {
    const wall = new THREE.Group()
    wall.position.set(wx, 0, wz)
    wall.rotation.y = rot
    wall.add(mesh(new THREE.BoxGeometry(len, 4.2, 0.9), mat(STONE), { y: 2.1 }))
    wall.add(mesh(new THREE.BoxGeometry(len, 0.3, 1.2), mat(STONE_DARK), { y: 4.3 }))
    for (let k = -len / 2 + 0.5; k <= len / 2 - 0.4; k += 0.9) wall.add(mesh(new THREE.BoxGeometry(0.5, 0.55, 1.1), mat(STONE), { x: k, y: 4.7 }))
    castle.add(wall)
  }
  stoneBlocks(castle, { w: W - 2, h: 4, z: D / 2 + 0.47, count: 26, seed: 3 })
  // Donjon au centre.
  castle.add(mesh(new THREE.BoxGeometry(5, 8.5, 4), mat(STONE), { y: 4.25, z: -0.5 }))
  castle.add(mesh(new THREE.BoxGeometry(5.4, 0.35, 4.4), mat(STONE_DARK), { y: 8.6, z: -0.5 }))
  const keepRoof = new THREE.ConeGeometry(3.8, 4.2, 4)
  keepRoof.rotateY(Math.PI / 4)
  keepRoof.scale(1, 1, 0.82)
  castle.add(mesh(keepRoof, mat(ROOF), { y: 10.9, z: -0.5 }))
  stoneBlocks(castle, { w: 4.6, h: 8, z: 1.52, count: 22, seed: 7 })
  for (const wx of [-1.4, 1.4]) gothicWindow(castle, wx, 6.2, 1.52, 0, 1)
  gothicWindow(castle, 0, 7.3, 1.52, 0, 0.8)
  // Porte en ogive avec battants en bois.
  castle.add(mesh(new THREE.BoxGeometry(2.4, 3.2, 0.3), mat(STONE_DARK), { y: 1.6, z: D / 2 + 0.5 }))
  const arch = mesh(new THREE.BoxGeometry(1.5, 1.5, 0.3), mat(STONE_DARK), { y: 3.1, z: D / 2 + 0.5 })
  arch.rotation.z = Math.PI / 4
  castle.add(arch)
  castle.add(mesh(new THREE.BoxGeometry(1.7, 2.6, 0.2), mat(0x3a2418), { y: 1.3, z: D / 2 + 0.62 }))
  for (const bx of [-0.4, 0.4]) castle.add(mesh(new THREE.BoxGeometry(0.06, 2.4, 0.05), mat(0x222222), { x: bx, y: 1.3, z: D / 2 + 0.74 }))
  torch(castle, -1.6, 2.4, D / 2 + 0.7, animated, { light: true })
  torch(castle, 1.6, 2.4, D / 2 + 0.7, animated)
  // Bannières violettes sur le donjon.
  for (const bx of [-2.2, 2.2]) {
    castle.add(mesh(new THREE.BoxGeometry(1, 2.6, 0.05), mat(0x6a2d8f), { x: bx, y: 5.2, z: 1.55 }))
    const tip = mesh(new THREE.ConeGeometry(0.5, 0.5, 3), mat(0x6a2d8f), { x: bx, y: 3.7, z: 1.55 })
    tip.rotation.z = Math.PI
    castle.add(tip, mesh(new THREE.OctahedronGeometry(0.22, 0), mat(0xffcf5a, { emissive: 0xffa020, emissiveIntensity: 0.6 }), { x: bx, y: 5.6, z: 1.6 }))
  }
  for (const [tx, tz, i] of [[-W / 2, -D / 2, 1], [W / 2, -D / 2, 2], [-W / 2, D / 2, 3], [W / 2, D / 2, 4]]) tower(castle, tx, tz, { h: tz > 0 ? 7 : 8.5, seed: i })
  // Drapeau au sommet.
  const flag = mesh(new THREE.PlaneGeometry(1.4, 0.8), mat(0xc2185b, { side: THREE.DoubleSide }), { x: 0.75, y: 14.2, z: -0.5 })
  castle.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 2, 5), mat(0x333333), { y: 13.6, z: -0.5 }), flag)
  animated.push((dt, t) => { flag.rotation.y = Math.sin(t * 2) * 0.3 })
  group.add(castle)
  ctx.addFadeable(castle)
  ctx.addCollider(x, z, 4.6)
  for (const [tx, tz] of [[-W / 2, -D / 2], [W / 2, -D / 2], [-W / 2, D / 2], [W / 2, D / 2]]) ctx.addCollider(x + tx, z + tz, 1.6)
  for (const wx of [-2.6, 2.6]) ctx.addCollider(x + wx, z + D / 2, 1)
  return castle
}

// Maison à colombages : soubassement en pierre, murs crépis, poutres, toit pentu, cheminée.
export function cottage(ctx, x, z, { rotY = 0, wall = 0xd9cbe8, roof = 0x5a2f6e, w = 3.6, d = 3, h = 2.6, chimney = true } = {}) {
  const { group, animated } = ctx
  const house = new THREE.Group()
  house.position.set(x, 0, z)
  house.rotation.y = rotY
  house.add(mesh(new THREE.BoxGeometry(w + 0.2, 0.6, d + 0.2), mat(STONE_DARK), { y: 0.3 }))
  house.add(mesh(new THREE.BoxGeometry(w, h, d), mat(wall), { y: 0.6 + h / 2 }))
  const beam = mat(WOOD)
  // Colombages : poteaux d'angle, sablière et croix de Saint-André en façade.
  for (const bx of [-w / 2, 0, w / 2]) house.add(mesh(new THREE.BoxGeometry(0.16, h, 0.16), beam, { x: bx, y: 0.6 + h / 2, z: d / 2 + 0.02 }))
  house.add(mesh(new THREE.BoxGeometry(w + 0.1, 0.16, 0.16), beam, { y: 0.6 + h, z: d / 2 + 0.02 }))
  house.add(mesh(new THREE.BoxGeometry(w + 0.1, 0.14, 0.16), beam, { y: 0.6 + h * 0.5, z: d / 2 + 0.02 }))
  for (const side of [-1, 1]) {
    const brace = mesh(new THREE.BoxGeometry(0.12, Math.hypot(w / 2, h / 2), 0.1), beam, { x: side * w * 0.25, y: 0.6 + h * 0.75, z: d / 2 + 0.03 })
    brace.rotation.z = side * Math.atan2(w / 2, h / 2)
    house.add(brace)
  }
  // Pignons et toit en deux pans qui débordent.
  const gable = new THREE.Shape([new THREE.Vector2(-w / 2, 0), new THREE.Vector2(w / 2, 0), new THREE.Vector2(0, h * 0.75)])
  for (const gz of [-d / 2, d / 2]) {
    const g = mesh(new THREE.ShapeGeometry(gable), mat(wall, { side: THREE.DoubleSide }), { y: 0.6 + h, z: gz })
    house.add(g)
  }
  const slope = Math.hypot(w / 2 + 0.35, h * 0.75 + 0.2)
  for (const side of [-1, 1]) {
    const pan = mesh(new THREE.BoxGeometry(slope, 0.18, d + 0.7), mat(roof), { x: side * (w / 4 + 0.05), y: 0.6 + h + h * 0.375, z: 0 })
    pan.rotation.z = -side * Math.atan2(h * 0.75, w / 2)
    house.add(pan)
  }
  house.add(mesh(new THREE.BoxGeometry(0.2, 0.2, d + 0.8), beam, { y: 0.6 + h + h * 0.75 + 0.05 }))
  if (chimney) {
    house.add(mesh(new THREE.BoxGeometry(0.55, 1.8, 0.55), mat(STONE_DARK), { x: w * 0.25, y: 0.6 + h + 1.1, z: -d * 0.2 }))
    house.add(mesh(new THREE.BoxGeometry(0.7, 0.15, 0.7), mat(STONE), { x: w * 0.25, y: 0.6 + h + 2.05, z: -d * 0.2 }))
  }
  // Porte, fenêtres lumineuses, lanterne.
  house.add(mesh(new THREE.BoxGeometry(0.8, 1.5, 0.1), mat(0x4a2a1a), { x: -w * 0.22, y: 1.35, z: d / 2 + 0.05 }))
  for (const [wx, wy] of [[w * 0.27, 1.7], [-w * 0.22, 0.6 + h * 0.78], [w * 0.27, 0.6 + h * 0.78]]) {
    house.add(mesh(new THREE.BoxGeometry(0.6, 0.55, 0.08), mat(0xffd9a0, GLOW), { x: wx, y: wy, z: d / 2 + 0.05, shadow: false }))
    house.add(mesh(new THREE.BoxGeometry(0.72, 0.08, 0.14), beam, { x: wx, y: wy - 0.32, z: d / 2 + 0.06 }))
  }
  torch(house, -w * 0.22 + 0.7, 2.1, d / 2 + 0.15, animated)
  group.add(house)
  ctx.addCollider(x, z, Math.max(w, d) * 0.62)
  ctx.addFadeable(house)
  return house
}

// Forge ouverte : auvent sur poteaux, four qui rougeoie, enclume et meule.
export function forge(ctx, x, z, { rotY = 0 } = {}) {
  const { group, animated } = ctx
  const f = new THREE.Group()
  f.position.set(x, 0, z)
  f.rotation.y = rotY
  for (const [px, pz] of [[-1.6, -1.2], [1.6, -1.2], [-1.6, 1.2], [1.6, 1.2]]) f.add(mesh(new THREE.BoxGeometry(0.22, 2.6, 0.22), mat(WOOD), { x: px, y: 1.3, z: pz }))
  for (const side of [-1, 1]) {
    const pan = mesh(new THREE.BoxGeometry(2.2, 0.15, 3.4), mat(ROOF), { x: side * 1.0, y: 3.0, z: 0 })
    pan.rotation.z = -side * 0.5
    f.add(pan)
  }
  // Four en pierre avec gueule incandescente.
  f.add(mesh(new THREE.CylinderGeometry(0.8, 1, 1.6, 6), mat(STONE_DARK), { x: -0.6, y: 0.8, z: -0.6 }))
  f.add(mesh(new THREE.CylinderGeometry(0.25, 0.35, 2.2, 6), mat(STONE_DARK), { x: -0.6, y: 2.6, z: -0.6 }))
  const mouth = mesh(new THREE.BoxGeometry(0.7, 0.5, 0.2), mat(0xffb060, { emissive: 0xff5a10, emissiveIntensity: 3 }), { x: -0.6, y: 0.7, z: 0.3, shadow: false })
  f.add(mouth)
  const glow = new THREE.PointLight(0xff7a2a, 6, 7, 1.6)
  glow.position.set(-0.6, 1, 0.8)
  f.add(glow)
  animated.push((dt, t) => { glow.intensity = 5 + Math.sin(t * 9) * 0.8 + Math.sin(t * 3.7) * 0.6 })
  // Enclume.
  f.add(mesh(new THREE.BoxGeometry(0.35, 0.5, 0.35), mat(0x3b3b46), { x: 0.9, y: 0.25, z: 0.5 }))
  f.add(mesh(new THREE.BoxGeometry(0.9, 0.25, 0.4), mat(0x55556a, { metalness: 0.6, roughness: 0.4 }), { x: 0.9, y: 0.62, z: 0.5 }))
  const horn = mesh(new THREE.ConeGeometry(0.15, 0.4, 5), mat(0x55556a, { metalness: 0.6, roughness: 0.4 }), { x: 1.5, y: 0.62, z: 0.5 })
  horn.rotation.z = -Math.PI / 2
  f.add(horn)
  // Épée rougeoyante posée sur l'enclume.
  f.add(mesh(new THREE.BoxGeometry(1.1, 0.04, 0.1), mat(0xffc0a0, { emissive: 0xff4a20, emissiveIntensity: 1.6 }), { x: 0.9, y: 0.77, z: 0.5, shadow: false }))
  // Meule.
  const wheel = mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.15, 10), mat(0x8a8aa0), { x: 1.1, y: 0.7, z: -0.7 })
  wheel.rotation.x = Math.PI / 2
  f.add(wheel, mesh(new THREE.BoxGeometry(0.1, 0.7, 0.4), mat(WOOD), { x: 1.1, y: 0.35, z: -0.7 }))
  animated.push((dt) => { wheel.rotation.y += dt * 2 })
  group.add(f)
  ctx.addCollider(x, z, 1.9)
  return f
}
