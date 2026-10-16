import * as THREE from 'three'
import { jitter, mat, mesh, textTexture } from './helpers.js'
import { model, animate } from './models.js'

// Bibliothèque de décors low-poly. Chaque fonction reçoit le contexte d'une île
// ({ group, addCollider, animated }) et une position locale.

const rand = (seed) => {
  let s = Math.abs(Math.floor(seed * 9973)) % 2147483647 || 1
  return () => {
    s = (s * 16807) % 2147483647
    return s / 2147483647
  }
}

// Pose un modèle 3D importé (voir models.js), avec un collider optionnel (rayon r).
export function place(ctx, key, x, z, { height, width, rotY = 0, y = 0, r = 0, top } = {}) {
  const object = model(key, { height, width, x, y, z, rotY })
  ctx.group.add(object)
  if (r) ctx.addCollider(x, z, r, top)
  if (object.userData.animations.length) {
    const { mixer, actions } = animate(object)
    for (const action of Object.values(actions)) action.play()
    ctx.animated.push((dt) => mixer.update(dt))
  }
  return object
}

// Falaise rocheuse en bord d'île.
export function cliff(ctx, x, z, { height = 4, rotY = 0, small = false, lunar = false } = {}) {
  const key = lunar ? (small ? 'moonRockSmall' : 'moonRock') : small ? 'cliffSmall' : 'cliff'
  return place(ctx, key, x, z, { height, rotY, r: height * 0.32 })
}

// Sapin Kenney.
export function pine(ctx, x, z, { height = 4, big = false, collide = true } = {}) {
  return place(ctx, big ? 'pineBig' : 'pineSmall', x, z, { height, rotY: x * z, r: collide ? 0.5 : 0 })
}

// ---------- Nature ----------

export function tree(ctx, x, z, { pine = false, leaves = 0x3f7d2a, scale = 1, collide = true } = {}) {
  const { group } = ctx
  const trunk = mesh(new THREE.CylinderGeometry(0.2 * scale, 0.3 * scale, 1.4 * scale, 6), mat(0x6b4426), { x, y: 0.7 * scale, z })
  if (pine) {
    group.add(trunk)
    for (let i = 0; i < 3; i++) {
      group.add(mesh(new THREE.ConeGeometry((1.3 - i * 0.3) * scale, 1.6 * scale, 7), mat(leaves), { x, y: (1.8 + i * 0.9) * scale, z }))
    }
  } else {
    const crown = mesh(jitter(new THREE.IcosahedronGeometry(1.3 * scale, 0), 0.3, Math.round(x * 10 + z)), mat(leaves), { x, y: 2.3 * scale, z })
    const crown2 = mesh(jitter(new THREE.IcosahedronGeometry(0.8 * scale, 0), 0.2, Math.round(x * 7 + z)), mat(leaves), { x: x + 0.6 * scale, y: 2.9 * scale, z: z + 0.3 * scale })
    group.add(trunk, crown, crown2)
  }
  if (collide) ctx.addCollider(x, z, 0.6 * scale)
}

export function rocks(ctx, x, z, { color = 0x8a8478, count = 3, size = 1, collide = true } = {}) {
  const r = rand(x * 31 + z * 17)
  for (let i = 0; i < count; i++) {
    const s = size * (0.5 + r() * 0.8)
    const g = jitter(new THREE.DodecahedronGeometry(s, 0), s * 0.25, i + Math.round(x))
    const rock = mesh(g, mat(color), { x: x + (r() - 0.5) * size * 2, y: s * 0.45, z: z + (r() - 0.5) * size * 2 })
    rock.rotation.set(r() * 3, r() * 3, r() * 3)
    rock.scale.y = 0.7
    ctx.group.add(rock)
  }
  if (collide) ctx.addCollider(x, z, size * 1.2)
}

