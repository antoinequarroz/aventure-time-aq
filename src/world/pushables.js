import * as THREE from 'three'
import { mat, mesh } from './helpers.js'
import { model } from './models.js'

// Objets qu'on pousse en marchant dedans : tonneaux, caisses, ballon de foot, quilles de bowling.
// Petite physique maison : vitesse, frottement, chocs entre objets et contre le décor,
// chute dans le vide puis retour à leur place.

const KINDS = {
  barrel: { r: 0.45, h: 1, friction: 2.6, kick: 1.1 },
  crate: { r: 0.5, h: 0.9, friction: 4, kick: 0.9 },
  ball: { r: 0.32, h: 0.64, friction: 0.7, kick: 1.7 },
  pin: { r: 0.28, h: 1.5, friction: 2.2, kick: 1.2 },
  moonCrate: { r: 0.55, h: 1, friction: 1.2, kick: 1.3 },
}

function pinMesh() {
  // Profil d'une quille, tourné autour de l'axe vertical.
  const profile = [[0, 0], [0.16, 0], [0.24, 0.25], [0.27, 0.5], [0.2, 0.85], [0.11, 1.05], [0.12, 1.2], [0.15, 1.32], [0.12, 1.45], [0, 1.5]].map(([x, y]) => new THREE.Vector2(x, y))
  const g = new THREE.Group()
  g.add(mesh(new THREE.LatheGeometry(profile, 10), mat(0xf6f1ea, { roughness: 0.5 })))
  for (const y of [1.0, 1.1]) g.add(mesh(new THREE.CylinderGeometry(0.115, 0.115, 0.05, 10), mat(0xe03a3a), { y }))
  return g
}

function buildMesh(kind) {
  if (kind === 'barrel') return model('barrel', { height: 1 })
  if (kind === 'crate') {
    const g = new THREE.Group()
    g.add(mesh(new THREE.BoxGeometry(0.9, 0.9, 0.9), mat(0xa0703f), { y: 0.45 }))
    for (const z of [-0.46, 0.46]) {
      const band = mesh(new THREE.BoxGeometry(0.95, 0.12, 0.04), mat(0x6b4426), { y: 0.45, z })
      band.rotation.z = Math.PI / 4
      g.add(band)
    }
    return g
  }
  if (kind === 'ball') {
    const g = new THREE.Group()
    const ball = mesh(new THREE.IcosahedronGeometry(0.32, 1), mat(0xf5f5f5, { roughness: 0.6 }))
    // Pentagones noirs du ballon.
    const dots = new THREE.IcosahedronGeometry(0.33, 0).attributes.position
    for (let i = 0; i < dots.count; i += 9) {
      const d = mesh(new THREE.CircleGeometry(0.09, 5), mat(0x222222), { x: dots.getX(i), y: dots.getY(i), z: dots.getZ(i), shadow: false })
      d.lookAt(d.position.clone().multiplyScalar(2))
      g.add(d)
    }
    g.add(ball)
    return g
  }
  if (kind === 'pin') return pinMesh()
  if (kind === 'moonCrate') return model('sciCrate', { height: 1 })
  return new THREE.Group()
}

