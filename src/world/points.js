import * as THREE from 'three'
import { mat, mesh, textTexture } from './helpers.js'
import { model } from './models.js'

// Points d'intérêt : au lieu d'un simple panneau, un objet qui parle de lui-même
// (appareil photo sur une table, ordinateur, téléphone, caméra, ballon…), entouré d'un
// cercle lumineux et surmonté d'une étiquette qui fait toujours face à la caméra.

export function canvasTexture(width, height, draw) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  draw(canvas.getContext('2d'), width, height)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

const screenMat = (texture, intensity = 1.2) => new THREE.MeshStandardMaterial({ map: texture, emissiveMap: texture, emissive: 0xffffff, emissiveIntensity: intensity, roughness: 0.4 })

// Écran d'éditeur de code (lignes colorées).
export const codeScreen = (seed = 1) => canvasTexture(256, 160, (g, w, h) => {
  g.fillStyle = '#141a2e'
  g.fillRect(0, 0, w, h)
  g.fillStyle = '#232b48'
  g.fillRect(0, 0, w, 16)
  for (const [i, c] of ['#ff5f56', '#ffbd2e', '#27c93f'].entries()) {
    g.fillStyle = c
    g.beginPath()
    g.arc(10 + i * 12, 8, 4, 0, Math.PI * 2)
    g.fill()
  }
  let s = seed
  const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647)
  const colors = ['#c792ea', '#82aaff', '#c3e88d', '#f78c6c', '#89ddff', '#ffcb6b']
  for (let y = 26; y < h - 6; y += 11) {
    let x = 10 + Math.floor(rand() * 4) * 12
    while (x < w - 30 && rand() > 0.2) {
      const len = 12 + rand() * 40
      g.fillStyle = colors[Math.floor(rand() * colors.length)]
      g.fillRect(x, y, len, 5)
      x += len + 6
    }
  }
})

// Écran de téléphone avec une grille d'applis.
const phoneScreen = () => canvasTexture(128, 256, (g, w, h) => {
  const grad = g.createLinearGradient(0, 0, 0, h)
  grad.addColorStop(0, '#6a5cff')
  grad.addColorStop(1, '#ff7ab6')
  g.fillStyle = grad
  g.fillRect(0, 0, w, h)
  const colors = ['#ffd34f', '#3ddc84', '#4fc3ff', '#ff5a5a', '#ffffff', '#b48cff']
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 3; c++) {
      g.fillStyle = colors[(r * 3 + c) % colors.length]
      g.beginPath()
      g.roundRect(14 + c * 36, 30 + r * 40, 26, 26, 7)
      g.fill()
    }
  }
})

// Style du mobilier selon l'époque (réglé par buildPoint avant de construire l'objet).
let STYLE = 'present'

const table = (g, { w = 1.4, d = 0.9, h = 0.82 } = {}) => {
  if (STYLE === 'past') {
    // Table de marché en grosses planches, pieds en X et nappe brodée.
    const wood = mat(0x8a5a32)
    for (const z of [-d / 4, d / 4]) g.add(mesh(new THREE.BoxGeometry(w, 0.1, d / 2 - 0.02), wood, { y: h, z }))
    for (const x of [-w / 2 + 0.18, w / 2 - 0.18]) {
      for (const a of [-0.5, 0.5]) {
        const leg = mesh(new THREE.BoxGeometry(0.08, h * 1.12, 0.1), mat(0x6b4226), { x, y: h / 2, z: 0 })
        leg.rotation.x = a
        g.add(leg)
      }
    }
    g.add(mesh(new THREE.BoxGeometry(0.4, 0.02, d + 0.24), mat(0x9b1d2a), { y: h + 0.06 }))
    for (const z of [-d / 2 - 0.12, d / 2 + 0.12]) g.add(mesh(new THREE.BoxGeometry(0.4, 0.26, 0.02), mat(0x9b1d2a), { y: h - 0.07, z }))
    return h + 0.06
  }
  if (STYLE === 'future') {
    // Table flottante sur un pied unique, bord lumineux.
    g.add(mesh(new THREE.CylinderGeometry(0.12, 0.3, h, 10), mat(0x3a3d55, { metalness: 0.6, roughness: 0.35 }), { y: h / 2 }))
    g.add(mesh(new THREE.BoxGeometry(w, 0.06, d), mat(0xdfe3f0, { metalness: 0.3, roughness: 0.3 }), { y: h }))
    g.add(mesh(new THREE.BoxGeometry(w + 0.06, 0.03, d + 0.06), mat(0x7df9ff, { emissive: 0x3ad0ff, emissiveIntensity: 2.2 }), { y: h - 0.04, shadow: false }))
    return h + 0.03
  }
  // Présent : bureau moderne, plateau clair et cadre en métal noir.
  const metal = mat(0x2b2b33, { metalness: 0.5, roughness: 0.4 })
  g.add(mesh(new THREE.BoxGeometry(w, 0.05, d), mat(0xf2ede6), { y: h }))
  for (const x of [-w / 2 + 0.06, w / 2 - 0.06]) {
    g.add(mesh(new THREE.BoxGeometry(0.05, h, 0.05), metal, { x, y: h / 2, z: -d / 2 + 0.06 }))
    g.add(mesh(new THREE.BoxGeometry(0.05, h, 0.05), metal, { x, y: h / 2, z: d / 2 - 0.06 }))
    g.add(mesh(new THREE.BoxGeometry(0.05, 0.05, d - 0.1), metal, { x, y: 0.05, z: 0 }))
  }
  return h + 0.025
}

