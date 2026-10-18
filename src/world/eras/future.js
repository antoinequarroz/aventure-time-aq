import * as THREE from 'three'
import { mat, mesh } from '../helpers.js'
import * as C from '../characters.js'
import { model, animate } from '../models.js'
import * as P from '../props.js'
import { fireflies } from '../nature.js'
import * as S from '../stoneworks.js'

// Le Futur : base lunaire, faible gravité.

// Relief : plaine lunaire découpée, observatoire en hauteur, pont d'atterrissage surélevé.
export const mainShape = {
  lobes: [
    [0, 0, 14, 0], [0, -13, 9, 0], [10, -10, 7, 0], [-13, 2, 8, 0], [13, 3, 8, 0], [3, 14, 8, 0], [-10, 12, 7, 0], [11, 11, 6, 0],
    [-12, -8, 5.5, 1.6],
    [12, -4, 5, 1],
    // Le Labo, au sud-ouest.
    [-21, 18, 7.5, 0], [-15.5, 15, 5, 0],
  ],
  plazas: [[-21, 18, 6.2], [12.5, 2.5, 3.8]],
  ramps: [[-5.5, -3, 0, -8.8, -5.6, 1.6, 2.6]],
}

function crater({ group }, cx, cz, r) {
  const ring = mesh(new THREE.TorusGeometry(r, 0.35, 6, 18), mat(0x9a9ca6), { x: cx, z: cz, shadow: false })
  ring.rotation.x = Math.PI / 2
  const floor = mesh(new THREE.CircleGeometry(r, 18), mat(0x8a8c96), { x: cx, y: 0.02, z: cz, shadow: false })
  floor.rotation.x = -Math.PI / 2
  group.add(ring, floor)
}

