import * as THREE from 'three'
import { mat, mesh, textTexture } from './helpers.js'
import { canvasTexture, codeScreen } from './points.js'
import { torch } from './buildings.js'
import * as C from './characters.js'

// Intérieurs façon « maison dans Pokémon » : une pièce posée loin des îles, sur fond noir,
// vue de plus près et plus en plongée. On y entre par une porte (château, maison du
// développeur, base lunaire) et on en ressort par le tapis de sortie.

export const ROOMS = {
  castle: { era: 'past', name: 'La grande salle du château', tagline: 'Histoires et jeux du royaume', center: [-150, 520], w: 18, d: 13, wall: 0x6e6590, floor: 'stone' },
  studio: { era: 'present', name: 'Le studio du développeur', tagline: 'Là où naissent les projets', center: [0, 520], w: 14, d: 10, wall: 0xe8d5bf, floor: 'wood' },
  base: { era: 'future', name: 'La base lunaire', tagline: 'Poste de commandement', center: [150, 520], w: 16, d: 12, wall: 0x9aa0c0, floor: 'metal' },
  // Bibliothèque : une pièce du château, on y entre par la grande salle.
  library: { era: 'past', name: 'La bibliothèque du château', tagline: 'Mon histoire, chapitre par chapitre', center: [-150, 580], w: 15, d: 11, wall: 0x54456e, floor: 'wood', parent: 'castle' },
}

// Porte de la grande salle vers la bibliothèque (mur de droite), en coordonnées de la pièce.
export const LIBRARY_DOOR = { x: 9 - 0.55, z: 1 }

const floorTexture = (kind) => canvasTexture(256, 256, (g, w, h) => {
  if (kind === 'stone') {
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 4; x++) {
        const l = 42 + ((x + y) % 2) * 10 + Math.random() * 6
        g.fillStyle = `hsl(258, 18%, ${l}%)`
        g.fillRect(x * 64 + 2, y * 64 + 2, 60, 60)
      }
    }
  } else if (kind === 'wood') {
    g.fillStyle = '#7a4f30'
    g.fillRect(0, 0, w, h)
    for (let y = 0; y < 8; y++) {
      const off = (y % 2) * 64
      for (let x = -1; x < 3; x++) {
        g.fillStyle = `hsl(26, 40%, ${36 + Math.random() * 8}%)`
        g.fillRect(x * 128 + off + 1, y * 32 + 1, 126, 30)
      }
    }
  } else {
    g.fillStyle = '#5b6078'
    g.fillRect(0, 0, w, h)
    g.strokeStyle = '#3b3f55'
    g.lineWidth = 4
    for (let i = 0; i <= 4; i++) {
      g.beginPath()
      g.moveTo(i * 64, 0)
      g.lineTo(i * 64, h)
      g.moveTo(0, i * 64)
      g.lineTo(w, i * 64)
      g.stroke()
    }
    g.fillStyle = '#7df9ff'
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) g.fillRect(i * 64 + 30, j * 64 + 30, 4, 4)
  }
})

// Crée la pièce (sol, murs, collisions) et renvoie un contexte comme celui des îles.
export function buildRoom(scene, ground, colliders, animated, key) {
  const room = ROOMS[key]
  const center = new THREE.Vector3(room.center[0], 0, room.center[1])
  const group = new THREE.Group()
  group.position.copy(center)
  scene.add(group)
  const { w, d } = room
  const ctx = {
    group,
    center,
    colliders,
    animated,
    era: room.era,
    heightAt: () => 0,
    addCollider: (x, z, r, top = 6) => colliders.push({ x: center.x + x, z: center.z + z, r, top }),
    addFadeable: () => {},
    room,
    key,
  }

  // Grand fond noir : la pièce flotte dans le noir, comme dans les jeux Pokémon.
  const voidPlane = mesh(new THREE.PlaneGeometry(260, 260), new THREE.MeshBasicMaterial({ color: 0x05040c }), { y: -0.6, shadow: false })
  voidPlane.rotation.x = -Math.PI / 2
  group.add(voidPlane)

  const tex = floorTexture(room.floor)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(w / 4, d / 4)
  const floor = mesh(new THREE.BoxGeometry(w, 0.5, d), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 }), { y: -0.25 })
  floor.castShadow = false
  group.add(floor)
  const rect = (x0, z0, x1, z1) => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]].map(([x, z]) => [center.x + x, center.z + z])
  const R = Math.hypot(w, d) / 2 + 1
  ground.surfaces.push({ type: 'poly', pts: rect(-w / 2, -d / 2, w / 2, d / 2), x: center.x, z: center.z, r: R, h: 0, room: true })

  // Murs : fond et côtés pleins, mur de devant bas (on voit dedans depuis la caméra).
  const wallMat = mat(room.wall)
  const trim = mat(new THREE.Color(room.wall).offsetHSL(0, 0, -0.18))
  const H = 3.6
  const wall = (x, z, sx, sz, h) => {
    group.add(mesh(new THREE.BoxGeometry(sx, h, sz), wallMat, { x, y: h / 2, z }))
    group.add(mesh(new THREE.BoxGeometry(sx + 0.05, 0.25, sz + 0.05), trim, { x, y: h, z }))
    ground.surfaces.push({ type: 'poly', pts: rect(x - sx / 2, z - sz / 2, x + sx / 2, z + sz / 2), x: center.x + x, z: center.z + z, r: Math.hypot(sx, sz) / 2 + 0.5, h: 4, room: true, wall: true })
  }
  wall(0, -d / 2 - 0.3, w + 1.2, 0.6, H)
  wall(-w / 2 - 0.3, 0, 0.6, d, H)
  wall(w / 2 + 0.3, 0, 0.6, d, H)
  // Devant : deux murets de part et d'autre de la porte.
  const side = (w - 2.4) / 2
  wall(-w / 2 + side / 2, d / 2 + 0.3, side, 0.6, 0.7)
  wall(w / 2 - side / 2, d / 2 + 0.3, side, 0.6, 0.7)

  // Tapis de sortie devant la porte.
  const mat0 = mesh(new THREE.BoxGeometry(2.2, 0.04, 1.2), mat(0xc0392b), { y: 0.02, z: d / 2 - 0.5, shadow: false })
  group.add(mat0)
  const arrow = mesh(new THREE.ConeGeometry(0.3, 0.6, 3).rotateX(Math.PI / 2), mat(0xffd27a, { emissive: 0xffb347, emissiveIntensity: 1.5 }), { y: 0.1, z: d / 2 + 0.2, shadow: false })
  arrow.scale.y = 0.3
  group.add(arrow)
  animated.push((dt, t) => { arrow.position.z = d / 2 + 0.2 + Math.sin(t * 4) * 0.12 })

  // Lumière d'ambiance de la pièce.
  const light = new THREE.PointLight(room.floor === 'metal' ? 0xbfd8ff : 0xffc98a, 40, 26, 1.6)
  light.position.set(0, 5, 1)
  group.add(light)

  ctx.exit = new THREE.Vector3(center.x, 0, center.z + d / 2 - 0.4)
  ctx.arrival = new THREE.Vector3(center.x, 0, center.z + d / 2 - 2.4)
  ctx.info = { id: `room-${key}`, era: room.era, name: room.name, tagline: room.tagline, center, radius: Math.max(w, d) / 2 + 1, gravity: 1, interior: true }
  DECOR[key](ctx, w, d)
  return ctx
}