export function crystals(ctx, x, z, { color = 0x58d0ff, count = 5, size = 1, collide = true, glow = false } = {}) {
  const r = rand(x * 13 + z * 29)
  const material = mat(color, { emissive: color, emissiveIntensity: 0.9, roughness: 0.3 })
  const cluster = new THREE.Group()
  cluster.position.set(x, 0, z)
  for (let i = 0; i < count; i++) {
    const h = size * (1 + r() * 1.6)
    const c = mesh(new THREE.OctahedronGeometry(size * 0.35, 0), material)
    c.scale.set(1, h * 1.6, 1)
    c.position.set((r() - 0.5) * size * 1.4, h * 0.35, (r() - 0.5) * size * 1.4)
    c.rotation.set((r() - 0.5) * 0.7, r() * 3, (r() - 0.5) * 0.7)
    cluster.add(c)
  }
  ctx.group.add(cluster)
  if (collide) ctx.addCollider(x, z, size)
  if (glow) {
    const light = new THREE.PointLight(color, 3, 6 * size)
    light.position.y = size
    cluster.add(light)
    ctx.animated.push((dt, t) => { light.intensity = 2.5 + Math.sin(t * 2 + x) * 0.8 })
  }
}

export function pond(ctx, x, z, { r = 3, color = 0x3a8fd6 } = {}) {
  const water = mesh(new THREE.CircleGeometry(r, 32), mat(color, { roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.85 }), { x, y: 0.06, z, shadow: false })
  water.rotation.x = -Math.PI / 2
  const rim = mesh(new THREE.TorusGeometry(r, 0.25, 6, 32), mat(0x8a8478), { x, y: 0.05, z, shadow: false })
  rim.rotation.x = Math.PI / 2
  ctx.group.add(water, rim)
  // Nénuphars.
  const pads = rand(x + z)
  for (let i = 0; i < 4; i++) {
    const a = pads() * Math.PI * 2
    const d = pads() * r * 0.7
    const pad = mesh(new THREE.CircleGeometry(0.35, 8), mat(0x4f9a3a, { side: THREE.DoubleSide }), { x: x + Math.cos(a) * d, y: 0.08, z: z + Math.sin(a) * d, shadow: false })
    pad.rotation.x = -Math.PI / 2
    ctx.group.add(pad)
  }
  ctx.animated.push((dt, t) => { water.material.color.setHSL(0.58, 0.6, 0.48 + Math.sin(t) * 0.03) })
  ctx.addCollider(x, z, r * 0.8)
}

export function flowers(ctx, x, z, { r = 2, count = 25, colors = [0xff6b8a, 0xffd34f, 0xffffff, 0xb28dff] } = {}) {
  const rr = rand(x * 3 + z)
  const geo = new THREE.IcosahedronGeometry(0.12, 0)
  for (let i = 0; i < count; i++) {
    const a = rr() * Math.PI * 2
    const d = Math.sqrt(rr()) * r
    const px = x + Math.cos(a) * d
    const pz = z + Math.sin(a) * d
    ctx.group.add(mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.4, 3), mat(0x3f7d2a), { x: px, y: 0.2, z: pz, shadow: false }))
    ctx.group.add(mesh(geo, mat(colors[i % colors.length]), { x: px, y: 0.42, z: pz, shadow: false }))
  }
}

export function mushroom(ctx, x, z, { scale = 1, cap = 0xd6402f } = {}) {
  const stem = mesh(new THREE.CylinderGeometry(0.25 * scale, 0.35 * scale, 1.2 * scale, 8), mat(0xf1e6cf), { x, y: 0.6 * scale, z })
  const top = mesh(new THREE.SphereGeometry(0.9 * scale, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(cap), { x, y: 1.15 * scale, z })
  ctx.group.add(stem, top)
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2
    ctx.group.add(mesh(new THREE.SphereGeometry(0.12 * scale, 6, 4), mat(0xffffff), { x: x + Math.cos(a) * 0.5 * scale, y: 1.15 * scale + 0.55 * scale, z: z + Math.sin(a) * 0.5 * scale, shadow: false }))
  }
  ctx.addCollider(x, z, 0.4 * scale)
}

