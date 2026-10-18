import * as THREE from 'three'
import { mat, mesh, textTexture } from './helpers.js'
import { canvasTexture } from './points.js'
import * as C from './characters.js'

// Les trois studios du Présent, chacun sur sa petite île : studio photo (Parc),
// studio vidéo (Stade) et GitHub Café (Toits). Même esprit que le reste du village :
// objets simples, couleurs chaudes, un peu de lumière et des habitants au travail.
// Chaque studio est construit face à la caméra (le fond vers -z).

const black = () => mat(0x1d1d22, { roughness: 0.55 })
const steel = () => mat(0x8a8fa8, { metalness: 0.6, roughness: 0.4 })

// Groupe posé à (x, z) et fonction pour placer une collision en coordonnées du studio.
function base(ctx, x, z, rotY = 0) {
  const g = new THREE.Group()
  g.position.set(x, 0, z)
  g.rotation.y = rotY
  ctx.group.add(g)
  const cos = Math.cos(rotY)
  const sin = Math.sin(rotY)
  const col = (dx, dz, r, top = 2.5) => ctx.addCollider(x + dx * cos + dz * sin, z - dx * sin + dz * cos, r, top)
  return { g, col }
}

// Fond de studio : une feuille qui descend du haut et s'arrondit au sol (cyclo).
function sweepGeometry(width, height, depth, radius) {
  const segs = 18
  const geo = new THREE.PlaneGeometry(width, 1, 1, segs)
  const pos = geo.attributes.position
  const total = height - radius + (Math.PI / 2) * radius + depth - radius
  for (let i = 0; i < pos.count; i++) {
    const v = 0.5 - pos.getY(i) // 0 en haut, 1 en bas
    let s = v * total
    let y
    let z
    if (s < height - radius) {
      y = height - s
      z = 0
    } else if ((s -= height - radius) < (Math.PI / 2) * radius) {
      const a = s / radius
      y = radius - Math.sin(a) * radius
      z = radius - Math.cos(a) * radius
    } else {
      s -= (Math.PI / 2) * radius
      y = 0.01
      z = radius + s
    }
    pos.setY(i, y)
    pos.setZ(i, z)
  }
  geo.computeVertexNormals()
  return geo
}

function backdrop(g, { width = 4.4, height = 3, depth = 2.4, color = 0xf2efe9, z = -1.8, emissive = 0 }) {
  const sheet = mesh(sweepGeometry(width, height, depth, 0.7), new THREE.MeshStandardMaterial({ color, roughness: 0.95, emissive: color, emissiveIntensity: emissive, side: THREE.DoubleSide }), { z, y: 0.02 })
  sheet.castShadow = false
  g.add(sheet)
  // Deux pieds et la barre qui tient le rouleau.
  for (const s of [-1, 1]) {
    g.add(mesh(new THREE.CylinderGeometry(0.035, 0.035, height + 0.4, 6), black(), { x: s * (width / 2 + 0.15), y: (height + 0.4) / 2, z: z - 0.05 }))
    for (let k = 0; k < 3; k++) {
      const leg = mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.7, 4), black(), { x: s * (width / 2 + 0.15) + Math.cos(k * 2.1) * 0.25, y: 0.2, z: z - 0.05 + Math.sin(k * 2.1) * 0.25 })
      leg.rotation.set(Math.sin(k * 2.1) * 0.9, 0, -Math.cos(k * 2.1) * 0.9)
      g.add(leg)
    }
  }
  const roll = mesh(new THREE.CylinderGeometry(0.09, 0.09, width + 0.3, 10).rotateZ(Math.PI / 2), mat(color), { y: height + 0.05, z: z - 0.02 })
  g.add(roll)
}

// Pied d'éclairage : trépied, mât et tête orientée vers une cible.
function lightStand(g, x, z, { h = 2.3, head, aimX = 0, aimZ = 0, aimY = 1.2 }) {
  const s = new THREE.Group()
  s.position.set(x, 0, z)
  g.add(s)
  for (let k = 0; k < 3; k++) {
    const a = k * 2.094
    const leg = mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.75, 4), black(), { x: Math.cos(a) * 0.24, y: 0.25, z: Math.sin(a) * 0.24 })
    leg.rotation.set(Math.sin(a) * 0.85, 0, -Math.cos(a) * 0.85)
    s.add(leg)
  }
  s.add(mesh(new THREE.CylinderGeometry(0.025, 0.03, h, 6), black(), { y: h / 2 }))
  const pivot = new THREE.Group()
  pivot.position.y = h
  s.add(pivot)
  // La tête regarde la cible (son avant est +z).
  const dx = aimX - x
  const dy = aimY - h
  const dz = aimZ - z
  pivot.rotation.set(-Math.atan2(dy, Math.hypot(dx, dz)), Math.atan2(dx, dz), 0, 'YXZ')
  head(pivot)
  return s
}

// Boîte à lumière : pyramide noire et face avant blanche lumineuse (vers +z du pivot).
function softbox(pivot) {
  const body = mesh(new THREE.CylinderGeometry(0.12, 0.55, 0.55, 4, 1, true).rotateX(Math.PI / 2).rotateZ(Math.PI / 4), mat(0x1d1d22, { side: THREE.DoubleSide }), { z: 0.18 })
  pivot.add(body)
  pivot.add(mesh(new THREE.PlaneGeometry(0.76, 0.76), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff4e0, emissiveIntensity: 1.6 }), { z: 0.46, shadow: false }))
}

