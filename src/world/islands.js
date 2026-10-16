import * as THREE from 'three'
import { islands as content } from '../content.js'
import { jitter, mat, mesh, textTexture } from './helpers.js'
import { model } from './models.js'
import * as past from './eras/past.js'
import * as present from './eras/present.js'
import * as future from './eras/future.js'

export const ISLAND_RADIUS = 22
const SPACING = 150
const ERAS = { past, present, future }

// Ordre : passé (gauche), présent (centre), futur (droite).
export const THEMES = {
  past: { center: new THREE.Vector3(-SPACING, 0, 0), top: 0x5f9e3c, dirt: 0x7a5434, rock: 0x6b5a48, accent: 0xffb347, signBg: '#3b2a1a', signFg: '#fbe9c8', bridge: 'wood', gravity: 1 },
  present: { center: new THREE.Vector3(0, 0, 0), top: 0x7bbf4f, dirt: 0x8a6040, rock: 0x7a6a58, accent: 0x6fd3ff, signBg: '#1f3b57', signFg: '#e8f6ff', bridge: 'metal', gravity: 1 },
  future: { center: new THREE.Vector3(SPACING, 0, 0), top: 0xb9bcc6, dirt: 0x7b7f8e, rock: 0x55586a, accent: 0xb48cff, signBg: '#1a1530', signFg: '#d9ccff', bridge: 'energy', gravity: 0.45 },
}

export function createIslands(scene) {
  const colliders = []
  const interactables = []
  const animated = []
  const islandsInfo = []
  const surfaces = []
  const games = []

  for (const era of content) {
    const theme = THEMES[era.id]
    const module = ERAS[era.id]

    const makeCtx = (center, radius) => {
      const group = new THREE.Group()
      group.position.copy(center)
      scene.add(group)
      return {
        group,
        theme,
        center,
        radius,
        animated,
        addCollider: (x, z, r, top = 6) => colliders.push({ x: center.x + x, z: center.z + z, r, top }),
      }
    }

    // Île principale.
    const main = makeCtx(theme.center, ISLAND_RADIUS)
    buildBase(main, era.id, ISLAND_RADIUS)
    module.decorateMain(main)
    surfaces.push({ type: 'circle', x: theme.center.x, z: theme.center.z, r: ISLAND_RADIUS, h: 0 })
    islandsInfo.push({ id: era.id, era: era.id, name: era.name, tagline: era.tagline, center: theme.center, radius: ISLAND_RADIUS, gravity: theme.gravity })

    for (const sign of era.signs) {
      buildSign(main, sign)
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

    // Petites îles thématiques, reliées par des passerelles.
    for (const sat of era.satellites ?? []) {
      const layout = module.satellites[sat.id]
      const center = new THREE.Vector3(theme.center.x + layout.offset[0], 0, theme.center.z + layout.offset[1])
      const ctx = makeCtx(center, layout.r)
      buildBase(ctx, `${era.id}-${sat.id}`, layout.r)
      surfaces.push({ type: 'circle', x: center.x, z: center.z, r: layout.r, h: 0 })
      islandsInfo.push({ id: sat.id, era: era.id, name: sat.name, tagline: sat.tagline, center, radius: layout.r, gravity: theme.gravity })

      const game = layout.build(ctx)
      buildBridge(scene, theme, theme.center, ISLAND_RADIUS, center, layout.r, surfaces, animated)

      // Plateformes de parcours.
      for (const [px, pz, py, pr] of game.platforms ?? []) {
        buildPlatform(ctx, px, pz, py, pr, game.platformStyle)
        surfaces.push({ type: 'circle', x: center.x + px, z: center.z + pz, r: pr, h: py })
        if (Math.hypot(px, pz) < layout.r) ctx.addCollider(px, pz, pr * 0.9, py)
      }

      const toWorld = ([x, z, y = 0]) => new THREE.Vector3(center.x + x, y, center.z + z)
      const def = {
        ...game,
        id: `${era.id}-${sat.id}`,
        era: era.id,
        title: sat.game.title,
        intro: sat.game.intro,
        accent: theme.accent,
        start: toWorld(game.start),
        items: game.items?.map(toWorld),
        rings: game.rings?.map(toWorld),
        goal: game.goal && toWorld(game.goal),
      }
      buildStartPad(ctx, game.start, theme.accent, animated)
      interactables.push({ type: 'game', x: def.start.x, z: def.start.z, r: 2.2, title: def.title, game: def })
      games.push(def)
    }
  }

  // Nuages qui dérivent sous et entre les îles.
  const clouds = []
  for (let i = 0; i < 26; i++) {
    const cloud = model('cloud', { width: 3 + Math.random() * 4 })
    cloud.scale.y = 0.6
    cloud.position.set(-230 + Math.random() * 460, -16 - Math.random() * 26, -90 + Math.random() * 100)
    cloud.userData.speed = 0.6 + Math.random() * 1.2
    cloud.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = false
        o.material = o.material.clone()
        o.material.transparent = true
        o.material.opacity = 0.7
      }
    })
    clouds.push(cloud)
    scene.add(cloud)
  }
  animated.push((dt) => {
    for (const cloud of clouds) {
      cloud.position.x += cloud.userData.speed * dt
      if (cloud.position.x > 240) cloud.position.x = -240
    }
  })

  return {
    colliders,
    interactables,
    islands: islandsInfo,
    games,
    spawn: new THREE.Vector3(THEMES.past.center.x, 0, 4),
    // Hauteur du sol sous (x, z) : la plus haute surface sous les pieds, ou null (le vide).
    groundAt(x, z, y) {
      let best = null
      for (const s of surfaces) {
        if (s.h > y + 0.3 || (best !== null && s.h <= best)) continue
        if (s.type === 'circle') {
          const dx = x - s.x
          const dz = z - s.z
          if (dx * dx + dz * dz <= s.r * s.r) best = s.h
        } else {
          const abx = s.bx - s.ax
          const abz = s.bz - s.az
          const t = ((x - s.ax) * abx + (z - s.az) * abz) / (abx * abx + abz * abz)
          if (t < 0 || t > 1) continue
          const px = s.ax + abx * t
          const pz = s.az + abz * t
          if ((x - px) ** 2 + (z - pz) ** 2 <= (s.w / 2) ** 2) best = s.h
        }
      }
      return best
    },
    update(dt, t) {
      for (const fn of animated) fn(dt, t)
    },
  }
}

