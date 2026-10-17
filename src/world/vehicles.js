import * as THREE from 'three'
import { vehicles as labels } from '../content.js'
import { mat, mesh } from './helpers.js'
import { model } from './models.js'
import { THEMES } from './islands.js'

// Deux véhicules partagés : la voiture relie le passé et le présent,
// la fusée relie le présent et le futur. Chacun attend sur l'île où on l'a laissé.
export function createVehicles(scene, world) {
  const car = makeCar(scene, world)
  const rocket = makeVehicle(scene, {
    id: 'rocket',
    model: buildRocket(),
    stations: [
      { island: 'present', at: [17, 0], exit: [-3.5, 0] },
      { island: 'future', at: [-17, 0], exit: [3.5, 0] },
    ],
    duration: 6,
    height: 70,
    upright: true,
  })

  let trip = null
  const rocketCollider = { x: 0, z: 0, r: 1.5, top: 12, car: true }
  world.colliders.push(rocketCollider)

  return {
    interactables: [car.interactable, rocket.interactable],
    // Vol en cours (fusée ou voiture qui saute d'une île à l'autre) : aucune commande.
    get traveling() {
      return trip !== null || car.flying
    },
    // Au volant de la voiture (le joueur est caché, la voiture se pilote au clavier).
    get driving() {
      return car.driving
    },
    get hint() {
      return car.hint
    },
    start(interactable, player) {
      if (interactable === car.interactable) return car.enter(player)
      if (interactable !== rocket.interactable || trip) return
      trip = { vehicle: rocket, t: 0, player }
      player.setVisible(false)
    },
    exit(player) {
      car.exit(player)
    },
    update(dt, t, player, enabled) {
      car.update(dt, t, player, enabled)
      rocket.idle(t, trip !== null)
      rocketCollider.x = trip ? 1e6 : rocket.object.position.x
      rocketCollider.z = rocket.object.position.z
      if (!trip) return
      const { vehicle } = trip
      trip.t += dt / vehicle.duration
      const done = trip.t >= 1
      const pos = vehicle.fly(Math.min(trip.t, 1), t)
      trip.player.teleport(pos)
      if (done) {
        const exit = vehicle.arrive()
        trip.player.teleport(exit)
        trip.player.setVisible(true)
        trip = null
      }
    },
  }
}

function stationWorld(station) {
  const c = THEMES[station.island].center
  return {
    pos: new THREE.Vector3(c.x + station.at[0], 0, c.z + station.at[1]),
    exit: new THREE.Vector3(c.x + station.at[0] + station.exit[0], 0, c.z + station.at[1] + station.exit[1]),
  }
}

function makeVehicle(scene, { id, model, stations, duration, height, upright }) {
  scene.add(model)
  const world = stations.map(stationWorld)
  let index = 0
  const from = new THREE.Vector3()
  const to = new THREE.Vector3()
  const prev = new THREE.Vector3()
  const up = new THREE.Vector3(0, 1, 0)
  const axis = new THREE.Vector3()

  const interactable = {
    type: 'vehicle',
    id,
    r: 3.5,
    x: 0,
    z: 0,
    title: '',
  }

  function park() {
    const { pos } = world[index]
    model.position.copy(pos)
    model.quaternion.identity()
    // La voiture regarde vers l'autre île.
    if (!upright) model.lookAt(world[1 - index].pos.x, 0, world[1 - index].pos.z)
    interactable.x = pos.x
    interactable.z = pos.z
    const island = stations[index].island
    interactable.title = `${labels[id].label} vers le ${labels[id].to[island]}`
  }
  park()

  const pointAt = (k, target) => {
    const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2
    target.lerpVectors(from, to, e)
    // Fusée : décollage vertical marqué ; voiture : grand saut en arc.
    const lift = upright ? Math.sin(Math.PI * Math.pow(k, 0.7)) : Math.sin(Math.PI * k)
    target.y += lift * height
    return target
  }

  return {
    interactable,
    object: model,
    duration,
    fly(k, t) {
      if (k === 0 || prev.lengthSq() === 0) {
        from.copy(world[index].pos)
        to.copy(world[1 - index].pos)
      }
      const pos = pointAt(k, new THREE.Vector3())
      const ahead = pointAt(Math.min(k + 0.01, 1), new THREE.Vector3())
      const dir = ahead.sub(pos)
      if (dir.lengthSq() > 1e-6) {
        dir.normalize()
        if (upright) {
          // Décollage nez en avant, puis la fusée se redresse pour se poser debout, sur ses flammes.
          const flat = to.clone().sub(from).setY(0).normalize()
          const tilt = Math.sin(Math.PI * THREE.MathUtils.smoothstep(k, 0.08, 0.85)) * 1.1
          axis.copy(up).addScaledVector(flat, tilt).normalize()
          model.quaternion.setFromUnitVectors(up, axis)
        } else model.lookAt(pos.clone().add(dir))
      }
      model.position.copy(pos)
      prev.copy(pos)
      model.userData.onFly?.(t)
      return pos.clone()
    },
    arrive() {
      index = 1 - index
      prev.set(0, 0, 0)
      park()
      model.userData.onPark?.()
      return world[index].exit.clone()
    },
    idle(t, flying) {
      if (!flying) model.userData.onIdle?.(t)
    },
  }
}

