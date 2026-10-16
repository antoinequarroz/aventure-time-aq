import * as THREE from 'three'
import './style.css'
import { createSpace } from './world/space.js'
import { createIslands } from './world/islands.js'
import { createPlayer } from './player.js'
import { createUI } from './ui.js'

const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
document.getElementById('app').appendChild(renderer.domElement)

const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000)

scene.add(new THREE.HemisphereLight(0xbcd4ff, 0x3a2f4a, 1.2))
const sun = new THREE.DirectionalLight(0xfff1dd, 2.2)
sun.castShadow = true
sun.shadow.mapSize.set(2048, 2048)
Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 120 })
scene.add(sun, sun.target)

const space = createSpace(scene)
const world = createIslands(scene)
const player = createPlayer(scene, world)
const ui = createUI()

// Accès de débogage : ouvrir le site avec ?debug pour piloter le joueur depuis la console.
if (new URLSearchParams(location.search).has('debug')) window.__game = { player, world }

// Caméra fixe en trois-quarts, qui suit le joueur en douceur.
const cameraOffset = new THREE.Vector3(0, 14, 19)
const cameraTarget = player.position.clone()
camera.position.copy(player.position).add(cameraOffset)

let started = false
ui.onStart(() => { started = true })

let nearby = null
window.addEventListener('keydown', (e) => {
  if (!started) return
  if (e.code === 'Escape') ui.closePanel()
  if (e.code !== 'KeyE') return
  if (ui.panelOpen()) return ui.closePanel()
  if (!nearby) return
  if (nearby.type === 'sign') ui.openPanel(nearby.title, nearby.text)
  if (nearby.type === 'portal') ui.fade(() => {
    player.teleport(nearby.target)
    camera.position.copy(player.position).add(cameraOffset)
    cameraTarget.copy(player.position)
  })
})

function findNearby() {
  for (const item of world.interactables) {
    const dx = player.position.x - item.x
    const dz = player.position.z - item.z
    if (dx * dx + dz * dz < item.r * item.r && player.position.y > -1) return item
  }
  return null
}

let lastIsland = null
const clock = new THREE.Clock()

function tick() {
  const dt = Math.min(clock.getDelta(), 0.05)
  const t = clock.elapsedTime

  player.update(dt, started && !ui.panelOpen())
  world.update(dt, t)
  space.update(dt)

  cameraTarget.lerp(player.position, 1 - Math.exp(-dt * 6))
  camera.position.lerp(cameraTarget.clone().add(cameraOffset), 1 - Math.exp(-dt * 4))
  camera.lookAt(cameraTarget.x, cameraTarget.y + 1.5, cameraTarget.z)

  sun.position.set(cameraTarget.x + 20, 40, cameraTarget.z + 15)
  sun.target.position.copy(cameraTarget)

  nearby = started ? findNearby() : null
  ui.setPrompt(nearby && !ui.panelOpen() ? (nearby.type === 'sign' ? `E · Lire « ${nearby.title} »` : `E · ${nearby.title}`) : null)

  const island = player.currentIsland()
  if (island && island !== lastIsland && started) ui.showIsland(island.name, island.tagline)
  if (island && started) lastIsland = island

  renderer.render(scene, camera)
  requestAnimationFrame(tick)
}
tick()

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
})
