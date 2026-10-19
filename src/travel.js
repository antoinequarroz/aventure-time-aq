import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

// Scènes de trajet : quand on prend la voiture (Passé ↔ Présent) ou la fusée (Présent ↔ Futur),
// on quitte le monde le temps du voyage pour une petite cinématique plein écran.
// La voiture traverse un tunnel du temps (horloges, engrenages, sabliers, années qui défilent),
// la fusée décolle, traverse les nuages et file vers la Lune (ou revient vers la Terre).
// Même rendu que le reste du jeu : low-poly, facettes, couleurs par sommet, accents lumineux.

const ERA = {
  past: { name: 'Passé', accent: 0xb48cff, bg: 0x140f2e, year: 1291 },
  present: { name: 'Présent', accent: 0xffb347, bg: 0x4a2348, year: 2026 },
  future: { name: 'Futur', accent: 0x8fe3ff, bg: 0x0b0820, year: 2126 },
}
// Années qui défilent dans le tunnel (du Moyen Âge à aujourd'hui).
const YEARS = [1291, 1415, 1536, 1648, 1789, 1848, 1903, 1969, 2001, 2026]
const RE = 60 // rayon de la Terre (scène fusée)
const RM = 26 // rayon de la Lune
const KM = 384400

const clamp01 = (x) => Math.max(0, Math.min(1, x))
const smooth = (a, b, x) => {
  const k = clamp01((x - a) / (b - a))
  return k * k * (3 - 2 * k)
}
const lerp = (a, b, k) => a + (b - a) * k

function rng(seed) {
  let s = seed
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

// ---------- Petits outils de géométrie ----------
// Une pièce colorée (couleur par sommet), prête à être fusionnée avec d'autres.
function part(geo, color, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  if (geo.index) geo = geo.toNonIndexed()
  geo.deleteAttribute('uv')
  if (rx || ry || rz) geo.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz)))
  geo.translate(x, y, z)
  const c = new THREE.Color(color)
  const arr = new Float32Array(geo.attributes.position.count * 3)
  for (let i = 0; i < arr.length; i += 3) arr.set([c.r, c.g, c.b], i)
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3))
  return geo
}
function merged(parts) {
  const g = mergeGeometries(parts)
  g.computeVertexNormals()
  return g
}
const flat = (o = {}) => new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.8, ...o })
const glowMat = (color, opacity = 1, o = {}) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, ...o })

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  draw(c.getContext('2d'), w, h)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}
function glowTexture(inner, outer) {
  return canvasTex(128, 128, (g) => {
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64)
    grad.addColorStop(0, inner)
    grad.addColorStop(0.3, outer)
    grad.addColorStop(1, 'rgba(0,0,0,0)')
    g.fillStyle = grad
    g.fillRect(0, 0, 128, 128)
  })
}

function noise3(seed) {
  const k = [1.3, 2.7, 5.1].map((f, i) => [f, seed * (i + 1.7), seed * (i + 3.1)])
  return (x, y, z) => k.reduce((s, [f, a, b], i) => s + (Math.sin(x * f * 3 + a) * Math.cos(y * f * 3.4 + b) + Math.sin(z * f * 2.6 + a + b)) / (2 * (i + 1)), 0)
}
// Planète en facettes : relief léger et une couleur unie par face.
function planetGeometry(r, detail, seed, bump, paint) {
  const geo = new THREE.IcosahedronGeometry(r, detail)
  const pos = geo.attributes.position
  const n = noise3(seed)
  const v = new THREE.Vector3()
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize()
    // Le sommet (où se trouve la base de lancement) reste bien plat.
    const k = v.y > 0.985 ? 0 : 1
    v.multiplyScalar(r * (1 + n(v.x * 1.7, v.y * 1.7, v.z * 1.7) * bump * k))
    pos.setXYZ(i, v.x, v.y, v.z)
  }
  const colors = new Float32Array(pos.count * 3)
  const c = new THREE.Color()
  for (let f = 0; f < pos.count; f += 3) {
    v.set(0, 0, 0)
    for (let k = 0; k < 3; k++) v.x += pos.getX(f + k), v.y += pos.getY(f + k), v.z += pos.getZ(f + k)
    v.normalize()
    paint(v, n(v.x * 2, v.y * 2, v.z * 2), c)
    for (let k = 0; k < 3; k++) colors.set([c.r, c.g, c.b], (f + k) * 3)
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geo.computeVertexNormals()
  return geo
}

// Place une instance posée sur une sphère (direction n, hauteur h au-dessus de la surface).
const _q = new THREE.Quaternion()
const _up = new THREE.Vector3(0, 1, 0)
function onSphere(m4, r, n, h, s, spin = 0) {
  _q.setFromUnitVectors(_up, n)
  if (spin) _q.multiply(new THREE.Quaternion().setFromAxisAngle(_up, spin))
  return m4.compose(n.clone().multiplyScalar(r + h), _q, new THREE.Vector3(s, s, s))
}

// ---------- Le pick-up rouge ----------
function buildPickup() {
  const car = new THREE.Group()
  const red = 0xe0453a
  const dark = 0xa82c2a
  const body = merged([
    part(new THREE.BoxGeometry(2, 0.6, 4.1), red, 0, 0.78, 0),
    part(new THREE.BoxGeometry(1.84, 0.78, 1.55), red, 0, 1.45, -0.05),
    part(new THREE.BoxGeometry(1.9, 0.5, 1.25), 0x2b2650, 0, 1.5, -0.05),
    part(new THREE.BoxGeometry(1.7, 0.5, 0.08), 0x3b3570, 0, 1.47, -0.86, -0.35),
    part(new THREE.BoxGeometry(1.86, 0.1, 1.6), dark, 0, 1.87, -0.05),
    part(new THREE.BoxGeometry(0.14, 0.32, 1.35), dark, 0.93, 1.24, 1.3),
    part(new THREE.BoxGeometry(0.14, 0.32, 1.35), dark, -0.93, 1.24, 1.3),
    part(new THREE.BoxGeometry(2, 0.32, 0.14), dark, 0, 1.24, 2.0),
    part(new THREE.BoxGeometry(2.1, 0.22, 0.22), 0x8a8598, 0, 0.55, -2.08),
    part(new THREE.BoxGeometry(2.1, 0.22, 0.22), 0x8a8598, 0, 0.55, 2.08),
    part(new THREE.BoxGeometry(1.1, 0.26, 0.06), 0x1f1b2e, 0, 0.86, -2.06),
    part(new THREE.BoxGeometry(2.04, 0.08, 4.12), 0xffd27a, 0, 1.0, 0),
  ])
  car.add(new THREE.Mesh(body, flat({ roughness: 0.55 })))
  // Phares et feux arrière.
  const lights = merged([
    part(new THREE.BoxGeometry(0.38, 0.2, 0.06), 0xfff4c0, 0.7, 0.88, -2.07),
    part(new THREE.BoxGeometry(0.38, 0.2, 0.06), 0xfff4c0, -0.7, 0.88, -2.07),
    part(new THREE.BoxGeometry(0.3, 0.16, 0.06), 0xff3a4a, 0.75, 0.9, 2.07),
    part(new THREE.BoxGeometry(0.3, 0.16, 0.06), 0xff3a4a, -0.75, 0.9, 2.07),
  ])
  car.add(new THREE.Mesh(lights, new THREE.MeshBasicMaterial({ vertexColors: true })))
  // Roues : un seul maillage instancié.
  const wheelGeo = merged([
    part(new THREE.CylinderGeometry(0.46, 0.46, 0.36, 10), 0x1f1b2e, 0, 0, 0, 0, 0, Math.PI / 2),
    part(new THREE.CylinderGeometry(0.22, 0.22, 0.4, 6), 0xc9c4d8, 0, 0, 0, 0, 0, Math.PI / 2),
  ])
  const wheels = new THREE.InstancedMesh(wheelGeo, flat(), 4)
  wheels.userData.spots = [[1, -1.35], [-1, -1.35], [1, 1.35], [-1, 1.35]]
  car.add(wheels)
  // Halos des phares.
  const beams = new THREE.Group()
  const beamMat = new THREE.SpriteMaterial({ map: glowTexture('rgba(255,250,220,1)', 'rgba(255,220,140,0.35)'), blending: THREE.AdditiveBlending, depthWrite: false })
  for (const x of [-0.7, 0.7]) {
    const b = new THREE.Sprite(beamMat)
    b.scale.setScalar(1.6)
    b.position.set(x, 0.88, -2.2)
    beams.add(b)
  }
  car.add(beams)
  // Traînées de feu derrière les roues arrière, comme une voiture qui remonte le temps.
  const trailTex = canvasTex(32, 256, (g) => {
    const grad = g.createLinearGradient(0, 0, 0, 256)
    grad.addColorStop(0, 'rgba(255,240,200,1)')
    grad.addColorStop(0.15, 'rgba(255,179,71,0.9)')
    grad.addColorStop(0.6, 'rgba(255,111,159,0.35)')
    grad.addColorStop(1, 'rgba(180,140,255,0)')
    g.fillStyle = grad
    g.fillRect(0, 0, 32, 256)
    const side = g.createLinearGradient(0, 0, 32, 0)
    side.addColorStop(0, 'rgba(0,0,0,1)')
    side.addColorStop(0.5, 'rgba(0,0,0,0)')
    side.addColorStop(1, 'rgba(0,0,0,1)')
    g.globalCompositeOperation = 'destination-out'
    g.fillStyle = side
    g.fillRect(0, 0, 32, 256)
  })
  const trailGeo = new THREE.PlaneGeometry(0.5, 14)
  trailGeo.rotateX(-Math.PI / 2)
  trailGeo.translate(0, 0.04, 7 + 1.4)
  const trails = new THREE.Group()
  for (const x of [-1, 1]) {
    const tr = new THREE.Mesh(trailGeo, new THREE.MeshBasicMaterial({ map: trailTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }))
    tr.position.x = x
    trails.add(tr)
  }
  car.add(trails)
  return { car, wheels, beams, trails }
}

