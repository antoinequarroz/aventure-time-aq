import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js'
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

const ui = createUI()
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
function applyMood(era, k) {
  const m = MOODS[era]
  if (!m) return
  sun.color.lerp(m.sun, k)
  hemi.color.lerp(m.sky, k)
  hemi.groundColor.lerp(m.ground, k)
  rim.color.lerp(m.rim, k)
  sun.intensity += (m.sunI - sun.intensity) * k
  hemi.intensity += (m.hemiI - hemi.intensity) * k
  scene.fog.color.lerp(m.fog, k)
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
const interactables = [...world.interactables, ...vehicles.interactables]
const player = createPlayer(scene, world)
const minimap = createMinimap({ world, player, interactables, eraOf: (x) => (x < -75 ? 'past' : x > 75 ? 'future' : 'present') })
const games = createGames(scene, ui, player)
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
    state: () => ({ nearby: nearby?.title, doorCooldown, doorBusy, panel: ui.panelOpen() }),
    setCamera(x, y, z) {
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
const controls = createControls({
  canvas: renderer.domElement,
  camera,
  scene,
  player,
  onInteract: () => interact(),
  isActive: () => started && !vehicles.traveling && !vehicles.driving && !ui.panelOpen(),
})
ui.onStart(() => {
  started = true
  controls.focus()
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
window.addEventListener('keydown', (e) => {
  if (!started || vehicles.traveling) return
  if (e.code === 'Escape') {
    if (ui.panelOpen()) ui.closePanel()
    else games.abort()
  }
  if (e.code === 'KeyE') interact()
})

function interact() {
  if (!started || vehicles.traveling) return
  if (vehicles.driving) return vehicles.exit(player)
  if (ui.panelOpen()) return ui.closePanel()
  if (!nearby) return
  if (nearby.type === 'sign') {
    discovered.add(nearby.title)
    try {
      localStorage.setItem(DISCOVERED_KEY, JSON.stringify([...discovered]))
    } catch {
      // Navigation privée : la progression n'est pas gardée.
    }
    const total = interactables.filter((i) => i.type === 'sign').length
    ui.openPanel({ ...nearby, count: `Découverts : ${discovered.size} / ${total}` })
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
  camera.lookAt(cameraTarget.x, cameraTarget.y + 1.5, cameraTarget.z)
}

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
const timer = new THREE.Timer()

function tick() {
  timer.update()
  const dt = Math.min(timer.getDelta(), 0.05)
  const t = timer.getElapsed()

  if (!vehicles.traveling && !vehicles.driving) player.update(dt, started && !ui.panelOpen() && !games.frozen)
  npcFocus.copy(player.position)
  vehicles.update(dt, t, player, started && !ui.panelOpen())
  pushables.update(dt, player)
  controls.update(dt)
  if (started) minimap.update(dt)
  world.update(dt, t)
  games.update(dt, t)
  space.update(dt, t)

  updateCamera(dt)

  updateFades(dt)
  sun.position.set(cameraTarget.x + 20, 40, cameraTarget.z + 15)
  sun.target.position.copy(cameraTarget)

  nearby = started && !vehicles.traveling && !vehicles.driving ? findNearby() : null
  doorCooldown -= dt
  if (nearby?.type === 'door' && nearby.auto && doorCooldown <= 0 && !ui.panelOpen() && Math.hypot(player.position.x - nearby.x, player.position.z - nearby.z) < 0.95) enterDoor(nearby)
  ui.setPrompt(vehicles.driving ? vehicles.hint : nearby && !ui.panelOpen() ? ({ sign: `E · Lire « ${nearby.title} »`, vehicle: `E · ${nearby.id === 'car' ? nearby.title : `Monter : ${nearby.title}`}`, game: games.active ? null : `E · Jouer : ${nearby.title}`, door: `E · ${nearby.title}` })[nearby.type] : null)

  const island = player.currentIsland()
  applyMood(island?.era, 1 - Math.exp(-dt * 2))
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
