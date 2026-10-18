import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

// Le télescope de l'île du Futur : on regarde dedans et on se retrouve face au système
// solaire. Glisser pour tourner, molette ou pincer pour zoomer, toucher une planète pour
// la suivre et lire sa fiche. Les distances et les tailles ne sont pas à l'échelle
// (sinon on ne verrait rien), mais l'ordre, les couleurs et les chiffres sont vrais.

const SEEN_KEY = 'aventure-time-aq:planets'

export const BODIES = [
  { id: 'sun', name: 'Le Soleil', kind: 'Étoile', r: 4, orbit: 0, color: '#ffcc55', facts: [['Diamètre', '1,39 million de km'], ['Masse', '99,8 % du système solaire'], ['Surface', 'environ 5 500 °C']], text: 'Une étoile naine jaune, vieille d\'environ 4,6 milliards d\'années. Sa lumière met un peu plus de 8 minutes pour arriver jusqu\'à nous.' },
  { id: 'mercury', name: 'Mercure', kind: 'Planète rocheuse', r: 0.45, orbit: 7, period: 0.24, color: '#a8a29a', facts: [['Diamètre', '4 879 km'], ['Distance au Soleil', '58 millions de km'], ['Une année', '88 jours'], ['Lunes', 'aucune']], text: 'La plus petite planète et la plus proche du Soleil. Sans atmosphère pour garder la chaleur, elle passe de 430 °C le jour à -180 °C la nuit.' },
  { id: 'venus', name: 'Vénus', kind: 'Planète rocheuse', r: 0.85, orbit: 10, period: 0.62, color: '#e8c98a', facts: [['Diamètre', '12 104 km'], ['Distance au Soleil', '108 millions de km'], ['Une année', '225 jours'], ['Lunes', 'aucune']], text: 'La planète la plus chaude (environ 465 °C), sous d\'épais nuages d\'acide sulfurique. Elle tourne à l\'envers, et si lentement que son jour dure plus que son année.' },
  { id: 'earth', name: 'La Terre', kind: 'Planète rocheuse', r: 0.9, orbit: 13.5, period: 1, color: '#3f8fd8', facts: [['Diamètre', '12 742 km'], ['Distance au Soleil', '150 millions de km'], ['Une année', '365,25 jours'], ['Lunes', '1']], text: 'Chez nous : la seule planète connue où l\'eau liquide coule en surface et où la vie existe. Vue d\'ici, la Suisse tient sur un pixel.' },
  { id: 'mars', name: 'Mars', kind: 'Planète rocheuse', r: 0.6, orbit: 17, period: 1.88, color: '#d9643a', facts: [['Diamètre', '6 779 km'], ['Distance au Soleil', '228 millions de km'], ['Une année', '687 jours'], ['Lunes', '2 (Phobos et Déimos)']], text: 'La planète rouge doit sa couleur à l\'oxyde de fer. Elle abrite Olympus Mons, le plus grand volcan connu, environ 22 km de haut.' },
  { id: 'jupiter', name: 'Jupiter', kind: 'Géante gazeuse', r: 2.3, orbit: 24, period: 11.9, color: '#d8b48a', facts: [['Diamètre', '139 820 km'], ['Distance au Soleil', '778 millions de km'], ['Une année', '11,9 ans'], ['Lunes', 'plus de 90']], text: 'La plus grosse planète : plus de 1 300 Terre tiendraient dedans. Sa Grande Tache rouge est une tempête plus large que la Terre.' },
  { id: 'saturn', name: 'Saturne', kind: 'Géante gazeuse', r: 1.9, orbit: 32, period: 29.5, color: '#e6cf98', rings: true, facts: [['Diamètre', '116 460 km'], ['Distance au Soleil', '1,4 milliard de km'], ['Une année', '29,5 ans'], ['Lunes', 'plus de 140']], text: 'Ses anneaux sont faits de milliards de morceaux de glace et de roche. Elle est si peu dense qu\'elle flotterait dans une baignoire géante.' },
  { id: 'uranus', name: 'Uranus', kind: 'Géante de glace', r: 1.35, orbit: 39, period: 84, color: '#8fd8e0', tilt: 1.7, facts: [['Diamètre', '50 724 km'], ['Distance au Soleil', '2,9 milliards de km'], ['Une année', '84 ans'], ['Lunes', 'près de 30']], text: 'Elle roule sur son orbite, couchée sur le côté (axe incliné de 98°). Chaque pôle vit environ 42 ans de jour, puis 42 ans de nuit.' },
  { id: 'neptune', name: 'Neptune', kind: 'Géante de glace', r: 1.3, orbit: 45, period: 165, color: '#3f63d8', facts: [['Diamètre', '49 244 km'], ['Distance au Soleil', '4,5 milliards de km'], ['Une année', '165 ans'], ['Lunes', '16']], text: 'La planète la plus lointaine, découverte par le calcul avant d\'être vue au télescope. Ses vents sont les plus rapides du système solaire, plus de 2 000 km/h.' },
  { id: 'moon', name: 'La Lune', kind: 'Satellite de la Terre', r: 0.26, orbit: 1.8, period: 0.075, parent: 'earth', color: '#c8c4bc', facts: [['Diamètre', '3 474 km'], ['Distance à la Terre', '384 400 km'], ['Un tour de la Terre', '27,3 jours'], ['Visites', '12 astronautes y ont marché']], text: 'Elle nous montre toujours la même face, car elle tourne sur elle-même aussi vite qu\'autour de la Terre. C\'est elle qui fait les marées.' },
]
const PLANETS = BODIES.filter((b) => b.orbit && !b.parent).map((b) => b.id)

