import * as THREE from 'three'
import { mat, mesh } from '../helpers.js'
import { model } from '../models.js'
import * as C from '../characters.js'
import * as P from '../props.js'
import { textTexture } from '../helpers.js'
import * as S from '../stoneworks.js'
import { photoStudio, videoStudio, gitCafe, gitGraphSculpture, foodTruck, bikeRack } from '../studios.js'

// Le Présent : le village du développeur.

// Relief : place centrale en bas, deux quartiers en hauteur au nord reliés par des escaliers.
export const mainShape = {
  lobes: [
    [0, 0, 15, 0], [0, -14, 9.5, 0], [-14, 3, 9, 0], [14, 3, 9, 0], [-12, 13, 8, 0], [12, 13, 8, 0], [0, 15, 7, 0],
    [-13, -10, 7, 2], [13, -10, 7, 2],
  ],
  ramps: [
    [-4.5, -8.8, 0, -7.6, -9.6, 2, 2.6],
    [4.5, -8.8, 0, 7.6, -9.6, 2, 2.6],
  ],
}

export function decorateMain(ctx) {
  const { group, addCollider, animated } = ctx

  // Place dallée (texture du sol) avec fontaine.
  group.add(model('fountain', { width: 4.5, y: 0.02 }))
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

  // Habitants qui flânent autour de la fontaine.
  C.npc(ctx, 'mage', 4.2, 4.2, { keep: [], path: [[4.2, 4.2], [-4.2, 4.2], [-4.2, -4.2], [4.2, -4.2]], walk: 1.2, pause: 1.5, talk: 'villager' })
  C.npc(ctx, 'knight', -2, 11, { keep: [], path: [[-2, 11], [2, 10], [0, 6.5]], walk: 1, pause: 3, talk: 'gardener' })
  C.npc(ctx, 'rogue', -7, -3, { keep: [], path: [[-7, -3], [-8, 3], [-5, 7], [-3, 1]], walk: 1, pause: 4, talk: 'tourist' })
  C.npc(ctx, 'barbarian', 9, -3, { keep: ['Mug'], anim: 'Cheer', speed: 0.4, talk: 'coffee-lover', path: [[9.5, -2.5], [10, 0]], walk: 0.8, pause: 5 })
  // Petit jardin au pied des escaliers, là où se trouvait le bureau en plein air.
  P.leafTree(ctx, -2.6, -13.6, { palette: 'yellow', size: 0.85, height: 3 })
  P.leafTree(ctx, 2.8, -14.2, { palette: 'pink', size: 0.8, height: 2.8 })
  P.flowers(ctx, 0, -12.6, { r: 1.6, count: 30 })
  P.bench(ctx, 0, -15.6)

  // Statues de grès autour de la fontaine : le développeur et le formateur.
  S.useTheme('present')
  S.statue(ctx, -6.8, -2.4, { key: 'rogue', anim: 'Interact', time: 0.7, keep: ['Rogue_Cape'], height: 2.3, rotY: 0.5, r: 0.8 })
  S.statue(ctx, 6.8, -2.4, { key: 'mage', anim: 'Idle', time: 0.3, keep: ['Spellbook_open'], height: 2.3, rotY: -0.5, r: 0.8 })
  for (const sx of [-1, 1]) S.leaves(ctx, sx * 6.8, -2.4, { r: 2.4, inner: 1.1, count: 40 })

  // Mobilier urbain.
  for (const [lx, lz] of [[-6, -6], [6, -6], [-6, 6], [6, 6]]) P.streetLamp(ctx, lx, lz)
  P.bench(ctx, -3, 7.6, { rotY: Math.PI })
  P.bench(ctx, 3, -7.6)
  P.trashBin(ctx, 4.6, 7.6)
  P.trashBin(ctx, -4.6, -7.6)
  P.cafe(ctx, 10, -5)
  // Nouveaux venus sur la place : un food truck de glaces et des vélos.
  foodTruck(ctx, -11.5, 1.2, { rotY: 0.35 })
  bikeRack(ctx, 10.6, 2.4, { rotY: -0.35 })
  P.parkedCar(ctx, -12, -13, { rotY: 0.3, kind: 'sedan' })
  P.parkedCar(ctx, 13.5, -1.5, { rotY: Math.PI / 2 + 0.1, kind: 'taxi' })
  P.place(ctx, 'turbine', -18.5, -11, { height: 9, rotY: 0.6, r: 0.7 })
  P.solarPanel(ctx, 16, -16, { rotY: -0.6 })
  P.flowers(ctx, -18, 6, { r: 1.4 })
  P.flowers(ctx, 18, 8, { r: 1.4 })

  // Arbres et buissons en nuées de feuilles, façon Bruno Simon.
  for (const [px, pz, pal, sz] of [[-18, -6, 'orange', 1.1], [19, 5, 'pink', 1], [-7, -15, 'yellow', 0.9], [-8, 18, 'pink', 1], [8, 18.5, 'orange', 1], [19, -4, 'yellow', 1], [-19, 5, 'pink', 1.1]]) {
    P.leafTree(ctx, px, pz, { palette: pal, size: sz, height: 2.6 + sz })
  }
  for (const [bx, bz, pal] of [[-9, 2, 'yellow'], [9, 2.5, 'yellow'], [-17, 10, 'green'], [17, 14, 'pink'], [-3, 19, 'yellow'], [16, -7, 'green'], [-10, -5, 'orange']]) P.bush(ctx, bx, bz, { palette: pal, size: 1.1 })

  // Piste de bowling : quilles à renverser et panneau néon « STRIKE ! ».
  for (const x of [-1.8, 1.8]) group.add(mesh(new THREE.BoxGeometry(0.12, 0.04, 7), mat(0xd96bff, { emissive: 0xc04dff, emissiveIntensity: 2.2 }), { x, y: 0.03, z: 12.5, shadow: false }))
  const rows = [[0], [-0.38, 0.38], [-0.76, 0, 0.76], [-1.14, -0.38, 0.38, 1.14]]
  rows.forEach((row, k) => row.forEach((x) => ctx.addPushable('pin', x, 15.6 + k * 0.66, { group: 'bowling' })))
  const sign = new THREE.Group()
  // À côté de la piste, tourné vers la caméra.
  sign.position.set(4.6, 0, 17.5)
  sign.rotation.y = -0.45
  const board = mesh(new THREE.BoxGeometry(4.2, 2, 0.25), mat(0x1a1530), { y: 2.2 })
  const face = mesh(new THREE.PlaneGeometry(3.8, 1.6), new THREE.MeshBasicMaterial({ map: textTexture('STRIKE !', { bg: '#1a1530', fg: '#f3e8ff', font: 'bold 92px "Inter Variable", system-ui, sans-serif' }) }), { y: 2.2, z: 0.14, shadow: false })
  const frame = mesh(new THREE.BoxGeometry(4.4, 2.2, 0.1), mat(0xd96bff, { emissive: 0xc04dff, emissiveIntensity: 2.5 }), { y: 2.2, z: -0.05, shadow: false })
  for (const x of [-1.5, 1.5]) sign.add(mesh(new THREE.BoxGeometry(0.2, 1.3, 0.2), mat(0x333344), { x, y: 0.65 }))
  sign.add(frame, board, face)
  group.add(sign)
  addCollider(4.6, 17.5, 1.8)
}

