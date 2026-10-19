import * as THREE from 'three'

// Compagnon : une petite créature qui suit le joueur et change avec l'époque.
// Passé : un bébé dragon. Présent : un chiot. Futur : un petit drone.
// Elle trottine derrière lui, attend quand il s'arrête et fête ses découvertes.

const M = (color, opts = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.65, flatShading: true, ...opts })

function part(group, geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat)
  m.position.set(x, y, z)
  m.castShadow = true
  group.add(m)
  return m
}

// Toutes les créatures regardent vers +z.
function buildDragon() {
  const g = new THREE.Group()
  const body = M(0x4fcfa6)
  const belly = M(0xffd27a)
  const dark = M(0x1a1530)
  part(g, new THREE.SphereGeometry(0.24, 10, 8), body, 0, 0.32, 0).scale.set(1, 0.95, 1.2)
  part(g, new THREE.SphereGeometry(0.16, 8, 6), belly, 0, 0.28, 0.12).scale.set(1, 1, 0.7)
  const head = new THREE.Group()
  head.position.set(0, 0.6, 0.18)
  g.add(head)
  part(head, new THREE.SphereGeometry(0.19, 10, 8), body).scale.set(1, 0.9, 1.05)
  part(head, new THREE.SphereGeometry(0.1, 8, 6), body, 0, -0.04, 0.16).scale.set(1, 0.75, 1)
  part(head, new THREE.ConeGeometry(0.045, 0.16, 5), belly, -0.09, 0.17, -0.04).rotation.x = -0.4
  part(head, new THREE.ConeGeometry(0.045, 0.16, 5), belly, 0.09, 0.17, -0.04).rotation.x = -0.4
  part(head, new THREE.SphereGeometry(0.035, 6, 4), dark, -0.08, 0.04, 0.15)
  part(head, new THREE.SphereGeometry(0.035, 6, 4), dark, 0.08, 0.04, 0.15)
  const wingMat = M(0xff8ad8, { side: THREE.DoubleSide })
  const wingGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.38, 0.12, -0.1), new THREE.Vector3(0.3, -0.05, -0.28), new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.3, -0.05, -0.28), new THREE.Vector3(0.08, -0.02, -0.3)])
  wingGeo.computeVertexNormals()
  const wings = [-1, 1].map((side) => {
    const w = new THREE.Group()
    w.position.set(0.12 * side, 0.46, -0.05)
    w.scale.x = side
    part(w, wingGeo, wingMat)
    g.add(w)
    return w
  })
  const tail = part(g, new THREE.ConeGeometry(0.09, 0.42, 6), body, 0, 0.26, -0.36)
  tail.rotation.x = -1.9
  for (const s of [-1, 1]) part(g, new THREE.SphereGeometry(0.07, 6, 4), body, 0.13 * s, 0.08, 0.05)
  return { group: g, head, flap: wings, tail, fly: 0.35 }
}

function buildPup() {
  const g = new THREE.Group()
  const fur = M(0xe0954a)
  const white = M(0xfff4e0)
  const dark = M(0x1a1530)
  part(g, new THREE.BoxGeometry(0.34, 0.26, 0.5), fur, 0, 0.32, 0)
  part(g, new THREE.BoxGeometry(0.26, 0.14, 0.38), white, 0, 0.22, 0.02)
  const head = new THREE.Group()
  head.position.set(0, 0.56, 0.26)
  g.add(head)
  part(head, new THREE.BoxGeometry(0.3, 0.26, 0.26), fur)
  part(head, new THREE.BoxGeometry(0.16, 0.12, 0.14), white, 0, -0.06, 0.17)
  part(head, new THREE.SphereGeometry(0.035, 6, 4), dark, 0, -0.02, 0.25)
  part(head, new THREE.SphereGeometry(0.03, 6, 4), dark, -0.08, 0.05, 0.135)
  part(head, new THREE.SphereGeometry(0.03, 6, 4), dark, 0.08, 0.05, 0.135)
  for (const s of [-1, 1]) {
    const ear = part(head, new THREE.ConeGeometry(0.07, 0.16, 4), fur, 0.1 * s, 0.18, -0.02)
    ear.rotation.z = -0.25 * s
  }
  const legs = []
  for (const [x, z] of [[-0.11, 0.17], [0.11, 0.17], [-0.11, -0.17], [0.11, -0.17]]) legs.push(part(g, new THREE.BoxGeometry(0.08, 0.2, 0.08), white, x, 0.1, z))
  const tail = part(g, new THREE.ConeGeometry(0.05, 0.22, 5), fur, 0, 0.44, -0.28)
  tail.rotation.x = -0.9
  return { group: g, head, legs, tail, fly: 0 }
}

