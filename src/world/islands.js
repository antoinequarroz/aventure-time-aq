import * as THREE from 'three'
import { islands as content } from '../content.js'
import { jitter, mat, mesh, makeCharacter, textTexture } from './helpers.js'

export const ISLAND_RADIUS = 22
const SPACING = 75

// Ordre : passé (gauche), présent (centre), futur (droite).
export const THEMES = {
  past: { center: new THREE.Vector3(-SPACING, 0, 0), top: 0x5f9e3c, rock: 0x6b5a48, accent: 0xffb347, signBg: '#3b2a1a', signFg: '#fbe9c8' },
  present: { center: new THREE.Vector3(0, 0, 0), top: 0x7bbf4f, rock: 0x7a6a58, accent: 0x6fd3ff, signBg: '#1f3b57', signFg: '#e8f6ff' },
  future: { center: new THREE.Vector3(SPACING, 0, 0), top: 0xb9bcc6, rock: 0x55586a, accent: 0xb48cff, signBg: '#1a1530', signFg: '#d9ccff' },
}

export function createIslands(scene) {
  const colliders = []
  const interactables = []
  const animated = []
  const islandsInfo = []

  for (const island of content) {
    const theme = THEMES[island.id]
    const group = new THREE.Group()
    group.position.copy(theme.center)
    scene.add(group)

    const addCollider = (x, z, r) => colliders.push({ x: theme.center.x + x, z: theme.center.z + z, r })
    const ctx = { group, theme, addCollider, animated }

    buildBase(ctx, island.id)
    if (island.id === 'past') buildPast(ctx)
    if (island.id === 'present') buildPresent(ctx)
    if (island.id === 'future') buildFuture(ctx)

    for (const sign of island.signs) {
      buildSign(ctx, sign)
      interactables.push({
        type: 'sign',
        x: theme.center.x + sign.pos[0],
        z: theme.center.z + sign.pos[1],
        r: 3,
        title: sign.title,
        text: sign.text,
        links: sign.links,
      })
    }

    islandsInfo.push({ id: island.id, name: island.name, tagline: island.tagline, center: theme.center })
  }

  return {
    colliders,
    interactables,
    islands: islandsInfo,
    spawn: new THREE.Vector3(THEMES.past.center.x, 0, 4),
    update(dt, t) {
      for (const fn of animated) fn(dt, t)
    },
  }
}

function buildBase({ group, theme }, id) {
  const top = jitter(new THREE.CylinderGeometry(ISLAND_RADIUS, ISLAND_RADIUS - 1, 2, 28, 1), 0.25, id.length * 7)
  const topMesh = mesh(top, mat(theme.top), { y: -1 })
  topMesh.castShadow = false
  const rock = jitter(new THREE.ConeGeometry(ISLAND_RADIUS - 1, 20, 14, 3), 1.6, id.length * 13)
  rock.rotateX(Math.PI)
  const rockMesh = mesh(rock, mat(theme.rock), { y: -12 })
  group.add(topMesh, rockMesh)

  // Petits rochers flottants autour de l'île.
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + id.length
    const g = jitter(new THREE.IcosahedronGeometry(1 + (i % 3) * 0.6, 0), 0.3, i + 3)
    const r = mesh(g, mat(theme.rock), { x: Math.cos(a) * (ISLAND_RADIUS + 6), y: -4 - (i % 3) * 3, z: Math.sin(a) * (ISLAND_RADIUS + 6) })
    group.add(r)
  }
}

function buildSign({ group, theme }, sign) {
  const [x, z] = sign.pos
  const wood = mat(0x7a5230)
  const post = mesh(new THREE.BoxGeometry(0.2, 2.2, 0.2), wood, { x, y: 1.1, z })
  const boardMat = new THREE.MeshStandardMaterial({ map: textTexture(sign.title, { bg: theme.signBg, fg: theme.signFg }) })
  const board = mesh(new THREE.BoxGeometry(2.8, 0.75, 0.12), [wood, wood, wood, wood, boardMat, boardMat], { x, y: 2.3, z })
  const ring = mesh(
    new THREE.RingGeometry(1.3, 1.6, 32),
    new THREE.MeshBasicMaterial({ color: theme.accent, transparent: true, opacity: 0.55, side: THREE.DoubleSide }),
    { x, y: 0.03, z, shadow: false },
  )
  ring.rotation.x = -Math.PI / 2
  group.add(post, board, ring)
}

