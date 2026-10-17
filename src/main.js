import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js'
import './fonts.css'
import './style.css'
import { createSpace } from './world/space.js'
import { createIslands } from './world/islands.js'
import { createVehicles } from './world/vehicles.js'
import { createMinimap } from './minimap.js'
import { focus as npcFocus } from './world/characters.js'
import { createPushables } from './world/pushables.js'
import { loadModels } from './world/models.js'
import { createPlayer } from './player.js'
import { createUI } from './ui.js'
import { createGames } from './games.js'
import { createControls } from './controls.js'
import { createAudio } from './audio.js'
import { createQuest } from './quest.js'
import { createTour } from './tour.js'
import { createWeather } from './weather.js'
import { createSocialPlaza, createPortfolioBanner } from './world/socials.js'
import { socials, about, showcases } from './content.js'
import { createShowcases } from './world/showcases.js'
import { THEMES } from './world/islands.js'

const ui = createUI()
const sfx = createAudio()
sfx.onChange((state) => ui.setSound(state))
ui.on('mute', () => {
  sfx.start()
  sfx.toggle()
})
ui.on('music', () => sfx.toggleMusic())
// Les textes dessinés dans la scène (panneaux, écrans) attendent les polices embarquées.
await Promise.all(['400 32px "Inter Variable"', '700 32px "Inter Variable"', '600 32px "Outfit Variable"'].map((f) => document.fonts.load(f))).catch(() => {})
await loadModels((progress) => ui.setLoading(progress))

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.15
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.VSMShadowMap
document.getElementById('app').appendChild(renderer.domElement)

const scene = new THREE.Scene()
// Brume violette : les îles lointaines se fondent dans la nébuleuse.
scene.fog = new THREE.Fog(0x2b1f4f, 70, 280)
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1500)

// Éclairage : ciel bleuté, soleil chaud et contre-jour violet.
const hemi = new THREE.HemisphereLight(0xa9c2ff, 0x4a3560, 1.3)
scene.add(hemi)
const sun = new THREE.DirectionalLight(0xffe2b8, 2.8)
sun.castShadow = true
sun.shadow.mapSize.set(2048, 2048)
sun.shadow.bias = -0.0005
sun.shadow.radius = 3
sun.shadow.blurSamples = 10
Object.assign(sun.shadow.camera, { left: -32, right: 32, top: 32, bottom: -32, near: 1, far: 140 })
scene.add(sun, sun.target)
const rim = new THREE.DirectionalLight(0x9b7bff, 1.4)
rim.position.set(-30, 20, -40)
scene.add(rim)

// Post-traitement : léger bloom sur les éléments lumineux.
// Cible multi-échantillonnée : garde l'anticrénelage malgré le post-traitement.
const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, { type: THREE.HalfFloatType, samples: 4 }))
composer.addPass(new RenderPass(scene, camera))
// Occlusion ambiante : ombres de contact au pied des objets et dans les recoins (désactivée sur mobile).
const params = new URLSearchParams(location.search)
const lowEnd = matchMedia('(pointer: coarse)').matches || params.has('lite')
let ao = null
if (!lowEnd && !params.has('noao')) {
  ao = new GTAOPass(scene, camera, window.innerWidth, window.innerHeight)
  ao.updateGtaoMaterial({ radius: 1.2, distanceExponent: 1.5, thickness: 1.5, scale: 1.2 })
  ao.blendIntensity = 0.85
  composer.addPass(ao)
}
const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.55, 0.6, 0.85)
composer.addPass(bloom)
composer.addPass(new OutputPass())