const box = (ctx, sx, sy, sz, color, x, y, z, extra) => {
  const m = mesh(new THREE.BoxGeometry(sx, sy, sz), mat(color, extra), { x, y, z })
  ctx.group.add(m)
  return m
}

const poster = (text, bg, fg) => new THREE.MeshStandardMaterial({ map: textTexture(text, { bg, fg, width: 256, height: 340, font: 'bold 40px "Fredoka Variable", "Nunito Variable", sans-serif' }) })


// ---------- Mobilier du studio ----------

const ALU = () => mat(0xd8dce6, { metalness: 0.6, roughness: 0.35, flatShading: false })

// Bureau de macOS : fond d'écran dégradé, barre de menus, éditeur de code et dock.
const macScreen = () => canvasTexture(512, 320, (g, W, H) => {
  const bg = g.createLinearGradient(0, 0, W, H)
  bg.addColorStop(0, '#3a2a7a')
  bg.addColorStop(0.55, '#c0508a')
  bg.addColorStop(1, '#ffb36b')
  g.fillStyle = bg
  g.fillRect(0, 0, W, H)
  g.fillStyle = 'rgba(255,255,255,0.35)'
  g.fillRect(0, 0, W, 12)
  // Fenêtre d'éditeur.
  g.fillStyle = '#1b1830'
  g.beginPath()
  g.roundRect(40, 30, 300, 220, 10)
  g.fill()
  for (const [i, c] of ['#ff5f56', '#ffbd2e', '#27c93f'].entries()) {
    g.fillStyle = c
    g.beginPath()
    g.arc(54 + i * 12, 42, 4, 0, Math.PI * 2)
    g.fill()
  }
  const colors = ['#c792ea', '#82aaff', '#c3e88d', '#f78c6c', '#89ddff', '#ffcb6b']
  let s = 3
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647)
  for (let y = 62; y < 236; y += 11) {
    let x = 56 + Math.floor(rnd() * 3) * 12
    while (x < 320 && rnd() > 0.25) {
      const len = 12 + rnd() * 40
      g.fillStyle = colors[Math.floor(rnd() * colors.length)]
      g.fillRect(x, y, len, 5)
      x += len + 6
    }
  }
  // Aperçu du site à droite.
  g.fillStyle = '#f6f4fb'
  g.beginPath()
  g.roundRect(356, 50, 130, 190, 10)
  g.fill()
  g.fillStyle = '#9b6bff'
  g.fillRect(366, 64, 70, 10)
  g.fillStyle = '#1a1530'
  g.fillRect(366, 86, 100, 8)
  g.fillRect(366, 100, 80, 8)
  g.fillStyle = '#ffb347'
  g.beginPath()
  g.roundRect(366, 118, 60, 18, 9)
  g.fill()
  // Dock.
  g.fillStyle = 'rgba(255,255,255,0.3)'
  g.beginPath()
  g.roundRect(150, H - 34, 212, 28, 10)
  g.fill()
  const icons = ['#2f9bff', '#ff5f56', '#27c93f', '#ffbd2e', '#b48cff', '#1b1830', '#ff7ad9']
  icons.forEach((c, i) => {
    g.fillStyle = c
    g.beginPath()
    g.roundRect(158 + i * 29, H - 30, 22, 22, 6)
    g.fill()
  })
})

// Second écran : maquette du site dans un outil de design.
const designScreen = () => canvasTexture(512, 300, (g, W, H) => {
  g.fillStyle = '#2b2b33'
  g.fillRect(0, 0, W, H)
  g.fillStyle = '#1e1e24'
  g.fillRect(0, 0, 90, H)
  g.fillRect(W - 90, 0, 90, H)
  g.fillStyle = '#3a3a44'
  for (let i = 0; i < 8; i++) g.fillRect(10, 20 + i * 28, 70 - (i % 3) * 12, 10)
  for (let i = 0; i < 6; i++) g.fillRect(W - 80, 20 + i * 34, 70, 18)
  // Trois écrans de l'appli posés sur le plan de travail.
  const frames = [['#9b6bff', '#ffb347'], ['#ff6fb1', '#ffffff'], ['#3fd6a8', '#1a1530']]
  frames.forEach(([a, b], i) => {
    const x = 116 + i * 96
    g.fillStyle = '#ffffff'
    g.beginPath()
    g.roundRect(x, 40, 80, 160, 10)
    g.fill()
    g.fillStyle = a
    g.beginPath()
    g.roundRect(x + 6, 46, 68, 60, 6)
    g.fill()
    g.fillStyle = b
    g.fillRect(x + 10, 116, 50, 8)
    g.fillStyle = '#c8c4d8'
    g.fillRect(x + 10, 132, 60, 6)
    g.fillRect(x + 10, 144, 40, 6)
    g.fillStyle = a
    g.beginPath()
    g.roundRect(x + 10, 168, 60, 18, 9)
    g.fill()
  })
  g.strokeStyle = '#2f9bff'
  g.lineWidth = 2
  g.strokeRect(210, 38, 84, 164)
})

