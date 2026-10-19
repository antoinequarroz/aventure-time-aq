import * as THREE from 'three'

// Météo, saisons et cycle jour/nuit.
// - Le cycle dure quelques minutes : la lumière baisse, le soleil tourne (les ombres bougent)
//   et la nuit les étoiles brillent davantage.
// - Neige qui tombe sur le Passé, lucioles qui sortent la nuit, étoiles filantes au Futur.
// - Saisons : une par journée de jeu (en partant de la saison réelle) : pétales de cerisier
//   au printemps, pollen doré en été, feuilles mortes en automne, neige partout en hiver.
// - Météo qui change toutes les 1 à 2 minutes : dégagé, nuageux, pluie, orage, neige.
//   Pas de pluie ni de nuages sur la Lune (Futur), et rien à l'intérieur des bâtiments.
export const DAY_LENGTH = 240

export const SEASONS = [
  { id: 'spring', name: 'Printemps', icon: '🌸' },
  { id: 'summer', name: 'Été', icon: '☀️' },
  { id: 'autumn', name: 'Automne', icon: '🍂' },
  { id: 'winter', name: 'Hiver', icon: '❄️' },
]
export const WEATHERS = {
  clear: { id: 'clear', name: 'Dégagé', icon: '🌤️' },
  cloudy: { id: 'cloudy', name: 'Nuageux', icon: '☁️' },
  rain: { id: 'rain', name: 'Pluie', icon: '🌧️' },
  storm: { id: 'storm', name: 'Orage', icon: '⛈️' },
  snow: { id: 'snow', name: 'Neige', icon: '🌨️' },
}
const SPACE = { id: 'clear', name: 'Ciel étoilé', icon: '✨' }
// Chances de chaque temps selon la saison.
const ODDS = {
  spring: { clear: 0.4, cloudy: 0.3, rain: 0.25, storm: 0.05 },
  summer: { clear: 0.5, cloudy: 0.2, rain: 0.12, storm: 0.18 },
  autumn: { clear: 0.25, cloudy: 0.35, rain: 0.3, storm: 0.1 },
  winter: { clear: 0.3, cloudy: 0.3, snow: 0.4 },
}
// Teinte à appliquer à l'herbe et aux feuillages (multiplicateur de couleur).
const TINTS = {
  spring: new THREE.Color(0.9, 1.1, 0.9),
  summer: new THREE.Color(1.08, 1.03, 0.8),
  autumn: new THREE.Color(1.3, 0.82, 0.48),
  winter: new THREE.Color(1.02, 1.06, 1.25),
}

// Saison du calendrier (hémisphère nord) : 0 printemps … 3 hiver.
export function calendarSeason(date = new Date()) {
  return [3, 3, 0, 0, 0, 1, 1, 1, 2, 2, 2, 3][date.getMonth()]
}