// ---------- Médiéval ----------

export function ruinColumn(ctx, x, z, { h = 3, broken = true } = {}) {
  const stone = mat(0xc9c1ad)
  ctx.group.add(mesh(new THREE.BoxGeometry(1.2, 0.3, 1.2), stone, { x, y: 0.15, z }))
  const col = mesh(new THREE.CylinderGeometry(0.4, 0.45, h, 10), stone, { x, y: 0.3 + h / 2, z })
  if (broken) col.rotation.z = 0.05
  ctx.group.add(col)
  if (!broken) ctx.group.add(mesh(new THREE.BoxGeometry(1.1, 0.3, 1.1), stone, { x, y: 0.45 + h, z }))
  else ctx.group.add(mesh(jitter(new THREE.DodecahedronGeometry(0.45, 0), 0.1, x), stone, { x: x + 0.9, y: 0.3, z: z + 0.4 }))
  ctx.addCollider(x, z, 0.6)
}

export function arch(ctx, x, z, { rotY = 0 } = {}) {
  const stone = mat(0xb8b0a0)
  const g = new THREE.Group()
  g.position.set(x, 0, z)
  g.rotation.y = rotY
  g.add(mesh(new THREE.BoxGeometry(0.8, 4, 0.8), stone, { x: -1.6, y: 2 }))
  g.add(mesh(new THREE.BoxGeometry(0.8, 4, 0.8), stone, { x: 1.6, y: 2 }))
  g.add(mesh(new THREE.BoxGeometry(4, 0.8, 0.9), stone, { y: 4.3 }))
  ctx.group.add(g)
  const c = Math.cos(rotY)
  const s = Math.sin(rotY)
  ctx.addCollider(x - 1.6 * c, z + 1.6 * s, 0.6)
  ctx.addCollider(x + 1.6 * c, z - 1.6 * s, 0.6)
}

export function standingStones(ctx, x, z, { r = 3.5, count = 7 } = {}) {
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2
    const sx = x + Math.cos(a) * r
    const sz = z + Math.sin(a) * r
    const stone = mesh(jitter(new THREE.BoxGeometry(0.9, 2.6, 0.6), 0.12, i + 3), mat(0x8f8d86), { x: sx, y: 1.3, z: sz })
    stone.rotation.y = -a
    ctx.group.add(stone)
    ctx.addCollider(sx, sz, 0.6)
  }
  const altar = mesh(new THREE.CylinderGeometry(0.9, 1, 0.6, 8), mat(0x8f8d86), { x, y: 0.3, z })
  const rune = mesh(new THREE.TorusGeometry(0.6, 0.06, 6, 24), mat(0x7fe3ff, { emissive: 0x4fc3ff, emissiveIntensity: 2 }), { x, y: 0.65, z, shadow: false })
  rune.rotation.x = Math.PI / 2
  ctx.group.add(altar, rune)
  ctx.animated.push((dt) => { rune.rotation.z += dt })
}

export function campfire(ctx, x, z) {
  const logs = mat(0x5a3a22)
  for (let i = 0; i < 4; i++) {
    const log = mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.2, 6), logs, { x, y: 0.15, z })
    log.rotation.set(Math.PI / 2, 0, (i / 4) * Math.PI)
    ctx.group.add(log)
  }
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2
    ctx.group.add(mesh(new THREE.DodecahedronGeometry(0.2, 0), mat(0x777777), { x: x + Math.cos(a) * 0.75, y: 0.12, z: z + Math.sin(a) * 0.75 }))
  }
  const flames = [0xffb03a, 0xff6a1f, 0xffe27a].map((c, i) => {
    const f = mesh(new THREE.ConeGeometry(0.35 - i * 0.08, 1 - i * 0.2, 6), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.9 }), { x, y: 0.55, z, shadow: false })
    ctx.group.add(f)
    return f
  })
  const light = new THREE.PointLight(0xff8a3a, 6, 9)
  light.position.set(x, 1.2, z)
  ctx.group.add(light)
  ctx.addCollider(x, z, 0.9)
  ctx.animated.push((dt, t) => {
    flames.forEach((f, i) => {
      f.scale.y = 1 + Math.sin(t * (9 + i * 3)) * 0.25
      f.rotation.y = t * (1 + i)
    })
    light.intensity = 5 + Math.sin(t * 13) * 1.2 + Math.sin(t * 7) * 0.8
  })
}