// ---------- La fusée (comme celle de l'île) ----------
function buildRocket() {
  const rocket = new THREE.Group()
  const model = new THREE.Group()
  model.position.y = -4
  rocket.add(model)
  const parts = [
    part(new THREE.CylinderGeometry(1, 1.1, 6, 14), 0xf2f0f8, 0, 4, 0),
    part(new THREE.ConeGeometry(1, 2.2, 14), 0xd6402f, 0, 8.1, 0),
    part(new THREE.CylinderGeometry(1.03, 1.03, 0.35, 14), 0xd6402f, 0, 2.2, 0),
    part(new THREE.CylinderGeometry(1.04, 1.04, 0.12, 14), 0xffd27a, 0, 6.9, 0),
    part(new THREE.CylinderGeometry(0.62, 0.9, 0.8, 12), 0x5a5670, 0, 0.6, 0),
    part(new THREE.TorusGeometry(0.5, 0.09, 6, 14), 0xc9c4d8, 0, 5.5, 1.02),
  ]
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + Math.PI / 6
    const fin = new THREE.BoxGeometry(0.16, 2, 1.25)
    fin.translate(0, 0, 0)
    parts.push(part(fin, 0xd6402f, Math.cos(a) * 1.2, 1.7, Math.sin(a) * 1.2, 0, Math.PI / 2 - a, 0))
  }
  model.add(new THREE.Mesh(merged(parts), flat({ roughness: 0.5 })))
  const win = new THREE.Mesh(new THREE.CircleGeometry(0.45, 14), new THREE.MeshBasicMaterial({ color: 0x8fe3ff }))
  win.position.set(0, 5.5, 1.04)
  model.add(win)
  // Flamme : deux cônes additifs et un halo.
  const flame = new THREE.Group()
  flame.position.y = 0.2
  const outer = new THREE.Mesh(new THREE.ConeGeometry(0.85, 3.6, 12, 1, true), glowMat(0xff8a3c, 0.85))
  const inner = new THREE.Mesh(new THREE.ConeGeometry(0.45, 2.2, 10, 1, true), glowMat(0xfff2c0, 1))
  outer.rotation.x = inner.rotation.x = Math.PI
  outer.position.y = -1.8
  inner.position.y = -1.1
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(255,240,200,1)', 'rgba(255,140,60,0.5)'), blending: THREE.AdditiveBlending, depthWrite: false }))
  halo.scale.setScalar(5)
  halo.position.y = -0.8
  flame.add(outer, inner, halo)
  model.add(flame)
  // Bouclier de rentrée atmosphérique (retour sur Terre).
  const plasma = new THREE.Mesh(new THREE.SphereGeometry(2.2, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), glowMat(0xff8a3c, 0, { side: THREE.DoubleSide }))
  plasma.scale.set(1, 2.4, 1)
  plasma.position.y = 7.4
  model.add(plasma)
  return { rocket, flame, outer, inner, halo, plasma }
}