export function decorateMain(ctx) {
  const { group, addCollider, animated } = ctx
  for (const [cx, cz, r] of [[-12, 6, 2.5], [6, 4, 1.6], [11, 11, 2], [-4, -15, 1.8], [-15, -10, 1.2]]) crater(ctx, cx, cz, r)

  // Base lunaire.
  const dome = mesh(new THREE.SphereGeometry(4, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xdfe6f0, { metalness: 0.3, roughness: 0.4 }), { z: -14 })
  group.add(dome)
  ctx.addFadeable(dome)
  const tube = mesh(new THREE.CylinderGeometry(1, 1, 6, 12), mat(0xcfd6e0), { x: 6, y: 1, z: -14 })
  tube.rotation.z = Math.PI / 2
  group.add(tube, mesh(new THREE.CylinderGeometry(2, 2, 3, 12), mat(0xcfd6e0), { x: 10, y: 1.5, z: -14 }))
  for (const wx of [-1.5, 1.5]) group.add(mesh(new THREE.CircleGeometry(0.5, 12), mat(0x6fd3ff, { emissive: 0x6fd3ff, emissiveIntensity: 1.5 }), { x: wx, y: 2, z: -10.2, shadow: false }))
  addCollider(0, -14, 4.2)
  for (const tx of [4, 6, 8]) addCollider(tx, -14, 1.1)
  addCollider(10, -14, 2.2)

  // Antenne parabolique.
  const dish = mesh(new THREE.SphereGeometry(1.4, 16, 8, 0, Math.PI * 2, 0, Math.PI / 3), mat(0xffffff, { side: THREE.DoubleSide }), { x: -8, y: 3.4, z: -14 })
  dish.rotation.x = -0.9
  group.add(mesh(new THREE.CylinderGeometry(0.12, 0.12, 3, 6), mat(0x888888), { x: -8, y: 1.5, z: -14 }), dish)
  addCollider(-8, -14, 0.6)
  animated.push((dt) => { dish.rotation.z += dt * 0.3 })

  // Télescope (astronomie) : lunette blanche sur trépied. Marcher sur l'anneau lumineux fait entrer dedans.
  const scopeRig = new THREE.Group()
  scopeRig.position.set(-13, 0, -4)
  const white = mat(0xf2f4f8, { roughness: 0.35 })
  const dark = mat(0x2a2f3a, { roughness: 0.5 })
  const glow = mat(0x8fe3ff, { emissive: 0x6fd3ff, emissiveIntensity: 2.2 })
  scopeRig.add(mesh(new THREE.CylinderGeometry(0.9, 1.05, 0.3, 20), mat(0x9aa3b4), { y: 0.15 }))
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.4
    const leg = mesh(new THREE.CylinderGeometry(0.05, 0.07, 1.9, 6), dark, { x: Math.cos(a) * 0.45, y: 1.1, z: Math.sin(a) * 0.45 })
    leg.lookAt(0, 3.6, 0)
    leg.rotateX(Math.PI / 2)
    scopeRig.add(leg)
  }
  scopeRig.add(mesh(new THREE.CylinderGeometry(0.14, 0.18, 0.5, 10), dark, { y: 2 }))
  scopeRig.add(mesh(new THREE.SphereGeometry(0.22, 12, 8), white, { y: 2.3 }))
  // Tube incliné vers le ciel, oculaire tourné vers l'anneau d'entrée.
  const tubeG = new THREE.Group()
  tubeG.position.set(0, 2.35, 0)
  tubeG.rotation.y = Math.atan2(-1.4, 1.8)
  const tilt = new THREE.Group()
  tilt.rotation.x = 0.7
  tubeG.add(tilt)
  tilt.add(mesh(new THREE.CylinderGeometry(0.26, 0.2, 2.6, 16), white, { rotX: Math.PI / 2, z: -0.5 }))
  tilt.add(mesh(new THREE.CylinderGeometry(0.31, 0.31, 0.35, 16), dark, { rotX: Math.PI / 2, z: -1.75 }))
  tilt.add(mesh(new THREE.CircleGeometry(0.25, 16), mat(0x1b3a6b, { emissive: 0x3b7bff, emissiveIntensity: 0.8, roughness: 0.1 }), { z: -1.93, rotY: Math.PI, shadow: false }))
  for (const zz of [-1.2, 0.2]) tilt.add(mesh(new THREE.TorusGeometry(0.25, 0.035, 6, 18), glow, { z: zz, shadow: false }))
  tilt.add(mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.9, 8), white, { rotX: Math.PI / 2, x: 0.3, y: 0.18, z: -0.9 }))
  tilt.add(mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.35, 10), dark, { rotX: Math.PI / 2, z: 0.9 }))
  scopeRig.add(tubeG)
  group.add(scopeRig)
  addCollider(-13, -4, 1.1)
  // Anneau d'entrée au sol.
  const pad = new THREE.Group()
  pad.position.set(-14.4, 0.04, -2.2)
  pad.add(mesh(new THREE.CircleGeometry(0.85, 28), mat(0x16233d, { roughness: 0.6 }), { rotX: -Math.PI / 2, shadow: false }))
  const padRing = mesh(new THREE.RingGeometry(0.72, 0.9, 32), glow, { rotX: -Math.PI / 2, y: 0.01, shadow: false })
  pad.add(padRing)
  const padStar = mesh(new THREE.OctahedronGeometry(0.22, 0), glow, { y: 1.3, shadow: false })
  pad.add(padStar)
  pad.userData.dynamic = true
  group.add(pad)
  animated.push((dt, t) => {
    padRing.scale.setScalar(1 + Math.sin(t * 3) * 0.06)
    padStar.rotation.y += dt * 1.5
    padStar.position.y = 1.3 + Math.sin(t * 2) * 0.12
  })

  // Cosmonaute qui flotte.
  const astro = C.npc(ctx, 'rogue', -4, 3, { anim: 'Cheer', speed: 0.6, r: 0.8 })
  C.spaceSuit(astro.object)
  animated.push((dt, t) => { astro.object.position.y = Math.abs(Math.sin(t * 1.3)) * 0.6 })
  // Cosmonautes en mission, à petits pas sur la Lune.
  for (const [ax, az, route] of [[6, 2, [[6, 2], [10, 6], [6, 9]]], [-8, -1, [[-8, -1], [-11, 3], [-6, 6]]]]) {
    const a = C.npc(ctx, 'knight', ax, az, { keep: [], path: route, walk: 0.9, pause: 3 })
    C.spaceSuit(a.object)
  }

  // Robot compagnon (Quaternius) qui alterne coucou et danse.
  const robot = model('robot', { height: 2.6, x: 3, z: -3, rotY: -0.3 })
  const { mixer, actions } = animate(robot, 'Wave')
  group.add(robot)
  addCollider(3, -3, 1)
  let robotTimer = 0
  animated.push((dt) => {
    mixer.update(dt)
    robotTimer += dt
    if (robotTimer > 6) {
      robotTimer = 0
      const [from, to] = actions.Wave.isRunning() ? [actions.Wave, actions.Dance] : [actions.Dance, actions.Wave]
      to.reset().fadeIn(0.4).play()
      from.fadeOut(0.4)
    }
  })

  // Drone qui patrouille autour de la base.
  const drone = model('drone', { height: 1.4 })
  group.add(drone)
  animated.push((dt, t) => {
    const a = t * 0.5
    drone.position.set(Math.cos(a) * 7, 6 + Math.sin(t * 2) * 0.4, -14 + Math.sin(a) * 7)
    drone.rotation.y = -a
  })

  // Drapeau planté.
  group.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.5, 5), mat(0xcccccc), { x: 4, y: 1.25, z: 13 }))
  group.add(mesh(new THREE.PlaneGeometry(1.2, 0.7), mat(0x2f6fd8, { side: THREE.DoubleSide }), { x: 4.6, y: 2.2, z: 13 }))

  // Mémorial des pionniers, en marbre blanc à runes néon.
  S.useTheme('future')
  S.monument(ctx, 12.5, 2.2, { statue: { key: 'knight', anim: 'Cheer', time: 0.5, keep: [], height: 2.6, suit: true, rotY: -0.35 }, open: Math.PI * 0.9, r: 2.8, pillars: 4, spread: 1.05 })

  // Installations de la base.
  P.solarPanel(ctx, 14, -5, { rotY: 0.3 })
  P.solarPanel(ctx, 16.5, -2, { rotY: 0.3 })
  P.antenna(ctx, -17, -8, { h: 6 })
  P.antenna(ctx, 15, 9, { h: 4 })
  P.holoRing(ctx, -8, 10)
  P.alienPlant(ctx, -15, 8)
  P.alienPlant(ctx, -9, 16, { color: 0xff7de9 })
  P.crystals(ctx, 15, -11, { color: 0xb48cff, glow: true })
  P.rover(ctx, 9, 9, { drive: true })
  // Caisses qu'on pousse (elles glissent loin : gravité lunaire).
  ctx.addPushable('moonCrate', -5.5, -17.5, { rotY: 0.5 })
  ctx.addPushable('moonCrate', -3.6, -18.2, { rotY: 1.2 })
  ctx.addPushable('moonCrate', 5, 6, { rotY: 0.3 })
  P.place(ctx, 'cyborg', 6.5, -8, { height: 2, rotY: 0.4, r: 0.5 })
  // Flèches de cristal néon, arbres et buissons extraterrestres, poussière qui scintille.
  P.spires(ctx, 19, 7.5, { height: 6, count: 4, color: 0x7f78e0, glow: 0x3fe8ff, spread: 1.2 })
  P.spires(ctx, -6, 17, { height: 4.5, count: 3, color: 0x9a7bf0, glow: 0xff5fd0, spread: 1 })
  P.spires(ctx, 8, 18.5, { height: 4, count: 3, color: 0x7f78e0, glow: 0x3fe8ff, spread: 0.9 })
  P.leafTree(ctx, -16, -1, { palette: 'teal', size: 1 })
  P.leafTree(ctx, 5, 16, { palette: 'purple', size: 0.9 })
  for (const [bx, bz, pal] of [[-6, 9, 'teal'], [14, 13, 'purple'], [9, -1, 'teal'], [-11, 5, 'purple']]) P.bush(ctx, bx, bz, { palette: pal })
  fireflies(ctx, { count: 70, color: 0x7ff6ff, height: 4 })
}