export function tent(ctx, x, z, { color = 0xc0392b, rotY = 0 } = {}) {
  const g = new THREE.Group()
  g.position.set(x, 0, z)
  g.rotation.y = rotY
  const cloth = new THREE.ConeGeometry(1.8, 2.6, 4)
  cloth.rotateY(Math.PI / 4)
  g.add(mesh(cloth, mat(color), { y: 1.3 }))
  g.add(mesh(new THREE.PlaneGeometry(0.8, 1.2), mat(0x2a1a10, { side: THREE.DoubleSide }), { y: 0.6, z: 1.29, shadow: false }))
  g.add(mesh(new THREE.CylinderGeometry(0.04, 0.04, 1, 4), mat(0x5a3a22), { y: 3 }))
  g.add(mesh(new THREE.PlaneGeometry(0.6, 0.35), mat(0xf1c40f, { side: THREE.DoubleSide }), { x: 0.3, y: 3.3, shadow: false }))
  ctx.group.add(g)
  ctx.addCollider(x, z, 1.6)
}

export function crate(ctx, x, z, { size = 0.9, rotY = 0, y = 0 } = {}) {
  const c = mesh(new THREE.BoxGeometry(size, size, size), mat(0xa0703f), { x, y: y + size / 2, z })
  c.rotation.y = rotY
  const bands = mesh(new THREE.BoxGeometry(size * 1.02, size * 0.15, size * 1.02), mat(0x5a3a22), { y: 0 })
  c.add(bands)
  ctx.group.add(c)
  if (y === 0) ctx.addCollider(x, z, size * 0.7)
}

export function barrel(ctx, x, z) {
  const b = mesh(new THREE.CylinderGeometry(0.4, 0.4, 1, 10), mat(0x8a5a32), { x, y: 0.5, z })
  b.add(mesh(new THREE.TorusGeometry(0.41, 0.04, 4, 16), mat(0x444444), { y: 0.3 }))
  b.add(mesh(new THREE.TorusGeometry(0.41, 0.04, 4, 16), mat(0x444444), { y: -0.3 }))
  b.children.forEach((r) => { r.rotation.x = Math.PI / 2 })
  ctx.group.add(b)
  ctx.addCollider(x, z, 0.5)
}

export function banner(ctx, x, z, { color = 0x2f4e8c, h = 4 } = {}) {
  ctx.group.add(mesh(new THREE.CylinderGeometry(0.07, 0.09, h, 6), mat(0x5a3a22), { x, y: h / 2, z }))
  ctx.group.add(mesh(new THREE.ConeGeometry(0.15, 0.3, 6), mat(0xf1c40f), { x, y: h + 0.15, z }))
  const flag = mesh(new THREE.PlaneGeometry(0.9, 1.6, 4, 1), mat(color, { side: THREE.DoubleSide }), { x: x + 0.5, y: h - 0.9, z, shadow: false })
  ctx.group.add(flag)
  ctx.addCollider(x, z, 0.2)
  ctx.animated.push((dt, t) => { flag.rotation.y = Math.sin(t * 2 + x) * 0.25 })
}

