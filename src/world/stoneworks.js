import * as THREE from 'three'
import { mat, mesh } from './helpers.js'
import { character, spaceSuit } from './characters.js'
import { animate } from './models.js'
import * as P from './props.js'

// Pierre sculptée, dans le même style que la place des réseaux : socles octogonaux
// en deux paliers, statues de héros figées, piliers à runes lumineuses, lanternes.
// Chaque époque a sa pierre : lavande (Passé), grès chaud (Présent), marbre blanc néon (Futur).

const THEMES = {
  past: { stone: 0x8f88c8, dark: 0x6a6398, metal: 0x2b2440, lamp: 0xffb347, runes: [0x9b6bff, 0x58d0ff, 0xff7ad9], leaf: 0x5a3f73 },
  present: { stone: 0xe6cfa8, dark: 0xb48a62, metal: 0x3a2c26, lamp: 0xffc46b, runes: [0xffa040, 0xff6f61, 0x6fd3ff], leaf: 0xc8692e },
  future: { stone: 0xe4e8f4, dark: 0x8d95b3, metal: 0x2a2f45, lamp: 0x7df9ff, runes: [0x3fe8ff, 0xff5fd0, 0xb48cff], leaf: 0x7f78e0 },
}
const built = {}
function makeTheme(name) {
  const t = THEMES[name]
  return built[name] ??= {
    ...t,
    stoneMat: mat(t.stone, { roughness: 0.85 }),
    darkMat: mat(t.dark, { roughness: 0.9 }),
    metalMat: mat(t.metal),
  }
}
let T = makeTheme('past')
// Choisit la pierre de l'époque pour tout ce qui suit.
export function useTheme(name) {
  T = makeTheme(name)
  return T
}
export const theme = () => T
const stone = () => T.stoneMat
const dark = () => T.darkMat
const runeMat = (color) => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.8, flatShading: true })

// Groupe posé à (x, z) sur l'île, tourné de rotY.
function at(ctx, x, z, rotY = 0) {
  const g = new THREE.Group()
  g.position.set(x, 0, z)
  g.rotation.y = rotY
  ctx.group.add(g)
  return g
}

// Socle octogonal à deux paliers.
export function pedestal(g, r = 1, y = 0) {
  g.add(mesh(new THREE.CylinderGeometry(r * 1.25, r * 1.35, 0.35, 8), dark(), { y: y + 0.17 }))
  g.add(mesh(new THREE.CylinderGeometry(r * 0.9, r, 0.6, 8), stone(), { y: y + 0.65 }))
  return y + 0.95
}

// Statue d'un personnage KayKit figée dans une pose, taillée dans la pierre.
export function statue(ctx, x, z, { key = 'knight', anim = 'Idle', time = 0.4, keep = [], height = 2.6, rotY = 0, r = 1, suit = false } = {}) {
  const g = at(ctx, x, z, rotY)
  const top = pedestal(g, r)
  const body = character(key, { height, keep })
  const { mixer } = animate(body, anim)
  mixer.update(time)
  // Cosmonaute : le casque de verre reste transparent, le reste devient pierre.
  if (suit) spaceSuit(body)
  body.traverse((o) => {
    if (o.isMesh && !o.material.transparent) {
      o.material = stone()
      o.castShadow = true
    }
  })
  body.position.y = top
  g.add(body)
  ctx.addCollider(x, z, r * 1.3, 4)
  return g
}

