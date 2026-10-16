import * as THREE from 'three'
import { model as loadModel, animate } from './world/models.js'
import { mat, mesh } from './world/helpers.js'

const WALK = 6
const RUN = 11
const JUMP = 7.5
const GRAVITY = 22
const RADIUS = 0.5
const COYOTE = 0.12
const JUMP_BUFFER = 0.15

export function createPlayer(scene, world) {
  const { colliders, islands, spawn } = world
  const model = loadModel('character', { height: 2 })
  scene.add(model)
  const body = model.children[0]
  const baseScale = body.scale.x
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

  const outfits = createOutfits(model.userData.root)
  const dust = createDust(scene)

  const position = spawn.clone()
  const velocity = new THREE.Vector3()
  const keys = new Set()
  let grounded = true
  let facing = 0
  const safePoint = spawn.clone()
  let checkpoint = null
  let sinceGrounded = 0
  let jumpBuffer = 0
  let squash = 0
  let dustTimer = 0
  let era = null

  window.addEventListener('keydown', (e) => {
    keys.add(e.code)
    if (e.code === 'Space') jumpBuffer = JUMP_BUFFER
  })
  window.addEventListener('keyup', (e) => {
    keys.delete(e.code)
    // Saut plus court si on relâche tôt.
    if (e.code === 'Space' && velocity.y > 0) velocity.y *= 0.55
  })
  window.addEventListener('blur', () => keys.clear())

  const pressed = (...codes) => codes.some((c) => keys.has(c))

  // Île (principale ou petite) sous le joueur, la plus petite qui le contient.
  function currentIsland() {
    let found = null
    for (const island of islands) {
      const dx = position.x - island.center.x
      const dz = position.z - island.center.z
      if (dx * dx + dz * dz < island.radius * island.radius && (!found || island.radius < found.radius)) found = island
    }
    return found
  }

  function respawn() {
    position.copy(checkpoint ?? safePoint)
    velocity.set(0, 0, 0)
  }

  function update(dt, enabled) {
    const island = currentIsland()
    if (island && island.era !== era) {
      era = island.era
      outfits.wear(era)
    }
    const gravity = GRAVITY * (island?.gravity ?? (era === 'future' ? 0.45 : 1))

    // e.code = position physique de la touche : KeyW couvre Z en AZERTY et W en QWERTY.
    const input = new THREE.Vector2(
      (pressed('KeyD', 'ArrowRight') ? 1 : 0) - (pressed('KeyA', 'ArrowLeft') ? 1 : 0),
      (pressed('KeyS', 'ArrowDown') ? 1 : 0) - (pressed('KeyW', 'ArrowUp') ? 1 : 0),
    )
    if (!enabled) input.set(0, 0)
    const moving = input.lengthSq() > 0
    if (moving) input.normalize()
    const running = pressed('ShiftLeft', 'ShiftRight')
    const speed = running ? RUN : WALK

    // Accélération douce pour un mouvement moins rigide.
    const response = grounded ? 14 : 6
    velocity.x += (input.x * speed - velocity.x) * Math.min(1, dt * response)
    velocity.z += (input.y * speed - velocity.z) * Math.min(1, dt * response)

    jumpBuffer -= dt
    sinceGrounded = grounded ? 0 : sinceGrounded + dt
    if (enabled && jumpBuffer > 0 && sinceGrounded < COYOTE) {
      velocity.y = JUMP
      grounded = false
      sinceGrounded = COYOTE
      jumpBuffer = 0
      dust.puff(position, 4)
    }
    velocity.y -= gravity * dt
    position.addScaledVector(velocity, dt)

    // Sol : îles, passerelles et plateformes. Ailleurs, c'est le vide.
    const ground = world.groundAt(position.x, position.z, position.y)
    const wasGrounded = grounded
    if (ground !== null && velocity.y <= 0 && position.y <= ground && position.y > ground - 1.5) {
      if (!wasGrounded && velocity.y < -8) {
        squash = 1
        dust.puff(position, 8)
      }
      position.y = ground
      velocity.y = 0
      grounded = true
      if (ground === 0) safePoint.copy(position)
    } else if (ground === null || position.y > ground + 0.05) {
      grounded = false
    }

    if (position.y < -40) respawn()

    // Collisions simples par cercles (ignorées si on passe au-dessus).
    for (const c of colliders) {
      const dx = position.x - c.x
      const dz = position.z - c.z
      const min = c.r + RADIUS
      const d2 = dx * dx + dz * dz
      if (d2 < min * min && position.y < c.top - 0.2) {
        const d = Math.sqrt(d2) || 0.0001
        position.x = c.x + (dx / d) * min
        position.z = c.z + (dz / d) * min
      }
    }

    // Orientation, animation et petits effets.
    if (moving) {
      const target = Math.atan2(input.x, input.y)
      let diff = target - facing
      diff = Math.atan2(Math.sin(diff), Math.cos(diff))
      facing += diff * Math.min(1, dt * 12)
    }
    if (!grounded) play('jump')
    else if (moving) play('walk', running ? 2.2 : 1.5)
    else play('idle')
    mixer.update(dt)

    dustTimer -= dt
    if (grounded && moving && running && dustTimer <= 0) {
      dust.puff(position, 1)
      dustTimer = 0.07
    }
    dust.update(dt)

    squash = Math.max(0, squash - dt * 5)
    const s = Math.sin(squash * Math.PI) * 0.25
    body.scale.set(baseScale * (1 + s), baseScale * (1 - s), baseScale * (1 + s))

    model.position.copy(position)
    model.rotation.y = facing
    outfits.update(velocity)
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
      if (target.y === 0) safePoint.copy(target)
    },
    setCheckpoint(point) {
      checkpoint = point.clone()
    },
    clearCheckpoint() {
      checkpoint = null
    },
  }
}

