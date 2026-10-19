import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { character } from './world/characters.js'
import { animate } from './world/models.js'

// Match de foot : depuis le stade de l'île du Présent, on joue une vraie petite partie à 3 contre 3
// (toi, un coéquipier et un gardien contre l'équipe violette). Deux minutes de jeu, coup d'envoi
// après chaque but. Flèches / ZQSD pour courir, Maj pour sprinter, Espace pour tirer (maintenir = plus fort).

const HL = 20 // demi-longueur du terrain (axe x)
const HW = 13 // demi-largeur (axe z)
const GOAL_HALF = 2.8 // demi-largeur des buts
const GOAL_H = 2.1
const GOAL_D = 1.6 // profondeur des filets
const BALL_R = 0.24
const MATCH = 120 // durée réelle d'un match (s), affichée de 0' à 90'
const KICK_RANGE = 1.15
const ME = 0xffb347 // équipe orange-or (la tienne)
const CPU = 0x9a6bff // équipe violette
export const FOOT_GAME = { id: 'foot', title: 'Match de foot', score: true, medals: [1200, 600] }

// Petit générateur pseudo-aléatoire : le décor est le même à chaque match.
function rng(seed) {
  let s = seed
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

const clamp = THREE.MathUtils.clamp
const rand = (a, b) => a + Math.random() * (b - a)

// Panneau publicitaire : une tuile de texte répétée le long des bandes (20 × 1 environ).
function bannerTexture(text, from, to) {
  const c = document.createElement('canvas')
  c.width = 1024
  c.height = 52
  const g = c.getContext('2d')
  const grad = g.createLinearGradient(0, 0, 1024, 0)
  grad.addColorStop(0, from)
  grad.addColorStop(0.5, to)
  grad.addColorStop(1, from)
  g.fillStyle = grad
  g.fillRect(0, 0, 1024, 52)
  g.fillStyle = '#1a1530'
  g.font = '700 34px "Outfit Variable", system-ui, sans-serif'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText(text, 512, 28)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = THREE.RepeatWrapping
  tex.anisotropy = 4
  return tex
}

// Maille du filet : une grille blanche sur fond transparent, répétée.
function netTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 32
  const g = c.getContext('2d')
  g.strokeStyle = 'rgba(255,255,255,0.9)'
  g.lineWidth = 3
  g.strokeRect(0, 0, 32, 32)
  const tex = new THREE.CanvasTexture(c)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  return tex
}

function glowTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d')
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32)
  grad.addColorStop(0, 'rgba(255,248,220,1)')
  grad.addColorStop(0.3, 'rgba(255,230,170,0.5)')
  grad.addColorStop(1, 'rgba(255,210,122,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 64, 64)
  return new THREE.CanvasTexture(c)
}

// Les géométries à fusionner doivent toutes être non indexées.
const ni = (g) => (g.index ? g.toNonIndexed() : g)

// Quad posé à plat (pour les lignes du terrain).
function flat(w, d, x, z) {
  return new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2).translate(x, 0, z)
}