// Colonne cannelée avec base et chapiteau ; `broken` la coupe en biais avec des débris.
export function column(ctx, x, z, { h = 3.6, broken = false, rotY = 0 } = {}) {
  const g = at(ctx, x, z, rotY)
  g.add(mesh(new THREE.BoxGeometry(1.2, 0.3, 1.2), dark(), { y: 0.15 }))
  g.add(mesh(new THREE.CylinderGeometry(0.5, 0.55, 0.25, 12), stone(), { y: 0.42 }))
  const shaftH = broken ? h * 0.55 : h
  const shaft = new THREE.CylinderGeometry(0.4, 0.44, shaftH, 12, 1)
  // Cannelures : on creuse un sommet sur deux.
  const p = shaft.attributes.position
  for (let i = 0; i < p.count; i++) {
    const a = Math.atan2(p.getZ(i), p.getX(i))
    const k = Math.round(((a + Math.PI) / (Math.PI * 2)) * 12) % 2 ? 0.9 : 1
    if (Math.abs(p.getY(i)) < shaftH / 2 + 0.01) {
      p.setX(i, p.getX(i) * k)
      p.setZ(i, p.getZ(i) * k)
    }
  }
  shaft.computeVertexNormals()
  const s = mesh(shaft, stone(), { y: 0.55 + shaftH / 2 })
  g.add(s)
  if (broken) {
    s.rotation.z = 0.04
    for (const [dx, dz, sz] of [[0.9, 0.5, 0.45], [-0.7, 0.9, 0.3], [1.3, -0.4, 0.25]]) {
      const chunk = mesh(new THREE.DodecahedronGeometry(sz, 0), stone(), { x: dx, y: sz * 0.7, z: dz })
      chunk.rotation.set(dx, dz, 0)
      g.add(chunk)
    }
  } else {
    g.add(mesh(new THREE.CylinderGeometry(0.58, 0.44, 0.3, 12), stone(), { y: 0.55 + shaftH + 0.15 }))
    g.add(mesh(new THREE.BoxGeometry(1.3, 0.25, 1.3), dark(), { y: 0.55 + shaftH + 0.42 }))
  }
  ctx.addCollider(x, z, 0.7, broken ? 2.5 : h + 1)
  return g
}

// Grande arche en plein cintre, clé de voûte ornée d'un losange lumineux.
export function grandArch(ctx, x, z, { rotY = 0, width = 4.4, h = 3.6, color = 0x7df9ff } = {}) {
  const g = at(ctx, x, z, rotY)
  const half = width / 2
  for (const s of [-1, 1]) {
    g.add(mesh(new THREE.BoxGeometry(1.1, 0.4, 1.1), dark(), { x: s * half, y: 0.2 }))
    g.add(mesh(new THREE.BoxGeometry(0.8, h, 0.8), stone(), { x: s * half, y: 0.4 + h / 2 }))
    g.add(mesh(new THREE.BoxGeometry(1, 0.25, 1), dark(), { x: s * half, y: 0.4 + h + 0.12 }))
  }
  const ring = mesh(new THREE.TorusGeometry(half, 0.42, 6, 18, Math.PI), stone(), { y: 0.4 + h + 0.25 })
  ring.scale.z = 1.6
  g.add(ring)
  g.add(mesh(new THREE.BoxGeometry(0.7, 0.8, 0.9), dark(), { y: 0.4 + h + half + 0.2 }))
  const gem = mesh(new THREE.OctahedronGeometry(0.28), runeMat(color), { y: 0.4 + h + half + 0.25, z: 0.5, shadow: false })
  gem.scale.set(1, 1.3, 0.4)
  g.add(gem)
  const c = Math.cos(rotY)
  const sn = Math.sin(rotY)
  ctx.addCollider(x - half * c, z + half * sn, 0.65, h + 1)
  ctx.addCollider(x + half * c, z - half * sn, 0.65, h + 1)
  ctx.animated.push((dt, t) => { gem.material.emissiveIntensity = 1.4 + Math.sin(t * 2) * 0.6 })
  return g
}

// Pilier à rune : obélisque taillé surmonté d'un cristal qui flotte et tourne.
export function runePillar(ctx, x, z, { color = T.runes[0], h = 1.8, rotY = 0 } = {}) {
  const g = at(ctx, x, z, rotY)
  g.add(mesh(new THREE.BoxGeometry(0.9, 0.25, 0.9), dark(), { y: 0.12 }))
  const ob = new THREE.CylinderGeometry(0.22, 0.34, h, 4)
  ob.rotateY(Math.PI / 4)
  g.add(mesh(ob, stone(), { y: 0.25 + h / 2 }))
  // Rune gravée qui luit sur la face avant.
  const rune = mesh(new THREE.PlaneGeometry(0.2, 0.55), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 }), { y: 0.25 + h * 0.55, z: 0.3, shadow: false })
  rune.rotation.x = -0.06
  g.add(rune)
  const crystal = mesh(new THREE.OctahedronGeometry(0.22), runeMat(color), { y: h + 0.75, shadow: false })
  crystal.scale.y = 1.6
  g.add(crystal)
  const phase = x * 1.3 + z
  ctx.animated.push((dt, t) => {
    crystal.rotation.y = t * 1.2 + phase
    crystal.position.y = h + 0.75 + Math.sin(t * 2 + phase) * 0.12
  })
  ctx.addCollider(x, z, 0.5, h + 0.5)
  return g
}

