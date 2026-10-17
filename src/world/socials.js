import * as THREE from 'three'
import { mergeStatic, bakeSkinned } from './merge.js'
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js'
import { mat, mesh } from './helpers.js'
import { canvasTexture } from './points.js'
import { character } from './characters.js'
import { animate } from './models.js'

// Place des réseaux (île du Passé) : grands logos sculptés en volume, chacun sur un socle bas,
// disposés en arc autour d'une statue de chevalier, sur une place dallée avec lanternes,
// caisses et feuilles mortes. Un losange blanc flotte devant chaque socle.

const GITHUB_PATH = 'M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z'

// ---------- Formes 2D des logos (unité : carré de -0.5 à 0.5) ----------

function roundRect(x, y, w, h, r, path = new THREE.Shape()) {
  path.moveTo(x + r, y)
  path.lineTo(x + w - r, y)
  path.quadraticCurveTo(x + w, y, x + w, y + r)
  path.lineTo(x + w, y + h - r)
  path.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  path.lineTo(x + r, y + h)
  path.quadraticCurveTo(x, y + h, x, y + h - r)
  path.lineTo(x, y + r)
  path.quadraticCurveTo(x, y, x + r, y)
  return path
}
function circle(cx, cy, r, path = new THREE.Shape()) {
  path.absarc(cx, cy, r, 0, Math.PI * 2, false)
  return path
}
function poly(points, path = new THREE.Shape()) {
  points.forEach(([x, y], i) => (i ? path.lineTo(x, y) : path.moveTo(x, y)))
  path.closePath()
  return path
}
// Anneau : cercle évidé.
function ring(cx, cy, r, w) {
  const s = circle(cx, cy, r)
  s.holes.push(circle(cx, cy, r - w, new THREE.Path()))
  return s
}

function linkedinShapes() {
  const s = roundRect(-0.5, -0.5, 1, 1, 0.12)
  s.holes.push(roundRect(-0.33, -0.32, 0.16, 0.44, 0.01, new THREE.Path()))
  s.holes.push(circle(-0.25, 0.25, 0.09, new THREE.Path()))
  // Lettre « n » : jambe gauche, arche, jambe droite.
  const n = new THREE.Path()
  n.moveTo(-0.08, -0.32)
  n.lineTo(-0.08, 0.14)
  n.lineTo(0.06, 0.14)
  n.absarc(0.2, 0.0, 0.22, Math.PI * 0.82, 0, true)
  n.lineTo(0.42, -0.32)
  n.lineTo(0.27, -0.32)
  n.lineTo(0.27, 0.0)
  n.absarc(0.17, 0.0, 0.1, 0, Math.PI, false)
  n.lineTo(0.07, -0.32)
  n.closePath()
  s.holes.push(n)
  return [s]
}