// Tenues selon l'époque : casque et cape de chevalier, casquette et sac du dev, bulle de cosmonaute.
function createOutfits(root) {
  const torso = root.getObjectByName('torso')
  const antenna = root.getObjectByName('antenna')
  const sets = {}

  const knight = new THREE.Group()
  const steel = mat(0xb8bcc4, { metalness: 0.7, roughness: 0.35 })
  knight.add(mesh(new THREE.CylinderGeometry(0.34, 0.36, 0.24, 12), steel, { y: 0.62 }))
  knight.add(mesh(new THREE.SphereGeometry(0.34, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), steel, { y: 0.74 }))
  const plume = mesh(new THREE.ConeGeometry(0.08, 0.45, 6), mat(0xc0392b), { y: 1.12, z: -0.05 })
  plume.rotation.x = -0.4
  knight.add(plume)
  const cape = mesh(new THREE.PlaneGeometry(0.62, 0.62, 1, 4), mat(0xc0392b, { side: THREE.DoubleSide }), { y: 0.02, z: -0.34 })
  knight.add(cape)
  sets.past = knight

  const dev = new THREE.Group()
  dev.add(mesh(new THREE.SphereGeometry(0.33, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(0x1f3b57), { y: 0.58 }))
  dev.add(mesh(new THREE.BoxGeometry(0.4, 0.04, 0.28), mat(0x1f3b57), { y: 0.6, z: 0.3 }))
  dev.add(mesh(new THREE.BoxGeometry(0.42, 0.42, 0.18), mat(0xe67e22), { y: 0.02, z: -0.32 }))
  dev.add(mesh(new THREE.BoxGeometry(0.3, 0.2, 0.05), mat(0x6fd3ff, { emissive: 0x6fd3ff, emissiveIntensity: 0.6 }), { y: 0.05, z: -0.42, shadow: false }))
  sets.present = dev

  const astro = new THREE.Group()
  astro.add(mesh(new THREE.SphereGeometry(0.46, 20, 14), mat(0xa8d8ff, { transparent: true, opacity: 0.35, roughness: 0.05, metalness: 0.2 }), { y: 0.4, shadow: false }))
  astro.add(mesh(new THREE.TorusGeometry(0.4, 0.05, 6, 20), mat(0xdddddd), { y: 0.05 }).rotateX(Math.PI / 2))
  for (const x of [-0.12, 0.12]) astro.add(mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.42, 10), mat(0xf2f2f2), { x, y: 0.05, z: -0.35 }))
  astro.add(mesh(new THREE.SphereGeometry(0.05, 6, 4), mat(0xff4a4a, { emissive: 0xff2a2a, emissiveIntensity: 2 }), { y: 0.3, z: -0.48, shadow: false }))
  sets.future = astro

  for (const set of Object.values(sets)) {
    set.visible = false
    torso.add(set)
  }

  return {
    wear(era) {
      for (const [key, set] of Object.entries(sets)) set.visible = key === era
      if (antenna) antenna.visible = era === 'future'
    },
    update(velocity) {
      // La cape flotte selon la vitesse.
      const speed = Math.hypot(velocity.x, velocity.z)
      cape.rotation.x = -Math.min(0.9, speed * 0.08) - Math.max(0, velocity.y) * 0.03
    },
  }
}

// Petits nuages de poussière sous les pieds.
function createDust(scene) {
  const parts = []
  const geometry = new THREE.IcosahedronGeometry(0.18, 0)
  return {
    puff(position, count) {
      for (let i = 0; i < count; i++) {
        const p = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: 0xe8e0d0, transparent: true, opacity: 0.7 }))
        p.position.set(position.x + (Math.random() - 0.5) * 0.5, position.y + 0.1, position.z + (Math.random() - 0.5) * 0.5)
        p.userData.v = new THREE.Vector3((Math.random() - 0.5) * 2, Math.random() * 1.2, (Math.random() - 0.5) * 2)
        p.userData.life = 0.5
        scene.add(p)
        parts.push(p)
      }
    },
    update(dt) {
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i]
        p.userData.life -= dt
        p.position.addScaledVector(p.userData.v, dt)
        p.scale.setScalar(1 + (0.5 - p.userData.life) * 3)
        p.material.opacity = Math.max(0, p.userData.life * 1.4)
        if (p.userData.life <= 0) {
          scene.remove(p)
          p.material.dispose()
          parts.splice(i, 1)
        }
      }
    },
  }
}
