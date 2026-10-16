import * as THREE from 'three'
import { jitter, mat, mesh } from '../helpers.js'
import { model } from '../models.js'
import * as P from '../props.js'

// Le Passé : royaume médiéval fantastique.

export function decorateMain(ctx) {
  const { group, addCollider, animated } = ctx
  const stone = mat(0x9a948a)
  const roof = mat(0x2f4e8c)

  // Château.
  const castle = new THREE.Group()
  castle.position.set(0, 0, -14)
  castle.add(mesh(new THREE.BoxGeometry(6, 7, 5), stone, { y: 3.5 }), mesh(new THREE.ConeGeometry(4.3, 3.5, 4), roof, { y: 8.75 }))
  for (const [tx, tz] of [[-4.5, -3], [4.5, -3], [-4.5, 3], [4.5, 3]]) {
    castle.add(mesh(new THREE.CylinderGeometry(1.2, 1.3, 8, 10), stone, { x: tx, y: 4, z: tz }))
    castle.add(mesh(new THREE.ConeGeometry(1.6, 2.5, 10), roof, { x: tx, y: 9.25, z: tz }))
    // Créneaux.
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2
      castle.add(mesh(new THREE.BoxGeometry(0.4, 0.5, 0.4), stone, { x: tx + Math.cos(a) * 1.15, y: 8.1, z: tz + Math.sin(a) * 1.15 }))
    }
  }
  castle.add(mesh(new THREE.BoxGeometry(1.8, 2.6, 0.3), mat(0x4a2e18), { y: 1.3, z: 2.6 }))
  for (const wx of [-1.6, 1.6]) castle.add(mesh(new THREE.BoxGeometry(0.6, 0.9, 0.1), mat(0xffd27a, { emissive: 0xffb347, emissiveIntensity: 1.5 }), { x: wx, y: 4.8, z: 2.55, shadow: false }))
  const flag = mesh(new THREE.PlaneGeometry(1.4, 0.8), mat(0xc0392b, { side: THREE.DoubleSide }), { x: 0.75, y: 11.6, z: 0 })
  castle.add(mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.5, 5), mat(0x333333), { y: 11.3 }), flag)
  animated.push((dt, t) => { flag.rotation.y = Math.sin(t * 2) * 0.3 })
  group.add(castle)
  addCollider(0, -14, 5.5)
  for (const [tx, tz] of [[-4.5, -3], [4.5, -3], [-4.5, 3], [4.5, 3]]) addCollider(tx, -14 + tz, 1.4)

  // Montagne enneigée (ski).
  group.add(mesh(jitter(new THREE.ConeGeometry(5, 9, 7, 2), 0.4, 5), mat(0x8c8c96), { x: 16, y: 4.5, z: -12 }))
  group.add(mesh(new THREE.ConeGeometry(2.3, 3.2, 7), mat(0xffffff), { x: 16, y: 7.4, z: -12 }))
  addCollider(16, -12, 4.6)
  for (const [px, pz] of [[11, -16], [20, -7], [12, -9]]) P.tree(ctx, px, pz, { pine: true, leaves: 0x2d5a3a, scale: 0.8, collide: false })

  // But de foot.
  const white = mat(0xffffff)
  const goal = new THREE.Group()
  goal.position.set(-15, 0, 10)
  goal.add(mesh(new THREE.BoxGeometry(0.15, 2, 0.15), white, { x: -1.8, y: 1 }))
  goal.add(mesh(new THREE.BoxGeometry(0.15, 2, 0.15), white, { x: 1.8, y: 1 }))
  goal.add(mesh(new THREE.BoxGeometry(3.75, 0.15, 0.15), white, { y: 2 }))
  goal.rotation.y = Math.PI / 4
  group.add(goal, mesh(new THREE.IcosahedronGeometry(0.3, 1), mat(0xf5f5f5), { x: -12, y: 0.3, z: 8 }))

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

  // Village médiéval autour du château.
  P.well(ctx, 5, 2)
  P.lantern(ctx, -2.5, -9)
  P.lantern(ctx, 2.5, -9)
  P.banner(ctx, -6, -10, { color: 0x2f4e8c })
  P.banner(ctx, 6, -10, { color: 0xc0392b })
  P.barrel(ctx, 12, 3)
  P.barrel(ctx, 12.8, 4.2)
  P.crate(ctx, 11.4, 5, { rotY: 0.4 })
  P.crate(ctx, 11.4, 5, { size: 0.6, y: 0.9, rotY: 0.9 })
  P.flowers(ctx, -5, 13, { r: 2.2 })
  P.flowers(ctx, 13, 12, { r: 1.8 })
  P.rocks(ctx, -19, 10, { count: 4 })
  P.rocks(ctx, 15, 17, { count: 3 })
  P.mushroom(ctx, -16, 15, { scale: 1.2 })
  P.mushroom(ctx, -14.5, 16.5, { scale: 0.7, cap: 0xb04ad6 })

  for (const [px, pz] of [[-18, -3], [-9, -17], [-6, 17], [3, 17], [-12, 16], [12, 14], [16, 7], [-3, 12]]) {
    P.tree(ctx, px, pz, { leaves: [0x3f7d2a, 0x4c8a30, 0x356e25][Math.abs(px + pz) % 3] })
  }
}