export function createFootball({ renderer, sfx, rewards, getCharacter, onExit, onFinish }) {
  let built = false
  let active = false
  let scene, camera, ui, ball, crowd
  const players = []
  const keys = { left: false, right: false, up: false, down: false, sprint: false, kick: false }
  const touch = { x: 0, z: 0, id: null, ox: 0, oy: 0, kick: false }
  let state = 'intro'
  let st = null
  let charKey = null

  // ---------- Construction du stade ----------
  function build() {
    built = true
    scene = new THREE.Scene()
    scene.background = new THREE.Color(0x2c2160)
    scene.fog = new THREE.Fog(0x2c2160, 45, 110)
    camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 300)
    scene.add(new THREE.HemisphereLight(0xdcd6ff, 0x4a3d8a, 1.4))
    const sun = new THREE.DirectionalLight(0xfff0d8, 1.7)
    sun.position.set(10, 40, 25)
    scene.add(sun)

    // Sol autour du terrain (piste violette).
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(160, 120).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x3d3378, roughness: 1 }))
    ground.position.y = -0.02
    scene.add(ground)

    // Pelouse : bandes de tonte en deux verts, un seul maillage en couleurs de sommets.
    const grass = new THREE.PlaneGeometry(HL * 2 + 4, HW * 2 + 4, 22, 6).rotateX(-Math.PI / 2).toNonIndexed()
    const pos = grass.attributes.position
    const colors = new Float32Array(pos.count * 3)
    const c = new THREE.Color()
    const r = rng(5)
    for (let f = 0; f < pos.count; f += 3) {
      const cx = (pos.getX(f) + pos.getX(f + 1) + pos.getX(f + 2)) / 3
      const stripe = Math.floor((cx + HL + 2) / ((HL * 2 + 4) / 11)) % 2
      c.setHex(stripe ? 0x4caf6a : 0x3f9a5c)
      c.offsetHSL(0, 0, (r() - 0.5) * 0.025)
      for (let k = 0; k < 3; k++) colors.set([c.r, c.g, c.b], (f + k) * 3)
    }
    grass.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    grass.computeVertexNormals()
    scene.add(new THREE.Mesh(grass, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 })))

    // Lignes blanches : tout fusionné en un seul maillage.
    const W = 0.12
    const lines = [
      flat(HL * 2 + W, W, 0, -HW), flat(HL * 2 + W, W, 0, HW),
      flat(W, HW * 2, -HL, 0), flat(W, HW * 2, HL, 0), flat(W, HW * 2, 0, 0),
      new THREE.RingGeometry(3.4, 3.4 + W, 40).rotateX(-Math.PI / 2),
      new THREE.CircleGeometry(0.18, 12).rotateX(-Math.PI / 2),
    ]
    for (const s of [-1, 1]) {
      // Surface de réparation, petit rectangle, point de penalty.
      lines.push(flat(W, 15, s * (HL - 5.5), 0), flat(5.5, W, s * (HL - 2.75), -7.5), flat(5.5, W, s * (HL - 2.75), 7.5))
      lines.push(flat(W, 8, s * (HL - 2), 0), flat(2, W, s * (HL - 1), -4), flat(2, W, s * (HL - 1), 4))
      lines.push(new THREE.CircleGeometry(0.14, 10).rotateX(-Math.PI / 2).translate(s * (HL - 4), 0, 0))
      // Arc de la surface.
      const arc = new THREE.RingGeometry(3.4, 3.4 + W, 24, 1, -Math.acos(1.5 / 3.4), 2 * Math.acos(1.5 / 3.4)).rotateX(-Math.PI / 2)
      if (s > 0) arc.rotateY(Math.PI)
      lines.push(arc.translate(s * (HL - 4), 0, 0))
    }
    const lineMesh = new THREE.Mesh(mergeGeometries(lines.map((g) => ni(g))), new THREE.MeshBasicMaterial({ color: 0xf4f1ff, fog: false }))
    lineMesh.position.y = 0.02
    scene.add(lineMesh)

    // Buts : poteaux et barre fusionnés, filets en maille transparente.
    const postMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.25, flatShading: true })
    const net = netTexture()
    for (const s of [-1, 1]) {
      const x = s * HL
      const posts = [
        new THREE.CylinderGeometry(0.08, 0.08, GOAL_H, 6).translate(x, GOAL_H / 2, -GOAL_HALF),
        new THREE.CylinderGeometry(0.08, 0.08, GOAL_H, 6).translate(x, GOAL_H / 2, GOAL_HALF),
        new THREE.CylinderGeometry(0.08, 0.08, GOAL_HALF * 2 + 0.16, 6).rotateX(Math.PI / 2).translate(x, GOAL_H, 0),
        new THREE.CylinderGeometry(0.05, 0.05, GOAL_D, 5).rotateZ(Math.PI / 2).translate(x + s * GOAL_D / 2, GOAL_H, -GOAL_HALF),
        new THREE.CylinderGeometry(0.05, 0.05, GOAL_D, 5).rotateZ(Math.PI / 2).translate(x + s * GOAL_D / 2, GOAL_H, GOAL_HALF),
      ]
      scene.add(new THREE.Mesh(mergeGeometries(posts.map((g) => ni(g))), postMat))
      const back = new THREE.PlaneGeometry(GOAL_HALF * 2, GOAL_H).rotateY(Math.PI / 2).translate(x + s * GOAL_D, GOAL_H / 2, 0)
      const top = new THREE.PlaneGeometry(GOAL_D, GOAL_HALF * 2).rotateX(-Math.PI / 2).translate(x + s * GOAL_D / 2, GOAL_H, 0)
      const sideA = new THREE.PlaneGeometry(GOAL_D, GOAL_H).translate(x + s * GOAL_D / 2, GOAL_H / 2, -GOAL_HALF)
      const sideB = sideA.clone().translate(0, 0, GOAL_HALF * 2)
      // Répétition de la maille selon la taille de chaque face.
      const uvScale = (g, u, v) => {
        const uv = g.attributes.uv
        for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * u, uv.getY(i) * v)
        return g
      }
      const netGeo = mergeGeometries([uvScale(back, 22, 8), uvScale(top, 6, 22), uvScale(sideA, 6, 8), uvScale(sideB, 6, 8)])
      scene.add(new THREE.Mesh(netGeo, new THREE.MeshBasicMaterial({ map: net, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false })))
    }

    // Panneaux publicitaires autour du terrain.
    const bannerMat = new THREE.MeshBasicMaterial({ map: bannerTexture('AVENTURE TIME  ⚽  ANTOINE QUARROZ', '#ffd27a', '#b48cff') })
    const boards = []
    const board = (w, x, z, rotY) => {
      const g = new THREE.PlaneGeometry(w, 0.7)
      const uv = g.attributes.uv
      for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * Math.max(1, Math.round(w / 14)))
      boards.push(g.rotateY(rotY).translate(x, 0.35, z))
    }
    board(HL * 2 + 2, 0, -HW - 1, 0)
    for (const s of [-1, 1]) for (const zs of [-1, 1]) board(HW - GOAL_HALF - 1, s * (HL + 2.6), zs * (HW + GOAL_HALF + 1) / 2, -s * Math.PI / 2)
    scene.add(new THREE.Mesh(mergeGeometries(boards), bannerMat))
    const near = new THREE.Mesh(new THREE.BoxGeometry(HL * 2 + 2, 0.45, 0.2), new THREE.MeshStandardMaterial({ color: 0x5a4aa0, flatShading: true }))
    near.position.set(0, 0.22, HW + 1)
    scene.add(near)

    // Tribunes en gradins (côté opposé et derrière les buts) et spectateurs instanciés.
    const standMat = new THREE.MeshStandardMaterial({ color: 0x4b3f8f, flatShading: true })
    const standGeo = []
    const seats = []
    const sr = rng(21)
    for (let k = 0; k < 4; k++) {
      standGeo.push(new THREE.BoxGeometry(HL * 2 + 6, 0.6 + k * 0.9, 1.6).translate(0, (0.6 + k * 0.9) / 2, -HW - 3 - k * 1.6))
      for (let x = -HL - 1.5; x <= HL + 1.5; x += 1.15) if (sr() < 0.82) seats.push([x + sr() * 0.3, 0.6 + k * 0.9, -HW - 3 - k * 1.6])
    }
    for (const s of [-1, 1]) {
      for (let k = 0; k < 3; k++) {
        const x = s * (HL + 4.5 + k * 1.6)
        standGeo.push(new THREE.BoxGeometry(1.6, 0.6 + k * 0.9, HW * 1.4).translate(x, (0.6 + k * 0.9) / 2, -1.5))
        for (let z = -HW * 0.7 - 1; z <= HW * 0.7 - 2; z += 1.15) if (sr() < 0.7) seats.push([x, 0.6 + k * 0.9, z + sr() * 0.3])
      }
    }
    scene.add(new THREE.Mesh(mergeGeometries(standGeo.map((g) => ni(g))), standMat))
    const n = seats.length
    const bodies = new THREE.InstancedMesh(new THREE.BoxGeometry(0.5, 0.6, 0.35).translate(0, 0.3, 0), new THREE.MeshStandardMaterial({ flatShading: true }), n)
    const heads = new THREE.InstancedMesh(new THREE.BoxGeometry(0.34, 0.34, 0.34).translate(0, 0.8, 0), new THREE.MeshStandardMaterial({ flatShading: true }), n)
    const shirts = [ME, 0xffd27a, CPU, 0xff6f9f, 0x8fe3ff, 0xffffff, 0xff8a3d]
    const skins = [0xf2c9a0, 0xd9a47a, 0x9a6a48, 0xf7dcc0]
    seats.forEach((p, i) => {
      bodies.setColorAt(i, c.setHex(shirts[Math.floor(sr() * shirts.length)]))
      heads.setColorAt(i, c.setHex(skins[Math.floor(sr() * skins.length)]))
    })
    crowd = { bodies, heads, seats, phase: seats.map(() => sr() * 6.28), fans: seats.map((p) => (p[2] > -HW - 2 ? Math.sign(p[0]) : sr() < 0.5 ? -1 : 1)) }
    scene.add(bodies, heads)

    // Projecteurs aux quatre coins : mât, rampe lumineuse et halo.
    const mastMat = new THREE.MeshStandardMaterial({ color: 0x2a2258, flatShading: true })
    const lampMat = new THREE.MeshStandardMaterial({ color: 0xfff6d8, emissive: 0xfff0c0, emissiveIntensity: 2.2 })
    const glow = new THREE.SpriteMaterial({ map: glowTexture(), color: 0xffe6a8, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false })
    const masts = []
    const lamps = []
    for (const [x, z] of [[-HL - 6, -HW - 8], [HL + 6, -HW - 8], [-HL - 6, HW + 6], [HL + 6, HW + 6]]) {
      masts.push(new THREE.CylinderGeometry(0.22, 0.35, 15, 6).translate(x, 7.5, z))
      const head = new THREE.BoxGeometry(2.6, 1.4, 0.4)
      head.lookAt(new THREE.Vector3(-x, -12, -z))
      lamps.push(head.translate(x, 15.4, z))
      const sp = new THREE.Sprite(glow)
      sp.position.set(x * 0.98, 15.4, z * 0.98)
      sp.scale.setScalar(9)
      scene.add(sp)
    }
    scene.add(new THREE.Mesh(mergeGeometries(masts.map((g) => ni(g))), mastMat))
    scene.add(new THREE.Mesh(mergeGeometries(lamps.map((g) => ni(g))), lampMat))

    // Ciel étoilé.
    const sky = new Float32Array(500 * 3)
    const kr = rng(9)
    for (let i = 0; i < 500; i++) {
      const a = kr() * Math.PI * 2
      const h = 0.15 + kr() * 0.85
      sky.set([Math.cos(a) * 120 * Math.sqrt(1 - h * h), h * 120, Math.sin(a) * 120 * Math.sqrt(1 - h * h)], i * 3)
    }
    const starGeo = new THREE.BufferGeometry()
    starGeo.setAttribute('position', new THREE.BufferAttribute(sky, 3))
    scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.6, fog: false })))

    // Ballon : icosaèdre en facettes, quelques faces sombres pour voir qu'il roule.
    const bg = new THREE.IcosahedronGeometry(BALL_R, 1)
    const bc = new Float32Array(bg.attributes.position.count * 3)
    for (let f = 0; f < bc.length / 9; f++) {
      c.setHex(f % 5 === 0 ? 0x2a2258 : 0xffffff)
      for (let k = 0; k < 3; k++) bc.set([c.r, c.g, c.b], (f * 3 + k) * 3)
    }
    bg.setAttribute('color', new THREE.BufferAttribute(bc, 3))
    ball = new THREE.Mesh(bg, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.6 }))
    ball.userData.shadow = blob(0.35)
    scene.add(ball)

    buildTeams()
    buildUI()
  }

  // Ombre ronde sous le ballon et les joueurs (pas de vraies ombres : moins coûteux).
  const blobGeo = new THREE.CircleGeometry(1, 16).rotateX(-Math.PI / 2)
  const blobMat = new THREE.MeshBasicMaterial({ color: 0x10301c, transparent: true, opacity: 0.35, depthWrite: false })
  function blob(size) {
    const m = new THREE.Mesh(blobGeo, blobMat)
    m.scale.setScalar(size)
    m.position.y = 0.03
    scene.add(m)
    return m
  }

  // ---------- Joueurs ----------
  const HATS = { knight: ['Knight_Helmet'], mage: ['Mage_Hat'], barbarian: ['Barbarian_Hat'], rogue: [] }
  function makePlayer(key, team, role, human, home) {
    const obj = new THREE.Group()
    const body = character(key, { height: 1.7, keep: HATS[key] ?? [] })
    obj.add(body)
    const { mixer, actions } = animate(body, 'Idle')
    mixer.update(Math.random() * 2)
    // Anneau aux couleurs de l'équipe sous les pieds, plus large pour le gardien.
    const color = team ? CPU : ME
    const ring = new THREE.Mesh(new THREE.RingGeometry(role === 'gk' ? 0.55 : 0.45, role === 'gk' ? 0.75 : 0.62, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, depthWrite: false }))
    ring.position.y = 0.04
    obj.add(ring)
    const sh = new THREE.Mesh(blobGeo, blobMat)
    sh.scale.setScalar(0.5)
    sh.position.y = 0.03
    obj.add(sh)
    // Maillot : un gilet coloré accroché au torse du modèle.
    obj.updateMatrixWorld(true)
    const chest = body.getObjectByName('chest')
    if (chest) {
      const scale = new THREE.Vector3()
      chest.getWorldScale(scale)
      const vest = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.36, 0.42, 8, 1, true), new THREE.MeshStandardMaterial({ color, flatShading: true, side: THREE.DoubleSide, emissive: color, emissiveIntensity: 0.15 }))
      vest.scale.setScalar(1 / scale.x)
      vest.position.y = 0.12 / scale.x
      chest.add(vest)
    }
    let marker = null
    if (human) {
      // Flèche dorée au-dessus de ta tête.
      marker = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.4, 4).rotateX(Math.PI), new THREE.MeshBasicMaterial({ color: 0xffd27a, fog: false }))
      marker.position.y = 2.3
      obj.add(marker)
    }
    scene.add(obj)
    return { key, team, role, human, home, x: home[0], z: home[1], vx: 0, vz: 0, face: team ? -Math.PI / 2 : Math.PI / 2, obj, mixer, actions, cur: actions.Idle, cd: 0, hold: 0, wait: 0, marker, cheer: 0 }
  }

  function removePlayer(p) {
    scene.remove(p.obj)
    p.obj.traverse((o) => {
      if (o.isMesh && o.geometry !== blobGeo && !o.isSkinnedMesh) o.geometry.dispose()
    })
  }

  // Équipe orange : toi (perso choisi) + un coéquipier + un gardien. Équipe violette : barbare, chevalier, gardien.
  function buildTeams() {
    const key = getCharacter?.() ?? 'rogue'
    if (charKey === key && players.length) return
    for (const p of players) removePlayer(p)
    players.length = 0
    charKey = key
    const mate = key === 'knight' ? 'rogue' : 'knight'
    const keeper = key === 'mage' ? 'barbarian' : 'mage'
    players.push(
      makePlayer(key, 0, 'field', true, [-5, 2]),
      makePlayer(mate, 0, 'field', false, [-8, -5]),
      makePlayer(keeper, 0, 'gk', false, [-HL + 0.8, 0]),
      makePlayer('barbarian', 1, 'field', false, [6, -2]),
      makePlayer('knight', 1, 'field', false, [9, 5]),
      makePlayer('barbarian', 1, 'gk', false, [HL - 0.8, 0]),
    )
  }

  function play(p, name, scale = 1) {
    const next = p.actions[name]
    if (!next) return
    next.timeScale = scale
    if (next === p.cur) return
    next.reset().fadeIn(0.2).play()
    p.cur?.fadeOut(0.2)
    p.cur = next
  }

  // ---------- Interface ----------
  function buildUI() {
    ui = document.createElement('div')
    ui.className = 'foot'
    ui.innerHTML = `
      <div class="foot-top">
        <div class="foot-board">
          <span class="foot-team me"><i></i>Toi</span>
          <b class="foot-score">0 – 0</b>
          <span class="foot-team cpu">CPU<i></i></span>
          <em class="foot-clock">0'</em>
        </div>
        <button class="btn foot-close" type="button">✕ Sortir</button>
      </div>
      <div class="foot-pop"></div>
      <div class="foot-count"></div>
      <div class="foot-goal"><b>BUT !</b><small></small></div>
      <div class="foot-charge"><i></i></div>
      <section class="foot-card foot-intro">
        <span class="foot-kicker">Ma passion</span>
        <h2>⚽ Match de foot</h2>
        <p class="foot-text"></p>
        <ul>
          <li>Ton équipe en <b class="c-me">orange</b> contre l'équipe <b class="c-cpu">violette</b>, à 3 contre 3, pendant 90 minutes… de deux minutes !</li>
          <li>Clavier : flèches ou ZQSD pour courir, Maj pour sprinter, Espace pour tirer (maintiens pour frapper plus fort).</li>
          <li>Téléphone : joystick à gauche de l'écran, bouton « Tirer » à droite.</li>
          <li>Fonce sur le ballon pour le conduire. But marqué : +300 points, but encaissé : −100, victoire : +500.</li>
        </ul>
        <div class="foot-best"></div>
        <button class="btn primary big foot-go" type="button">Coup d'envoi !</button>
      </section>
      <section class="foot-card foot-result" hidden>
        <span class="foot-kicker">Coup de sifflet final</span>
        <h2 class="foot-medal"></h2>
        <p class="foot-final"></p>
        <dl class="foot-score-list"></dl>
        <pre class="foot-board-lines"></pre>
        <div class="foot-actions">
          <button class="btn primary foot-again" type="button">↻ Rejouer</button>
          <button class="btn foot-leave" type="button">Sortir</button>
        </div>
      </section>
      <div class="foot-stick" aria-hidden="true"><i></i></div>
      <button class="foot-kick" type="button" aria-label="Tirer">Tirer</button>`
    document.body.append(ui)
    const q = (s) => ui.querySelector(s)
    q('.foot-close').addEventListener('click', () => api.close())
    q('.foot-leave').addEventListener('click', () => api.close())
    q('.foot-go').addEventListener('click', () => start())
    q('.foot-again').addEventListener('click', () => start())
    // Joystick virtuel : le pouce se pose n'importe où sur la moitié gauche.
    const zone = q('.foot-stick')
    const knob = zone.querySelector('i')
    zone.addEventListener('pointerdown', (e) => {
      e.preventDefault()
      touch.id = e.pointerId
      touch.ox = e.clientX
      touch.oy = e.clientY
      zone.setPointerCapture?.(e.pointerId)
      zone.style.setProperty('--sx', `${e.clientX}px`)
      zone.style.setProperty('--sy', `${e.clientY}px`)
      zone.classList.add('on')
    })
    zone.addEventListener('pointermove', (e) => {
      if (e.pointerId !== touch.id) return
      const R = 55
      let dx = e.clientX - touch.ox
      let dy = e.clientY - touch.oy
      const d = Math.hypot(dx, dy)
      if (d > R) {
        dx *= R / d
        dy *= R / d
      }
      touch.x = dx / R
      touch.z = dy / R
      knob.style.transform = `translate(${dx}px, ${dy}px)`
    })
    const release = (e) => {
      if (e.pointerId !== touch.id) return
      touch.id = null
      touch.x = touch.z = 0
      knob.style.transform = ''
      zone.classList.remove('on')
    }
    for (const ev of ['pointerup', 'pointercancel']) zone.addEventListener(ev, release)
    const kickBtn = q('.foot-kick')
    kickBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault()
      kickBtn.setPointerCapture?.(e.pointerId)
      pressKick()
    })
    for (const ev of ['pointerup', 'pointercancel']) kickBtn.addEventListener(ev, () => releaseKick())
  }

  const $ = (s) => ui.querySelector(s)
  function pop(text, kind = '') {
    const el = $('.foot-pop')
    el.textContent = text
    el.className = `foot-pop show ${kind}`
    clearTimeout(pop.t)
    pop.t = setTimeout(() => el.classList.remove('show'), 1100)
  }

  // ---------- Match ----------
  function reset() {
    buildTeams()
    st = { time: 0, me: 0, cpu: 0, shots: 0, saves: 0, count: 3, goT: 0, goalT: 0, endT: 0, charge: -1, buffer: 0, lastTouch: null, scorer: null }
    kickoff(0)
    camPos.set(0, 18, 20)
  }

  // Coup d'envoi : tout le monde à sa place, le ballon au centre. `team` = équipe qui engage.
  function kickoff(team) {
    st.ball = { x: 0, y: BALL_R, z: 0, vx: 0, vz: 0, vy: 0, noSave: 0, held: null, inGoal: 0 }
    for (const p of players) {
      p.x = p.home[0]
      p.z = p.home[1]
      p.vx = p.vz = 0
      p.cd = 0
      p.hold = 0
      p.cheer = 0
      p.face = p.team ? -Math.PI / 2 : Math.PI / 2
      // L'équipe qui n'engage pas attend un instant hors du rond central.
      p.wait = p.team === team ? 0 : 0.9
    }
    const taker = players.find((p) => p.team === team && p.role === 'field' && (team === 1 || p.human))
    taker.x = team ? 1.1 : -1.1
    taker.z = 0
    for (const p of players) placePlayer(p, 0)
    placeBall(0)
  }

  function start() {
    reset()
    state = 'countdown'
    $('.foot-intro').hidden = true
    $('.foot-result').hidden = true
    $('.foot-goal').classList.remove('show')
    ui.classList.add('running')
    sfx?.blip?.('open')
    updateHud()
  }

  const goalOf = (team) => (team ? -HL : HL) // but que l'équipe attaque
  const dirOf = (team) => (team ? -1 : 1)

  function kick(p, dx, dz, power, lift = 0) {
    const b = st.ball
    const d = Math.hypot(dx, dz) || 1
    b.vx = (dx / d) * power
    b.vz = (dz / d) * power
    b.vy = lift
    b.held = null
    b.noSave = 0
    p.cd = p.human ? 0.25 : 0.55
    st.lastTouch = p
    p.face = Math.atan2(dx, dz)
    sfx?.blip?.('tick')
  }

  // Ta frappe : dans le sens de ta course, avec une aide à la visée quand tu vises le but adverse.
  function humanKick(power01) {
    const me = players[0]
    const b = st.ball
    if (b.held || Math.hypot(b.x - me.x, b.z - me.z) > KICK_RANGE) return false
    let dx = Math.sin(me.face)
    let dz = Math.cos(me.face)
    const mv = moveInput()
    if (mv.x || mv.z) {
      dx = mv.x
      dz = mv.z
    }
    const gx = HL - b.x
    if (dx > 0.1 && gx < 18) {
      // Aide à la visée : on tire vers le but, plutôt dans le coin opposé au gardien.
      const keeper = players.find((p) => p.team === 1 && p.role === 'gk')
      const corner = Math.abs(dz) > 0.5 ? Math.sign(dz) : keeper.z > 0 ? -1 : 1
      const tz = corner * (GOAL_HALF - 0.6)
      const ax = gx
      const az = tz - b.z
      const l = Math.hypot(ax, az)
      const dl = Math.hypot(dx, dz)
      dx = dx / dl * 0.1 + ax / l * 0.9
      dz = dz / dl * 0.1 + az / l * 0.9
      st.shots++
    }
    kick(me, dx, dz, 13 + power01 * 11, 1 + power01 * 4)
    return true
  }

  function pressKick() {
    if (state === 'intro' || state === 'finish') return start()
    if (state !== 'play' && state !== 'goal') return
    if (st.charge < 0) st.charge = 0
  }
  function releaseKick() {
    if (!st || st.charge < 0) return
    const power = Math.min(1, st.charge / 0.7)
    st.charge = -1
    if (state !== 'play') return
    if (!humanKick(power)) {
      st.buffer = 0.3 // le ballon arrive : on frappe dès qu'il est à portée
      st.bufferPower = power
    }
  }

  function moveInput() {
    let x = (keys.right ? 1 : 0) - (keys.left ? 1 : 0) + touch.x
    let z = (keys.down ? 1 : 0) - (keys.up ? 1 : 0) + touch.z
    const l = Math.hypot(x, z)
    if (l > 1) {
      x /= l
      z /= l
    }
    return { x, z, l: Math.min(1, l) }
  }

  function steer(p, tx, tz, speed, dt) {
    const dx = tx - p.x
    const dz = tz - p.z
    const d = Math.hypot(dx, dz)
    const want = d < 0.15 ? 0 : Math.min(speed, d * 3)
    const wx = d ? (dx / d) * want : 0
    const wz = d ? (dz / d) * want : 0
    const k = 1 - Math.exp(-dt * 7)
    p.vx += (wx - p.vx) * k
    p.vz += (wz - p.vz) * k
  }

  // Cerveau des joueurs de champ contrôlés par l'ordinateur.
  function fieldAI(p, dt, chaser) {
    const b = st.ball
    const s = dirOf(p.team)
    const gx = goalOf(p.team)
    const speed = p.team ? 4.7 : 5.1
    if (p.wait > 0) {
      p.wait -= dt
      steer(p, p.x, p.z, 0, dt)
      return
    }
    if (b.held) {
      // Le gardien a le ballon : on se replace.
      steer(p, clamp(p.home[0] + s * 4, -HL + 3, HL - 3), p.home[1], speed * 0.7, dt)
      return
    }
    if (!chaser) {
      // Soutien : en avant du ballon quand on attaque, entre le ballon et notre but sinon.
      const ownHalf = (b.x - 0) * s < -3
      const tx = ownHalf ? (b.x + goalOf(1 - p.team)) / 2 + s * 2 : clamp(b.x + s * 6, -HL + 4, HL - 4)
      const tz = ownHalf ? b.z * 0.5 : clamp(p.home[1] * 1.1 + b.z * 0.3, -HW + 2, HW - 2)
      steer(p, tx, tz, speed * 0.8, dt)
      return
    }
    // Chasseur : se placer derrière le ballon, dans l'axe du but adverse.
    let ax = gx - b.x
    let az = -b.z
    const al = Math.hypot(ax, az) || 1
    ax /= al
    az /= al
    const rx = p.x - b.x
    const rz = p.z - b.z
    const ahead = rx * ax + rz * az // > 0 : on est du mauvais côté du ballon
    const dist = Math.hypot(rx, rz)
    let tx = b.x + b.vx * 0.25 - ax * 0.5
    let tz = b.z + b.vz * 0.25 - az * 0.5
    if (ahead > 0.2 && dist < 3) {
      // Contourner le ballon par le côté.
      const side = rx * -az + rz * ax > 0 ? 1 : -1
      tx = b.x - ax * 1.2 - az * side * 1.1
      tz = b.z - az * 1.2 + ax * side * 1.1
    }
    steer(p, clamp(tx, -HL + 0.4, HL - 0.4), clamp(tz, -HW + 0.4, HW - 0.4), speed, dt)
    if (dist < 0.95 && p.cd <= 0 && b.y < 1) {
      const goalDist = Math.abs(gx - b.x)
      const mate = players.find((m) => m.team === p.team && m.role === 'field' && m !== p)
      const mateAhead = mate && (mate.x - p.x) * s > 3
      if (goalDist < (p.team ? 10 : 11) && Math.abs(b.z) < 9) {
        // Tir, avec une imprécision qui laisse une chance au gardien.
        const tzGoal = rand(-GOAL_HALF + 0.3, GOAL_HALF - 0.3) + rand(-1.4, 1.4)
        kick(p, gx - b.x, tzGoal - b.z, rand(13, 17), rand(0.5, 3))
        if (!p.team) st.shots++
      } else if (mateAhead && Math.random() < 0.35) {
        const px = mate.x + mate.vx * 0.5 - b.x
        const pz = mate.z + mate.vz * 0.5 - b.z
        kick(p, px, pz, clamp(Math.hypot(px, pz) * 1.1 + 4, 8, 16), 0.5)
        p.cd = 0.8
        if (!p.team) pop('Passe !', 'good')
      } else {
        // Conduite de balle : petite touche vers l'avant.
        kick(p, ax + rand(-0.2, 0.2), az + rand(-0.2, 0.2), speed * 1.35)
        p.cd = 0.3
      }
    }
  }

  // Gardien : suit le ballon sur sa ligne, sort sur les ballons lents, capte ou relâche les tirs.
  function keeperAI(p, dt) {
    const b = st.ball
    const lineX = p.home[0]
    const s = dirOf(p.team)
    if (b.held === p) {
      p.hold -= dt
      steer(p, lineX + s * 1.5, 0, 2, dt)
      b.x = p.x + s * 0.5
      b.z = p.z
      b.y = 0.9
      if (p.hold <= 0) {
        // Relance vers un coéquipier.
        const mates = players.filter((m) => m.team === p.team && m.role === 'field')
        const m = mates[Math.floor(Math.random() * mates.length)]
        b.y = 1
        kick(p, m.x + s * 3 - b.x, m.z - b.z, clamp(Math.hypot(m.x - b.x, m.z - b.z) * 0.9 + 5, 9, 17), 4)
        p.cd = 1
      }
      return
    }
    const nearGoal = Math.abs(b.x - lineX) < 5 && Math.abs(b.z) < 6
    const slow = Math.hypot(b.vx, b.vz) < 4
    let tx = lineX
    let tz = clamp(b.z * 0.7, -GOAL_HALF + 0.3, GOAL_HALF - 0.3)
    if (nearGoal && slow) {
      tx = b.x
      tz = b.z
    } else if ((b.vx * -s) > 6) {
      // Tir vers le but : on anticipe le point d'arrivée.
      const tHit = Math.abs(lineX - b.x) / Math.abs(b.vx)
      tz = clamp(b.z + b.vz * tHit, -GOAL_HALF - 0.2, GOAL_HALF + 0.2)
    }
    steer(p, tx, tz, p.team ? 4.2 : 4.6, dt)
    p.x = clamp(p.x, s < 0 ? HL - 6 : -HL - 0.3, s < 0 ? HL + 0.3 : -HL + 6)
    const d = Math.hypot(b.x - p.x, b.z - p.z)
    if (d < 1.05 && b.y < 2 && p.cd <= 0 && b.noSave <= 0) {
      const fast = Math.hypot(b.vx, b.vz)
      const chance = fast > 9 ? (p.team ? 0.45 : 0.7) : 0.95
      if (Math.random() < chance) {
        b.held = p
        b.vx = b.vz = b.vy = 0
        p.hold = 0.8
        st.lastTouch = p
        if (fast > 9) {
          if (p.team) pop('Arrêt du gardien !', 'bad')
          else {
            st.saves++
            pop('Quel arrêt !', 'good')
          }
          sfx?.blip?.('locked')
        }
      } else b.noSave = 0.6
    }
  }

  function step(dt) {
    const b = st.ball
    const me = players[0]
    // Toi.
    const mv = moveInput()
    const sprint = keys.sprint || (touch.id !== null && mv.l > 0.95)
    const top = sprint ? 8.2 : 6.2
    const k = 1 - Math.exp(-dt * 10)
    // Au coup d'envoi adverse, tu attends un instant hors du rond.
    const go = me.wait > 0 ? 0 : 1
    if (me.wait > 0) me.wait -= dt
    me.vx += (mv.x * top * go - me.vx) * k
    me.vz += (mv.z * top * go - me.vz) * k
    if (st.charge >= 0) st.charge += dt
    if (st.buffer > 0) {
      st.buffer -= dt
      if (humanKick(st.bufferPower)) st.buffer = 0
    }
    // Chasseur de chaque équipe : le plus proche du ballon (ton coéquipier te laisse le ballon s'il est loin).
    const dist = (p) => Math.hypot(p.x - b.x, p.z - b.z)
    const mate = players[1]
    const mateChase = dist(mate) < dist(me) - 1.5
    const cpuField = players.filter((p) => p.team === 1 && p.role === 'field')
    const cpuChaser = dist(cpuField[0]) < dist(cpuField[1]) ? cpuField[0] : cpuField[1]
    for (const p of players) {
      p.cd -= dt
      if (p.human) continue
      if (p.role === 'gk') keeperAI(p, dt)
      else fieldAI(p, dt, p.team ? p === cpuChaser : mateChase)
    }
    for (const p of players) {
      p.x = clamp(p.x + p.vx * dt, -HL - 1, HL + 1)
      p.z = clamp(p.z + p.vz * dt, -HW - 0.5, HW + 0.5)
    }
    // Les joueurs ne se traversent pas.
    for (let i = 0; i < players.length; i++) {
      for (let j = i + 1; j < players.length; j++) {
        const a = players[i]
        const c = players[j]
        const dx = c.x - a.x
        const dz = c.z - a.z
        const d = Math.hypot(dx, dz)
        if (d > 0 && d < 0.8) {
          const push = (0.8 - d) / 2
          a.x -= (dx / d) * push
          a.z -= (dz / d) * push
          c.x += (dx / d) * push
          c.z += (dz / d) * push
        }
      }
    }
    // Conduite de balle : en courant sur le ballon, tu le pousses devant toi.
    if (!b.held && b.y < 0.8) {
      const dx = b.x - me.x
      const dz = b.z - me.z
      const d = Math.hypot(dx, dz)
      const sp = Math.hypot(me.vx, me.vz)
      if (d < 0.8 && sp > 1 && dx * me.vx + dz * me.vz > 0) {
        const bs = b.vx * me.vx + b.vz * me.vz
        if (bs < sp * sp * 1.15) {
          b.vx = me.vx * 1.3
          b.vz = me.vz * 1.3
          st.lastTouch = me
        }
      }
    }
    // Contacts : le ballon rebondit sur les joueurs.
    if (!b.held && b.y < 1.6) {
      for (const p of players) {
        const dx = b.x - p.x
        const dz = b.z - p.z
        const d = Math.hypot(dx, dz)
        if (d > 0 && d < 0.5) {
          const nx = dx / d
          const nz = dz / d
          b.x = p.x + nx * 0.5
          b.z = p.z + nz * 0.5
          const vn = (b.vx - p.vx) * nx + (b.vz - p.vz) * nz
          if (vn < 0) {
            b.vx -= 1.5 * vn * nx
            b.vz -= 1.5 * vn * nz
          }
          st.lastTouch = p
        }
      }
    }
    // Visage tourné dans le sens de la course.
    for (const p of players) {
      if (Math.hypot(p.vx, p.vz) > 0.4) p.face = Math.atan2(p.vx, p.vz)
      else if (!p.human) p.face = Math.atan2(b.x - p.x, b.z - p.z)
    }
    ballPhysics(dt)
  }

  function ballPhysics(dt) {
    const b = st.ball
    if (b.held) return
    b.noSave -= dt
    b.vy -= 18 * dt
    b.x += b.vx * dt
    b.y += b.vy * dt
    b.z += b.vz * dt
    if (b.y <= BALL_R) {
      b.y = BALL_R
      b.vy = b.vy < -1.5 ? -b.vy * 0.45 : 0
      // Frottement de la pelouse.
      const f = Math.exp(-dt * 0.9)
      b.vx *= f
      b.vz *= f
      const sp = Math.hypot(b.vx, b.vz)
      if (sp > 0) {
        const n = Math.max(0, sp - 1.6 * dt) / sp
        b.vx *= n
        b.vz *= n
      }
    }
    // Dans les filets.
    if (b.inGoal) {
      const s = b.inGoal
      if (b.x * s > HL + GOAL_D - BALL_R) {
        b.x = s * (HL + GOAL_D - BALL_R)
        b.vx *= -0.15
        b.vz *= 0.4
      }
      if (Math.abs(b.z) > GOAL_HALF - BALL_R) {
        b.z = Math.sign(b.z) * (GOAL_HALF - BALL_R)
        b.vz *= -0.3
      }
      if (b.y > GOAL_H - BALL_R) {
        b.y = GOAL_H - BALL_R
        b.vy = -Math.abs(b.vy) * 0.3
      }
      return
    }
    // Ligne de but : but si le ballon passe entre les poteaux, sous la barre.
    if (Math.abs(b.x) > HL) {
      const s = Math.sign(b.x)
      if (Math.abs(b.z) < GOAL_HALF - 0.05 && b.y < GOAL_H) {
        b.inGoal = s
        goal(s > 0 ? 0 : 1)
        return
      }
      // Sinon, rebond sur les panneaux (pas de touche ni de corner).
      b.x = s * HL
      b.vx = -b.vx * 0.6
      if (Math.abs(Math.abs(b.z) - GOAL_HALF) < 0.25) sfx?.blip?.('door') // poteau !
    }
    if (Math.abs(b.z) > HW) {
      b.z = Math.sign(b.z) * HW
      b.vz = -b.vz * 0.6
    }
  }

  function goal(team) {
    if (state !== 'play') return
    state = 'goal'
    st.goalT = 2.8
    if (team === 0) st.me++
    else st.cpu++
    st.scorer = team
    sfx?.goal?.()
    const own = st.lastTouch && st.lastTouch.team !== team
    const who = own ? 'contre son camp' : team === 0 ? (st.lastTouch?.human ? 'Superbe frappe !' : 'Pour ton équipe !') : 'L\'équipe violette marque…'
    const el = $('.foot-goal')
    el.querySelector('small').textContent = `${who} · ${st.me} – ${st.cpu}`
    el.className = `foot-goal show ${team ? 'cpu' : 'me'}`
    for (const p of players) p.cheer = p.team === team ? 2.6 : 0
    crowd.cheer = 2.6
    crowd.side = team ? -1 : 1
    updateHud()
  }

  function finish() {
    state = 'finish'
    ui.classList.remove('running')
    st.charge = -1
    const won = st.me > st.cpu
    const draw = st.me === st.cpu
    const bonus = won ? 500 : draw ? 150 : 0
    const score = Math.max(0, st.me * 300 - st.cpu * 100 + bonus)
    const rank = rewards?.record(FOOT_GAME, score) ?? 0
    const [gold, silver] = FOOT_GAME.medals
    const medal = score >= gold ? '🥇 Médaille d\'or' : score >= silver ? '🥈 Médaille d\'argent' : '🥉 Médaille de bronze'
    $('.foot-medal').textContent = `${medal} · ${score} pts`
    $('.foot-final').innerHTML = `${won ? '🏆 Victoire' : draw ? '🤝 Match nul' : '😤 Défaite'} <b>${st.me} – ${st.cpu}</b>`
    $('.foot-score-list').innerHTML = [
      ['Buts marqués', `${st.me} · +${st.me * 300} pts`],
      ['Buts encaissés', st.cpu ? `${st.cpu} · −${st.cpu * 100} pts` : 'aucun 🧤'],
      [won ? 'Bonus victoire' : 'Bonus match nul', won || draw ? `+${bonus} pts` : '—'],
      ['Tirs · arrêts', `${st.shots} tir${st.shots > 1 ? 's' : ''} · ${st.saves} arrêt${st.saves > 1 ? 's' : ''}`],
    ].map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')
    $('.foot-board-lines').textContent = rewards ? `Classement sur cet appareil\n${rewards.lines(FOOT_GAME, rank).join('\n')}` : ''
    rewards?.globalBoard?.(FOOT_GAME).then((lines) => {
      if (lines?.length) $('.foot-board-lines').textContent += `\n\n🌍 Classement mondial\n${lines.join('\n')}`
    })
    $('.foot-result').hidden = false
    $('.foot-count').textContent = ''
    $('.foot-pop').classList.remove('show')
    if (rank === 1 || won) sfx?.fanfare?.()
    else sfx?.jingle?.()
    for (const p of players) p.cheer = won ? (p.team ? 0 : 99) : draw ? 0 : p.team ? 99 : 0
    onFinish?.(score, st, won)
  }

  function updateHud() {
    $('.foot-score').textContent = `${st.me} – ${st.cpu}`
    $('.foot-clock').textContent = `${Math.min(90, Math.floor((st.time / MATCH) * 90))}'`
    const ch = $('.foot-charge')
    ch.classList.toggle('show', st.charge >= 0 && state === 'play')
    if (st.charge >= 0) ch.firstElementChild.style.transform = `scaleX(${Math.min(1, st.charge / 0.7)})`
  }

  // ---------- Affichage ----------
  function placePlayer(p, dt) {
    p.obj.position.set(p.x, 0, p.z)
    let diff = p.face - p.obj.rotation.y
    diff = Math.atan2(Math.sin(diff), Math.cos(diff))
    p.obj.rotation.y += dt ? diff * Math.min(1, dt * 12) : diff
    const sp = Math.hypot(p.vx, p.vz)
    if (p.cheer > 0) {
      p.cheer -= dt
      play(p, 'Cheer')
    } else if (p.role === 'gk' && st?.ball.held === p) play(p, 'Interact')
    else if (sp > 3.2) play(p, 'Running_A', sp / 6)
    else if (sp > 0.5) play(p, 'Walking_A', Math.max(0.6, sp / 2))
    else play(p, 'Idle')
    p.mixer.update(dt)
    if (p.marker) p.marker.position.y = 2.3 + Math.sin(performance.now() / 200) * 0.08
  }

  function placeBall(dt) {
    const b = st.ball
    ball.position.set(b.x, b.y, b.z)
    const sp = Math.hypot(b.vx, b.vz)
    if (sp > 0.05 && dt) ball.rotateOnWorldAxis(axis.set(b.vz / sp, 0, -b.vx / sp), (sp * dt) / BALL_R)
    const sh = ball.userData.shadow
    sh.position.set(b.x, 0.03, b.z)
    sh.scale.setScalar(Math.max(0.15, 0.35 - (b.y - BALL_R) * 0.05))
  }
  const axis = new THREE.Vector3()

  const m4 = new THREE.Matrix4()
  function updateCrowd(dt, t) {
    if (crowd.cheer > 0) crowd.cheer -= dt
    const { seats, phase, fans } = crowd
    for (let i = 0; i < seats.length; i++) {
      const [x, y, z] = seats[i]
      // Les supporters de l'équipe qui marque sautent de joie.
      const cheer = crowd.cheer > 0 && fans[i] === crowd.side
      const hop = cheer ? Math.abs(Math.sin(t * 9 + phase[i])) * 0.45 : Math.max(0, Math.sin(t * 2 + phase[i])) * 0.06
      m4.makeTranslation(x, y + hop, z)
      crowd.bodies.setMatrixAt(i, m4)
      crowd.heads.setMatrixAt(i, m4)
    }
    crowd.bodies.instanceMatrix.needsUpdate = true
    crowd.heads.instanceMatrix.needsUpdate = true
  }

  // Caméra « télé » : vue de côté inclinée (~50°), qui suit le ballon en douceur.
  const camPos = new THREE.Vector3()
  const look = new THREE.Vector3()
  const lookAt = new THREE.Vector3()
  function updateCamera(dt) {
    const b = st.ball
    const portrait = innerHeight > innerWidth
    const span = portrait ? HL - 3 : HL - 9
    const tx = clamp(b.x, -span, span)
    const tz = clamp(b.z * 0.55, -6, 6)
    const H = portrait ? 21 : 18
    const D = portrait ? 18 : 15.5
    const k = 1 - Math.exp(-dt * 3)
    camPos.lerp(look.set(tx, H, tz + D), dt ? k : 1)
    lookAt.lerp(look.set(tx, 0, tz - 1), dt ? k : 1)
    camera.position.copy(camPos)
    camera.lookAt(lookAt)
  }

  const onKey = (down) => (e) => {
    if (!active) return
    const map = { ArrowLeft: 'left', KeyA: 'left', KeyQ: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'up', KeyW: 'up', KeyZ: 'up', ArrowDown: 'down', KeyS: 'down', ShiftLeft: 'sprint', ShiftRight: 'sprint' }
    const k = map[e.code]
    if (k) {
      keys[k] = down
      e.preventDefault()
      e.stopImmediatePropagation()
      return
    }
    if (e.code === 'Space') {
      e.preventDefault()
      e.stopImmediatePropagation()
      if (down && !e.repeat) pressKick()
      else if (!down) releaseKick()
      return
    }
    if (!down) return
    if (e.code === 'Escape') {
      e.stopImmediatePropagation()
      api.close()
    } else if (e.code === 'Enter' || e.code === 'KeyE') {
      e.preventDefault()
      e.stopImmediatePropagation()
      if (state === 'intro' || state === 'finish') start()
    }
  }
  window.addEventListener('keydown', onKey(true), true)
  window.addEventListener('keyup', onKey(false), true)

  const api = {
    get active() {
      return active
    },
    open(intro = null) {
      if (!built) build()
      active = true
      reset()
      state = 'intro'
      $('.foot-text').textContent = intro?.text ?? ''
      const best = rewards?.best(FOOT_GAME)
      $('.foot-best').textContent = best === undefined ? 'Premier match : à toi de fixer le record !' : `Ton record : ${best} pts`
      $('.foot-intro').hidden = false
      $('.foot-result').hidden = true
      $('.foot-count').textContent = ''
      $('.foot-goal').classList.remove('show')
      ui.classList.remove('running')
      document.body.classList.add('foot-open')
      requestAnimationFrame(() => ui.classList.add('visible'))
      api.resize()
      updateCamera(0)
    },
    close() {
      if (!active) return
      for (const k in keys) keys[k] = false
      touch.x = touch.z = 0
      touch.id = null
      if (st) st.charge = -1
      onExit?.(() => {
        active = false
        ui.classList.remove('visible', 'running')
        document.body.classList.remove('foot-open')
      })
    },
    resize() {
      if (!camera) return
      camera.aspect = innerWidth / innerHeight
      camera.fov = innerHeight > innerWidth ? 68 : 54
      camera.updateProjectionMatrix()
    },
    update(dt, t) {
      if (!active) return
      dt = Math.min(dt, 0.05)
      if (state === 'countdown') {
        const before = Math.ceil(st.count)
        st.count -= dt
        const now = Math.ceil(st.count)
        if (now !== before) sfx?.blip?.(now > 0 ? 'tick' : 'open')
        if (st.count > 0) $('.foot-count').textContent = now
        else {
          $('.foot-count').textContent = 'Coup d\'envoi !'
          st.goT = 0.9
          state = 'play'
        }
      }
      if (st.goT > 0 && (st.goT -= dt) <= 0 && state !== 'end') $('.foot-count').textContent = ''
      if (state === 'play') {
        step(dt)
        st.time += dt
        if (st.time >= MATCH) {
          state = 'end'
          st.endT = 1.6
          st.charge = -1
          sfx?.blip?.('close')
          $('.foot-count').textContent = 'Fin du match !'
        }
        updateHud()
      } else if (state === 'goal') {
        // Célébration : le ballon finit sa course dans les filets, les joueurs ralentissent.
        for (const p of players) {
          p.vx *= 1 - Math.min(1, dt * 4)
          p.vz *= 1 - Math.min(1, dt * 4)
          p.x += p.vx * dt
          p.z += p.vz * dt
        }
        ballPhysics(dt)
        if ((st.goalT -= dt) <= 0) {
          $('.foot-goal').classList.remove('show')
          kickoff(st.scorer === 0 ? 1 : 0)
          state = 'play'
        }
      } else if (state === 'end') {
        for (const p of players) {
          p.vx *= 1 - Math.min(1, dt * 4)
          p.vz *= 1 - Math.min(1, dt * 4)
        }
        ballPhysics(dt)
        if ((st.endT -= dt) <= 0) finish()
      } else if (state === 'finish') {
        ballPhysics(dt)
      }
      for (const p of players) placePlayer(p, dt)
      placeBall(dt)
      updateCrowd(dt, t)
      updateCamera(dt)
    },
    render() {
      renderer.render(scene, camera)
    },
    // Pour les tests (?debug) : état du match.
    debug: () => ({
      state,
      st,
      ball: st?.ball,
      players: players.map((p) => ({ key: p.key, team: p.team, role: p.role, human: p.human, x: p.x, z: p.z })),
      keys,
    }),
  }
  return api
}