// `options.seasons` : 'cycle' (une saison par journée de jeu, en partant de la saison réelle)
// ou 'calendar' (toujours la saison réelle).
export function createWeather(scene, { seasons = 'cycle' } = {}) {
  let share = 1

  // ---------- Neige (Passé, et partout en hiver) ----------
  const SNOW = 1400
  const BOX = { x: 70, y: 30, z: 60 }
  const snowPos = new Float32Array(SNOW * 3)
  const snowSeed = new Float32Array(SNOW)
  for (let i = 0; i < SNOW; i++) {
    snowPos.set([(Math.random() - 0.5) * BOX.x, Math.random() * BOX.y, (Math.random() - 0.5) * BOX.z], i * 3)
    snowSeed[i] = Math.random() * 100
  }
  const snowGeo = new THREE.BufferGeometry()
  snowGeo.setAttribute('position', new THREE.BufferAttribute(snowPos, 3))
  const snowMat = new THREE.PointsMaterial({ size: 0.22, map: dotTexture(), color: 0xffffff, transparent: true, opacity: 0, depthWrite: false })
  const snow = new THREE.Points(snowGeo, snowMat)
  snow.frustumCulled = false
  scene.add(snow)

  // ---------- Lucioles de nuit (Passé et Présent) ----------
  const FLIES = 140
  const flyBase = new Float32Array(FLIES * 3)
  for (let i = 0; i < FLIES; i++) flyBase.set([(Math.random() - 0.5) * 50, 0.5 + Math.random() * 3.5, (Math.random() - 0.5) * 40], i * 3)
  const flyGeo = new THREE.BufferGeometry()
  flyGeo.setAttribute('position', new THREE.BufferAttribute(flyBase.slice(), 3))
  const flyMat = new THREE.PointsMaterial({ size: 0.3, map: dotTexture(), color: new THREE.Color(0xfff08a).multiplyScalar(2.5), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })
  const flies = new THREE.Points(flyGeo, flyMat)
  flies.frustumCulled = false
  scene.add(flies)

  // ---------- Particules de saison ----------
  const petals = fallingPoints(scene, { count: 520, size: 0.24, texture: petalTexture(), colors: [0xffb7d5, 0xff8fc0, 0xffe0ee, 0xffc9e3], fall: [0.6, 1.2], sway: 1.3 })
  const leaves = fallingPoints(scene, { count: 460, size: 0.34, texture: leafTexture(), colors: [0xe8722e, 0xd9452b, 0xf2b33d, 0xb0582a, 0xf09a3a], fall: [1, 1.8], sway: 1.8 })
  const pollen = fallingPoints(scene, { count: 280, size: 0.14, texture: dotTexture(), colors: [0xfff2a0, 0xffe066, 0xffffff, 0xd8ffb0], float: true, additive: true, bright: 1.8 })

  // ---------- Pluie (traits) ----------
  const RAIN = 900
  const RBOX = { x: 56, y: 26, z: 50 }
  const drops = new Float32Array(RAIN * 4)
  for (let i = 0; i < RAIN; i++) drops.set([(Math.random() - 0.5) * RBOX.x, Math.random() * RBOX.y, (Math.random() - 0.5) * RBOX.z, 20 + Math.random() * 8], i * 4)
  const rainPos = new Float32Array(RAIN * 6)
  const rainGeo = new THREE.BufferGeometry()
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3))
  const rainMat = new THREE.LineBasicMaterial({ color: 0xc4ccff, transparent: true, opacity: 0, depthWrite: false })
  const rain = new THREE.LineSegments(rainGeo, rainMat)
  rain.frustumCulled = false
  rain.visible = false
  scene.add(rain)

  // ---------- Nuages ----------
  // Bancs de nuages bas autour des îles (on voit le « ciel » derrière et sous elles), et nuages
  // invisibles au-dessus qui ne servent qu'à faire glisser leurs ombres sur les îles.
  const puffGeo = new THREE.IcosahedronGeometry(1, 1)
  const cloudMat = new THREE.MeshStandardMaterial({ color: 0xe9e3f7, emissive: 0x3a3266, flatShading: true, roughness: 1, transparent: true, opacity: 0 })
  const CLOUDS = 14
  const PUFFS = 5
  const cloudInst = new THREE.InstancedMesh(puffGeo, cloudMat, CLOUDS * PUFFS)
  cloudInst.frustumCulled = false
  cloudInst.visible = false
  scene.add(cloudInst)
  const shadowInst = new THREE.InstancedMesh(puffGeo, new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }), 8 * 4)
  shadowInst.castShadow = true
  shadowInst.frustumCulled = false
  shadowInst.visible = false
  scene.add(shadowInst)
  const makeCloud = (n, spread) => {
    const puffs = []
    for (let k = 0; k < n; k++) puffs.push([(k - (n - 1) / 2) * spread * (0.8 + Math.random() * 0.4), Math.random() * 0.4 * spread, (Math.random() - 0.5) * spread, (k === Math.floor(n / 2) ? 1.3 : 0.75 + Math.random() * 0.35)])
    return puffs
  }
  // Positions relatives au point suivi, enroulées dans une boîte : le banc dérive avec le vent.
  const lowClouds = []
  for (let i = 0; i < CLOUDS; i++) {
    const back = i < 9
    lowClouds.push({ x: (Math.random() - 0.5) * 160, z: back ? -30 - Math.random() * 70 : -20 + Math.random() * 30, y: back ? -7 + Math.random() * 9 : -14 - Math.random() * 8, side: !back, s: 2.4 + Math.random() * 2.2, puffs: makeCloud(PUFFS, 1.7) })
  }
  const highClouds = []
  for (let i = 0; i < 8; i++) highClouds.push({ x: (Math.random() - 0.5) * 80, z: (Math.random() - 0.5) * 70, y: 18 + Math.random() * 4, s: 3 + Math.random() * 2, puffs: makeCloud(4, 1.8) })
  const cloudM = new THREE.Matrix4()
  const wrap = (v, half) => ((((v + half) % (half * 2)) + half * 2) % (half * 2)) - half
  let cloudDrift = 0
  function layoutClouds(center, k, darkness) {
    let i = 0
    for (const c of lowClouds) {
      const x = center.x + wrap(c.x + cloudDrift, 80)
      // Les nuages latéraux (sous les îles) passent au large, pas sous le joueur.
      const z = c.side ? center.z + c.z : center.z + c.z
      for (const [px, py, pz, ps] of c.puffs) {
        const s = c.s * ps * k
        cloudM.makeScale(s * 1.25, s * 0.8, s).setPosition(x + px * c.s, center.y + c.y + py * c.s, z + pz * c.s)
        cloudInst.setMatrixAt(i++, cloudM)
      }
    }
    cloudInst.instanceMatrix.needsUpdate = true
    i = 0
    for (const c of highClouds) {
      const x = center.x + wrap(c.x + cloudDrift * 1.4, 40)
      const z = center.z + c.z
      for (const [px, py, pz, ps] of c.puffs) {
        const s = c.s * ps * k
        cloudM.makeScale(s * 1.3, s * 0.6, s).setPosition(x + px * c.s, center.y + c.y + py, z + pz * c.s)
        shadowInst.setMatrixAt(i++, cloudM)
      }
    }
    shadowInst.instanceMatrix.needsUpdate = true
    cloudMat.color.setRGB(0.91 - darkness * 0.42, 0.89 - darkness * 0.42, 0.97 - darkness * 0.32)
  }

  // ---------- Éclairs ----------
  const BOLT = 16
  const boltGeo = new THREE.BufferGeometry()
  boltGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(BOLT * 3), 3))
  const boltMat = new THREE.LineBasicMaterial({ color: new THREE.Color(0xeee6ff).multiplyScalar(3), transparent: true, opacity: 0, depthWrite: false, fog: false, blending: THREE.AdditiveBlending })
  const bolt = new THREE.Line(boltGeo, boltMat)
  bolt.frustumCulled = false
  bolt.visible = false
  scene.add(bolt)
  function strike(center) {
    const arr = boltGeo.attributes.position.array
    let x = center.x + (Math.random() - 0.5) * 100
    const z = center.z - 45 - Math.random() * 45
    const top = center.y + 10
    const bottom = center.y - 34
    for (let i = 0; i < BOLT; i++) {
      const y = top + (bottom - top) * (i / (BOLT - 1))
      arr.set([x, y, z + (Math.random() - 0.5) * 2], i * 3)
      x += (Math.random() - 0.5) * 5
    }
    boltGeo.attributes.position.needsUpdate = true
  }
  const thunderListeners = new Set()
  const pendingThunder = []

  // ---------- Étoiles filantes ----------
  const shooting = []
  let nextStar = 2
  function spawnStar(center) {
    const SEG = 24
    const pos = new Float32Array(SEG * 3)
    const col = new Float32Array(SEG * 4)
    for (let i = 0; i < SEG; i++) {
      const k = 1 - i / (SEG - 1)
      col.set([1, 0.95, 1, k * k], i * 4)
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    geo.setAttribute('color', new THREE.BufferAttribute(col, 4))
    const material = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending })
    material.color.setScalar(3)
    const line = new THREE.Line(geo, material)
    line.frustumCulled = false
    // La caméra plonge vers les îles : le « ciel » visible est le fond étoilé derrière et sous elles.
    // Les étoiles filantes traversent donc cette zone, en légère diagonale.
    const side = Math.random() < 0.5 ? -1 : 1
    const start = new THREE.Vector3(center.x - side * (40 + Math.random() * 60), center.y - 4 - Math.random() * 16, center.z - 110 - Math.random() * 80)
    const dir = new THREE.Vector3(side, -0.08 - Math.random() * 0.14, (Math.random() - 0.5) * 0.3).normalize()
    // Tête lumineuse de l'étoile filante.
    const head = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTexture(), color: new THREE.Color(0xdff4ff).multiplyScalar(3), transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }))
    head.scale.setScalar(2.4)
    line.add(head)
    scene.add(line)
    shooting.push({ line, head, start, dir, t: 0, life: 1.1 + Math.random() * 0.7, speed: 110 + Math.random() * 70, len: 26 + Math.random() * 18 })
  }

  let era = 'past'
  let snowK = 0
  let flyK = 0
  let rainK = 0
  let cloudK = 0
  let darkK = 0
  let petalK = 0
  let leafK = 0
  let pollenK = 0
  let flashT = 9
  let nextFlash = 6
  // `flash` : éclair (0..1) pour éclaircir les lumières ; `overcast` : ciel couvert (0..1)
  // pour baisser le soleil ; `rain` : intensité de la pluie (son).
  const state = { day: 1, phase: 0, shift: 0, force: null, flash: 0, overcast: 0, rain: 0, snow: 0 }

  // Saisons.
  const startSeason = calendarSeason()
  let seasonIdx = startSeason
  let seasonLock = null
  const tint = TINTS[SEASONS[seasonIdx].id].clone()

  // Météo : tirage selon la saison toutes les 60 à 120 s (on commence par un ciel dégagé).
  let weather = 'clear'
  let weatherLock = null
  let weatherTimer = 60 + Math.random() * 60
  const seasonId = () => SEASONS[seasonIdx].id
  const fitSeason = (w) => (seasonId() === 'winter' ? (w === 'rain' || w === 'storm' ? 'snow' : w) : w === 'snow' ? 'rain' : w)
  function rollWeather() {
    const odds = ODDS[seasonId()]
    let r = Math.random()
    for (const [id, p] of Object.entries(odds)) {
      r -= p
      if (r <= 0) return id
    }
    return 'clear'
  }
  const current = () => fitSeason(weatherLock ?? weather)

  let lastCenter = new THREE.Vector3()
  const api = {
    state,
    tint,
    // Débogage : lance une étoile filante tout de suite.
    shootingStar: () => spawnStar(lastCenter),
    // Débogage : éclair tout de suite.
    lightning: () => {
      flashT = 0
      strike(lastCenter)
      pendingThunder.push({ at: 0.6, intensity: 1 })
    },
    setEra(next) {
      era = next ?? era
    },
    get season() {
      return SEASONS[seasonIdx]
    },
    // Fixe la saison (`'spring'`…`'winter'`), ou la rend au cycle avec `null` / `'auto'`.
    setSeason(id) {
      const i = SEASONS.findIndex((s) => s.id === id)
      seasonLock = i >= 0 ? i : null
      if (seasonLock !== null) seasonIdx = seasonLock
    },
    // Temps qu'il fait là où l'on est (toujours dégagé sur la Lune).
    get weatherNow() {
      return era === 'future' ? SPACE : WEATHERS[current()]
    },
    // Fixe le temps (`'clear'`, `'cloudy'`, `'rain'`, `'storm'`, `'snow'`) ou le rend aléatoire avec `null`.
    setWeather(id) {
      weatherLock = WEATHERS[id] ? id : null
      if (!weatherLock) weatherTimer = Math.min(weatherTimer, 60 + Math.random() * 60)
    },
    // Moins de particules sur les petits appareils (qualité 0 la meilleure … 3).
    setDetail(q) {
      share = q >= 3 ? 0.35 : q >= 2 ? 0.5 : 1
    },
    // Tonnerre : `cb({ intensity })` est appelé un instant après chaque éclair. Renvoie de quoi se désabonner.
    onThunder(cb) {
      thunderListeners.add(cb)
      return () => thunderListeners.delete(cb)
    },
    // Lumière du jour entre 0 (nuit) et 1 (plein jour), selon le temps écoulé.
    update(dt, t, center) {
      lastCenter = center
      // Le cycle commence en fin de journée pour que la première nuit arrive vite.
      const cycles = t / DAY_LENGTH + 0.15 + state.shift
      state.phase = state.force ?? cycles % 1
      state.day = 0.5 + 0.5 * Math.cos(state.phase * Math.PI * 2)

      // Saison : change chaque nuit à minuit (phase 0.5).
      const prevSeason = seasonIdx
      if (seasonLock !== null) seasonIdx = seasonLock
      else if (seasons === 'calendar') seasonIdx = calendarSeason()
      else seasonIdx = (startSeason + Math.floor(cycles + 0.5)) % 4
      if (seasonIdx !== prevSeason) weather = fitSeason(weather)
      tint.lerp(TINTS[seasonId()], Math.min(1, dt * 0.6))

      weatherTimer -= dt
      if (weatherTimer <= 0) {
        weather = fitSeason(rollWeather())
        weatherTimer = 60 + Math.random() * 60
      }
      const w = current()
      const outdoor = era !== 'interior'
      const sky = outdoor && era !== 'future'
      const winter = seasonId() === 'winter'
      const ease = (k, target, speed) => k + (target - k) * Math.min(1, dt * speed)

      // Nuages, pluie et orage.
      cloudK = ease(cloudK, sky && w !== 'clear' ? (w === 'cloudy' ? 0.85 : 1) : 0, 0.4)
      rainK = ease(rainK, sky ? (w === 'storm' ? 1 : w === 'rain' ? 0.55 : 0) : 0, 0.8)
      darkK = ease(darkK, w === 'storm' ? 1 : w === 'rain' || w === 'snow' ? 0.55 : 0.1, 0.5)
      state.overcast = sky ? cloudK * (0.25 + darkK * 0.4) : 0
      state.rain = rainK
      cloudDrift += dt * (w === 'storm' ? 3 : 1.2)
      cloudInst.visible = cloudK > 0.02
      shadowInst.visible = cloudK > 0.02 && share >= 0.5
      if (cloudInst.visible) {
        cloudMat.opacity = Math.min(0.92, cloudK * 1.1)
        layoutClouds(center, 0.3 + 0.7 * cloudK, darkK)
      }

      const wind = w === 'storm' ? 4 : 1.2
      rainMat.opacity = rainK * 0.5 + state.flash * 0.3
      rain.visible = rainK > 0.02
      if (rain.visible) {
        rain.position.set(center.x, center.y - 3, center.z - 6)
        const n = Math.round(RAIN * share * Math.min(1, rainK * 1.05))
        rainGeo.setDrawRange(0, n * 2)
        for (let i = 0; i < n; i++) {
          const o = i * 4
          let y = drops[o + 1] - drops[o + 3] * dt
          let x = drops[o] + wind * dt
          if (y < 0) y += RBOX.y
          if (x > RBOX.x / 2) x -= RBOX.x
          drops[o] = x
          drops[o + 1] = y
          const p = i * 6
          rainPos[p] = x
          rainPos[p + 1] = y
          rainPos[p + 2] = drops[o + 2]
          rainPos[p + 3] = x - wind * 0.04
          rainPos[p + 4] = y + 0.9
          rainPos[p + 5] = drops[o + 2]
        }
        rainGeo.attributes.position.needsUpdate = true
      }

      // Éclairs pendant l'orage : flash, trait lumineux au loin, puis tonnerre.
      flashT += dt
      if (sky && w === 'storm' && rainK > 0.6) {
        nextFlash -= dt
        if (nextFlash <= 0) {
          flashT = 0
          strike(center)
          pendingThunder.push({ at: 0.4 + Math.random() * 1.2, intensity: 0.6 + Math.random() * 0.4 })
          nextFlash = 5 + Math.random() * 9
        }
      }
      const f1 = Math.max(0, 1 - flashT * 6)
      const f2 = flashT > 0.14 ? Math.max(0, 0.8 - (flashT - 0.14) * 4) : 0
      state.flash = Math.min(1, Math.max(f1, f2))
      bolt.visible = state.flash > 0.02 && sky
      boltMat.opacity = state.flash
      for (let i = pendingThunder.length - 1; i >= 0; i--) {
        const th = pendingThunder[i]
        th.at -= dt
        if (th.at <= 0) {
          pendingThunder.splice(i, 1)
          for (const cb of thunderListeners) cb({ intensity: th.intensity })
        }
      }

      // Neige : toujours au Passé, partout sauf sur la Lune en hiver, plus dense quand il neige.
      const snowing = w === 'snow' && outdoor && era !== 'future'
      const snowTarget = !outdoor || era === 'future' ? 0 : era === 'past' || snowing ? 1 : winter ? 0.75 : 0
      snowK = ease(snowK, snowTarget, 1.5)
      state.snow = snowK
      snowMat.opacity = snowK * 0.9
      snow.visible = snowK > 0.01
      if (snow.visible) {
        snow.position.set(center.x, center.y - 4, center.z)
        const n = Math.round(SNOW * share * (snowing ? 1 : era === 'past' ? 1 : 0.6))
        snowGeo.setDrawRange(0, n)
        const fall = snowing ? 1.5 : 1
        const drift = snowing ? 1.2 : 0.4
        for (let i = 0; i < n; i++) {
          const s = snowSeed[i]
          let x = snowPos[i * 3] + Math.sin(t * 0.8 + s) * dt * 0.6 + dt * drift
          let y = snowPos[i * 3 + 1] - dt * (1.2 + (s % 1) * 0.8) * fall
          let z = snowPos[i * 3 + 2] + Math.cos(t * 0.6 + s) * dt * 0.4
          if (y < 0) y += BOX.y
          if (x > BOX.x / 2) x -= BOX.x
          snowPos[i * 3] = x
          snowPos[i * 3 + 1] = y
          snowPos[i * 3 + 2] = z
        }
        // La neige suit le joueur : on recentre les flocons sortis de la boîte.
        snowGeo.attributes.position.needsUpdate = true
      }

      // Particules de saison (pas sur la Lune ni à l'intérieur ; moins sous la pluie).
      const calm = 1 - Math.min(1, rainK * 0.8 + (snowing ? 0.6 : 0))
      petalK = ease(petalK, sky && seasonId() === 'spring' ? calm : 0, 0.8)
      leafK = ease(leafK, sky && seasonId() === 'autumn' ? calm : 0, 0.8)
      pollenK = ease(pollenK, sky && seasonId() === 'summer' ? calm * (0.35 + 0.65 * state.day) : 0, 0.8)
      petals.update(dt, t, center, petalK, share, w === 'storm' ? 3 : 1)
      leaves.update(dt, t, center, leafK, share, w === 'storm' ? 3 : 1)
      pollen.update(dt, t, center, pollenK, share, 1)

      const night = 1 - state.day
      flyK += ((outdoor && era !== 'future' ? Math.max(0, night * 1.6 - 0.4) * (1 - rainK) * (winter ? 0.4 : 1) : 0) - flyK) * Math.min(1, dt)
      flyMat.opacity = Math.min(1, flyK) * (0.65 + Math.sin(t * 3) * 0.2)
      flies.visible = flyK > 0.02
      if (flies.visible) {
        flies.position.set(center.x, center.y, center.z)
        const p = flyGeo.attributes.position.array
        for (let i = 0; i < FLIES; i++) {
          const s = i * 1.37
          p[i * 3] = flyBase[i * 3] + Math.sin(t * 0.4 + s) * 1.2
          p[i * 3 + 1] = flyBase[i * 3 + 1] + Math.sin(t * 0.7 + s * 2) * 0.6
          p[i * 3 + 2] = flyBase[i * 3 + 2] + Math.cos(t * 0.35 + s * 1.3) * 1.2
        }
        flyGeo.attributes.position.needsUpdate = true
      }

      // Étoiles filantes : fréquentes au Futur, plus rares ailleurs la nuit (et pas sous les nuages).
      nextStar -= dt
      if (nextStar <= 0) {
        if (outdoor && (era === 'future' || (night > 0.6 && cloudK < 0.3))) spawnStar(center)
        nextStar = era === 'future' ? 0.8 + Math.random() * 2.2 : 4 + Math.random() * 6
      }
      for (let i = shooting.length - 1; i >= 0; i--) {
        const s = shooting[i]
        s.t += dt
        const head = s.start.clone().addScaledVector(s.dir, s.t * s.speed)
        const arr = s.line.geometry.attributes.position.array
        const n = arr.length / 3
        const len = Math.min(s.len, s.t * s.speed)
        for (let k = 0; k < n; k++) {
          arr[k * 3] = head.x - s.dir.x * len * (k / (n - 1))
          arr[k * 3 + 1] = head.y - s.dir.y * len * (k / (n - 1))
          arr[k * 3 + 2] = head.z - s.dir.z * len * (k / (n - 1))
        }
        s.line.geometry.attributes.position.needsUpdate = true
        s.head.position.copy(head)
        const fade = Math.min(1, s.t * 6, (s.life - s.t) * 3)
        s.line.material.opacity = Math.max(0, fade)
        s.head.material.opacity = Math.max(0, fade)
        if (s.t > s.life) {
          scene.remove(s.line)
          s.line.geometry.dispose()
          s.line.material.dispose()
          s.head.material.dispose()
          shooting.splice(i, 1)
        }
      }
      return state
    },
    label() {
      const p = state.phase
      if (p < 0.2 || p > 0.8) return { icon: '☀️', text: 'Jour' }
      if (p < 0.3) return { icon: '🌇', text: 'Crépuscule' }
      if (p < 0.7) return { icon: '🌙', text: 'Nuit' }
      return { icon: '🌅', text: 'Aube' }
    },
    // Moment de la journée, temps qu'il fait et saison : { icon: '🌧️', text: 'Nuit · Pluie · Automne' }.
    fullLabel() {
      const day = api.label()
      const w = api.weatherNow
      const parts = [day.text]
      if (w.id !== 'clear') parts.push(w.name)
      if (era !== 'future') parts.push(api.season.name)
      return { icon: w.id !== 'clear' ? w.icon : day.icon, text: parts.join(' · ') }
    },
  }
  return api
}