export const satellites = {
  // Sauts d'astéroïde en astéroïde (gravité lunaire).
  asteroids: {
    offset: [-12, -44],
    r: 12,
    shape: { lobes: [[0, 2, 9, 0], [5, -5, 6, 0], [-5, -4, 5, 0]], plazas: [[4.5, -4.5, 3.8]] },
    build(ctx) {
      P.crystals(ctx, -6, 4, { color: 0x58d0ff })
      P.antenna(ctx, 5, 5)
      // Statue du premier pas sur la Lune.
      S.useTheme('future')
      S.monument(ctx, 4.8, -5, { statue: { key: 'rogue', anim: 'Idle', time: 0.3, keep: [], height: 2.5, suit: true, rotY: -0.3 }, open: Math.PI * 0.6, r: 2.8, pillars: 4, spread: 1.05 })
      crater(ctx, -1.5, 5.5, 1.4)
      P.alienPlant(ctx, -7, 3)
      P.cliff(ctx, -6, -7, { height: 3.5, lunar: true })
      // Balise d'arrivée.
      const beacon = mesh(new THREE.CylinderGeometry(0.15, 0.3, 2, 8), mat(0xdddddd), { x: 7, y: 10.5 + 1, z: -1 })
      const light = mesh(new THREE.SphereGeometry(0.35, 12, 8), mat(0xb48cff, { emissive: 0xb48cff, emissiveIntensity: 3 }), { x: 7, y: 10.5 + 2.2, z: -1, shadow: false })
      ctx.group.add(beacon, light)
      ctx.animated.push((dt, t) => { light.scale.setScalar(1 + Math.sin(t * 5) * 0.2) })
      return {
        type: 'parkour',
        start: [1, 7],
        platformStyle: 'asteroid',
        platforms: [
          [-3, 1, 1.5, 1.3], [-7, -4, 3, 1.2], [-4, -10, 4.5, 1.2], [2, -14, 6, 1.2],
          [8, -12, 7.5, 1.2], [11, -6, 9, 1.3], [7, -1, 10.5, 1.5],
        ],
        goal: [7, -1, 10.5],
      }
    },
  },

  // Récolte de cellules d'énergie dans la mine de cristaux.
  crystals: {
    offset: [45, 10],
    r: 13,
    shape: { lobes: [[0, 0, 10, 0], [6, -6, 6, 0], [-5, 6, 6, 0], [7, 6, 5, 0], [-6, -4, 5, 0], [0, 0, 3.2, 1]] },
    build(ctx) {
      P.crystals(ctx, 0, 0, { color: 0xb48cff, size: 1.6, glow: true })
      // Arche d'entrée en marbre et couronne de piliers autour du grand cristal.
      S.useTheme('future')
      S.grandArch(ctx, -7.6, -1.7, { rotY: Math.PI / 2 - 0.22, width: 4.4, h: 3.2, color: 0x3fe8ff })
      for (const s of [-1, 1]) S.lanternPost(ctx, -6.6, -1.5 + s * 3)
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + 0.5
        S.runePillar(ctx, Math.cos(a) * 2.7, Math.sin(a) * 2.7, { h: 1.3, rotY: Math.PI / 2 - a, color: S.theme().runes[i % 3] })
      }
      S.leaves(ctx, 0, 0, { r: 4.5, inner: 3, count: 90 })
      P.crystals(ctx, 6, -6, { color: 0x58d0ff, size: 1.1 })
      P.crystals(ctx, -5, 7, { color: 0x7dff9a, size: 1.2, glow: true })
      P.crystals(ctx, 8, 6, { color: 0xff7de9, size: 0.9 })
      P.rover(ctx, -4, -6, { rotY: 0.6 })
      P.place(ctx, 'sciCrate', 3, 9, { height: 1.3, rotY: 0.2, r: 0.8 })
      P.cliff(ctx, -8, 8, { height: 3, lunar: true, small: true })
      P.antenna(ctx, 9, 0)
      crater(ctx, -8, -1, 2)
      return {
        type: 'collect',
        start: [-8, -6],
        item: 'cell',
        time: 40,
        items: [[-3, 3], [3, -3], [8, 0], [4, 5], [-1, 9], [-8, 4], [-10, -3], [-1, -9], [5, -10], [10, -6], [11, 4], [-3, -3]],
      }
    },
  },

  // Course à travers les anneaux lumineux.
  orbit: {
    offset: [0, 44],
    r: 14,
    shape: { lobes: [[0, 0, 11, 0], [-6, -6, 6, 0], [6, -6, 6, 0], [0, 8, 7, 0], [8, 2, 6, 0], [-8, 3, 6, 0], [0, 10, 2.6, 2]] },
    build(ctx) {
      P.landingPad(ctx, 0, 0, { r: 3.5 })
      // Deux pilotes de marbre veillent sur la piste.
      S.useTheme('future')
      for (const sx of [-1, 1]) {
        S.statue(ctx, sx * 5.4, 1.2, { key: sx < 0 ? 'knight' : 'barbarian', anim: 'Cheer', time: sx < 0 ? 0.4 : 0.7, keep: [], height: 2.4, suit: true, rotY: -sx * 0.5, r: 0.85 })
        S.lanternPost(ctx, sx * 3.4, -4.6)
      }
      S.leaves(ctx, 0, 0, { r: 7, inner: 4, count: 100 })
      P.place(ctx, 'racer', 0, 0, { width: 3, y: 0.15, rotY: 0.6, r: 1.4, top: 1 })
      P.antenna(ctx, -10, 7)
      P.antenna(ctx, 10, 7)
      P.holoRing(ctx, 0, 10, { color: 0x6fd3ff })
      P.alienPlant(ctx, -10, -1, { color: 0x6fd3ff })
      P.solarPanel(ctx, 11, -3, { rotY: -1 })
      return {
        type: 'race',
        start: [0, -9],
        time: 22,
        rings: [[7, -6, 1], [10, 1, 2], [6, 8, 2.5], [-2, 10.5, 1.5], [-9, 6, 2.5], [-10, -2, 1.5], [-6, -8, 1]],
      }
    },
  },
}