// Ambiance lumineuse propre à chaque époque, avec un fondu en changeant d'île.
// Passé : nuit violette et clair de lune (Mike Fernandez). Présent : fin d'après-midi orangée
// (Bruno Simon). Futur : lumière froide et contre-jour néon.
const MOODS = {
  past: { sun: new THREE.Color(0xb3b8ff), sky: new THREE.Color(0x8c86ff), ground: new THREE.Color(0x3a2f6a), rim: new THREE.Color(0xff6fcf), sunI: 1.9, hemiI: 1.15, fog: new THREE.Color(0x231a4a), exposure: 1.1 },
  present: { sun: new THREE.Color(0xffcf96), sky: new THREE.Color(0xffc49a), ground: new THREE.Color(0x8a4a5a), rim: new THREE.Color(0xff5fa8), sunI: 3.0, hemiI: 1.25, fog: new THREE.Color(0x3a2448), exposure: 1.1 },
  future: { sun: new THREE.Color(0xd8e0ff), sky: new THREE.Color(0x8f8cff), ground: new THREE.Color(0x2a2464), rim: new THREE.Color(0x3fe8ff), sunI: 2.4, hemiI: 1.2, fog: new THREE.Color(0x1d1745), exposure: 1.1 },
}
// Cycle jour/nuit : la nuit, la lumière baisse et bleuit ; le jour, elle reprend sa couleur d'époque.
const NIGHT = new THREE.Color(0x6a78ff)
const NIGHT_FOG = new THREE.Color(0x0d0a26)
const tmpColor = new THREE.Color()
let lastMood = 'past'
function applyMood(era, k, day = 1) {
  const m = MOODS[era] ?? MOODS[lastMood]
  if (MOODS[era]) lastMood = era
  const night = 1 - day
  sun.color.lerp(tmpColor.copy(m.sun).lerp(NIGHT, night * 0.55), k)
  hemi.color.lerp(m.sky, k)
  hemi.groundColor.lerp(m.ground, k)
  rim.color.lerp(m.rim, k)
  sun.intensity += (m.sunI * (0.25 + 0.95 * day) - sun.intensity) * k
  hemi.intensity += (m.hemiI * (0.5 + 0.6 * day) - hemi.intensity) * k
  rim.intensity += ((1.4 + night * 0.8) - rim.intensity) * k
  renderer.toneMappingExposure += ((0.82 + 0.38 * day) - renderer.toneMappingExposure) * k
  scene.fog.color.lerp(tmpColor.copy(m.fog).lerp(NIGHT_FOG, night * 0.5), k)
}

applyMood('past', 1)
const space = createSpace(scene)
const world = createIslands(scene)
const vehicles = createVehicles(scene, world)

// Bâtiments qui s'effacent quand ils cachent le joueur.
const fades = world.fadeables.map((object) => {
  const materials = new Set()
  object.traverse((o) => {
    if (!o.isMesh) return
    o.material = Array.isArray(o.material) ? o.material.map((m) => m.clone()) : o.material.clone()
    for (const m of [o.material].flat()) {
      m.transparent = true
      materials.add(m)
    }
  })
  object.updateWorldMatrix(true, true)
  const sphere = new THREE.Box3().setFromObject(object).getBoundingSphere(new THREE.Sphere())
  return { materials: [...materials], sphere, opacity: 1 }
})
const ray = new THREE.Ray()
const closest = new THREE.Vector3()
function updateFades(dt) {
  const eye = cameraTarget.clone().setY(cameraTarget.y + 1.2)
  ray.origin.copy(eye)
  ray.direction.subVectors(camera.position, eye)
  const length = ray.direction.length()
  ray.direction.normalize()
  for (const f of fades) {
    ray.closestPointToPoint(f.sphere.center, closest)
    const along = closest.distanceTo(eye)
    const hidden = along > 1.5 && along < length && closest.distanceTo(f.sphere.center) < f.sphere.radius * 0.85
    const target = hidden ? 0.25 : 1
    if (Math.abs(f.opacity - target) < 0.01) continue
    f.opacity += (target - f.opacity) * Math.min(1, dt * 8)
    for (const m of f.materials) {
      m.opacity = f.opacity
      m.depthWrite = f.opacity > 0.95
    }
  }
}
const socialStones = createSocialPlaza(scene, world, { center: THEMES.past.center.clone().add(new THREE.Vector3(-21, 0, 21)), socials })
const banner = createPortfolioBanner(scene, world, { x: world.spawn.x, z: world.spawn.z - 5.5 })
const projectPlaces = createShowcases(scene, world, { places: showcases, ui, sfx })
const interactables = [...world.interactables, ...vehicles.interactables, ...socialStones.interactables, ...projectPlaces.interactables]
const player = createPlayer(scene, world)
const minimap = createMinimap({ world, player, interactables, eraOf: (x) => (x < -75 ? 'past' : x > 75 ? 'future' : 'present'), onPick: (item) => goTo(item) })
const games = createGames(scene, ui, player, sfx)
const weather = createWeather(scene)
const pushables = createPushables(scene, world, world.pushables, {
  onStrike: () => ui.toast('STRIKE ! Toutes les quilles sont tombées 🎳'),
  onGoal: () => ui.toast('BUUUT ! ⚽'),
})
ui.setReady()