// Arbre low-poly (sapin ou feuillu).
function tree(group, x, z, { pine = false, leaves = 0x3f7d2a, scale = 1 } = {}) {
  const trunk = mesh(new THREE.CylinderGeometry(0.2 * scale, 0.3 * scale, 1.4 * scale, 6), mat(0x6b4426), { x, y: 0.7 * scale, z })
  const crown = pine
    ? mesh(new THREE.ConeGeometry(1.2 * scale, 3 * scale, 7), mat(leaves), { x, y: 2.8 * scale, z })
    : mesh(jitter(new THREE.IcosahedronGeometry(1.3 * scale, 0), 0.3, Math.round(x * 10 + z)), mat(leaves), { x, y: 2.3 * scale, z })
  group.add(trunk, crown)
}

function buildPast({ group, addCollider, animated }) {
  const stone = mat(0x9a948a)
  const roof = mat(0x2f4e8c)

  // Château.
  const castle = new THREE.Group()
  castle.position.set(0, 0, -14)
  const keep = mesh(new THREE.BoxGeometry(6, 7, 5), stone, { y: 3.5 })
  castle.add(keep, mesh(new THREE.ConeGeometry(4.3, 3.5, 4), roof, { y: 8.75 }))
  for (const [tx, tz] of [[-4.5, -3], [4.5, -3], [-4.5, 3], [4.5, 3]]) {
    castle.add(mesh(new THREE.CylinderGeometry(1.2, 1.3, 8, 10), stone, { x: tx, y: 4, z: tz }))
    castle.add(mesh(new THREE.ConeGeometry(1.6, 2.5, 10), roof, { x: tx, y: 9.25, z: tz }))
  }
  castle.add(mesh(new THREE.BoxGeometry(1.8, 2.6, 0.3), mat(0x4a2e18), { y: 1.3, z: 2.6 }))
  const flag = mesh(new THREE.PlaneGeometry(1.4, 0.8), mat(0xc0392b, { side: THREE.DoubleSide }), { x: 0.75, y: 11.6, z: 0 })
  castle.add(mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.5, 5), mat(0x333333), { y: 11.3 }), flag)
  animated.push((dt, t) => { flag.rotation.y = Math.sin(t * 2) * 0.3 })
  group.add(castle)
  addCollider(0, -14, 5.5)
  for (const [tx, tz] of [[-4.5, -3], [4.5, -3], [-4.5, 3], [4.5, 3]]) addCollider(tx, -14 + tz, 1.4)

  // Montagne enneigée (ski).
  const mountain = mesh(jitter(new THREE.ConeGeometry(5, 9, 7, 2), 0.4, 5), mat(0x8c8c96), { x: 16, y: 4.5, z: -12 })
  const snow = mesh(new THREE.ConeGeometry(2.3, 3.2, 7), mat(0xffffff), { x: 16, y: 7.4, z: -12 })
  group.add(mountain, snow)
  addCollider(16, -12, 4.6)
  for (const [px, pz] of [[11, -16], [20, -7], [12, -9]]) tree(group, px, pz, { pine: true, leaves: 0x2d5a3a, scale: 0.8 })

  // But de foot.
  const white = mat(0xffffff)
  const goal = new THREE.Group()
  goal.position.set(-15, 0, 10)
  goal.add(mesh(new THREE.BoxGeometry(0.15, 2, 0.15), white, { x: -1.8, y: 1 }))
  goal.add(mesh(new THREE.BoxGeometry(0.15, 2, 0.15), white, { x: 1.8, y: 1 }))
  goal.add(mesh(new THREE.BoxGeometry(3.75, 0.15, 0.15), white, { y: 2 }))
  goal.rotation.y = Math.PI / 4
  const ball = mesh(new THREE.IcosahedronGeometry(0.3, 1), mat(0xf5f5f5), { x: -12, y: 0.3, z: 8 })
  group.add(goal, ball)

  // Totem « pierre de foyer » façon WoW : cristal flottant.
  const crystal = mesh(new THREE.OctahedronGeometry(0.8, 0), mat(0x58d0ff, { emissive: 0x2a8fd0, emissiveIntensity: 0.9 }), { x: -13, y: 2.2, z: -9 })
  const pedestal = mesh(new THREE.CylinderGeometry(0.8, 1, 0.8, 8), stone, { x: -13, y: 0.4, z: -9 })
  group.add(crystal, pedestal)
  addCollider(-13, -9, 1)
  animated.push((dt, t) => {
    crystal.rotation.y += dt
    crystal.position.y = 2.2 + Math.sin(t * 2) * 0.25
  })

  for (const [px, pz] of [[-18, -3], [-9, -17], [-18, 3], [-6, 14], [3, 17], [-12, 16], [12, 14], [16, 7], [-3, 12]]) {
    tree(group, px, pz, { leaves: 0x3f7d2a })
    addCollider(px, pz, 0.6)
  }
}