// ---------- Vue ----------
export function createTravel({ renderer, sfx }) {
  let ui = null
  let active = false
  let car = null
  let rocket = null
  let cur = null
  let trip = null
  const tmp = new THREE.Vector3()
  const tmp2 = new THREE.Vector3()
  const m4 = new THREE.Matrix4()
  const col = new THREE.Color()
  const col2 = new THREE.Color()

  function portraitBoost(cam, fov) {
    const a = innerWidth / innerHeight
    cam.fov = a < 1 ? fov * Math.min(1.45, 1 + (1 - a) * 0.75) : fov
    cam.aspect = a
    cam.updateProjectionMatrix()
  }

  // ======================= Voiture : le tunnel du temps =======================
  function buildCarScene() {
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(ERA.past.bg)
    scene.fog = new THREE.Fog(ERA.past.bg, 40, 190)
    const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 600)
    scene.add(new THREE.HemisphereLight(0xd8ccff, 0x2c1f63, 1.5))
    const key = new THREE.DirectionalLight(0xffe2c0, 1.4)
    key.position.set(-4, 9, 5)
    scene.add(key)
    const R = rng(3)

    // La route lumineuse : un ruban dont la texture défile.
    const roadTex = canvasTex(128, 256, (g) => {
      g.fillStyle = '#1a1530'
      g.fillRect(0, 0, 128, 256)
      g.fillStyle = 'rgba(180,140,255,0.14)'
      for (let y = 0; y < 256; y += 32) g.fillRect(0, y, 128, 2)
      for (const x of [0, 120]) {
        const grad = g.createLinearGradient(x, 0, x + 8, 0)
        grad.addColorStop(0, x ? 'rgba(180,140,255,0.2)' : '#e6d8ff')
        grad.addColorStop(1, x ? '#e6d8ff' : 'rgba(180,140,255,0.2)')
        g.fillStyle = grad
        g.fillRect(x, 0, 8, 256)
      }
      g.fillStyle = '#ffd27a'
      g.fillRect(60, 0, 8, 120)
    })
    roadTex.wrapT = THREE.RepeatWrapping
    roadTex.repeat.set(1, 26)
    const road = new THREE.Mesh(new THREE.PlaneGeometry(7, 340), new THREE.MeshBasicMaterial({ map: roadTex }))
    road.rotation.x = -Math.PI / 2
    road.position.z = -150
    scene.add(road)
    // Bordures en néon sous la route.
    const edge = new THREE.Mesh(new THREE.BoxGeometry(7.6, 0.3, 340), glowMat(0xb48cff, 0.35))
    edge.position.set(0, -0.2, -150)
    scene.add(edge)

    // Lueur au bout du tunnel : la couleur de l'époque d'arrivée.
    const portal = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0.35)'), blending: THREE.AdditiveBlending, depthWrite: false, fog: false }))
    portal.scale.setScalar(150)
    portal.position.set(0, 4, -260)
    scene.add(portal)

    // Anneaux du tunnel (octogones qui tournent).
    const RINGS = 24
    const SPACING = 13
    const rings = new THREE.InstancedMesh(new THREE.TorusGeometry(10, 0.16, 4, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }), RINGS)
    rings.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(RINGS * 3), 3)
    const ringZ = Array.from({ length: RINGS }, (_, i) => 10 - i * SPACING)
    scene.add(rings)

    // Spirale de poussière d'étoiles.
    const SW = 1400
    const swirl = { z: new Float32Array(SW), a: new Float32Array(SW), r: new Float32Array(SW) }
    const swPos = new Float32Array(SW * 3)
    const swCol = new Float32Array(SW * 3)
    const palette = [0xb48cff, 0xffd27a, 0x8fe3ff, 0xff6f9f, 0xffffff].map((h) => new THREE.Color(h))
    for (let i = 0; i < SW; i++) {
      swirl.z[i] = 15 - R() * 260
      swirl.a[i] = (i % 3) * 2.09 + R() * 0.6
      swirl.r[i] = 6.5 + R() * 6
      const c = palette[Math.floor(R() * palette.length)]
      swCol.set([c.r, c.g, c.b], i * 3)
    }
    const swGeo = new THREE.BufferGeometry()
    swGeo.setAttribute('position', new THREE.BufferAttribute(swPos, 3))
    swGeo.setAttribute('color', new THREE.BufferAttribute(swCol, 3))
    const dot = glowTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0.5)')
    scene.add(new THREE.Points(swGeo, new THREE.PointsMaterial({ size: 0.55, map: dot, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })))

    // Lignes de vitesse.
    const LINES = 110
    const lineGeo = new THREE.BoxGeometry(0.05, 0.05, 1)
    const lines = new THREE.InstancedMesh(lineGeo, glowMat(0xe6d8ff, 0.7), LINES)
    const lineData = Array.from({ length: LINES }, () => {
      const a = R() * Math.PI * 2
      return { x: Math.cos(a) * (3 + R() * 7), y: 1.5 + Math.sin(a) * (2 + R() * 6), z: 10 - R() * 200, len: 3 + R() * 7 }
    })
    scene.add(lines)

    // Objets du temps qui flottent : horloges, engrenages, sabliers.
    const clockGeo = merged([
      part(new THREE.CylinderGeometry(1.1, 1.1, 0.22, 16), 0xf6ecd2, 0, 0, 0, Math.PI / 2),
      part(new THREE.TorusGeometry(1.14, 0.14, 6, 16), 0xffd27a),
      ...[0, 1, 2, 3].map((k) => part(new THREE.BoxGeometry(0.09, 0.26, 0.06), 0x1a1530, Math.sin((k * Math.PI) / 2) * 0.85, Math.cos((k * Math.PI) / 2) * 0.85, 0.13)),
      part(new THREE.CylinderGeometry(0.1, 0.1, 0.1, 8), 0x1a1530, 0, 0, 0.14, Math.PI / 2),
      part(new THREE.SphereGeometry(0.16, 6, 4), 0xffd27a, 0, 1.32, 0),
    ])
    const handGeo = merged([part(new THREE.BoxGeometry(0.08, 0.72, 0.05), 0x1a1530, 0, 0.32, 0.15)])
    const gearShape = new THREE.Shape()
    const TEETH = 10
    for (let i = 0; i < TEETH * 4; i++) {
      const a = (i / (TEETH * 4)) * Math.PI * 2
      const r = i % 4 < 2 ? 1.05 : 0.8
      if (i === 0) gearShape.moveTo(Math.cos(a) * r, Math.sin(a) * r)
      else gearShape.lineTo(Math.cos(a) * r, Math.sin(a) * r)
    }
    const hole = new THREE.Path()
    hole.absarc(0, 0, 0.3, 0, Math.PI * 2, true)
    gearShape.holes.push(hole)
    const gearGeo = new THREE.ExtrudeGeometry(gearShape, { depth: 0.25, bevelEnabled: false, curveSegments: 6 })
    gearGeo.translate(0, 0, -0.125)
    const hourGeo = merged([
      part(new THREE.CylinderGeometry(0.75, 0.75, 0.16, 8), 0x8a5a3a, 0, 1.15, 0),
      part(new THREE.CylinderGeometry(0.75, 0.75, 0.16, 8), 0x8a5a3a, 0, -1.15, 0),
      part(new THREE.ConeGeometry(0.62, 1.05, 8), 0xcff0ff, 0, 0.55, 0, Math.PI),
      part(new THREE.ConeGeometry(0.62, 1.05, 8), 0xcff0ff, 0, -0.55, 0),
      part(new THREE.ConeGeometry(0.5, 0.45, 8), 0xffd27a, 0, -0.85, 0),
      ...[0, 1, 2].map((k) => part(new THREE.CylinderGeometry(0.06, 0.06, 2.2, 5), 0x6b4530, Math.cos(k * 2.09) * 0.66, 0, Math.sin(k * 2.09) * 0.66)),
    ])
    const floatMat = flat({ emissive: 0x2c1f63, emissiveIntensity: 0.6, roughness: 0.5 })
    const N_CLOCK = 9
    const N_GEAR = 10
    const N_HOUR = 7
    const clocks = new THREE.InstancedMesh(clockGeo, floatMat, N_CLOCK)
    const hands = new THREE.InstancedMesh(handGeo, floatMat, N_CLOCK * 2)
    const gears = new THREE.InstancedMesh(part(gearGeo, 0xffd27a), flat({ emissive: 0x7a4a10, emissiveIntensity: 0.5, roughness: 0.35, metalness: 0.3 }), N_GEAR)
    const hours = new THREE.InstancedMesh(hourGeo, floatMat, N_HOUR)
    scene.add(clocks, hands, gears, hours)
    const floaters = []
    const addFloat = (mesh, i, kind) => {
      const a = R() * Math.PI * 2
      floaters.push({ mesh, i, kind, a, r: 4.5 + R() * 4, z: 10 - R() * 220, spin: (R() - 0.5) * 2.5, phase: R() * 6, s: 0.8 + R() * 0.6 })
    }
    for (let i = 0; i < N_CLOCK; i++) addFloat(clocks, i, 'clock')
    for (let i = 0; i < N_GEAR; i++) addFloat(gears, i, 'gear')
    for (let i = 0; i < N_HOUR; i++) addFloat(hours, i, 'hour')

    // Îlots flottants avec leurs bâtiments : les tours de château deviennent des maisons.
    const SLOTS = 18
    const islandTop = new THREE.InstancedMesh(merged([part(new THREE.CylinderGeometry(2.6, 2.4, 0.5, 7), 0xffffff, 0, -0.25, 0)]), flat(), SLOTS)
    islandTop.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(SLOTS * 3), 3)
    const islandRock = new THREE.InstancedMesh(merged([
      part(new THREE.ConeGeometry(2.4, 3.4, 7), 0x5a4a8a, 0, -2.2, 0, Math.PI),
      part(new THREE.ConeGeometry(1.1, 1.6, 6), 0x463a72, 0.8, -4.2, 0.3, Math.PI),
    ]), flat(), SLOTS)
    const towerGeo = merged([
      part(new THREE.CylinderGeometry(0.8, 0.9, 3.6, 8), 0x8d84b8, 0, 1.8, 0),
      part(new THREE.CylinderGeometry(1.0, 1.0, 0.4, 8), 0x7a70a8, 0, 3.7, 0),
      part(new THREE.ConeGeometry(1.1, 1.8, 8), 0x5b3fa6, 0, 4.8, 0),
      part(new THREE.BoxGeometry(1.4, 2.0, 1.4), 0x9d94c6, 1.4, 1.0, 0.2),
      ...[-1, 1].map((s) => part(new THREE.BoxGeometry(0.3, 0.3, 0.3), 0x9d94c6, 1.4 + s * 0.5, 2.15, 0.2)),
      part(new THREE.BoxGeometry(0.06, 1.1, 0.06), 0x1a1530, 0, 6.1, 0),
      part(new THREE.BoxGeometry(0.5, 0.3, 0.04), 0xff6f9f, 0.26, 6.45, 0),
    ])
    const towerWin = merged([
      part(new THREE.BoxGeometry(0.22, 0.5, 0.1), 0xffd27a, 0, 2.4, 0.86),
      part(new THREE.BoxGeometry(0.22, 0.5, 0.1), 0xffd27a, 0.6, 1.4, 0.65, 0, 0.8),
      part(new THREE.BoxGeometry(0.3, 0.4, 0.1), 0xffd27a, 1.4, 1.1, 0.92),
    ])
    const houseGeo = merged([
      part(new THREE.BoxGeometry(2.2, 1.6, 1.8), 0xf3e2c7, 0, 0.8, 0),
      part(new THREE.CylinderGeometry(0.01, 1.55, 1.1, 4, 1), 0xd9643a, 0, 2.15, 0, 0, Math.PI / 4).scale(1.05, 1, 0.85),
      part(new THREE.BoxGeometry(0.5, 0.9, 0.08), 0x8a5a3a, -0.5, 0.45, 0.92),
      part(new THREE.BoxGeometry(0.3, 0.7, 0.3), 0x9a8fb8, 0.6, 2.5, 0),
      part(new THREE.BoxGeometry(1.4, 1.1, 1.3), 0xe8d5b5, 1.6, 0.55, -0.2),
      part(new THREE.CylinderGeometry(0.01, 1.0, 0.7, 4, 1), 0xb94e30, 1.6, 1.45, -0.2, 0, Math.PI / 4),
    ])
    const houseWin = merged([
      part(new THREE.BoxGeometry(0.42, 0.42, 0.08), 0xffd27a, 0.45, 0.95, 0.92),
      part(new THREE.BoxGeometry(0.36, 0.36, 0.08), 0xffd27a, 1.6, 0.6, 0.47),
    ])
    const winMat = new THREE.MeshBasicMaterial({ vertexColors: true })
    const towers = new THREE.InstancedMesh(towerGeo, flat(), SLOTS)
    const towerW = new THREE.InstancedMesh(towerWin, winMat, SLOTS)
    const houses = new THREE.InstancedMesh(houseGeo, flat(), SLOTS)
    const houseW = new THREE.InstancedMesh(houseWin, winMat, SLOTS)
    scene.add(islandTop, islandRock, towers, towerW, houses, houseW)
    const slots = Array.from({ length: SLOTS }, (_, i) => {
      const side = i % 2 ? 1 : -1
      return { side, x: side * (15 + R() * 9), y: -3 + R() * 5, z: 10 - (i / SLOTS) * 230 - R() * 6, rot: R() * 6, thr: 0.3 + R() * 0.4, s: 0.9 + R() * 0.5 }
    })

    // Années (panneaux lumineux).
    const yearSprites = new Map()
    const drawYear = (y) => canvasTex(512, 180, (g) => {
      g.font = '700 128px "Outfit Variable", Outfit, system-ui, sans-serif'
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      g.shadowColor = 'rgba(180,140,255,0.95)'
      g.shadowBlur = 28
      g.fillStyle = '#fff4dc'
      g.fillText(String(y), 256, 96)
      g.shadowBlur = 0
      g.strokeStyle = 'rgba(255,210,122,0.9)'
      g.lineWidth = 3
      g.strokeText(String(y), 256, 96)
    })
    for (const y of YEARS) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: drawYear(y), transparent: true, depthWrite: false }))
      s.scale.set(7, 2.46, 1)
      s.visible = false
      scene.add(s)
      yearSprites.set(y, s)
    }
    // Les polices arrivent parfois après : on redessine.
    document.fonts?.ready.then(() => {
      for (const [y, s] of yearSprites) {
        s.material.map.dispose()
        s.material.map = drawYear(y)
      }
    })

    const pick = buildPickup()
    scene.add(pick.car)

    return { scene, camera, road, roadTex, edge, portal, rings, ringZ, SPACING, swirl, swPos, swGeo, lines, lineData, floaters, hands, slots, islandTop, islandRock, towers, towerW, houses, houseW, yearSprites, pick, dist: 0 }
  }

  function startCar(c) {
    const from = ERA[trip.from] ?? ERA.past
    const to = ERA[trip.to] ?? ERA.present
    // Sens du temps : vers le présent, les années avancent.
    const forward = (to.year ?? 0) >= (from.year ?? 0)
    trip.years = forward ? YEARS : [...YEARS].reverse()
    trip.forward = forward
    c.dist = 0
    for (const s of c.yearSprites.values()) s.visible = false
    trip.fromCol = new THREE.Color(from.accent)
    trip.toCol = new THREE.Color(to.accent)
    trip.fromBg = new THREE.Color(from.bg)
    trip.toBg = new THREE.Color(to.bg)
    c.portal.material.color.copy(trip.toCol)
  }

  function updateCar(c, dt, t, p) {
    const { scene, camera, pick } = c
    // Vitesse : départ en douceur, croisière, accélération finale (le saut).
    const speed = 22 + 48 * smooth(0, 0.18, p) + 110 * smooth(0.82, 1, p)
    const move = speed * dt
    c.dist += move
    c.roadTex.offset.y = (c.roadTex.offset.y + move / 13) % 1
    // L'ambiance glisse d'une époque à l'autre.
    const era = smooth(0.3, 0.8, p)
    col.copy(trip.fromBg).lerp(trip.toBg, era)
    scene.background.copy(col)
    scene.fog.color.copy(col)
    col2.copy(trip.fromCol).lerp(trip.toCol, era)
    c.edge.material.color.copy(col2)
    c.portal.material.opacity = 0.55 + 0.25 * Math.sin(t * 3) + 0.4 * smooth(0.75, 1, p)
    c.portal.scale.setScalar(150 + 120 * smooth(0.8, 1, p))

    // Anneaux.
    for (let i = 0; i < c.ringZ.length; i++) {
      let z = c.ringZ[i] + move
      if (z > 14) z -= c.ringZ.length * c.SPACING
      c.ringZ[i] = z
      const twist = t * (i % 2 ? 0.5 : -0.4) + i * 0.3
      m4.makeRotationZ(twist).setPosition(Math.sin(z * 0.02 + t) * 0.6, 2.5, z)
      const pulse = 1 + 0.06 * Math.sin(t * 6 + i)
      m4.scale(tmp.set(pulse, pulse, 1))
      c.rings.setMatrixAt(i, m4)
      if (i % 3 === 0) col.setHex(0xffd27a)
      else col.copy(trip.fromCol).lerp(trip.toCol, clamp01(era + (z / -260) * 0.5))
      c.rings.setColorAt(i, col)
    }
    c.rings.instanceMatrix.needsUpdate = true
    c.rings.instanceColor.needsUpdate = true

    // Spirale.
    const { swirl, swPos } = c
    for (let i = 0; i < swirl.z.length; i++) {
      let z = swirl.z[i] + move * 1.15
      if (z > 15) z -= 260
      swirl.z[i] = z
      const a = swirl.a[i] + z * 0.045 + t * 1.2
      swPos[i * 3] = Math.cos(a) * swirl.r[i]
      swPos[i * 3 + 1] = 2.5 + Math.sin(a) * swirl.r[i]
      swPos[i * 3 + 2] = z
    }
    c.swGeo.attributes.position.needsUpdate = true

    // Lignes de vitesse : plus longues quand ça accélère.
    const stretch = 0.6 + speed / 60
    c.lineData.forEach((l, i) => {
      l.z += move * 1.6
      if (l.z > 12) l.z -= 210
      m4.makeScale(1, 1, l.len * stretch).setPosition(l.x, l.y, l.z)
      c.lines.setMatrixAt(i, m4)
    })
    c.lines.instanceMatrix.needsUpdate = true
    c.lines.material.opacity = 0.25 + 0.6 * smooth(0.05, 0.3, p)

    // Horloges, engrenages, sabliers.
    const q = _q
    for (const f of c.floaters) {
      f.z += move * 0.75
      if (f.z > 12) f.z -= 230
      const x = Math.cos(f.a) * f.r
      const y = 2.5 + Math.sin(f.a) * f.r * 0.8 + Math.sin(t * 1.4 + f.phase) * 0.3
      const e = new THREE.Euler(Math.sin(t + f.phase) * 0.5, t * f.spin * 0.6 + f.phase, f.kind === 'gear' ? t * f.spin : Math.sin(t * 0.8 + f.phase) * 0.4)
      q.setFromEuler(e)
      m4.compose(tmp.set(x, y, f.z), q, tmp2.setScalar(f.s))
      f.mesh.setMatrixAt(f.i, m4)
      if (f.kind === 'clock') {
        // Les aiguilles tournent à toute vitesse (dans le bon sens selon le voyage).
        const dir = trip.forward ? -1 : 1
        for (let k = 0; k < 2; k++) {
          const hand = new THREE.Matrix4().makeRotationZ(dir * t * (k ? 9 : 1.6) + f.phase)
          if (!k) hand.scale(tmp2.set(1, 0.7, 1))
          c.hands.setMatrixAt(f.i * 2 + k, m4.clone().multiply(hand))
        }
      }
      f.mesh.instanceMatrix.needsUpdate = true
    }
    c.hands.instanceMatrix.needsUpdate = true

    // Îlots : tours d'un côté du temps, maisons de l'autre.
    const toPresent = trip.forward ? p : 1 - p
    for (let i = 0; i < c.slots.length; i++) {
      const s = c.slots[i]
      s.z += move * 0.55
      if (s.z > 20) s.z -= 240
      const morph = smooth(s.thr - 0.07, s.thr + 0.07, toPresent)
      const bob = Math.sin(t * 0.8 + i) * 0.4
      q.setFromAxisAngle(_up, s.rot + t * 0.05)
      m4.compose(tmp.set(s.x, s.y + bob, s.z), q, tmp2.setScalar(s.s))
      c.islandTop.setMatrixAt(i, m4)
      c.islandRock.setMatrixAt(i, m4)
      col.setHex(0x9b86d9).lerp(col2.setHex(0x6fd38a), morph)
      c.islandTop.setColorAt(i, col)
      const pop = (k) => (k <= 0.001 ? 0.0001 : k * (1 + Math.sin(k * Math.PI) * 0.25))
      const kt = pop(1 - morph)
      const kh = pop(morph)
      m4.compose(tmp.set(s.x, s.y + bob, s.z), q, tmp2.set(s.s, s.s * kt, s.s))
      c.towers.setMatrixAt(i, m4)
      c.towerW.setMatrixAt(i, m4)
      m4.compose(tmp.set(s.x, s.y + bob, s.z), q, tmp2.set(s.s, s.s * kh, s.s))
      c.houses.setMatrixAt(i, m4)
      c.houseW.setMatrixAt(i, m4)
    }
    for (const m of [c.islandTop, c.islandRock, c.towers, c.towerW, c.houses, c.houseW]) m.instanceMatrix.needsUpdate = true
    c.islandTop.instanceColor.needsUpdate = true

    // Années qui passent à côté de la route.
    const n = trip.years.length
    trip.years.forEach((y, i) => {
      const s = c.yearSprites.get(y)
      const at = (0.12 + (i / (n - 1)) * 0.72) * trip.duration
      const z = (trip.elapsed - at) * 55 - 2
      s.visible = z > -170 && z < 14
      if (!s.visible) return
      s.position.set(i % 2 ? 5.2 : -5.2, 4.6 + Math.sin(t * 2 + i) * 0.2, z)
    })
    // Compteur d'années du HUD.
    const k = clamp01((p - 0.12) / 0.72) * (n - 1)
    const i0 = Math.floor(k)
    const y0 = trip.years[Math.min(i0, n - 1)]
    const y1 = trip.years[Math.min(i0 + 1, n - 1)]
    trip.label = String(Math.round(lerp(y0, y1, k - i0)))

    // La voiture.
    const sway = Math.sin(t * 0.9) * 0.7 * smooth(0.1, 0.3, p)
    pick.car.position.set(sway, 0.05 + Math.sin(t * 13) * 0.03, 0)
    pick.car.rotation.set(Math.sin(t * 9) * 0.01, -Math.cos(t * 0.9) * 0.08 * smooth(0.1, 0.3, p), -Math.cos(t * 0.9) * 0.05)
    const spin = c.dist / 0.46
    pick.wheels.userData.spots.forEach(([x, z], i) => {
      m4.makeRotationX(-spin).setPosition(x, 0.46, z)
      pick.wheels.setMatrixAt(i, m4)
    })
    pick.wheels.instanceMatrix.needsUpdate = true
    const fire = smooth(0.08, 0.25, p)
    pick.trails.children.forEach((tr, i) => {
      tr.scale.set(1, 1, Math.max(0.01, fire * (0.85 + Math.sin(t * 30 + i * 2) * 0.15 + smooth(0.8, 1, p) * 0.8)))
      tr.material.opacity = fire
    })

    // Caméra : vue de côté au départ, puis poursuite avec de légères secousses.
    const intro = smooth(0, 0.2, p)
    const shake = (0.03 + speed / 2000) * smooth(0.1, 0.3, p)
    // On tourne autour du pick-up : de trois quarts avant jusque derrière lui.
    const orbit = lerp(2.1, 0, intro)
    const rad = lerp(8.5, 8.4, intro)
    tmp.set(Math.sin(orbit) * rad + sway * 0.6, lerp(1.6, 3.1, intro), Math.cos(orbit) * rad)
    tmp.x += Math.sin(t * 37) * shake
    tmp.y += Math.sin(t * 41 + 1) * shake
    camera.position.copy(tmp)
    camera.lookAt(sway * 0.5, lerp(1.2, 1.9, intro), lerp(0, -6, intro))
    camera.rotateZ(Math.sin(t * 0.9) * 0.03 * intro)
    portraitBoost(camera, 58 + 14 * smooth(0.1, 0.35, p) + 26 * smooth(0.85, 1, p))
  }

  // ======================= Fusée : de la Terre à la Lune =======================
  function buildRocketScene() {
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x0b0820)
    const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 6000)
    const hemi = new THREE.HemisphereLight(0xd8ccff, 0x2c1f63, 0.9)
    const sun = new THREE.DirectionalLight(0xfff1dc, 2.4)
    sun.position.set(-0.6, 0.55, 0.7)
    scene.add(hemi, sun)
    const R = rng(11)

    // Étoiles lointaines (suivent la caméra).
    const pts = []
    const cols = []
    for (let i = 0; i < 1800; i++) {
      const u = R() * 2 - 1
      const a = R() * Math.PI * 2
      const s = Math.sqrt(1 - u * u)
      pts.push(Math.cos(a) * s * 3000, u * 3000, Math.sin(a) * s * 3000)
      const c = new THREE.Color().setHSL(0.6 + R() * 0.15, 0.5, 0.7 + R() * 0.3)
      cols.push(c.r, c.g, c.b)
    }
    const starGeo = new THREE.BufferGeometry()
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
    starGeo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3))
    const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ size: 1.8, sizeAttenuation: false, vertexColors: true }))
    scene.add(stars)

    // Ciel du crépuscule (sphère qui s'efface en montant).
    const skyGeo = new THREE.SphereGeometry(2500, 24, 12)
    const sp = skyGeo.attributes.position
    const skyCol = new Float32Array(sp.count * 3)
    const stops = [[-0.2, 0xff9a5a], [0.02, 0xffb36b], [0.12, 0xe0789c], [0.35, 0x6a3f9a], [0.7, 0x2c1f63], [1, 0x231a4a]].map(([y, h]) => [y, new THREE.Color(h)])
    for (let i = 0; i < sp.count; i++) {
      const y = sp.getY(i) / 2500
      let j = 0
      while (j < stops.length - 2 && y > stops[j + 1][0]) j++
      const [ya, ca] = stops[j]
      const [yb, cb] = stops[j + 1]
      col.copy(ca).lerp(cb, clamp01((y - ya) / (yb - ya)))
      skyCol.set([col.r, col.g, col.b], i * 3)
    }
    skyGeo.setAttribute('color', new THREE.BufferAttribute(skyCol, 3))
    const sky = new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, transparent: true, depthWrite: false }))
    sky.renderOrder = -1
    scene.add(sky)

    // La Terre : océans, continents, pôles, et une base de lancement verte au sommet.
    const earthPal = { sea: [0x2f7fe0, 0x2566c4], land: [0x6fd38a, 0x4fb36c, 0xd8c27a], ice: 0xf4f6ff }
    const earthGeo = planetGeometry(RE, 5, 4.2, 0.02, (v, h, c) => {
      if (v.y > 0.94) c.setHex(v.y > 0.995 ? 0x8bdc8f : h > 0 ? 0x6fd38a : 0x5cc27c)
      else if (Math.abs(v.y) > 0.88) c.setHex(earthPal.ice)
      else if (h > 0.12) c.setHex(earthPal.land[Math.min(2, Math.floor((h - 0.12) * 5))])
      else c.setHex(earthPal.sea[h > -0.2 ? 0 : 1])
    })
    const earth = new THREE.Group()
    earth.add(new THREE.Mesh(earthGeo, flat({ roughness: 0.9 })))
    const atmo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(120,180,255,0)', 'rgba(120,180,255,0.4)'), blending: THREE.AdditiveBlending, depthWrite: false }))
    atmo.scale.setScalar(RE * 3.1)
    earth.add(atmo)
    // Nuages autour de la base (on les traverse au décollage).
    const CLOUDS = 70
    const clouds = new THREE.InstancedMesh(merged([
      part(new THREE.IcosahedronGeometry(1, 1), 0xffffff),
      part(new THREE.IcosahedronGeometry(0.72, 1), 0xffffff, 1, -0.15, 0.2),
      part(new THREE.IcosahedronGeometry(0.66, 1), 0xffffff, -0.95, -0.2, -0.1),
    ]), new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, color: 0xfff4f4, emissive: 0xa88cc0, emissiveIntensity: 0.55 }), CLOUDS)
    for (let i = 0; i < CLOUDS; i++) {
      const near = i < 22
      const a = R() * Math.PI * 2
      const spread = near ? R() * 0.1 : 0.08 + R() * 0.45
      tmp.set(Math.cos(a) * spread, 1, Math.sin(a) * spread).normalize()
      onSphere(m4, RE, tmp, 30 + R() * 16, 2.5 + R() * 2.5, R() * 6)
      m4.scale(tmp2.set(1.4, 0.6, 1))
      clouds.setMatrixAt(i, m4)
    }
    earth.add(clouds)
    const earthDeco = new THREE.Group()
    earth.add(earthDeco)
    // Pas de tir, tour de lancement, arbres et maisons.
    earthDeco.add(new THREE.Mesh(merged([
      part(new THREE.CylinderGeometry(4.2, 4.6, 0.5, 14), 0x8a8598, 0, RE + 0.25, 0),
      part(new THREE.CylinderGeometry(3.2, 3.2, 0.08, 14), 0xffb347, 0, RE + 0.52, 0),
      part(new THREE.CylinderGeometry(2.9, 2.9, 0.1, 14), 0x6a6580, 0, RE + 0.55, 0),
      ...[[-0.45, -0.45], [0.45, -0.45], [-0.45, 0.45], [0.45, 0.45]].map(([x, z]) => part(new THREE.BoxGeometry(0.22, 12, 0.22), 0xd6402f, -3.3 + x, RE + 6.3, z)),
      ...[2, 4.5, 7, 9.5, 11.8].map((y) => part(new THREE.BoxGeometry(1.1, 0.16, 1.1), 0xd6402f, -3.3, RE + y, 0)),
      part(new THREE.BoxGeometry(2.2, 0.2, 0.3), 0x8a8598, -2.2, RE + 7.2, 0),
      part(new THREE.BoxGeometry(1.6, 0.6, 1.6), 0xc9c4d8, -3.3, RE + 12.5, 0),
    ]), flat()))
    const treeGeo = merged([
      part(new THREE.CylinderGeometry(0.2, 0.28, 1, 6), 0x5a3a2a, 0, 0.5, 0),
      part(new THREE.ConeGeometry(1.3, 1.8, 7), 0x3a8068, 0, 1.6, 0),
      part(new THREE.ConeGeometry(0.95, 1.5, 7), 0x4a9a78, 0, 2.6, 0),
    ])
    const trees = new THREE.InstancedMesh(treeGeo, flat(), 26)
    for (let i = 0; i < 26; i++) {
      const a = R() * Math.PI * 2
      const d = 0.12 + R() * 0.2
      onSphere(m4, RE, tmp.set(Math.cos(a) * d, 1, Math.sin(a) * d).normalize(), -0.1, 0.8 + R() * 0.8, R() * 6)
      trees.setMatrixAt(i, m4)
    }
    const homes = new THREE.InstancedMesh(merged([
      part(new THREE.BoxGeometry(2, 1.5, 1.7), 0xf3e2c7, 0, 0.75, 0),
      part(new THREE.CylinderGeometry(0.01, 1.45, 1, 4, 1), 0xd9643a, 0, 2, 0, 0, Math.PI / 4),
      part(new THREE.BoxGeometry(0.4, 0.4, 0.08), 0xffd27a, 0.4, 0.9, 0.86),
      part(new THREE.BoxGeometry(0.4, 0.4, 0.08), 0xffd27a, -0.4, 0.9, 0.86),
    ]), flat({ emissive: 0x2a1530, emissiveIntensity: 0.3 }), 7)
    for (let i = 0; i < 7; i++) {
      const a = 1.2 + i * 0.6 + R() * 0.3
      const d = 0.16 + R() * 0.1
      onSphere(m4, RE, tmp.set(Math.cos(a) * d, 1, Math.sin(a) * d).normalize(), -0.1, 1, -a + Math.PI / 2)
      homes.setMatrixAt(i, m4)
    }
    earthDeco.add(trees, homes)
    scene.add(earth)

    // La Lune : grise, cratères, base du Futur avec ses néons au sommet.
    const craters = Array.from({ length: 22 }, () => [new THREE.Vector3(R() - 0.5, R() - 0.5, R() - 0.5).normalize(), 0.08 + R() * 0.18])
    const moonGeo = planetGeometry(RM, 3, 2.3, 0.05, (v, h, c) => {
      c.setHex([0xc8c4d4, 0xb0abc2, 0x9a93ae][Math.max(0, Math.min(2, Math.floor((0.5 + h) * 3)))])
      if (v.y < 0.97) for (const [cv, r] of craters) if (v.distanceTo(cv) < r) c.setHex(0x7d7694)
    })
    const moon = new THREE.Group()
    moon.add(new THREE.Mesh(moonGeo, flat({ roughness: 1, emissive: 0x2c1f63, emissiveIntensity: 0.35 })))
    const moonGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(143,227,255,0)', 'rgba(143,227,255,0.22)'), blending: THREE.AdditiveBlending, depthWrite: false }))
    moonGlow.scale.setScalar(RM * 3.1)
    moon.add(moonGlow)
    const moonDeco = new THREE.Group()
    moon.add(moonDeco)
    moonDeco.add(new THREE.Mesh(merged([
      part(new THREE.CylinderGeometry(4, 4.3, 0.5, 8), 0x5a5670, 0, RM + 0.2, 0),
      part(new THREE.SphereGeometry(3.2, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2), 0xe6e2f2, 9, RM - 0.4, -3),
      part(new THREE.SphereGeometry(2.2, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2), 0xe6e2f2, -8, RM - 0.4, -6),
      part(new THREE.CylinderGeometry(0.8, 0.8, 5, 6), 0xc9c4d8, 3.6, RM + 0.4, -4.6, 0, 0.8, Math.PI / 2),
      part(new THREE.BoxGeometry(0.15, 6, 0.15), 0x9a93ae, -5, RM + 3, 3),
      part(new THREE.ConeGeometry(1.2, 0.6, 8, 1, true), 0xc9c4d8, -5, RM + 6, 3, Math.PI),
      part(new THREE.BoxGeometry(3, 0.1, 1.6), 0x3a52c8, 7, RM + 1.6, 5, 0.5),
    ]), flat({ roughness: 0.6 })))
    // Néons de la base.
    moonDeco.add(new THREE.Mesh(merged([
      part(new THREE.TorusGeometry(3.6, 0.1, 4, 24), 0x8fe3ff, 0, RM + 0.5, 0, Math.PI / 2),
      part(new THREE.TorusGeometry(3.25, 0.1, 4, 20), 0xff6f9f, 9, RM + 0.1, -3, Math.PI / 2),
      part(new THREE.TorusGeometry(2.25, 0.1, 4, 20), 0x6fd38a, -8, RM + 0.1, -6, Math.PI / 2),
      part(new THREE.SphereGeometry(0.3, 6, 4), 0xff6f9f, -5, RM + 6.3, 3),
    ]), new THREE.MeshBasicMaterial({ vertexColors: true })))
    scene.add(moon)

    // Fumée (instanciée) : chaque bouffée vit dans le repère du sol.
    const PUFFS = 90
    const puffs = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshStandardMaterial({ color: 0xf6f0fa, flatShading: true, roughness: 1, emissive: 0x5a4a7a, emissiveIntensity: 0.45 }), PUFFS)
    puffs.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(PUFFS * 3).fill(1), 3)
    const puffData = Array.from({ length: PUFFS }, () => ({ life: 0, max: 1, g: new THREE.Vector3(), v: new THREE.Vector3(), s: 1, spin: 0 }))
    scene.add(puffs)

    // Étoiles filantes (traînées de vitesse dans l'espace).
    const STREAKS = 90
    const streaks = new THREE.InstancedMesh(new THREE.BoxGeometry(0.06, 1, 0.06), glowMat(0xe6f4ff, 0), STREAKS)
    const streakData = Array.from({ length: STREAKS }, () => ({ o: new THREE.Vector3((R() - 0.5) * 90, (R() - 0.5) * 160, -R() * 70 + 10), len: 4 + R() * 10 }))
    scene.add(streaks)

    // Nuages de rentrée (retour sur Terre), autour de la fusée.
    const reentry = new THREE.InstancedMesh(clouds.geometry, clouds.material, 30)
    const reentryData = Array.from({ length: 30 }, (_, i) => ({ o: new THREE.Vector3((i % 2 ? 1 : -1) * (5 + R() * 22), R() * 200, -6 - R() * 30), s: 2 + R() * 3, r: R() * 6 }))
    scene.add(reentry)

    const rk = buildRocket()
    scene.add(rk.rocket)

    return { scene, camera, sky, stars, earth, earthDeco, clouds, moon, moonDeco, atmo, puffs, puffData, puffNext: 0, streaks, streakData, reentry, reentryData, rk, sun }
  }

  function startRocket(r) {
    const up = trip.to === 'future' || (trip.from === 'present' && trip.to !== 'past')
    trip.up = up
    const portrait = innerHeight > innerWidth
    // Direction finale du vol : plus verticale sur un téléphone en portrait.
    trip.u = new THREE.Vector3(portrait ? 0.5 : 1, portrait ? 1 : 0.5, 0).normalize()
    trip.trav = new THREE.Vector3()
    trip.s = 0
    trip.dir = new THREE.Vector3(0, 1, 0)
    trip.A = up ? r.earth : r.moon
    trip.B = up ? r.moon : r.earth
    trip.RA = up ? RE : RM
    trip.RB = up ? RM : RE
    trip.A.quaternion.identity()
    // La base d'arrivée est tournée vers nous, un peu sur le bord de l'astre.
    trip.B.quaternion.setFromUnitVectors(_up, tmp.copy(trip.u).negate().add(new THREE.Vector3(0, 0.9, 0.6)).normalize())
    r.puffData.forEach((d) => (d.life = 0))
    r.clouds.visible = true
    r.reentry.visible = false
    r.rk.plasma.material.opacity = 0
    trip.blipSpace = false
  }

  // Distance parcourue (dans le repère de la scène) selon l'avancement.
  const travelS = (p) => {
    const q = clamp01((p - 0.08) / 0.92)
    return 640 * Math.pow(q, 2.1)
  }

  function spawnPuff(r, g, v, s, life, tint) {
    const d = r.puffData[r.puffNext]
    r.puffNext = (r.puffNext + 1) % r.puffData.length
    d.g.copy(g)
    d.v.copy(v)
    d.s = s
    d.life = d.max = life
    d.spin = Math.random() * 6
    r.puffs.setColorAt(r.puffData.indexOf(d), col.setHex(tint))
  }

  function updateRocket(r, dt, t, p) {
    const { camera, rk } = r
    // Trajectoire : verticale puis inclinée vers la destination.
    const pitch = smooth(0.18, 0.5, p)
    trip.dir.set(0, 1, 0).lerp(trip.u, pitch).normalize()
    const s1 = travelS(p)
    const ds = s1 - trip.s
    trip.s = s1
    trip.trav.addScaledVector(trip.dir, ds)
    const fromEarth = trip.up
    const ignite = smooth(0.03, 0.08, p)
    const space = smooth(0.24, 0.42, p)

    // Planète de départ : posée sous la fusée, elle s'éloigne (et un peu plus vite une fois dans l'espace).
    const recede = tmp.copy(trip.dir).multiplyScalar(-space * 260 * smooth(0.4, 1, p))
    trip.A.position.set(0, -trip.RA - 4.5, 0).sub(trip.trav).add(recede)
    trip.A.rotation.y = t * 0.01
    // Planète d'arrivée : toujours droit devant, elle grossit régulièrement.
    const near = trip.RB + (trip.up ? 9 : 26)
    const a0 = trip.RB / 900
    const ang = a0 * Math.pow(trip.RB / near / a0, Math.pow(smooth(0.1, 1, p), 2))
    trip.B.position.copy(trip.u).multiplyScalar(trip.RB / ang)
    trip.B.position.y -= trip.RB * 0.15 * (1 - p)
    // Au sol, la destination est visible dans le ciel, au-dessus de la base.
    trip.B.position.lerp(tmp.set(-516, 284, -636), 1 - smooth(0.06, 0.32, p))
    r.earthDeco.visible = trip.A === r.earth
    r.moonDeco.visible = true
    r.clouds.visible = trip.A === r.earth || p > 0.6
    // Vus de l'espace, les nuages se recollent à la Terre.
    r.clouds.scale.setScalar(trip.A === r.earth ? lerp(1, 0.68, space) : 0.68)

    // La fusée.
    rk.rocket.quaternion.setFromUnitVectors(_up, trip.dir)
    rk.rocket.position.set(Math.sin(t * 31) * 0.03 * ignite * (1 - space), 0, 0)
    rk.flame.visible = ignite > 0
    const fl = 0.75 + Math.sin(t * 47) * 0.15 + Math.sin(t * 23) * 0.1
    rk.flame.scale.set(ignite * (0.9 + fl * 0.15), ignite * (fl + 0.6 * smooth(0.08, 0.3, p)), ignite * (0.9 + fl * 0.15))
    rk.halo.material.opacity = ignite
    // Retour sur Terre : le nez chauffe en entrant dans l'atmosphère.
    rk.plasma.material.opacity = trip.up ? 0 : 0.55 * smooth(0.8, 0.92, p) * (0.8 + Math.sin(t * 40) * 0.2)

    // Fumée : grosse au décollage, traînée dans l'atmosphère (sur la Lune, juste de la poussière).
    const nozzle = tmp2.copy(trip.dir).multiplyScalar(-4.5)
    const groundG = new THREE.Vector3(0, -3.6, 0)
    if (p < 0.12 && Math.random() < dt * 60 * (0.3 + ignite)) {
      const a = Math.random() * Math.PI * 2
      const sp = 3 + Math.random() * 6 * (0.4 + ignite)
      spawnPuff(r, groundG, new THREE.Vector3(Math.cos(a) * sp, 0.4 + Math.random() * 1.5, Math.sin(a) * sp), fromEarth ? 0.8 + Math.random() * 0.7 : 0.6 + Math.random() * 0.5, 1.6 + Math.random(), fromEarth ? 0xffffff : 0xb0abc2)
    }
    if (fromEarth && ignite > 0.5 && space < 0.8 && Math.random() < dt * 40) {
      const g = nozzle.clone().add(trip.trav)
      spawnPuff(r, g, new THREE.Vector3((Math.random() - 0.5) * 2, -2, (Math.random() - 0.5) * 2), 0.6 + Math.random() * 0.5, 1.4, 0xfff2e6)
    }
    r.puffData.forEach((d, i) => {
      if (d.life > 0) {
        d.life -= dt
        d.g.addScaledVector(d.v, dt)
        d.v.multiplyScalar(1 - dt * 0.8)
        const k = 1 - d.life / d.max
        const sc = d.life > 0 ? d.s * (0.6 + k * 2.2) * Math.min(1, d.life * 2) : 0.0001
        _q.setFromAxisAngle(_up, d.spin + k)
        m4.compose(tmp.copy(d.g).sub(trip.trav), _q, tmp2.setScalar(sc))
      } else m4.makeScale(0, 0, 0)
      r.puffs.setMatrixAt(i, m4)
    })
    r.puffs.instanceMatrix.needsUpdate = true
    if (r.puffs.instanceColor) r.puffs.instanceColor.needsUpdate = true

    // Ciel : crépuscule au sol, puis noir de l'espace ; au retour, le ciel revient à la fin.
    const skyA = trip.up ? 1 - smooth(0.2, 0.4, p) : 0.55 * smooth(0.86, 0.98, p)
    r.sky.material.opacity = skyA
    r.sky.visible = skyA > 0.01
    r.sky.position.copy(camera.position)
    r.stars.position.copy(camera.position)
    r.atmo.material.opacity = 1

    // Étoiles filantes.
    const streakK = smooth(0.32, 0.5, p) * (1 - smooth(0.9, 1, p) * (trip.up ? 0.3 : 1))
    r.streaks.material.opacity = 0.75 * streakK
    r.streaks.visible = streakK > 0.01
    const vel = 80 + 220 * smooth(0.4, 0.9, p)
    _q.setFromUnitVectors(_up, trip.dir)
    for (let i = 0; i < r.streakData.length; i++) {
      const d = r.streakData[i]
      d.o.y -= vel * dt
      if (d.o.y < -80) d.o.y += 160
      tmp.copy(d.o).applyQuaternion(_q)
      m4.compose(tmp, _q, tmp2.set(1, d.len * (0.5 + vel / 150), 1))
      r.streaks.setMatrixAt(i, m4)
    }
    r.streaks.instanceMatrix.needsUpdate = true

    // Retour sur Terre : on traverse une couche de nuages juste avant l'arrivée.
    r.reentry.visible = !trip.up && p > 0.82
    if (r.reentry.visible) {
      const k = smooth(0.82, 1, p)
      for (let i = 0; i < r.reentryData.length; i++) {
        const d = r.reentryData[i]
        tmp.set(d.o.x, d.o.y - k * 230 + 20, d.o.z).applyQuaternion(_q)
        m4.makeRotationY(d.r).scale(tmp2.set(d.s * 1.4, d.s * 0.7, d.s)).setPosition(tmp)
        r.reentry.setMatrixAt(i, m4)
      }
      r.reentry.instanceMatrix.needsUpdate = true
    }

    // Caméra : au sol pendant le décollage, puis dans les nuages, puis elle se retourne vers la
    // planète qu'on quitte, et enfin elle passe derrière la fusée pour regarder la destination.
    const u = trip.u
    const zx = new THREE.Vector3(0, 0, 1)
    const k1 = smooth(0.1, 0.3, p)
    const k2 = smooth(0.42, 0.56, p)
    const k3 = smooth(0.64, 0.8, p)
    const camPos = new THREE.Vector3(14, -1.5, 30).sub(trip.trav)
    const camLook = new THREE.Vector3(0, 2, 0)
    camPos.lerp(tmp.copy(trip.dir).multiplyScalar(-9).addScaledVector(zx, 17).add(new THREE.Vector3(4, 0, 0)), k1)
    camLook.lerp(tmp.copy(trip.dir).multiplyScalar(7), k1)
    camPos.lerp(tmp.copy(u).multiplyScalar(15).addScaledVector(zx, 11).add(new THREE.Vector3(0, 3, 0)), k2)
    camLook.lerp(tmp.copy(u).multiplyScalar(-14).add(new THREE.Vector3(0, -7, 0)), k2)
    camPos.lerp(tmp.copy(u).multiplyScalar(-13).addScaledVector(zx, 13).add(new THREE.Vector3(0, 1, 0)), k3)
    camLook.lerp(tmp.copy(u).multiplyScalar(22), k3)
    if (innerHeight > innerWidth) camPos.sub(camLook).multiplyScalar(1 + 0.25 * k1).add(camLook)
    camera.position.copy(camPos)
    const shake = 0.12 * ignite * (1 - space) + 0.04 * smooth(0.85, 1, p)
    camera.position.x += Math.sin(t * 43) * shake
    camera.position.y += Math.sin(t * 37 + 2) * shake
    camera.lookAt(camLook)
    portraitBoost(camera, 52 + 8 * smooth(0.4, 0.8, p) + 18 * smooth(0.9, 1, p))

    // HUD : altitude, puis distance restante.
    if (p < 0.4) trip.label = `Altitude ${Math.round(Math.pow(clamp01(trip.s / 70), 1.3) * 100)} km`
    else trip.label = `${trip.up ? 'Lune' : 'Terre'} · ${Math.round(KM * (1 - smooth(0.4, 1, p))).toLocaleString('fr-CH')} km`
    if (!trip.blipSpace && p > 0.4) {
      trip.blipSpace = true
      sfx?.blip?.('whoosh')
    }
  }

  // ======================= HUD =======================
  function buildUI() {
    ui = document.createElement('div')
    ui.className = 'travel'
    ui.innerHTML = `
      <div class="travel-bars"><i></i><i></i></div>
      <div class="travel-top">
        <span class="travel-kicker"></span>
        <strong class="travel-title"></strong>
        <div class="travel-progress"><span class="travel-from"></span><div class="travel-bar"><i></i></div><span class="travel-to"></span></div>
        <b class="travel-meta"></b>
      </div>
      <button class="btn travel-skip" type="button">Passer ⏭</button>
      <div class="travel-flash"></div>`
    document.body.append(ui)
    ui.querySelector('.travel-skip').addEventListener('click', () => api.skip())
  }

  function fillUI() {
    const to = ERA[trip.to] ?? ERA.present
    const from = ERA[trip.from] ?? ERA.past
    const kick = trip.kind === 'car' ? 'En voiture · saut dans le temps' : trip.to === 'future' ? 'En fusée · cap sur la Lune' : 'En fusée · retour sur Terre'
    ui.querySelector('.travel-kicker').textContent = kick
    ui.querySelector('.travel-title').innerHTML = `Voyage vers le <em>${to.name}</em>`
    ui.querySelector('.travel-from').textContent = from.name
    ui.querySelector('.travel-to').textContent = to.name
    ui.style.setProperty('--travel-from', '#' + new THREE.Color(from.accent).getHexString(THREE.SRGBColorSpace))
    ui.style.setProperty('--travel-to', '#' + new THREE.Color(to.accent).getHexString(THREE.SRGBColorSpace))
    ui.classList.toggle('car', trip.kind === 'car')
    ui.classList.toggle('rocket', trip.kind !== 'car')
  }

  function finish() {
    active = false
    ui.classList.remove('visible')
    document.body.classList.remove('travel-open')
  }

  const api = {
    get active() {
      return active
    },
    start({ kind = 'car', from = 'past', to = 'present', duration = 6 } = {}) {
      if (!ui) buildUI()
      trip = { kind, from, to, duration: Math.max(3, Math.min(12, duration || 6)), elapsed: 0, label: '', blipEra: false, blipPeak: false }
      if (kind === 'car') {
        car ??= buildCarScene()
        cur = car
        startCar(car)
      } else {
        rocket ??= buildRocketScene()
        cur = rocket
        startRocket(rocket)
      }
      active = true
      fillUI()
      ui.querySelector('.travel-flash').style.opacity = 1
      document.body.classList.add('travel-open')
      ui.classList.remove('visible')
      void ui.offsetWidth
      ui.classList.add('visible')
      sfx?.blip?.('whoosh')
      api.update(0, 0)
    },
    skip() {
      if (!active || !trip) return
      // On file directement vers le flash de fin.
      if (trip.skipAt == null) trip.skipAt = trip.elapsed
    },
    resize() {
      if (!cur) return
      portraitBoost(cur.camera, cur.camera.fov)
    },
    update(dt, t) {
      if (!active) return false
      dt = Math.min(dt, 0.05)
      trip.elapsed += dt
      const p = clamp01(trip.elapsed / trip.duration)
      if (trip.kind === 'car') updateCar(car, dt, t, p)
      else updateRocket(rocket, dt, t, p)
      if (!trip.blipPeak && p > 0.5 && trip.kind === 'car') {
        trip.blipPeak = true
        sfx?.blip?.('whoosh')
      }
      if (!trip.blipEra && p > 0.86) {
        trip.blipEra = true
        sfx?.blip?.('era')
      }
      // Flash d'entrée et de sortie.
      const fin = Math.min(0.6, trip.duration * 0.12)
      const end = trip.skipAt == null ? trip.duration : Math.min(trip.duration, trip.skipAt + 0.35)
      const flash = Math.max(1 - smooth(0, 0.45, trip.elapsed), smooth(end - Math.min(fin, end - (trip.skipAt ?? 0)), end, trip.elapsed))
      ui.querySelector('.travel-flash').style.opacity = flash.toFixed(3)
      ui.querySelector('.travel-bar i').style.transform = `scaleX(${p.toFixed(4)})`
      ui.querySelector('.travel-meta').textContent = trip.label
      if (trip.elapsed >= end) {
        finish()
        return false
      }
      return true
    },
    render() {
      if (cur) renderer.render(cur.scene, cur.camera)
    },
  }
  window.addEventListener('keydown', (e) => {
    if (active && e.code === 'Escape') {
      e.stopImmediatePropagation()
      api.skip()
    }
  }, true)
  return api
}