// ---------- Textures dessinées ----------
// ---------- Planètes low-poly, dans le style des îles ----------
// Chaque facette reçoit une couleur unie (pas de texture lisse) et les planètes rocheuses
// sont un peu cabossées, comme les rochers et les arbres du jeu.
function noise3(seed) {
  const k = [1.3, 2.7, 5.1].map((f, i) => [f, seed * (i + 1.7), seed * (i + 3.1)])
  return (x, y, z) => k.reduce((s, [f, a, b], i) => s + (Math.sin(x * f * 3 + a) * Math.cos(y * f * 3.4 + b) + Math.sin(z * f * 2.6 + a + b)) / (2 * (i + 1)), 0)
}
const hex = (h) => new THREE.Color(h)
const PAL = {
  sun: [hex(0xffe08a), hex(0xffc24d), hex(0xff9a3c)],
  rock: [hex(0xb7b0c8), hex(0x9a93ae), hex(0x7d7694)],
  venus: [hex(0xffe0a3), hex(0xf2c27f), hex(0xe0a463)],
  earthSea: [hex(0x2f7fe0), hex(0x2566c4)],
  earthLand: [hex(0x6fd38a), hex(0x4fb36c), hex(0xd8c27a)],
  ice: hex(0xf4f6ff),
  mars: [hex(0xff7a4a), hex(0xe25c34), hex(0xb8452a)],
  jupiter: [hex(0xf4dcb4), hex(0xd9a774), hex(0xb97a52), hex(0xf0c890)],
  saturn: [hex(0xfbe7b5), hex(0xe9cc8e), hex(0xd2ae70)],
  uranus: [hex(0xa9f0f2), hex(0x8fdfe6)],
  neptune: [hex(0x5a7cff), hex(0x4462e6), hex(0x3a52c8)],
}