// Pick-up rouge (Racing Kit de Kenney), qu'on conduit comme chez Bruno Simon :
// Z/W ou flèche haut pour accélérer, S pour freiner et reculer, Q/A et D pour tourner,
// Espace pour le frein à main (dérapage). Un tremplin au bord de l'île du Passé et de celle
// du Présent fait sauter la voiture jusqu'à l'autre île.
const CAR = { accel: 16, brake: 30, max: 19, reverse: 7, drag: 0.6, grip: 7, turn: 2.3, gravity: 24, length: 1.6 }

function makeCar(scene, world) {
  const ramps = [
    { island: 'past', at: [19, 0] },
    { island: 'present', at: [-19, 0] },
  ].map((r) => {
    const c = THEMES[r.island].center
    const pos = new THREE.Vector3(c.x + r.at[0], 0, c.z + r.at[1])
    const out = Math.sign(r.at[0])
    // Place de parking, un peu à l'intérieur de l'île, et sens vers le tremplin.
    const park = new THREE.Vector3(pos.x - out * 7, 0, pos.z)
    const heading = out > 0 ? Math.PI / 2 : -Math.PI / 2
    const ramp = buildRamp(labels.car.to[r.island])
    pos.y = world.groundAt(pos.x - out * 2.2, pos.z, Infinity, true) ?? 0
    ramp.position.copy(pos)
    ramp.rotation.y = heading
    scene.add(ramp)
    // Rampe praticable (voiture et joueur) ; le saut part du haut.
    world.addRamp({ ax: pos.x - out * 2.2, az: pos.z, ha: pos.y, bx: pos.x + out * 2.2, bz: pos.z, hb: pos.y + 1.1, w: 3.4 })
    const lip = new THREE.Vector3(pos.x + out * 1.4, pos.y, pos.z)
    return { ...r, pos, lip, park, heading, out }
  })
  for (const r of ramps) {
    r.park.y = world.groundAt(r.park.x, r.park.z, Infinity, true) ?? 0
    r.other = ramps.find((o) => o !== r)
  }

  const { object, wheels, body, lights } = buildCar()
  scene.add(object)
  const pos = ramps[0].park.clone()
  let heading = ramps[0].heading
  let speed = 0
  let side = 0 // glisse latérale (dérapage)
  let vy = 0
  let grounded = true
  let steer = 0
  let pitch = 0
  let roll = 0
  let driving = false
  let flight = null
  const keys = new Set()
  window.addEventListener('keydown', (e) => keys.add(e.code))
  window.addEventListener('keyup', (e) => keys.delete(e.code))
  window.addEventListener('blur', () => keys.clear())
  const pressed = (...codes) => codes.some((c) => keys.has(c))

  const dust = createPuffs(scene)
  const interactable = { type: 'vehicle', id: 'car', r: 3.6, x: pos.x, z: pos.z, title: 'Conduire la voiture' }
  const fwd = new THREE.Vector3()
  const tmp = new THREE.Vector3()

  const blockedAt = (x, z) => world.blocked(x, z, pos.y)
  function collide(prevX, prevZ) {
    // Cercles des décors : la voiture est vue comme deux cercles (avant et arrière).
    let hit = false
    for (const k of [-1, 1]) {
      const cx = pos.x + Math.sin(heading) * CAR.length * k
      const cz = pos.z + Math.cos(heading) * CAR.length * k
      for (const c of world.colliders) {
        if (c.car || pos.y > c.top - 0.2) continue
        const dx = cx - c.x
        const dz = cz - c.z
        const min = c.r + 1.05
        const d2 = dx * dx + dz * dz
        if (d2 < min * min) {
          const d = Math.sqrt(d2) || 0.001
          pos.x += (dx / d) * (min - d)
          pos.z += (dz / d) * (min - d)
          hit = true
        }
      }
    }
    // Falaises : on revient en arrière.
    const front = [pos.x + Math.sin(heading) * 2.2, pos.z + Math.cos(heading) * 2.2]
    const back = [pos.x - Math.sin(heading) * 2.2, pos.z - Math.cos(heading) * 2.2]
    if (blockedAt(pos.x, pos.z) || blockedAt(...front) || blockedAt(...back)) {
      pos.x = prevX
      pos.z = prevZ
      hit = true
    }
    if (hit && Math.abs(speed) > 4) {
      dust.puff(pos, 5)
      speed *= -0.25
    } else if (hit) speed *= 0.6
  }

  function respawn() {
    const r = nearestRamp()
    pos.copy(r.park)
    heading = r.heading
    speed = side = vy = 0
  }
  const nearestRamp = () => ramps.reduce((a, b) => (a.pos.distanceToSquared(pos) < b.pos.distanceToSquared(pos) ? a : b))

  // Collisions de la voiture garée (on ne la traverse plus à pied).
  const selfColliders = [-1, 1].map(() => ({ x: 0, z: 0, r: 1.15, top: 0, car: true }))
  world.colliders.push(...selfColliders)
  function place() {
    selfColliders.forEach((c, i) => {
      const k = i ? 1.15 : -1.15
      c.x = driving || flight ? 1e6 : pos.x + Math.sin(heading) * k
      c.z = pos.z + Math.cos(heading) * k
      c.top = pos.y + 2.2
    })
    object.position.copy(pos)
    object.rotation.set(0, heading, 0)
    body.rotation.set(pitch, 0, roll)
    interactable.x = pos.x
    interactable.z = pos.z
  }
  place()

  return {
    interactable,
    get driving() {
      return driving
    },
    get flying() {
      return flight !== null
    },
    get hint() {
      if (!driving || flight) return null
      return `Z/flèches pour conduire · Espace : frein à main · Tremplin ➜ ${labels.car.to[nearestRamp().island]} · E pour descendre`
    },
    enter(player) {
      driving = true
      player.setVisible(false)
      lights.forEach((l) => (l.material.emissiveIntensity = 3))
    },
    exit(player) {
      if (!driving || flight) return
      driving = false
      place()
      speed = 0
      lights.forEach((l) => (l.material.emissiveIntensity = 0.4))
      // On descend côté conducteur, ou de l'autre côté si c'est le vide ou un mur.
      for (const k of [1, -1, 0]) {
        const x = pos.x + Math.cos(heading) * 2.2 * k - (k === 0 ? Math.sin(heading) * 3.2 : 0)
        const z = pos.z - Math.sin(heading) * 2.2 * k - (k === 0 ? Math.cos(heading) * 3.2 : 0)
        const g = world.groundAt(x, z, pos.y + 0.5)
        if (g !== null && Math.abs(g - pos.y) < 1 && !world.blocked(x, z, g)) {
          player.teleport(new THREE.Vector3(x, g, z))
          break
        }
      }
      player.setVisible(true)
    },
    update(dt, t, player, enabled) {
      if (flight) {
        // Saut d'une île à l'autre en grand arc.
        flight.t = Math.min(1, flight.t + dt / 4.5)
        const k = flight.t
        const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2
        pos.lerpVectors(flight.from, flight.to, e)
        pos.y += Math.sin(Math.PI * k) * 28
        pitch = -Math.cos(Math.PI * k) * 0.35
        roll = Math.sin(t * 5) * 0.05
        for (const w of wheels) w.rotation.x += dt * 25
        place()
        player.teleport(pos)
        if (k >= 1) {
          flight = null
          speed = 9
          pitch = roll = 0
          dust.puff(pos, 14)
        }
        dust.update(dt)
        return
      }
      if (!driving) {
        object.position.y = pos.y + Math.sin(t * 30) * 0.01
        dust.update(dt)
        return
      }

      // Commandes : clavier ou joystick (haut = accélérer).
      let throttle = (pressed('KeyW', 'ArrowUp') ? 1 : 0) - (pressed('KeyS', 'ArrowDown') ? 1 : 0)
      let turn = (pressed('KeyA', 'ArrowLeft') ? 1 : 0) - (pressed('KeyD', 'ArrowRight') ? 1 : 0)
      if (!throttle && !turn && player.stick.lengthSq() > 0.02) {
        throttle = -player.stick.y
        turn = -player.stick.x
      }
      if (!enabled) throttle = turn = 0
      const handbrake = enabled && pressed('Space')

      if (throttle > 0) speed += (speed < 0 ? CAR.brake : CAR.accel) * throttle * dt
      else if (throttle < 0) speed += (speed > 0 ? -CAR.brake : -CAR.accel * 0.6) * -throttle * dt
      speed -= speed * CAR.drag * dt
      if (!throttle) speed -= Math.sign(speed) * Math.min(Math.abs(speed), 3 * dt)
      if (handbrake) speed -= speed * 1.6 * dt
      speed = THREE.MathUtils.clamp(speed, -CAR.reverse, CAR.max)

      // Direction : plus douce à haute vitesse, inversée en marche arrière.
      steer += (turn - steer) * Math.min(1, dt * 8)
      const grip = Math.min(1, Math.abs(speed) / 4)
      const yaw = steer * CAR.turn * grip * Math.sign(speed) * (handbrake ? 1.6 : 1) * (1 - Math.min(0.35, Math.abs(speed) / 60))
      if (grounded) heading += yaw * dt
      // Dérapage : une partie de la vitesse part sur le côté dans les virages serrés.
      side += (yaw * Math.abs(speed) * (handbrake ? 0.25 : 0.08) - side) * Math.min(1, dt * (handbrake ? 2 : CAR.grip))

      const prevX = pos.x
      const prevZ = pos.z
      fwd.set(Math.sin(heading), 0, Math.cos(heading))
      pos.addScaledVector(fwd, speed * dt)
      pos.x += Math.cos(heading) * -side * dt
      pos.z += -Math.sin(heading) * -side * dt
      collide(prevX, prevZ)

      // Sol et suspension.
      vy -= CAR.gravity * dt
      pos.y += vy * dt
      const ground = world.groundAt(pos.x, pos.z, pos.y + 0.3)
      if (ground !== null && pos.y <= ground + (grounded ? 0.7 : 0) && pos.y > ground - 2) {
        if (!grounded && vy < -9) dust.puff(pos, 8)
        pos.y = ground
        vy = 0
        grounded = true
      } else grounded = false
      if (pos.y < -30) respawn()

      // Assiette : tangage selon la pente et l'accélération, roulis dans les virages.
      const fh = world.groundAt(pos.x + fwd.x * 1.6, pos.z + fwd.z * 1.6, pos.y + 0.8) ?? pos.y
      const bh = world.groundAt(pos.x - fwd.x * 1.6, pos.z - fwd.z * 1.6, pos.y + 0.8) ?? pos.y
      const slope = grounded ? Math.atan2(bh - fh, 3.2) : pitch
      pitch += (slope - throttle * 0.04 * grip - pitch) * Math.min(1, dt * 8)
      roll += (-yaw * Math.abs(speed) * 0.012 - roll) * Math.min(1, dt * 6)

      for (const w of wheels) {
        w.rotation.x += (speed * dt) / 0.42
        if (w.userData.front) w.rotation.y = steer * 0.45
      }
      if (grounded && (Math.abs(side) > 2.5 || (handbrake && Math.abs(speed) > 5) || (throttle > 0 && speed < 5 && speed > 0.5))) {
        if (Math.random() < dt * 30) dust.puff(tmp.copy(pos).addScaledVector(fwd, -2), 1)
      }
      dust.update(dt)
      place()

      // Le joueur voyage avec la voiture (la caméra le suit) et pousse les objets sur sa route.
      player.teleport(pos)
      player.velocity.set(fwd.x * speed, 0, fwd.z * speed)

      // Tremplin : on part vers l'autre île.
      for (const r of ramps) {
        const dx = pos.x - r.lip.x
        const dz = pos.z - r.lip.z
        if (dx * dx + dz * dz < 1.8 * 1.8 && speed > 4 && fwd.x * r.out > 0.5) {
          const to = r.other.park.clone().addScaledVector(new THREE.Vector3(r.other.out, 0, 0), 1)
          flight = { t: 0, from: pos.clone(), to }
          heading = r.other.heading + Math.PI
          dust.puff(pos, 10)
        }
      }
    },
  }
}

