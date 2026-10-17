import * as THREE from 'three'
import { jitter, mat, mesh, textTexture } from './helpers.js'
import { model, animate } from './models.js'
import { water } from './nature.js'

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

export function pond(ctx, x, z, { r = 3, bank = 0x6b4a32, deep, shallow } = {}) {
  const surface = water(ctx, x, z, { r, bank, deep, shallow })
  // Nénuphars.
  const pads = rand(x + z)
  for (let i = 0; i < 4; i++) {
    const a = pads() * Math.PI * 2
    const d = 0.3 * r + pads() * r * 0.4
    const pad = mesh(new THREE.CircleGeometry(0.35, 7, 0.4, Math.PI * 1.8), mat(0x4f9a3a, { side: THREE.DoubleSide }), { x: x + Math.cos(a) * d, y: 0.1, z: z + Math.sin(a) * d, shadow: false })
    pad.rotation.x = -Math.PI / 2
    ctx.group.add(pad)
  }
  ctx.addCollider(x, z, r * 0.8)
  return surface
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
  const face = new THREE.MeshStandardMaterial({ map: textTexture(text, { bg, fg, font: 'bold 52px "Nunito Variable", system-ui, sans-serif' }), emissive: 0xffffff, emissiveIntensity: 0.25 })
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
  ctx.noGrass?.push({ type: 'rect', x, z, w: w + 0.6, l: l + 0.6 })
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
    const goal = soccerGoal({ width: 3.1, height: 1.6, depth: 1.1 })
    goal.position.set(gx, 0, z)
    goal.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2
    ctx.group.add(goal)
    for (const pz of [-1.5, 1.5]) ctx.addCollider(gx, z + pz, 0.15)
    // Le filet arrête le joueur (et le ballon) derrière la ligne.
    for (const pz of [-1.2, -0.4, 0.4, 1.2]) ctx.addCollider(gx + side * 1.15, z + pz, 0.3, 1.6)
  }
}

// Texture de filet : mailles blanches sur fond transparent.
let netTexture = null
function netMaterial() {
  if (!netTexture) {
    const c = document.createElement('canvas')
    c.width = c.height = 64
    const g = c.getContext('2d')
    g.strokeStyle = '#ffffff'
    g.lineWidth = 3
    g.beginPath()
    for (const k of [0, 32, 64]) {
      g.moveTo(k, 0)
      g.lineTo(k, 64)
      g.moveTo(0, k)
      g.lineTo(64, k)
    }
    g.stroke()
    netTexture = new THREE.CanvasTexture(c)
    netTexture.wrapS = netTexture.wrapT = THREE.RepeatWrapping
  }
  return (w, h) => {
    const t = netTexture.clone()
    t.repeat.set(w * 3, h * 3)
    t.needsUpdate = true
    return new THREE.MeshStandardMaterial({ map: t, alphaMap: t, transparent: true, alphaTest: 0.35, side: THREE.DoubleSide, color: 0xf4f4f4, roughness: 1 })
  }
}