function setupDesk(ctx, x, z) {
  const g = new THREE.Group()
  g.position.set(x, 0, z)
  // Un peu plus grand que nature, à l'échelle des personnages.
  g.scale.setScalar(1.3)
  ctx.group.add(g)
  const black = mat(0x1d1d22, { roughness: 0.5 })
  // Tapis gris sous le bureau.
  const rug = mesh(new THREE.BoxGeometry(3.4, 0.01, 2.2), mat(0x4a4658, { roughness: 1 }), { y: 0.005, z: 0.6, shadow: false })
  rug.receiveShadow = true
  g.add(rug)
  // Plateau en noyer sur pieds traîneaux noirs.
  g.add(mesh(new THREE.BoxGeometry(3.6, 0.06, 1.0), mat(0x7a4a2c, { roughness: 0.6 }), { y: 0.78 }))
  for (const s of [-1, 1]) {
    g.add(mesh(new THREE.BoxGeometry(0.06, 0.74, 0.06), black, { x: s * 1.65, y: 0.38, z: -0.4 }))
    g.add(mesh(new THREE.BoxGeometry(0.06, 0.74, 0.06), black, { x: s * 1.65, y: 0.38, z: 0.4 }))
    g.add(mesh(new THREE.BoxGeometry(0.06, 0.05, 0.9), black, { x: s * 1.65, y: 0.03 }))
  }
  // Ruban lumineux sous le plateau.
  g.add(mesh(new THREE.BoxGeometry(3.4, 0.02, 0.02), mat(0xb48cff, { emissive: 0xb48cff, emissiveIntensity: 3 }), { y: 0.74, z: -0.45, shadow: false }))
  // Sous-main en feutre.
  g.add(mesh(new THREE.BoxGeometry(1.5, 0.01, 0.5), mat(0x4a4a55, { roughness: 1 }), { y: 0.815, z: 0.18 }))
  // iMac : écran fin, menton coloré, dos argenté, pied incliné.
  const imac = new THREE.Group()
  imac.position.set(-0.55, 0.81, -0.18)
  imac.rotation.y = 0.12
  imac.add(mesh(new THREE.BoxGeometry(1.12, 0.72, 0.03), mat(0xc9d6ea, { metalness: 0.5, roughness: 0.35, flatShading: false }), { y: 0.62 }))
  imac.add(mesh(new THREE.BoxGeometry(1.12, 0.12, 0.031), mat(0x9fc0e8, { metalness: 0.4, roughness: 0.35, flatShading: false }), { y: 0.24 }))
  imac.add(mesh(new THREE.PlaneGeometry(1.08, 0.58), new THREE.MeshBasicMaterial({ color: 0x111116 }), { y: 0.67, z: 0.016, shadow: false }))
  const mac = macScreen()
  const scr = new THREE.MeshStandardMaterial({ map: mac, emissiveMap: mac, emissive: 0xffffff, emissiveIntensity: 1.1 })
  imac.add(mesh(new THREE.PlaneGeometry(1.02, 0.54), scr, { y: 0.67, z: 0.017, shadow: false }))
  const stand = mesh(new THREE.BoxGeometry(0.22, 0.42, 0.02), mat(0xc9d6ea, { metalness: 0.5, roughness: 0.35 }), { y: 0.2, z: -0.1 })
  stand.rotation.x = -0.3
  imac.add(stand)
  imac.add(mesh(new THREE.BoxGeometry(0.26, 0.01, 0.22), mat(0xc9d6ea, { metalness: 0.5, roughness: 0.35 }), { y: 0.005, z: -0.06 }))
  g.add(imac)
  // Second écran sur pied argenté, tourné vers le centre.
  const display = new THREE.Group()
  display.position.set(0.72, 0.81, -0.2)
  display.rotation.y = -0.28
  display.add(mesh(new THREE.BoxGeometry(1.0, 0.6, 0.03), ALU(), { y: 0.56 }))
  display.add(mesh(new THREE.PlaneGeometry(0.97, 0.57), new THREE.MeshBasicMaterial({ color: 0x111116 }), { y: 0.56, z: 0.016, shadow: false }))
  const des = designScreen()
  display.add(mesh(new THREE.PlaneGeometry(0.93, 0.53), new THREE.MeshStandardMaterial({ map: des, emissiveMap: des, emissive: 0xffffff, emissiveIntensity: 1.1 }), { y: 0.56, z: 0.017, shadow: false }))
  display.add(mesh(new THREE.BoxGeometry(0.08, 0.32, 0.03), ALU(), { y: 0.18, z: -0.06 }))
  display.add(mesh(new THREE.BoxGeometry(0.3, 0.012, 0.22), ALU(), { y: 0.006, z: -0.04 }))
  g.add(display)
  // Clavier, souris et pavé tactile.
  g.add(mesh(new THREE.BoxGeometry(0.46, 0.014, 0.15), mat(0xf2f2f5, { flatShading: false }), { x: -0.1, y: 0.825, z: 0.2 }))
  g.add(mesh(new THREE.BoxGeometry(0.42, 0.006, 0.11), mat(0xe2e2ea), { x: -0.1, y: 0.834, z: 0.2, shadow: false }))
  const mouse = mesh(new THREE.SphereGeometry(0.05, 12, 8), mat(0xf2f2f5, { flatShading: false }), { x: 0.36, y: 0.825, z: 0.22 })
  mouse.scale.set(0.7, 0.3, 1.1)
  g.add(mouse)
  // Lampe d'architecte.
  const lamp = new THREE.Group()
  lamp.position.set(-1.5, 0.81, -0.25)
  lamp.add(mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.03, 16), black, { y: 0.015 }))
  const arm1 = mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.55, 6), black, { x: 0.08, y: 0.27 })
  arm1.rotation.z = -0.35
  lamp.add(arm1)
  const arm2 = mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.5, 6), black, { x: 0.33, y: 0.6 })
  arm2.rotation.z = 1.1
  lamp.add(arm2)
  const shade = mesh(new THREE.ConeGeometry(0.1, 0.16, 12, 1, true), black, { x: 0.55, y: 0.55 })
  shade.rotation.z = 0.5
  lamp.add(shade)
  lamp.add(mesh(new THREE.SphereGeometry(0.04, 8, 6), new THREE.MeshBasicMaterial({ color: 0xfff0c8 }), { x: 0.56, y: 0.5, shadow: false }))
  const lampLight = new THREE.PointLight(0xffd9a0, 3, 3, 1.8)
  lampLight.position.set(0.6, 0.4, 0)
  lamp.add(lampLight)
  g.add(lamp)
  // Enceintes, casque, mug, petite plante.
  for (const sx of [-1.15, 1.32]) {
    g.add(mesh(new THREE.BoxGeometry(0.16, 0.26, 0.16), mat(0xf2f2f5), { x: sx, y: 0.94, z: -0.28 }))
    g.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.01, 12).rotateX(Math.PI / 2), mat(0x2b2b33), { x: sx, y: 0.97, z: -0.195, shadow: false }))
  }
  const headStand = new THREE.Group()
  headStand.position.set(1.55, 0.81, 0.15)
  headStand.add(mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.02, 12), black, { y: 0.01 }))
  headStand.add(mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.32, 6), black, { y: 0.17 }))
  const band = mesh(new THREE.TorusGeometry(0.1, 0.018, 6, 16, Math.PI), black, { y: 0.32 })
  headStand.add(band)
  for (const s of [-1, 1]) headStand.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.04, 12).rotateZ(Math.PI / 2), black, { x: s * 0.1, y: 0.3 }))
  g.add(headStand)
  g.add(mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.1, 12), mat(0xffb347), { x: 0.95, y: 0.86, z: 0.3 }))
  g.add(mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.1, 10), mat(0xf2f2f5), { x: -1.55, y: 0.86, z: 0.25 }))
  for (let i = 0; i < 5; i++) {
    const leaf = mesh(new THREE.SphereGeometry(0.06, 6, 4), mat(0x3f9d5a), { x: -1.55 + Math.cos(i * 1.3) * 0.05, y: 0.96 + (i % 2) * 0.04, z: 0.25 + Math.sin(i * 1.3) * 0.05 })
    leaf.scale.set(0.6, 1.4, 0.3)
    leaf.rotation.set(Math.sin(i) * 0.6, i, Math.cos(i) * 0.6)
    g.add(leaf)
  }
  // Chaise ergonomique : dossier en résille, appuie-tête, piètement en étoile.
  const chair = new THREE.Group()
  chair.position.set(0, 0, 1.0)
  chair.rotation.y = Math.PI + 0.15
  const base = mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.38, 8), mat(0x8a8fa8, { metalness: 0.6 }), { y: 0.25 })
  chair.add(base)
  for (let i = 0; i < 5; i++) {
    const leg = mesh(new THREE.BoxGeometry(0.34, 0.03, 0.05), black, { x: Math.cos((i / 5) * Math.PI * 2) * 0.17, y: 0.06, z: Math.sin((i / 5) * Math.PI * 2) * 0.17 })
    leg.rotation.y = -(i / 5) * Math.PI * 2
    chair.add(leg)
    chair.add(mesh(new THREE.SphereGeometry(0.035, 6, 4), black, { x: Math.cos((i / 5) * Math.PI * 2) * 0.33, y: 0.035, z: Math.sin((i / 5) * Math.PI * 2) * 0.33 }))
  }
  chair.add(mesh(new THREE.BoxGeometry(0.52, 0.08, 0.5), mat(0x2b2b33), { y: 0.46 }))
  const back = mesh(new THREE.BoxGeometry(0.5, 0.62, 0.04), new THREE.MeshStandardMaterial({ color: 0x1d1d22, transparent: true, opacity: 0.85, roughness: 0.8 }), { y: 0.85, z: -0.26 })
  back.rotation.x = 0.12
  chair.add(back)
  chair.add(mesh(new THREE.BoxGeometry(0.3, 0.14, 0.05), mat(0x2b2b33), { y: 1.25, z: -0.31 }))
  for (const s of [-1, 1]) chair.add(mesh(new THREE.BoxGeometry(0.05, 0.05, 0.3), black, { x: s * 0.28, y: 0.66, z: -0.02 }))
  g.add(chair)
  for (const dx of [-1.6, 0, 1.6]) ctx.addCollider(x + dx, z, 0.85, 2)
}