// Projecteur de cinéma (fresnel) avec volets.
function fresnel(pivot) {
  pivot.add(mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.42, 12).rotateX(Math.PI / 2), mat(0x2b2b33, { metalness: 0.4 }), {}))
  pivot.add(mesh(new THREE.CircleGeometry(0.17, 16), new THREE.MeshStandardMaterial({ color: 0xfff1c8, emissive: 0xffd28a, emissiveIntensity: 2.2 }), { z: 0.215, shadow: false }))
  for (const [x, y, rz] of [[0, 0.26, 0], [0, -0.26, 0], [0.26, 0, Math.PI / 2], [-0.26, 0, Math.PI / 2]]) {
    const flap = mesh(new THREE.BoxGeometry(0.34, 0.015, 0.2), black(), { x, y, z: 0.3 })
    flap.rotation.z = rz
    flap.rotation.x = y > 0 ? -0.35 : y < 0 ? 0.35 : 0
    flap.rotation.y = x > 0 ? 0.35 : x < 0 ? -0.35 : 0
    pivot.add(flap)
  }
}

// Parapluie de studio, ouvert vers le sujet.
function umbrella(pivot) {
  const u = mesh(new THREE.ConeGeometry(0.75, 0.38, 12, 1, true).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xffffff, side: THREE.DoubleSide, emissive: 0xffffff, emissiveIntensity: 0.35, roughness: 1 }), { z: 0.05 })
  pivot.add(u)
  pivot.add(mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.8, 4).rotateX(Math.PI / 2), black(), { z: -0.1 }))
  pivot.add(mesh(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshBasicMaterial({ color: 0xfff4e0 }), { z: -0.12, shadow: false }))
}

function tripod(g, x, z, h = 1.35) {
  const t = new THREE.Group()
  t.position.set(x, 0, z)
  g.add(t)
  for (let k = 0; k < 3; k++) {
    const a = k * 2.094 + 0.5
    const leg = mesh(new THREE.CylinderGeometry(0.02, 0.015, h * 1.05, 4), black(), { x: Math.cos(a) * 0.22, y: h / 2, z: Math.sin(a) * 0.22 })
    leg.rotation.set(Math.sin(a) * 0.32, 0, -Math.cos(a) * 0.32)
    t.add(leg)
  }
  t.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.08, 8), black(), { y: h }))
  return t
}

// Appareil photo hybride : boîtier, poignée, objectif, flash.
function photoCamera(parent, y) {
  const cam = new THREE.Group()
  cam.position.y = y
  parent.add(cam)
  cam.add(mesh(new THREE.BoxGeometry(0.34, 0.22, 0.14), mat(0x24242a, { roughness: 0.5 }), { y: 0.11 }))
  cam.add(mesh(new THREE.BoxGeometry(0.1, 0.24, 0.16), mat(0x1a1a1e), { x: 0.14, y: 0.12 }))
  cam.add(mesh(new THREE.BoxGeometry(0.14, 0.07, 0.12), mat(0x24242a), { x: -0.03, y: 0.25 }))
  cam.add(mesh(new THREE.CylinderGeometry(0.075, 0.08, 0.2, 14).rotateX(Math.PI / 2), mat(0x111114, { roughness: 0.4 }), { x: -0.03, y: 0.11, z: -0.16 }))
  cam.add(mesh(new THREE.CircleGeometry(0.06, 14), mat(0x3a5a8a, { metalness: 0.6, roughness: 0.15 }), { x: -0.03, y: 0.11, z: -0.262 }).rotateY(Math.PI))
  cam.add(mesh(new THREE.CylinderGeometry(0.081, 0.081, 0.03, 14).rotateX(Math.PI / 2), mat(0xd6402f), { x: -0.03, y: 0.11, z: -0.2 }))
  return cam
}

// Photo encadrée (paysage dessiné) : montagnes, ciel, étoiles ou lac.
function printTexture(kind) {
  return canvasTexture(256, 180, (g, W, H) => {
    const sky = g.createLinearGradient(0, 0, 0, H)
    const palettes = {
      dusk: ['#2b1d5a', '#c0508a', '#ffb36b'],
      night: ['#070a1f', '#1b2a5a', '#3a4a8a'],
      snow: ['#7fb7ff', '#cfe6ff', '#ffffff'],
      lake: ['#ffcf8a', '#ff9a6a', '#7a5aa0'],
    }
    const [a, b, c] = palettes[kind]
    sky.addColorStop(0, a)
    sky.addColorStop(0.6, b)
    sky.addColorStop(1, c)
    g.fillStyle = sky
    g.fillRect(0, 0, W, H)
    if (kind === 'night') {
      for (let i = 0; i < 70; i++) {
        g.fillStyle = `rgba(255,255,255,${0.3 + ((i * 37) % 7) / 10})`
        g.fillRect((i * 97) % W, (i * 53) % (H * 0.6), 2, 2)
      }
      g.strokeStyle = 'rgba(180,200,255,0.25)'
      g.lineWidth = 14
      g.beginPath()
      g.moveTo(0, H * 0.55)
      g.quadraticCurveTo(W * 0.5, H * 0.05, W, H * 0.35)
      g.stroke()
    }
    // Deux chaînes de montagnes.
    const ridge = (yBase, amp, color, seed) => {
      g.fillStyle = color
      g.beginPath()
      g.moveTo(0, H)
      for (let x = 0; x <= W; x += 16) g.lineTo(x, yBase - Math.abs(Math.sin(x * 0.021 + seed) * amp) - Math.abs(Math.sin(x * 0.057 + seed * 2)) * amp * 0.4)
      g.lineTo(W, H)
      g.fill()
    }
    ridge(H * 0.72, 46, kind === 'snow' ? '#9fb6d8' : 'rgba(40,30,80,0.7)', 1)
    ridge(H * 0.86, 34, kind === 'snow' ? '#eef4ff' : '#1d1638', 3)
    if (kind === 'lake') {
      g.fillStyle = 'rgba(255,210,150,0.5)'
      g.fillRect(0, H * 0.86, W, H * 0.14)
    }
  })
}