const BUILDERS = {
  camera(g) {
    const y = table(g)
    const body = new THREE.Group()
    body.position.set(0, y + 0.13, 0)
    body.rotation.y = -0.4
    body.add(mesh(new THREE.BoxGeometry(0.42, 0.26, 0.18), mat(0x1e1e24)))
    body.add(mesh(new THREE.BoxGeometry(0.14, 0.08, 0.12), mat(0x1e1e24), { x: -0.1, y: 0.16 }))
    const lens = mesh(new THREE.CylinderGeometry(0.1, 0.11, 0.2, 14), mat(0x2a2a30), { z: 0.18 })
    lens.rotation.x = Math.PI / 2
    body.add(lens)
    const glass = mesh(new THREE.CircleGeometry(0.075, 14), mat(0x4fc3ff, { emissive: 0x2a6aff, emissiveIntensity: 0.8, roughness: 0.1 }), { z: 0.285, shadow: false })
    body.add(glass)
    body.add(mesh(new THREE.BoxGeometry(0.06, 0.04, 0.02), mat(0xff3b3b, { emissive: 0xff2020, emissiveIntensity: 2 }), { x: 0.14, y: 0.08, z: 0.1, shadow: false }))
    g.add(body)
    // Quelques tirages photo posés à côté.
    for (const [x, z, r, c] of [[0.45, 0.15, 0.3, 0xffd27a], [0.38, -0.2, -0.2, 0x7ad0ff]]) {
      const photo = mesh(new THREE.BoxGeometry(0.28, 0.01, 0.2), mat(c), { x, y: y + 0.01, z })
      photo.rotation.y = r
      g.add(photo)
    }
  },
  laptop(g) {
    const y = table(g)
    g.add(mesh(new THREE.BoxGeometry(0.62, 0.03, 0.42), mat(0xb8bcc8, { metalness: 0.4, roughness: 0.4 }), { y: y + 0.015 }))
    const screen = new THREE.Group()
    screen.position.set(0, y + 0.03, -0.2)
    screen.rotation.x = -0.25
    screen.add(mesh(new THREE.BoxGeometry(0.62, 0.42, 0.02), mat(0xb8bcc8, { metalness: 0.4, roughness: 0.4 }), { y: 0.21 }))
    screen.add(mesh(new THREE.PlaneGeometry(0.56, 0.36), screenMat(codeScreen(3)), { y: 0.21, z: 0.011, shadow: false }))
    g.add(screen)
    g.add(mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.1, 10), mat(0xffffff), { x: 0.5, y: y + 0.05, z: 0.15 }))
  },
  phone(g) {
    const y = table(g, { w: 1, d: 0.7 })
    const stand = new THREE.Group()
    stand.position.set(0, y, 0)
    stand.add(mesh(new THREE.BoxGeometry(0.2, 0.03, 0.16), mat(0x333344)))
    const phone = new THREE.Group()
    phone.position.set(0, 0.22, 0)
    phone.rotation.x = -0.25
    phone.add(mesh(new THREE.BoxGeometry(0.22, 0.42, 0.025), mat(0x1a1a22)))
    phone.add(mesh(new THREE.PlaneGeometry(0.2, 0.39), screenMat(phoneScreen()), { z: 0.014, shadow: false }))
    stand.add(phone)
    g.add(stand)
    // Une tablette posée à plat.
    g.add(mesh(new THREE.BoxGeometry(0.34, 0.02, 0.26), mat(0x1a1a22), { x: 0.3, y: y + 0.01, z: 0.12 }))
  },
  videocam(g) {
    const legs = mat(0x2b2b33)
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2
      const leg = mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.5, 6), legs, { x: Math.cos(a) * 0.3, y: 0.72, z: Math.sin(a) * 0.3 })
      leg.rotation.z = Math.cos(a) * 0.2
      leg.rotation.x = -Math.sin(a) * 0.2
      g.add(leg)
    }
    const cam = new THREE.Group()
    cam.position.y = 1.55
    cam.rotation.y = 0.5
    cam.add(mesh(new THREE.BoxGeometry(0.3, 0.3, 0.6), mat(0x1e1e24)))
    const lens = mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.25, 12), mat(0x2a2a30), { z: 0.4 })
    lens.rotation.x = Math.PI / 2
    cam.add(lens)
    cam.add(mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.06, 16), mat(0x2a2a30), { y: 0.25, z: -0.05 }))
    cam.add(mesh(new THREE.SphereGeometry(0.035, 8, 6), mat(0xff2020, { emissive: 0xff2020, emissiveIntensity: 3 }), { x: 0.12, y: 0.12, z: 0.25, shadow: false }))
    cam.add(mesh(new THREE.BoxGeometry(0.22, 0.16, 0.02), mat(0x4fc3ff, { emissive: 0x2a80ff, emissiveIntensity: 1 }), { x: -0.17, y: 0.05, z: -0.1, shadow: false }))
    g.add(cam)
    // Clap de cinéma par terre.
    const clap = mesh(new THREE.BoxGeometry(0.4, 0.04, 0.3), mat(0x111111), { x: 0.6, y: 0.02, z: 0.3 })
    g.add(clap, mesh(new THREE.BoxGeometry(0.4, 0.04, 0.06), mat(0xffffff), { x: 0.6, y: 0.06, z: 0.18 }))
  },
  lectern(g, { page = 0xfff4dc } = {}) {
    const wood = mat(0x6b4226)
    g.add(mesh(new THREE.CylinderGeometry(0.1, 0.16, 1.05, 8), wood, { y: 0.52 }))
    g.add(mesh(new THREE.CylinderGeometry(0.35, 0.4, 0.08, 8), wood, { y: 0.04 }))
    const top = new THREE.Group()
    top.position.y = 1.1
    top.rotation.x = 0.45
    top.add(mesh(new THREE.BoxGeometry(0.7, 0.06, 0.5), wood))
    for (const x of [-0.17, 0.17]) {
      const leaf = mesh(new THREE.BoxGeometry(0.32, 0.03, 0.42), mat(page, { emissive: 0xffd27a, emissiveIntensity: 0.15 }), { x, y: 0.05 })
      leaf.rotation.z = x > 0 ? -0.08 : 0.08
      top.add(leaf)
    }
    g.add(top)
    // Bougie.
    g.add(mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.2, 8), mat(0xfff4dc), { x: 0.42, y: 1.2, z: 0.1 }))
    g.add(mesh(new THREE.ConeGeometry(0.03, 0.08, 6), mat(0xffb347, { emissive: 0xff8a20, emissiveIntensity: 3 }), { x: 0.42, y: 1.34, z: 0.1, shadow: false }))
  },
  arcade(g) {
    const body = mat(0x2a1a4a)
    g.add(mesh(new THREE.BoxGeometry(0.9, 1.9, 0.75), body, { y: 0.95 }))
    const screen = canvasTexture(256, 200, (c, w, h) => {
      const grad = c.createLinearGradient(0, 0, 0, h)
      grad.addColorStop(0, '#1b2a6b')
      grad.addColorStop(1, '#4a1a6b')
      c.fillStyle = grad
      c.fillRect(0, 0, w, h)
      c.fillStyle = '#ffd34f'
      c.font = 'bold 34px Georgia, serif'
      c.textAlign = 'center'
      c.fillText('AZEROTH', w / 2, 60)
      c.fillStyle = '#c792ea'
      c.font = 'bold 18px sans-serif'
      c.fillText('Pour la Horde !', w / 2, 92)
      c.fillStyle = '#3ddc84'
      c.fillRect(30, 130, 196, 12)
      c.fillStyle = '#4fc3ff'
      c.fillRect(30, 150, 140, 12)
    })
    const face = mesh(new THREE.PlaneGeometry(0.72, 0.58), screenMat(screen, 1.4), { y: 1.42, z: 0.38, shadow: false })
    face.rotation.x = -0.15
    g.add(face)
    g.add(mesh(new THREE.BoxGeometry(0.9, 0.12, 0.45), mat(0x1a1030), { y: 1.0, z: 0.5 }))
    for (const [x, c] of [[-0.2, 0xff3b6b], [0.05, 0x3ddc84], [0.2, 0x4fc3ff]]) g.add(mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.04, 10), mat(c, { emissive: c, emissiveIntensity: 1.5 }), { x, y: 1.08, z: 0.55, shadow: false }))
    g.add(mesh(new THREE.BoxGeometry(0.92, 0.22, 0.2), mat(0xff7ad9, { emissive: 0xff4ad9, emissiveIntensity: 1.6 }), { y: 1.98, z: 0.3, shadow: false }))
  },
  ball(g) {
    g.add(mesh(new THREE.CylinderGeometry(0.35, 0.45, 0.8, 8), mat(0x8a8f99), { y: 0.4 }))
    const ball = mesh(new THREE.IcosahedronGeometry(0.32, 1), mat(0xffffff), { y: 1.15 })
    g.add(ball)
    for (let i = 0; i < 6; i++) {
      const patch = mesh(new THREE.CircleGeometry(0.09, 5), mat(0x1a1a1a), { shadow: false })
      const dir = new THREE.Vector3().setFromSphericalCoords(0.325, Math.acos(1 - (2 * (i + 0.5)) / 6), i * 2.4)
      patch.position.copy(dir).setY(dir.y + 1.15)
      patch.lookAt(dir.clone().multiplyScalar(2).setY(dir.y * 2 + 1.15))
      g.add(patch)
    }
    g.userData.spin = ball
  },
  skis(g) {
    const rack = mat(0x6b4226)
    g.add(mesh(new THREE.BoxGeometry(1.4, 0.1, 0.1), rack, { y: 1.3, z: -0.2 }))
    for (const x of [-0.6, 0.6]) g.add(mesh(new THREE.BoxGeometry(0.1, 1.35, 0.1), rack, { x, y: 0.67, z: -0.2 }))
    for (const [x, c] of [[-0.3, 0xe74c3c], [-0.12, 0xe74c3c], [0.15, 0x2f6fd8], [0.33, 0x2f6fd8]]) {
      const ski = mesh(new THREE.BoxGeometry(0.1, 1.8, 0.03), mat(c), { x, y: 0.9, z: -0.08 })
      ski.rotation.x = -0.1
      g.add(ski)
    }
    for (const x of [-0.45, 0.48]) {
      const pole = mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.3, 5), mat(0xcccccc), { x, y: 0.65, z: 0 })
      pole.rotation.z = x > 0 ? -0.08 : 0.08
      g.add(pole)
    }
    // Petit tas de neige.
    g.add(mesh(new THREE.IcosahedronGeometry(0.4, 0), mat(0xf4f8ff), { x: 0.55, y: 0.1, z: 0.4 }))
  },
  flag(g) {
    g.add(mesh(new THREE.CylinderGeometry(0.05, 0.06, 3.2, 8), mat(0xdddddd), { y: 1.6 }))
    // Drapeau du Valais : moitié blanche, moitié rouge, treize étoiles.
    const tex = canvasTexture(240, 160, (c, w, h) => {
      c.fillStyle = '#ffffff'
      c.fillRect(0, 0, w / 2, h)
      c.fillStyle = '#e1251b'
      c.fillRect(w / 2, 0, w / 2, h)
      const star = (x, y, r, fill) => {
        c.fillStyle = fill
        c.beginPath()
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * Math.PI * 2 - Math.PI / 2
          const rr = i % 2 ? r * 0.45 : r
          c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr)
        }
        c.fill()
      }
      for (let i = 0; i < 13; i++) {
        const left = i < 7
        const k = left ? i : i - 7
        star(left ? 40 + (k % 2) * 30 : 160 + (k % 2) * 30, 18 + k * 21, 8, left ? '#e1251b' : '#ffffff')
      }
    })
    const cloth = mesh(new THREE.PlaneGeometry(1.5, 1, 8, 1), new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide }), { x: 0.78, y: 2.7, shadow: false })
    g.add(cloth)
    g.userData.wave = cloth
  },
  whiteboard(g) {
    for (const x of [-0.9, 0.9]) g.add(mesh(new THREE.BoxGeometry(0.06, 1.8, 0.06), mat(0x888899), { x, y: 0.9 }))
    g.add(mesh(new THREE.BoxGeometry(1.9, 1.15, 0.05), mat(0xdddde6), { y: 1.35 }))
    const tex = canvasTexture(320, 192, (c, w, h) => {
      c.fillStyle = '#ffffff'
      c.fillRect(0, 0, w, h)
      c.lineWidth = 4
      c.strokeStyle = '#2f6fd8'
      c.strokeRect(20, 30, 80, 44)
      c.strokeRect(220, 30, 80, 44)
      c.strokeStyle = '#e74c3c'
      c.strokeRect(120, 120, 80, 44)
      c.strokeStyle = '#333'
      c.beginPath()
      c.moveTo(100, 52)
      c.lineTo(220, 52)
      c.moveTo(60, 74)
      c.lineTo(160, 120)
      c.moveTo(260, 74)
      c.lineTo(160, 120)
      c.stroke()
      c.fillStyle = '#333'
      c.font = 'bold 18px sans-serif'
      c.fillText('Front', 34, 58)
      c.fillText('API', 244, 58)
      c.fillText('Base', 140, 148)
      c.fillStyle = '#27ae60'
      c.font = 'bold 20px sans-serif'
      c.fillText('Atelier du jour ✓', 90, 20)
    })
    g.add(mesh(new THREE.PlaneGeometry(1.8, 1.05), new THREE.MeshStandardMaterial({ map: tex }), { y: 1.35, z: 0.03, shadow: false }))
    g.add(mesh(new THREE.BoxGeometry(1.2, 0.04, 0.12), mat(0x888899), { y: 0.76, z: 0.05 }))
  },
  hologram(g) {
    g.add(mesh(new THREE.CylinderGeometry(0.6, 0.75, 0.8, 8), mat(0x3a3d55, { metalness: 0.5, roughness: 0.4 }), { y: 0.4 }))
    g.add(mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.04, 24), mat(0x7df9ff, { emissive: 0x3ad0ff, emissiveIntensity: 2.5 }), { y: 0.82, shadow: false }))
    const holo = mesh(new THREE.IcosahedronGeometry(0.4, 0), new THREE.MeshBasicMaterial({ color: 0x7df9ff, wireframe: true, transparent: true, opacity: 0.85 }), { y: 1.55, shadow: false })
    const core = mesh(new THREE.OctahedronGeometry(0.16, 0), mat(0xb48cff, { emissive: 0xb48cff, emissiveIntensity: 2.5 }), { y: 1.55, shadow: false })
    const beam = mesh(new THREE.CylinderGeometry(0.45, 0.5, 0.7, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0x7df9ff, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false }), { y: 1.2, shadow: false })
    g.add(holo, core, beam)
    g.userData.spin = holo
    g.userData.spin2 = core
  },
  console(g) {
    g.add(mesh(new THREE.BoxGeometry(1.8, 0.9, 0.8), mat(0x3a3d55, { metalness: 0.5, roughness: 0.4 }), { y: 0.45 }))
    const panel = mesh(new THREE.BoxGeometry(1.8, 0.08, 0.7), mat(0x2a2d40), { y: 0.95, z: 0.05 })
    panel.rotation.x = 0.35
    g.add(panel)
    for (const [x, c] of [[-0.55, 0xff5a7a], [-0.3, 0xffd34f], [0, 0x3ddc84], [0.3, 0x4fc3ff], [0.55, 0xb48cff]]) g.add(mesh(new THREE.BoxGeometry(0.14, 0.04, 0.14), mat(c, { emissive: c, emissiveIntensity: 1.8 }), { x, y: 1.0, z: 0.15, shadow: false }))
    g.add(mesh(new THREE.BoxGeometry(1.7, 0.9, 0.05), mat(0x1a1d2c), { y: 1.65, z: -0.3 }))
    g.add(mesh(new THREE.PlaneGeometry(1.6, 0.8), screenMat(codeScreen(9), 1.4), { y: 1.65, z: -0.27, shadow: false }))
  },
  dish(g) {
    g.add(mesh(new THREE.CylinderGeometry(0.1, 0.14, 1.6, 8), mat(0xcfd3e0), { y: 0.8 }))
    const dish = mesh(new THREE.SphereGeometry(0.9, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2.6), mat(0xeeeef5, { side: THREE.DoubleSide }), { y: 1.9 })
    dish.rotation.x = Math.PI + 0.7
    g.add(dish)
    g.add(mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.8, 5), mat(0x888899), { y: 2.0, z: 0.35 }))
    const blink = mesh(new THREE.SphereGeometry(0.07, 8, 6), mat(0xff3b3b, { emissive: 0xff2020, emissiveIntensity: 3 }), { y: 2.3, z: 0.55, shadow: false })
    g.add(blink)
    g.userData.blink = blink
    // Boîte aux lettres à côté.
    g.add(mesh(new THREE.BoxGeometry(0.4, 0.35, 0.5), mat(0xd6402f), { x: 0.9, y: 1.05 }))
    g.add(mesh(new THREE.BoxGeometry(0.06, 0.9, 0.06), mat(0x555555), { x: 0.9, y: 0.45 }))
  },
  trophy(g) {
    table(g, { w: 1, d: 0.7 })
    g.add(model('trophy', { height: 0.9, y: 0.86 }))
  },
  coffee(g) {
    const y = table(g, { w: 1.2, d: 0.7 })
    g.add(mesh(new THREE.BoxGeometry(0.45, 0.55, 0.4), mat(0x2b2b33, { metalness: 0.4 }), { y: y + 0.28, z: -0.1 }))
    g.add(mesh(new THREE.BoxGeometry(0.3, 0.1, 0.06), mat(0xffb347, { emissive: 0xff8a20, emissiveIntensity: 1.5 }), { y: y + 0.42, z: 0.11, shadow: false }))
    g.add(mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.1, 10), mat(0xffffff), { x: 0.35, y: y + 0.05, z: 0.1 }))
    g.add(mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.1, 10), mat(0xffffff), { x: -0.38, y: y + 0.05, z: 0.15 }))
  },
}