// Tremplin en bois avec panneau de destination.
function buildRamp(destination) {
  const g = new THREE.Group()
  const wood = mat(0x8a5a34)
  const shape = new THREE.Shape([new THREE.Vector2(-2.2, 0), new THREE.Vector2(2.2, 0), new THREE.Vector2(2.2, 1.1)])
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 3.4, bevelEnabled: false }).translate(0, 0, -1.7)
  geo.rotateY(-Math.PI / 2)
  g.add(mesh(geo, wood))
  for (const x of [-1.5, 1.5]) {
    const stripe = mesh(new THREE.BoxGeometry(0.25, 0.08, 4.5), mat(0xffb347, { emissive: 0xff8a20, emissiveIntensity: 0.6 }), { x, y: 0.58 })
    stripe.rotation.x = -0.245
    g.add(stripe)
  }
  const post = mesh(new THREE.BoxGeometry(0.15, 2.2, 0.15), wood, { x: 2.6, y: 1.1, z: -1.4 })
  const board = mesh(new THREE.BoxGeometry(0.1, 0.6, 1.8), mat(0xffd27a, { emissive: 0xffa040, emissiveIntensity: 0.4 }), { x: 2.6, y: 2, z: -1.4 })
  board.rotation.y = Math.PI / 2
  board.name = `vers-${destination}`
  g.add(post, board)
  return g
}