function framedPrint(g, x, y, z, kind, { w = 0.9, h = 0.64, rotY = 0 } = {}) {
  const f = new THREE.Group()
  f.position.set(x, y, z)
  f.rotation.y = rotY
  f.add(mesh(new THREE.BoxGeometry(w + 0.1, h + 0.1, 0.05), mat(0x1d1d22), {}))
  f.add(mesh(new THREE.PlaneGeometry(w - 0.06, h - 0.06), new THREE.MeshStandardMaterial({ map: printTexture(kind), roughness: 0.7 }), { z: 0.03, shadow: false }))
  g.add(f)
  return f
}

// ---------- Studio photo ----------
export function photoStudio(ctx, x, z, { rotY = 0 } = {}) {
  const { g, col } = base(ctx, x, z, rotY)
  // Sol du plateau.
  g.add(mesh(new THREE.BoxGeometry(6.4, 0.08, 4.6), mat(0x2b2b33, { roughness: 0.8 }), { y: 0.04, z: -0.6 }))
  backdrop(g, { width: 4.2, height: 2.9, depth: 2.2, color: 0xf0e9de, z: -2.7 })
  col(0, -2.8, 1.2)
  col(-1.6, -2.8, 0.8)
  col(1.6, -2.8, 0.8)
  // Tabouret de pose sur le fond.
  g.add(mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.05, 14), mat(0x8a5a32), { y: 0.66, z: -1.4 }))
  for (let k = 0; k < 4; k++) g.add(mesh(new THREE.CylinderGeometry(0.02, 0.025, 0.66, 4), black(), { x: Math.cos(k * 1.57 + 0.78) * 0.17, y: 0.33, z: -1.4 + Math.sin(k * 1.57 + 0.78) * 0.17 }))
  // Lumières : deux boîtes à lumière et un parapluie en contre-jour.
  lightStand(g, -2.6, -0.4, { head: softbox, aimX: 0, aimZ: -1.4, aimY: 1.1 })
  lightStand(g, 2.6, -0.6, { head: softbox, aimX: 0, aimZ: -1.4, aimY: 1.1 })
  lightStand(g, 1.9, -2.4, { h: 2.6, head: umbrella, aimX: 0, aimZ: -1.4, aimY: 1 })
  col(-2.6, -0.4, 0.35)
  col(2.6, -0.6, 0.35)
  const glow = new THREE.PointLight(0xfff1dc, 5, 6, 1.6)
  glow.position.set(0, 2, -0.6)
  g.add(glow)
  // L'appareil sur trépied, tourné vers le fond.
  const t = tripod(g, -0.4, 1.0)
  photoCamera(t, 1.4)
  col(-0.4, 1.0, 0.3)
  // Petit mur d'exposition à gauche avec des tirages.
  const wall = new THREE.Group()
  wall.position.set(-4.3, 0, -0.6)
  wall.rotation.y = 0.5
  g.add(wall)
  wall.add(mesh(new THREE.BoxGeometry(2.6, 2.3, 0.14), mat(0xf4ede2), { y: 1.25 }))
  wall.add(mesh(new THREE.BoxGeometry(2.7, 0.1, 0.24), mat(0x8a5a32), { y: 0.05 }))
  framedPrint(wall, -0.6, 1.65, 0.1, 'dusk')
  framedPrint(wall, 0.6, 1.65, 0.1, 'night')
  framedPrint(wall, -0.6, 0.85, 0.1, 'snow')
  framedPrint(wall, 0.6, 0.85, 0.1, 'lake')
  col(-4.3, -0.6, 1.3)
  // Chevalet avec un grand tirage à droite.
  const easel = new THREE.Group()
  easel.position.set(4.3, 0, 0.2)
  easel.rotation.y = -0.55
  g.add(easel)
  for (const s of [-1, 1]) {
    const leg = mesh(new THREE.BoxGeometry(0.06, 2, 0.06), mat(0x8a5a32), { x: s * 0.42, y: 1, z: 0 })
    leg.rotation.z = s * -0.12
    easel.add(leg)
  }
  const back = mesh(new THREE.BoxGeometry(0.06, 1.9, 0.06), mat(0x8a5a32), { y: 0.95, z: -0.35 })
  back.rotation.x = -0.2
  easel.add(back)
  easel.add(mesh(new THREE.BoxGeometry(1, 0.05, 0.12), mat(0x8a5a32), { y: 0.82, z: 0.05 }))
  framedPrint(easel, 0, 1.3, 0.06, 'dusk', { w: 1.1, h: 0.8 })
  col(4.3, 0.2, 0.6)
  // Malle de matériel et sac.
  g.add(mesh(new THREE.BoxGeometry(0.9, 0.45, 0.55), mat(0x2f3440), { x: 3.2, y: 0.23, z: -2.2 }))
  g.add(mesh(new THREE.BoxGeometry(0.92, 0.06, 0.57), mat(0xb0b4c4, { metalness: 0.6 }), { x: 3.2, y: 0.46, z: -2.2 }))
  col(3.2, -2.2, 0.5)
  // Le photographe au travail.
  C.npc(ctx, 'rogue', x - 0.4 + 0.1, z + 1.75, { rotY: Math.PI, anim: 'Interact', speed: 0.6, r: 0.4, greet: false, keep: [] })
}

// ---------- Studio vidéo ----------
const onAirTexture = () => textTexture('● ON AIR', { width: 256, height: 96, bg: '#2a0a10', fg: '#ff4d5e', font: 'bold 50px "Inter Variable", system-ui, sans-serif' })