const TABLE_PROPS = new Set(['camera', 'laptop', 'phone', 'trophy', 'coffee'])
const hex = (c) => `#${new THREE.Color(c).getHexString()}`

// Étiquette en forme de carte : pastille avec l'icône, titre, bordure aux couleurs de l'île.
function labelTexture(title, icon, accent) {
  return canvasTexture(640, 180, (g, w, h) => {
    const r = 46
    const bh = 132
    g.beginPath()
    g.roundRect(8, 8, w - 16, bh, r)
    const grad = g.createLinearGradient(0, 0, 0, bh)
    grad.addColorStop(0, 'rgba(34, 26, 70, 0.96)')
    grad.addColorStop(1, 'rgba(16, 12, 36, 0.96)')
    g.fillStyle = grad
    g.fill()
    g.lineWidth = 6
    g.strokeStyle = accent
    g.stroke()
    // Petite pointe vers l'objet.
    g.beginPath()
    g.moveTo(w / 2 - 22, bh + 6)
    g.lineTo(w / 2, h - 6)
    g.lineTo(w / 2 + 22, bh + 6)
    g.closePath()
    g.fillStyle = accent
    g.fill()
    // Pastille de l'icône.
    g.beginPath()
    g.arc(78, 8 + bh / 2, 46, 0, Math.PI * 2)
    g.fillStyle = accent
    g.globalAlpha = 0.25
    g.fill()
    g.globalAlpha = 1
    g.font = '58px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText(icon || '✦', 78, 8 + bh / 2 + 3)
    g.fillStyle = '#ffffff'
    g.textAlign = 'left'
    let size = 54
    do {
      g.font = `bold ${size}px Georgia, serif`
      size -= 2
    } while (g.measureText(title).width > w - 175 && size > 28)
    g.fillText(title, 142, 8 + bh / 2 + 2)
  })
}