// Lanterne sur poteau, comme sur la place des réseaux.
export function lanternPost(ctx, x, z, { color = T.lamp, h = 2.2 } = {}) {
  const g = at(ctx, x, z)
  g.add(mesh(new THREE.BoxGeometry(0.34, 0.25, 0.34), dark(), { y: 0.12 }))
  g.add(mesh(new THREE.CylinderGeometry(0.07, 0.09, h, 6), T.metalMat, { y: h / 2 + 0.1 }))
  g.add(mesh(new THREE.BoxGeometry(0.42, 0.5, 0.42), T.metalMat, { y: h + 0.35 }))
  g.add(mesh(new THREE.BoxGeometry(0.32, 0.4, 0.44), mat(0xffd27a, { emissive: color, emissiveIntensity: 2.6 }), { y: h + 0.35, shadow: false }))
  g.add(mesh(new THREE.ConeGeometry(0.36, 0.3, 4).rotateY(Math.PI / 4), T.metalMat, { y: h + 0.75 }))
  ctx.addCollider(x, z, 0.3, 3)
  return g
}

// Feuilles mortes violettes éparpillées autour d'un point.
export function leaves(ctx, x, z, { count = 120, r = 5, inner = 0 } = {}) {
  const inst = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.16, 0.12).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: T.leaf, roughness: 1 }), count)
  const m = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const up = new THREE.Vector3(0, 1, 0)
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2
    const d = inner + Math.sqrt(Math.random()) * (r - inner)
    q.setFromAxisAngle(up, Math.random() * Math.PI)
    m.compose(new THREE.Vector3(Math.cos(a) * d, 0.12, Math.sin(a) * d), q, new THREE.Vector3(1, 1, 1).multiplyScalar(0.7 + Math.random()))
    inst.setMatrixAt(i, m)
  }
  inst.receiveShadow = true
  const g = at(ctx, x, z)
  g.add(inst)
  return g
}

// Banc de pierre.
export function stoneBench(ctx, x, z, { rotY = 0 } = {}) {
  const g = at(ctx, x, z, rotY)
  for (const s of [-0.6, 0.6]) g.add(mesh(new THREE.BoxGeometry(0.3, 0.4, 0.5), dark(), { x: s, y: 0.2 }))
  g.add(mesh(new THREE.BoxGeometry(1.7, 0.16, 0.6), stone(), { y: 0.48 }))
  ctx.addCollider(x, z, 0.7, 0.6)
  return g
}

// Sculpture posée sur un socle : `build(g, top)` ajoute la pièce au sommet.
function sculpture(ctx, x, z, { rotY = 0, r = 0.9, spin = 0, bob = 0 }, build) {
  const g = at(ctx, x, z, rotY)
  const top = pedestal(g, r)
  const piece = new THREE.Group()
  piece.position.y = top
  build(piece)
  g.add(piece)
  if (spin || bob) {
    const phase = x + z
    ctx.animated.push((dt, t) => {
      piece.rotation.y += dt * spin
      piece.position.y = top + Math.sin(t * 1.6 + phase) * bob
    })
  }
  ctx.addCollider(x, z, r * 1.3, 4)
  return g
}

// Le symbole du code « </> » taillé dans la pierre, liseré lumineux.
export function codeGlyph(ctx, x, z, { rotY = 0, color = T.runes[0] } = {}) {
  return sculpture(ctx, x, z, { rotY, r: 1.1, bob: 0.08 }, (p) => {
    const glow = runeMat(color)
    glow.emissiveIntensity = 1.2
    const bar = (w, ax, ay, rot) => {
      const b = mesh(new THREE.BoxGeometry(w, 0.26, 0.34), stone(), { x: ax, y: ay })
      b.rotation.z = rot
      const edge = mesh(new THREE.BoxGeometry(w * 0.92, 0.08, 0.36), glow, { shadow: false })
      edge.position.y = 0.0
      b.add(edge)
      p.add(b)
    }
    const y = 1.1
    // Chevrons < et >.
    for (const s of [-1, 1]) {
      bar(0.8, s * 0.95, y + 0.24, -s * 0.62)
      bar(0.8, s * 0.95, y - 0.24, s * 0.62)
    }
    bar(1.6, 0, y, 1.2)
  })
}

