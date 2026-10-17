import * as THREE from 'three'
import { animate } from './world/models.js'
import { character, spaceSuit } from './world/characters.js'

const WALK = 6
const RUN = 11
const JUMP = 7.5
const GRAVITY = 22
const RADIUS = 0.5
const COYOTE = 0.12
const JUMP_BUFFER = 0.15

export function createPlayer(scene, world) {
  const { colliders, islands, spawn } = world
  // Un avatar par époque (KayKit) : chevalier au Passé, développeur au Présent, cosmonaute au Futur.
  const model = new THREE.Group()
  scene.add(model)
  const body = model
  const baseScale = 1
  // Le personnage choisi sur l'écran d'accueil garde le même visage partout ;
  // seule la tenue change : équipé au Passé, en civil au Présent, en scaphandre au Futur.
  let avatars = {}
  const rigs = {}
  let rig = null
  let shownEra = 'past'
  let characterKey = null
  let waving = false
  function setCharacter(key) {
    if (!PAST_GEAR[key] || key === characterKey) return
    characterKey = key
    for (const avatar of Object.values(avatars)) model.remove(avatar)
    avatars = {
      past: character(key, { keep: PAST_GEAR[key] }),
      present: character(key, { keep: [] }),
      future: character(key, { keep: [] }),
    }
    spaceSuit(avatars.future)
    for (const [k, avatar] of Object.entries(avatars)) {
      avatar.visible = false
      model.add(avatar)
      const { mixer, actions } = animate(avatar, 'Idle')
      actions.Jump_Idle.setLoop(THREE.LoopRepeat)
      rigs[k] = { mixer, actions, current: actions.Idle, arm: armBones(avatar) }
      if (waving) for (const o of rigs[k].arm?.held ?? []) o.visible = false
    }
    wear(shownEra)
  }
  const NAMES = { idle: 'Idle', walk: 'Walking_A', run: 'Running_A', jump: 'Jump_Idle', cheer: 'Cheer' }
  const play = (name, timeScale = 1) => {
    const next = rig.actions[NAMES[name]]
    next.timeScale = timeScale
    if (next === rig.current) return
    next.reset().fadeIn(0.18).play()
    rig.current.fadeOut(0.18)
    rig.current = next
  }
  function wear(key) {
    shownEra = key
    for (const [k, avatar] of Object.entries(avatars)) avatar.visible = k === key
    rig = rigs[key]
  }
  setCharacter('rogue')

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
  const prev = spawn.clone()
  let visualY = spawn.y
  let airTime = 0
  let cheerTime = 0

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

  // Commandes de secours (tactile et souris, voir controls.js) : joystick et point à rejoindre.
  const stick = new THREE.Vector2()
  let target = null
  let stuck = 0

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
    visualY = position.y
    velocity.set(0, 0, 0)
  }

  function update(dt, enabled) {
    const island = currentIsland()
    if (island && island.era !== era) {
      era = island.era
      wear(era)
    }
    const gravity = GRAVITY * (island?.gravity ?? (era === 'future' ? 0.45 : 1))

    // e.code = position physique de la touche : KeyW couvre Z en AZERTY et W en QWERTY.
    const input = new THREE.Vector2(
      (pressed('KeyD', 'ArrowRight') ? 1 : 0) - (pressed('KeyA', 'ArrowLeft') ? 1 : 0),
      (pressed('KeyS', 'ArrowDown') ? 1 : 0) - (pressed('KeyW', 'ArrowUp') ? 1 : 0),
    )
    let analog = 1
    if (input.lengthSq() > 0) target = null
    else if (stick.lengthSq() > 0.02) {
      input.copy(stick)
      analog = Math.min(1, stick.length() * 1.2)
      target = null
    } else if (target) {
      const dx = target.x - position.x
      const dz = target.y - position.z
      const d = Math.hypot(dx, dz)
      // Arrivé, ou bloqué contre un obstacle : on s'arrête.
      stuck = Math.hypot(velocity.x, velocity.z) < 0.6 ? stuck + dt : 0
      if (d < 0.35 || stuck > 0.5) target = null
      else input.set(dx, dz)
    }
    if (!enabled) input.set(0, 0)
    const moving = input.lengthSq() > 0
    if (moving) input.normalize().multiplyScalar(analog)
    const running = pressed('ShiftLeft', 'ShiftRight') || (stick.length() > 0.9) || (target && Math.hypot(target.x - position.x, target.y - position.z) > 6)
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
    prev.copy(position)
    position.addScaledVector(velocity, dt)

    // Sol : îles, passerelles et plateformes. Ailleurs, c'est le vide.
    const wasGroundedPrev = grounded
    const ground = world.groundAt(position.x, position.z, position.y)
    const wasGrounded = grounded
    // Accroche au sol : en descendant une rampe ou une petite marche, on reste collé au sol
    // au lieu de « décoller » à chaque image (ce qui faisait clignoter l'animation de saut).
    const snap = wasGroundedPrev && velocity.y <= 0 ? 0.65 : 0
    if (ground !== null && velocity.y <= 0 && position.y <= ground + snap && position.y > ground - 1.5) {
      if (!wasGrounded && velocity.y < -8) {
        squash = 1
        dust.puff(position, 8)
      }
      position.y = ground
      velocity.y = 0
      grounded = true
      if (world.groundAt(position.x, position.z, position.y, true) === ground) safePoint.copy(position)
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
    // Flancs des terrasses.
    world.pushOut(position)
    world.rails(position, prev)
    // Filet de sécurité : si on a quand même fini dans une falaise, on glisse le long du mur
    // (un seul axe) ou on reste sur place, au lieu d'être projeté ailleurs.
    if (world.blocked(position.x, position.z, position.y)) {
      if (!world.blocked(position.x, prev.z, position.y)) position.z = prev.z
      else if (!world.blocked(prev.x, position.z, position.y)) position.x = prev.x
      else {
        position.x = prev.x
        position.z = prev.z
      }
    }
    // Petites marches : le corps rattrape la hauteur en douceur au lieu de sauter d'un coup.
    if (grounded && wasGrounded) visualY += (position.y - visualY) * Math.min(1, dt * 16)
    else visualY = position.y
    airTime = grounded ? 0 : airTime + dt

    // Orientation, animation et petits effets.
    if (moving) {
      const target = Math.atan2(input.x, input.y)
      let diff = target - facing
      diff = Math.atan2(Math.sin(diff), Math.cos(diff))
      facing += diff * Math.min(1, dt * 12)
    }
    const speedNow = Math.hypot(velocity.x, velocity.z)
    cheerTime -= dt
    if (cheerTime > 0 && grounded && speedNow < 0.6) play('cheer')
    else if (!grounded && (airTime > 0.14 || velocity.y > 0)) play('jump')
    else if (speedNow > 7.5) play('run', speedNow / RUN * 1.1)
    else if (speedNow > 0.6) play('walk', Math.max(0.6, speedNow / WALK) * 1.15)
    else play('idle')
    rig.mixer.update(dt)
    if (waving && speedNow < 0.6 && grounded) wave(rig.arm, model, waving, performance.now() / 1000)

    dustTimer -= dt
    if (grounded && moving && running && dustTimer <= 0) {
      dust.puff(position, 1)
      dustTimer = 0.07
    }
    dust.update(dt)

    squash = Math.max(0, squash - dt * 5)
    const s = Math.sin(squash * Math.PI) * 0.25
    body.scale.set(baseScale * (1 + s), baseScale * (1 - s), baseScale * (1 + s))

    model.position.set(position.x, visualY, position.z)
    model.rotation.y = facing
  }

  return {
    position,
    velocity,
    stick,
    update,
    setStick(x, y) {
      stick.set(x, y)
    },
    setTarget(x, z) {
      target = new THREE.Vector2(x, z)
      stuck = -0.3
    },
    jump() {
      jumpBuffer = JUMP_BUFFER
    },
    currentIsland,
    setVisible(visible) {
      model.visible = visible
    },
    cheer() {
      cheerTime = 2.2
    },
    setCharacter,
    get character() {
      return characterKey
    },
    // Salut de la main (écran d'accueil), tourné vers `viewer` (position de la caméra).
    setWaving(viewer) {
      waving = viewer || false
      for (const r of Object.values(rigs)) for (const o of r.arm?.held ?? []) o.visible = !waving
    },
    face(angle) {
      facing = angle
      model.rotation.y = angle
    },
    get era() {
      return era
    },
    get grounded() {
      return grounded
    },
    teleport(target) {
      jumpBuffer = 0
      visualY = target.y
      model.position.copy(target)
      position.copy(target)
      velocity.set(0, 0, 0)
      safePoint.copy(target)
    },
    setCheckpoint(point) {
      checkpoint = point.clone()
    },
    clearCheckpoint() {
      checkpoint = null
    },
  }
}