export function windmill(ctx, x, z, { rotY = 0 } = {}) {
  const g = new THREE.Group()
  g.position.set(x, 0, z)
  g.rotation.y = rotY
  g.add(mesh(new THREE.CylinderGeometry(1.4, 2, 6, 8), mat(0xe8dcc0), { y: 3 }))
  g.add(mesh(new THREE.ConeGeometry(1.8, 2, 8), mat(0x8a4a2f), { y: 7 }))
  g.add(mesh(new THREE.BoxGeometry(0.8, 1.4, 0.1), mat(0x5a3a22), { y: 0.7, z: 1.75 }))
  const hub = new THREE.Group()
  hub.position.set(0, 5.2, 1.6)
  for (let i = 0; i < 4; i++) {
    const blade = mesh(new THREE.BoxGeometry(0.5, 4, 0.06), mat(0xf5ecd6), { y: 2 })
    const arm = new THREE.Group()
    arm.rotation.z = (i / 4) * Math.PI * 2
    arm.add(blade)
    hub.add(arm)
  }
  g.add(hub)
  ctx.group.add(g)
  ctx.addCollider(x, z, 2)
  ctx.animated.push((dt) => { hub.rotation.z += dt * 0.8 })
}

export function well(ctx, x, z) {
  const stone = mat(0x9a948a)
  ctx.group.add(mesh(new THREE.CylinderGeometry(1, 1.1, 0.9, 12, 1, true), stone, { x, y: 0.45, z }))
  const water = mesh(new THREE.CircleGeometry(0.95, 12), mat(0x2f6fa8), { x, y: 0.5, z, shadow: false })
  water.rotation.x = -Math.PI / 2
  ctx.group.add(water)
  ctx.group.add(mesh(new THREE.BoxGeometry(0.12, 2, 0.12), mat(0x5a3a22), { x: x - 0.9, y: 1.4, z }))
  ctx.group.add(mesh(new THREE.BoxGeometry(0.12, 2, 0.12), mat(0x5a3a22), { x: x + 0.9, y: 1.4, z }))
  const roof = new THREE.ConeGeometry(1.5, 0.9, 4)
  roof.rotateY(Math.PI / 4)
  ctx.group.add(mesh(roof, mat(0x8a4a2f), { x, y: 2.75, z }))
  ctx.addCollider(x, z, 1.2)
}

export function lantern(ctx, x, z, { color = 0xffb347 } = {}) {
  ctx.group.add(mesh(new THREE.CylinderGeometry(0.06, 0.08, 2.4, 6), mat(0x3a2a1a), { x, y: 1.2, z }))
  ctx.group.add(mesh(new THREE.BoxGeometry(0.35, 0.45, 0.35), mat(color, { emissive: color, emissiveIntensity: 2.2 }), { x, y: 2.55, z, shadow: false }))
  ctx.addCollider(x, z, 0.2)
}

// ---------- Ville ----------

export function bench(ctx, x, z, { rotY = 0 } = {}) {
  place(ctx, 'parkBench', x, z, { width: 1.9, rotY: rotY + Math.PI, r: 0.8 })
}

export function streetLamp(ctx, x, z, { color = 0xffd27a } = {}) {
  ctx.group.add(mesh(new THREE.CylinderGeometry(0.08, 0.12, 3.4, 8), mat(0x2b2b33), { x, y: 1.7, z }))
  ctx.group.add(mesh(new THREE.SphereGeometry(0.3, 12, 10), mat(0xfff0b0, { emissive: color, emissiveIntensity: 2.5 }), { x, y: 3.5, z, shadow: false }))
  ctx.addCollider(x, z, 0.3)
}

export function trashBin(ctx, x, z) {
  ctx.group.add(mesh(new THREE.CylinderGeometry(0.3, 0.25, 0.8, 10), mat(0x2f7a52), { x, y: 0.4, z }))
  ctx.addCollider(x, z, 0.35)
}

