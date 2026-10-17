import * as THREE from 'three'
import { islands as content } from '../content.js'
import { jitter, mat, mesh, textTexture } from './helpers.js'
import { model } from './models.js'
import { buildTerrain, createGround, edgeAlong, settle, shapeRadius } from './terrain.js'
import { buildLeaves, growGrass, scatterConfetti, updateNature } from './nature.js'
import * as P from './props.js'
import { buildPoint } from './points.js'
import { buildRoom, ROOMS } from './interiors.js'
import * as past from './eras/past.js'
import * as present from './eras/present.js'
import * as future from './eras/future.js'

export const ISLAND_RADIUS = 22
const SPACING = 150
const ERAS = { past, present, future }

// Ordre : passé (gauche), présent (centre), futur (droite).
export const THEMES = {
  past: { center: new THREE.Vector3(-SPACING, 0, 0), top: 0x5fae46, lip: 0x4a9a3a, dirt: 0x7a5434, rock: 0x67637f, accent: 0xffb347, signBg: '#3b2a1a', signFg: '#fbe9c8', bridge: 'wood', gravity: 1 },
  present: { center: new THREE.Vector3(0, 0, 0), top: 0x7bbf4f, lip: 0xd07a3c, dirt: 0x8a6040, rock: 0xa0583a, accent: 0x6fd3ff, signBg: '#1f3b57', signFg: '#e8f6ff', bridge: 'metal', gravity: 1 },
  future: { center: new THREE.Vector3(SPACING, 0, 0), top: 0xaeb2c2, lip: 0x9a9eb2, dirt: 0x7b7f8e, rock: 0x5a5c78, accent: 0xb48cff, signBg: '#1a1530', signFg: '#d9ccff', bridge: 'energy', gravity: 0.45 },
}

