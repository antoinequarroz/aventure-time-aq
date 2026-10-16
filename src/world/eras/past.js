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
  ctx.addFadeable(castle)
  addCollider(0, -14, 5.5)
  for (const [tx, tz] of [[-4.5, -3], [4.5, -3], [-4.5, 3], [4.5, 3]]) addCollider(tx, -14 + tz, 1.4)

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

  // Gardes, armes et canon devant le château.
  for (const gx of [-1.7, 1.7]) P.place(ctx, 'soldier', gx, -10.4, { height: 1.7, r: 0.5 })
  P.place(ctx, 'weaponRack', 7.5, -11.5, { height: 1.4, rotY: -0.4, r: 0.8 })
  P.place(ctx, 'cannon', 10, -6.5, { height: 1.3, rotY: 2.4, r: 0.9 })
  P.place(ctx, 'chest', -11, -12.5, { height: 0.9, rotY: 0.6, r: 0.6 })
  // Trophée près du but de foot, cheval près du puits.
  P.place(ctx, 'trophy', -17.5, 13, { height: 1.4, r: 0.6 })
  P.place(ctx, 'horse', 8.5, 3.5, { height: 2, rotY: -1.2, r: 0.9 })
  // Falaises en bordure d'île.
  P.cliff(ctx, -19, -10, { height: 5, rotY: 0.4 })
  P.cliff(ctx, 19, 12, { height: 3.5, small: true, rotY: 2 })
  P.cliff(ctx, -8, 19.5, { height: 3, small: true, rotY: 1 })

  // Village médiéval autour du château.
  P.well(ctx, 5, 2)
  P.lantern(ctx, -2.5, -9)
  P.lantern(ctx, 2.5, -9)
  P.banner(ctx, -6, -10, { color: 0x2f4e8c })
  P.banner(ctx, 6, -10, { color: 0xc0392b })
  P.place(ctx, 'barrel', 12, 3, { height: 1, r: 0.5 })
  P.place(ctx, 'barrel', 12.9, 4.2, { height: 1, rotY: 1, r: 0.5 })
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
      P.place(ctx, 'columnBroken', -6, 6, { height: 2.6, r: 0.7 })
      P.place(ctx, 'columnBroken', 6, 5, { height: 2, rotY: 1.3, r: 0.7 })
      P.place(ctx, 'column', 9, 0, { height: 3.6, r: 0.7 })
      P.place(ctx, 'columnBroken', -3, -3, { height: 1.6, rotY: 2.2, r: 0.7 })
      P.place(ctx, 'statue', 5, 9, { height: 3.2, rotY: Math.PI + 0.3, r: 0.8 })
      P.place(ctx, 'wallCorner', -11, 1, { height: 2.4, rotY: 0.9, r: 1.3 })
      P.place(ctx, 'stairs', 0, -7, { height: 1, rotY: Math.PI, r: 0 })
      P.standingStones(ctx, 3, -4, { r: 3 })
      P.crystals(ctx, -10, 7, { color: 0x9b6bff, glow: true })
      P.crystals(ctx, 10, 7, { color: 0x58d0ff, size: 0.8 })
      P.rocks(ctx, -11, -3, { count: 4 })
      P.pine(ctx, 9, 8, { height: 3.5, big: true })
      P.tree(ctx, -8, 11, { leaves: 0x4c8a30 })
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
    build(ctx) {
      P.campfire(ctx, 0, 0)
      P.tent(ctx, -5, -5, { color: 0xc0392b, rotY: 0.8 })
      P.tent(ctx, -6, 4, { color: 0x2f6fd8, rotY: 2.2 })
      P.tent(ctx, 1, -8, { color: 0x27ae60, rotY: 0 })
      P.crate(ctx, 4, 4)
      P.crate(ctx, 5, 3.4, { size: 0.7, rotY: 0.5 })
      P.place(ctx, 'barrel', 3, 5.5, { height: 1, r: 0.5 })
      P.place(ctx, 'horse', 9.5, 4.5, { height: 2, rotY: 2.2, r: 0.9 })
      P.place(ctx, 'cannon', 9.5, -6, { height: 1.2, rotY: -0.8, r: 0.8 })
      P.place(ctx, 'arenaBanner', -2, -10.5, { height: 2.4, r: 0.4 })
      P.banner(ctx, 6, -5, { color: 0xf1c40f })
      P.lantern(ctx, 2, -3.5)
      P.mushroom(ctx, -9, 8, { scale: 1.4 })
      // Tour de guet (Kenney).
      P.place(ctx, 'tower', -10.5, -4.5, { width: 3.2, rotY: 0.8, r: 1.7, top: 20 })
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
      const boat = P.place(ctx, 'boat', 1, 1.5, { height: 0.6, y: 0.02, rotY: 0.7 })
      ctx.animated.push((dt, t) => { boat.position.y = 0.02 + Math.sin(t * 1.5) * 0.05; boat.rotation.z = Math.sin(t * 1.2) * 0.04 })
      P.place(ctx, 'shipwreck', 10.5, -8.5, { width: 4.5, rotY: 0.9, r: 1.8 })
      P.windmill(ctx, -9, 7, { rotY: 0.8 })
      P.flowers(ctx, 8, 9, { r: 2 })
      P.flowers(ctx, -4, 11, { r: 1.5 })
      P.rocks(ctx, 11, -3, { count: 3, size: 0.8 })
      P.tree(ctx, 11, 6)
      P.pine(ctx, -12, -2, { height: 3.6, big: true })
      P.pine(ctx, -11.5, 1.5, { height: 2.6 })
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
