import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
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
renderer.shadowMap.type = THREE.PCFShadowMap
document.getElementById('app').appendChild(renderer.domElement)

const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1500)

// Éclairage : ciel bleuté, soleil chaud et contre-jour violet.
scene.add(new THREE.HemisphereLight(0xa9c2ff, 0x4a3560, 1.3))
const sun = new THREE.DirectionalLight(0xffe2b8, 2.8)
sun.castShadow = true
sun.shadow.mapSize.set(2048, 2048)
sun.shadow.bias = -0.0004
sun.shadow.normalBias = 0.03
Object.assign(sun.shadow.camera, { left: -32, right: 32, top: 32, bottom: -32, near: 1, far: 140 })
scene.add(sun, sun.target)
const rim = new THREE.DirectionalLight(0x9b7bff, 1.4)
rim.position.set(-30, 20, -40)
scene.add(rim)

// Post-traitement : léger bloom sur les éléments lumineux.
const composer = new EffectComposer(renderer)
composer.addPass(new RenderPass(scene, camera))
const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.55, 0.6, 0.85)
composer.addPass(bloom)
composer.addPass(new OutputPass())

const space = createSpace(scene)
const world = createIslands(scene)
const vehicles = createVehicles(scene)
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
      player.teleport(new THREE.Vector3(x, 0, z))
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

  sun.position.set(cameraTarget.x + 20, 40, cameraTarget.z + 15)
  sun.target.position.copy(cameraTarget)

  nearby = started && !vehicles.traveling ? findNearby() : null
  ui.setPrompt(nearby && !ui.panelOpen() ? ({ sign: `E · Lire « ${nearby.title} »`, vehicle: `E · Monter : ${nearby.title}`, game: games.active ? null : `E · Jouer : ${nearby.title}` })[nearby.type] : null)

  const island = player.currentIsland()
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