export function createIslands(scene) {
  const colliders = []
  const interactables = []
  const animated = []
  const islandsInfo = []
  const games = []
  const fadeables = []
  const pushables = []
  const ground = createGround()
  const pending = []
  const mains = {}
  const surfaces = ground.surfaces
  const warn = (child, p) => console.warn(`Décor dans le vide à (${p.x.toFixed(1)}, ${p.z.toFixed(1)})`, child)

  // Après les décors : feuillages en particules puis herbe qui les contourne.
  const finish = (ctx) => {
    buildLeaves(ctx, ground)
    growGrass(ctx, ground, colliders, ctx.era)
    if (ctx.era === 'present') scatterConfetti(ctx, ground, { count: Math.round(ctx.radius * ctx.radius * 1.2) })
  }

  for (const era of content) {
    const theme = THEMES[era.id]
    const module = ERAS[era.id]
    const lunar = era.id === 'future'
    const stairs = { wood: 'stone', metal: 'metal', energy: 'energy' }[theme.bridge]

    const makeCtx = (center, shape) => {
      const group = new THREE.Group()
      group.position.copy(center)
      scene.add(group)
      const ctx = {
        group,
        theme,
        center,
        shape,
        era: era.id,
        colliders,
        radius: shapeRadius(shape),
        animated,
        // Hauteur du terrain en coordonnées locales.
        heightAt: (x, z) => ground.heightAt(center.x + x, center.z + z, Infinity, true) ?? 0,
        addCollider: (x, z, r, top = 6) => colliders.push({ x: center.x + x, z: center.z + z, r, top: top + ctx.heightAt(x, z) }),
        // Objet qui devient transparent quand il cache le joueur à la caméra.
        addFadeable: (object) => fadeables.push(object),
        // Objet qu'on peut pousser (voir pushables.js), en coordonnées locales.
        addPushable: (kind, x, z, opts = {}) => pushables.push({ kind, x: center.x + x, z: center.z + z, gravity: theme.gravity, ...opts, goals: (opts.goals ?? (opts.goal ? [opts.goal] : [])).map(([gx, gz, gr]) => [center.x + gx, center.z + gz, gr]) }),
      }
      buildTerrain(ctx, shape, ground, { lunar, stairs, era: era.id })
      ctx.decorFrom = group.children.length
      return ctx
    }

    // Île principale.
    const mainShape = module.mainShape ?? { lobes: [[0, 0, ISLAND_RADIUS, 0]] }
    const main = makeCtx(theme.center, mainShape)
    module.decorateMain(main)
    mains[era.id] = main
    islandsInfo.push({ id: era.id, era: era.id, name: era.name, tagline: era.tagline, center: theme.center, radius: main.radius, gravity: theme.gravity })

    // Points d'intérêt : sur l'île principale, sur une petite île (`sat`) ou dans un intérieur (`room`).
    const addPoint = (ctx, sign, place) => {
      buildPoint(ctx, sign.pos[0], sign.pos[1], { prop: sign.prop, title: sign.title, accent: theme.accent, rotY: sign.rotY ?? 0, labelY: sign.prop ? 3 : 3.2 })
      interactables.push({
        type: 'sign',
        x: ctx.center.x + sign.pos[0],
        z: ctx.center.z + sign.pos[1],
        r: 2.6,
        title: sign.title,
        text: sign.text,
        links: sign.links,
        icon: sign.icon,
        kicker: place,
        era: era.id,
      })
    }
    for (const sign of era.signs) if (!sign.sat && !sign.room) addPoint(main, sign, era.name)
    pending.push(...era.signs.filter((sign) => sign.room).map((sign) => ({ sign, addPoint })))
    settle(main.group, main.decorFrom, ground, warn)
    finish(main)

    // Petites îles thématiques, reliées par des passerelles.
    for (const sat of era.satellites ?? []) {
      const layout = module.satellites[sat.id]
      const center = new THREE.Vector3(theme.center.x + layout.offset[0], 0, theme.center.z + layout.offset[1])
      const shape = layout.shape ?? { lobes: [[0, 0, layout.r, 0]] }
      const ctx = makeCtx(center, shape)
      islandsInfo.push({ id: sat.id, era: era.id, name: sat.name, tagline: sat.tagline, center, radius: ctx.radius, gravity: theme.gravity })

      const game = layout.build(ctx)
      const dir = new THREE.Vector3().subVectors(center, theme.center).setY(0).normalize()
      const from = theme.center.clone().addScaledVector(dir, edgeAlong(mainShape, dir, theme.center) - 1.2)
      const to = center.clone().addScaledVector(dir, -(edgeAlong(shape, dir.clone().negate(), center) - 1.2))
      buildBridge(scene, theme, from, to, surfaces, animated)

      // Plateformes de parcours.
      for (const [px, pz, py, pr] of game.platforms ?? []) {
        const base = ctx.heightAt(px, pz)
        buildPlatform(ctx, px, pz, py, pr, game.platformStyle, base)
        surfaces.push({ type: 'circle', x: center.x + px, z: center.z + pz, r: pr, h: py, platform: true, solid: false })
        if (base > 0 || Math.hypot(px, pz) < ctx.radius) colliders.push({ x: center.x + px, z: center.z + pz, r: pr * 0.9, top: py })
      }

      for (const sign of era.signs) if (sign.sat === sat.id) addPoint(ctx, sign, sat.name)
      buildStartPad(ctx, game.start, theme.accent, animated)
      settle(ctx.group, ctx.decorFrom, ground, warn)
      finish(ctx)

      const toWorld = ([x, z, y = 0]) => new THREE.Vector3(center.x + x, y + ctx.heightAt(x, z), center.z + z)
      const def = {
        ...game,
        id: `${era.id}-${sat.id}`,
        era: era.id,
        title: sat.game.title,
        intro: sat.game.intro,
        accent: theme.accent,
        start: toWorld(game.start),
        items: game.items?.map(toWorld),
        rings: game.rings?.map(([x, z, y = 1.6]) => toWorld([x, z, y])),
        goal: game.goal && new THREE.Vector3(center.x + game.goal[0], game.goal[2], center.z + game.goal[1]),
      }
      interactables.push({ type: 'game', x: def.start.x, z: def.start.z, r: 2.2, title: def.title, game: def })
      games.push(def)
    }
  }

  // Intérieurs (château, studio, base lunaire) et leurs portes.
  const DOORS = {
    castle: { at: [0, -8.9], out: [0, -6.4], label: 'Entrer dans le château' },
    studio: { at: [-15 + 0.781 * 3.7, 12 - 0.625 * 3.7], out: [-15 + 0.781 * 5.8, 12 - 0.625 * 5.8], label: 'Entrer dans le studio' },
    base: { at: [0, -9.7], out: [0, -7.2], label: 'Entrer dans la base' },
  }
  const rooms = {}
  for (const key of Object.keys(ROOMS)) {
    const room = buildRoom(scene, ground, colliders, animated, key)
    rooms[key] = room
    islandsInfo.push(room.info)
    const main = mains[room.era]
    const door = DOORS[key]
    const accent = THEMES[room.era].accent
    const from = main.group.children.length
    buildPoint(main, door.at[0], door.at[1], { title: door.label.replace('Entrer dans le', '').replace('Entrer dans la', '').trim().replace(/^./, (c) => c.toUpperCase()), accent, collide: false, labelY: 3.4 })
    settle(main.group, from, ground, warn)
    const outside = new THREE.Vector3(main.center.x + door.out[0], 0, main.center.z + door.out[1])
    outside.y = ground.heightAt(outside.x, outside.z, Infinity, true) ?? 0
    interactables.push({ type: 'door', x: main.center.x + door.at[0], z: main.center.z + door.at[1], r: 2, title: door.label, to: room.arrival.clone(), auto: true })
    interactables.push({ type: 'door', x: room.exit.x, z: room.exit.z, r: 1.6, title: 'Sortir', to: outside, auto: true })
  }
  for (const { sign, addPoint } of pending) addPoint(rooms[sign.room], sign, rooms[sign.room].room.name)

  // Poteaux indicateurs : une flèche par destination (petites îles, intérieur, véhicules).
  const C = (era) => THEMES[era].center
  const SIGNPOSTS = {
    past: { at: [3, 1], extra: [['Château', C('past').x, C('past').z - 10], ['Voiture ➜ Présent', C('past').x + 19, 0]] },
    present: { at: [2, 8], extra: [['Studio', -12, 9.6], ['Voiture ➜ Passé', -19, 0], ['Fusée ➜ Futur', 17, 0]] },
    future: { at: [2, 2], extra: [['Base lunaire', C('future').x, -10], ['Fusée ➜ Présent', C('future').x - 17, 0]] },
  }
  for (const [eraId, def] of Object.entries(SIGNPOSTS)) {
    const main = mains[eraId]
    const targets = islandsInfo.filter((i) => i.era === eraId && !i.interior && i.id !== eraId).map((i) => [i.name, i.center.x, i.center.z]).concat(def.extra)
    const from = main.group.children.length
    signpost(main, def.at[0], def.at[1], targets, THEMES[eraId])
    settle(main.group, from, ground, warn)
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
    fadeables,
    pushables,
    colliders,
    interactables,
    islands: islandsInfo,
    games,
    spawn: new THREE.Vector3(THEMES.past.center.x, 0, 4),
    groundAt: ground.heightAt,
    pushOut: ground.pushOut,
    blocked: ground.blocked,
    rails: ground.rails,
    addRamp: (r) => ground.ramps.push(r),
    surfaces: ground.surfaces,
    update(dt, t) {
      updateNature(t)
      for (const fn of animated) fn(dt, t)
    },
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

// Poteau indicateur avec des flèches en bois vers chaque destination.
function signpost(ctx, x, z, targets, theme) {
  const g = new THREE.Group()
  g.position.set(x, 0, z)
  ctx.group.add(g)
  const wood = mat(0x6b4226)
  const top = 1.2 + targets.length * 0.55
  g.add(mesh(new THREE.CylinderGeometry(0.1, 0.13, top + 0.3, 6), wood, { y: (top + 0.3) / 2 }))
  g.add(mesh(new THREE.ConeGeometry(0.18, 0.3, 6), mat(theme.accent, { emissive: theme.accent, emissiveIntensity: 0.6 }), { y: top + 0.45 }))
  targets.forEach(([label, tx, tz], i) => {
    const dx = tx - (ctx.center.x + x)
    const dz = tz - (ctx.center.z + z)
    const arm = new THREE.Group()
    arm.position.y = top - i * 0.55
    arm.rotation.y = Math.atan2(-dz, dx)
    const face = new THREE.MeshStandardMaterial({ map: textTexture(label, { bg: theme.signBg, fg: theme.signFg, width: 512, height: 96, font: 'bold 44px Georgia, serif' }) })
    const board = mesh(new THREE.BoxGeometry(2.3, 0.42, 0.08), [wood, wood, wood, wood, face, face], { x: 1.3 })
    const tip = mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.08, 3), wood, { x: 2.5 })
    tip.rotation.x = Math.PI / 2
    tip.rotation.y = Math.PI / 2
    arm.add(board, tip)
    g.add(arm)
  })
  ctx.addCollider(x, z, 0.3)
}