// Caméra fixe en trois-quarts, qui suit le joueur en douceur.
const cameraOffset = new THREE.Vector3(0, 14, 19)
const cameraTarget = player.position.clone()
camera.position.copy(player.position).add(cameraOffset)

// Accès de débogage : ouvrir le site avec ?debug pour piloter le joueur depuis la console.
if (new URLSearchParams(location.search).has('debug')) {
  window.__game = {
    player,
    world,
    scene,
    games,
    pushables,
    vehicles,
    places: projectPlaces,
    near: () => interactables.filter((i) => Math.hypot(player.position.x - i.x, player.position.z - i.z) < i.r + 3).map((i) => [i.type, i.title, Math.hypot(player.position.x - i.x, player.position.z - i.z).toFixed(2)]),
    state: () => ({ nearby: nearby?.title, doorCooldown, doorBusy, panel: ui.panelOpen(), discovered: discovered.size, total: signs.length, tour: tour.active, day: weather.state.day, character: player.character }),
    quest: () => quest,
    tour: () => tour,
    weather,
    sfx,
    discoverAll() {
      for (const s of signs) discover(s, true)
    },
    setCamera(x, y, z) {
      introBlend = 1
      cameraOffset.set(x, y, z)
      viewOffset.copy(cameraOffset)
      camera.position.copy(cameraTarget).add(cameraOffset)
    },
    teleport(x, z) {
      player.teleport(new THREE.Vector3(x, world.groundAt(x, z, Infinity, true) ?? 0, z))
      cameraTarget.copy(player.position)
      camera.position.copy(player.position).add(cameraOffset)
    },
  }
}

let started = false
// Personnage choisi sur l'écran d'accueil (gardé d'une visite à l'autre).
const CHAR_KEY = 'aventure-time-aq:character'
const savedChar = (() => {
  try {
    return localStorage.getItem(CHAR_KEY)
  } catch {
    return null
  }
})()
if (savedChar) player.setCharacter(savedChar)
ui.selectCharacter(player.character)
player.setWaving(camera.position)
ui.on('character', (key) => {
  player.setCharacter(key)
  sfx.start()
  sfx.blip('open')
  player.cheer()
  try {
    localStorage.setItem(CHAR_KEY, key)
  } catch {
    // Navigation privée.
  }
})
const controls = createControls({
  canvas: renderer.domElement,
  camera,
  scene,
  player,
  onInteract: () => interact(),
  isActive: () => started && !vehicles.traveling && !vehicles.driving && !ui.panelOpen() && !tour.active,
})
let introBlend = 0
ui.onStart((guided) => {
  started = true
  player.setWaving(false)
  sfx.start()
  controls.focus()
  if (guided) startTour()
})