function planetGeometry(body) {
  const detail = body.r > 0.7 ? 4 : 3
  const geo = new THREE.IcosahedronGeometry(body.r, detail)
  const pos = geo.attributes.position
  const n = noise3(body.id.length * 1.9 + body.r)
  const rocky = ['mercury', 'moon', 'mars', 'venus', 'earth'].includes(body.id)
  const v = new THREE.Vector3()
  // Relief : on déplace chaque sommet selon sa direction (les sommets partagés restent soudés).
  if (rocky || body.id === 'sun') {
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).normalize()
      const h = n(v.x * 1.7, v.y * 1.7, v.z * 1.7)
      v.multiplyScalar(body.r * (1 + h * (body.id === 'sun' ? 0.02 : 0.05)))
      pos.setXYZ(i, v.x, v.y, v.z)
    }
  }
  const colors = new Float32Array(pos.count * 3)
  const c = new THREE.Color()
  const pick = (arr, t) => arr[Math.max(0, Math.min(arr.length - 1, Math.floor(t * arr.length)))]
  for (let f = 0; f < pos.count; f += 3) {
    v.set(0, 0, 0)
    for (let k = 0; k < 3; k++) v.x += pos.getX(f + k) / 3, v.y += pos.getY(f + k) / 3, v.z += pos.getZ(f + k) / 3
    v.normalize()
    const h = n(v.x * 2, v.y * 2, v.z * 2)
    const lat = v.y
    const r01 = (x) => Math.max(0, Math.min(0.999, x))
    switch (body.id) {
      case 'sun': c.copy(pick(PAL.sun, r01(0.5 + h * 0.8))); break
      case 'mercury':
      case 'moon': c.copy(pick(PAL.rock, r01(0.5 + h))); break
      case 'venus': c.copy(pick(PAL.venus, r01(0.5 + Math.sin(lat * 7 + h * 2) * 0.5))); break
      case 'earth': {
        if (Math.abs(lat) > 0.86) c.copy(PAL.ice)
        else if (h > 0.18) c.copy(pick(PAL.earthLand, r01((h - 0.18) * 1.6)))
        else c.copy(pick(PAL.earthSea, r01(0.5 - h)))
        break
      }
      case 'mars': c.copy(Math.abs(lat) > 0.9 ? PAL.ice : pick(PAL.mars, r01(0.5 + h))); break
      case 'jupiter': {
        c.copy(pick(PAL.jupiter, r01(0.5 + Math.sin(lat * 11 + h * 0.6) * 0.5)))
        // Grande Tache rouge.
        if (Math.abs(lat + 0.35) < 0.12 && Math.abs(Math.atan2(v.z, v.x) - 0.8) < 0.3) c.setHex(0xd8553a)
        break
      }
      case 'saturn': c.copy(pick(PAL.saturn, r01(0.5 + Math.sin(lat * 9 + h * 0.4) * 0.5))); break
      case 'uranus': c.copy(pick(PAL.uranus, r01(0.5 + h * 0.4))); break
      case 'neptune': {
        c.copy(pick(PAL.neptune, r01(0.5 + Math.sin(lat * 8 + h) * 0.5)))
        if (Math.abs(lat - 0.3) < 0.12 && Math.abs(Math.atan2(v.z, v.x) + 1) < 0.28) c.setHex(0x26368f)
        break
      }
      default: c.setHex(0xcccccc)
    }
    for (let k = 0; k < 3; k++) colors.set([c.r, c.g, c.b], (f + k) * 3)
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geo.computeVertexNormals()
  return geo
}

// Anneaux de Saturne : des bandes à plat, en facettes, avec la division de Cassini.
function ringGeometry(r0, r1) {
  const bands = [[0, 0.18, 0xd9c08f], [0.2, 0.46, 0xf1dcae], [0.48, 0.6, 0xe2c896], [0.66, 0.86, 0xcdb487], [0.88, 1, 0xb79f78]]
  const geos = []
  for (const [a, b, col] of bands) {
    const g = new THREE.RingGeometry(r0 + (r1 - r0) * a, r0 + (r1 - r0) * b, 48, 1).toNonIndexed()
    const cc = new THREE.Color(col)
    const arr = new Float32Array(g.attributes.position.count * 3)
    for (let i = 0; i < arr.length; i += 3) arr.set([cc.r, cc.g, cc.b], i)
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3))
    g.deleteAttribute('uv')
    geos.push(g)
  }
  const total = geos.reduce((s, g) => s + g.attributes.position.count, 0)
  const P = new Float32Array(total * 3)
  const C = new Float32Array(total * 3)
  const N = new Float32Array(total * 3)
  let o = 0
  for (const g of geos) {
    P.set(g.attributes.position.array, o * 3)
    C.set(g.attributes.color.array, o * 3)
    N.set(g.attributes.normal.array, o * 3)
    o += g.attributes.position.count
  }
  const out = new THREE.BufferGeometry()
  out.setAttribute('position', new THREE.BufferAttribute(P, 3))
  out.setAttribute('color', new THREE.BufferAttribute(C, 3))
  out.setAttribute('normal', new THREE.BufferAttribute(N, 3))
  return out
}