// But de foot avec poteaux, barre, cadre arrière et filet. L'ouverture regarde vers +z local.
export function soccerGoal({ width = 3.6, height = 2, depth = 1.2, color = 0xffffff } = {}) {
  const g = new THREE.Group()
  const white = mat(color)
  const half = width / 2
  g.add(mesh(new THREE.BoxGeometry(0.14, height, 0.14), white, { x: -half, y: height / 2 }))
  g.add(mesh(new THREE.BoxGeometry(0.14, height, 0.14), white, { x: half, y: height / 2 }))
  g.add(mesh(new THREE.BoxGeometry(width + 0.14, 0.14, 0.14), white, { y: height }))
  // Cadre arrière (tubes fins).
  const tube = mat(0xd8d8d8)
  for (const sx of [-half, half]) {
    g.add(mesh(new THREE.BoxGeometry(0.06, 0.06, depth), tube, { x: sx, y: height, z: -depth / 2 }))
    g.add(mesh(new THREE.BoxGeometry(0.06, 0.06, depth), tube, { x: sx, y: 0.03, z: -depth / 2 }))
    g.add(mesh(new THREE.BoxGeometry(0.06, height, 0.06), tube, { x: sx, y: height / 2, z: -depth }))
  }
  g.add(mesh(new THREE.BoxGeometry(width, 0.06, 0.06), tube, { y: 0.03, z: -depth }))
  const net = netMaterial()
  const back = mesh(new THREE.PlaneGeometry(width, height), net(width, height), { y: height / 2, z: -depth, shadow: false })
  const top = mesh(new THREE.PlaneGeometry(width, depth), net(width, depth), { y: height, z: -depth / 2, shadow: false })
  top.rotation.x = -Math.PI / 2
  g.add(back, top)
  for (const sx of [-half, half]) {
    const sideNet = mesh(new THREE.PlaneGeometry(depth, height), net(depth, height), { x: sx, y: height / 2, z: -depth / 2, shadow: false })
    sideNet.rotation.y = Math.PI / 2
    g.add(sideNet)
  }
  return g
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

// ---------- Style « Bruno / Mike » ----------

// Arbre à nuées de feuilles : tronc anguleux et boules de petites feuilles (voir nature.js).
export function leafTree(ctx, x, z, { palette = 'pink', height = 3.2, size = 1, collide = true, rotY } = {}) {
  const r = rand(x * 11 + z * 7)
  const tree = new THREE.Group()
  tree.position.set(x, 0, z)
  tree.rotation.y = rotY ?? r() * Math.PI * 2
  const bark = mat(0x5a3a2a)
  const trunk = mesh(new THREE.CylinderGeometry(0.16 * size, 0.3 * size, height, 5), bark, { y: height / 2 })
  trunk.rotation.z = (r() - 0.5) * 0.15
  tree.add(trunk)
  // Deux branches qui partent du tronc.
  for (const side of [-1, 1]) {
    const b = mesh(new THREE.CylinderGeometry(0.06 * size, 0.12 * size, 1.4 * size, 4), bark, { x: side * 0.45 * size, y: height * 0.78, z: (r() - 0.5) * 0.3 })
    b.rotation.z = -side * 0.8
    tree.add(b)
  }
  const top = height + 0.2 * size
  tree.userData.leafClouds = [
    { x: 0, y: top, z: 0, r: 1.35 * size, palette },
    { x: 0.95 * size, y: top - 0.55 * size, z: 0.2 * size, r: 1.0 * size, palette },
    { x: -0.9 * size, y: top - 0.45 * size, z: -0.25 * size, r: 1.05 * size, palette },
    { x: 0.1 * size, y: top + 0.8 * size, z: -0.3 * size, r: 0.85 * size, palette },
  ]
  ctx.group.add(tree)
  if (collide) ctx.addCollider(x, z, 0.45 * size)
  return tree
}

// Buisson : une ou deux boules de feuilles posées au sol.
export function bush(ctx, x, z, { palette = 'green', size = 1 } = {}) {
  const r = rand(x * 5 + z * 13)
  const b = new THREE.Group()
  b.position.set(x, 0, z)
  b.userData.leafClouds = [{ x: 0, y: 0.55 * size, z: 0, r: 0.75 * size, palette, fall: false }]
  if (r() < 0.6) b.userData.leafClouds.push({ x: 0.6 * size, y: 0.4 * size, z: 0.3 * size, r: 0.5 * size, palette, fall: false })
  ctx.group.add(b)
  return b
}

// Lanterne de chemin façon potence (Mike) : poteau, bras et lanterne qui luit.
export function gallowsLantern(ctx, x, z, { rotY = 0, color = 0xff7ad9, light = false } = {}) {
  const g = new THREE.Group()
  g.position.set(x, 0, z)
  g.rotation.y = rotY
  const wood = mat(0x8a4f3a)
  g.add(mesh(new THREE.BoxGeometry(0.5, 0.35, 0.5), mat(0x7f86a8), { y: 0.17 }))
  g.add(mesh(new THREE.BoxGeometry(0.2, 3, 0.2), wood, { y: 1.6 }))
  g.add(mesh(new THREE.BoxGeometry(1.1, 0.16, 0.16), wood, { x: 0.45, y: 3 }))
  const brace = mesh(new THREE.BoxGeometry(0.1, 0.6, 0.1), wood, { x: 0.25, y: 2.75 })
  brace.rotation.z = Math.PI / 4
  g.add(brace)
  g.add(mesh(new THREE.BoxGeometry(0.02, 0.35, 0.02), mat(0x222222), { x: 0.85, y: 2.75, shadow: false }))
  const lamp = new THREE.Group()
  lamp.position.set(0.85, 2.3, 0)
  lamp.add(mesh(new THREE.BoxGeometry(0.42, 0.08, 0.42), mat(0x3a2a2a), { y: 0.3 }))
  lamp.add(mesh(new THREE.ConeGeometry(0.32, 0.22, 4).rotateY(Math.PI / 4), mat(0x3a2a2a), { y: 0.44 }))
  lamp.add(mesh(new THREE.BoxGeometry(0.34, 0.5, 0.34), mat(0xffe6f4, { emissive: color, emissiveIntensity: 2.6 }), { shadow: false }))
  lamp.add(mesh(new THREE.BoxGeometry(0.42, 0.08, 0.42), mat(0x3a2a2a), { y: -0.28 }))
  g.add(lamp)
  if (light) {
    const l = new THREE.PointLight(color, 6, 9, 1.6)
    l.position.set(0.85, 2.1, 0)
    g.add(l)
  }
  ctx.group.add(g)
  ctx.addCollider(x, z, 0.3)
  ctx.animated.push((dt, t) => { lamp.rotation.z = Math.sin(t * 1.3 + x) * 0.05 })
  return g
}

// Flèches de roche lavande, hautes et anguleuses (fond du décor de Mike).
export function spires(ctx, x, z, { height = 6, count = 4, color = 0xa9a3ea, spread = 1.6, collide = true, glow = null } = {}) {
  const r = rand(x * 3 + z * 19)
  const material = mat(color, glow ? { roughness: 0.4, emissive: glow, emissiveIntensity: 0.35 } : { roughness: 0.75 })
  for (let i = 0; i < count; i++) {
    const h = height * (0.45 + r() * 0.65)
    const w = 0.5 + r() * 0.7
    const g = new THREE.CylinderGeometry(0.04, w, h, 4 + Math.floor(r() * 2), 1)
    jitter(g, 0.12, i + Math.round(x * 10))
    const s = mesh(g, material, { x: x + (r() - 0.5) * spread * 2, y: h / 2 - 0.2, z: z + (r() - 0.5) * spread * 2 })
    s.rotation.set((r() - 0.5) * 0.25, r() * 3, (r() - 0.5) * 0.25)
    ctx.group.add(s)
  }
  if (collide) ctx.addCollider(x, z, spread + 0.4)
}

// Barrière en bois le long d'une ligne brisée [[x, z], ...].
export function fence(ctx, pts, { color = 0x6a4433, collide = true } = {}) {
  const wood = mat(color)
  for (let s = 0; s < pts.length - 1; s++) {
    const [ax, az] = pts[s]
    const [bx, bz] = pts[s + 1]
    const len = Math.hypot(bx - ax, bz - az)
    const n = Math.max(1, Math.round(len / 1.6))
    const seg = new THREE.Group()
    seg.position.set(ax, 0, az)
    seg.rotation.y = Math.atan2(bx - ax, bz - az)
    for (let k = 0; k <= n; k++) {
      seg.add(mesh(new THREE.BoxGeometry(0.18, 1.1, 0.18), wood, { y: 0.55, z: (len * k) / n }))
      if (collide) ctx.addCollider(ax + ((bx - ax) * k) / n, az + ((bz - az) * k) / n, 0.35, 1.7)
    }
    for (const y of [0.45, 0.85]) seg.add(mesh(new THREE.BoxGeometry(0.08, 0.14, len), wood, { y, z: len / 2 }))
    ctx.group.add(seg)
    // Collider continu : petits cercles entre les poteaux.
    if (collide) for (let d = 0.8; d < len; d += 0.8) ctx.addCollider(ax + ((bx - ax) * d) / len, az + ((bz - az) * d) / len, 0.3, 1.7)
  }
}

// Guirlande de fanions entre deux points (coordonnées du groupe, y absolu).
export function bunting(group, a, b, { colors = [0xc2185b, 0xe8743b, 0x8e24aa], sag = 0.6, size = 0.45 } = {}) {
  const A = new THREE.Vector3(...a)
  const B = new THREE.Vector3(...b)
  const len = A.distanceTo(B)
  const n = Math.max(3, Math.round(len / 0.7))
  const flagGeo = new THREE.BufferGeometry()
  flagGeo.setAttribute('position', new THREE.Float32BufferAttribute([-size / 2, 0, 0, size / 2, 0, 0, 0, -size * 1.2, 0], 3))
  flagGeo.computeVertexNormals()
  const pts = []
  for (let k = 0; k <= n; k++) {
    const t = k / n
    const p = A.clone().lerp(B, t)
    p.y -= Math.sin(t * Math.PI) * sag
    pts.push(p)
  }
  const rope = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), n * 2, 0.025, 3), mat(0xe8e0d0))
  group.add(rope)
  for (let k = 1; k < n; k++) {
    const flag = new THREE.Mesh(flagGeo, mat(colors[k % colors.length], { side: THREE.DoubleSide }))
    flag.position.copy(pts[k])
    flag.rotation.y = Math.atan2(B.x - A.x, B.z - A.z) + Math.PI / 2
    group.add(flag)
  }
}

// Barrière sur le bord d'un lobe : suit les arêtes du polygone, un peu en retrait.
// from / count : première arête et nombre d'arêtes à clôturer.
export function rimFence(ctx, lobe, from, count, { inset = 0.5, color } = {}) {
  const pts = ctx.polys[lobe]
  const [cx, cz] = ctx.shape.lobes[lobe]
  const line = []
  for (let k = 0; k <= count; k++) {
    const [px, pz] = pts[(from + k) % pts.length]
    const d = Math.hypot(px - cx, pz - cz)
    line.push([px - ((px - cx) / d) * inset, pz - ((pz - cz) / d) * inset])
  }
  fence(ctx, line, { color })
}
