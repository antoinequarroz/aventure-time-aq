import * as THREE from 'three'
import { jitter, mat, mesh } from '../helpers.js'
import { model } from '../models.js'
import * as P from '../props.js'
import { fireflies } from '../nature.js'
import * as B from '../buildings.js'
import * as C from '../characters.js'

// Le Passé : royaume médiéval fantastique.

// Relief de l'île principale : prairies à plusieurs lobes, château sur un plateau,
// terrasse de la montagne et autel du cristal (à atteindre en sautant).
export const mainShape = {
  lobes: [
    [0, 2, 15, 0], [12, 2, 10, 0], [-13, 5, 10, 0], [2, 14, 10, 0], [11, 11, 7, 0], [-11, 14, 7, 0], [-11, -10, 8, 0],
    [0, -13, 8.5, 2.4],
    [14, -11, 7.5, 1.2],
    [-14, -6, 4, 1],
  ],
  ramps: [
    [0, -1.2, 0, 0, -5.4, 2.4, 3.4],
    [10.5, -2.5, 0, 12.8, -5.6, 1.2, 2.6],
  ],
  // Chemins de dalles depuis les passerelles, places pavées d'hexagones.
  paths: [
    { pts: [[1.5, 21], [0.6, 13], [0, 6], [0, -0.6]], w: 2.4 },
    { pts: [[-22.5, 4], [-14, 2.6], [-5, 2.4], [-1.5, 2.6]], w: 2 },
    { pts: [[-12.5, -13], [-8, -6], [-3, -1.2]], w: 2 },
    { pts: [[2, 3.4], [9, 0], [10.6, -2.2]], w: 1.8 },
  ],
  plazas: [[0, -7.4, 2.6], [0, 3, 3.2]],
}