// Particules qui tombent en tournoyant (pétales, feuilles) ou flottent (pollen), dans une
// boîte qui suit le joueur.
function fallingPoints(scene, { count, size, texture, colors, fall = [1, 1.5], sway = 1, float = false, additive = false, bright = 1 }) {
  const BOX = float ? { x: 50, y: 6, z: 44 } : { x: 54, y: 16, z: 46 }
  const pos = new Float32Array(count * 3)
  const base = new Float32Array(count * 3)
  const seed = new Float32Array(count * 2)
  const col = new Float32Array(count * 3)
  const c = new THREE.Color()
  for (let i = 0; i < count; i++) {
    base.set([(Math.random() - 0.5) * BOX.x, Math.random() * BOX.y, (Math.random() - 0.5) * BOX.z], i * 3)
    seed.set([Math.random() * 100, fall[0] + Math.random() * (fall[1] - fall[0])], i * 2)
    c.set(colors[i % colors.length]).multiplyScalar(bright)
    col.set([c.r, c.g, c.b], i * 3)
  }
  pos.set(base)
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3))
  const material = new THREE.PointsMaterial({ size, map: texture, vertexColors: true, transparent: true, opacity: 0, depthWrite: false, alphaTest: additive ? 0 : 0.05, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending })
  const points = new THREE.Points(geo, material)
  points.frustumCulled = false
  points.visible = false
  scene.add(points)
  return {
    points,
    update(dt, t, center, k, share, wind) {
      material.opacity = Math.min(1, k) * (float ? 0.7 + Math.sin(t * 2) * 0.2 : 0.95)
      points.visible = k > 0.02
      if (!points.visible) return
      points.position.set(center.x, center.y + (float ? 0.2 : -1), center.z - 4)
      const n = Math.round(count * share)
      geo.setDrawRange(0, n)
      for (let i = 0; i < n; i++) {
        const s = seed[i * 2]
        const v = seed[i * 2 + 1]
        if (float) {
          // Le pollen flotte et monte doucement.
          base[i * 3 + 1] += dt * 0.15
          if (base[i * 3 + 1] > BOX.y) base[i * 3 + 1] -= BOX.y
          pos[i * 3] = base[i * 3] + Math.sin(t * 0.3 + s) * 1.5
          pos[i * 3 + 1] = base[i * 3 + 1] + Math.sin(t * 0.8 + s * 2) * 0.3
          pos[i * 3 + 2] = base[i * 3 + 2] + Math.cos(t * 0.25 + s) * 1.5
        } else {
          // Chute en feuille morte : balancement latéral et dérive avec le vent.
          let y = base[i * 3 + 1] - dt * v
          let x = base[i * 3] + dt * wind * 0.8
          if (y < 0) y += BOX.y
          if (x > BOX.x / 2) x -= BOX.x
          base[i * 3] = x
          base[i * 3 + 1] = y
          pos[i * 3] = x + Math.sin(t * 1.6 + s) * sway * 0.5
          pos[i * 3 + 1] = y + Math.abs(Math.sin(t * 1.6 + s)) * 0.25
          pos[i * 3 + 2] = base[i * 3 + 2] + Math.cos(t * 1.1 + s) * sway * 0.35
        }
      }
      geo.attributes.position.needsUpdate = true
    },
  }
}