export function cafe(ctx, x, z, { color = 0xe74c3c } = {}) {
  for (const [dx, dz] of [[-1.3, 0], [1.3, 0]]) {
    const tx = x + dx
    const tz = z + dz
    ctx.group.add(mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.06, 12), mat(0xffffff), { x: tx, y: 0.8, z: tz }))
    ctx.group.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.4, 6), mat(0xcccccc), { x: tx, y: 1.2, z: tz }))
    ctx.group.add(mesh(new THREE.ConeGeometry(1.1, 0.5, 8), mat(color), { x: tx, y: 2.5, z: tz }))
    for (const s of [-0.7, 0.7]) ctx.group.add(mesh(new THREE.BoxGeometry(0.4, 0.5, 0.4), mat(0x5a3a22), { x: tx + s, y: 0.25, z: tz }))
    ctx.addCollider(tx, tz, 0.9)
  }
}

export function billboard(ctx, x, z, { text = 'antoinequarroz.ch', rotY = 0, bg = '#1a1530', fg = '#ffb347' } = {}) {
  const g = new THREE.Group()
  g.position.set(x, 0, z)
  g.rotation.y = rotY
  g.add(mesh(new THREE.BoxGeometry(0.2, 3, 0.2), mat(0x333333), { x: -1.6, y: 1.5 }))
  g.add(mesh(new THREE.BoxGeometry(0.2, 3, 0.2), mat(0x333333), { x: 1.6, y: 1.5 }))
  const face = new THREE.MeshStandardMaterial({ map: textTexture(text, { bg, fg, font: 'bold 52px sans-serif' }), emissive: 0xffffff, emissiveIntensity: 0.25 })
  face.emissiveMap = face.map
  g.add(mesh(new THREE.BoxGeometry(4, 1.3, 0.15), [mat(0x222222), mat(0x222222), mat(0x222222), mat(0x222222), face, mat(0x222222)], { y: 3.4 }))
  ctx.group.add(g)
  ctx.addCollider(x, z, 0.5)
}

export function parkedCar(ctx, x, z, { rotY = 0, kind = 'truck' } = {}) {
  ctx.group.add(model(kind, { width: 3.6, x, z, rotY }))
  ctx.addCollider(x, z, 1.6)
}

export function footballPitch(ctx, x, z, { w = 16, l = 10 } = {}) {
  const grass = mesh(new THREE.PlaneGeometry(w, l), mat(0x3d9a40), { x, y: 0.04, z, shadow: false })
  grass.rotation.x = -Math.PI / 2
  ctx.group.add(grass)
  const line = mat(0xffffff)
  const lines = [
    [w, 0.12, 0, -l / 2], [w, 0.12, 0, l / 2], [0.12, l, -w / 2, 0], [0.12, l, w / 2, 0], [0.12, l, 0, 0],
  ]
  for (const [lw, ll, lx, lz] of lines) {
    const m = mesh(new THREE.PlaneGeometry(lw, ll), line, { x: x + lx, y: 0.05, z: z + lz, shadow: false })
    m.rotation.x = -Math.PI / 2
    ctx.group.add(m)
  }
  const circle = mesh(new THREE.RingGeometry(1.6, 1.75, 32), line, { x, y: 0.05, z, shadow: false })
  circle.rotation.x = -Math.PI / 2
  ctx.group.add(circle)
  for (const side of [-1, 1]) {
    const gx = x + side * (w / 2)
    const goal = new THREE.Group()
    goal.position.set(gx, 0, z)
    goal.add(mesh(new THREE.BoxGeometry(0.12, 1.6, 0.12), line, { y: 0.8, z: -1.5 }))
    goal.add(mesh(new THREE.BoxGeometry(0.12, 1.6, 0.12), line, { y: 0.8, z: 1.5 }))
    goal.add(mesh(new THREE.BoxGeometry(0.12, 0.12, 3.1), line, { y: 1.6 }))
    ctx.group.add(goal)
  }
}