function buildDrone() {
  const g = new THREE.Group()
  const shell = M(0xf4f1ff, { metalness: 0.3 })
  const neon = new THREE.MeshStandardMaterial({ color: 0x7cf7ff, emissive: 0x3ad7ff, emissiveIntensity: 2.2 })
  const head = new THREE.Group()
  head.position.set(0, 0.5, 0)
  g.add(head)
  part(head, new THREE.SphereGeometry(0.22, 12, 8), shell).scale.set(1.1, 0.85, 1)
  part(head, new THREE.BoxGeometry(0.3, 0.1, 0.05), M(0x1a1530), 0, 0.02, 0.2)
  part(head, new THREE.BoxGeometry(0.05, 0.05, 0.02), neon, -0.07, 0.02, 0.23)
  part(head, new THREE.BoxGeometry(0.05, 0.05, 0.02), neon, 0.07, 0.02, 0.23)
  part(head, new THREE.CylinderGeometry(0.01, 0.01, 0.16, 4), shell, 0, 0.24, 0)
  part(head, new THREE.SphereGeometry(0.035, 6, 4), neon, 0, 0.33, 0)
  const ring = part(g, new THREE.TorusGeometry(0.2, 0.025, 6, 20), neon, 0, 0.24, 0)
  ring.rotation.x = Math.PI / 2
  const rotors = [-1, 1].map((s) => {
    const r = new THREE.Group()
    r.position.set(0.3 * s, 0.52, 0)
    part(r, new THREE.BoxGeometry(0.22, 0.012, 0.04), shell)
    g.add(r)
    return r
  })
  return { group: g, head, rotors, ring, fly: 0.55 }
}

const BUILDERS = { past: buildDragon, present: buildPup, future: buildDrone }
const HAPPY = ['❤️', '✨', '⭐', '🎵']