export const satellites = {
  // Parcours de pierres flottantes jusqu'au coffre.
  ruins: {
    offset: [-8, -45],
    r: 14,
    build(ctx) {
      P.arch(ctx, 1, 4, { rotY: 0.2 })
      P.ruinColumn(ctx, -6, 6, { h: 3 })
      P.ruinColumn(ctx, 6, 5, { h: 2 })
      P.ruinColumn(ctx, 9, 0, { h: 3.5, broken: false })
      P.ruinColumn(ctx, -3, -3, { h: 1.6 })
      P.standingStones(ctx, 3, -4, { r: 3 })
      P.crystals(ctx, -10, 7, { color: 0x9b6bff, glow: true })
      P.crystals(ctx, 10, 7, { color: 0x58d0ff, size: 0.8 })
      P.rocks(ctx, -11, -3, { count: 4 })
      P.tree(ctx, 6, 10, { pine: true, leaves: 0x2d5a3a })
      P.tree(ctx, -8, 11, { leaves: 0x4c8a30 })
      // Coffre au trésor sur la dernière pierre.
      const chest = new THREE.Group()
      chest.position.set(11, 6, -7)
      chest.add(mesh(new THREE.BoxGeometry(1.2, 0.7, 0.8), mat(0x8a5a32), { y: 0.35 }))
      chest.add(mesh(new THREE.CylinderGeometry(0.4, 0.4, 1.2, 10, 1, false, 0, Math.PI), mat(0xa0703f), { y: 0.7 }).rotateZ(Math.PI / 2))
      chest.add(mesh(new THREE.BoxGeometry(0.2, 0.25, 0.05), mat(0xf1c40f, { emissive: 0xf1c40f, emissiveIntensity: 1 }), { y: 0.55, z: 0.42 }))
      ctx.group.add(chest)
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
    build(ctx) {
      P.campfire(ctx, 0, 0)
      P.tent(ctx, -5, -5, { color: 0xc0392b, rotY: 0.8 })
      P.tent(ctx, -6, 4, { color: 0x2f6fd8, rotY: 2.2 })
      P.tent(ctx, 1, -8, { color: 0x27ae60, rotY: 0 })
      P.crate(ctx, 4, 4)
      P.crate(ctx, 5, 3.4, { size: 0.7, rotY: 0.5 })
      P.barrel(ctx, 3, 5.5)
      P.banner(ctx, 6, -5, { color: 0xf1c40f })
      P.lantern(ctx, 2, -3.5)
      P.mushroom(ctx, -9, 8, { scale: 1.4 })
      P.rocks(ctx, -10, -6, { count: 3 })
      for (const [px, pz] of [[-11, 2], [3, 10], [-3, 11], [8, 8], [-4, -11]]) P.tree(ctx, px, pz, { pine: px % 2 === 0, leaves: 0x356e25 })
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
    build(ctx) {
      P.pond(ctx, 0, 1, { r: 4.5 })
      P.windmill(ctx, -9, 7, { rotY: 0.8 })
      P.flowers(ctx, 8, 9, { r: 2 })
      P.flowers(ctx, -4, 11, { r: 1.5 })
      P.rocks(ctx, 11, -3, { count: 3, size: 0.8 })
      P.tree(ctx, 11, 6)
      P.tree(ctx, -12, -2, { pine: true, leaves: 0x2d5a3a })
      for (const [bx, bz, c] of [[6, -7, 0xc0392b], [-7, -7, 0x2f4e8c]]) P.banner(ctx, bx, bz, { color: c })
      return {
        type: 'race',
        start: [-1, -9],
        time: 22,
        rings: [[5, -5], [8.5, 1], [6, 7], [0, 9.5], [-6, 6], [-8.5, -1], [-4, -6]],
      }
    },
  },
}