export function bleachers(ctx, x, z, { w = 8, rotY = 0 } = {}) {
  const g = new THREE.Group()
  g.position.set(x, 0, z)
  g.rotation.y = rotY
  for (let i = 0; i < 3; i++) g.add(mesh(new THREE.BoxGeometry(w, 0.5, 0.9), mat([0x2f6fd8, 0xe74c3c, 0xf1c40f][i]), { y: 0.25 + i * 0.5, z: -i * 0.9 }))
  ctx.group.add(g)
  for (let d = -w / 2 + 1; d <= w / 2 - 1; d += 2) ctx.addCollider(x + Math.cos(rotY) * d, z - Math.sin(rotY) * d, 1.4)
}

export function solarPanel(ctx, x, z, { rotY = 0 } = {}) {
  const g = new THREE.Group()
  g.position.set(x, 0, z)
  g.rotation.y = rotY
  g.add(mesh(new THREE.CylinderGeometry(0.06, 0.06, 1, 6), mat(0x888888), { y: 0.5 }))
  const panel = mesh(new THREE.BoxGeometry(2, 0.06, 1.2), mat(0x1f3d8a, { metalness: 0.6, roughness: 0.25 }), { y: 1.05 })
  panel.rotation.x = -0.5
  g.add(panel)
  ctx.group.add(g)
  ctx.addCollider(x, z, 0.8)
}

// ---------- Espace ----------

export function dome(ctx, x, z, { r = 3, color = 0xdfe6f0 } = {}) {
  ctx.group.add(mesh(new THREE.SphereGeometry(r, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat(color, { metalness: 0.3, roughness: 0.4 }), { x, z }))
  ctx.group.add(mesh(new THREE.TorusGeometry(r, 0.15, 6, 32), mat(0x6fd3ff, { emissive: 0x6fd3ff, emissiveIntensity: 1.5 }), { x, y: 0.1, z, shadow: false }).rotateX(Math.PI / 2))
  ctx.addCollider(x, z, r + 0.2)
}

export function antenna(ctx, x, z, { h = 5 } = {}) {
  ctx.group.add(mesh(new THREE.CylinderGeometry(0.08, 0.2, h, 6), mat(0xaaaaaa), { x, y: h / 2, z }))
  const tip = mesh(new THREE.SphereGeometry(0.2, 8, 6), mat(0xff4a4a, { emissive: 0xff2a2a, emissiveIntensity: 2 }), { x, y: h, z, shadow: false })
  ctx.group.add(tip)
  ctx.addCollider(x, z, 0.3)
  ctx.animated.push((dt, t) => { tip.material.emissiveIntensity = Math.sin(t * 4 + x) > 0 ? 3 : 0.2 })
}

export function rover(ctx, x, z, { rotY = 0, drive = false } = {}) {
  const g = new THREE.Group()
  g.position.set(x, 0, z)
  g.rotation.y = rotY
  g.add(mesh(new THREE.BoxGeometry(1.6, 0.5, 2.4), mat(0xe8e8e8), { y: 0.75 }))
  g.add(mesh(new THREE.BoxGeometry(1.2, 0.5, 0.8), mat(0xf2a33a), { y: 1.25, z: -0.5 }))
  g.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 1, 4), mat(0x888888), { x: 0.5, y: 1.6, z: 0.6 }))
  g.add(mesh(new THREE.SphereGeometry(0.25, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xffffff, { side: THREE.DoubleSide }), { x: 0.5, y: 2.1, z: 0.6 }))
  for (const [wx, wz] of [[-0.9, -0.8], [0.9, -0.8], [-0.9, 0], [0.9, 0], [-0.9, 0.8], [0.9, 0.8]]) {
    const w = mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.25, 10), mat(0x333333), { x: wx, y: 0.32, z: wz })
    w.rotation.z = Math.PI / 2
    g.add(w)
  }
  ctx.group.add(g)
  if (drive) {
    ctx.animated.push((dt, t) => {
      g.position.x = x + Math.cos(t * 0.25) * 3
      g.position.z = z + Math.sin(t * 0.25) * 3
      g.rotation.y = -t * 0.25
    })
  } else ctx.addCollider(x, z, 1.4)
}