function buildCar() {
  const object = new THREE.Group()
  const truck = model('truck', { width: 2.6 })
  object.add(truck)
  const find = (n) => truck.getObjectByName(n)
  const wheels = ['wheel-back-left', 'wheel-back-right', 'wheel-front-left', 'wheel-front-right'].map(find).filter(Boolean)
  for (const w of wheels) {
    w.rotation.order = 'YXZ'
    w.userData.front = w.name.includes('front')
  }
  const body = find('body') ?? truck
  // Phares et feux arrière (lumineux grâce au bloom).
  const s = truck.scale.x
  const lights = []
  for (const x of [-0.5, 0.5]) {
    const head = mesh(new THREE.BoxGeometry(0.22, 0.12, 0.04), mat(0xfff4c0, { emissive: 0xfff0b0, emissiveIntensity: 0.4 }), { x, y: 0.55, z: 1.41, shadow: false })
    const tail = mesh(new THREE.BoxGeometry(0.2, 0.1, 0.04), mat(0xff3030, { emissive: 0xff2020, emissiveIntensity: 1.2 }), { x, y: 0.6, z: -1.41, shadow: false })
    body.add(head, tail)
    lights.push(head)
  }
  if (body === truck) lights.forEach((l) => l.scale.setScalar(1 / s))
  return { object, wheels, body, lights }
}