function monitorTexture() {
  return canvasTexture(256, 150, (g, W, H) => {
    g.fillStyle = '#2fbf4f'
    g.fillRect(0, 0, W, H)
    g.fillStyle = 'rgba(20,20,30,0.85)'
    g.beginPath()
    g.arc(W / 2, H * 0.42, 22, 0, Math.PI * 2)
    g.fill()
    g.beginPath()
    g.roundRect(W / 2 - 40, H * 0.58, 80, 60, 20)
    g.fill()
    g.strokeStyle = 'rgba(255,255,255,0.8)'
    g.lineWidth = 2
    g.strokeRect(W * 0.1, H * 0.1, W * 0.8, H * 0.8)
    g.fillStyle = '#ff4d5e'
    g.beginPath()
    g.arc(18, 18, 6, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = '#ffffff'
    g.font = 'bold 14px "Inter Variable", sans-serif'
    g.fillText('REC 00:42:17', 30, 23)
  })
}

export function videoStudio(ctx, x, z, { rotY = 0 } = {}) {
  const { g, col } = base(ctx, x, z, rotY)
  g.add(mesh(new THREE.BoxGeometry(6.6, 0.08, 4.8), mat(0x24242c, { roughness: 0.8 }), { y: 0.04, z: -0.6 }))
  // Fond vert.
  backdrop(g, { width: 4.6, height: 3, depth: 2.3, color: 0x2fbf4f, z: -2.8, emissive: 0.08 })
  col(0, -2.9, 1.2)
  col(-1.7, -2.9, 0.8)
  col(1.7, -2.9, 0.8)
  // Rails de travelling et chariot avec la caméra de cinéma.
  for (const s of [-0.28, 0.28]) g.add(mesh(new THREE.BoxGeometry(4.6, 0.05, 0.05), steel(), { y: 0.1, z: 1.0 + s }))
  for (let i = -2.2; i <= 2.21; i += 0.55) g.add(mesh(new THREE.BoxGeometry(0.12, 0.05, 0.8), mat(0x5a3a22), { x: i, y: 0.06, z: 1.0 }))
  const dolly = new THREE.Group()
  g.add(dolly)
  dolly.add(mesh(new THREE.BoxGeometry(0.8, 0.14, 0.7), mat(0x2b2b33), { y: 0.22, z: 1.0 }))
  for (const [dx, dz] of [[-0.3, 0.72], [0.3, 0.72], [-0.3, 1.28], [0.3, 1.28]]) dolly.add(mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.05, 10).rotateZ(Math.PI / 2), black(), { x: dx, y: 0.14, z: dz }))
  dolly.add(mesh(new THREE.CylinderGeometry(0.05, 0.06, 1.1, 8), steel(), { y: 0.82, z: 1.0 }))
  const cine = new THREE.Group()
  cine.position.set(0, 1.42, 1.0)
  dolly.add(cine)
  cine.add(mesh(new THREE.BoxGeometry(0.32, 0.3, 0.5), mat(0x2b2b33), { y: 0.05 }))
  cine.add(mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.32, 14).rotateX(Math.PI / 2), mat(0x111114), { y: 0.05, z: -0.38 }))
  cine.add(mesh(new THREE.BoxGeometry(0.34, 0.28, 0.06), black(), { y: 0.05, z: -0.56 }))
  cine.add(mesh(new THREE.BoxGeometry(0.2, 0.14, 0.02), new THREE.MeshStandardMaterial({ map: monitorTexture(), emissive: 0xffffff, emissiveIntensity: 0.6 }), { x: 0.22, y: 0.16, z: 0.1 }))
  cine.add(mesh(new THREE.TorusGeometry(0.1, 0.025, 6, 14), black(), { y: 0.3, z: -0.1 }))
  cine.add(mesh(new THREE.TorusGeometry(0.1, 0.025, 6, 14), black(), { y: 0.3, z: 0.14 }))
  ctx.animated.push((dt, t) => { dolly.position.x = Math.sin(t * 0.35) * 1.5 })
  col(0, 1.0, 0.45)
  // Projecteurs.
  lightStand(g, -2.9, -0.8, { h: 2.4, head: fresnel, aimX: 0, aimZ: -1.6, aimY: 1 })
  lightStand(g, 2.9, -0.8, { h: 2.4, head: fresnel, aimX: 0, aimZ: -1.6, aimY: 1 })
  col(-2.9, -0.8, 0.35)
  col(2.9, -0.8, 0.35)
  const glow = new THREE.PointLight(0xffd9a0, 5, 6, 1.6)
  glow.position.set(0, 2, -1)
  g.add(glow)
  // Perche avec micro bonnette.
  const boom = new THREE.Group()
  boom.position.set(-2.1, 0, 0.6)
  g.add(boom)
  boom.add(mesh(new THREE.CylinderGeometry(0.025, 0.03, 1.9, 6), black(), { y: 0.95 }))
  const pole = mesh(new THREE.CylinderGeometry(0.02, 0.02, 2.4, 6), steel(), { x: 0.85, y: 2.15, z: -0.75 })
  pole.rotation.set(-0.7, 0, -0.95)
  boom.add(pole)
  const fluffy = mesh(new THREE.CapsuleGeometry(0.08, 0.22, 4, 8).rotateX(Math.PI / 2), mat(0x8a8478, { roughness: 1 }), { x: 1.75, y: 2.45, z: -1.5 })
  boom.add(fluffy)
  // Chaise du réalisateur et clap.
  const chair = new THREE.Group()
  chair.position.set(2.5, 0, 1.6)
  chair.rotation.y = -0.6
  g.add(chair)
  const wood = mat(0x8a5a32)
  for (const s of [-1, 1]) {
    for (const d of [-1, 1]) {
      const leg = mesh(new THREE.BoxGeometry(0.05, 0.75, 0.05), wood, { x: s * 0.25, y: 0.37, z: d * 0.18 })
      leg.rotation.x = d * 0.3
      chair.add(leg)
    }
    chair.add(mesh(new THREE.BoxGeometry(0.05, 0.65, 0.05), wood, { x: s * 0.25, y: 0.95, z: -0.2 }))
  }
  chair.add(mesh(new THREE.BoxGeometry(0.5, 0.03, 0.4), mat(0x2b2b33), { y: 0.66 }))
  chair.add(mesh(new THREE.BoxGeometry(0.52, 0.22, 0.02), new THREE.MeshStandardMaterial({ map: textTexture('RÉALISATEUR', { width: 256, height: 96, bg: '#2b2b33', fg: '#ffd27a', font: 'bold 34px "Inter Variable", sans-serif' }) }), { y: 1.1, z: -0.21 }))
  const clap = new THREE.Group()
  clap.position.set(0, 0.68, 0.05)
  clap.rotation.x = -1.4
  chair.add(clap)
  clap.add(mesh(new THREE.BoxGeometry(0.3, 0.22, 0.02), mat(0x1d1d22), {}))
  const stripes = canvasTexture(128, 16, (c) => { for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? '#ffffff' : '#1d1d22'; c.fillRect(i * 16, 0, 16, 16) } })
  clap.add(mesh(new THREE.BoxGeometry(0.3, 0.05, 0.022), new THREE.MeshStandardMaterial({ map: stripes }), { y: 0.135 }))
  col(2.5, 1.6, 0.4)
  // Moniteur de contrôle sur pied.
  const mon = new THREE.Group()
  mon.position.set(-3.1, 0, 1.4)
  mon.rotation.y = 0.5
  g.add(mon)
  mon.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.3, 6), black(), { y: 0.65 }))
  mon.add(mesh(new THREE.BoxGeometry(0.75, 0.48, 0.06), mat(0x1d1d22), { y: 1.5 }))
  mon.add(mesh(new THREE.PlaneGeometry(0.68, 0.4), new THREE.MeshStandardMaterial({ map: monitorTexture(), emissive: 0xffffff, emissiveIntensity: 0.8 }), { y: 1.5, z: 0.035, shadow: false }))
  col(-3.1, 1.4, 0.35)
  // Voyant « ON AIR » qui clignote, en haut à droite du fond.
  const onAir = new THREE.Group()
  onAir.position.set(3.1, 0, -2.4)
  g.add(onAir)
  onAir.add(mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.6, 6), black(), { y: 1.3 }))
  const lampMat = new THREE.MeshStandardMaterial({ map: onAirTexture(), emissive: 0xffffff, emissiveMap: onAirTexture(), emissiveIntensity: 1.4 })
  onAir.add(mesh(new THREE.BoxGeometry(0.9, 0.34, 0.12), [mat(0x1d1d22), mat(0x1d1d22), mat(0x1d1d22), mat(0x1d1d22), lampMat, mat(0x1d1d22)], { y: 2.7 }))
  onAir.userData.dynamic = true
  ctx.animated.push((dt, t) => { lampMat.emissiveIntensity = Math.sin(t * 3) > -0.3 ? 1.4 : 0.25 })
  col(3.1, -2.4, 0.3)
  // Caisses de matériel.
  for (const [cx, cz, s] of [[-3.3, -2.1, 0.7], [-2.7, -2.4, 0.5]]) {
    g.add(mesh(new THREE.BoxGeometry(s, s * 0.6, s * 0.7), mat(0x2f3440), { x: cx, y: s * 0.3, z: cz }))
    g.add(mesh(new THREE.BoxGeometry(s + 0.02, 0.04, s * 0.7 + 0.02), mat(0xb0b4c4, { metalness: 0.6 }), { x: cx, y: s * 0.6, z: cz }))
  }
  col(-3, -2.2, 0.7)
  // Le caméraman suit le chariot.
  C.npc(ctx, 'knight', x + 0.8, z + 2.0, { rotY: Math.PI, anim: 'Interact', speed: 0.5, r: 0, greet: false, keep: [] })
}