function buildBase({ group, theme }, id, radius) {
  const seed = id.length * 7 + radius
  // Dessus de l'île avec de légères variations de couleur.
  const top = jitter(new THREE.CylinderGeometry(radius, radius - 0.6, 1.2, Math.round(radius * 1.8), 4), 0.15, seed)
  const colors = []
  const base = new THREE.Color(theme.top)
  const c = new THREE.Color()
  const pos = top.attributes.position
  for (let i = 0; i < pos.count; i++) {
    const n = Math.sin(pos.getX(i) * 0.35 + seed) * Math.cos(pos.getZ(i) * 0.3)
    c.copy(base).offsetHSL(0, 0, n * 0.05 + (pos.getY(i) < 0 ? -0.08 : 0))
    colors.push(c.r, c.g, c.b)
  }
  top.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  const topMesh = mesh(top, mat(0xffffff, { vertexColors: true }), { y: -0.6 })
  topMesh.castShadow = false
  // Couche de terre sous l'herbe, puis la roche.
  const dirt = mesh(jitter(new THREE.CylinderGeometry(radius - 0.4, radius - 1.6, 2.4, Math.round(radius * 1.1), 1), 0.35, seed + 3), mat(theme.dirt), { y: -2.3 })
  const depth = radius * 0.9
  const rock = jitter(new THREE.ConeGeometry(radius - 1.5, depth, 14, 3), radius * 0.07, seed + 13)
  rock.rotateX(Math.PI)
  const rockMesh = mesh(rock, mat(theme.rock), { y: -3.4 - depth / 2 })
  group.add(topMesh, dirt, rockMesh)

  // Touffes d'herbe (ou cailloux sur la lune) en instances.
  const lunar = id.startsWith('future')
  const tuftGeo = lunar ? new THREE.DodecahedronGeometry(0.18, 0) : new THREE.ConeGeometry(0.08, 0.45, 3)
  const tufts = new THREE.InstancedMesh(tuftGeo, mat(0xffffff), Math.round((lunar ? 0.3 : 1) * radius * radius))
  const m = new THREE.Matrix4()
  const tuftColor = new THREE.Color()
  for (let i = 0; i < tufts.count; i++) {
    const a = Math.random() * Math.PI * 2
    const r = Math.sqrt(Math.random()) * (radius - 1)
    m.makeRotationY(Math.random() * Math.PI)
    m.setPosition(Math.cos(a) * r, lunar ? 0.05 : 0.2, Math.sin(a) * r)
    tufts.setMatrixAt(i, m)
    tufts.setColorAt(i, tuftColor.set(theme.top).offsetHSL(0, lunar ? -0.05 : 0.05, (Math.random() - 0.6) * 0.15))
  }
  tufts.receiveShadow = true
  group.add(tufts)

  // Petits rochers flottants autour de l'île.
  const count = Math.round(radius / 4)
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + seed
    const g = jitter(new THREE.IcosahedronGeometry(0.6 + (i % 3) * 0.5, 0), 0.3, i + 3)
    group.add(mesh(g, mat(theme.rock), { x: Math.cos(a) * (radius + 5), y: -4 - (i % 3) * 3, z: Math.sin(a) * (radius + 5) }))
  }
}