function createPuffs(scene) {
  const parts = []
  const geometry = new THREE.IcosahedronGeometry(0.35, 0)
  return {
    puff(position, count) {
      for (let i = 0; i < count; i++) {
        const p = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: 0xe8dcc8, transparent: true, opacity: 0.6, depthWrite: false }))
        p.position.set(position.x + (Math.random() - 0.5) * 1.5, position.y + 0.2, position.z + (Math.random() - 0.5) * 1.5)
        p.userData.v = new THREE.Vector3((Math.random() - 0.5) * 3, Math.random() * 1.5, (Math.random() - 0.5) * 3)
        p.userData.life = 0.7
        scene.add(p)
        parts.push(p)
      }
    },
    update(dt) {
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i]
        p.userData.life -= dt
        p.position.addScaledVector(p.userData.v, dt)
        p.scale.setScalar(1 + (0.7 - p.userData.life) * 2.5)
        p.material.opacity = Math.max(0, p.userData.life * 0.85)
        if (p.userData.life <= 0) {
          scene.remove(p)
          p.material.dispose()
          parts.splice(i, 1)
        }
      }
    },
  }
}

function buildRocket() {
  const rocket = new THREE.Group()
  rocket.add(mesh(new THREE.CylinderGeometry(1, 1.1, 6, 14), mat(0xf2f2f2), { y: 4 }))
  rocket.add(mesh(new THREE.ConeGeometry(1, 2.2, 14), mat(0xd6402f), { y: 8.1 }))
  rocket.add(mesh(new THREE.CircleGeometry(0.45, 14), mat(0x6fd3ff, { emissive: 0x2a8fd0 }), { y: 5.5, z: 1.03 }))
  for (let i = 0; i < 3; i++) {
    const fin = mesh(new THREE.BoxGeometry(0.15, 1.8, 1.2), mat(0xd6402f), { y: 1.6 })
    const a = (i / 3) * Math.PI * 2
    fin.position.x = Math.cos(a) * 1.15
    fin.position.z = Math.sin(a) * 1.15
    fin.rotation.y = -a
    rocket.add(fin)
  }
  const flame = mesh(
    new THREE.ConeGeometry(0.75, 2.6, 12),
    new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0.9 }),
    { y: -0.2, shadow: false },
  )
  flame.rotation.x = Math.PI
  flame.visible = false
  rocket.add(flame)
  // Pas de tir au sol.
  const pad = mesh(new THREE.CylinderGeometry(2.2, 2.4, 0.3, 16), mat(0x555a66), { y: 0.15 })
  rocket.add(pad)

  rocket.userData.onFly = (t) => {
    pad.visible = false
    flame.visible = true
    flame.scale.y = 1 + Math.sin(t * 40) * 0.25
  }
  rocket.userData.onPark = () => {
    pad.visible = true
    flame.visible = false
  }
  return rocket
}