// ---------- GitHub Café ----------
function menuTexture() {
  return canvasTexture(512, 360, (g, W, H) => {
    g.fillStyle = '#1e2a24'
    g.fillRect(0, 0, W, H)
    g.strokeStyle = 'rgba(255,255,255,0.12)'
    g.lineWidth = 3
    g.strokeRect(14, 14, W - 28, H - 28)
    g.fillStyle = '#f4f1e8'
    g.textAlign = 'center'
    g.font = 'bold 44px "Outfit Variable", "Inter Variable", sans-serif'
    g.fillText('Code · Café · Commit', W / 2, 70)
    g.fillStyle = '#56d364'
    g.fillRect(W / 2 - 90, 88, 180, 4)
    const rows = [['Espresso', 'git commit'], ['Cappuccino', 'git merge'], ['Latte', 'git rebase'], ['Cold brew', 'git push --force'], ['Thé vert', 'git stash']]
    g.font = '28px "Inter Variable", sans-serif'
    rows.forEach(([a, b], i) => {
      const y = 140 + i * 44
      g.textAlign = 'left'
      g.fillStyle = '#f4f1e8'
      g.fillText(a, 50, y)
      g.textAlign = 'right'
      g.fillStyle = '#9be9a8'
      g.font = '24px "JetBrains Mono", ui-monospace, monospace'
      g.fillText(b, W - 50, y)
      g.font = '28px "Inter Variable", sans-serif'
    })
  })
}

// Mur de contributions : 7 lignes × 26 semaines de carrés verts.
function contributionsTexture() {
  return canvasTexture(640, 240, (g, W, H) => {
    g.fillStyle = '#0d1117'
    g.fillRect(0, 0, W, H)
    g.fillStyle = '#e6edf3'
    g.font = 'bold 26px "Inter Variable", sans-serif'
    g.fillText('Contributions', 24, 40)
    const greens = ['#161b22', '#0e4429', '#006d32', '#26a641', '#39d353']
    let s = 11
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647)
    for (let c = 0; c < 26; c++) {
      for (let r = 0; r < 7; r++) {
        const v = rnd()
        const level = v < 0.18 ? 0 : v < 0.45 ? 1 : v < 0.7 ? 2 : v < 0.88 ? 3 : 4
        g.fillStyle = greens[level]
        g.beginPath()
        g.roundRect(24 + c * 23.4, 62 + r * 23.4, 19, 19, 4)
        g.fill()
      }
    }
  })
}

