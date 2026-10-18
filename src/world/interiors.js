import * as THREE from 'three'
import { mat, mesh, textTexture } from './helpers.js'
import { canvasTexture, codeScreen } from './points.js'
import { torch } from './buildings.js'
import * as C from './characters.js'
import * as S from './stoneworks.js'
import { showcases } from '../content.js'
import { drawVisual } from './screens.js'

// Intérieurs façon « maison dans Pokémon » : une pièce posée loin des îles, sur fond noir,
// vue de plus près et plus en plongée. On y entre par une porte (château, maison du
// développeur, base lunaire) et on en ressort par le tapis de sortie.

export const ROOMS = {
  castle: { era: 'past', name: 'La grande salle du château', tagline: 'Histoires et jeux du royaume', center: [-150, 520], w: 18, d: 13, wall: 0x6e6590, floor: 'stone' },
  studio: { era: 'present', name: 'Le studio du développeur', tagline: 'Bureau, coin rétro et salon', center: [0, 520], w: 16, d: 11, wall: 0x3a3438, floor: 'wood' },
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

const poster = (text, bg, fg) => new THREE.MeshStandardMaterial({ map: textTexture(text, { bg, fg, width: 256, height: 340, font: 'bold 40px "Outfit Variable", "Inter Variable", sans-serif' }) })


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


// ---------- Bureau industriel ----------

function brickTexture() {
  return canvasTexture(512, 256, (g, W, H) => {
    g.fillStyle = '#5a3a30'
    g.fillRect(0, 0, W, H)
    let s = 9
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647)
    const bw = 64
    const bh = 24
    for (let y = 0; y < H; y += bh + 4) {
      const off = ((y / (bh + 4)) % 2) * (bw / 2)
      for (let x = -bw; x < W + bw; x += bw + 4) {
        const l = 34 + rnd() * 12
        g.fillStyle = `hsl(${12 + rnd() * 10}, ${38 + rnd() * 12}%, ${l}%)`
        g.fillRect(x + off, y, bw, bh)
        g.fillStyle = 'rgba(255,255,255,0.05)'
        g.fillRect(x + off, y, bw, 3)
      }
    }
  })
}

// Suspension en métal noir avec ampoule à filament, accrochée à la poutre.
function pendant(ctx, x, z, drop) {
  const g = new THREE.Group()
  g.position.set(x, 3.62, z)
  ctx.group.add(g)
  g.add(mesh(new THREE.CylinderGeometry(0.008, 0.008, drop, 4), mat(0x1d1d22), { y: -drop / 2, shadow: false }))
  g.add(mesh(new THREE.ConeGeometry(0.32, 0.3, 16, 1, true), mat(0x1d1d22, { side: THREE.DoubleSide, metalness: 0.4, roughness: 0.5 }), { y: -drop - 0.12, shadow: false }))
  g.add(mesh(new THREE.SphereGeometry(0.09, 10, 8), new THREE.MeshStandardMaterial({ color: 0xfff1c8, emissive: 0xffb860, emissiveIntensity: 2.5 }), { y: -drop - 0.28, shadow: false }))
  const l = new THREE.PointLight(0xffc27a, 3, 4.5, 1.6)
  l.position.set(0, -drop - 0.5, 0)
  g.add(l)
}

function deskLamp(parent, x, y, z) {
  const black = mat(0x1d1d22)
  const lamp = new THREE.Group()
  lamp.position.set(x, y, z)
  lamp.rotation.y = Math.PI
  parent.add(lamp)
  lamp.add(mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.03, 14), black, { y: 0.015 }))
  const arm1 = mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.5, 6), black, { x: 0.07, y: 0.25 })
  arm1.rotation.z = -0.3
  lamp.add(arm1)
  const arm2 = mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.45, 6), black, { x: 0.3, y: 0.55 })
  arm2.rotation.z = 1.15
  lamp.add(arm2)
  const shade = mesh(new THREE.ConeGeometry(0.09, 0.15, 12, 1, true), mat(0x1d1d22, { side: THREE.DoubleSide }), { x: 0.5, y: 0.5 })
  shade.rotation.z = 0.5
  lamp.add(shade)
  lamp.add(mesh(new THREE.SphereGeometry(0.035, 8, 6), new THREE.MeshBasicMaterial({ color: 0xfff0c8 }), { x: 0.51, y: 0.46, shadow: false }))
}