let dot
function dotTexture() {
  if (dot) return dot
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 64
  const g = canvas.getContext('2d')
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32)
  grad.addColorStop(0, 'rgba(255,255,255,1)')
  grad.addColorStop(0.4, 'rgba(255,255,255,0.8)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 64, 64)
  dot = new THREE.CanvasTexture(canvas)
  return dot
}

// Pétale : ovale clair au cœur légèrement plus foncé.
function petalTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 64
  const g = canvas.getContext('2d')
  g.translate(32, 32)
  g.rotate(-0.6)
  g.fillStyle = '#ffffff'
  g.beginPath()
  g.ellipse(0, 0, 13, 24, 0, 0, Math.PI * 2)
  g.fill()
  g.fillStyle = 'rgba(255,200,225,0.9)'
  g.beginPath()
  g.ellipse(0, 8, 6, 10, 0, 0, Math.PI * 2)
  g.fill()
  return new THREE.CanvasTexture(canvas)
}

// Feuille : forme en amande avec une nervure.
function leafTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 64
  const g = canvas.getContext('2d')
  g.translate(32, 32)
  g.rotate(0.7)
  g.fillStyle = '#ffffff'
  g.beginPath()
  g.moveTo(0, -28)
  g.quadraticCurveTo(22, -4, 0, 28)
  g.quadraticCurveTo(-22, -4, 0, -28)
  g.fill()
  g.strokeStyle = 'rgba(120,60,20,0.55)'
  g.lineWidth = 3
  g.beginPath()
  g.moveTo(0, -24)
  g.lineTo(0, 26)
  g.stroke()
  return new THREE.CanvasTexture(canvas)
}