// Fond : nébuleuse violette comme le ciel du jeu.
function nebulaTexture() {
  const c = document.createElement('canvas')
  c.width = 1024
  c.height = 512
  const g = c.getContext('2d')
  const bg = g.createLinearGradient(0, 0, 0, 512)
  bg.addColorStop(0, '#0b0820')
  bg.addColorStop(0.5, '#231a4a')
  bg.addColorStop(1, '#0b0820')
  g.fillStyle = bg
  g.fillRect(0, 0, 1024, 512)
  for (const [x, y, r, col] of [[220, 250, 260, 'rgba(180,140,255,0.22)'], [640, 220, 300, 'rgba(111,211,255,0.12)'], [880, 300, 220, 'rgba(255,111,159,0.14)'], [420, 300, 200, 'rgba(255,179,71,0.08)']]) {
    const rg = g.createRadialGradient(x, y, 0, x, y, r)
    rg.addColorStop(0, col)
    rg.addColorStop(1, 'rgba(0,0,0,0)')
    g.fillStyle = rg
    g.fillRect(0, 0, 1024, 512)
  }
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.mapping = THREE.EquirectangularReflectionMapping
  return tex
}

function glowTexture(inner, outer) {
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const g = c.getContext('2d')
  const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128)
  grad.addColorStop(0, inner)
  grad.addColorStop(0.25, outer)
  grad.addColorStop(1, 'rgba(0,0,0,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 256, 256)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

// ---------- Vue ----------
export function createSolarSystem({ renderer, onPlanet, onExit }) {
  let scene = null
  let camera = null
  let controls = null
  let ui = null
  let built = false
  let active = false
  let selected = null
  let flight = 0
  let zoomTo = null
  let byRadius = []
  let overviewFlight = 0
  const screen = new THREE.Vector3()
  const bodies = new Map()
  const tmp = new THREE.Vector3()
  const lastTarget = new THREE.Vector3()
  let seen = []
  try {
    seen = JSON.parse(localStorage.getItem(SEEN_KEY)) || []
  } catch {
    seen = []
  }

  function build() {
    built = true
    scene = new THREE.Scene()
    scene.background = nebulaTexture()
    camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 2000)
    camera.position.set(0, 34, 62)
    scene.add(new THREE.AmbientLight(0x8890b0, 0.7))
    const sunLight = new THREE.PointLight(0xfff1dc, 3.2, 0, 0)
    scene.add(sunLight)

    // Ciel étoilé et bande de la Voie lactée.
    const starGeo = new THREE.BufferGeometry()
    const pts = []
    const cols = []
    for (let i = 0; i < 3000; i++) {
      const u = Math.random() * 2 - 1
      const a = Math.random() * Math.PI * 2
      const band = i < 1200
      const y = band ? (Math.random() - 0.5) * 0.25 : u
      const s = Math.sqrt(1 - y * y)
      const r = 600 + Math.random() * 200
      pts.push(Math.cos(a) * s * r, y * r + (band ? Math.cos(a) * 140 : 0), Math.sin(a) * s * r)
      const c = new THREE.Color().setHSL(0.6 + Math.random() * 0.1, 0.4, 0.75 + Math.random() * 0.25)
      cols.push(c.r, c.g, c.b)
    }
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
    starGeo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3))
    scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ size: 1.6, sizeAttenuation: false, vertexColors: true })))

    for (const body of BODIES) {
      const pivot = new THREE.Group()
      const material = body.id === 'sun' ? new THREE.MeshBasicMaterial({ vertexColors: true }) : new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.85, metalness: 0 })
      const sphere = new THREE.Mesh(planetGeometry(body), material)
      sphere.userData.body = body
      if (body.tilt) sphere.rotation.z = body.tilt
      pivot.add(sphere)
      if (body.id === 'sun') {
        const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(255,230,160,1)', 'rgba(255,170,60,0.45)'), blending: THREE.AdditiveBlending, depthWrite: false }))
        glow.scale.setScalar(body.r * 6)
        pivot.add(glow)
      }
      if (body.id === 'earth') {
        const atmo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(120,180,255,0.0)', 'rgba(120,180,255,0.35)'), blending: THREE.AdditiveBlending, depthWrite: false }))
        atmo.scale.setScalar(body.r * 3.2)
        pivot.add(atmo)
      }
      if (body.rings) {
        const ring = new THREE.Mesh(ringGeometry(body.r * 1.3, body.r * 2.3), new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide, roughness: 1, transparent: true, opacity: 0.92 }))
        ring.rotation.x = -Math.PI / 2 + 0.45
        pivot.add(ring)
      }
      const parent = body.parent ? bodies.get(body.parent).pivot : scene
      parent.add(pivot)
      // Orbite dessinée.
      if (body.orbit) {
        const curve = new THREE.EllipseCurve(0, 0, body.orbit, body.orbit)
        const geo = new THREE.BufferGeometry().setFromPoints(curve.getPoints(160).map((p) => new THREE.Vector3(p.x, 0, p.y)))
        const line = new THREE.LineLoop(geo, new THREE.LineBasicMaterial({ color: body.parent ? 0x8fe3ff : 0xb48cff, transparent: true, opacity: body.parent ? 0.35 : 0.4 }))
        parent.add(line)
      }
      // Position de départ un peu au hasard, mais la même à chaque visite.
      const angle = (body.id.charCodeAt(0) * 1.37 + body.orbit) % (Math.PI * 2)
      bodies.set(body.id, { body, pivot, sphere, angle })
    }
    // Ceinture d'astéroïdes entre Mars et Jupiter.
    const belt = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.12, 0), new THREE.MeshStandardMaterial({ color: 0x9a93ae, roughness: 1, flatShading: true }), 700)
    const m4 = new THREE.Matrix4()
    for (let i = 0; i < 700; i++) {
      const a = Math.random() * Math.PI * 2
      const r = 19.5 + Math.random() * 2.2
      const s = 0.5 + Math.random() * 1.4
      m4.compose(new THREE.Vector3(Math.cos(a) * r, (Math.random() - 0.5) * 0.6, Math.sin(a) * r), new THREE.Quaternion().setFromEuler(new THREE.Euler(a, a * 2, 0)), new THREE.Vector3(s, s, s))
      belt.setMatrixAt(i, m4)
    }
    scene.add(belt)
    scene.userData.belt = belt

    buildUI()
  }

  function buildUI() {
    ui = document.createElement('div')
    ui.className = 'solar'
    ui.innerHTML = `
      <div class="solar-top">
        <div class="solar-title"><span>🔭 Le télescope</span><strong>Le système solaire</strong></div>
        <button class="btn solar-close" type="button">✕ Sortir <kbd>Échap</kbd></button>
      </div>
      <p class="solar-hint">Glisse pour tourner, molette, pincement ou boutons + et − pour zoomer. Touche une planète pour la suivre, une deuxième fois pour t'en approcher.</p>
      <div class="solar-name" aria-live="polite"><span></span><strong></strong></div>
      <div class="solar-labels"></div>
      <div class="solar-zoom">
        <button type="button" data-zoom="in" aria-label="Zoomer">+</button>
        <button type="button" data-zoom="out" aria-label="Dézoomer">−</button>
        <button type="button" data-zoom="all" aria-label="Vue d'ensemble">⤢</button>
      </div>
      <aside class="solar-card" hidden>
        <span class="solar-kind"></span>
        <h3></h3>
        <dl></dl>
        <p class="solar-text"></p>
        <p class="solar-progress"></p>
      </aside>
      <nav class="solar-nav" aria-label="Planètes"></nav>`
    document.body.append(ui)
    ui.querySelector('.solar-close').addEventListener('click', () => api.close())
    // Noms flottants au-dessus de chaque astre.
    const labels = ui.querySelector('.solar-labels')
    for (const body of BODIES) {
      const el = document.createElement('button')
      el.type = 'button'
      el.className = 'solar-label'
      el.textContent = body.name.replace(/^L[ae] /, '')
      el.addEventListener('click', () => select(body.id))
      labels.append(el)
      bodies.get(body.id).label = el
    }
    byRadius = [...bodies.values()].sort((a, b) => b.body.r - a.body.r)
    ui.querySelector('.solar-zoom').addEventListener('click', (e) => {
      const z = e.target.closest('button')?.dataset.zoom
      if (z === 'all') return overview()
      if (z) zoomBy(z === 'in' ? 0.6 : 1.6)
    })
    const nav = ui.querySelector('.solar-nav')
    for (const body of BODIES) {
      const b = document.createElement('button')
      b.type = 'button'
      b.dataset.id = body.id
      b.innerHTML = `<i style="background:${body.color}"></i>${body.name.replace(/^L[ae] /, '')}`
      b.addEventListener('click', () => select(body.id))
      nav.append(b)
    }
    // Clic (ou toucher) sur une planète : on la suit.
    const ray = new THREE.Raycaster()
    const pointer = new THREE.Vector2()
    let downAt = null
    renderer.domElement.addEventListener('pointerdown', (e) => {
      if (active) downAt = [e.clientX, e.clientY]
    })
    renderer.domElement.addEventListener('pointerup', (e) => {
      if (!active || !downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 6) return
      const rect = renderer.domElement.getBoundingClientRect()
      pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1)
      ray.setFromCamera(pointer, camera)
      // Les petites planètes sont dures à viser : on agrandit un peu leur zone de clic.
      let best = null
      let bestD = Infinity
      for (const { body, sphere } of bodies.values()) {
        sphere.getWorldPosition(tmp)
        const d = ray.ray.distanceToPoint(tmp)
        const reach = Math.max(body.r * 1.4, tmp.distanceTo(camera.position) * 0.03)
        if (d < reach && d / reach < bestD) {
          bestD = d / reach
          best = body.id
        }
      }
      if (best) select(best)
    })
    renderer.domElement.addEventListener('dblclick', () => {
      if (active && selected) zoomTo = selected.body.r * 2.7
    })
  }

  // Zoom : on rapproche (ou éloigne) la caméra de ce qu'elle regarde, en douceur.
  function zoomBy(k) {
    if (!controls) return
    const dist = camera.position.distanceTo(controls.target)
    zoomTo = Math.max(controls.minDistance, Math.min(controls.maxDistance, (zoomTo ?? dist) * k))
  }
  function overview() {
    selected = null
    flight = 0
    zoomTo = null
    overviewFlight = 1
    controls.minDistance = 1.2
    ui.querySelector('.solar-card').hidden = true
    ui.querySelector('.solar-name').classList.remove('visible')
    ui.querySelectorAll('.solar-nav button').forEach((el) => el.classList.remove('active'))
  }

  function select(id, close = false) {
    const b = bodies.get(id)
    if (!b) return
    const again = selected === b
    selected = b
    flight = 1
    overviewFlight = 0
    // Un deuxième clic sur la même planète : on s'approche tout près.
    zoomTo = again || close ? b.body.r * 2.7 : null
    controls.minDistance = b.body.r * 1.3
    const name = ui.querySelector('.solar-name')
    name.querySelector('span').textContent = b.body.kind
    name.querySelector('strong').textContent = b.body.name
    name.classList.remove('visible')
    void name.offsetWidth
    name.classList.add('visible')
    const card = ui.querySelector('.solar-card')
    card.hidden = false
    card.querySelector('.solar-kind').textContent = b.body.kind
    card.querySelector('h3').textContent = b.body.name
    card.querySelector('dl').innerHTML = b.body.facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')
    card.querySelector('.solar-text').textContent = b.body.text
    ui.querySelectorAll('.solar-nav button').forEach((el) => el.classList.toggle('active', el.dataset.id === id))
    if (PLANETS.includes(id) && !seen.includes(id)) {
      seen.push(id)
      try {
        localStorage.setItem(SEEN_KEY, JSON.stringify(seen))
      } catch {
        // Navigation privée.
      }
    }
    const count = PLANETS.filter((p) => seen.includes(p)).length
    card.querySelector('.solar-progress').textContent = count < PLANETS.length ? `Planètes observées : ${count} / ${PLANETS.length}` : 'Les 8 planètes observées. Bravo, astronome !'
    onPlanet?.(id, count, PLANETS.length)
  }

  const api = {
    get active() {
      return active
    },
    open() {
      if (!built) build()
      active = true
      camera.aspect = innerWidth / innerHeight
      camera.updateProjectionMatrix()
      controls = new OrbitControls(camera, renderer.domElement)
      controls.enableDamping = true
      controls.dampingFactor = 0.08
      controls.minDistance = 1.2
      controls.maxDistance = 140
      controls.target.set(0, 0, 0)
      controls.enablePan = false
      selected = null
      lastTarget.set(0, 0, 0)
      camera.position.set(0, 34, 62)
      ui.querySelector('.solar-card').hidden = true
      ui.querySelector('.solar-name').classList.remove('visible')
      zoomTo = null
      overviewFlight = 0
      ui.querySelectorAll('.solar-nav button').forEach((el) => el.classList.remove('active'))
      document.body.classList.add('solar-open')
      requestAnimationFrame(() => ui.classList.add('visible'))
    },
    close() {
      if (!active) return
      onExit?.(() => {
        active = false
        controls?.dispose()
        controls = null
        ui.classList.remove('visible')
        document.body.classList.remove('solar-open')
      })
    },
    resize() {
      if (!camera) return
      camera.aspect = innerWidth / innerHeight
      camera.userData.lift = -1
      camera.updateProjectionMatrix()
    },
    update(dt, t) {
      if (!active) return
      for (const b of bodies.values()) {
        if (b.body.orbit) {
          b.angle += (dt * 0.35) / Math.sqrt(b.body.period)
          b.pivot.position.set(Math.cos(b.angle) * b.body.orbit, 0, -Math.sin(b.angle) * b.body.orbit)
        }
        b.sphere.rotation.y += dt * (b.body.id === 'sun' ? 0.05 : 0.4)
      }
      scene.userData.belt.rotation.y += dt * 0.02
      // Suivi de la planète choisie : la cible glisse vers elle et la caméra suit son mouvement.
      if (selected) {
        selected.sphere.getWorldPosition(tmp)
        const k = flight > 0 ? 1 - Math.exp(-dt * 4) : 1
        const next = lastTarget.clone().lerp(tmp, k)
        camera.position.add(next.clone().sub(lastTarget))
        controls.target.copy(next)
        lastTarget.copy(next)
        if (flight > 0) {
          flight = Math.max(0, flight - dt * 0.8)
          // Écran en portrait : plus de recul, sinon la planète déborde sur les côtés.
          const portrait = innerHeight > innerWidth ? Math.min(2, innerHeight / innerWidth) : 1
          const want = (zoomTo ?? selected.body.r * 3.2 + 0.8) * (zoomTo ? 1 : portrait)
          const dir = camera.position.clone().sub(next)
          const dist = dir.length()
          dir.setLength(dist + (want - dist) * (1 - Math.exp(-dt * 3)))
          camera.position.copy(next).add(dir)
        }
      }
      // Zoom demandé (boutons, double clic) une fois le vol terminé.
      if (zoomTo && !(selected && flight > 0)) {
        const dir = camera.position.clone().sub(controls.target)
        const dist = dir.length()
        const next = dist + (zoomTo - dist) * (1 - Math.exp(-dt * 5))
        dir.setLength(next)
        camera.position.copy(controls.target).add(dir)
        if (Math.abs(next - zoomTo) < 0.01) zoomTo = null
      }
      // Retour à la vue d'ensemble.
      if (overviewFlight > 0) {
        overviewFlight = Math.max(0, overviewFlight - dt * 0.9)
        const k = 1 - Math.exp(-dt * 3)
        controls.target.lerp(tmp.set(0, 0, 0), k)
        lastTarget.copy(controls.target)
        camera.position.lerp(tmp.set(0, 34, 62), k)
      }
      // Téléphone : la fiche couvre le bas de l'écran, on remonte l'image pour garder la planète visible.
      const lift = selected && innerWidth <= 700 ? Math.round(innerHeight * 0.2) : 0
      if (lift !== camera.userData.lift) {
        camera.userData.lift = lift
        if (lift) camera.setViewOffset(innerWidth, innerHeight, 0, lift, innerWidth, innerHeight)
        else camera.clearViewOffset()
      }
      controls.update()
      // Noms au-dessus des astres. Si deux étiquettes se chevauchent, la plus grosse planète garde la sienne.
      const placed = []
      const dist = camera.position.distanceTo(controls.target)
      for (const b of byRadius) {
        const el = b.label
        b.sphere.getWorldPosition(screen)
        screen.y += b.body.r * 1.15
        screen.project(camera)
        const x = ((screen.x + 1) / 2) * innerWidth
        const y = ((1 - screen.y) / 2) * innerHeight
        let show = screen.z < 1 && Math.abs(screen.x) < 1.1 && Math.abs(screen.y) < 1.1
        if (b === selected && dist < b.body.r * 9) show = false
        if (b.body.parent && dist > 40) show = false
        if (show && placed.some(([px, py]) => Math.abs(px - x) < 78 && Math.abs(py - y) < 24)) show = false
        el.style.display = show ? '' : 'none'
        if (!show) continue
        placed.push([x, y])
        el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`
        el.classList.toggle('active', b === selected)
      }
      void t
    },
    render() {
      renderer.render(scene, camera)
    },
  }
  window.addEventListener('keydown', (e) => {
    if (active && e.code === 'Escape') {
      e.stopImmediatePropagation()
      api.close()
    }
  }, true)
  return api
}