export function decorateMain(ctx) {
  const { group, addCollider, animated } = ctx
  const stone = mat(0x9a948a)

  // Château (voir buildings.js).
  B.castle(ctx, 0, -14)

  // Montagne enneigée (ski).
  const mountain = new THREE.Group()
  mountain.add(mesh(jitter(new THREE.ConeGeometry(5, 9, 7, 2), 0.4, 5), mat(0x8c8c96), { x: 16, y: 4.5, z: -12 }))
  mountain.add(mesh(new THREE.ConeGeometry(2.3, 3.2, 7), mat(0xffffff), { x: 16, y: 7.4, z: -12 }))
  group.add(mountain)
  ctx.addFadeable(mountain)
  addCollider(16, -12, 4.6)
  for (const [px, pz, h] of [[11, -16, 4], [20, -7, 3.2], [12, -9, 3.6], [19.5, -15, 2.8]]) P.pine(ctx, px, pz, { height: h, big: h > 3.5, collide: false })

  // But de foot.
  const white = mat(0xffffff)
  const goal = new THREE.Group()
  goal.position.set(-15, 0, 10)
  goal.add(mesh(new THREE.BoxGeometry(0.15, 2, 0.15), white, { x: -1.8, y: 1 }))
  goal.add(mesh(new THREE.BoxGeometry(0.15, 2, 0.15), white, { x: 1.8, y: 1 }))
  goal.add(mesh(new THREE.BoxGeometry(3.75, 0.15, 0.15), white, { y: 2 }))
  goal.rotation.y = Math.PI / 4
  group.add(goal)
  for (const side of [-1, 1]) addCollider(-15 + side * 1.27, 10 - side * 1.27, 0.2)
  // Ballon à pousser jusque dans la cage.
  ctx.addPushable('ball', -12, 8, { goal: [-15, 10, 1.1] })

  // Pierre de foyer façon WoW : cristal flottant et pièces d'or.
  const crystal = mesh(new THREE.OctahedronGeometry(0.8, 0), mat(0x58d0ff, { emissive: 0x2a8fd0, emissiveIntensity: 0.9 }), { x: -13, y: 2.2, z: -9 })
  group.add(crystal, mesh(new THREE.CylinderGeometry(0.8, 1, 0.8, 8), stone, { x: -13, y: 0.4, z: -9 }))
  addCollider(-13, -9, 1)
  const coins = [0, 1, 2].map(() => model('coin', { height: 0.7 }))
  group.add(...coins)
  animated.push((dt, t) => {
    crystal.rotation.y += dt
    crystal.position.y = 2.2 + Math.sin(t * 2) * 0.25
    coins.forEach((coin, i) => {
      const a = t * 0.8 + (i / 3) * Math.PI * 2
      coin.position.set(-13 + Math.cos(a) * 1.8, 1.6 + Math.sin(t * 2 + i) * 0.3, -9 + Math.sin(a) * 1.8)
      coin.rotation.y = t * 3
    })
  })

  // Gardes, armes et canon devant le château.
  // Les gardes font leur ronde devant les portes du château.
  for (const gx of [-3.4, 3.4]) C.npc(ctx, 'barbarian', gx, -9.8, { keep: ['1H_Axe', 'Barbarian_Round_Shield', 'Barbarian_Hat'], rotY: gx > 0 ? -0.3 : 0.3, path: [[gx, -9.8], [gx * 1.6, -8.4], [gx * 0.7, -8]], walk: 1.1, pause: 3 })
  // Mage qui veille sur la pierre de foyer, aubergiste devant la maison.
  C.npc(ctx, 'mage', -11, -6.8, { keep: ['2H_Staff', 'Mage_Hat', 'Mage_Cape'], anim: 'Spellcasting', rotY: Math.PI * 0.85, speed: 0.6 })
  C.npc(ctx, 'barbarian', 5.2, 13.5, { keep: ['Mug'], anim: 'Cheer', rotY: -Math.PI / 2, speed: 0.5, path: [[5.2, 13.5], [3, 10.5], [5, 9]], walk: 0.9, pause: 4 })
  // Un chevalier qui se promène dans le village, et un voyageur sur le chemin.
  C.npc(ctx, 'knight', -2, 9, { keep: ['1H_Sword', 'Knight_Helmet', 'Knight_Cape'], path: [[-2, 9], [-2, 2], [2, 1], [3, 6]], walk: 1.2, pause: 2 })
  C.npc(ctx, 'rogue', 10, 1, { keep: ['Rogue_Cape'], path: [[12, 2], [12, 4], [6, 0.5]], walk: 1.4, pause: 3 })
  P.place(ctx, 'weaponRack', 7.5, -11.5, { height: 1.4, rotY: -0.4, r: 0.8 })
  P.place(ctx, 'cannon', 10, -6.5, { height: 1.3, rotY: 2.4, r: 0.9 })
  P.place(ctx, 'chest', -11, -12.5, { height: 0.9, rotY: 0.6, r: 0.6 })
  // Trophée près du but de foot, cheval près du puits.
  P.place(ctx, 'trophy', -17.5, 13, { height: 1.4, r: 0.6 })
  P.place(ctx, 'horse', 8.5, 3.5, { height: 2, rotY: -1.2, r: 0.9 })
  // Flèches de roche lavande en bordure d'île (Mike).
  P.spires(ctx, -17, -12, { height: 7, count: 5 })
  P.spires(ctx, 16, 14, { height: 4.5, count: 3, spread: 1.1 })
  P.spires(ctx, -8.5, 19.5, { height: 4, count: 3, spread: 1 })
  P.spires(ctx, 19, 5.5, { height: 5, count: 4, spread: 1.2 })

  // Village médiéval autour du château.
  P.well(ctx, 6, 5)
  // Village : maisons à colombages et forge du forgeron.
  B.cottage(ctx, 7.5, 12.5, { rotY: -Math.PI / 2 + 0.3 })
  B.cottage(ctx, -3.2, 17.2, { rotY: Math.PI / 2 + 0.2, wall: 0xcfc2e6, roof: 0x3a3270, w: 3.2, d: 2.8 })
  B.forge(ctx, -7, 13.5, { rotY: 0.4 })
  P.lantern(ctx, -2.5, -9)
  P.lantern(ctx, 2.5, -9)
  // Lanternes à potence le long des chemins, deux d'entre elles éclairent vraiment.
  P.gallowsLantern(ctx, 2.2, 15, { rotY: Math.PI, light: true })
  P.gallowsLantern(ctx, -1.8, 8, { rotY: 0 })
  P.gallowsLantern(ctx, -15, 0.6, { rotY: -Math.PI / 2, light: true })
  P.gallowsLantern(ctx, -9.5, -9.5, { rotY: 0.6 })
  P.gallowsLantern(ctx, -2.2, -4.2, { rotY: 0, color: 0xffa860 })
  P.gallowsLantern(ctx, 2.2, -4.2, { rotY: Math.PI, color: 0xffa860 })
  // Barrières sur le rebord du plateau du château.
  P.rimFence(ctx, 7, 0, 3)
  fireflies(ctx, { count: 90 })
  P.banner(ctx, -6, -10, { color: 0x2f4e8c })
  P.banner(ctx, 6, -10, { color: 0xc0392b })
  // Tonneaux et caisses qu'on pousse.
  ctx.addPushable('barrel', 12, 3)
  ctx.addPushable('barrel', 12.9, 4.2, { rotY: 1 })
  ctx.addPushable('barrel', 13.6, 2.6, { rotY: 2 })
  ctx.addPushable('crate', 11.2, 5.2, { rotY: 0.4 })
  ctx.addPushable('crate', -6, -2.5, { rotY: 0.2 })
  P.flowers(ctx, 13, 12, { r: 1.8 })
  P.rocks(ctx, -19, 10, { count: 4, color: 0x8d89b8 })
  P.rocks(ctx, 12, 15, { count: 3, color: 0x8d89b8 })
  P.mushroom(ctx, -16, 15, { scale: 1.2 })
  P.mushroom(ctx, -14.5, 16.5, { scale: 0.7, cap: 0xb04ad6 })

  // Arbres en nuées de feuilles roses et violettes, buissons et sapins.
  for (const [px, pz, pal, sz] of [[-18, -3, 'pink', 1.1], [-8.5, 18, 'purple', 1], [5, 17, 'pink', 0.9], [-12, 17, 'purple', 0.8], [12, 13.5, 'pink', 1], [17, 8, 'purple', 1.1]]) {
    P.leafTree(ctx, px, pz, { palette: pal, size: sz, height: 2.6 + sz })
  }
  for (const [px, pz] of [[-9, -17], [-15, -7.5], [17, -6], [-19, 7], [9, 17]]) P.pine(ctx, px, pz, { height: 3.6, big: true })
  for (const [bx, bz, pal] of [[4, 11, 'purple'], [-20, 0, 'green'], [14, 9, 'pink'], [-7, 9.5, 'green'], [8.5, -1, 'green'], [-13, 12, 'pink']]) P.bush(ctx, bx, bz, { palette: pal })
}