// Socle du coin d'activité : pavés au Passé, terrasse en bois au Présent, plateforme au Futur.
function platform(ctx, x, z, era, accent) {
  const g = new THREE.Group()
  g.position.set(x, 0, z)
  if (era === 'past') {
    g.add(mesh(new THREE.CylinderGeometry(2.15, 2.3, 0.1, 10), mat(0x6e6590), { y: 0.05 }))
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2
      const rr = i % 2 ? 1.55 : 1.25
      const stone = mesh(new THREE.CylinderGeometry(0.42, 0.45, 0.06, 6), mat(new THREE.Color(0x9a92c4).offsetHSL(0, 0, (Math.sin(i * 7) * 0.06))), { x: Math.cos(a) * rr, y: 0.12, z: Math.sin(a) * rr, shadow: false })
      stone.rotation.y = a
      g.add(stone)
    }
    g.add(mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.06, 8), mat(0x8a83ad), { y: 0.12, shadow: false }))
  } else if (era === 'future') {
    g.add(mesh(new THREE.CylinderGeometry(2.15, 2.3, 0.14, 6), mat(0x5b6078, { metalness: 0.5, roughness: 0.4 }), { y: 0.07 }))
    const rim = mesh(new THREE.TorusGeometry(2.05, 0.04, 4, 6), mat(accent, { emissive: accent, emissiveIntensity: 2.2 }), { y: 0.15, shadow: false })
    rim.rotation.x = Math.PI / 2
    rim.rotation.z = Math.PI / 6
    g.add(rim)
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + Math.PI / 6
      g.add(mesh(new THREE.BoxGeometry(0.08, 0.02, 1.4), mat(0x3b3f55), { x: Math.cos(a) * 1.2, y: 0.145, z: Math.sin(a) * 1.2, shadow: false }))
    }
  } else {
    g.add(mesh(new THREE.CylinderGeometry(2.15, 2.15, 0.14, 8), mat(0xb07a4a), { y: 0.07 }))
    for (let i = -3; i <= 3; i++) g.add(mesh(new THREE.BoxGeometry(0.03, 0.02, 4 * Math.cos(Math.asin(Math.min(1, Math.abs(i) / 3.6)))), mat(0x7a4f30), { x: i * 0.55, y: 0.145, shadow: false }))
  }
  ctx.group.add(g)
  ctx.noGrass?.push({ type: 'circle', x, z, r: 2.4 })
  return 0.15
}