// Étagères flottantes avec livres, plante, trophée et petite figurine.
function wallShelves(ctx, x, z) {
  const g = new THREE.Group()
  g.position.set(x, 0, z)
  ctx.group.add(g)
  const oak = mat(0xc49a6c)
  const colors = [0x2f6fd8, 0xe74c3c, 0xffd34f, 0x27ae60, 0xb48cff, 0x1d1d22]
  for (let row = 0; row < 3; row++) {
    const y = 1.2 + row * 0.65
    g.add(mesh(new THREE.BoxGeometry(1.8, 0.05, 0.32), oak, { y, z: 0.16 }))
    for (let i = 0; i < 6; i++) {
      const b = mesh(new THREE.BoxGeometry(0.07, 0.3 + (i % 3) * 0.04, 0.22), mat(colors[(i + row * 2) % colors.length]), { x: -0.8 + i * 0.08 + (row % 2) * 0.9, y: y + 0.18, z: 0.17 })
      g.add(b)
    }
  }
  g.add(mesh(new THREE.CylinderGeometry(0.08, 0.07, 0.14, 10), mat(0xf2f2f5), { x: 0.5, y: 1.3, z: 0.16 }))
  for (let i = 0; i < 6; i++) {
    const leaf = mesh(new THREE.ConeGeometry(0.03, 0.4, 4), mat(0x3f9d5a), { x: 0.5 + Math.cos(i) * 0.03, y: 1.2 - 0.2 + (i % 3) * -0.05, z: 0.22 })
    leaf.rotation.z = Math.PI + Math.sin(i) * 0.3
    g.add(leaf)
  }
  g.add(mesh(new THREE.CylinderGeometry(0.03, 0.06, 0.2, 8), mat(0xd4a017, { metalness: 0.7, roughness: 0.3 }), { x: -0.4, y: 2.0, z: 0.16 }))
  g.add(mesh(new THREE.SphereGeometry(0.07, 10, 8), mat(0xd4a017, { metalness: 0.7, roughness: 0.3 }), { x: -0.4, y: 2.15, z: 0.16 }))
  g.add(mesh(new THREE.BoxGeometry(0.14, 0.18, 0.1), mat(0xff7ad9), { x: 0.5, y: 2.66, z: 0.16 }))
}

// Monstera en pot.
function monstera(ctx, x, z, scale = 1) {
  const g = new THREE.Group()
  g.position.set(x, 0, z)
  g.scale.setScalar(scale)
  ctx.group.add(g)
  g.add(mesh(new THREE.CylinderGeometry(0.32, 0.26, 0.55, 14), mat(0xe8e2d8), { y: 0.28 }))
  g.add(mesh(new THREE.CylinderGeometry(0.29, 0.29, 0.03, 14), mat(0x3a2a1a), { y: 0.54 }))
  for (let i = 0; i < 9; i++) {
    const a = i * 2.4
    const h = 0.9 + (i % 4) * 0.25
    const stem = mesh(new THREE.CylinderGeometry(0.012, 0.015, h, 4), mat(0x3f7d3a), { x: Math.cos(a) * 0.12, y: 0.55 + h / 2, z: Math.sin(a) * 0.12 })
    stem.rotation.set(Math.sin(a) * 0.3, 0, -Math.cos(a) * 0.3)
    g.add(stem)
    const leaf = mesh(new THREE.SphereGeometry(0.24, 10, 6), mat(0x2f8a45), { x: Math.cos(a) * 0.38, y: 0.5 + h, z: Math.sin(a) * 0.38 })
    leaf.scale.set(1, 0.12, 0.75)
    leaf.rotation.set(Math.sin(a) * 0.5, -a, -Math.cos(a) * 0.5)
    g.add(leaf)
  }
  ctx.addCollider(x, z, 0.45 * scale)
}

function floorLamp(ctx, x, z) {
  const g = new THREE.Group()
  g.position.set(x, 0, z)
  ctx.group.add(g)
  const black = mat(0x1d1d22)
  g.add(mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.04, 16), black, { y: 0.02 }))
  g.add(mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.7, 6), black, { y: 0.87 }))
  g.add(mesh(new THREE.CylinderGeometry(0.22, 0.3, 0.3, 16, 1, true), mat(0xf4ead2, { emissive: 0xffd9a0, emissiveIntensity: 0.8, side: THREE.DoubleSide }), { y: 1.8 }))
  const l = new THREE.PointLight(0xffd9a0, 4, 5, 1.6)
  l.position.set(0, 1.7, 0)
  g.add(l)
  ctx.addCollider(x, z, 0.3)
}

