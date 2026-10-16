import * as THREE from 'three'
import { makeCharacter, mat, mesh } from '../helpers.js'
import { model, animate } from '../models.js'
import * as P from '../props.js'
import { fireflies } from '../nature.js'

// Le Futur : base lunaire, faible gravité.

// Relief : plaine lunaire découpée, observatoire en hauteur, pont d'atterrissage surélevé.
export const mainShape = {
  lobes: [
    [0, 0, 14, 0], [0, -13, 9, 0], [10, -10, 7, 0], [-13, 2, 8, 0], [13, 3, 8, 0], [3, 14, 8, 0], [-10, 12, 7, 0], [11, 11, 6, 0],
    [-12, -8, 5.5, 1.6],
    [12, -4, 5, 1],
  ],
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

  // Télescope (astronomie).
  const scope = mesh(new THREE.CylinderGeometry(0.22, 0.3, 2, 10), mat(0xeeeeee), { x: -13, y: 1.8, z: -4 })
  scope.rotation.z = 0.8
  group.add(mesh(new THREE.ConeGeometry(0.6, 1.4, 3), mat(0x444444), { x: -13, y: 0.7, z: -4 }), scope)
  addCollider(-13, -4, 0.7)

  // Cosmonaute qui flotte.
  const astronaut = makeCharacter({ body: 0xf4f4f4, legs: 0xdadada, skin: 0xf1c27d, helmet: 0xa8d8ff })
  astronaut.position.set(-4, 0, 3)
  group.add(astronaut)
  addCollider(-4, 3, 0.8)
  animated.push((dt, t) => {
    astronaut.position.y = Math.abs(Math.sin(t * 1.3)) * 0.6
    astronaut.rotation.y = t * 0.4
    astronaut.userData.limbs.armR.rotation.z = 2.6 + Math.sin(t * 5) * 0.4
  })

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
  P.spires(ctx, 18, 4, { height: 6, count: 4, color: 0x7f78e0, glow: 0x3fe8ff, spread: 1.2 })
  P.spires(ctx, -14, 15, { height: 4.5, count: 3, color: 0x9a7bf0, glow: 0xff5fd0, spread: 1 })
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
    shape: { lobes: [[0, 2, 9, 0], [5, -5, 6, 0], [-5, -4, 5, 0]] },
    build(ctx) {
      P.crystals(ctx, -6, 4, { color: 0x58d0ff })
      P.antenna(ctx, 5, 5)
      crater(ctx, 4, -2, 2)
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