export function gitCafe(ctx, x, z, { rotY = 0 } = {}) {
  const { g, col } = base(ctx, x, z, rotY)
  const wood = mat(0x8a5a32, { roughness: 0.7 })
  const dark = mat(0x2b2b33)
  const green = 0x2da44e
  // Terrasse en bois.
  g.add(mesh(new THREE.BoxGeometry(7, 0.1, 5.4), mat(0xb07a4a), { y: 0.05, z: -0.3 }))
  for (let i = -3; i <= 3; i++) g.add(mesh(new THREE.BoxGeometry(0.03, 0.02, 5.4), mat(0x7a4f30), { x: i, y: 0.105, shadow: false }))
  // Comptoir : plateau en bois sur caisson noir, avec bandeau vert.
  g.add(mesh(new THREE.BoxGeometry(3.6, 1.0, 0.8), dark, { y: 0.5, z: -1.7 }))
  g.add(mesh(new THREE.BoxGeometry(3.8, 0.08, 0.95), wood, { y: 1.04, z: -1.7 }))
  g.add(mesh(new THREE.BoxGeometry(3.62, 0.12, 0.02), mat(green, { emissive: green, emissiveIntensity: 0.8 }), { y: 0.8, z: -1.29, shadow: false }))
  col(-1.2, -1.7, 0.8)
  col(0, -1.7, 0.8)
  col(1.2, -1.7, 0.8)
  // Machine à espresso chromée, moulin, tasses.
  const chrome = mat(0xd8dce6, { metalness: 0.8, roughness: 0.25, flatShading: false })
  g.add(mesh(new THREE.BoxGeometry(0.8, 0.5, 0.45), chrome, { x: -0.9, y: 1.33, z: -1.85 }))
  g.add(mesh(new THREE.BoxGeometry(0.82, 0.06, 0.47), dark, { x: -0.9, y: 1.6, z: -1.85 }))
  for (const s of [-0.18, 0.18]) g.add(mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.12, 8), dark, { x: -0.9 + s, y: 1.14, z: -1.6 }))
  g.add(mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.35, 10), dark, { x: 0.2, y: 1.26, z: -1.9 }))
  g.add(mesh(new THREE.ConeGeometry(0.13, 0.2, 10).rotateX(Math.PI), mat(0x6b4226, { transparent: true, opacity: 0.85 }), { x: 0.2, y: 1.53, z: -1.9 }))
  for (let i = 0; i < 4; i++) g.add(mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.1, 10), mat(i % 2 ? 0xffffff : green), { x: 0.75 + i * 0.16, y: 1.13 + Math.floor(i / 2) * 0.1, z: -1.6 }))
  // Cloche à viennoiseries.
  g.add(mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.03, 14), wood, { x: 1.45, y: 1.1, z: -1.7 }))
  g.add(mesh(new THREE.SphereGeometry(0.21, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, roughness: 0.1 }), { x: 1.45, y: 1.12, z: -1.7, shadow: false }))
  for (const [dx, dz] of [[-0.06, 0], [0.07, 0.04]]) {
    const croissant = mesh(new THREE.TorusGeometry(0.06, 0.03, 6, 10, Math.PI * 1.3), mat(0xd9963a), { x: 1.45 + dx, y: 1.15, z: -1.7 + dz })
    croissant.rotation.x = -Math.PI / 2
    g.add(croissant)
  }
  // Store rayé vert et blanc au-dessus du comptoir.
  for (const s of [-1, 1]) g.add(mesh(new THREE.BoxGeometry(0.1, 2.9, 0.1), dark, { x: s * 1.95, y: 1.45, z: -2.25 }))
  const stripes = canvasTexture(128, 32, (c) => { for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? '#f4f1e8' : '#2da44e'; c.fillRect(i * 16, 0, 16, 32) } })
  const awning = mesh(new THREE.BoxGeometry(4.2, 0.05, 1.4), new THREE.MeshStandardMaterial({ map: stripes, roughness: 0.9 }), { y: 2.75, z: -1.6 })
  awning.rotation.x = 0.3
  g.add(awning)
  for (let i = 0; i < 9; i++) g.add(mesh(new THREE.ConeGeometry(0.17, 0.22, 3), mat(i % 2 ? 0xf4f1e8 : green), { x: -1.95 + i * 0.49, y: 2.48, z: -0.95, shadow: false }))
  // Ardoise du menu, au fond.
  const board = mesh(new THREE.PlaneGeometry(2.6, 1.8), new THREE.MeshStandardMaterial({ map: menuTexture(), roughness: 0.95, emissive: 0xffffff, emissiveIntensity: 0.12 }), { y: 1.95, z: -2.3, shadow: false })
  board.material.emissiveMap = board.material.map
  g.add(board)
  g.add(mesh(new THREE.BoxGeometry(2.8, 2.0, 0.08), wood, { y: 1.95, z: -2.36 }))
  // Tables bistrot avec ordinateurs portables et tabourets.
  for (const [tx, tz] of [[-2.4, 0.8], [2.4, 0.8]]) {
    g.add(mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.05, 14), wood, { x: tx, y: 0.85, z: tz }))
    g.add(mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.85, 6), dark, { x: tx, y: 0.42, z: tz }))
    g.add(mesh(new THREE.CylinderGeometry(0.25, 0.28, 0.04, 10), dark, { x: tx, y: 0.02, z: tz }))
    const lap = new THREE.Group()
    lap.position.set(tx, 0.88, tz)
    lap.rotation.y = tx < 0 ? 0.5 : -0.5
    g.add(lap)
    lap.add(mesh(new THREE.BoxGeometry(0.42, 0.02, 0.3), mat(0xc9ccd6, { metalness: 0.6, roughness: 0.3 }), {}))
    const lid = mesh(new THREE.BoxGeometry(0.42, 0.28, 0.015), mat(0xc9ccd6, { metalness: 0.6, roughness: 0.3 }), { y: 0.14, z: -0.16 })
    lid.rotation.x = -0.25
    lap.add(lid)
    const screenTex = canvasTexture(128, 84, (c, W, H) => {
      c.fillStyle = '#0d1117'
      c.fillRect(0, 0, W, H)
      const colors = ['#ff7b72', '#79c0ff', '#d2a8ff', '#7ee787', '#ffa657']
      for (let y = 8; y < H - 6; y += 7) {
        let x = 6 + ((y * 7) % 3) * 6
        while (x < W - 20) {
          const l = 8 + ((x * y) % 22)
          c.fillStyle = colors[(x + y) % colors.length]
          c.fillRect(x, y, l, 3)
          x += l + 4
        }
      }
    })
    const scr = mesh(new THREE.PlaneGeometry(0.38, 0.24), new THREE.MeshStandardMaterial({ map: screenTex, emissive: 0xffffff, emissiveMap: screenTex, emissiveIntensity: 0.9 }), { y: 0.14, z: -0.15, shadow: false })
    scr.rotation.x = -0.25
    lap.add(scr)
    g.add(mesh(new THREE.CylinderGeometry(0.05, 0.04, 0.09, 10), mat(0xffffff), { x: tx + (tx < 0 ? 0.3 : -0.3), y: 0.92, z: tz + 0.18 }))
    for (const s of [-1, 1]) {
      g.add(mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.05, 12), mat(green), { x: tx + s * 0.75, y: 0.62, z: tz + 0.15 }))
      g.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.6, 6), dark, { x: tx + s * 0.75, y: 0.3, z: tz + 0.15 }))
    }
    col(tx, tz, 0.9)
  }
  // Mur de contributions sur pieds, à gauche.
  const graph = new THREE.Group()
  graph.position.set(-3.9, 0, -1.6)
  graph.rotation.y = 0.6
  g.add(graph)
  for (const s of [-1, 1]) graph.add(mesh(new THREE.BoxGeometry(0.1, 2.4, 0.1), dark, { x: s * 1.3, y: 1.2 }))
  graph.add(mesh(new THREE.BoxGeometry(2.8, 1.12, 0.08), dark, { y: 1.75 }))
  const gTex = contributionsTexture()
  graph.add(mesh(new THREE.PlaneGeometry(2.66, 1.0), new THREE.MeshStandardMaterial({ map: gTex, emissive: 0xffffff, emissiveMap: gTex, emissiveIntensity: 0.55 }), { y: 1.75, z: 0.045, shadow: false }))
  col(-3.9, -1.6, 0.9)
  // Plantes en pot et guirlande lumineuse.
  for (const [px, pz] of [[3.3, -2.2], [-3.2, 1.9], [3.3, 2]]) {
    g.add(mesh(new THREE.CylinderGeometry(0.28, 0.22, 0.5, 10), mat(0x2b2b33), { x: px, y: 0.25, z: pz }))
    g.add(mesh(new THREE.IcosahedronGeometry(0.45, 0), mat(0x3f9d5a), { x: px, y: 0.85, z: pz }))
    col(px, pz, 0.35)
  }
  for (const s of [-1, 1]) g.add(mesh(new THREE.CylinderGeometry(0.05, 0.06, 3, 6), dark, { x: s * 3.4, y: 1.5, z: 2.4 }))
  const bulbs = []
  for (let i = 0; i <= 12; i++) {
    const u = i / 12
    const bx = -3.4 + u * 6.8
    const by = 2.9 - Math.sin(u * Math.PI) * 0.5
    const bulb = mesh(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshStandardMaterial({ color: 0xfff1c8, emissive: 0xffc46b, emissiveIntensity: 2 }), { x: bx, y: by, z: 2.4, shadow: false })
    bulbs.push(bulb)
    g.add(bulb)
  }
  const wire = new THREE.CatmullRomCurve3(bulbs.map((b) => b.position.clone().add(new THREE.Vector3(0, 0.07, 0))))
  g.add(mesh(new THREE.TubeGeometry(wire, 40, 0.01, 4), dark, { shadow: false }))
  const glow = new THREE.PointLight(0xffc46b, 5, 7, 1.6)
  glow.position.set(0, 2.4, 0)
  g.add(glow)
  // Le barista derrière le comptoir.
  C.npc(ctx, 'barbarian', x + 0.4, z - 2.25, { rotY: 0, anim: 'Idle', keep: ['Mug'], r: 0, greet: false })
}

