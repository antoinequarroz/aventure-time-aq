import * as THREE from 'three'
import { mat, mesh } from './helpers.js'
import { character } from './characters.js'
import { animate } from './models.js'

// Pierre sculptée, dans le même style que la place des réseaux : pierre lavande,
// socles octogonaux en deux paliers, statues de héros figées, piliers à runes lumineuses.

export const STONE = mat(0x8f88c8, { roughness: 0.85 })
export const DARK_STONE = mat(0x6a6398, { roughness: 0.9 })
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
  g.add(mesh(new THREE.CylinderGeometry(r * 1.25, r * 1.35, 0.35, 8), DARK_STONE, { y: y + 0.17 }))
  g.add(mesh(new THREE.CylinderGeometry(r * 0.9, r, 0.6, 8), STONE, { y: y + 0.65 }))
  return y + 0.95
}

// Statue d'un personnage KayKit figée dans une pose, taillée dans la pierre.
export function statue(ctx, x, z, { key = 'knight', anim = 'Idle', time = 0.4, keep = [], height = 2.6, rotY = 0, r = 1 } = {}) {
  const g = at(ctx, x, z, rotY)
  const top = pedestal(g, r)
  const body = character(key, { height, keep })
  const { mixer } = animate(body, anim)
  mixer.update(time)
  body.traverse((o) => {
    if (o.isMesh) {
      o.material = STONE
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
  g.add(mesh(new THREE.BoxGeometry(1.2, 0.3, 1.2), DARK_STONE, { y: 0.15 }))
  g.add(mesh(new THREE.CylinderGeometry(0.5, 0.55, 0.25, 12), STONE, { y: 0.42 }))
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
  const s = mesh(shaft, STONE, { y: 0.55 + shaftH / 2 })
  g.add(s)
  if (broken) {
    s.rotation.z = 0.04
    for (const [dx, dz, sz] of [[0.9, 0.5, 0.45], [-0.7, 0.9, 0.3], [1.3, -0.4, 0.25]]) {
      const chunk = mesh(new THREE.DodecahedronGeometry(sz, 0), STONE, { x: dx, y: sz * 0.7, z: dz })
      chunk.rotation.set(dx, dz, 0)
      g.add(chunk)
    }
  } else {
    g.add(mesh(new THREE.CylinderGeometry(0.58, 0.44, 0.3, 12), STONE, { y: 0.55 + shaftH + 0.15 }))
    g.add(mesh(new THREE.BoxGeometry(1.3, 0.25, 1.3), DARK_STONE, { y: 0.55 + shaftH + 0.42 }))
  }
  ctx.addCollider(x, z, 0.7, broken ? 2.5 : h + 1)
  return g
}

// Grande arche en plein cintre, clé de voûte ornée d'un losange lumineux.
export function grandArch(ctx, x, z, { rotY = 0, width = 4.4, h = 3.6, color = 0x7df9ff } = {}) {
  const g = at(ctx, x, z, rotY)
  const half = width / 2
  for (const s of [-1, 1]) {
    g.add(mesh(new THREE.BoxGeometry(1.1, 0.4, 1.1), DARK_STONE, { x: s * half, y: 0.2 }))
    g.add(mesh(new THREE.BoxGeometry(0.8, h, 0.8), STONE, { x: s * half, y: 0.4 + h / 2 }))
    g.add(mesh(new THREE.BoxGeometry(1, 0.25, 1), DARK_STONE, { x: s * half, y: 0.4 + h + 0.12 }))
  }
  const ring = mesh(new THREE.TorusGeometry(half, 0.42, 6, 18, Math.PI), STONE, { y: 0.4 + h + 0.25 })
  ring.scale.z = 1.6
  g.add(ring)
  g.add(mesh(new THREE.BoxGeometry(0.7, 0.8, 0.9), DARK_STONE, { y: 0.4 + h + half + 0.2 }))
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
export function runePillar(ctx, x, z, { color = 0x9b6bff, h = 1.8, rotY = 0 } = {}) {
  const g = at(ctx, x, z, rotY)
  g.add(mesh(new THREE.BoxGeometry(0.9, 0.25, 0.9), DARK_STONE, { y: 0.12 }))
  const ob = new THREE.CylinderGeometry(0.22, 0.34, h, 4)
  ob.rotateY(Math.PI / 4)
  g.add(mesh(ob, STONE, { y: 0.25 + h / 2 }))
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
export function lanternPost(ctx, x, z, { color = 0xffb347, h = 2.2 } = {}) {
  const g = at(ctx, x, z)
  g.add(mesh(new THREE.BoxGeometry(0.34, 0.25, 0.34), DARK_STONE, { y: 0.12 }))
  g.add(mesh(new THREE.CylinderGeometry(0.07, 0.09, h, 6), mat(0x2b2440), { y: h / 2 + 0.1 }))
  g.add(mesh(new THREE.BoxGeometry(0.42, 0.5, 0.42), mat(0x2b2440), { y: h + 0.35 }))
  g.add(mesh(new THREE.BoxGeometry(0.32, 0.4, 0.44), mat(0xffd27a, { emissive: color, emissiveIntensity: 2.6 }), { y: h + 0.35, shadow: false }))
  g.add(mesh(new THREE.ConeGeometry(0.36, 0.3, 4).rotateY(Math.PI / 4), mat(0x2b2440), { y: h + 0.75 }))
  ctx.addCollider(x, z, 0.3, 3)
  return g
}

// Feuilles mortes violettes éparpillées autour d'un point.
export function leaves(ctx, x, z, { count = 120, r = 5, inner = 0 } = {}) {
  const inst = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.16, 0.12).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x5a3f73, roughness: 1 }), count)
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