// Étagère en tubes d'acier noir et planches de chêne, contre un mur.
function pipeShelves(ctx, x, z, rotY) {
  const g = new THREE.Group()
  g.position.set(x, 0, z)
  g.rotation.y = rotY
  ctx.group.add(g)
  const pipe = mat(0x1d1d22, { metalness: 0.5, roughness: 0.45 })
  const plank = mat(0xa8784a, { roughness: 0.7 })
  for (const s of [-1, 1]) {
    for (const dz of [0.05, 0.4]) g.add(mesh(new THREE.CylinderGeometry(0.025, 0.025, 2.6, 6), pipe, { x: s * 0.95, y: 1.3, z: dz }))
  }
  const colors = [0x2f6fd8, 0xe74c3c, 0xffd34f, 0x27ae60, 0xb48cff, 0x1d1d22, 0xf4f1e8]
  for (let row = 0; row < 4; row++) {
    const y = 0.35 + row * 0.62
    g.add(mesh(new THREE.BoxGeometry(2.05, 0.05, 0.5), plank, { y, z: 0.22 }))
    if (row === 0) {
      // Caisses de rangement en bas.
      for (const bx of [-0.5, 0.45]) g.add(mesh(new THREE.BoxGeometry(0.7, 0.32, 0.4), mat(0x8a6a4a), { x: bx, y: y + 0.18, z: 0.22 }))
    } else if (row === 2) {
      // Plante retombante.
      g.add(mesh(new THREE.CylinderGeometry(0.12, 0.1, 0.18, 10), mat(0xf4f1e8), { x: 0.55, y: y + 0.11, z: 0.22 }))
      for (let i = 0; i < 9; i++) {
        const leaf = mesh(new THREE.SphereGeometry(0.06, 6, 4), mat(0x3f9d5a), { x: 0.45 + (i % 3) * 0.08, y: y - 0.05 - (i * 0.07), z: 0.45 })
        leaf.scale.set(1, 0.5, 0.6)
        g.add(leaf)
      }
      for (let i = 0; i < 5; i++) g.add(mesh(new THREE.BoxGeometry(0.07, 0.3 + (i % 2) * 0.05, 0.24), mat(colors[i + 1]), { x: -0.8 + i * 0.09, y: y + 0.18, z: 0.22 }))
    } else {
      for (let i = 0; i < 7; i++) {
        const b = mesh(new THREE.BoxGeometry(0.07, 0.28 + (i % 3) * 0.05, 0.24), mat(colors[(i + row) % colors.length]), { x: -0.85 + i * 0.085 + (row % 2) * 0.9, y: y + 0.17, z: 0.22 })
        if (i === 6) b.rotation.z = 0.35
        g.add(b)
      }
      // Petit appareil photo argentique ou disque vinyle.
      if (row === 1) {
        g.add(mesh(new THREE.BoxGeometry(0.22, 0.14, 0.1), mat(0x24242a), { x: -0.45, y: y + 0.1, z: 0.22 }))
        g.add(mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.08, 10).rotateX(Math.PI / 2), mat(0x111114), { x: -0.45, y: y + 0.1, z: 0.32 }))
      } else {
        g.add(mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.01, 18).rotateX(Math.PI / 2), mat(0x111114), { x: -0.5, y: y + 0.18, z: 0.12 }))
      }
    }
  }
  g.add(mesh(new THREE.BoxGeometry(2.05, 0.05, 0.5), plank, { y: 2.6, z: 0.22 }))
  g.add(mesh(new THREE.CylinderGeometry(0.1, 0.08, 0.16, 10), mat(0xb46a3e), { x: -0.6, y: 2.71, z: 0.22 }))
  g.add(mesh(new THREE.IcosahedronGeometry(0.18, 0), mat(0x3f9d5a), { x: -0.6, y: 2.88, z: 0.22 }))
  const cos = Math.cos(rotY)
  const sin = Math.sin(rotY)
  for (const dx of [-0.6, 0.6]) ctx.addCollider(x + dx * cos + 0.25 * sin, z - dx * sin + 0.25 * cos, 0.5, 3)
}

function snakePlant(ctx, x, z) {
  const g = new THREE.Group()
  g.position.set(x, 0, z)
  ctx.group.add(g)
  g.add(mesh(new THREE.CylinderGeometry(0.24, 0.2, 0.45, 12), mat(0x2b2b33), { y: 0.22 }))
  for (let i = 0; i < 9; i++) {
    const a = i * 0.7
    const h = 0.7 + (i % 3) * 0.2
    const leaf = mesh(new THREE.ConeGeometry(0.07, h, 4), mat(i % 2 ? 0x3f7d3a : 0x5a9a4a), { x: Math.cos(a) * 0.1, y: 0.45 + h / 2, z: Math.sin(a) * 0.1 })
    leaf.scale.z = 0.3
    leaf.rotation.set(Math.sin(a) * 0.15, a, Math.cos(a) * 0.15)
    g.add(leaf)
  }
  ctx.addCollider(x, z, 0.3)
}