export function createCompanion(scene, world) {
  const root = new THREE.Group()
  root.name = 'companion'
  root.scale.setScalar(1.15)
  root.userData.dynamic = true
  scene.add(root)
  const pets = {}
  let era = null
  let pet = null
  const pos = new THREE.Vector3()
  const vel = new THREE.Vector3()
  const target = new THREE.Vector3()
  let heading = 0
  let hop = 0
  let joy = 0
  let idle = 0
  let placed = false
  let visible = true

  // Petite bulle émoji au-dessus de la tête.
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 64
  const bubbleTex = new THREE.CanvasTexture(canvas)
  bubbleTex.colorSpace = THREE.SRGBColorSpace
  const bubble = new THREE.Sprite(new THREE.SpriteMaterial({ map: bubbleTex, transparent: true, depthWrite: false }))
  bubble.scale.setScalar(0.45)
  bubble.visible = false
  root.add(bubble)
  let bubbleT = 0
  function say(emoji) {
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, 64, 64)
    ctx.font = '44px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(emoji, 32, 36)
    bubbleTex.needsUpdate = true
    bubble.visible = true
    bubbleT = 1.6
  }

  function setEra(next) {
    if (!BUILDERS[next] || next === era) return
    era = next
    if (pet) pet.group.visible = false
    pet = pets[next] ??= BUILDERS[next]()
    if (!pet.group.parent) root.add(pet.group)
    pet.group.visible = true
    if (placed) say('✨')
  }

  const api = {
    get object() {
      return root
    },
    // Fête quelque chose (point découvert, but, succès…).
    cheer() {
      joy = 1.2
      hop = Math.max(hop, 0.01)
      say(HAPPY[(Math.random() * HAPPY.length) | 0])
    },
    setVisible(v) {
      visible = v
      root.visible = v
    },
    update(dt, t, player, eraId, hidden = false) {
      setEra(eraId ?? era ?? 'past')
      if (!pet) return
      root.visible = visible && !hidden
      const p = player.position
      // Place de suivi : derrière le joueur, un peu sur le côté.
      const facing = player.facing ?? 0
      target.set(p.x - Math.sin(facing) * 1.4 + Math.cos(facing) * 0.7, p.y, p.z - Math.cos(facing) * 1.4 - Math.sin(facing) * 0.7)
      const far = pos.distanceTo(p)
      if (!placed || far > 14 || hidden) {
        pos.copy(target)
        vel.set(0, 0, 0)
        placed = true
      }
      const dx = target.x - pos.x
      const dz = target.z - pos.z
      const dist = Math.hypot(dx, dz)
      const speed = dist > 0.25 ? Math.min(9, dist * 3.2) : 0
      vel.x += ((dist > 0.01 ? (dx / dist) * speed : 0) - vel.x) * (1 - Math.exp(-dt * 6))
      vel.z += ((dist > 0.01 ? (dz / dist) * speed : 0) - vel.z) * (1 - Math.exp(-dt * 6))
      pos.x += vel.x * dt
      pos.z += vel.z * dt
      const moving = Math.hypot(vel.x, vel.z)
      idle = moving > 0.4 ? 0 : idle + dt
      const ground = world.groundAt(pos.x, pos.z, Math.max(p.y, pos.y) + 1) ?? p.y
      pos.y += (ground - pos.y) * (1 - Math.exp(-dt * 12))

      // Regarde où il va, ou le joueur quand il attend.
      const want = moving > 0.4 ? Math.atan2(vel.x, vel.z) : Math.atan2(p.x - pos.x, p.z - pos.z)
      let d = want - heading
      d = Math.atan2(Math.sin(d), Math.cos(d))
      heading += d * (1 - Math.exp(-dt * 8))

      // Petits sauts en courant (chiot), vol stationnaire (dragon, drone).
      joy = Math.max(0, joy - dt)
      if (pet.fly) {
        hop = pet.fly + Math.sin(t * 3) * 0.08 + (joy > 0 ? Math.abs(Math.sin(t * 9)) * 0.4 : 0)
      } else if (moving > 0.8 || joy > 0) {
        hop = Math.abs(Math.sin(t * (joy > 0 ? 9 : 12))) * (joy > 0 ? 0.35 : 0.12)
      } else hop *= Math.exp(-dt * 10)

      root.position.set(pos.x, pos.y + hop, pos.z)
      pet.group.rotation.y = heading
      pet.group.rotation.x = pet.fly ? Math.min(0.35, moving * 0.05) : 0
      if (joy > 0) pet.group.rotation.y += Math.sin(t * 14) * 0.3

      // Animations propres à chaque créature.
      if (pet.flap) for (const [i, w] of pet.flap.entries()) w.rotation.z = (i ? -1 : 1) * (0.2 + Math.sin(t * (moving > 0.4 ? 18 : 9)) * 0.5)
      if (pet.legs) for (const [i, l] of pet.legs.entries()) l.rotation.x = moving > 0.4 ? Math.sin(t * 16 + (i % 2 ? Math.PI : 0) + (i > 1 ? Math.PI : 0)) * 0.6 : 0
      if (pet.tail) pet.tail.rotation.z = Math.sin(t * (era === 'present' ? 14 : 4)) * (era === 'present' ? 0.6 : 0.25)
      if (pet.rotors) for (const r of pet.rotors) r.rotation.y += dt * 40
      if (pet.ring) pet.ring.scale.setScalar(1 + Math.sin(t * 4) * 0.08)
      // Attente : il regarde autour de lui, parfois s'assoit / tourne sur lui-même.
      pet.head.rotation.y = idle > 2 ? Math.sin(t * 0.9) * 0.6 : 0
      pet.head.rotation.x = idle > 6 && !pet.fly ? 0.25 : 0
      if (idle > 9 && Math.random() < dt * 0.15) say(era === 'present' ? '🦴' : era === 'past' ? '🔥' : '📡')

      bubbleT -= dt
      bubble.visible = bubbleT > 0
      bubble.position.set(0, 1.05 + (pet.fly ? 0.1 : 0), 0)
      bubble.material.opacity = Math.min(1, bubbleT * 2)
    },
  }
  return api
}