// Sculpture de grès : un graphe git, deux branches qui se rejoignent (commit → merge).
export function gitGraphSculpture(ctx, x, z, { rotY = 0, stone = 0xe6cfa8, dark = 0xb48a62, glow = 0x56d364 } = {}) {
  const { g, col } = base(ctx, x, z, rotY)
  g.add(mesh(new THREE.CylinderGeometry(1.3, 1.4, 0.35, 8), mat(dark), { y: 0.17 }))
  g.add(mesh(new THREE.CylinderGeometry(1.0, 1.1, 0.5, 8), mat(stone), { y: 0.6 }))
  const stoneMat = mat(stone, { roughness: 0.85 })
  const main = new THREE.CatmullRomCurve3([new THREE.Vector3(-0.3, 0.85, 0), new THREE.Vector3(-0.3, 3.6, 0)])
  g.add(mesh(new THREE.TubeGeometry(main, 8, 0.11, 8), stoneMat))
  const branch = new THREE.CatmullRomCurve3([new THREE.Vector3(-0.3, 1.5, 0), new THREE.Vector3(0.45, 2.0, 0), new THREE.Vector3(0.5, 2.6, 0), new THREE.Vector3(-0.3, 3.1, 0)])
  g.add(mesh(new THREE.TubeGeometry(branch, 24, 0.09, 8), stoneMat))
  const dotMat = new THREE.MeshStandardMaterial({ color: glow, emissive: glow, emissiveIntensity: 1.6, flatShading: true })
  for (const [px, py] of [[-0.3, 1.0], [-0.3, 1.5], [-0.3, 2.3], [0.47, 2.05], [0.5, 2.55], [-0.3, 3.1], [-0.3, 3.6]]) {
    g.add(mesh(new THREE.SphereGeometry(0.2, 10, 8), stoneMat, { x: px, y: py }))
    g.add(mesh(new THREE.SphereGeometry(0.11, 8, 6), dotMat, { x: px, y: py, z: 0.14, shadow: false }))
  }
  col(0, 0, 1.2, 4)
}