function buildSign({ group, theme }, sign) {
  const [x, z] = sign.pos
  const wood = mat(0x7a5230)
  const post = mesh(new THREE.BoxGeometry(0.2, 2.2, 0.2), wood, { x, y: 1.1, z })
  const boardMat = new THREE.MeshStandardMaterial({ map: textTexture(sign.title, { bg: theme.signBg, fg: theme.signFg }) })
  const board = mesh(new THREE.BoxGeometry(3.2, 0.85, 0.12), [wood, wood, wood, wood, boardMat, boardMat], { x, y: 2.4, z })
  const ring = mesh(
    new THREE.RingGeometry(1.3, 1.6, 32),
    new THREE.MeshBasicMaterial({ color: theme.accent, transparent: true, opacity: 0.55, side: THREE.DoubleSide }),
    { x, y: 0.03, z, shadow: false },
  )
  ring.rotation.x = -Math.PI / 2
  group.add(post, board, ring)
}

// Passerelle entre deux îles, de bord à bord, dans le style de l'époque.
function buildBridge(scene, theme, a, ra, b, rb, surfaces, animated) {
  const dir = new THREE.Vector3().subVectors(b, a).setY(0).normalize()
  const start = a.clone().addScaledVector(dir, ra - 1.5)
  const end = b.clone().addScaledVector(dir, -(rb - 1.5))
  const length = start.distanceTo(end)
  const width = 3
  surfaces.push({ type: 'bridge', ax: start.x, az: start.z, bx: end.x, bz: end.z, w: width, h: 0 })

  const group = new THREE.Group()
  group.position.copy(start).lerp(end, 0.5)
  group.rotation.y = Math.atan2(dir.x, dir.z)
  scene.add(group)

  if (theme.bridge === 'wood') {
    const plankMat = mat(0x9a6a3a)
    for (let z = -length / 2; z < length / 2; z += 0.55) {
      const plank = mesh(new THREE.BoxGeometry(width, 0.15, 0.45), plankMat, { y: -0.08, z: z + 0.25 })
      plank.rotation.z = (Math.random() - 0.5) * 0.04
      group.add(plank)
    }
    const step = length / Math.ceil(length / 2.5)
    for (let z = -length / 2; z <= length / 2 + 0.01; z += step) {
      for (const x of [-width / 2, width / 2]) group.add(mesh(new THREE.CylinderGeometry(0.08, 0.1, 1.2, 6), mat(0x5a3a22), { x, y: 0.5, z }))
    }
    for (const x of [-width / 2, width / 2]) {
      const rope = mesh(new THREE.CylinderGeometry(0.03, 0.03, length, 4), mat(0xc9a66b), { x, y: 1, shadow: false })
      rope.rotation.x = Math.PI / 2
      group.add(rope)
    }
  } else if (theme.bridge === 'metal') {
    group.add(mesh(new THREE.BoxGeometry(width, 0.2, length), mat(0x8a8f99, { metalness: 0.5, roughness: 0.5 }), { y: -0.1 }))
    group.add(mesh(new THREE.BoxGeometry(width * 0.6, 0.02, length), mat(0xd9a441), { y: 0.01, shadow: false }))
    const step = length / Math.ceil(length / 2)
    for (const x of [-width / 2, width / 2]) {
      group.add(mesh(new THREE.BoxGeometry(0.08, 0.08, length), mat(0xdddddd), { x, y: 1 }))
      for (let z = -length / 2; z <= length / 2 + 0.01; z += step) group.add(mesh(new THREE.BoxGeometry(0.06, 1, 0.06), mat(0xdddddd), { x, y: 0.5, z }))
    }
  } else {
    const deck = mesh(new THREE.BoxGeometry(width, 0.12, length), mat(0x8f7bff, { transparent: true, opacity: 0.5, emissive: 0x5a3fd6, emissiveIntensity: 0.6 }), { y: -0.06, shadow: false })
    group.add(deck)
    for (const x of [-width / 2, width / 2]) {
      group.add(mesh(new THREE.BoxGeometry(0.1, 0.1, length), mat(0xd9ccff, { emissive: theme.accent, emissiveIntensity: 2.5 }), { x, y: 0.6, shadow: false }))
    }
    animated.push((dt, t) => { deck.material.emissiveIntensity = 0.5 + Math.sin(t * 3) * 0.2 })
  }
}