let nearby = null
// Points d'intérêt déjà lus (gardés d'une visite à l'autre).
const DISCOVERED_KEY = 'aventure-time-aq:discovered'
const discovered = new Set((() => {
  try {
    return JSON.parse(localStorage.getItem(DISCOVERED_KEY)) || []
  } catch {
    return []
  }
})())
const signs = interactables.filter((i) => i.type === 'sign')
function saveDiscovered() {
  try {
    localStorage.setItem(DISCOVERED_KEY, JSON.stringify([...discovered]))
  } catch {
    // Navigation privée : la progression n'est pas gardée.
  }
}
// Un point lu compte pour la quête ; le dernier déverrouille le coffre.
function discover(item, silent = false) {
  if (discovered.has(item.title)) return
  discovered.add(item.title)
  saveDiscovered()
  ui.setQuest(quest.progress())
  if (discovered.size === signs.length && !silent && !tour.active) {
    sfx.jingle()
    ui.toast('Tous les points sont découverts ! Le coffre final t\'attend sur la place du Présent 🗝️')
  }
}
// Les titres déjà vus qui n'existent plus (contenu modifié) ne comptent pas.
for (const title of [...discovered]) if (!signs.some((s) => s.title === title)) discovered.delete(title)
const quest = createQuest(scene, world, { ui, sfx, discovered, total: signs.length, signs })
interactables.push(quest.interactable)
ui.setQuest(quest.progress())
const tour = createTour({
  ui,
  world,
  player,
  signs,
  quest,
  sfx,
  discover: (item) => discover(item, true),
  onMove: () => {
    cameraTarget.copy(player.position)
    camGround = player.position.y
  },
})
// Téléportation depuis la grande carte : fondu, puis on arrive devant le point choisi.
function goTo(item) {
  if (!started || vehicles.traveling || doorBusy) return
  if (tour.active) tour.stop()
  games.abort()
  if (vehicles.driving) vehicles.exit(player)
  ui.closePanel()
  sfx.blip('whoosh')
  ui.fade(() => {
    const spot = tour.standNear(item)
    player.teleport(spot)
    player.face(Math.atan2(item.x - spot.x, item.z - spot.z))
    cameraTarget.copy(player.position)
    camGround = player.position.y
    doorCooldown = 1.2
  })
}
function startTour() {
  games.abort()
  if (vehicles.driving) vehicles.exit(player)
  tour.start()
}
ui.on('tour', () => {
  if (!started || vehicles.traveling) return
  if (tour.active) tour.stop()
  else startTour()
})
ui.on('tourNext', () => tour.next())
ui.on('about', () => {
  if (tour.active) tour.stop()
  sfx.blip('open')
  ui.openPanel({ ...about, icon: '🧭', kicker: 'Bienvenue', era: 'present' })
})
ui.on('tourStop', () => {
  tour.stop()
  ui.closePanel()
})

window.addEventListener('keydown', (e) => {
  if (!started || vehicles.traveling) return
  if (e.code === 'Escape') {
    if (tour.active) tour.stop()
    if (ui.panelOpen()) ui.closePanel()
    else games.abort()
  }
  if (e.code === 'KeyE') {
    if (tour.active) return tour.next()
    interact()
  }
})

function interact() {
  if (!started || vehicles.traveling) return
  if (vehicles.driving) return vehicles.exit(player)
  if (ui.panelOpen()) return ui.closePanel()
  if (!nearby) return
  if (nearby.showcase) {
    discover(nearby)
    sfx.blip('open')
    return nearby.showcase.open()
  }
  if (nearby.type === 'sign') {
    discover(nearby)
    sfx.blip('open')
    ui.openPanel({ ...nearby, count: `Découverts : ${discovered.size} / ${signs.length}` })
  }
  if (nearby.type === 'chest') quest.open(player)
  if (nearby.type === 'social') {
    sfx.blip('open')
    ui.openPanel({ title: nearby.title, icon: '🪨', kicker: 'Mes réseaux', era: 'past', text: nearby.text, links: [{ label: `Ouvrir ${nearby.title}`, url: nearby.url, primary: true }] })
  }
  if (nearby.type === 'vehicle') {
    games.abort()
    vehicles.start(nearby, player)
  }
  if (nearby.type === 'game') games.start(nearby.game)
  if (nearby.type === 'door') enterDoor(nearby)
}

// Portes : fondu au noir, puis on se retrouve dedans (ou dehors), comme dans Pokémon.
let doorBusy = false
let doorCooldown = 0
function enterDoor(door) {
  if (doorBusy) return
  doorBusy = true
  games.abort()
  sfx.blip('door')
  ui.fade(() => {
    player.teleport(door.to)
    doorBusy = false
    doorCooldown = 1.2
  })
}

