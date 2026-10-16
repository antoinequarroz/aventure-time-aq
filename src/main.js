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
import { loadModels } from './world/models.js'
import { createPlayer } from './player.js'
import { createUI } from './ui.js'
import { createGames } from './games.js'

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
if (!lowEnd && !params.has('noao')) {
  const ao = new GTAOPass(scene, camera, window.innerWidth, window.innerHeight)
  ao.updateGtaoMaterial({ radius: 1.2, distanceExponent: 1.5, thickness: 1.5, scale: 1.2 })
  ao.blendIntensity = 0.85
  composer.addPass(ao)
}
const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.55, 0.6, 0.85)
composer.addPass(bloom)
composer.addPass(new OutputPass())

// Ambiance lumineuse propre à chaque époque, avec un fondu en changeant d'île.
const MOODS = {
  past: { sun: new THREE.Color(0xffd29a), sky: new THREE.Color(0xb4c4ff), ground: new THREE.Color(0x5a3d50), rim: new THREE.Color(0xff9b6b), sunI: 2.9 },
  present: { sun: new THREE.Color(0xffe8c4), sky: new THREE.Color(0xa9c8ff), ground: new THREE.Color(0x4a3a60), rim: new THREE.Color(0x9b7bff), sunI: 2.8 },
  future: { sun: new THREE.Color(0xe4ecff), sky: new THREE.Color(0x9fa8ff), ground: new THREE.Color(0x3a3470), rim: new THREE.Color(0xc07bff), sunI: 2.6 },
}
function applyMood(era, k) {
  const m = MOODS[era]
  if (!m) return
  sun.color.lerp(m.sun, k)
  hemi.color.lerp(m.sky, k)
  hemi.groundColor.lerp(m.ground, k)
  rim.color.lerp(m.rim, k)
  sun.intensity += (m.sunI - sun.intensity) * k
}

const space = createSpace(scene)
const world = createIslands(scene)
const vehicles = createVehicles(scene)

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
const games = createGames(scene, ui, player)
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
    teleport(x, z) {
      player.teleport(new THREE.Vector3(x, world.groundAt(x, z, Infinity, true) ?? 0, z))
      cameraTarget.copy(player.position)
      camera.position.copy(player.position).add(cameraOffset)
    },
  }
}

let started = false
ui.onStart(() => { started = true })

let nearby = null
window.addEventListener('keydown', (e) => {
  if (!started || vehicles.traveling) return
  if (e.code === 'Escape') {
    if (ui.panelOpen()) ui.closePanel()
    else games.abort()
  }
  if (e.code !== 'KeyE') return
  if (ui.panelOpen()) return ui.closePanel()
  if (!nearby) return
  if (nearby.type === 'sign') ui.openPanel(nearby.title, nearby.text, nearby.links)
  if (nearby.type === 'vehicle') {
    games.abort()
    vehicles.start(nearby, player)
  }
  if (nearby.type === 'game') games.start(nearby.game)
})

function findNearby() {
  for (const item of interactables) {
    const dx = player.position.x - item.x
    const dz = player.position.z - item.z
    if (dx * dx + dz * dz < item.r * item.r && player.position.y > -1) return item
  }
  return null
}

let lastIsland = null
const timer = new THREE.Timer()

function tick() {
  timer.update()
  const dt = Math.min(timer.getDelta(), 0.05)
  const t = timer.getElapsed()

  if (!vehicles.traveling) player.update(dt, started && !ui.panelOpen())
  vehicles.update(dt, t)
  world.update(dt, t)
  games.update(dt, t)
  space.update(dt, t)

  cameraTarget.lerp(player.position, 1 - Math.exp(-dt * 6))
  camera.position.lerp(cameraTarget.clone().add(cameraOffset), 1 - Math.exp(-dt * 4))
  camera.lookAt(cameraTarget.x, cameraTarget.y + 1.5, cameraTarget.z)

  updateFades(dt)
  sun.position.set(cameraTarget.x + 20, 40, cameraTarget.z + 15)
  sun.target.position.copy(cameraTarget)

  nearby = started && !vehicles.traveling ? findNearby() : null
  ui.setPrompt(nearby && !ui.panelOpen() ? ({ sign: `E · Lire « ${nearby.title} »`, vehicle: `E · Monter : ${nearby.title}`, game: games.active ? null : `E · Jouer : ${nearby.title}` })[nearby.type] : null)

  const island = player.currentIsland()
  applyMood(island?.era, 1 - Math.exp(-dt * 2))
  if (island && island !== lastIsland && started) ui.showIsland(island.name, island.tagline)
  if (island && started) lastIsland = island

  composer.render()
  requestAnimationFrame(tick)
}
tick()

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
  composer.setSize(window.innerWidth, window.innerHeight)
})