const DECOR = {
  castle(ctx, w, d) {
    const { group } = ctx
    // Tapis rouge jusqu'au trône.
    box(ctx, 2.4, 0.03, d - 1, 0x9b1d2a, 0, 0.015, 0.3)
    box(ctx, 2.0, 0.035, d - 1.2, 0xc0392b, 0, 0.02, 0.3)
    // Estrade et trône.
    box(ctx, 5, 0.4, 2.2, 0x56507a, 0, 0.2, -d / 2 + 1.3)
    box(ctx, 1.4, 0.6, 1.1, 0x7a2a8a, 0, 0.7, -d / 2 + 1.2)
    box(ctx, 1.4, 2.4, 0.25, 0xd4a017, 0, 1.6, -d / 2 + 0.7, { metalness: 0.6, roughness: 0.3 })
    for (const x of [-0.75, 0.75]) box(ctx, 0.2, 1, 1.1, 0xd4a017, x, 0.9, -d / 2 + 1.2, { metalness: 0.6, roughness: 0.3 })
    ctx.addCollider(0, -d / 2 + 1.2, 1.1, 2)
    // Bannières sur le mur du fond.
    for (const [x, c] of [[-5, 0x5a2a8a], [5, 0x5a2a8a], [-2.6, 0xd4a017], [2.6, 0xd4a017]]) {
      box(ctx, 1.1, 2.2, 0.05, c, x, 2.3, -d / 2 + 0.05)
      const tip = mesh(new THREE.ConeGeometry(0.55, 0.5, 3), mat(c), { x, y: 1.0, z: -d / 2 + 0.05 })
      tip.rotation.z = Math.PI
      group.add(tip)
    }
    // Colonnes.
    for (const x of [-4.5, 4.5]) for (const z of [-2.5, 2]) {
      group.add(mesh(new THREE.CylinderGeometry(0.4, 0.45, 3.6, 8), mat(0x8a83ad), { x, y: 1.8, z }))
      ctx.addCollider(x, z, 0.5)
    }
    // Table de banquet avec chandelles et coupes.
    box(ctx, 1.4, 0.1, 5, 0x6b4226, -6.5, 0.85, 1)
    for (const z of [-1, 1, 3]) box(ctx, 0.12, 0.85, 0.12, 0x5a3a22, -6.5, 0.42, z)
    for (const z of [-0.8, 0.6, 2.2]) {
      box(ctx, 0.08, 0.3, 0.08, 0xfff4dc, -6.5, 1.05, z)
      group.add(mesh(new THREE.ConeGeometry(0.05, 0.12, 6), mat(0xffb347, { emissive: 0xff8a20, emissiveIntensity: 3 }), { x: -6.5, y: 1.26, z, shadow: false }))
      group.add(mesh(new THREE.CylinderGeometry(0.06, 0.04, 0.16, 8), mat(0xd4a017, { metalness: 0.7, roughness: 0.3 }), { x: -6.2, y: 0.98, z: z + 0.4 }))
    }
    for (const z of [-1, 1, 3]) for (const x of [-7.5, -5.5]) box(ctx, 0.5, 0.5, 0.5, 0x5a3a22, x, 0.25, z)
    ctx.addCollider(-6.5, 1, 1.4, 1.2)
    ctx.addCollider(-6.5, -1, 1, 1.2)
    ctx.addCollider(-6.5, 3, 1, 1.2)
    // Cheminée avec feu qui danse.
    box(ctx, 2.6, 2.4, 0.9, 0x5a5578, 6.5, 1.2, -d / 2 + 0.6)
    box(ctx, 1.6, 1.2, 0.3, 0x1a1020, 6.5, 0.6, -d / 2 + 1.0)
    const fire = []
    for (let i = 0; i < 3; i++) {
      const f = mesh(new THREE.ConeGeometry(0.22, 0.7, 5), mat(i ? 0xffb347 : 0xff5a1f, { emissive: i ? 0xff9a2a : 0xff4a10, emissiveIntensity: 3 }), { x: 6.2 + i * 0.3, y: 0.4, z: -d / 2 + 1.1, shadow: false })
      fire.push(f)
      group.add(f)
    }
    ctx.animated.push((dt, t) => fire.forEach((f, i) => { f.scale.y = 0.8 + Math.sin(t * 9 + i * 2) * 0.25 }))
    ctx.addCollider(6.5, -d / 2 + 0.8, 1.4, 3)
    // Torches aux murs.
    for (const [x, z] of [[-w / 2 + 0.25, -2], [-w / 2 + 0.25, 3], [w / 2 - 0.25, -2.4], [w / 2 - 0.25, 2.6]]) torch(group, x, 2.2, z, ctx.animated)
    // Passage voûté vers la bibliothèque, sur le mur de droite.
    const arch = new THREE.Group()
    arch.position.set(w / 2 - 0.02, 0, LIBRARY_DOOR.z)
    arch.rotation.y = -Math.PI / 2
    const stoneDoor = mat(0x8f88c8)
    arch.add(mesh(new THREE.PlaneGeometry(1.6, 2.2), new THREE.MeshBasicMaterial({ color: 0x120a1c }), { y: 1.1, z: 0.01, shadow: false }))
    const top = mesh(new THREE.CircleGeometry(0.8, 16, 0, Math.PI), new THREE.MeshBasicMaterial({ color: 0x120a1c }), { y: 2.2, z: 0.01, shadow: false })
    arch.add(top)
    for (const s of [-1, 1]) arch.add(mesh(new THREE.BoxGeometry(0.3, 2.3, 0.3), stoneDoor, { x: s * 0.95, y: 1.15, z: 0.1 }))
    const ring = mesh(new THREE.TorusGeometry(0.95, 0.15, 6, 16, Math.PI), stoneDoor, { y: 2.25, z: 0.1 })
    arch.add(ring)
    // Lueur chaude qui vient de la bibliothèque.
    arch.add(mesh(new THREE.PlaneGeometry(1.2, 1.7), new THREE.MeshBasicMaterial({ color: 0xffb347, transparent: true, opacity: 0.18 }), { y: 1, z: 0.03, shadow: false }))
    const sign = mesh(new THREE.PlaneGeometry(1.9, 0.5), new THREE.MeshBasicMaterial({ map: textTexture('📚 Bibliothèque', { bg: '#2a1a3a', fg: '#ffd27a', width: 512, height: 136, font: 'bold 56px "Fredoka Variable", "Nunito Variable", sans-serif' }) }), { y: 3.15, z: 0.08, shadow: false })
    arch.add(sign)
    group.add(arch)
    // Râtelier d'armes et armure.
    box(ctx, 2, 1.6, 0.4, 0x6b4226, 6.5, 0.8, 3.8)
    for (const x of [5.8, 6.3, 6.8, 7.2]) box(ctx, 0.08, 1.4, 0.08, 0xcfd3e0, x, 1.1, 3.6, { metalness: 0.7 })
    ctx.addCollider(6.5, 3.8, 1.1, 2)
    // Le roi sur son trône, un mage et un garde qui fait sa ronde.
    const king = C.npc(ctx, 'knight', 0, -d / 2 + 1.35, { keep: ['Knight_Cape', 'Knight_Helmet'], anim: 'Sit_Chair_Idle', r: 0, greet: false })
    king.object.position.y = 0.8
    C.npc(ctx, 'mage', -3, -3.5, { keep: ['Spellbook_open', 'Mage_Hat'], anim: 'Spellcasting', speed: 0.5, path: [[-3, -3.5], [-2.5, 2.5]], walk: 0.8, pause: 4 })
    C.npc(ctx, 'barbarian', 3, 3, { keep: ['1H_Axe', 'Barbarian_Hat'], path: [[3, 3], [3, -3], [5.5, 0]], walk: 1, pause: 2.5 })
  },

  studio(ctx, w, d) {
    const { group } = ctx
    // Grande baie vitrée avec la ville au crépuscule.
    const sky = canvasTexture(512, 160, (g, W, H) => {
      const grad = g.createLinearGradient(0, 0, 0, H)
      grad.addColorStop(0, '#ff9a4a')
      grad.addColorStop(1, '#6a3a7a')
      g.fillStyle = grad
      g.fillRect(0, 0, W, H)
      for (let x = 0; x < W; x += 24 + Math.random() * 20) {
        const bh = 40 + Math.random() * 90
        g.fillStyle = '#2a1a3a'
        g.fillRect(x, H - bh, 22, bh)
        g.fillStyle = '#ffd27a'
        for (let y = H - bh + 6; y < H - 6; y += 12) if (Math.random() > 0.4) g.fillRect(x + 5, y, 4, 5)
      }
    })
    const win = mesh(new THREE.PlaneGeometry(7, 2), new THREE.MeshStandardMaterial({ map: sky, emissiveMap: sky, emissive: 0xffffff, emissiveIntensity: 0.9 }), { y: 2.1, z: -d / 2 + 0.02, shadow: false })
    group.add(win)
    for (const x of [-3.5, 0, 3.5]) box(ctx, 0.12, 2.2, 0.1, 0x333344, x, 2.1, -d / 2 + 0.05)
    // Le setup : grand bureau en noyer sous la baie vitrée, iMac et second écran,
    // clavier et souris, lampe d'architecte, enceintes, plante, casque et chaise ergonomique.
    setupDesk(ctx, 0, -d / 2 + 1.05)
    const dev = C.npc(ctx, 'rogue', 0, -d / 2 + 2.35, { rotY: Math.PI, anim: 'Sit_Chair_Idle', r: 0.5, greet: false })
    dev.object.position.y = 0.2
    // Étagères murales de part et d'autre de la fenêtre.
    for (const x of [-5.1, 5.1]) wallShelves(ctx, x, -d / 2 + 0.2)
    // Grande plante dans l'angle et lampadaire près du canapé.
    monstera(ctx, -w / 2 + 0.9, -d / 2 + 0.9)
    floorLamp(ctx, w / 2 - 0.8, 1.6)
    // Canapé, tapis et table basse.
    box(ctx, 3, 0.5, 1, 0x4f6fd8, 3.5, 0.25, 2.6)
    box(ctx, 3, 0.8, 0.3, 0x3f5fc8, 3.5, 0.6, 3.05)
    ctx.addCollider(3.5, 2.7, 1.6, 1.2)
    group.add(mesh(new THREE.CylinderGeometry(1.8, 1.8, 0.02, 24), mat(0xff9a4a), { x: 3.5, y: 0.01, z: 0.8, shadow: false }))
    C.npc(ctx, 'mage', 2.6, 2.5, { keep: [], anim: 'Sit_Chair_Idle', rotY: Math.PI, r: 0, greet: false }).object.position.y = 0.4
    // Plantes près de l'entrée.
    for (const [x, z] of [[-w / 2 + 0.8, 3.5], [w / 2 - 0.8, 3.8]]) monstera(ctx, x, z, 0.7)
    // Affiches de projets.
    for (const [x, t, bg, fg] of [[-w / 2 + 0.06, 'VELQORA', '#1a1530', '#ffb347'], [-w / 2 + 0.06, 'Remembeyes', '#ff7ab6', '#ffffff']].map((p, i) => [p[0], p[1], p[2], p[3], i])) {
      const z = t === 'VELQORA' ? -1.5 : 1
      const p = mesh(new THREE.PlaneGeometry(1.1, 1.45), poster(t, bg, fg), { x, y: 2, z, shadow: false })
      p.rotation.y = Math.PI / 2
      group.add(p)
    }
    // Néon « Code · Café · Commit » au-dessus du coin café.
    const neon = mesh(new THREE.PlaneGeometry(3, 0.6), new THREE.MeshBasicMaterial({ map: textTexture('Code · Café · Commit', { bg: '#1a1530', fg: '#ff9ad9', font: 'bold 46px "Nunito Variable", system-ui, sans-serif' }) }), { x: w / 2 - 0.05, y: 2.6, z: 0.8, shadow: false })
    neon.rotation.y = -Math.PI / 2
    group.add(neon)
  },

  library(ctx, w, d) {
    const { group } = ctx
    const wood = 0x5a3a22
    // Rayonnages pleins de livres le long des murs.
    const colors = [0x8e3348, 0x2f4e8c, 0x3f7d4a, 0xd7a24a, 0x6b3f8c, 0xc0392b, 0x1f6f6a, 0xe8d5bf]
    let seed = 7
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    const shelf = (x, z, rotY, width = 2.2, height = 3.2) => {
      const g = new THREE.Group()
      g.add(mesh(new THREE.BoxGeometry(width, height, 0.55), mat(wood), { y: height / 2 }))
      g.add(mesh(new THREE.BoxGeometry(width + 0.2, 0.16, 0.7), mat(0x4a2e1a), { y: height + 0.08 }))
      for (let row = 0; row < 5; row++) {
        const y = 0.2 + row * 0.6
        g.add(mesh(new THREE.BoxGeometry(width - 0.1, 0.05, 0.5), mat(0x7a5232), { y, z: 0.05 }))
        let bx = -width / 2 + 0.08
        while (bx < width / 2 - 0.15) {
          const bw = 0.07 + rnd() * 0.08
          const bh = 0.34 + rnd() * 0.18
          const b = mesh(new THREE.BoxGeometry(bw, bh, 0.34), mat(colors[Math.floor(rnd() * colors.length)]), { x: bx + bw / 2, y: y + 0.025 + bh / 2, z: 0.12 })
          if (rnd() < 0.06) b.rotation.z = 0.28
          g.add(b)
          bx += bw + 0.012
        }
      }
      g.position.set(x, 0, z)
      g.rotation.y = rotY
      group.add(g)
    }
    for (const x of [-5.6, -3.3, 3.3, 5.6]) shelf(x, -d / 2 + 0.3, 0)
    for (const z of [-2.6, 0, 2.6]) shelf(-w / 2 + 0.3, z, Math.PI / 2, 2.4)
    ctx.addCollider(-4.45, -d / 2 + 0.4, 2.4, 4)
    ctx.addCollider(4.45, -d / 2 + 0.4, 2.4, 4)
    for (const z of [-2.6, 0, 2.6]) ctx.addCollider(-w / 2 + 0.4, z, 1.2, 4)
    // Vitrail au fond, entre les rayonnages.
    const glass = canvasTexture(256, 384, (g, W, H) => {
      g.fillStyle = '#1a1030'
      g.fillRect(0, 0, W, H)
      const cols = ['#ff7ad9', '#7df9ff', '#ffd27a', '#9b6bff', '#6dff9a', '#ff8a5c']
      for (let i = 0; i < 40; i++) {
        g.fillStyle = cols[i % cols.length]
        g.globalAlpha = 0.75
        g.beginPath()
        const x = (i % 5) * 52 + 4
        const y = Math.floor(i / 5) * 48 + 4
        g.moveTo(x, y)
        g.lineTo(x + 48, y + (i % 3) * 8)
        g.lineTo(x + 44, y + 44)
        g.lineTo(x + 2, y + 40)
        g.fill()
      }
      g.globalAlpha = 1
      g.strokeStyle = '#1a1030'
      g.lineWidth = 6
      g.beginPath()
      g.arc(W / 2, H * 0.32, 60, 0, Math.PI * 2)
      g.stroke()
      g.fillStyle = '#fff4dc'
      g.font = '90px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif'
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      g.fillText('📖', W / 2, H * 0.32)
    })
    const win = mesh(new THREE.PlaneGeometry(1.8, 2.7), new THREE.MeshStandardMaterial({ map: glass, emissiveMap: glass, emissive: 0xffffff, emissiveIntensity: 0.9 }), { y: 2.05, z: -d / 2 + 0.02, shadow: false })
    group.add(win)
    group.add(mesh(new THREE.CircleGeometry(0.9, 16, 0, Math.PI), new THREE.MeshStandardMaterial({ map: glass, emissiveMap: glass, emissive: 0xffffff, emissiveIntensity: 0.9 }), { y: 3.4, z: -d / 2 + 0.02, shadow: false }))
    // Grand tapis rond.
    const rug = mesh(new THREE.CircleGeometry(3.4, 40), new THREE.MeshStandardMaterial({ map: canvasTexture(256, 256, (g, W) => {
      for (let i = 6; i > 0; i--) {
        g.fillStyle = i % 2 ? '#7a2337' : '#c8a050'
        g.beginPath()
        g.arc(W / 2, W / 2, (W / 2) * (i / 6), 0, Math.PI * 2)
        g.fill()
      }
    }), roughness: 1 }), { y: 0.015, z: -0.4, shadow: false })
    rug.rotation.x = -Math.PI / 2
    rug.receiveShadow = true
    group.add(rug)
    // Lustre de bougies.
    const chandelier = new THREE.Group()
    chandelier.position.set(0, 3.3, -0.6)
    chandelier.add(mesh(new THREE.TorusGeometry(0.9, 0.05, 6, 24), mat(0x3a2a1a), { shadow: false }))
    chandelier.children[0].rotation.x = Math.PI / 2
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2
      chandelier.add(mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.2, 6), mat(0xfff4dc), { x: Math.cos(a) * 0.9, y: 0.1, z: Math.sin(a) * 0.9, shadow: false }))
      chandelier.add(mesh(new THREE.SphereGeometry(0.05, 6, 5), new THREE.MeshBasicMaterial({ color: 0xffd27a }), { x: Math.cos(a) * 0.9, y: 0.25, z: Math.sin(a) * 0.9, shadow: false }))
    }
    chandelier.add(mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.2, 4), mat(0x3a2a1a), { y: 0.6, shadow: false }))
    group.add(chandelier)
    const glow = new THREE.PointLight(0xffc070, 14, 9, 1.5)
    glow.position.set(0, 2.9, -0.6)
    group.add(glow)
    // Livres magiques qui flottent au-dessus des pupitres.
    const floating = []
    for (let i = 0; i < 6; i++) {
      const book = new THREE.Group()
      const c = colors[i % colors.length]
      for (const s of [-1, 1]) {
        const cover = mesh(new THREE.BoxGeometry(0.3, 0.03, 0.4), mat(c), { x: s * 0.15, shadow: false })
        cover.rotation.z = s * 0.35
        book.add(cover)
        const page = mesh(new THREE.BoxGeometry(0.27, 0.02, 0.36), mat(0xfff4dc, { emissive: 0xffd27a, emissiveIntensity: 0.3 }), { x: s * 0.14, y: 0.025, shadow: false })
        page.rotation.z = s * 0.35
        book.add(page)
      }
      group.add(book)
      floating.push({ book, a: (i / 6) * Math.PI * 2 })
    }
    ctx.animated.push((dt, t) => {
      for (const f of floating) {
        const a = f.a + t * 0.25
        f.book.position.set(Math.cos(a) * 2.6, 2.3 + Math.sin(t * 1.5 + f.a * 3) * 0.2, -0.6 + Math.sin(a) * 1.8)
        f.book.rotation.y = -a
        f.book.children.forEach((child, k) => { if (k % 2 === 0) child.rotation.z = (k < 2 ? -1 : 1) * (0.35 + Math.sin(t * 4 + f.a) * 0.15) })
      }
      chandelier.rotation.y = Math.sin(t * 0.4) * 0.08
    })
    // Cheminée et fauteuil de lecture (mur de droite).
    box(ctx, 0.9, 2.4, 2.4, 0x5a5578, w / 2 - 0.45, 1.2, -2.2)
    box(ctx, 0.3, 1.1, 1.4, 0x1a1020, w / 2 - 0.9, 0.55, -2.2)
    const flames = []
    for (let i = 0; i < 3; i++) {
      const f = mesh(new THREE.ConeGeometry(0.2, 0.6, 5), mat(i ? 0xffb347 : 0xff5a1f, { emissive: i ? 0xff9a2a : 0xff4a10, emissiveIntensity: 3 }), { x: w / 2 - 1.1, y: 0.35, z: -2.6 + i * 0.4, shadow: false })
      flames.push(f)
      group.add(f)
    }
    ctx.animated.push((dt, t) => flames.forEach((f, i) => { f.scale.y = 0.8 + Math.sin(t * 9 + i * 2) * 0.25 }))
    const fireLight = new THREE.PointLight(0xff8a30, 6, 6, 1.6)
    fireLight.position.set(w / 2 - 1.6, 1, -2.2)
    group.add(fireLight)
    ctx.addCollider(w / 2 - 0.6, -2.2, 1.3, 3)
    const chair = new THREE.Group()
    chair.add(mesh(new THREE.BoxGeometry(1, 0.45, 0.9), mat(0x7a2337), { y: 0.35 }))
    chair.add(mesh(new THREE.BoxGeometry(1, 1, 0.25), mat(0x7a2337), { y: 0.85, z: -0.35 }))
    for (const s of [-1, 1]) chair.add(mesh(new THREE.BoxGeometry(0.2, 0.7, 0.9), mat(0x6a1d2f), { x: s * 0.5, y: 0.5 }))
    chair.position.set(w / 2 - 2.6, 0, 0.6)
    chair.rotation.y = -2.3
    group.add(chair)
    ctx.addCollider(w / 2 - 2.6, 0.6, 0.7, 1.4)
    // Globe terrestre sur pied et pile de livres.
    group.add(mesh(new THREE.CylinderGeometry(0.06, 0.25, 0.9, 8), mat(wood), { x: w / 2 - 1.4, y: 0.45, z: 3.4 }))
    const globe = mesh(new THREE.SphereGeometry(0.4, 16, 12), mat(0x2f6fd8, { flatShading: false, roughness: 0.6 }), { x: w / 2 - 1.4, y: 1.3, z: 3.4 })
    group.add(globe)
    ctx.animated.push((dt) => { globe.rotation.y += dt * 0.4 })
    ctx.addCollider(w / 2 - 1.4, 3.4, 0.5)
    for (let i = 0; i < 5; i++) box(ctx, 0.5, 0.1, 0.36, colors[i], -w / 2 + 1.6, 0.05 + i * 0.1, 3.6).rotation.y = i * 0.3
    // Échelle de bibliothécaire.
    for (const s of [-1, 1]) {
      const rail = mesh(new THREE.BoxGeometry(0.06, 3.3, 0.06), mat(0x7a5232), { x: -1.9 + s * 0.25, y: 1.6, z: -d / 2 + 0.9 })
      rail.rotation.x = -0.18
      group.add(rail)
    }
    for (let i = 0; i < 7; i++) {
      const rung = mesh(new THREE.BoxGeometry(0.5, 0.05, 0.05), mat(0x7a5232), { x: -1.9, y: 0.3 + i * 0.45, z: -d / 2 + 0.95 - i * 0.08 })
      group.add(rung)
    }
    // Torches et bibliothécaire.
    for (const [x, z] of [[w / 2 - 0.25, 1.4], [w / 2 - 0.25, 4], [-w / 2 + 0.55, 4.2]]) torch(group, x, 2.2, z, ctx.animated)
    C.npc(ctx, 'mage', 2.5, 2.4, { keep: ['Spellbook_open', 'Mage_Hat'], anim: 'Spellcasting', speed: 0.4, path: [[2.5, 2.4], [-3, 2.6], [-1, 0.8]], walk: 0.7, pause: 4 })
  },

  base(ctx, w, d) {
    const { group } = ctx
    // Hublot panoramique sur les étoiles et la Terre.
    const stars = canvasTexture(512, 160, (g, W, H) => {
      g.fillStyle = '#05061a'
      g.fillRect(0, 0, W, H)
      for (let i = 0; i < 160; i++) {
        g.fillStyle = `rgba(255,255,255,${Math.random()})`
        g.fillRect(Math.random() * W, Math.random() * H, 2, 2)
      }
      const earth = g.createRadialGradient(380, 70, 5, 380, 70, 46)
      earth.addColorStop(0, '#7ad0ff')
      earth.addColorStop(0.7, '#2f6fd8')
      earth.addColorStop(1, '#0b1a40')
      g.fillStyle = earth
      g.beginPath()
      g.arc(380, 70, 46, 0, Math.PI * 2)
      g.fill()
      g.fillStyle = '#3ddc84'
      g.beginPath()
      g.arc(368, 60, 14, 0, Math.PI * 2)
      g.fill()
    })
    group.add(mesh(new THREE.PlaneGeometry(9, 2.2), new THREE.MeshStandardMaterial({ map: stars, emissiveMap: stars, emissive: 0xffffff, emissiveIntensity: 1 }), { y: 2.1, z: -d / 2 + 0.02, shadow: false }))
    box(ctx, 9.3, 0.2, 0.2, 0xcfd3e0, 0, 3.25, -d / 2 + 0.1)
    box(ctx, 9.3, 0.2, 0.2, 0xcfd3e0, 0, 0.95, -d / 2 + 0.1)
    // Bandes lumineuses au sol.
    for (const x of [-2, 2]) {
      const strip = mesh(new THREE.BoxGeometry(0.12, 0.02, d - 1), mat(0x7df9ff, { emissive: 0x3ad0ff, emissiveIntensity: 2 }), { x, y: 0.02, z: 0.5, shadow: false })
      group.add(strip)
    }
    // Couchettes et serre hydroponique.
    for (const z of [-2, 1]) {
      box(ctx, 1.2, 0.5, 2.4, 0xcfd3e0, -w / 2 + 1, 0.25, z)
      box(ctx, 1.1, 0.15, 2.2, 0x6a5cff, -w / 2 + 1, 0.55, z)
      ctx.addCollider(-w / 2 + 1, z, 1.3, 1)
    }
    for (let i = 0; i < 4; i++) {
      const x = w / 2 - 1
      const z = -3.5 + i * 1.6
      box(ctx, 1.2, 0.6, 1.2, 0x3a3d55, x, 0.3, z)
      group.add(mesh(new THREE.IcosahedronGeometry(0.45, 0), mat(0x3ddc84, { emissive: 0x1a8a4a, emissiveIntensity: 0.5 }), { x, y: 0.9, z }))
      ctx.addCollider(x, z, 0.8, 1.5)
    }
    box(ctx, 0.1, 0.1, 6.4, 0xb48cff, w / 2 - 0.4, 2.4, -1, { emissive: 0xb48cff, emissiveIntensity: 2.5 })
    // Équipage.
    for (const [x, z, route] of [[-3, 2, [[-3, 2], [2, 2.5], [0, -2]]], [3, -3, [[3, -3], [4, 1]]]]) {
      const a = C.npc(ctx, 'knight', x, z, { keep: [], path: route, walk: 0.9, pause: 3 })
      C.spaceSuit(a.object)
    }
    const pilot = C.npc(ctx, 'rogue', 2.5, -d / 2 + 1.6, { rotY: Math.PI, anim: 'Interact', speed: 0.6, r: 0, greet: false })
    C.spaceSuit(pilot.object)
    box(ctx, 2.2, 1, 0.7, 0x3a3d55, 2.5, 0.5, -d / 2 + 0.8, { metalness: 0.5 })
    ctx.addCollider(2.5, -d / 2 + 0.8, 1.2, 2)
  },
}
