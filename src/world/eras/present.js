import * as THREE from 'three'
import { mat, mesh } from '../helpers.js'
import { model, animate } from '../models.js'
import * as P from '../props.js'

// Le Présent : le village du développeur.

export function decorateMain(ctx) {
  const { group, addCollider, animated } = ctx

  // Place pavée avec fontaine.
  group.add(mesh(new THREE.CylinderGeometry(7, 7, 0.1, 32), mat(0xc9c2b4), { y: 0.05, shadow: false }), model('fountain', { width: 4.5, y: 0.05 }))
  addCollider(0, 0, 2.3)

  // Maisons du village (Kenney City Builder), tournées vers la place.
  for (const [key, x, z] of [['houseA', -14, -10], ['houseC', 14, -10], ['houseB', -15, 12], ['houseD', 15, 12]]) {
    const house = model(key, { width: 5, x, z, rotY: Math.atan2(-x, -z) })
    group.add(house)
    ctx.addFadeable(house)
    addCollider(x, z, 3.1)
  }
  group.add(model('garage', { width: 5, x: 8, z: -17, rotY: Math.PI * 0.85 }))
  addCollider(8, -17, 3)

  // Le développeur à son bureau, sur la place.
  const desk = mesh(new THREE.BoxGeometry(2.2, 0.15, 1.1), mat(0x8a5a32), { x: 0, y: 1, z: -13 })
  const legs = [[-1, -0.45], [1, -0.45], [-1, 0.45], [1, 0.45]].map(([dx, dz]) => mesh(new THREE.BoxGeometry(0.1, 1, 0.1), mat(0x5a3a22), { x: dx, y: 0.5, z: -13 + dz }))
  const screen = mesh(new THREE.BoxGeometry(1.2, 0.75, 0.06), mat(0x111111), { x: 0, y: 1.55, z: -13.3 })
  const glow = mesh(new THREE.PlaneGeometry(1.1, 0.65), new THREE.MeshBasicMaterial({ color: 0x5fd0ff }), { x: 0, y: 1.55, z: -13.26, shadow: false })
  const glowLight = new THREE.PointLight(0x5fd0ff, 4, 5)
  glowLight.position.set(0, 1.6, -12.8)
  const dev = model('character', { height: 2, x: 0, z: -12, rotY: Math.PI })
  const { mixer } = animate(dev, 'idle')
  group.add(desk, ...legs, screen, glow, glowLight, dev)
  addCollider(0, -12.8, 1.6)
  animated.push((dt, t) => {
    mixer.update(dt)
    glow.material.color.setHSL(0.55, 0.8, 0.55 + Math.sin(t * 4) * 0.08)
  })

  // Mobilier urbain.
  for (const [lx, lz] of [[-6, -6], [6, -6], [-6, 6], [6, 6]]) P.streetLamp(ctx, lx, lz)
  P.bench(ctx, -3, 7.6, { rotY: Math.PI })
  P.bench(ctx, 3, -7.6)
  P.trashBin(ctx, 4.6, 7.6)
  P.trashBin(ctx, -4.6, -7.6)
  P.cafe(ctx, 10, -5)
  P.billboard(ctx, -5.5, -19, { text: 'antoinequarroz.ch' })
  P.parkedCar(ctx, -11, -17, { rotY: 0.3, kind: 'sedan' })
  P.parkedCar(ctx, 13.5, -1.5, { rotY: Math.PI / 2 + 0.1, kind: 'taxi' })
  P.place(ctx, 'turbine', -18.5, -11, { height: 9, rotY: 0.6, r: 0.7 })
  P.solarPanel(ctx, 16, -16, { rotY: -0.6 })
  P.flowers(ctx, 0, 16, { r: 2.2 })
  P.flowers(ctx, -18, 6, { r: 1.4 })
  P.flowers(ctx, 18, 8, { r: 1.4 })

  for (const [px, pz, pine] of [[-18, -6, 1], [19, 5, 0], [-7, -14.5, 0], [-7, 18, 1], [7, 18, 0], [19, -4, 1], [-19, 5, 0]]) {
    P.tree(ctx, px, pz, { pine, leaves: pine ? 0x2f7a52 : 0x5aa83a, scale: pine ? 1.1 : 1 })
  }
}