export const satellites = {
  // Parcours de caisses et de toits jusqu'au drapeau.
  rooftops: {
    offset: [0, -44],
    r: 14,
    // À l'ouest : l'Atelier web (grand écran) et, devant, la terrasse du GitHub Café.
    shape: { lobes: [[0, 2, 10, 0], [-6, -6, 7, 0], [6, -7, 7, 0], [0, -10, 5, 0], [-6, 7, 5, 0], [9, 1, 3, 1], [-18, 4, 7.5, 0], [-11.5, 5, 4.5, 0], [-13, 15.5, 5.8, 0], [-8, 12, 4, 0]], plazas: [[1.5, 0, 4.2], [-18, 4, 6.2]] },
    build(ctx) {
      // Monument au code, en grès, au milieu des toits.
      S.useTheme('present')
      S.monument(ctx, 1.5, -0.2, { piece: (c, x, z) => S.codeGlyph(c, x, z), r: 3, pillars: 4, spread: 1.1 })
      P.streetLamp(ctx, 4, 10)
      P.streetLamp(ctx, -4, 10)
      gitCafe(ctx, -13, 15.5)
      gitGraphSculpture(ctx, -7.6, 11.2, { rotY: 0.3 })
      P.trashBin(ctx, 6, 6)
      P.cargo(ctx, 6.5, 6, { color: 0x2f6fd8, rotY: 1.2 })
      P.solarPanel(ctx, -11, -6, { rotY: 1 })
      P.leafTree(ctx, 9, 1, { palette: 'orange' })
      P.parkedCar(ctx, 7, 3, { rotY: 0.4, kind: 'taxi' })
      P.bush(ctx, -2, -4, { palette: 'yellow' })
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
    // À l'est : la place du photographe et, au nord, le studio photo.
    shape: { lobes: [[0, 0, 10, 0], [-6, -5, 6, 0], [5, 6, 7, 0], [-6, 6, 5, 0], [7, -6, 4.5, 1], [13.5, 4.5, 5.5, 0], [18.5, -5.5, 6.8, 0]], plazas: [[13.5, 4.5, 4.4]] },
    build(ctx) {
      P.pond(ctx, 2, 2, { r: 3 })
      // Place de la photo : le photographe en grès et un appareil géant.
      S.useTheme('present')
      S.monument(ctx, 14.2, 3.6, { statue: { key: 'rogue', anim: 'Interact', time: 0.7, keep: ['Rogue_Cape'], height: 2.5, rotY: -0.5 }, open: Math.PI * 0.85, r: 3, pillars: 4, spread: 1.1, crates: false })
      S.cameraSculpture(ctx, 12, 6.8, { rotY: -0.6 })
      S.stoneBench(ctx, 15.5, 7.6, { rotY: -0.9 })
      photoStudio(ctx, 18.5, -6)
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
      for (const [px, pz, pal] of [[0, 10, 'pink'], [5, 9, 'yellow'], [9, 3, 'orange'], [-3, 8, 'pink']]) P.leafTree(ctx, px, pz, { palette: pal, size: 0.9 })
      P.bush(ctx, -2, 4.5, { palette: 'yellow' })
      P.bush(ctx, 6, 0.5, { palette: 'pink' })
      C.npc(ctx, 'rogue', -2, -2, { keep: [], path: [[-2, -2], [-1, 6], [5, 5], [5, -1]], walk: 1.1, pause: 2, talk: 'jogger' })
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
    // À l'ouest : le studio vidéo, à côté du terrain.
    shape: { lobes: [[0, 0, 12, 0], [-7, -6, 7, 0], [7, -6, 7, 0], [0, 8, 8, 0], [10, 8, 3, 1.4], [-11, 11, 5, 0], [-17.5, -2.5, 6.8, 0]], plazas: [[-11, 11, 4]] },
    build(ctx) {
      P.footballPitch(ctx, 0, 0)
      // Hall of fame : le buteur en grès et le ballon géant.
      S.useTheme('present')
      S.monument(ctx, -11.6, 11, { statue: { key: 'barbarian', anim: 'Cheer', time: 0.45, keep: [], height: 2.6, rotY: 0.4 }, open: Math.PI * 0.3, r: 2.8, pillars: 4, spread: 1.1, crates: false })
      S.ballSculpture(ctx, -8.4, 13.6)
      videoStudio(ctx, -17.5, -3)
      P.bleachers(ctx, 0, 9.5, { w: 10, rotY: Math.PI })
      for (const [lx, lz] of [[-11, -7], [11, -7], [-9, 6.5], [11, 7]]) P.streetLamp(ctx, lx, lz, { color: 0xffffff })
      P.banner(ctx, -8, -10, { color: 0x2f6fd8 })
      P.banner(ctx, 8.5, -10, { color: 0xe74c3c })
      ctx.addPushable('ball', 1.5, 1, { goals: [[-8.3, 0, 1.3], [8.3, 0, 1.3]] })
      P.place(ctx, 'trophy', 10, 8.5, { height: 1.4, r: 0.6 })
      // Un joueur qui s'échauffe autour du terrain.
      C.npc(ctx, 'barbarian', -9, -6, { keep: [], path: [[-9, -6], [9, -6], [9, 5], [-9, 5]], walk: 2.4, pause: 1, talk: 'footballer' })
      return {
        type: 'race',
        start: [5, -9.5],
        time: 25,
        rings: [[10, -3], [10, 4], [3, 6.8], [-4, 6.8], [-10, 4], [-10, -3], [-3, -7]],
      }
    },
  },
}