// Décor autour de l'objet : étal de marché, parasol de terrasse ou arche lumineuse.
function dressing(ctx, g, era, prop, accent) {
  const isTable = TABLE_PROPS.has(prop)
  if (era === 'past') {
    if (isTable) {
      const wood = mat(0x6b4226)
      for (const [x, z] of [[-0.95, -0.75], [0.95, -0.75], [-0.95, 0.75], [0.95, 0.75]]) g.add(mesh(new THREE.BoxGeometry(0.1, z < 0 ? 2.5 : 2.1, 0.1), wood, { x, y: z < 0 ? 1.25 : 1.05, z }))
      const stripes = canvasTexture(128, 64, (c) => {
        for (let i = 0; i < 8; i++) {
          c.fillStyle = i % 2 ? '#f3e4c8' : '#8e2a5a'
          c.fillRect(i * 16, 0, 16, 64)
        }
      })
      const awning = mesh(new THREE.BoxGeometry(2.2, 0.05, 1.8), new THREE.MeshStandardMaterial({ map: stripes, roughness: 0.9 }), { y: 2.35 })
      awning.rotation.x = 0.22
      g.add(awning)
      for (let i = 0; i < 6; i++) g.add(mesh(new THREE.ConeGeometry(0.17, 0.25, 3), mat(i % 2 ? 0xf3e4c8 : 0x8e2a5a), { x: -0.92 + i * 0.37, y: 2.05, z: 0.9, shadow: false }))
      g.add(mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.7, 10), mat(0x8a5a32), { x: 1.35, y: 0.35, z: -0.5 }))
    } else {
      g.add(mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), mat(0x9a6a3a), { x: -1.3, y: 0.25, z: -0.6 }))
    }
    // Lanterne sur poteau.
    g.add(mesh(new THREE.BoxGeometry(0.1, 2, 0.1), mat(0x3a2a20), { x: 1.55, y: 1, z: 0.9 }))
    g.add(mesh(new THREE.BoxGeometry(0.26, 0.32, 0.26), mat(0xffd27a, { emissive: 0xffa040, emissiveIntensity: 2.2 }), { x: 1.55, y: 2.1, z: 0.9, shadow: false }))
  } else if (era === 'future') {
    for (const x of [-1.6, 1.6]) {
      g.add(mesh(new THREE.CylinderGeometry(0.1, 0.16, 2.4, 6), mat(0xcfd3e0, { metalness: 0.5 }), { x, y: 1.2, z: -0.8 }))
      g.add(mesh(new THREE.OctahedronGeometry(0.16, 0), mat(accent, { emissive: accent, emissiveIntensity: 2.5 }), { x, y: 2.55, z: -0.8, shadow: false }))
    }
    const arc = mesh(new THREE.TorusGeometry(1.6, 0.05, 6, 24, Math.PI), mat(accent, { emissive: accent, emissiveIntensity: 2 }), { y: 2.4, z: -0.8, shadow: false })
    g.add(arc)
    g.add(mesh(new THREE.OctahedronGeometry(0.35, 0), mat(0x7df9ff, { emissive: 0x3ad0ff, emissiveIntensity: 1, transparent: true, opacity: 0.85 }), { x: -1.4, y: 0.35, z: 1, shadow: false }))
  } else {
    if (isTable) {
      // Parasol et tabouret.
      g.add(mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.5, 6), mat(0xdddddd), { x: 1.05, y: 1.25, z: -0.6 }))
      g.add(mesh(new THREE.ConeGeometry(1.5, 0.5, 8), mat(accent), { x: 1.05, y: 2.55, z: -0.6 }))
      g.add(mesh(new THREE.CylinderGeometry(0.22, 0.2, 0.55, 10), mat(0x2b2b33), { x: -0.2, y: 0.28, z: 0.85 }))
    }
    // Plante en pot.
    g.add(mesh(new THREE.CylinderGeometry(0.25, 0.2, 0.45, 8), mat(0xd9cbe8), { x: -1.45, y: 0.22, z: -0.7 }))
    g.add(mesh(new THREE.IcosahedronGeometry(0.42, 0), mat(0x5aa04a), { x: -1.45, y: 0.75, z: -0.7 }))
  }
}