function githubShapes() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path fill-rule="evenodd" d="${GITHUB_PATH}"/></svg>`
  const data = new SVGLoader().parse(svg)
  const shapes = data.paths.flatMap((p) => p.toShapes(true))
  // SVG : y vers le bas, 16 unités. On ramène au carré unité, y vers le haut.
  return shapes.map((shape) => {
    const remap = (pts) => pts.map((p) => new THREE.Vector2(p.x / 16 - 0.5, 0.5 - p.y / 16))
    const out = new THREE.Shape(remap(shape.getPoints(12)).reverse())
    for (const hole of shape.holes) out.holes.push(new THREE.Path(remap(hole.getPoints(12)).reverse()))
    return out
  })
}

function instagramShapes() {
  const frame = roundRect(-0.5, -0.5, 1, 1, 0.28)
  frame.holes.push(roundRect(-0.39, -0.39, 0.78, 0.78, 0.2, new THREE.Path()))
  return [frame, ring(0, 0, 0.23, 0.1), circle(0.24, 0.24, 0.065)]
}

function xShapes() {
  return [
    poly([[-0.42, 0.5], [-0.16, 0.5], [0.42, -0.5], [0.16, -0.5]]),
    poly([[0.3, 0.5], [0.4, 0.5], [-0.3, -0.5], [-0.4, -0.5]]),
  ]
}

function mailShapes() {
  const frame = roundRect(-0.5, -0.34, 1, 0.68, 0.06)
  frame.holes.push(roundRect(-0.41, -0.25, 0.82, 0.5, 0.02, new THREE.Path()))
  return [frame, poly([[-0.41, 0.25], [-0.3, 0.25], [0, 0.02], [0.3, 0.25], [0.41, 0.25], [0, -0.08]])]
}

function webShapes() {
  const shapes = [ring(0, 0, 0.5, 0.09)]
  const meridian = new THREE.Shape()
  meridian.absellipse(0, 0, 0.2, 0.45, 0, Math.PI * 2, false)
  meridian.holes.push(new THREE.Path().absellipse(0, 0, 0.11, 0.37, 0, Math.PI * 2, true))
  shapes.push(meridian)
  shapes.push(poly([[-0.42, 0.04], [0.42, 0.04], [0.42, -0.04], [-0.42, -0.04]]))
  shapes.push(poly([[-0.35, 0.24], [0.35, 0.24], [0.33, 0.17], [-0.33, 0.17]]))
  shapes.push(poly([[-0.33, -0.17], [0.33, -0.17], [0.35, -0.24], [-0.35, -0.24]]))
  return shapes
}

function youtubeShapes() {
  const s = roundRect(-0.5, -0.36, 1, 0.72, 0.18)
  s.holes.push(poly([[-0.12, 0.17], [0.2, 0], [-0.12, -0.17]], new THREE.Path()))
  return [s]
}

const LOGOS = { linkedin: linkedinShapes, github: githubShapes, instagram: instagramShapes, x: xShapes, mail: mailShapes, web: webShapes, youtube: youtubeShapes }

// Logo sculpté : formes extrudées avec un petit chanfrein, posé debout, base à y = 0.
function logoGeometry(logo, size) {
  const shapes = (LOGOS[logo] ?? webShapes)()
  const g = new THREE.ExtrudeGeometry(shapes, { depth: 0.22, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.025, bevelSegments: 2, curveSegments: 14 })
  g.scale(size, size, size)
  g.computeBoundingBox()
  const b = g.boundingBox
  g.translate(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2)
  g.computeVertexNormals()
  return g
}

export function createSocialPlaza(scene, world, { center, socials }) {
  const group = new THREE.Group()
  group.position.copy(center)
  scene.add(group)
  const y0 = world.groundAt(center.x, center.z, Infinity, true) ?? 0
  group.position.y = y0
  const stone = mat(0x8f88c8, { roughness: 0.85 })
  const darkStone = mat(0x6a6398, { roughness: 0.9 })
  const interactables = []
  const markers = []
  const col = (x, z, r, top = 2) => world.colliders.push({ x: center.x + x, z: center.z + z, r, top: y0 + top })

  // Statue centrale : un chevalier figé dans la pierre, sur un piédestal octogonal.
  group.add(mesh(new THREE.CylinderGeometry(1.9, 2.05, 0.45, 8), darkStone, { y: 0.22, z: 0.9 }))
  group.add(mesh(new THREE.CylinderGeometry(1.35, 1.5, 0.75, 8), stone, { y: 0.82, z: 0.9 }))
  const statue = character('knight', { height: 3, keep: ['1H_Sword', 'Round_Shield', 'Knight_Helmet', 'Knight_Cape'] })
  const { mixer } = animate(statue, 'Cheer')
  mixer.update(0.55)
  statue.traverse((o) => {
    if (o.isMesh) {
      o.material = stone
      o.castShadow = true
    }
  })
  bakeSkinned(statue)
  statue.position.set(0, 1.2, 0.9)
  group.add(statue)
  col(0, 0.9, 2.1, 4)

  // Logos en arc derrière et autour de la statue, tournés vers le centre de la place.
  const R = 5.5
  const n = socials.length
  socials.forEach((social, i) => {
    // Écart un peu plus grand au milieu, pour que la statue ne cache aucun logo.
    const u = i / Math.max(1, n - 1) - 0.5
    const angle = Math.PI * (1.5 + Math.sign(u) * (0.12 + Math.abs(u) * 0.76))
    const x = Math.cos(angle) * R
    const z = Math.sin(angle) * R + 0.4
    const monument = new THREE.Group()
    monument.position.set(x, 0, z)
    monument.rotation.y = Math.atan2(-x, -z + 2)
    // Socle bas en deux paliers.
    monument.add(mesh(new THREE.BoxGeometry(2.3, 0.24, 1.6), darkStone, { y: 0.12 }))
    monument.add(mesh(new THREE.BoxGeometry(2.0, 0.2, 1.3), stone, { y: 0.34 }))
    const carved = mat(0x9d96d6, { roughness: 0.8, emissive: social.color, emissiveIntensity: 0.18 })
    monument.add(mesh(logoGeometry(social.logo, 1.85), carved, { y: 0.44, z: -0.2 }))
    // Lueur discrète aux couleurs du réseau, au pied du logo.
    const glow = mesh(new THREE.PlaneGeometry(1.9, 0.08), new THREE.MeshBasicMaterial({ color: social.color, transparent: true, opacity: 0.85 }), { y: 0.445, z: 0.25, shadow: false })
    glow.rotation.x = -Math.PI / 2
    monument.add(glow)
    group.add(monument)
    col(x, z, 1.15, 2.6)
    // Losange blanc devant le socle : on sait où appuyer sur E.
    const front = new THREE.Vector3(0, 0, 1.5).applyAxisAngle(new THREE.Vector3(0, 1, 0), monument.rotation.y)
    const marker = mesh(new THREE.OctahedronGeometry(0.17), new THREE.MeshBasicMaterial({ color: 0xffffff }), { x: x + front.x, y: 0.55, z: z + front.z, shadow: false })
    marker.scale.set(1, 1, 0.35)
    const border = mesh(new THREE.OctahedronGeometry(0.23), new THREE.MeshBasicMaterial({ color: 0x1a1430 }), { shadow: false })
    border.scale.set(1, 1, 0.3)
    border.position.z = -0.02
    marker.add(border)
    group.add(marker)
    markers.push({ marker, phase: i })
    interactables.push({ type: 'social', x: center.x + x + front.x, z: center.z + z + front.z, r: 1.6, title: social.label, url: social.url, text: social.text, logo: social.logo, era: 'past' })
  })

  // Lanternes sur poteaux, comme sur la référence.
  for (const [lx, lz] of [[-3.6, 3.6], [3.8, 3.4], [6.2, -1.2]]) {
    group.add(mesh(new THREE.BoxGeometry(0.34, 0.25, 0.34), darkStone, { x: lx, y: 0.12, z: lz }))
    group.add(mesh(new THREE.CylinderGeometry(0.07, 0.09, 2.2, 6), mat(0x2b2440), { x: lx, y: 1.2, z: lz }))
    group.add(mesh(new THREE.BoxGeometry(0.42, 0.5, 0.42), mat(0x2b2440), { x: lx, y: 2.45, z: lz }))
    group.add(mesh(new THREE.BoxGeometry(0.32, 0.4, 0.44), mat(0xffd27a, { emissive: 0xffb347, emissiveIntensity: 2.6 }), { x: lx, y: 2.45, z: lz, shadow: false }))
    group.add(mesh(new THREE.ConeGeometry(0.36, 0.3, 4).rotateY(Math.PI / 4), mat(0x2b2440), { x: lx, y: 2.85, z: lz }))
    col(lx, lz, 0.3, 3)
  }
  const light = new THREE.PointLight(0xffb347, 6, 9)
  light.position.set(0, 3, 3)
  group.add(light)

  // Caisses empilées à côté de la statue.
  const wood = mat(0x8a5a32)
  const band = mat(0x3a2a1a)
  for (const [cx, cy, cz, rot] of [[2.3, 0.4, 2.4, 0.3], [2.35, 1.2, 2.35, 0.1], [-2.5, 0.4, 2.8, -0.4]]) {
    const crate = mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), wood, { x: cx, y: cy, z: cz })
    crate.rotation.y = rot
    crate.add(mesh(new THREE.BoxGeometry(0.84, 0.12, 0.84), band))
    crate.add(mesh(new THREE.BoxGeometry(0.1, 0.84, 0.84), band))
    group.add(crate)
  }
  col(2.3, 2.4, 0.6)
  col(-2.5, 2.8, 0.6)

  // Feuilles mortes éparpillées sur les dalles.
  const leaves = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.16, 0.12).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x5a3f73, roughness: 1 }), 140)
  const m = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  for (let i = 0; i < 140; i++) {
    const a = Math.random() * Math.PI * 2
    const d = 2.2 + Math.sqrt(Math.random()) * 4.4
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.random() * Math.PI)
    m.compose(new THREE.Vector3(Math.cos(a) * d, 0.12, Math.sin(a) * d), q, new THREE.Vector3(1, 1, 1).multiplyScalar(0.7 + Math.random()))
    leaves.setMatrixAt(i, m)
  }
  leaves.receiveShadow = true
  group.add(leaves)

  // Titre flottant de la place.
  const title = new THREE.Sprite(new THREE.SpriteMaterial({
    map: canvasTexture(640, 150, (g, w, h) => {
      g.beginPath()
      g.roundRect(8, 8, w - 16, h - 16, 40)
      g.fillStyle = 'rgba(26, 20, 52, 0.92)'
      g.fill()
      g.lineWidth = 6
      g.strokeStyle = '#ffb347'
      g.stroke()
      g.fillStyle = '#ffffff'
      g.font = 'bold 64px "Outfit Variable", "Inter Variable", sans-serif'
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      g.fillText('Mes réseaux', w / 2, h / 2 + 2)
    }),
    depthWrite: false,
  }))
  title.scale.set(3.6, 0.85, 1)
  title.position.y = 6.3
  group.add(title)

  const api = {
    interactables,
    update(dt, t) {
      for (const { marker, phase } of markers) {
        marker.rotation.y = t * 1.5 + phase
        marker.position.y = 0.6 + Math.sin(t * 2 + phase) * 0.06
      }
      title.position.y = 6.3 + Math.sin(t * 1.3) * 0.08
    },
  }
  mergeStatic(group, [(dt, t) => api.update(dt, t)])
  world.addRegion?.(group, center.x, center.z, 10)
  return api
}

// Grande bannière flottante à l'arrivée : on comprend tout de suite qu'on est sur un portfolio.
export function createPortfolioBanner(scene, world, { x, z, height = 4.6 }) {
  const texture = canvasTexture(1024, 300, (g, w, h) => {
    g.beginPath()
    g.roundRect(10, 10, w - 20, h - 20, 60)
    const grad = g.createLinearGradient(0, 0, w, h)
    grad.addColorStop(0, 'rgba(46, 30, 88, 0.95)')
    grad.addColorStop(1, 'rgba(20, 14, 44, 0.95)')
    g.fillStyle = grad
    g.fill()
    g.lineWidth = 8
    g.strokeStyle = '#ffb347'
    g.stroke()
    g.textAlign = 'center'
    g.fillStyle = '#ffb347'
    g.font = 'bold 38px "Inter Variable", system-ui, sans-serif'
    g.fillText('PORTFOLIO', w / 2, 82)
    g.fillStyle = '#ffffff'
    g.font = 'bold 92px "Outfit Variable", "Inter Variable", sans-serif'
    g.fillText('Antoine Quarroz', w / 2, 175)
    g.fillStyle = '#d9ccff'
    g.font = '40px "Inter Variable", system-ui, sans-serif'
    g.fillText('Développeur web & mobile · Valais', w / 2, 240)
  })
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthWrite: false, fog: false }))
  const y = world.groundAt(x, z, Infinity, true) ?? 0
  sprite.scale.set(7, 2.05, 1)
  sprite.position.set(x, y + height, z)
  sprite.renderOrder = 2
  scene.add(sprite)
  return {
    update(dt, t) {
      sprite.position.y = y + height + Math.sin(t * 1.2) * 0.12
    },
  }
}
