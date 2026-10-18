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
function noise(seed) {
  const a = [1.7, 2.9, 4.3, 7.1].map((f, i) => [f, Math.sin(seed * (i + 3)) * 10, Math.cos(seed * (i + 5)) * 10])
  return (u, v) => a.reduce((s, [f, px, py], i) => s + Math.sin(u * f * 6.283 + px + Math.sin(v * f * 3.1 + py) * 1.5) * Math.cos(v * f * 3.1 + py) / (i + 1), 0)
}

function planetTexture(body) {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 256
  const g = canvas.getContext('2d')
  const W = 512
  const H = 256
  const img = g.createImageData(W, H)
  const n = noise(body.id.length * 7.3 + body.r)
  const n2 = noise(body.id.charCodeAt(0) * 0.37)
  const set = (i, r, gg, b) => {
    img.data[i] = r
    img.data[i + 1] = gg
    img.data[i + 2] = b
    img.data[i + 3] = 255
  }
  for (let y = 0; y < H; y++) {
    const v = y / H
    for (let x = 0; x < W; x++) {
      const u = x / W
      const i = (y * W + x) * 4
      const k = n(u, v)
      const k2 = n2(u * 2, v * 2)
      switch (body.id) {
        case 'sun': {
          const t = 0.75 + k * 0.12 + k2 * 0.08
          set(i, 255, 170 + t * 70, 60 + t * 50)
          break
        }
        case 'mercury':
        case 'moon': {
          const t = 150 + k * 25 + k2 * 18
          set(i, t, t * 0.97, t * 0.93)
          break
        }
        case 'venus': {
          const t = Math.sin(v * 14 + k * 2.5) * 0.5 + 0.5
          set(i, 220 + t * 30, 190 + t * 30, 120 + t * 40)
          break
        }
        case 'earth': {
          const land = k + k2 * 0.6 > 0.55 && Math.abs(v - 0.5) < 0.42
          const ice = Math.abs(v - 0.5) > 0.43
          const cloud = n2(u * 3 + 0.3, v * 3) > 0.9
          if (ice || cloud) set(i, 240, 245, 250)
          else if (land) set(i, 70 + k2 * 40, 140 + k * 20, 60)
          else set(i, 30, 90 + k * 20, 190 + k * 20)
          break
        }
        case 'mars': {
          const ice = Math.abs(v - 0.5) > 0.45
          const t = k * 0.5 + k2 * 0.3
          if (ice) set(i, 245, 235, 230)
          else set(i, 200 + t * 30, 95 + t * 25, 55 + t * 15)
          break
        }
        case 'jupiter':
        case 'saturn': {
          const band = Math.sin(v * (body.id === 'jupiter' ? 34 : 26) + k * 0.8) * 0.5 + 0.5
          const base = body.id === 'jupiter' ? [205, 170, 130] : [228, 205, 150]
          const dark = body.id === 'jupiter' ? [150, 95, 60] : [190, 160, 105]
          let r = base[0] + (dark[0] - base[0]) * band
          let gg = base[1] + (dark[1] - base[1]) * band
          let b = base[2] + (dark[2] - base[2]) * band
          if (body.id === 'jupiter') {
            const du = (u - 0.3) * 3.2
            const dv = (v - 0.64) * 7
            if (du * du + dv * dv < 1) {
              r = 200
              gg = 90
              b = 60
            }
          }
          set(i, r, gg, b)
          break
        }
        case 'uranus': {
          const t = Math.sin(v * 10) * 0.05 + k * 0.03
          set(i, 140 + t * 200, 210 + t * 100, 220)
          break
        }
        case 'neptune': {
          const t = Math.sin(v * 16 + k) * 0.5 + 0.5
          let r = 50 + t * 25
          let gg = 90 + t * 30
          let b = 210 + t * 30
          const du = (u - 0.6) * 5
          const dv = (v - 0.42) * 10
          if (du * du + dv * dv < 1) {
            r = 25
            gg = 45
            b = 140
          }
          set(i, r, gg, b)
          break
        }
        default:
          set(i, 200, 200, 200)
      }
    }
  }
  g.putImageData(img, 0, 0)
  // Cratères pour Mercure et la Lune.
  if (body.id === 'mercury' || body.id === 'moon') {
    for (let c = 0; c < 70; c++) {
      const cx = (c * 97.3) % W
      const cy = 20 + ((c * 53.7) % (H - 40))
      const cr = 3 + ((c * 13) % 9)
      g.fillStyle = 'rgba(60, 55, 50, 0.35)'
      g.beginPath()
      g.arc(cx, cy, cr, 0, Math.PI * 2)
      g.fill()
      g.strokeStyle = 'rgba(255, 255, 255, 0.18)'
      g.stroke()
    }
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
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

function ringTexture() {
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 8
  const g = c.getContext('2d')
  for (let x = 0; x < 512; x++) {
    const t = x / 512
    const gap = t > 0.62 && t < 0.67
    const a = gap ? 0.05 : 0.35 + Math.sin(t * 60) * 0.15 + Math.sin(t * 13) * 0.2
    g.fillStyle = `rgba(230, 210, 170, ${Math.max(0, Math.min(0.9, a))})`
    g.fillRect(x, 0, 1, 8)
  }
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
    scene.background = new THREE.Color(0x03040c)
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
      const tex = planetTexture(body)
      const material = body.id === 'sun' ? new THREE.MeshBasicMaterial({ map: tex }) : new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, metalness: 0 })
      const sphere = new THREE.Mesh(new THREE.SphereGeometry(body.r, 48, 24), material)
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
        const ring = new THREE.Mesh(new THREE.RingGeometry(body.r * 1.3, body.r * 2.3, 96, 1), new THREE.MeshStandardMaterial({ map: ringTexture(), transparent: true, side: THREE.DoubleSide, depthWrite: false, roughness: 1 }))
        // Coordonnées UV radiales pour que la texture suive les anneaux.
        const pos = ring.geometry.attributes.position
        const uv = ring.geometry.attributes.uv
        for (let i = 0; i < pos.count; i++) {
          const d = Math.hypot(pos.getX(i), pos.getY(i))
          uv.setXY(i, (d - body.r * 1.3) / (body.r * 1.0), 0.5)
        }
        ring.rotation.x = -Math.PI / 2 + 0.45
        pivot.add(ring)
      }
      const parent = body.parent ? bodies.get(body.parent).pivot : scene
      parent.add(pivot)
      // Orbite dessinée.
      if (body.orbit) {
        const curve = new THREE.EllipseCurve(0, 0, body.orbit, body.orbit)
        const geo = new THREE.BufferGeometry().setFromPoints(curve.getPoints(160).map((p) => new THREE.Vector3(p.x, 0, p.y)))
        const line = new THREE.LineLoop(geo, new THREE.LineBasicMaterial({ color: body.parent ? 0x8890b0 : 0x6a72a8, transparent: true, opacity: body.parent ? 0.35 : 0.45 }))
        parent.add(line)
      }
      // Position de départ un peu au hasard, mais la même à chaque visite.
      const angle = (body.id.charCodeAt(0) * 1.37 + body.orbit) % (Math.PI * 2)
      bodies.set(body.id, { body, pivot, sphere, angle })
    }
    // Ceinture d'astéroïdes entre Mars et Jupiter.
    const belt = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.12, 0), new THREE.MeshStandardMaterial({ color: 0x8a8478, roughness: 1, flatShading: true }), 700)
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
      <p class="solar-hint">Glisse pour tourner, molette ou pincement pour zoomer. Touche une planète pour la suivre.</p>
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
  }

  function select(id) {
    const b = bodies.get(id)
    if (!b) return
    selected = b
    flight = 1
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
          const want = selected.body.r * 4.5 + 1.5
          const dir = camera.position.clone().sub(next)
          const dist = dir.length()
          dir.setLength(dist + (want - dist) * (1 - Math.exp(-dt * 3)))
          camera.position.copy(next).add(dir)
        }
      }
      // Téléphone : la fiche couvre le bas de l'écran, on remonte l'image pour garder la planète visible.
      const lift = selected && innerWidth <= 700 ? Math.round(innerHeight * 0.2) : 0
      if (lift !== camera.userData.lift) {
        camera.userData.lift = lift
        if (lift) camera.setViewOffset(innerWidth, innerHeight, 0, lift, innerWidth, innerHeight)
        else camera.clearViewOffset()
      }
      controls.update()
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