// Équipement gardé au Passé pour chaque personnage.
const PAST_GEAR = {
  knight: ['1H_Sword', 'Badge_Shield', 'Knight_Helmet', 'Knight_Cape'],
  rogue: ['Knife', 'Rogue_Cape'],
  mage: ['1H_Wand', 'Mage_Hat', 'Mage_Cape'],
  barbarian: ['1H_Axe', 'Barbarian_Hat', 'Barbarian_Cape'],
}

function armBones(avatar) {
  // Le chargeur glTF retire les points des noms : « upperarm.r » devient « upperarmr ».
  const bone = (name) => avatar.getObjectByName(name) ?? avatar.getObjectByName(name.replace('.', ''))
  const upper = bone('upperarm.r')
  const lower = bone('lowerarm.r')
  const hand = bone('wrist.r') ?? bone('hand.r')
  const other = bone('upperarm.l')
  if (!upper || !lower || !hand || !other) return null
  // Objets tenus en main droite (épée, couteau…) : rangés pendant le salut.
  const slot = bone('handslot.r')
  const held = (slot?.children ?? []).filter((o) => o.visible)
  return { upper, lower, other, held, upperDir: lower.position.clone().normalize(), lowerDir: hand.position.clone().normalize() }
}

// Salut de la main, posé par-dessus l'animation : le bras droit se lève vers la caméra et l'avant-bras
// se balance. Les directions sont visées en coordonnées du monde, quel que soit l'axe des os du modèle.
const _q = new THREE.Quaternion()
const _v = new THREE.Vector3()
function aimBone(bone, localDir, worldDir) {
  bone.parent.getWorldQuaternion(_q)
  _v.copy(worldDir).normalize().applyQuaternion(_q.invert())
  bone.quaternion.setFromUnitVectors(localDir, _v)
  bone.updateMatrixWorld(true)
}
const _side = new THREE.Vector3()
const _fwd = new THREE.Vector3()
const _up = new THREE.Vector3(0, 1, 0)
const _dir = new THREE.Vector3()
function wave(arm, root, viewer, t) {
  if (!arm) return
  root.updateMatrixWorld(true)
  // Côté du bras droit : de l'épaule gauche vers l'épaule droite.
  arm.other.getWorldPosition(_fwd)
  arm.upper.getWorldPosition(_side)
  _side.sub(_fwd).setY(0).normalize()
  root.getWorldPosition(_fwd)
  _fwd.subVectors(viewer, _fwd).setY(0).normalize()
  aimBone(arm.upper, arm.upperDir, _dir.copy(_side).multiplyScalar(0.9).addScaledVector(_up, 0.3).addScaledVector(_fwd, 0.45))
  aimBone(arm.lower, arm.lowerDir, _dir.copy(_side).multiplyScalar(0.15 + Math.sin(t * 9) * 0.32).addScaledVector(_up, 1).addScaledVector(_fwd, 0.3))
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