export const satellites = {
  // Parcours de pierres flottantes jusqu'au coffre.
  ruins: {
    offset: [-32, -34],
    r: 14,
    shape: { lobes: [[0, 2, 11, 0], [6, -8, 8, 0], [-5, -8, 6, 0], [-8, 4, 6, 0], [7, -1, 4, 1]] },
    build(ctx) {
      P.arch(ctx, 1, 4, { rotY: 0.2 })
      P.place(ctx, 'columnBroken', -6, 6, { height: 2.6, r: 0.7 })
      P.place(ctx, 'columnBroken', 6, 5, { height: 2, rotY: 1.3, r: 0.7 })
      P.place(ctx, 'column', 9, 0, { height: 3.6, r: 0.7 })
      P.place(ctx, 'columnBroken', -3, -3, { height: 1.6, rotY: 2.2, r: 0.7 })
      P.place(ctx, 'statue', 5, 9, { height: 3.2, rotY: Math.PI + 0.3, r: 0.8 })
      P.place(ctx, 'wallCorner', -11, 1, { height: 2.4, rotY: 0.9, r: 1.3 })
      P.place(ctx, 'stairs', 0, -7, { height: 1, rotY: Math.PI, r: 0 })
      P.standingStones(ctx, 3, -4, { r: 3 })
      P.crystals(ctx, -10, 7, { color: 0x9b6bff, glow: true })
      P.crystals(ctx, 8, 6, { color: 0x58d0ff, size: 0.8 })
      P.rocks(ctx, -8, -3, { count: 4 })
      P.pine(ctx, 9, 8, { height: 3.5, big: true })
      P.leafTree(ctx, -6, 10, { palette: 'purple' })
      P.bush(ctx, -9, 7, { palette: 'pink' })
      fireflies(ctx, { count: 40 })
      // Coffre au trésor sur la dernière pierre.
      P.place(ctx, 'chest', 11, -7.8, { height: 0.9, y: 6, rotY: Math.PI })
      return {
        type: 'parkour',
        start: [0, 9],
        platformStyle: 'stone',
        platforms: [
          [-4, 4, 0.8, 1.5], [-8, 0, 1.6, 1.3], [-9, -5, 2.4, 1.2], [-6, -10, 3.2, 1.2],
          [-1, -12.5, 4, 1.1], [4, -15, 4.8, 1.1], [8.5, -12, 5.4, 1.1], [11, -7, 6, 1.4],
        ],
        goal: [11, -7, 6],
      }
    },
  },

  // Chasse aux pièces d'or autour du feu de camp.
  camp: {
    offset: [-45, 10],
    r: 13,
    shape: { lobes: [[0, 0, 10, 0], [-6, -6, 7, 0], [5, 6, 6, 0], [-7, 6, 5, 0], [-9, -5, 4, 1.8]] },
    build(ctx) {
      P.campfire(ctx, 0, 0)
      P.tent(ctx, -5, -5, { color: 0xc0392b, rotY: 0.8 })
      P.tent(ctx, -6, 4, { color: 0x2f6fd8, rotY: 2.2 })
      P.tent(ctx, 1, -8, { color: 0x27ae60, rotY: 0 })
      ctx.addPushable('crate', 4, 4)
      ctx.addPushable('crate', 5.2, 3.2, { rotY: 0.5 })
      ctx.addPushable('barrel', 3, 5.5)
      P.place(ctx, 'horse', 9.5, 4.5, { height: 2, rotY: 2.2, r: 0.9 })
      P.place(ctx, 'cannon', 7.5, -5.5, { height: 1.2, rotY: -0.8, r: 0.8 })
      P.place(ctx, 'arenaBanner', -2, -10.5, { height: 2.4, r: 0.4 })
      P.banner(ctx, 6, -5, { color: 0xf1c40f })
      P.lantern(ctx, 2, -3.5)
      P.mushroom(ctx, -9, 8, { scale: 1.4 })
      // Tour de guet (Kenney).
      P.place(ctx, 'tower', -10.5, -4.5, { width: 3.2, rotY: 0.8, r: 1.7, top: 20 })
      for (const [px, pz] of [[-10, 3], [8, 8]]) P.pine(ctx, px, pz, { height: 3.8, big: true })
      for (const [px, pz, pal] of [[3, 10, 'pink'], [-4, 9.5, 'purple'], [-4, -11, 'pink']]) P.leafTree(ctx, px, pz, { palette: pal, size: 0.9 })
      P.gallowsLantern(ctx, 6.5, -1.5, { rotY: Math.PI / 2, light: true })
      fireflies(ctx, { count: 50 })
      return {
        type: 'collect',
        start: [8, -2],
        item: 'coin',
        time: 40,
        items: [[-2, 3], [3, -2], [-8, -1], [-3, -9], [5, -8], [9, 2], [6, 6], [-1, 7], [-8, 9.5], [-10, -9], [0, -4], [-5, 0]],
      }
    },
  },

  // Course autour du lac, entre les bannières.
  lake: {
    offset: [5, 42],
    r: 14,
    shape: { lobes: [[0, 0, 11, 0], [0, -7, 7, 0], [-6, 6, 7, 0], [7, 5, 6, 0], [11, -8, 3.5, 1.2]] },
    build(ctx) {
      P.pond(ctx, 0, 1, { r: 4.5 })
      const boat = P.place(ctx, 'boat', 1, 1.5, { height: 0.6, y: 0.02, rotY: 0.7 })
      ctx.animated.push((dt, t) => { boat.position.y = 0.02 + Math.sin(t * 1.5) * 0.05; boat.rotation.z = Math.sin(t * 1.2) * 0.04 })
      P.place(ctx, 'shipwreck', 11, -8, { width: 4.5, rotY: 0.9, r: 1.8 })
      P.windmill(ctx, -9, 7, { rotY: 0.8 })
      P.flowers(ctx, 6, 8, { r: 2 })
      P.flowers(ctx, -4, 11, { r: 1.5 })
      P.rocks(ctx, 9, -2, { count: 3, size: 0.8 })
      P.leafTree(ctx, 11, 6, { palette: 'pink' })
      P.bush(ctx, -3, -11, { palette: 'purple' })
      P.bush(ctx, 4, -10, { palette: 'green' })
      fireflies(ctx, { count: 50, color: 0xa8fff0 })
      P.pine(ctx, -9.5, -1.5, { height: 3.6, big: true })
      P.pine(ctx, -9, 3, { height: 2.6 })
      for (const [bx, bz, c] of [[6, -7, 0xc0392b], [-6, -6, 0x2f4e8c]]) P.banner(ctx, bx, bz, { color: c })
      return {
        type: 'race',
        start: [-1, -9],
        time: 22,
        rings: [[5, -5], [8.5, 1], [6, 7], [0, 9.5], [-6, 6], [-8.5, -1], [-4, -6]],
      }
    },
  },
}