export const satellites = {
  // Parcours de caisses et de toits jusqu'au drapeau.
  rooftops: {
    offset: [0, -44],
    r: 14,
    build(ctx) {
      P.streetLamp(ctx, 4, 10)
      P.streetLamp(ctx, -4, 10)
      P.billboard(ctx, -8, 8, { text: 'Code · Café · Commit', rotY: 0.5 })
      P.trashBin(ctx, 6, 6)
      P.cargo(ctx, 9, 7, { color: 0x2f6fd8, rotY: 1.2 })
      P.solarPanel(ctx, -11, -6, { rotY: 1 })
      P.tree(ctx, 12, 1)
      P.parkedCar(ctx, 7, 3, { rotY: 0.4, kind: 'taxi' })
      P.tree(ctx, -2, -4, { pine: true, leaves: 0x2f7a52 })
      // Drapeau d'arrivée sur le dernier toit.
      ctx.group.add(mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.2, 6), mat(0xdddddd), { x: 9, y: 6.3 + 1.1, z: -4 }))
      const flag = mesh(new THREE.PlaneGeometry(1, 0.6), mat(0x6fd3ff, { side: THREE.DoubleSide, emissive: 0x6fd3ff, emissiveIntensity: 0.6 }), { x: 9.5, y: 6.3 + 1.8, z: -4, shadow: false })
      ctx.group.add(flag)
      ctx.animated.push((dt, t) => { flag.rotation.y = Math.sin(t * 3) * 0.3 })
      return {
        type: 'parkour',
        start: [0, 9],
        platformStyle: 'rooftop',
        platforms: [
          [-4, 5, 0.9, 1.2], [-8, 1, 1.8, 1.3], [-9, -4, 2.7, 1.5], [-5, -8, 3.6, 1.5],
          [0, -10, 4.5, 1.6], [5, -8, 5.4, 1.5], [9, -4, 6.3, 1.6],
        ],
        goal: [9, -4, 6.3],
      }
    },
  },

  // Chasse aux bugs dans le parc.
  park: {
    offset: [24, 40],
    r: 13,
    build(ctx) {
      P.pond(ctx, 2, 2, { r: 3 })
      P.bench(ctx, -3, -2, { rotY: Math.PI / 2 })
      P.bench(ctx, 6, -3, { rotY: -0.5 })
      P.streetLamp(ctx, -1, -6)
      P.streetLamp(ctx, 7, 5)
      P.trashBin(ctx, -4, -4)
      P.flowers(ctx, -6, 5, { r: 2 })
      P.flowers(ctx, 8, -7, { r: 1.5 })
      P.cafe(ctx, -6, -8, { color: 0x27ae60 })
      P.place(ctx, 'ferrisWheel', -8.5, 3, { height: 7.5, rotY: Math.PI / 2, r: 1.6, top: 10 })
      P.place(ctx, 'turbine', 9.5, -9, { height: 8, rotY: -0.6, r: 0.6 })
      for (const [px, pz, pine] of [[0, 10, 1], [5, 9, 0], [10, 1, 1], [-3, 8, 0]]) P.tree(ctx, px, pz, { pine, leaves: pine ? 0x2f7a52 : 0x5aa83a })
      return {
        type: 'collect',
        start: [-4, -10.5],
        item: 'bug',
        time: 40,
        items: [[-6, 2], [-1, 5], [4, 6], [8, 2], [6, -6], [1, -3], [-8, -4], [-2, -9], [3, -9.5], [-8, 8], [10, -4], [-3, 2]],
      }
    },
  },

  // Tour du stade de foot.
  stadium: {
    offset: [-24, 40],
    r: 14,
    build(ctx) {
      P.footballPitch(ctx, 0, 0)
      P.bleachers(ctx, 0, 9.5, { w: 10, rotY: Math.PI })
      for (const [lx, lz] of [[-11, -7], [11, -7], [-11, 7], [11, 7]]) P.streetLamp(ctx, lx, lz, { color: 0xffffff })
      P.banner(ctx, -8, -10, { color: 0x2f6fd8 })
      P.banner(ctx, 8.5, -10, { color: 0xe74c3c })
      ctx.group.add(mesh(new THREE.IcosahedronGeometry(0.35, 1), mat(0xffffff), { x: 1.5, y: 0.35, z: 1 }))
      P.place(ctx, 'trophy', -11.5, 0, { height: 1.4, r: 0.6 })
      return {
        type: 'race',
        start: [5, -9.5],
        time: 25,
        rings: [[10, -3], [10, 4], [3, 6.8], [-4, 6.8], [-10, 4], [-10, -3], [-3, -7]],
      }
    },
  },
}