function findNearby() {
  for (const item of interactables) {
    const dx = player.position.x - item.x
    const dz = player.position.z - item.z
    if (dx * dx + dz * dz < item.r * item.r && player.position.y > -1) return item
  }
  return null
}

// Caméra : suit le joueur à l'horizontale, mais en hauteur elle suit le niveau du sol
// (pas l'arc des sauts), et se recale d'un coup après une téléportation au lieu de traverser la carte.
const focus = new THREE.Vector3()
let camGround = player.position.y
let zoom = 1
const indoorOffset = new THREE.Vector3(0, 10.5, 8.5)
const viewOffset = new THREE.Vector3(0, 14, 19)
let wasInside = false
function updateCamera(dt) {
  const p = player.position
  if (player.grounded || p.y < camGround - 0.5 || vehicles.traveling || vehicles.driving) camGround = p.y
  focus.set(p.x, camGround, p.z)
  if (focus.distanceToSquared(cameraTarget) > 30 * 30) cameraTarget.copy(focus)
  else {
    const k = 1 - Math.exp(-dt * 7)
    cameraTarget.x += (focus.x - cameraTarget.x) * k
    cameraTarget.z += (focus.z - cameraTarget.z) * k
    cameraTarget.y += (focus.y - cameraTarget.y) * (1 - Math.exp(-dt * 3.5))
  }
  // Au volant, la caméra prend un peu de recul ; dans un intérieur, elle se rapproche et plonge.
  const inside = player.currentIsland()?.interior
  zoom += ((vehicles.driving || vehicles.traveling ? 1.3 : 1) - zoom) * (1 - Math.exp(-dt * 2))
  viewOffset.lerp(inside ? indoorOffset : cameraOffset, 1 - Math.exp(-dt * 5))
  if (cameraTarget.distanceToSquared(focus) < 0.01 && inside !== wasInside) viewOffset.copy(inside ? indoorOffset : cameraOffset)
  wasInside = inside
  camera.position.copy(cameraTarget).addScaledVector(viewOffset, zoom)
  lookAt.set(cameraTarget.x, cameraTarget.y + 1.5, cameraTarget.z)
  // Écran d'accueil : gros plan sur l'avatar qui salue, puis glissement vers la vue de jeu.
  introBlend = started ? Math.min(1, introBlend + dt / 1.4) : 0
  if (introBlend < 1) {
    const k = introBlend * introBlend * (3 - 2 * introBlend)
    const portrait = innerWidth / innerHeight < 1 || innerWidth < 760
    introPos.set(p.x + (portrait ? 0 : -1.2), p.y + (portrait ? 2.2 : 2.1), p.z + (portrait ? 8 : 6.4))
    introLook.set(p.x + (portrait ? 0 : -1.9), p.y + (portrait ? -0.45 : 1.25), p.z)
    camera.position.lerpVectors(introPos, camera.position, k)
    lookAt.lerpVectors(introLook, lookAt, k)
  }
  camera.lookAt(lookAt)
}
const lookAt = new THREE.Vector3()
const introPos = new THREE.Vector3()
const introLook = new THREE.Vector3()
const headPos = new THREE.Vector3()

// Qualité adaptative : si l'ordinateur peine (moins de ~45 images/s), on retire d'abord
// l'occlusion ambiante, puis on baisse la résolution, pour garder un mouvement fluide.
let frameAvg = 1 / 60
let frameCount = 0
let quality = params.has('lite') ? 2 : 0
const applyQuality = () => {
  if (ao) ao.enabled = quality < 1
  const ratio = [Math.min(devicePixelRatio, 2), Math.min(devicePixelRatio, 1.5), 1, 0.8][quality]
  renderer.setPixelRatio(ratio)
  composer.setPixelRatio(ratio)
  if (quality >= 3 && sun.shadow.mapSize.x !== 1024) {
    sun.shadow.mapSize.setScalar(1024)
    sun.shadow.map?.dispose()
    sun.shadow.map = null
  }
}
function adaptQuality() {
  const frame = timer.getDelta()
  frameAvg += (Math.min(frame, 0.1) - frameAvg) * 0.05
  if (++frameCount < 90 || quality >= 3 || frame <= 0) return
  if (frameAvg > 1 / 45) {
    quality++
    frameCount = 0
    applyQuality()
  }
}
if (quality) applyQuality()