// Passerelle entre deux îles, de bord à bord, dans le style de l'époque.
function buildBridge(scene, theme, start, end, surfaces, animated) {
  const dir = new THREE.Vector3().subVectors(end, start).setY(0).normalize()
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
      // Grands mâts aux extrémités et guirlande de fanions (Mike).
      for (const z of [-length / 2, length / 2]) group.add(mesh(new THREE.BoxGeometry(0.2, 3.4, 0.2), mat(0x5a3a22), { x, y: 1.5, z }))
      P.bunting(group, [x, 3.1, -length / 2], [x, 3.1, length / 2], { sag: Math.min(1.2, length * 0.08) })
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
function buildPlatform(ctx, x, z, y, r, style, base = 0) {
  // Les plateformes sont à hauteur absolue : on les garde hors du calage sur le terrain.
  const group = new THREE.Group()
  group.userData.terrain = true
  ctx.group.add(group)
  if (style === 'rooftop') {
    const hgt = y - base
    if (hgt < 1.5) {
      group.add(mesh(new THREE.BoxGeometry(r * 1.6, hgt, r * 1.6), mat(0xa0703f), { x, y: base + hgt / 2, z }))
    } else {
      const hue = Math.abs((x * 0.13 + z * 0.07) % 1)
      group.add(mesh(new THREE.BoxGeometry(r * 1.7, hgt, r * 1.7), mat(new THREE.Color().setHSL(hue, 0.35, 0.55)), { x, y: base + hgt / 2, z }))
      for (let wy = base + 0.8; wy < y - 0.4; wy += 1) {
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