function buildPresent({ group, addCollider, animated }) {
  // Place pavée.
  const plaza = mesh(new THREE.CylinderGeometry(7, 7, 0.1, 24), mat(0xb8b0a2), { y: 0.05, shadow: false })
  group.add(plaza)

  const house = (x, z, color, rot = 0) => {
    const h = new THREE.Group()
    h.position.set(x, 0, z)
    h.rotation.y = rot
    h.add(mesh(new THREE.BoxGeometry(4, 3, 4), mat(color), { y: 1.5 }))
    const roofGeo = new THREE.ConeGeometry(3.3, 2, 4)
    roofGeo.rotateY(Math.PI / 4)
    h.add(mesh(roofGeo, mat(0xa0402f), { y: 4 }))
    h.add(mesh(new THREE.BoxGeometry(1, 1.8, 0.1), mat(0x5a3a22), { y: 0.9, z: 2.01 }))
    h.add(mesh(new THREE.BoxGeometry(0.9, 0.9, 0.1), mat(0xfff2a8, { emissive: 0xffd76a, emissiveIntensity: 0.6 }), { x: 1.1, y: 1.9, z: 2.01 }))
    group.add(h)
    addCollider(x, z, 2.8)
  }
  house(-14, -10, 0xe8d8b8, Math.PI / 6)
  house(14, -10, 0xd8e2f0, -Math.PI / 6)
  house(-15, 12, 0xf0d0c0, Math.PI - 0.4)
  house(15, 12, 0xd5ecd2, Math.PI + 0.4)

  // Le développeur à son bureau, sur la place.
  const desk = mesh(new THREE.BoxGeometry(2.2, 0.15, 1.1), mat(0x8a5a32), { x: 0, y: 1, z: -13 })
  const legs = [[-1, -0.45], [1, -0.45], [-1, 0.45], [1, 0.45]].map(([dx, dz]) => mesh(new THREE.BoxGeometry(0.1, 1, 0.1), mat(0x5a3a22), { x: dx, y: 0.5, z: -13 + dz }))
  const screen = mesh(new THREE.BoxGeometry(1.2, 0.75, 0.06), mat(0x111111), { x: 0, y: 1.55, z: -13.3 })
  const glow = mesh(new THREE.PlaneGeometry(1.1, 0.65), new THREE.MeshBasicMaterial({ color: 0x5fd0ff }), { x: 0, y: 1.55, z: -13.26, shadow: false })
  const dev = makeCharacter({ body: 0x2e2e2e, legs: 0x3a4a6a })
  dev.position.set(0, 0, -12)
  dev.rotation.y = Math.PI
  group.add(desk, ...legs, screen, glow, dev)
  addCollider(0, -12.8, 1.6)
  animated.push((dt, t) => {
    glow.material.color.setHSL(0.55, 0.8, 0.55 + Math.sin(t * 4) * 0.08)
    dev.userData.limbs.armL.rotation.x = -1 + Math.sin(t * 12) * 0.15
    dev.userData.limbs.armR.rotation.x = -1 + Math.cos(t * 12) * 0.15
  })

  // Lampadaires.
  for (const [lx, lz] of [[-6, -6], [6, -6], [-6, 6], [6, 6]]) {
    group.add(mesh(new THREE.CylinderGeometry(0.08, 0.1, 3.2, 6), mat(0x333333), { x: lx, y: 1.6, z: lz }))
    group.add(mesh(new THREE.SphereGeometry(0.3, 10, 8), mat(0xfff0b0, { emissive: 0xffd76a, emissiveIntensity: 1.2 }), { x: lx, y: 3.3, z: lz, shadow: false }))
    addCollider(lx, lz, 0.3)
  }

  for (const [px, pz] of [[-18, -8], [19, 5], [-5, -18], [6, -18], [-6, 18], [7, 18], [19, -4], [-19, 5]]) {
    tree(group, px, pz, { leaves: 0x4c9a35 })
    addCollider(px, pz, 0.6)
  }
}