// Appareil photo géant en pierre, objectif en verre lumineux.
export function cameraSculpture(ctx, x, z, { rotY = 0 } = {}) {
  return sculpture(ctx, x, z, { rotY, r: 0.9 }, (p) => {
    p.add(mesh(new THREE.BoxGeometry(1.6, 1, 0.8), stone(), { y: 0.6 }))
    p.add(mesh(new THREE.BoxGeometry(0.6, 0.3, 0.6), dark(), { x: -0.2, y: 1.2 }))
    p.add(mesh(new THREE.BoxGeometry(0.3, 0.16, 0.3), dark(), { x: 0.5, y: 1.15 }))
    const lens = mesh(new THREE.CylinderGeometry(0.36, 0.4, 0.5, 18).rotateX(Math.PI / 2), dark(), { y: 0.6, z: 0.6 })
    p.add(lens)
    p.add(mesh(new THREE.CircleGeometry(0.27, 18), runeMat(T.runes[2]), { y: 0.6, z: 0.86, shadow: false }))
    p.add(mesh(new THREE.BoxGeometry(0.22, 0.14, 0.05), mat(0xffffff, { emissive: 0xffffff, emissiveIntensity: 1.5 }), { x: 0.5, y: 0.92, z: 0.41, shadow: false }))
  })
}

// Ballon de foot géant en pierre, qui tourne lentement.
export function ballSculpture(ctx, x, z, { rotY = 0 } = {}) {
  return sculpture(ctx, x, z, { rotY, r: 0.8, spin: 0.4 }, (p) => {
    const ball = mesh(new THREE.IcosahedronGeometry(0.75, 1), stone(), { y: 0.85 })
    p.add(ball)
    const patch = new THREE.IcosahedronGeometry(0.76, 0)
    const wire = new THREE.LineSegments(new THREE.EdgesGeometry(patch), new THREE.LineBasicMaterial({ color: T.dark }))
    wire.position.y = 0.85
    p.add(wire)
  })
}

// Place à monument : une pièce centrale (statue ou sculpture), des piliers à runes en arc
// derrière elle, des lanternes de part et d'autre de l'ouverture, des caisses et des feuilles.
// `open` : direction de l'ouverture (angle dans le plan, 0 = +x, PI/2 = +z vers la caméra).
export function monument(ctx, x, z, { statue: st, piece, r = 3, pillars = 5, spread = 1.3, open = Math.PI / 2, lanterns = true, crates = true, leafCount = 110 } = {}) {
  if (st) statue(ctx, x, z, st)
  if (piece) piece(ctx, x, z)
  for (let i = 0; i < pillars; i++) {
    const k = pillars === 1 ? 0 : i / (pillars - 1) - 0.5
    const a = open + Math.PI + k * 2 * spread
    runePillar(ctx, x + Math.cos(a) * r, z + Math.sin(a) * r, { color: T.runes[i % T.runes.length], rotY: Math.PI / 2 - a + Math.PI })
  }
  if (lanterns) {
    for (const s of [-1, 1]) {
      const a = open + s * 0.75
      lanternPost(ctx, x + Math.cos(a) * (r + 0.3), z + Math.sin(a) * (r + 0.3))
    }
  }
  if (crates) {
    const a = open + 1.35
    P.crate(ctx, x + Math.cos(a) * (r + 0.4), z + Math.sin(a) * (r + 0.4), { size: 0.7, rotY: 0.4 })
    P.crate(ctx, x + Math.cos(a + 0.22) * (r + 0.6), z + Math.sin(a + 0.22) * (r + 0.6), { size: 0.5, rotY: 1.1 })
  }
  if (leafCount) leaves(ctx, x, z, { r: r + 1.2, inner: 1.2, count: leafCount })
}