export function landingPad(ctx, x, z, { r = 3 } = {}) {
  const pad = mesh(new THREE.CylinderGeometry(r, r + 0.2, 0.2, 24), mat(0x4a4f5e), { x, y: 0.1, z })
  ctx.group.add(pad)
  const h = mesh(new THREE.RingGeometry(r * 0.5, r * 0.6, 24), mat(0xf1c40f, { side: THREE.DoubleSide }), { x, y: 0.21, z, shadow: false })
  h.rotation.x = -Math.PI / 2
  ctx.group.add(h)
  const lights = []
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2
    const l = mesh(new THREE.SphereGeometry(0.12, 6, 4), mat(0x6fd3ff, { emissive: 0x6fd3ff, emissiveIntensity: 2 }), { x: x + Math.cos(a) * r, y: 0.25, z: z + Math.sin(a) * r, shadow: false })
    lights.push(l)
    ctx.group.add(l)
  }
  ctx.animated.push((dt, t) => lights.forEach((l, i) => { l.material.emissiveIntensity = (Math.floor(t * 6) % 8) === i ? 4 : 0.6 }))
}

export function alienPlant(ctx, x, z, { color = 0x7dff9a, scale = 1 } = {}) {
  const r = rand(x * 7 + z)
  for (let i = 0; i < 3; i++) {
    const h = (1 + r() * 1.5) * scale
    const ox = (r() - 0.5) * 0.8
    const oz = (r() - 0.5) * 0.8
    const stalk = mesh(new THREE.CylinderGeometry(0.05, 0.1, h, 5), mat(0x2f6a5a), { x: x + ox, y: h / 2, z: z + oz })
    stalk.rotation.z = ox * 0.4
    const bulb = mesh(new THREE.SphereGeometry(0.22 * scale, 10, 8), mat(color, { emissive: color, emissiveIntensity: 1.6 }), { x: x + ox * 1.3, y: h, z: z + oz, shadow: false })
    ctx.group.add(stalk, bulb)
    ctx.animated.push((dt, t) => { bulb.scale.setScalar(1 + Math.sin(t * 2 + i + x) * 0.15) })
  }
  ctx.addCollider(x, z, 0.5)
}

export function holoRing(ctx, x, z, { color = 0xb48cff, y = 3 } = {}) {
  const rings = [1.2, 0.9].map((r, i) => {
    const ring = mesh(new THREE.TorusGeometry(r, 0.05, 6, 40), mat(color, { emissive: color, emissiveIntensity: 2.5, transparent: true, opacity: 0.8 }), { x, y, z, shadow: false })
    ctx.group.add(ring)
    return ring
  })
  ctx.group.add(mesh(new THREE.CylinderGeometry(0.5, 0.7, 0.4, 12), mat(0x444a5a), { x, y: 0.2, z }))
  ctx.addCollider(x, z, 0.7)
  ctx.animated.push((dt, t) => {
    rings[0].rotation.set(t, t * 0.7, 0)
    rings[1].rotation.set(-t * 1.3, 0, t)
  })
}

export function cargo(ctx, x, z, { color = 0xd35400, rotY = 0 } = {}) {
  const c = mesh(new THREE.BoxGeometry(3, 1.4, 1.4), mat(color, { metalness: 0.3 }), { x, y: 0.7, z })
  c.rotation.y = rotY
  for (let i = -1; i <= 1; i++) c.add(mesh(new THREE.BoxGeometry(0.06, 1.42, 1.42), mat(0x333333), { x: i * 1 }))
  ctx.group.add(c)
  ctx.addCollider(x, z, 1.5)
}