function buildFuture({ group, addCollider, animated }) {
  // Cratères.
  for (const [cx, cz, r] of [[-12, 6, 2.5], [6, 4, 1.6], [13, 13, 2], [-4, -15, 1.8], [-15, -12, 1.4]]) {
    const crater = mesh(new THREE.TorusGeometry(r, 0.35, 6, 18), mat(0x9a9ca6), { x: cx, y: 0, z: cz, shadow: false })
    crater.rotation.x = Math.PI / 2
    const floor = mesh(new THREE.CircleGeometry(r, 18), mat(0x8a8c96), { x: cx, y: 0.02, z: cz, shadow: false })
    floor.rotation.x = -Math.PI / 2
    group.add(crater, floor)
  }

  // Base lunaire.
  const dome = mesh(new THREE.SphereGeometry(4, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xdfe6f0, { metalness: 0.3, roughness: 0.4 }), { x: 0, y: 0, z: -14 })
  const tube = mesh(new THREE.CylinderGeometry(1, 1, 6, 12), mat(0xcfd6e0), { x: 6, y: 1, z: -14 })
  tube.rotation.z = Math.PI / 2
  const module = mesh(new THREE.CylinderGeometry(2, 2, 3, 12), mat(0xcfd6e0), { x: 10, y: 1.5, z: -14 })
  group.add(dome, tube, module)
  addCollider(0, -14, 4.2)
  addCollider(6, -14, 1.2)
  addCollider(10, -14, 2.2)

  // Antenne parabolique.
  const dish = mesh(new THREE.SphereGeometry(1.4, 16, 8, 0, Math.PI * 2, 0, Math.PI / 3), mat(0xffffff, { side: THREE.DoubleSide }), { x: -8, y: 3.4, z: -14 })
  dish.rotation.x = -0.9
  group.add(mesh(new THREE.CylinderGeometry(0.12, 0.12, 3, 6), mat(0x888888), { x: -8, y: 1.5, z: -14 }), dish)
  addCollider(-8, -14, 0.6)
  animated.push((dt) => { dish.rotation.z += dt * 0.3 })

  // Télescope (astronomie).
  const tripod = mesh(new THREE.ConeGeometry(0.6, 1.4, 3), mat(0x444444), { x: -13, y: 0.7, z: -4 })
  const tube2 = mesh(new THREE.CylinderGeometry(0.22, 0.3, 2, 10), mat(0xeeeeee), { x: -13, y: 1.8, z: -4 })
  tube2.rotation.z = 0.8
  group.add(tripod, tube2)
  addCollider(-13, -4, 0.7)

  // Cosmonaute.
  const astronaut = makeCharacter({ body: 0xf4f4f4, legs: 0xdadada, skin: 0xf1c27d, helmet: 0xa8d8ff })
  astronaut.position.set(-4, 0, 3)
  group.add(astronaut)
  addCollider(-4, 3, 0.8)
  animated.push((dt, t) => {
    astronaut.position.y = Math.abs(Math.sin(t * 1.3)) * 0.6
    astronaut.rotation.y = t * 0.4
    astronaut.userData.limbs.armR.rotation.z = 2.6 + Math.sin(t * 5) * 0.4
  })

  // Drapeau planté.
  group.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.5, 5), mat(0xcccccc), { x: 4, y: 1.25, z: 13 }))
  group.add(mesh(new THREE.PlaneGeometry(1.2, 0.7), mat(0x2f6fd8, { side: THREE.DoubleSide }), { x: 4.6, y: 2.2, z: 13 }))
}