// Coin rétro : un Macintosh beige, des disquettes et une lampe, sur une table d'atelier.
function retroCorner(ctx, x, z) {
  const g = new THREE.Group()
  g.position.set(x, 0, z)
  g.rotation.y = -0.35
  ctx.group.add(g)
  const steel = mat(0x24242a, { metalness: 0.4, roughness: 0.5 })
  g.add(mesh(new THREE.BoxGeometry(1.5, 0.07, 0.8), mat(0x8a5a32, { roughness: 0.7 }), { y: 0.8 }))
  for (const [dx, dz] of [[-0.68, -0.33], [0.68, -0.33], [-0.68, 0.33], [0.68, 0.33]]) g.add(mesh(new THREE.BoxGeometry(0.05, 0.78, 0.05), steel, { x: dx, y: 0.39, z: dz }))
  g.add(mesh(new THREE.BoxGeometry(1.4, 0.04, 0.7), steel, { y: 0.2 }))
  const beige = mat(0xe9e0c9, { roughness: 0.75 })
  const mac = new THREE.Group()
  mac.position.set(-0.1, 0.84, 0)
  mac.scale.setScalar(1.25)
  g.add(mac)
  mac.add(mesh(new THREE.BoxGeometry(0.46, 0.56, 0.5), beige, { y: 0.28 }))
  mac.add(mesh(new THREE.BoxGeometry(0.36, 0.28, 0.02), mat(0xcfc6ae), { y: 0.35, z: 0.25 }))
  const screen = canvasTexture(128, 100, (c, W, H) => {
    c.fillStyle = '#d8d8c8'
    c.fillRect(0, 0, W, H)
    c.fillStyle = '#ffffff'
    c.fillRect(0, 0, W, 9)
    c.fillStyle = '#1d1d22'
    c.font = 'bold 7px monospace'
    c.fillText('  File  Edit  View  Special', 2, 7)
    c.fillStyle = '#ffffff'
    c.fillRect(18, 22, 92, 60)
    c.strokeStyle = '#1d1d22'
    c.strokeRect(18, 22, 92, 60)
    c.fillRect(18, 22, 92, 9)
    c.fillStyle = '#1d1d22'
    c.font = 'bold 8px monospace'
    c.fillText('antoinequarroz.ch', 22, 45)
    c.font = '7px monospace'
    c.fillText('Hello, world!', 22, 58)
    c.fillText('> _', 22, 72)
  })
  mac.add(mesh(new THREE.PlaneGeometry(0.3, 0.23), new THREE.MeshStandardMaterial({ map: screen, emissiveMap: screen, emissive: 0xffffff, emissiveIntensity: 0.7 }), { y: 0.35, z: 0.262, shadow: false }))
  mac.add(mesh(new THREE.BoxGeometry(0.14, 0.02, 0.01), mat(0x2b2b33), { x: 0.08, y: 0.12, z: 0.252 }))
  mac.add(mesh(new THREE.BoxGeometry(0.44, 0.03, 0.18), beige, { y: 0.015, z: 0.38 }))
  // Disquettes colorées.
  for (let i = 0; i < 4; i++) g.add(mesh(new THREE.BoxGeometry(0.16, 0.012, 0.16), mat([0x2f6fd8, 0xe74c3c, 0xffd34f, 0x1d1d22][i]), { x: 0.5, y: 0.845 + i * 0.013, z: 0.12 }))
  deskLamp(g, 0.55, 0.83, -0.2)
  ctx.addCollider(x, z, 0.85, 1.5)
}

// Meuble télé et grand écran qui fait défiler les visuels de mes projets.
function tvCorner(ctx, x, z) {
  const g = new THREE.Group()
  g.position.set(x, 0, z)
  g.rotation.y = -Math.PI / 2
  ctx.group.add(g)
  const steel = mat(0x24242a, { metalness: 0.4, roughness: 0.5 })
  g.add(mesh(new THREE.BoxGeometry(2.4, 0.5, 0.5), mat(0x6b4426, { roughness: 0.6 }), { y: 0.35, z: 0.25 }))
  for (const s of [-1, 1]) g.add(mesh(new THREE.BoxGeometry(0.05, 0.1, 0.45), steel, { x: s * 1.1, y: 0.05, z: 0.25 }))
  g.add(mesh(new THREE.BoxGeometry(0.3, 0.06, 0.25), mat(0xf4f1e8), { x: -0.8, y: 0.63, z: 0.25 }))
  g.add(mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.2, 10), mat(0x3f9d5a), { x: 0.9, y: 0.7, z: 0.25 }))
  g.add(mesh(new THREE.BoxGeometry(2.0, 1.15, 0.06), mat(0x111114), { y: 1.65, z: 0.06 }))
  const canvas = document.createElement('canvas')
  canvas.width = 600
  canvas.height = 300
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  const screenMat = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.9 })
  g.add(mesh(new THREE.PlaneGeometry(1.92, 1.07), screenMat, { y: 1.65, z: 0.095, shadow: false }))
  const list = showcases.flatMap((p) => p.projects).filter((p) => p.image)
  const c2 = canvas.getContext('2d')
  let index = 0
  const draw = () => {
    c2.clearRect(0, 0, 600, 300)
    drawVisual(c2, list[index % list.length], 0, 0, 600, 300, draw)
    tex.needsUpdate = true
  }
  draw()
  let clock = 0
  ctx.animated.push((dt) => {
    clock += dt
    if (clock > 5) {
      clock = 0
      index++
      draw()
    }
  })
  ctx.addCollider(x - 0.25, z, 0.7, 1)
}