// Food truck de glaces, pour la place du Présent.
export function foodTruck(ctx, x, z, { rotY = 0, color = 0xff8fb1 } = {}) {
  const { g, col } = base(ctx, x, z, rotY)
  const body = mat(color)
  const white = mat(0xf4f1e8)
  g.add(mesh(new THREE.BoxGeometry(3.4, 1.7, 1.7), body, { y: 1.25 }))
  g.add(mesh(new THREE.BoxGeometry(3.42, 0.5, 1.72), white, { y: 0.6 }))
  g.add(mesh(new THREE.BoxGeometry(1.1, 1.1, 1.6), body, { x: 2.1, y: 0.95 }))
  g.add(mesh(new THREE.BoxGeometry(0.05, 0.6, 1.4), mat(0x9fc8ff, { metalness: 0.4, roughness: 0.2 }), { x: 2.66, y: 1.2 }))
  for (const [wx, wz] of [[-1.1, 0.86], [1.4, 0.86], [-1.1, -0.86], [1.4, -0.86]]) g.add(mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.22, 14).rotateX(Math.PI / 2), mat(0x1d1d22), { x: wx, y: 0.33, z: wz }))
  // Guichet ouvert côté caméra, auvent et comptoir.
  g.add(mesh(new THREE.PlaneGeometry(1.8, 0.75), mat(0x3a2a4a), { x: -0.3, y: 1.45, z: 0.86, shadow: false }))
  const flap = mesh(new THREE.BoxGeometry(2, 0.05, 0.7), white, { x: -0.3, y: 1.95, z: 1.15 })
  flap.rotation.x = -0.35
  g.add(flap)
  g.add(mesh(new THREE.BoxGeometry(1.9, 0.06, 0.3), white, { x: -0.3, y: 1.05, z: 1.0 }))
  // Grand cornet sur le toit.
  g.add(mesh(new THREE.ConeGeometry(0.3, 0.8, 10).rotateX(Math.PI), mat(0xd9963a), { x: -0.6, y: 2.5 }))
  g.add(mesh(new THREE.SphereGeometry(0.34, 12, 10), mat(0xfff1f5), { x: -0.6, y: 2.95 }))
  g.add(mesh(new THREE.SphereGeometry(0.28, 12, 10), mat(0xff6fb1), { x: -0.6, y: 3.25 }))
  g.add(mesh(new THREE.SphereGeometry(0.07, 8, 6), mat(0xd6402f), { x: -0.6, y: 3.5 }))
  // Tabouret et petit panneau.
  g.add(mesh(new THREE.BoxGeometry(0.5, 0.9, 0.05), mat(0x1d1d22), { x: 1.9, y: 0.45, z: 1.4 }))
  g.add(mesh(new THREE.PlaneGeometry(0.42, 0.6), new THREE.MeshStandardMaterial({ map: textTexture('Glaces', { width: 128, height: 180, bg: '#1d1d22', fg: '#ff9ad9', font: 'bold 34px "Outfit Variable", sans-serif' }) }), { x: 1.9, y: 0.5, z: 1.43, shadow: false }))
  col(-0.6, 0, 1.2)
  col(1.2, 0, 1.1)
}

// Arceaux avec deux vélos.
export function bikeRack(ctx, x, z, { rotY = 0, colors = [0x2f9bff, 0xff7a45] } = {}) {
  const { g, col } = base(ctx, x, z, rotY)
  const metal = mat(0x8a8fa8, { metalness: 0.6, roughness: 0.4 })
  for (const dx of [-1, 0, 1]) {
    const hoop = mesh(new THREE.TorusGeometry(0.35, 0.03, 6, 14, Math.PI), metal, { x: dx, y: 0.4 })
    g.add(hoop)
    for (const s of [-0.35, 0.35]) g.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.4, 6), metal, { x: dx + s, y: 0.2 }))
  }
  colors.forEach((c, i) => {
    const bike = new THREE.Group()
    bike.position.set(-0.5 + i * 1.0, 0, 0.12)
    bike.rotation.y = Math.PI / 2
    g.add(bike)
    const frame = mat(c)
    for (const s of [-0.5, 0.5]) bike.add(mesh(new THREE.TorusGeometry(0.32, 0.04, 6, 18), mat(0x1d1d22), { x: s, y: 0.34 }))
    const bar = (ax, ay, bx, by) => {
      const len = Math.hypot(bx - ax, by - ay)
      const m = mesh(new THREE.CylinderGeometry(0.025, 0.025, len, 5), frame, { x: (ax + bx) / 2, y: (ay + by) / 2 })
      m.rotation.z = Math.atan2(bx - ax, by - ay) * -1
      bike.add(m)
    }
    bar(-0.5, 0.34, -0.05, 0.36)
    bar(-0.05, 0.36, 0.35, 0.72)
    bar(-0.5, 0.34, -0.15, 0.72)
    bar(-0.15, 0.72, 0.35, 0.72)
    bar(0.35, 0.72, 0.5, 0.34)
    bike.add(mesh(new THREE.BoxGeometry(0.22, 0.04, 0.1), mat(0x1d1d22), { x: -0.2, y: 0.8 }))
    bike.add(mesh(new THREE.BoxGeometry(0.04, 0.04, 0.45), mat(0x1d1d22), { x: 0.4, y: 0.86 }))
  })
  col(0, 0, 1.1, 1)
}