let lastIsland = null
let dayTick = -1
const timer = new THREE.Timer()

function tick() {
  timer.update()
  const dt = Math.min(timer.getDelta(), 0.05)
  const t = timer.getElapsed()

  if (!vehicles.traveling && !vehicles.driving) player.update(dt, started && !ui.panelOpen() && !games.frozen && !tour.active)
  npcFocus.copy(player.position)
  vehicles.update(dt, t, player, started && !ui.panelOpen())
  pushables.update(dt, player)
  controls.update(dt)
  if (started) minimap.update(dt)
  world.update(dt, t)
  games.update(dt, t)
  space.update(dt, t)
  quest.update(dt, t)
  socialStones.update(dt, t)
  projectPlaces.update(dt, t, player)
  banner.update(dt, t)
  tour.update(dt)

  updateCamera(dt)

  // Météo et cycle jour/nuit ; ambiance sonore et bruits de pas.
  const here = player.currentIsland()
  weather.setEra(here?.interior ? 'interior' : here?.era)
  const { day } = weather.update(dt, t, cameraTarget)
  space.setDay(day)
  if (started && ((t * 2) | 0) !== dayTick) {
    dayTick = (t * 2) | 0
    ui.setDay(weather.label())
  }
  sfx.setEra(here?.era)
  const walkSpeed = player.grounded && !vehicles.driving && !vehicles.traveling ? Math.hypot(player.velocity.x, player.velocity.z) : 0
  sfx.update(dt, started ? walkSpeed : 0, here?.interior ? 'interior' : here?.era)
  if (!started) {
    headPos.set(player.position.x, player.position.y + 2.55, player.position.z).project(camera)
    ui.setHello((headPos.x * 0.5 + 0.5) * innerWidth, Math.max(56, (-headPos.y * 0.5 + 0.5) * innerHeight), headPos.z < 1)
  }

  updateFades(dt)
  // Le soleil tourne avec les heures : les ombres s'allongent et changent de côté.
  const sunAngle = weather.state.phase * Math.PI * 2
  sun.position.set(cameraTarget.x + Math.cos(sunAngle) * 26, 22 + 22 * day, cameraTarget.z + 12 + Math.sin(sunAngle) * 14)
  sun.target.position.copy(cameraTarget)

  nearby = started && !vehicles.traveling && !vehicles.driving ? findNearby() : null
  doorCooldown -= dt
  if (nearby?.type === 'door' && nearby.auto && doorCooldown <= 0 && !ui.panelOpen() && Math.hypot(player.position.x - nearby.x, player.position.z - nearby.z) < 0.95) enterDoor(nearby)
  ui.setPrompt(vehicles.driving ? vehicles.hint : nearby && !ui.panelOpen() && !tour.active ? ({ chest: quest.opened || discovered.size >= signs.length ? `E · Ouvrir « ${nearby.title} »` : `E · ${nearby.title} (${discovered.size} / ${signs.length})`, sign: nearby.showcase ? `E · Voir « ${nearby.showcase.project.title} » · marche sur les flèches pour changer` : `E · Lire « ${nearby.title} »`, vehicle: `E · ${nearby.id === 'car' ? nearby.title : `Monter : ${nearby.title}`}`, game: games.active ? null : `E · Jouer : ${nearby.title}`, door: `E · ${nearby.title}`, social: `E · ${nearby.title}` })[nearby.type] : null)

  const island = here
  applyMood(island?.era, 1 - Math.exp(-dt * 2), day)
  if (island && island !== lastIsland && started) ui.showIsland(island.name, island.tagline)
  if (island && started) lastIsland = island

  composer.render()
  adaptQuality()
  requestAnimationFrame(tick)
}
tick()

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
  composer.setSize(window.innerWidth, window.innerHeight)
})