// Lampadaire en arc au-dessus du canapé.
function arcLamp(ctx, x, z) {
  const g = new THREE.Group()
  g.position.set(x, 0, z)
  ctx.group.add(g)
  const steel = mat(0x24242a, { metalness: 0.5, roughness: 0.4 })
  g.add(mesh(new THREE.BoxGeometry(0.35, 0.12, 0.35), mat(0xe8e2d8), { y: 0.06 }))
  const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, 0.1, 0), new THREE.Vector3(0.2, 3.2, -0.2), new THREE.Vector3(1.4, 2.4, -1.4))
  g.add(mesh(new THREE.TubeGeometry(curve, 20, 0.02, 5), steel))
  g.add(mesh(new THREE.SphereGeometry(0.22, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(0x24242a, { side: THREE.DoubleSide }), { x: 1.4, y: 2.3, z: -1.4 }))
  g.add(mesh(new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshBasicMaterial({ color: 0xfff1c8 }), { x: 1.4, y: 2.25, z: -1.4, shadow: false }))
  ctx.addCollider(x, z, 0.25)
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
    const sign = mesh(new THREE.PlaneGeometry(1.9, 0.5), new THREE.MeshBasicMaterial({ map: textTexture('📚 Bibliothèque', { bg: '#2a1a3a', fg: '#ffd27a', width: 512, height: 136, font: 'bold 56px "Outfit Variable", "Inter Variable", sans-serif' }) }), { y: 3.15, z: 0.08, shadow: false })
    arch.add(sign)
    group.add(arch)
    // Râtelier d'armes et armure.
    box(ctx, 2, 1.6, 0.4, 0x6b4226, 6.5, 0.8, 3.8)
    for (const x of [5.8, 6.3, 6.8, 7.2]) box(ctx, 0.08, 1.4, 0.08, 0xcfd3e0, x, 1.1, 3.6, { metalness: 0.7 })
    ctx.addCollider(6.5, 3.8, 1.1, 2)
    // Gardiens de pierre de part et d'autre de l'entrée.
    S.useTheme('past')
    for (const sx of [-1, 1]) S.statue(ctx, sx * 2.3, d / 2 - 3.3, { key: 'knight', anim: 'Idle', time: 0.2, keep: ['2H_Sword', 'Knight_Helmet', 'Knight_Cape'], height: 2, rotY: Math.PI - sx * 0.4 + Math.PI, r: 0.6 })
    // Le roi sur son trône, un mage et un garde qui fait sa ronde.
    const king = C.npc(ctx, 'knight', 0, -d / 2 + 1.35, { keep: ['Knight_Cape', 'Knight_Helmet'], anim: 'Sit_Chair_Idle', r: 0, greet: false })
    king.object.position.y = 0.8
    C.npc(ctx, 'mage', -3, -3.5, { keep: ['Spellbook_open', 'Mage_Hat'], anim: 'Spellcasting', speed: 0.5, path: [[-3, -3.5], [-3, 1.2]], walk: 0.8, pause: 4 })
    C.npc(ctx, 'barbarian', 3.6, 3, { keep: ['1H_Axe', 'Barbarian_Hat'], path: [[3.6, 3], [3.6, -3], [5.5, 0]], walk: 1, pause: 2.5 })
  },

  // Bureau industriel : mur de briques et grande verrière, poutre d'acier et suspensions,
  // bureau en bois massif sur tréteaux noirs avec MacBook et grand écran, étagères en
  // tubes noirs, coin rétro avec un vieux Mac, salon avec canapé en cuir, table basse
  // (le téléphone des applis mobiles) et télé qui fait défiler mes projets.
  studio(ctx, w, d) {
    const { group } = ctx
    const steelMat = mat(0x24242a, { roughness: 0.5, metalness: 0.4 })
    const oak = mat(0x9a6a3e, { roughness: 0.65 })
    const walnut = mat(0x6b4426, { roughness: 0.6 })
    // Briques sur le mur du fond, enduit sombre sur les côtés.
    const brick = brickTexture()
    brick.wrapS = brick.wrapT = THREE.RepeatWrapping
    brick.repeat.set(w / 4, 1.2)
    const bricks = mesh(new THREE.PlaneGeometry(w, 3.6), new THREE.MeshStandardMaterial({ map: brick, roughness: 0.95 }), { y: 1.8, z: -d / 2 + 0.01, shadow: false })
    group.add(bricks)
    for (const s of [-1, 1]) {
      const side = mesh(new THREE.PlaneGeometry(d, 3.6), new THREE.MeshStandardMaterial({ map: brick, roughness: 0.95, color: 0xc8beb4 }), { x: s * (w / 2 - 0.01), y: 1.8, shadow: false })
      side.rotation.y = -s * Math.PI / 2
      group.add(side)
    }
    // Grande verrière à petits carreaux : la ville au crépuscule.
    const sky = canvasTexture(512, 220, (g, W, H) => {
      const grad = g.createLinearGradient(0, 0, 0, H)
      grad.addColorStop(0, '#ff9a4a')
      grad.addColorStop(0.6, '#c0508a')
      grad.addColorStop(1, '#4a2a6a')
      g.fillStyle = grad
      g.fillRect(0, 0, W, H)
      let s = 5
      const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647)
      for (let x = 0; x < W; x += 20 + rnd() * 18) {
        const bh = 50 + rnd() * 110
        g.fillStyle = '#2a1a3a'
        g.fillRect(x, H - bh, 20, bh)
        g.fillStyle = '#ffd27a'
        for (let y = H - bh + 6; y < H - 6; y += 11) if (rnd() > 0.45) g.fillRect(x + 4, y, 4, 5)
      }
    })
    const winX = -1.6
    group.add(mesh(new THREE.PlaneGeometry(5.6, 2.3), new THREE.MeshStandardMaterial({ map: sky, emissiveMap: sky, emissive: 0xffffff, emissiveIntensity: 0.9 }), { x: winX, y: 2.05, z: -d / 2 + 0.03, shadow: false }))
    for (let i = 0; i <= 7; i++) box(ctx, 0.07, 2.4, 0.08, 0x1d1d22, winX - 2.8 + i * 0.8, 2.05, -d / 2 + 0.06)
    for (let j = 0; j <= 3; j++) box(ctx, 5.7, 0.07, 0.08, 0x1d1d22, winX, 0.9 + j * 0.767, -d / 2 + 0.06)
    // Suspensions industrielles, accrochées à des tringles fixées au mur de briques.
    for (const [x0, x1] of [[-5.6, -1.2], [4.6, 7.0]]) {
      box(ctx, x1 - x0, 0.05, 0.05, 0x1d1d22, (x0 + x1) / 2, 3.62, -d / 2 + 1.3)
      for (const ax of [x0 + 0.1, x1 - 0.1]) box(ctx, 0.05, 0.05, 1.3, 0x1d1d22, ax, 3.62, -d / 2 + 0.65)
    }
    for (const lx of [-4.8, -2.0, 5.8]) pendant(ctx, lx, -d / 2 + 1.3, 1.15)
    // Néon « </> » sur les briques.
    const neon = canvasTexture(256, 128, (g, W, H) => {
      g.fillStyle = 'rgba(0,0,0,0)'
      g.clearRect(0, 0, W, H)
      g.shadowColor = '#ff7ad9'
      g.shadowBlur = 18
      g.fillStyle = '#ffd0f0'
      g.font = 'bold 88px "Outfit Variable", "Inter Variable", sans-serif'
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      g.fillText('</>', W / 2, H / 2)
    })
    const neonSign = mesh(new THREE.PlaneGeometry(1.6, 0.8), new THREE.MeshBasicMaterial({ map: neon, transparent: true, depthWrite: false }), { x: 4.4, y: 2.6, z: -d / 2 + 0.04, shadow: false })
    group.add(neonSign)

    // ---- Le bureau ----
    const desk = new THREE.Group()
    desk.position.set(-3.4, 0, -d / 2 + 1.15)
    desk.scale.setScalar(1.25)
    group.add(desk)
    desk.add(mesh(new THREE.BoxGeometry(3.4, 0.09, 1.0), oak, { y: 0.78 }))
    // Tréteaux en acier noir.
    for (const s of [-1, 1]) {
      desk.add(mesh(new THREE.BoxGeometry(0.06, 0.06, 0.86), steelMat, { x: s * 1.45, y: 0.72 }))
      desk.add(mesh(new THREE.BoxGeometry(0.06, 0.06, 0.86), steelMat, { x: s * 1.45, y: 0.03 }))
      for (const dz of [-0.4, 0.4]) desk.add(mesh(new THREE.BoxGeometry(0.06, 0.72, 0.06), steelMat, { x: s * 1.45, y: 0.38, z: dz }))
      const cross = mesh(new THREE.BoxGeometry(0.04, 0.95, 0.04), steelMat, { x: s * 1.45, y: 0.38 })
      cross.rotation.x = 0.9
      desk.add(cross)
    }
    // MacBook Pro ouvert sur un support, écran vers l'utilisateur.
    const mb = new THREE.Group()
    mb.position.set(-0.75, 0.83, 0.02)
    mb.rotation.y = 0.18
    desk.add(mb)
    const alu = mat(0xb8bcc8, { metalness: 0.7, roughness: 0.3, flatShading: false })
    const standA = mesh(new THREE.BoxGeometry(0.34, 0.015, 0.3), alu, { y: 0.1, z: 0 })
    standA.rotation.x = 0.28
    mb.add(standA)
    mb.add(mesh(new THREE.BoxGeometry(0.04, 0.12, 0.04), alu, { y: 0.05, z: -0.1 }))
    mb.add(mesh(new THREE.BoxGeometry(0.46, 0.018, 0.32), mat(0x5a5d66, { metalness: 0.7, roughness: 0.3 }), { y: 0.13, z: 0.01 }).rotateX(0.28))
    const lid = new THREE.Group()
    lid.position.set(0, 0.17, -0.14)
    lid.rotation.x = -0.15
    mb.add(lid)
    lid.add(mesh(new THREE.BoxGeometry(0.46, 0.31, 0.012), mat(0x5a5d66, { metalness: 0.7, roughness: 0.3 }), { y: 0.155 }))
    const macTex = macScreen()
    lid.add(mesh(new THREE.PlaneGeometry(0.43, 0.28), new THREE.MeshStandardMaterial({ map: macTex, emissiveMap: macTex, emissive: 0xffffff, emissiveIntensity: 1.1 }), { y: 0.155, z: 0.007, shadow: false }))
    // Grand écran sur bras.
    const disp = new THREE.Group()
    disp.position.set(0.35, 0.83, -0.25)
    disp.rotation.y = -0.12
    desk.add(disp)
    disp.add(mesh(new THREE.BoxGeometry(1.3, 0.76, 0.035), alu, { y: 0.62 }))
    disp.add(mesh(new THREE.PlaneGeometry(1.26, 0.72), new THREE.MeshBasicMaterial({ color: 0x0c0c10 }), { y: 0.62, z: 0.018, shadow: false }))
    const des = designScreen()
    disp.add(mesh(new THREE.PlaneGeometry(1.2, 0.67), new THREE.MeshStandardMaterial({ map: des, emissiveMap: des, emissive: 0xffffff, emissiveIntensity: 1.1 }), { y: 0.62, z: 0.019, shadow: false }))
    disp.add(mesh(new THREE.BoxGeometry(0.06, 0.32, 0.04), alu, { y: 0.18, z: -0.08 }))
    disp.add(mesh(new THREE.BoxGeometry(0.28, 0.012, 0.22), alu, { y: 0.006, z: -0.06 }))
    // Clavier, trackpad, carnet, tasse, lampe et petite plante.
    desk.add(mesh(new THREE.BoxGeometry(0.44, 0.014, 0.14), mat(0xe8e8ee, { flatShading: false }), { x: 0.3, y: 0.83, z: 0.26 }))
    desk.add(mesh(new THREE.BoxGeometry(0.16, 0.008, 0.12), mat(0xd8d8e0), { x: 0.65, y: 0.83, z: 0.26 }))
    desk.add(mesh(new THREE.BoxGeometry(0.22, 0.02, 0.3), mat(0x2f3a5a), { x: -1.3, y: 0.835, z: 0.2 }))
    desk.add(mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.1, 12), mat(0xf4f1e8), { x: 1.0, y: 0.87, z: 0.25 }))
    deskLamp(desk, 1.35, 0.83, -0.3)
    for (let i = 0; i < 6; i++) {
      const leaf = mesh(new THREE.SphereGeometry(0.07, 6, 4), mat(0x3f9d5a), { x: -1.45 + Math.cos(i * 1.2) * 0.05, y: 0.98 + (i % 2) * 0.05, z: -0.3 + Math.sin(i * 1.2) * 0.05 })
      leaf.scale.set(0.6, 1.4, 0.3)
      leaf.rotation.set(Math.sin(i) * 0.6, i, Math.cos(i) * 0.6)
      desk.add(leaf)
    }
    desk.add(mesh(new THREE.CylinderGeometry(0.08, 0.06, 0.13, 10), mat(0xb46a3e), { x: -1.45, y: 0.89, z: -0.3 }))
    // Chaise en cuir et acier.
    const chair = new THREE.Group()
    chair.position.set(-0.2, 0, 0.85)
    chair.rotation.y = Math.PI + 0.1
    desk.add(chair)
    chair.add(mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.38, 8), steelMat, { y: 0.25 }))
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2
      const leg = mesh(new THREE.BoxGeometry(0.34, 0.03, 0.05), steelMat, { x: Math.cos(a) * 0.17, y: 0.06, z: Math.sin(a) * 0.17 })
      leg.rotation.y = -a
      chair.add(leg)
    }
    chair.add(mesh(new THREE.BoxGeometry(0.52, 0.09, 0.5), mat(0x8a4a24, { roughness: 0.55 }), { y: 0.46 }))
    const back = mesh(new THREE.BoxGeometry(0.5, 0.62, 0.07), mat(0x8a4a24, { roughness: 0.55 }), { y: 0.85, z: -0.26 })
    back.rotation.x = 0.12
    chair.add(back)
    for (const dx of [-1.5, 0, 1.5]) ctx.addCollider(desk.position.x + dx * 1.25, desk.position.z, 0.8, 2)
    const dev = C.npc(ctx, 'rogue', desk.position.x - 0.25, desk.position.z + 1.2, { rotY: Math.PI, anim: 'Sit_Chair_Idle', r: 0.5, greet: false })
    dev.object.position.y = 0.2

    // ---- Étagères en tubes noirs et planches, contre le mur de gauche ----
    pipeShelves(ctx, -w / 2 + 0.35, -1.4, Math.PI / 2)
    pipeShelves(ctx, -w / 2 + 0.35, 1.6, Math.PI / 2)
    monstera(ctx, -w / 2 + 0.9, -d / 2 + 0.9)
    snakePlant(ctx, -0.4, -d / 2 + 0.6)

    // ---- Coin rétro : vieux Mac sur une petite table ----
    retroCorner(ctx, w / 2 - 1.6, -d / 2 + 1.0)
    monstera(ctx, w / 2 - 0.7, -d / 2 + 0.8, 0.8)

    // ---- Salon ----
    const rugTex = canvasTexture(256, 160, (g, W, H) => {
      g.fillStyle = '#c7b49a'
      g.fillRect(0, 0, W, H)
      g.strokeStyle = '#8a5a3a'
      g.lineWidth = 6
      g.strokeRect(10, 10, W - 20, H - 20)
      g.fillStyle = 'rgba(138, 90, 58, 0.35)'
      for (let i = 0; i < 6; i++) g.fillRect(30 + i * 36, 30, 14, H - 60)
    })
    const rug = mesh(new THREE.BoxGeometry(4.2, 0.02, 3), new THREE.MeshStandardMaterial({ map: rugTex, roughness: 1 }), { x: 4.4, y: 0.01, z: 1.6, shadow: false })
    rug.receiveShadow = true
    group.add(rug)
    // Canapé en cuir cognac, tourné vers la télé (mur de droite).
    const sofa = new THREE.Group()
    sofa.position.set(2.6, 0, 1.6)
    sofa.rotation.y = Math.PI / 2
    group.add(sofa)
    const leather = mat(0x9a4f22, { roughness: 0.5 })
    sofa.add(mesh(new THREE.BoxGeometry(2.6, 0.42, 0.95), leather, { y: 0.33 }))
    sofa.add(mesh(new THREE.BoxGeometry(2.6, 0.7, 0.25), leather, { y: 0.75, z: -0.38 }))
    for (const s of [-1, 1]) sofa.add(mesh(new THREE.BoxGeometry(0.22, 0.6, 0.95), leather, { x: s * 1.25, y: 0.5 }))
    for (const s of [-0.62, 0.62]) sofa.add(mesh(new THREE.BoxGeometry(1.15, 0.12, 0.7), mat(0xa85a2a, { roughness: 0.5 }), { x: s, y: 0.6, z: 0.05 }))
    for (const [dx, dz] of [[-1.2, -0.4], [1.2, -0.4], [-1.2, 0.4], [1.2, 0.4]]) sofa.add(mesh(new THREE.BoxGeometry(0.05, 0.12, 0.05), steelMat, { x: dx, y: 0.06, z: dz }))
    sofa.add(mesh(new THREE.BoxGeometry(0.42, 0.36, 0.14), mat(0x3f6f6a), { x: -0.8, y: 0.85, z: -0.18 }))
    ctx.addCollider(2.6, 1.0, 0.7, 1.2)
    ctx.addCollider(2.6, 2.2, 0.7, 1.2)
    C.npc(ctx, 'mage', 2.75, 2.2, { keep: [], anim: 'Sit_Chair_Idle', rotY: Math.PI / 2, r: 0, greet: false }).object.position.y = 0.32
    // Table basse bois et acier, avec le téléphone.
    const table = new THREE.Group()
    table.position.set(4.5, 0, 1.6)
    group.add(table)
    table.add(mesh(new THREE.BoxGeometry(1.0, 0.07, 1.5), walnut, { y: 0.42 }))
    for (const s of [-1, 1]) {
      table.add(mesh(new THREE.BoxGeometry(0.9, 0.04, 0.04), steelMat, { y: 0.36, z: s * 0.68 }))
      table.add(mesh(new THREE.BoxGeometry(0.04, 0.38, 0.04), steelMat, { x: 0.43, y: 0.19, z: s * 0.68 }))
      table.add(mesh(new THREE.BoxGeometry(0.04, 0.38, 0.04), steelMat, { x: -0.43, y: 0.19, z: s * 0.68 }))
    }
    const phone = new THREE.Group()
    phone.position.set(0.05, 0.465, -0.1)
    phone.rotation.y = 0.4
    table.add(phone)
    phone.add(mesh(new THREE.BoxGeometry(0.16, 0.015, 0.32), mat(0x2b2b33, { metalness: 0.5, roughness: 0.3 }), {}))
    const appTex = canvasTexture(96, 192, (g, W, H) => {
      const grad = g.createLinearGradient(0, 0, 0, H)
      grad.addColorStop(0, '#ff6fb1')
      grad.addColorStop(1, '#6a3aa8')
      g.fillStyle = grad
      g.fillRect(0, 0, W, H)
      const icons = ['#ffffff', '#3fd6a8', '#ffb347', '#8fbf6f', '#58d0ff', '#ff5f56', '#b48cff', '#ffd34f']
      icons.forEach((c, i) => {
        g.fillStyle = c
        g.beginPath()
        g.roundRect(12 + (i % 3) * 26, 26 + Math.floor(i / 3) * 30, 20, 20, 5)
        g.fill()
      })
    })
    const appScreen = mesh(new THREE.PlaneGeometry(0.14, 0.29), new THREE.MeshStandardMaterial({ map: appTex, emissiveMap: appTex, emissive: 0xffffff, emissiveIntensity: 1 }), { y: 0.009, shadow: false })
    appScreen.rotation.x = -Math.PI / 2
    phone.add(appScreen)
    table.add(mesh(new THREE.CylinderGeometry(0.05, 0.045, 0.1, 10), mat(0xf4f1e8), { x: -0.25, y: 0.5, z: 0.45 }))
    for (let i = 0; i < 3; i++) table.add(mesh(new THREE.BoxGeometry(0.3, 0.035, 0.22), mat([0x2f6fd8, 0xe8743b, 0x1d1d22][i]), { x: -0.2, y: 0.475 + i * 0.035, z: -0.45 }))
    ctx.addCollider(4.5, 1.6, 0.75, 0.6)
    // Télé sur meuble en bois et acier, contre le mur de droite : diaporama de mes projets.
    tvCorner(ctx, w / 2 - 0.45, 1.6)
    // Lampe arc au-dessus du canapé et plantes.
    arcLamp(ctx, 1.6, 3.4)
    monstera(ctx, w / 2 - 0.8, 4.0, 0.75)
    monstera(ctx, -w / 2 + 0.8, 4.0, 0.7)
    // Douce lumière chaude d'ensemble.
    const fill = new THREE.PointLight(0xffc98a, 6, 9, 1.6)
    fill.position.set(4, 2.6, 1.2)
    group.add(fill)
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
    // Statue de marbre du premier cosmonaute, entre deux piliers néon.
    S.useTheme('future')
    S.statue(ctx, -4.6, 3.6, { key: 'rogue', anim: 'Cheer', time: 0.5, keep: [], height: 2, suit: true, rotY: 0.3, r: 0.7 })
    for (const sx of [-1, 1]) S.runePillar(ctx, -4.6 + sx * 1.7, 4.3, { h: 1.3, color: S.theme().runes[sx < 0 ? 0 : 1] })
    const pilot = C.npc(ctx, 'rogue', 2.5, -d / 2 + 1.6, { rotY: Math.PI, anim: 'Interact', speed: 0.6, r: 0, greet: false })
    C.spaceSuit(pilot.object)
    box(ctx, 2.2, 1, 0.7, 0x3a3d55, 2.5, 0.5, -d / 2 + 0.8, { metalness: 0.5 })
    ctx.addCollider(2.5, -d / 2 + 0.8, 1.2, 2)
  },
}
