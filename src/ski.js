import * as THREE from 'three'
import { character } from './world/characters.js'
import { animate } from './world/models.js'

// Descente de ski : depuis le panneau « Ski » de l'île du Passé, on part sur une vraie piste
// en pente. Gauche / droite pour tourner, bas pour se mettre en boule (plus vite), haut pour
// freiner. On gagne des points en passant entre les portes et en ramassant les étoiles ;
// le temps restant sous le temps de référence donne un bonus.

const L = 430 // longueur de la piste
const SLOPE = 0.22
const HALF = 17 // demi-largeur skiable
const GATES = 14
const GATE_GAP = 26
const GATE_W = 2.2
const PAR = 42 // temps de référence (s)
export const SKI_GAME = { id: 'ski', title: 'Descente de ski', score: true, medals: [1900, 1300] }

// Petit générateur pseudo-aléatoire : la piste est la même à chaque descente.
function rng(seed) {
  let s = seed
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

export function heightAt(x, z) {
  const base = SLOPE * z + Math.sin(z * 0.045) * 1.6 + Math.sin(z * 0.11 + 1) * 0.5
  const ax = Math.abs(x)
  const bank = ax > HALF ? (ax - HALF) ** 1.35 * 0.55 : 0
  return base + bank + Math.sin(x * 0.35 + z * 0.05) * 0.18
}

function bannerTexture(text, from, to) {
  const c = document.createElement('canvas')
  c.width = 1024
  c.height = 84
  const g = c.getContext('2d')
  const grad = g.createLinearGradient(0, 0, 1024, 0)
  grad.addColorStop(0, from)
  grad.addColorStop(1, to)
  g.fillStyle = grad
  g.fillRect(0, 0, 1024, 84)
  g.fillStyle = '#1a1530'
  g.font = '700 54px "Outfit Variable", system-ui, sans-serif'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  for (const x of [170, 512, 854]) g.fillText(text, x, 46)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

export function createSki({ renderer, sfx, rewards, getCharacter, onExit, onFinish }) {
  let built = false
  let active = false
  let scene, camera, skier, mixer, ui
  const course = { gates: [], stars: [], rocks: [] }
  const keys = { left: false, right: false, up: false, down: false }
  const touch = { left: false, right: false }
  let state = 'intro'
  let st = null
  let charKey = null

  // ---------- Construction de la piste ----------
  function build() {
    built = true
    scene = new THREE.Scene()
    scene.background = new THREE.Color(0x2c2160)
    scene.fog = new THREE.Fog(0x3a2d72, 40, 150)
    camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 400)
    scene.add(new THREE.HemisphereLight(0xdcd6ff, 0x6a5aa8, 1.3))
    const sun = new THREE.DirectionalLight(0xffe2c0, 1.6)
    sun.position.set(-30, 60, 20)
    scene.add(sun)

    // Neige : pente en facettes, damée au milieu, bourrelets sur les côtés.
    const geo = new THREE.PlaneGeometry(64, L + 90, 32, 130).toNonIndexed()
    geo.rotateX(-Math.PI / 2)
    geo.translate(0, 0, -L / 2 + 10)
    const pos = geo.attributes.position
    for (let i = 0; i < pos.count; i++) pos.setY(i, heightAt(pos.getX(i), pos.getZ(i)))
    const colors = new Float32Array(pos.count * 3)
    const c = new THREE.Color()
    const r = rng(7)
    for (let f = 0; f < pos.count; f += 3) {
      const cx = (pos.getX(f) + pos.getX(f + 1) + pos.getX(f + 2)) / 3
      const cz = (pos.getZ(f) + pos.getZ(f + 1) + pos.getZ(f + 2)) / 3
      const side = Math.abs(cx) > HALF
      const groom = !side && Math.sin(cx * 1.6) > 0.6
      c.setHex(side ? 0xd9d4f2 : groom ? 0xffffff : 0xf1efff)
      c.offsetHSL(0, 0, (r() - 0.5) * 0.04 + (Math.sin(cz * 0.3) > 0.95 ? -0.04 : 0))
      for (let k = 0; k < 3; k++) colors.set([c.r, c.g, c.b], (f + k) * 3)
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    geo.computeVertexNormals()
    scene.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95 })))

    // Sapins le long de la piste (instanciés : un seul appel de dessin par étage).
    const rand = rng(42)
    const trees = []
    for (let i = 0; i < 170; i++) {
      const sideX = (rand() < 0.5 ? -1 : 1) * (HALF + 2 + rand() * 13)
      trees.push([sideX, 20 - rand() * (L + 70), 0.8 + rand() * 0.9])
    }
    const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.18, 0.25, 1, 6), new THREE.MeshStandardMaterial({ color: 0x5a3a2a, flatShading: true }), trees.length)
    const leaves = [0, 1, 2].map((k) => new THREE.InstancedMesh(new THREE.ConeGeometry(1.5 - k * 0.38, 1.7, 7), new THREE.MeshStandardMaterial({ color: [0x2f6b5a, 0x3a8068, 0x4a9a78][k], flatShading: true }), trees.length))
    const caps = new THREE.InstancedMesh(new THREE.ConeGeometry(0.55, 0.6, 7), new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true }), trees.length)
    const m4 = new THREE.Matrix4()
    trees.forEach(([x, z, s], i) => {
      const y = heightAt(x, z)
      m4.makeScale(s, s, s).setPosition(x, y + 0.5 * s, z)
      trunk.setMatrixAt(i, m4)
      leaves.forEach((mesh, k) => {
        m4.makeScale(s, s, s).setPosition(x, y + (1.5 + k * 1.05) * s, z)
        mesh.setMatrixAt(i, m4)
      })
      m4.makeScale(s, s, s).setPosition(x, y + 4.15 * s, z)
      caps.setMatrixAt(i, m4)
    })
    scene.add(trunk, ...leaves, caps)

    // Portes de slalom : deux piquets et un fanion, rouge et bleu en alternance.
    const g = rng(11)
    const poleGeo = new THREE.CylinderGeometry(0.07, 0.07, 1.9, 6)
    const flagGeo = new THREE.PlaneGeometry(1.2, 0.7)
    for (let i = 0; i < GATES; i++) {
      const z = -40 - i * GATE_GAP
      const x = (i % 2 ? 1 : -1) * (2.5 + g() * 6)
      const color = i % 2 ? 0x3b6dff : 0xff4a6a
      const gate = new THREE.Group()
      const pm = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.25, flatShading: true })
      for (const dx of [-GATE_W, GATE_W]) {
        const p = new THREE.Mesh(poleGeo, pm)
        p.position.set(x + dx, heightAt(x + dx, z) + 0.95, z)
        gate.add(p)
      }
      const flag = new THREE.Mesh(flagGeo, new THREE.MeshStandardMaterial({ color, side: THREE.DoubleSide, flatShading: true }))
      flag.position.set(x, heightAt(x, z) + 1.55, z)
      flag.scale.x = (GATE_W * 2) / 1.2
      gate.add(flag)
      scene.add(gate)
      course.gates.push({ x, z, gate, flag, done: false })
    }
    // Étoiles entre les portes, et rochers à éviter.
    const starGeo = new THREE.OctahedronGeometry(0.45, 0)
    const starMat = new THREE.MeshStandardMaterial({ color: 0xffd27a, emissive: 0xffb347, emissiveIntensity: 0.8, flatShading: true })
    const rockGeo = new THREE.IcosahedronGeometry(1.1, 0)
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x8f88c8, flatShading: true })
    for (let i = 0; i < GATES - 1; i++) {
      const a = course.gates[i]
      const b = course.gates[i + 1]
      const z = (a.z + b.z) / 2
      const x = (a.x + b.x) / 2
      const star = new THREE.Mesh(starGeo, starMat)
      star.position.set(x, heightAt(x, z) + 1.1, z)
      scene.add(star)
      course.stars.push({ x, z, mesh: star, done: false })
      const rx = (a.x > 0 ? -1 : 1) * (9 + g() * 5)
      const rock = new THREE.Mesh(rockGeo, rockMat)
      rock.position.set(rx, heightAt(rx, z - 4) + 0.4, z - 4)
      rock.rotation.set(g() * 3, g() * 3, 0)
      rock.scale.set(1.2, 0.8, 1)
      scene.add(rock)
      course.rocks.push({ x: rx, z: z - 4, r: 1.4 })
    }
    // Arches de départ et d'arrivée.
    const arch = (z, text, from, to) => {
      const y = heightAt(0, z)
      const grp = new THREE.Group()
      const pm = new THREE.MeshStandardMaterial({ color: 0x3d3378, flatShading: true })
      for (const x of [-HALF - 1.5, HALF + 1.5]) {
        const p = new THREE.Mesh(new THREE.BoxGeometry(0.8, 6, 0.8), pm)
        p.position.set(x, heightAt(x, z) + 3, z)
        grp.add(p)
      }
      const banner = new THREE.Mesh(new THREE.PlaneGeometry(HALF * 2 + 3.6, 3), new THREE.MeshBasicMaterial({ map: bannerTexture(text, from, to), side: THREE.DoubleSide }))
      banner.position.set(0, y + 6.4, z)
      grp.add(banner)
      scene.add(grp)
    }
    arch(2, 'DÉPART', '#ffd27a', '#ffb347')
    arch(-L + 22, 'ARRIVÉE', '#b48cff', '#8fe3ff')

    // Flocons de neige.
    const flakes = new THREE.BufferGeometry()
    const fp = new Float32Array(900 * 3)
    for (let i = 0; i < 900; i++) fp.set([(Math.random() - 0.5) * 70, Math.random() * 30, (Math.random() - 0.5) * 70], i * 3)
    flakes.setAttribute('position', new THREE.BufferAttribute(fp, 3))
    const snow = new THREE.Points(flakes, new THREE.PointsMaterial({ color: 0xffffff, size: 0.12, transparent: true, opacity: 0.85 }))
    scene.add(snow)
    scene.userData.snow = snow

    buildUI()
  }

  function makeSkier() {
    const key = getCharacter?.() ?? 'rogue'
    if (skier && charKey === key) return
    if (skier) scene.remove(skier)
    charKey = key
    skier = new THREE.Group()
    const body = character(key, { height: 1.7, keep: key === 'knight' ? ['Knight_Helmet'] : key === 'mage' ? ['Mage_Hat'] : key === 'barbarian' ? ['Barbarian_Hat'] : [] })
    // Groupe intermédiaire pour pencher et accroupir le skieur sans toucher à l'échelle du modèle.
    const pose = new THREE.Group()
    pose.add(body)
    skier.add(pose)
    skier.userData.body = pose
    const anim = animate(body, 'Idle')
    mixer = anim.mixer
    // Skis et bâtons.
    const skiMat = new THREE.MeshStandardMaterial({ color: 0xff6f9f, flatShading: true })
    for (const sx of [-0.17, 0.17]) {
      const s = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.05, 1.8), skiMat)
      s.position.set(sx, 0.03, 0.1)
      skier.add(s)
      const tip = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.05, 0.25), skiMat)
      tip.position.set(sx, 0.09, 1.02)
      tip.rotation.x = -0.5
      skier.add(tip)
    }
    const poleMat = new THREE.MeshStandardMaterial({ color: 0xdddddd })
    for (const sx of [-0.55, 0.55]) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.2, 5), poleMat)
      p.position.set(sx, 0.55, -0.25)
      p.rotation.x = 0.5
      skier.add(p)
    }
    scene.add(skier)
  }

  // ---------- Interface ----------
  function buildUI() {
    ui = document.createElement('div')
    ui.className = 'ski'
    ui.innerHTML = `
      <div class="ski-top">
        <div class="ski-hud">
          <span><small>Temps</small><b class="ski-time">0.0 s</b></span>
          <span><small>Vitesse</small><b class="ski-speed">0 km/h</b></span>
          <span><small>Portes</small><b class="ski-gates">0 / ${GATES}</b></span>
          <span><small>Points</small><b class="ski-points">0</b></span>
        </div>
        <button class="btn ski-close" type="button">✕ Sortir</button>
      </div>
      <div class="ski-pop"></div>
      <div class="ski-count"></div>
      <section class="ski-card ski-intro">
        <span class="ski-kicker">Ma passion</span>
        <h2>⛷️ Descente de ski</h2>
        <p class="ski-text"></p>
        <ul>
          <li>⬅️ ➡️ (ou Q / D) pour tourner, ⬇️ pour te mettre en boule, ⬆️ pour freiner.</li>
          <li>Sur téléphone : appuie à gauche ou à droite de l'écran.</li>
          <li>Passe entre les piquets : +100 points, et un bonus si tu les enchaînes. Une porte ratée coûte 2 secondes.</li>
          <li>Les étoiles valent 25 points. Évite les rochers !</li>
        </ul>
        <div class="ski-best"></div>
        <button class="btn primary big ski-go" type="button">Partir !</button>
      </section>
      <section class="ski-card ski-result" hidden>
        <span class="ski-kicker">Arrivée</span>
        <h2 class="ski-medal"></h2>
        <dl class="ski-score"></dl>
        <pre class="ski-board"></pre>
        <div class="ski-actions">
          <button class="btn primary ski-again" type="button">↻ Rejouer</button>
          <button class="btn ski-leave" type="button">Sortir</button>
        </div>
      </section>
      <button class="ski-touch left" type="button" aria-label="Tourner à gauche">◀</button>
      <button class="ski-touch right" type="button" aria-label="Tourner à droite">▶</button>`
    document.body.append(ui)
    const q = (s) => ui.querySelector(s)
    q('.ski-close').addEventListener('click', () => api.close())
    q('.ski-leave').addEventListener('click', () => api.close())
    q('.ski-go').addEventListener('click', () => start())
    q('.ski-again').addEventListener('click', () => start())
    for (const side of ['left', 'right']) {
      const b = q(`.ski-touch.${side}`)
      const on = (v) => (e) => {
        e.preventDefault()
        touch[side] = v
      }
      b.addEventListener('pointerdown', on(true))
      for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) b.addEventListener(ev, on(false))
    }
  }

  const $ = (s) => ui.querySelector(s)
  function pop(text, kind = '') {
    const el = $('.ski-pop')
    el.textContent = text
    el.className = `ski-pop show ${kind}`
    clearTimeout(pop.t)
    pop.t = setTimeout(() => el.classList.remove('show'), 900)
  }

  function reset() {
    makeSkier()
    for (const gt of course.gates) {
      gt.done = false
      gt.flag.material.opacity = 1
    }
    for (const s of course.stars) {
      s.done = false
      s.mesh.visible = true
    }
    st = { x: 0, z: -2, v: 0, yaw: 0, time: 0, gates: 0, missed: 0, stars: 0, combo: 0, bonus: 0, crashes: 0, crash: 0, count: 3, finished: false, gateIndex: 0, whoosh: 0 }
    placeSkier(0)
    camPos.set(0, heightAt(0, 6) + 5, 8)
  }

  function start() {
    reset()
    state = 'countdown'
    $('.ski-intro').hidden = true
    $('.ski-result').hidden = true
    ui.classList.add('running')
    sfx?.blip?.('open')
  }

  function placeSkier(dt) {
    const y = heightAt(st.x, st.z)
    skier.position.set(st.x, y, st.z)
    // Le skieur descend vers -z : on le tourne dans le sens de la marche.
    skier.rotation.set(0, Math.PI - st.yaw, 0)
    const body = skier.userData.body
    const steer = THREE.MathUtils.clamp(st.yaw / 0.9, -1, 1)
    body.rotation.z = THREE.MathUtils.lerp(body.rotation.z, steer * 0.35, 1 - Math.exp(-dt * 8))
    const tuck = state === 'run' && keys.down ? 0.86 : 1
    body.scale.y = THREE.MathUtils.lerp(body.scale.y, tuck, 1 - Math.exp(-dt * 8))
    if (st.crash > 0) body.rotation.x = Math.sin(st.crash * 18) * 0.3
    else body.rotation.x = THREE.MathUtils.lerp(body.rotation.x, keys.down ? 0.35 : 0.15, 1 - Math.exp(-dt * 6))
  }

  const camPos = new THREE.Vector3()
  const look = new THREE.Vector3()
  function updateCamera(dt) {
    const y = heightAt(st.x, st.z)
    const want = new THREE.Vector3(st.x * 0.75, y + 4.6, st.z + 8.5)
    camPos.lerp(want, 1 - Math.exp(-dt * 5))
    camera.position.copy(camPos)
    look.set(st.x * 0.9, heightAt(st.x, st.z - 8) + 0.6, st.z - 8)
    camera.lookAt(look)
  }

  function finish() {
    state = 'finish'
    ui.classList.remove('running')
    const timeBonus = Math.max(0, Math.round((PAR - st.time) * 20))
    const score = Math.max(0, st.gates * 100 + st.bonus + st.stars * 25 + timeBonus - st.crashes * 50)
    const rank = rewards?.record(SKI_GAME, score) ?? 0
    const [gold, silver] = SKI_GAME.medals
    const medal = score >= gold ? '🥇 Médaille d\'or' : score >= silver ? '🥈 Médaille d\'argent' : '🥉 Médaille de bronze'
    $('.ski-medal').textContent = `${medal} · ${score} pts`
    $('.ski-score').innerHTML = [
      ['Temps', `${st.time.toFixed(1)} s`],
      ['Portes', `${st.gates} / ${GATES} · ${st.gates * 100} pts`],
      ['Enchaînements', `+${st.bonus} pts`],
      ['Étoiles', `${st.stars} · +${st.stars * 25} pts`],
      ['Bonus de temps', `+${timeBonus} pts`],
      ['Chutes', st.crashes ? `${st.crashes} · −${st.crashes * 50} pts` : 'aucune'],
    ].map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')
    $('.ski-board').textContent = rewards ? `Classement sur cet appareil\n${rewards.lines(SKI_GAME, rank).join('\n')}` : ''
    $('.ski-result').hidden = false
    if (rank === 1) sfx?.fanfare?.()
    else sfx?.jingle?.()
    onFinish?.(score, st, score >= gold)
  }

  function step(dt) {
    const steer = (keys.right || touch.right ? 1 : 0) - (keys.left || touch.left ? 1 : 0)
    // Le virage : on pivote vers la direction voulue, en carvant (ça freine un peu).
    const target = steer * 0.95
    st.yaw += (target - st.yaw) * (1 - Math.exp(-dt * 3.2))
    const tuck = keys.down ? 1.3 : 1
    let accel = 9.8 * SLOPE * Math.cos(st.yaw) * tuck
    const drag = 0.01 * st.v * st.v + Math.abs(st.yaw) * 1.6 * (st.v > 4 ? 1 : 0) + (keys.up ? 9 : 0)
    if (st.crash > 0) {
      st.crash -= dt
      accel *= 0.2
    }
    st.v = THREE.MathUtils.clamp(st.v + (accel - drag) * dt, 1.5, 34)
    st.x += Math.sin(st.yaw) * st.v * dt
    st.z -= Math.cos(st.yaw) * st.v * dt
    // Bords de piste : la neige profonde freine et renvoie vers le milieu.
    if (Math.abs(st.x) > HALF - 0.5) {
      st.x = Math.sign(st.x) * (HALF - 0.5)
      st.v *= 0.96
      st.yaw *= 0.5
    }
    st.time += dt
    if (Math.abs(steer) && st.v > 12 && (st.whoosh -= dt) <= 0) {
      st.whoosh = 0.7
      sfx?.blip?.('whoosh')
    }
    // Portes : on vérifie au moment où le skieur passe leur ligne.
    const gt = course.gates[st.gateIndex]
    if (gt && st.z <= gt.z) {
      st.gateIndex++
      if (Math.abs(st.x - gt.x) < GATE_W) {
        st.gates++
        st.combo++
        const bonus = st.combo >= 3 ? (st.combo - 2) * 10 : 0
        st.bonus += bonus
        gt.flag.material.transparent = true
        gt.flag.material.opacity = 0.35
        sfx?.blip?.('coin')
        pop(bonus ? `Porte ! +100 · série ×${st.combo} +${bonus}` : 'Porte ! +100', 'good')
      } else {
        st.combo = 0
        st.missed++
        st.time += 2
        sfx?.blip?.('locked')
        pop('Porte ratée · +2 s', 'bad')
      }
    }
    for (const s of course.stars) {
      if (s.done) continue
      if ((s.x - st.x) ** 2 + (s.z - st.z) ** 2 < 1.6 * 1.6) {
        s.done = true
        s.mesh.visible = false
        st.stars++
        sfx?.blip?.('coin')
        pop('⭐ +25', 'good')
      }
    }
    if (st.crash <= 0) {
      for (const rk of course.rocks) {
        if ((rk.x - st.x) ** 2 + (rk.z - st.z) ** 2 < rk.r * rk.r) {
          st.crash = 0.9
          st.crashes++
          st.v *= 0.35
          st.combo = 0
          sfx?.blip?.('door')
          pop('Aïe, un rocher ! −50', 'bad')
          break
        }
      }
    }
    if (st.z <= -L + 22) finish()
  }

  function updateHud() {
    $('.ski-time').textContent = `${st.time.toFixed(1)} s`
    $('.ski-speed').textContent = `${Math.round(st.v * 3.6)} km/h`
    $('.ski-gates').textContent = `${st.gates} / ${GATES}`
    $('.ski-points').textContent = `${st.gates * 100 + st.bonus + st.stars * 25 - st.crashes * 50}`
  }

  const onKey = (down) => (e) => {
    if (!active) return
    const map = { ArrowLeft: 'left', KeyA: 'left', KeyQ: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'up', KeyW: 'up', KeyZ: 'up', ArrowDown: 'down', KeyS: 'down' }
    const k = map[e.code]
    if (k) {
      keys[k] = down
      e.preventDefault()
      e.stopImmediatePropagation()
      return
    }
    if (!down) return
    if (e.code === 'Escape') {
      e.stopImmediatePropagation()
      api.close()
    } else if (e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyE') {
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
      $('.ski-text').textContent = intro?.text ?? ''
      const best = rewards?.best(SKI_GAME)
      $('.ski-best').textContent = best === undefined ? 'Première descente : à toi de fixer le record !' : `Ton record : ${best} pts`
      $('.ski-intro').hidden = false
      $('.ski-result').hidden = true
      $('.ski-count').textContent = ''
      ui.classList.remove('running')
      document.body.classList.add('ski-open')
      requestAnimationFrame(() => ui.classList.add('visible'))
      api.resize()
    },
    close() {
      if (!active) return
      for (const k in keys) keys[k] = false
      touch.left = touch.right = false
      onExit?.(() => {
        active = false
        ui.classList.remove('visible', 'running')
        document.body.classList.remove('ski-open')
      })
    },
    resize() {
      if (!camera) return
      camera.aspect = innerWidth / innerHeight
      camera.fov = innerHeight > innerWidth ? 72 : 60
      camera.updateProjectionMatrix()
    },
    update(dt, t) {
      if (!active) return
      mixer?.update(dt)
      if (state === 'countdown') {
        const before = Math.ceil(st.count)
        st.count -= dt
        const now = Math.ceil(st.count)
        if (now !== before) sfx?.blip?.(now > 0 ? 'tick' : 'open')
        if (st.count > 0) $('.ski-count').textContent = now
        else {
          $('.ski-count').textContent = 'Go !'
          st.goT = 0.7
          state = 'run'
        }
      }
      if (st.goT > 0 && (st.goT -= dt) <= 0) $('.ski-count').textContent = ''
      if (state === 'run') {
        step(dt)
        updateHud()
      } else if (state === 'finish') {
        // Freinage après l'arrivée.
        st.v = Math.max(0, st.v - 18 * dt)
        st.z -= st.v * dt
        st.yaw *= 1 - Math.min(1, dt * 3)
      }
      placeSkier(dt)
      updateCamera(dt)
      const snow = scene.userData.snow
      snow.position.set(st.x, heightAt(st.x, st.z) - 6, st.z)
      snow.rotation.y = t * 0.05
      for (const s of course.stars) if (!s.done) s.mesh.rotation.y = t * 2
      for (const gt of course.gates) gt.flag.rotation.y = Math.sin(t * 3 + gt.z) * 0.15
    },
    render() {
      renderer.render(scene, camera)
    },
    // Pour les tests (?debug) : état de la descente.
    debug: () => ({ st, gates: course.gates }),
  }
  return api
}