// Construit un point d'intérêt à (x, z) local et renvoie ses animations.
// En extérieur, l'objet est posé sur un petit socle décoré aux couleurs de l'époque.
export function buildPoint(ctx, x, z, { prop, title, icon, accent, rotY = 0, collide = true, labelY = 3, setting = true }) {
  const era = ctx.era ?? 'present'
  STYLE = era
  const outdoor = setting && !ctx.room && prop
  const base = outdoor ? platform(ctx, x, z, era, accent) : 0
  const g = new THREE.Group()
  g.position.set(x, base, z)
  g.rotation.y = rotY
  if (prop && BUILDERS[prop]) BUILDERS[prop](g)
  if (outdoor) dressing(ctx, g, era, prop, accent)
  ctx.group.add(g)
  if (prop && collide) ctx.addCollider(x, z, prop === 'flag' || prop === 'dish' ? 0.5 : TABLE_PROPS.has(prop) ? 1.0 : 0.75, 2)

  const ring = mesh(
    new THREE.RingGeometry(1.25, 1.5, 40),
    new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false }),
    { x, y: base + 0.04, z, shadow: false },
  )
  ring.rotation.x = -Math.PI / 2
  ctx.group.add(ring)

  // Étiquette flottante en forme de carte.
  const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTexture(title, icon, hex(accent)), transparent: true, depthWrite: false }))
  label.scale.set(2.9, 0.82, 1)
  const top = labelY + (outdoor && TABLE_PROPS.has(prop) ? 0.4 : 0)
  label.position.set(x, top, z)
  label.renderOrder = 5
  ctx.group.add(label)

  const phase = x * 0.7 + z * 0.3
  ctx.animated.push((dt, t) => {
    ring.material.opacity = 0.45 + Math.sin(t * 2.5 + phase) * 0.2
    ring.scale.setScalar(1 + Math.sin(t * 2.5 + phase) * 0.04)
    label.position.y = top + Math.sin(t * 1.8 + phase) * 0.08
    if (g.userData.spin) g.userData.spin.rotation.y += dt * 0.9
    if (g.userData.spin2) g.userData.spin2.rotation.y -= dt * 2
    if (g.userData.wave) g.userData.wave.rotation.y = Math.sin(t * 2 + phase) * 0.18
    if (g.userData.blink) g.userData.blink.visible = Math.sin(t * 5) > 0
  })
  return { group: g, ring, label }
}