// Plateforme de parcours, style selon l'époque.
function buildPlatform({ group }, x, z, y, r, style) {
  if (style === 'rooftop') {
    if (y < 1.5) {
      group.add(mesh(new THREE.BoxGeometry(r * 1.6, y, r * 1.6), mat(0xa0703f), { x, y: y / 2, z }))
    } else {
      const hue = Math.abs((x * 0.13 + z * 0.07) % 1)
      group.add(mesh(new THREE.BoxGeometry(r * 1.7, y, r * 1.7), mat(new THREE.Color().setHSL(hue, 0.35, 0.55)), { x, y: y / 2, z }))
      for (let wy = 0.8; wy < y - 0.4; wy += 1) {
        group.add(mesh(new THREE.BoxGeometry(r * 1.72, 0.35, r * 1.2), mat(0xfff2a8, { emissive: 0xffd76a, emissiveIntensity: 0.5 }), { x, y: wy, z, shadow: false }))
      }
      group.add(mesh(new THREE.BoxGeometry(r * 1.8, 0.15, r * 1.8), mat(0x555a66), { x, y: y + 0.05, z }))
    }
    return
  }
  const asteroid = style === 'asteroid'
  group.add(mesh(jitter(new THREE.CylinderGeometry(r, r * 0.85, 0.5, 9), 0.08, x + z), mat(asteroid ? 0x6e6a7a : 0xa8a090), { x, y: y - 0.25, z }))
  const under = jitter(new THREE.ConeGeometry(r * 0.85, r * 1.6, 8), r * 0.12, x * 3 + z)
  under.rotateX(Math.PI)
  group.add(mesh(under, mat(asteroid ? 0x4f4b5c : 0x7a7264), { x, y: y - 0.5 - r * 0.8, z }))
  if (asteroid) {
    const glow = mesh(new THREE.TorusGeometry(r * 0.9, 0.05, 4, 24), mat(0xb48cff, { emissive: 0xb48cff, emissiveIntensity: 2 }), { x, y: y + 0.02, z, shadow: false })
    glow.rotation.x = Math.PI / 2
    group.add(glow)
  } else {
    // Mousse sur les pierres des ruines.
    group.add(mesh(new THREE.CylinderGeometry(r * 0.7, r * 0.7, 0.06, 9), mat(0x5f9e3c), { x, y: y + 0.01, z, shadow: false }))
  }
}

function buildStartPad({ group }, [x, z], accent, animated) {
  const pad = mesh(new THREE.CylinderGeometry(1.6, 1.8, 0.2, 24), mat(0x2a2440), { x, y: 0.1, z })
  const ring = mesh(new THREE.RingGeometry(1.2, 1.5, 32), new THREE.MeshBasicMaterial({ color: accent, side: THREE.DoubleSide, transparent: true }), { x, y: 0.22, z, shadow: false })
  ring.rotation.x = -Math.PI / 2
  const star = mesh(new THREE.OctahedronGeometry(0.35, 0), mat(accent, { emissive: accent, emissiveIntensity: 2 }), { x, y: 3.4, z, shadow: false })
  group.add(pad, ring, star)
  animated.push((dt, t) => {
    star.rotation.y += dt * 2
    star.position.y = 3.4 + Math.sin(t * 3) * 0.2
    ring.material.opacity = 0.6 + Math.sin(t * 4) * 0.3
  })
}
