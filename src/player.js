import * as THREE from 'three'
import { model as loadModel, animate } from './world/models.js'
import { ISLAND_RADIUS } from './world/islands.js'

const WALK = 6
const RUN = 11
const JUMP = 7
const GRAVITY = 22
const RADIUS = 0.5

export function createPlayer(scene, { colliders, islands, spawn }) {
  const model = loadModel('character', { height: 2 })
  scene.add(model)
  const { mixer, actions } = animate(model, 'idle')
  actions.jump.setLoop(THREE.LoopOnce)
  actions.jump.clampWhenFinished = true
  let current = actions.idle
  const play = (name, timeScale = 1) => {
    const next = actions[name]
    next.timeScale = timeScale
    if (next === current) return
    next.reset().fadeIn(0.15).play()
    current.fadeOut(0.15)
    current = next
  }

  const position = spawn.clone()
  const velocity = new THREE.Vector3()
  const keys = new Set()
  let grounded = true
  let facing = 0
  let respawnPoint = spawn.clone()
  let jumpRequested = false

  window.addEventListener('keydown', (e) => {
    keys.add(e.code)
    if (e.code === 'Space') jumpRequested = true
  })
  window.addEventListener('keyup', (e) => keys.delete(e.code))
  window.addEventListener('blur', () => keys.clear())

  const pressed = (...codes) => codes.some((c) => keys.has(c))

  function currentIsland() {
    for (const island of islands) {
      const dx = position.x - island.center.x
      const dz = position.z - island.center.z
      if (dx * dx + dz * dz < ISLAND_RADIUS * ISLAND_RADIUS) return island
    }
    return null
  }

  function update(dt, enabled) {
    // e.code = position physique de la touche : KeyW couvre Z en AZERTY et W en QWERTY.
    const input = new THREE.Vector2(
      (pressed('KeyD', 'ArrowRight') ? 1 : 0) - (pressed('KeyA', 'ArrowLeft') ? 1 : 0),
      (pressed('KeyS', 'ArrowDown') ? 1 : 0) - (pressed('KeyW', 'ArrowUp') ? 1 : 0),
    )
    if (!enabled) input.set(0, 0)
    const moving = input.lengthSq() > 0
    if (moving) input.normalize()
    const speed = pressed('ShiftLeft', 'ShiftRight') ? RUN : WALK

    velocity.x = input.x * speed
    velocity.z = input.y * speed
    if (jumpRequested && grounded && enabled) velocity.y = JUMP
    jumpRequested = false
    velocity.y -= GRAVITY * dt
    position.addScaledVector(velocity, dt)

    // Sol : uniquement sur une île. Hors de l'île, on tombe dans le vide.
    const island = currentIsland()
    if (island && position.y <= 0 && position.y > -1.5) {
      position.y = 0
      velocity.y = 0
      grounded = true
    } else {
      grounded = false
    }
    if (island && grounded) respawnPoint.set(island.center.x, 0, island.center.z + 4)

    if (position.y < -40) {
      position.copy(respawnPoint)
      velocity.set(0, 0, 0)
    }

    // Collisions simples par cercles.
    for (const c of colliders) {
      const dx = position.x - c.x
      const dz = position.z - c.z
      const min = c.r + RADIUS
      const d2 = dx * dx + dz * dz
      if (d2 < min * min && position.y < 6) {
        const d = Math.sqrt(d2) || 0.0001
        position.x = c.x + (dx / d) * min
        position.z = c.z + (dz / d) * min
      }
    }

    // Orientation et animation de marche.
    if (moving) {
      const target = Math.atan2(input.x, input.y)
      let diff = target - facing
      diff = Math.atan2(Math.sin(diff), Math.cos(diff))
      facing += diff * Math.min(1, dt * 12)
    }
    if (!grounded) play('jump')
    else if (moving) play('walk', speed === RUN ? 2.2 : 1.5)
    else play('idle')
    mixer.update(dt)

    model.position.copy(position)
    model.rotation.y = facing
  }

  return {
    position,
    update,
    currentIsland,
    setVisible(visible) {
      model.visible = visible
    },
    teleport(target) {
      model.position.copy(target)
      position.copy(target)
      velocity.set(0, 0, 0)
      respawnPoint.copy(target)
    },
  }
}