export function createPushables(scene, world, specs, { onStrike, onGoal } = {}) {
  const bodies = specs.map((spec) => {
    const k = KINDS[spec.kind]
    const object = buildMesh(spec.kind)
    if (spec.kind === 'ball') object.position.y = 0.32
    // Pivot = base de l'objet, au centre.
    const pivot = new THREE.Group()
    pivot.add(object)
    scene.add(pivot)
    const home = new THREE.Vector3(spec.x, world.groundAt(spec.x, spec.z, Infinity, true) ?? 0, spec.z)
    pivot.position.copy(home)
    pivot.rotation.y = spec.rotY ?? 0
    return { ...k, spec, kind: spec.kind, group: spec.group, pivot, object, home, pos: home.clone(), vel: new THREE.Vector3(), vy: 0, fallen: 0, fallAxis: new THREE.Vector3(1, 0, 0), fallDir: new THREE.Vector3(0, 0, 1), roll: new THREE.Quaternion(), spin: spec.rotY ?? 0, idle: 0 }
  })

  const groups = new Map()
  for (const b of bodies) if (b.group) groups.set(b.group, { done: false, timer: 0 })
  const goals = specs.flatMap((s) => s.goals ?? [])
  let goalCooldown = 0

  const n = new THREE.Vector3()
  const q = new THREE.Quaternion()
  const up = new THREE.Vector3(0, 1, 0)

  function reset(b) {
    b.pos.copy(b.home)
    b.vel.set(0, 0, 0)
    b.vy = 0
    b.fallen = 0
    b.roll.identity()
  }

  function update(dt, player) {
    const pp = player.position
    const pv = player.velocity
    goalCooldown -= dt
    for (const b of bodies) {
      // Le joueur pousse l'objet.
      const dx = b.pos.x - pp.x
      const dz = b.pos.z - pp.z
      const d = Math.hypot(dx, dz)
      const minD = b.r + 0.42
      if (d < minD && pp.y < b.pos.y + b.h && pp.y + 1.8 > b.pos.y) {
        n.set(dx / (d || 1), 0, dz / (d || 1))
        const overlap = minD - d
        b.pos.addScaledVector(n, overlap * 0.8)
        pp.addScaledVector(n, -overlap * 0.2)
        const along = pv.x * n.x + pv.z * n.z
        if (along > 0) {
          const cur = b.vel.dot(n)
          const target = along * b.kick
          if (cur < target) b.vel.addScaledVector(n, target - cur)
          if (b.kind === 'ball' && along > 4) b.vy = Math.max(b.vy, along * 0.35)
          if (b.kind === 'pin' && !b.fallen) topple(b, n)
        }
      }
    }

    // Chocs entre objets : on échange la vitesse le long de la normale (masses égales).
    for (let i = 0; i < bodies.length; i++) {
      const a = bodies[i]
      for (let j = i + 1; j < bodies.length; j++) {
        const b = bodies[j]
        const dx = b.pos.x - a.pos.x
        const dz = b.pos.z - a.pos.z
        const min = a.r + b.r
        if (Math.abs(dx) > min || Math.abs(dz) > min || Math.abs(a.pos.y - b.pos.y) > 1) continue
        const d = Math.hypot(dx, dz)
        if (d >= min || d === 0) continue
        n.set(dx / d, 0, dz / d)
        const push = (min - d) / 2
        a.pos.addScaledVector(n, -push)
        b.pos.addScaledVector(n, push)
        const rel = a.vel.dot(n) - b.vel.dot(n)
        if (rel > 0) {
          a.vel.addScaledVector(n, -rel * 0.9)
          b.vel.addScaledVector(n, rel * 0.9)
          if (rel > 0.8) {
            if (a.kind === 'pin' && !a.fallen) topple(a, n.clone().negate())
            if (b.kind === 'pin' && !b.fallen) topple(b, n)
          }
        }
      }
    }

    for (const b of bodies) {
      const speed = Math.hypot(b.vel.x, b.vel.z)
      b.pos.x += b.vel.x * dt
      b.pos.z += b.vel.z * dt
      b.vel.multiplyScalar(Math.exp(-dt * b.friction))

      // Décor fixe : rebond contre les colliders (arbres, murs, rochers…).
      for (const c of world.colliders) {
        if (b.pos.y > c.top - 0.2) continue
        const dx = b.pos.x - c.x
        const dz = b.pos.z - c.z
        const min = c.r + b.r
        if (Math.abs(dx) > min || Math.abs(dz) > min) continue
        const d = Math.hypot(dx, dz)
        if (d >= min || d === 0) continue
        n.set(dx / d, 0, dz / d)
        b.pos.x = c.x + n.x * min
        b.pos.z = c.z + n.z * min
        const vn = b.vel.dot(n)
        if (vn < 0) b.vel.addScaledVector(n, -vn * 1.5)
      }
      world.pushOut(b.pos, b.r)

      // Gravité : l'objet tombe s'il quitte le bord.
      const ground = world.groundAt(b.pos.x, b.pos.z, b.pos.y)
      const g = b.spec.gravity ?? 1
      if (ground !== null && b.pos.y <= ground + 0.01 && b.vy <= 0) {
        b.pos.y = ground
        b.vy = b.kind === 'ball' && b.vy < -3 ? -b.vy * 0.45 : 0
      } else {
        b.vy -= 22 * g * dt
        b.pos.y += b.vy * dt
        if (ground !== null && b.pos.y < ground && b.pos.y > ground - 0.6) {
          b.pos.y = ground
          b.vy = b.kind === 'ball' && b.vy < -3 ? -b.vy * 0.45 : 0
        }
      }
      if (b.pos.y < -35) reset(b)

      // Orientation : la balle roule, la quille bascule, les autres tournent un peu sur elles-mêmes.
      if (b.kind === 'ball' && speed > 0.01) {
        n.set(b.vel.z, 0, -b.vel.x).normalize()
        q.setFromAxisAngle(n, (speed * dt) / b.r)
        b.roll.premultiply(q)
        b.object.quaternion.copy(b.roll)
      } else if (b.kind === 'pin') {
        if (b.fallen) b.fallen = Math.min(1, b.fallen + dt * 3.5)
        const angle = (b.fallen ? b.fallen : 0) * (Math.PI / 2 - 0.08)
        b.pivot.quaternion.setFromAxisAngle(b.fallAxis, angle)
        b.pivot.position.y = b.pos.y + Math.sin(angle) * 0.25
      } else {
        b.spin += (b.vel.x * 0.3 - b.vel.z * 0.2) * dt
        b.pivot.rotation.y = b.spin
        const tilt = Math.min(0.25, speed * 0.04)
        b.pivot.rotation.x = tilt * Math.sin(performance.now() * 0.02)
      }
      b.pivot.position.x = b.pos.x
      b.pivot.position.z = b.pos.z
      if (b.kind !== 'pin') b.pivot.position.y = b.pos.y
    }

    // Une quille qui tombe entraîne celles qu'elle touche dans sa chute (réaction en chaîne).
    for (const a of bodies) {
      if (a.kind !== 'pin' || !a.fallen || a.fallen >= 1) continue
      const reach = 1.4 * Math.sin(a.fallen * Math.PI / 2)
      for (const b of bodies) {
        if (b === a || b.kind !== 'pin' || b.fallen) continue
        const t = Math.max(0, Math.min(reach, (b.pos.x - a.pos.x) * a.fallDir.x + (b.pos.z - a.pos.z) * a.fallDir.z))
        const d = Math.hypot(b.pos.x - (a.pos.x + a.fallDir.x * t), b.pos.z - (a.pos.z + a.fallDir.z * t))
        if (d < b.r + 0.42) {
          n.set(b.pos.x - a.pos.x, 0, b.pos.z - a.pos.z).normalize().lerp(a.fallDir, 0.5).normalize()
          topple(b, n)
        }
      }
    }

    // Strike : toutes les quilles d'un groupe sont tombées.
    for (const [name, state] of groups) {
      const pins = bodies.filter((b) => b.group === name)
      if (!state.done && pins.every((b) => b.fallen >= 1)) {
        state.done = true
        state.timer = 5
        onStrike?.(name)
      }
      if (state.done) {
        state.timer -= dt
        if (state.timer <= 0) {
          state.done = false
          pins.forEach(reset)
        }
      }
    }
    // But : le ballon entre dans la cage.
    for (const b of bodies) {
      if (b.kind !== 'ball' || goalCooldown > 0) continue
      for (const goal of goals) {
        if ((b.pos.x - goal[0]) ** 2 + (b.pos.z - goal[1]) ** 2 < goal[2] ** 2) {
          goalCooldown = 3
          onGoal?.()
          setTimeout(() => reset(b), 1500)
        }
      }
    }
  }

  function topple(b, dir) {
    b.fallen = 0.01
    b.fallDir.copy(dir).setY(0).normalize()
    b.fallAxis.crossVectors(up, b.fallDir).normalize()
    b.vel.addScaledVector(b.fallDir, 1.2)
  }

  return { update, bodies }
}
