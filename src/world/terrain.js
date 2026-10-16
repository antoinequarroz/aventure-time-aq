import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { jitter, mat, mesh } from './helpers.js'
import { groundTexture } from './textures.js'

// Relief des îles : chaque île est faite de « lobes » (prismes à facettes à une hauteur donnée)
// qui se chevauchent, et de rampes ou escaliers qui relient les niveaux.
// Un lobe [x, z, r, h] devient un polygone irrégulier de 6 à 10 côtés : falaises droites,
// liseré d'herbe et dessous en pointe, comme une île découpée au couteau.
// Les coordonnées des formes sont locales à l'île ; le sol est géré en coordonnées monde.

export function createGround() {
  const surfaces = []
  const ramps = []

  // Hauteur du sol sous (x, z) : la plus haute surface sous les pieds, ou null (le vide).
  // terrainOnly ignore les plateformes de parcours (pour poser les décors).
  function heightAt(x, z, y = Infinity, terrainOnly = false) {
    let best = null
    for (const s of surfaces) {
      if (s.h > y + 0.3 || (best !== null && s.h <= best) || (terrainOnly && s.platform)) continue
      if (s.type === 'poly') {
        const dx = x - s.x
        const dz = z - s.z
        if (dx * dx + dz * dz <= s.r * s.r && insidePoly(s.pts, x, z)) best = s.h
      } else if (s.type === 'circle') {
        const dx = x - s.x
        const dz = z - s.z
        if (dx * dx + dz * dz <= s.r * s.r) best = s.h
      } else if (s.type === 'bridge' && alongSegment(s, x, z) !== null) {
        best = s.h
      }
    }
    for (const r of ramps) {
      const t = alongSegment(r, x, z)
      if (t === null) continue
      const h = r.ha + (r.hb - r.ha) * t
      if (h <= y + 0.45 && (best === null || h > best)) best = h
    }
    return best
  }

  function onRamp(x, z) {
    return ramps.some((r) => alongSegment(r, x, z) !== null)
  }

  // Empêche d'entrer dans le flanc d'une terrasse plus haute que le joueur.
  function pushOut(position, radius = 0.4) {
    if (onRamp(position.x, position.z)) return
    for (const s of surfaces) {
      if (s.solid === false || s.h <= position.y + 0.35) continue
      if (s.type === 'circle') {
        const dx = position.x - s.x
        const dz = position.z - s.z
        const min = s.r + radius
        const d2 = dx * dx + dz * dz
        if (d2 < min * min) {
          const d = Math.sqrt(d2) || 0.0001
          position.x = s.x + (dx / d) * min
          position.z = s.z + (dz / d) * min
        }
      } else if (s.type === 'poly') {
        const dx = position.x - s.x
        const dz = position.z - s.z
        if (dx * dx + dz * dz > (s.r + radius) ** 2) continue
        const [cx, cz] = closestOnPoly(s.pts, position.x, position.z)
        const inside = insidePoly(s.pts, position.x, position.z)
        const ex = position.x - cx
        const ez = position.z - cz
        const d = Math.hypot(ex, ez) || 0.0001
        if (inside) {
          position.x = cx - (ex / d) * radius
          position.z = cz - (ez / d) * radius
        } else if (d < radius) {
          position.x = cx + (ex / d) * radius
          position.z = cz + (ez / d) * radius
        }
      }
    }
  }

  // Vrai si (x, z) est à l'intérieur d'une terrasse trop haute pour y monter (dans la falaise).
  function blocked(x, z, y) {
    if (onRamp(x, z)) return false
    for (const s of surfaces) {
      if (s.solid === false || s.h <= y + 0.35) continue
      const dx = x - s.x
      const dz = z - s.z
      if (dx * dx + dz * dz > s.r * s.r) continue
      if (s.type === 'circle' || (s.type === 'poly' && insidePoly(s.pts, x, z))) return true
    }
    return false
  }

  return { surfaces, ramps, heightAt, onRamp, pushOut, blocked }
}

export function insidePoly(pts, x, z) {
  let inside = false
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, zi] = pts[i]
    const [xj, zj] = pts[j]
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside
  }
  return inside
}

function closestOnPoly(pts, x, z) {
  let best = null
  let bestD = Infinity
  for (let i = 0; i < pts.length; i++) {
    const [ax, az] = pts[i]
    const [bx, bz] = pts[(i + 1) % pts.length]
    const abx = bx - ax
    const abz = bz - az
    const t = Math.max(0, Math.min(1, ((x - ax) * abx + (z - az) * abz) / (abx * abx + abz * abz)))
    const px = ax + abx * t
    const pz = az + abz * t
    const d = (x - px) ** 2 + (z - pz) ** 2
    if (d < bestD) {
      bestD = d
      best = [px, pz]
    }
  }
  return best
}

function alongSegment(s, x, z) {
  const abx = s.bx - s.ax
  const abz = s.bz - s.az
  const t = ((x - s.ax) * abx + (z - s.az) * abz) / (abx * abx + abz * abz)
  if (t < 0 || t > 1) return null
  const px = s.ax + abx * t
  const pz = s.az + abz * t
  return (x - px) ** 2 + (z - pz) ** 2 <= (s.w / 2) ** 2 ? t : null
}

export const rng = (seed) => {
  let s = Math.abs(Math.round(seed * 7919)) % 2147483647 || 1
  return () => (s = (s * 16807) % 2147483647) / 2147483647
}

// Polygone irrégulier d'un lobe (coordonnées locales à l'île), toujours le même pour une île donnée.
export function lobePoly([x, z, r], seed) {
  const rnd = rng(seed)
  const n = r > 9 ? 8 + Math.floor(rnd() * 3) : r > 5 ? 7 + Math.floor(rnd() * 2) : 6
  const offset = rnd() * Math.PI * 2
  const pts = []
  for (let i = 0; i < n; i++) {
    const a = offset + ((i + (rnd() - 0.5) * 0.55) / n) * Math.PI * 2
    const rr = r * (1.02 + rnd() * 0.14)
    pts.push([x + Math.cos(a) * rr, z + Math.sin(a) * rr])
  }
  return pts
}

export function shapePolys(shape, center) {
  return shape.lobes.map((lobe, i) => lobePoly(lobe, center.x * 0.13 + center.z * 0.07 + i * 11 + lobe[2]))
}

// Rayon englobant d'une forme, pour savoir sur quelle île on se trouve.
export function shapeRadius(shape) {
  return Math.max(...shape.lobes.map(([x, z, r]) => Math.hypot(x, z) + r * 1.1))
}

// Point de bord d'une île le long d'une direction (pour poser les passerelles).
export function edgeAlong(shape, dir, center) {
  const polys = shapePolys(shape, center)
  const inside = (x, z) => shape.lobes.some((l, i) => l[3] === 0 && insidePoly(polys[i], x, z))
  let last = 0
  for (let t = 0; t < 80; t += 0.25) {
    if (inside(dir.x * t, dir.z * t)) last = t
    else if (last > 0) break
  }
  return last
}

// Assemble des anneaux de polygones (même nombre de sommets) en parois à facettes.
// Chaque triangle reçoit sa propre nuance : les faces se lisent comme taillées.
function ringsGeometry(rings, tip, ref, rnd) {
  const positions = []
  const colors = []
  const c = new THREE.Color()
  const v = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]
  const n = new THREE.Vector3()
  const e1 = new THREE.Vector3()
  const e2 = new THREE.Vector3()
  const tri = (a, b, d, color) => {
    v[0].set(...a)
    v[1].set(...b)
    v[2].set(...d)
    e1.subVectors(v[1], v[0])
    e2.subVectors(v[2], v[0])
    n.crossVectors(e1, e2)
    const cx = (a[0] + b[0] + d[0]) / 3 - ref.x
    const cy = (a[1] + b[1] + d[1]) / 3 - ref.y
    const cz = (a[2] + b[2] + d[2]) / 3 - ref.z
    const flip = n.x * cx + n.y * cy + n.z * cz < 0
    const order = flip ? [v[0], v[2], v[1]] : v
    for (const p of order) positions.push(p.x, p.y, p.z)
    c.copy(color).offsetHSL(0, 0, (rnd() - 0.5) * 0.07)
    for (let k = 0; k < 3; k++) colors.push(c.r, c.g, c.b)
  }
  for (let k = 0; k < rings.length - 1; k++) {
    const A = rings[k]
    const B = rings[k + 1]
    const color = new THREE.Color(A.color).lerp(B.color, 0.5)
    for (let i = 0; i < A.pts.length; i++) {
      const j = (i + 1) % A.pts.length
      const a0 = [A.pts[i][0], A.y, A.pts[i][1]]
      const a1 = [A.pts[j][0], A.y, A.pts[j][1]]
      const b0 = [B.pts[i][0], B.y + (B.dy?.[i] ?? 0), B.pts[i][1]]
      const b1 = [B.pts[j][0], B.y + (B.dy?.[j] ?? 0), B.pts[j][1]]
      tri(a0, a1, b1, color)
      tri(a0, b1, b0, color)
    }
  }
  if (tip) {
    const L = rings[rings.length - 1]
    for (let i = 0; i < L.pts.length; i++) {
      const j = (i + 1) % L.pts.length
      tri([L.pts[i][0], L.y + (L.dy?.[i] ?? 0), L.pts[i][1]], [L.pts[j][0], L.y + (L.dy?.[j] ?? 0), L.pts[j][1]], [tip.x, tip.y, tip.z], new THREE.Color(L.color).lerp(tip.color, 0.5))
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  g.computeVertexNormals()
  return g
}

// Anneau mis à l'échelle autour du centre du lobe, avec des sommets un peu décalés.
function scaleRing(pts, cx, cz, k, rnd, wobble = 0) {
  return pts.map(([px, pz]) => {
    const w = 1 + (rnd() - 0.5) * wobble
    return [cx + (px - cx) * k * w, cz + (pz - cz) * k * w]
  })
}

// Dessus du lobe : éventail de triangles, UV en coordonnées monde pour que la texture
// se raccorde parfaitement d'un lobe à l'autre.
function capGeometry(pts, cx, cz, h, center, uvScale) {
  const positions = []
  const uvs = []
  const push = (x, z) => {
    positions.push(x, h, z)
    uvs.push((x + center.x) * uvScale, -(z + center.z) * uvScale)
  }
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length
    push(cx, cz)
    push(pts[j][0], pts[j][1])
    push(pts[i][0], pts[i][1])
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  g.computeVertexNormals()
  // Le dessus est tourné vers le haut quel que soit le sens des sommets.
  if (g.attributes.normal.getY(0) < 0) {
    for (let i = 0; i < positions.length; i += 9) {
      for (let k = 0; k < 3; k++) {
        const a = positions[i + 3 + k]
        positions[i + 3 + k] = positions[i + 6 + k]
        positions[i + 6 + k] = a
      }
    }
    const uvSwap = uvs
    for (let i = 0; i < uvSwap.length; i += 6) {
      for (let k = 0; k < 2; k++) {
        const a = uvSwap[i + 2 + k]
        uvSwap[i + 2 + k] = uvSwap[i + 4 + k]
        uvSwap[i + 4 + k] = a
      }
    }
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvSwap, 2))
    g.computeVertexNormals()
  }
  return g
}

// Construit le relief d'une île et enregistre ses surfaces dans le sol.
export function buildTerrain(ctx, shape, ground, { lunar = false, stairs = 'stone', era = 'past' } = {}) {
  const { group, theme, center } = ctx
  const lobes = shape.lobes
  const polys = shapePolys(shape, center)
  ctx.polys = polys
  ctx.noGrass = []
  const isOver = (x, z, h) => lobes.some(([lx, lz, r, lh]) => lh < h && (x - lx) ** 2 + (z - lz) ** 2 <= (r - 1) ** 2)
  const tex = groundTexture(era)
  const capMaterial = new THREE.MeshStandardMaterial({ map: tex.map, roughness: 1, color: 0xffffff })
  const caps = []
  const walls = []
  const lip = new THREE.Color(theme.lip ?? theme.top)
  const rockTop = new THREE.Color(theme.rock)
  const rockLow = new THREE.Color(theme.rock).offsetHSL(0, 0.02, -0.12)
  const tipColor = new THREE.Color(theme.rock).offsetHSL(0.02, 0, -0.2)
  const islandR = shapeRadius(shape)

  lobes.forEach(([x, z, r, h], i) => {
    const seed = center.x * 0.13 + center.z * 0.07 + i * 11 + r
    const rnd = rng(seed + 0.5)
    const pts = polys[i]
    const worldPts = pts.map(([px, pz]) => [center.x + px, center.z + pz])
    ground.surfaces.push({ type: 'poly', pts: worldPts, x: center.x + x, z: center.z + z, r: r * 1.2, h })
    const floating = h === 0 || !isOver(x, z, h)

    caps.push(capGeometry(pts, x, z, h, center, tex.scale))

    // Parois : liseré d'herbe, puis falaise taillée jusqu'au niveau inférieur.
    const bottom = floating
      ? h - 2.6 - Math.min(3, r * 0.22)
      : Math.max(...lobes.filter(([lx, lz, lr, lh]) => lh < h && (x - lx) ** 2 + (z - lz) ** 2 <= (lr + r) ** 2).map((l) => l[3]), 0) - 0.6
    const lipH = lunar ? 0.15 : 0.4
    const span = h - lipH - bottom
    const rings = [
      { pts, y: h, color: lip },
      { pts, y: h - lipH, color: lip },
      { pts: scaleRing(pts, x, z, 1.0, rnd), y: h - lipH - 0.01, color: rockTop },
      { pts: scaleRing(pts, x, z, 1.03, rnd, 0.07), y: h - lipH - span * 0.4, color: rockTop },
      { pts: scaleRing(pts, x, z, 0.99, rnd, 0.08), y: bottom, color: rockLow },
    ]
    let tip = null
    if (floating) {
      // Dessous en pointe : deux anneaux qui rétrécissent puis une pointe décentrée.
      const depth = Math.min(r * 1.25, 4 + r * 0.9) * (0.85 + rnd() * 0.3)
      const ring1 = scaleRing(pts, x, z, 0.72, rnd, 0.25)
      const ring2 = scaleRing(pts, x, z, 0.36, rnd, 0.4)
      rings.push({ pts: ring1, y: bottom - depth * 0.35, dy: ring1.map(() => (rnd() - 0.5) * depth * 0.18), color: rockLow })
      rings.push({ pts: ring2, y: bottom - depth * 0.72, dy: ring2.map(() => (rnd() - 0.5) * depth * 0.2), color: tipColor })
      tip = { x: x + (rnd() - 0.5) * r * 0.3, y: bottom - depth, z: z + (rnd() - 0.5) * r * 0.3, color: tipColor }
    }
    walls.push(ringsGeometry(rings, tip, new THREE.Vector3(x, bottom, z), rnd))
  })

  const capMesh = new THREE.Mesh(mergeGeometries(caps), capMaterial)
  capMesh.receiveShadow = true
  capMesh.userData.terrain = true
  const wallMesh = new THREE.Mesh(mergeGeometries(walls), mat(0xffffff, { vertexColors: true }))
  wallMesh.castShadow = true
  wallMesh.receiveShadow = true
  wallMesh.userData.terrain = true
  group.add(capMesh, wallMesh)

  // Rampes et escaliers entre les niveaux.
  for (const [ax, az, ha, bx, bz, hb, w = 3] of shape.ramps ?? []) {
    ground.ramps.push({ ax: center.x + ax, az: center.z + az, ha, bx: center.x + bx, bz: center.z + bz, hb, w })
    buildStairs(group, theme, [ax, az, ha], [bx, bz, hb], w, stairs)
    ctx.noGrass.push({ type: 'seg', ax, az, bx, bz, w: w + 0.6 })
  }

  // Chemins de dalles et places pavées.
  for (const path of shape.paths ?? []) buildPath(ctx, ground, path, era)
  for (const plaza of shape.plazas ?? []) buildPlaza(ctx, ground, plaza, era)

  // Rochers flottants à facettes autour de l'île.
  const rnd = rng(center.x + center.z)
  const rockMat = mat(theme.rock)
  for (let i = 0; i < Math.round(islandR / 3); i++) {
    const a = rnd() * Math.PI * 2
    const g = jitter(new THREE.IcosahedronGeometry(0.5 + rnd() * 1.2, 0), 0.35, i + 3)
    g.scale(1, 1.4, 1)
    const m = mesh(g, rockMat, { x: Math.cos(a) * (islandR + 4 + rnd() * 7), y: -3 - rnd() * 10, z: Math.sin(a) * (islandR + 4 + rnd() * 7) })
    m.rotation.set(rnd(), rnd() * 3, rnd())
    m.userData.terrain = true
    group.add(m)
  }
}

const STONE = {
  past: { color: 0x7f7ba6, gap: 0x5d5a80 },
  present: { color: 0xd98a4e, gap: 0xa4552a },
  future: { color: 0x8d92a8, gap: 0x4b4f63 },
}

// Pierres plates irrégulières le long d'une ligne brisée : { pts: [[x, z], ...], w }.
function buildPath(ctx, ground, { pts, w = 2.2 }, era) {
  const { group, center } = ctx
  const rnd = rng(pts[0][0] * 3.1 + pts[0][1] + center.x)
  const geos = []
  const base = new THREE.Color(STONE[era].color)
  for (let s = 0; s < pts.length - 1; s++) {
    const [ax, az] = pts[s]
    const [bx, bz] = pts[s + 1]
    const len = Math.hypot(bx - ax, bz - az)
    const nx = -(bz - az) / len
    const nz = (bx - ax) / len
    ctx.noGrass.push({ type: 'seg', ax, az, bx, bz, w: w + 0.3 })
    for (let d = 0; d < len; d += 0.85) {
      const across = Math.max(1, Math.round(w / 0.95))
      for (let k = 0; k < across; k++) {
        const off = (k - (across - 1) / 2) * (w / across) + (rnd() - 0.5) * 0.25
        const px = ax + ((bx - ax) * d) / len + nx * off + (rnd() - 0.5) * 0.2
        const pz = az + ((bz - az) * d) / len + nz * off + (rnd() - 0.5) * 0.2
        const h = ground.heightAt(center.x + px, center.z + pz, Infinity, true)
        if (h === null || rnd() < 0.08) continue
        geos.push(stoneGeometry(px, h, pz, 0.3 + rnd() * 0.16, rnd, base))
      }
    }
  }
  addStones(group, geos)
}

// Place pavée de dalles hexagonales : [x, z, r].
function buildPlaza(ctx, ground, [x, z, r], era) {
  const { group, center } = ctx
  const rnd = rng(x * 7 + z * 3 + center.x)
  const size = 0.85
  const geos = []
  const base = new THREE.Color(STONE[era].color).offsetHSL(0, -0.03, -0.02)
  const dx = size * Math.sqrt(3)
  const dz = size * 1.5
  ctx.noGrass.push({ type: 'circle', x, z, r: r + 0.3 })
  for (let row = -Math.ceil(r / dz); row <= Math.ceil(r / dz); row++) {
    for (let col = -Math.ceil(r / dx) - 1; col <= Math.ceil(r / dx) + 1; col++) {
      const px = x + col * dx + (row % 2 ? dx / 2 : 0)
      const pz = z + row * dz
      if ((px - x) ** 2 + (pz - z) ** 2 > r * r) continue
      const h = ground.heightAt(center.x + px, center.z + pz, Infinity, true)
      if (h === null) continue
      const g = new THREE.CylinderGeometry(size - 0.07, size - 0.04, 0.14, 6)
      g.rotateY(Math.PI / 6)
      tint(g, new THREE.Color(base).offsetHSL(0, 0, (rnd() - 0.5) * 0.08))
      g.translate(px, h + 0.03, pz)
      geos.push(g.toNonIndexed())
    }
  }
  addStones(group, geos)
}

function stoneGeometry(x, h, z, r, rnd, base) {
  const sides = 5 + Math.floor(rnd() * 3)
  const g = new THREE.CylinderGeometry(r, r + 0.03, 0.12, sides)
  g.rotateY(rnd() * Math.PI)
  g.scale(1 + rnd() * 0.4, 1, 1 + rnd() * 0.3)
  tint(g, new THREE.Color(base).offsetHSL(0, 0, (rnd() - 0.5) * 0.1))
  g.translate(x, h + 0.02, z)
  return g.toNonIndexed()
}

function tint(g, color) {
  const n = g.attributes.position.count
  const colors = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) colors.set([color.r, color.g, color.b], i * 3)
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  g.deleteAttribute('uv')
}

function addStones(group, geos) {
  if (!geos.length) return
  const m = new THREE.Mesh(mergeGeometries(geos), mat(0xffffff, { vertexColors: true }))
  m.receiveShadow = true
  m.userData.terrain = true
  group.add(m)
}

function buildStairs(group, theme, [ax, az, ha], [bx, bz, hb], w, style) {
  const length = Math.hypot(bx - ax, bz - az)
  const stairs = new THREE.Group()
  stairs.position.set(ax, 0, az)
  stairs.rotation.y = Math.atan2(bx - ax, bz - az)
  stairs.userData.terrain = true
  const rise = hb - ha
  const steps = Math.max(2, Math.round(Math.abs(rise) / 0.3))
  const depth = length / steps
  const colors = {
    stone: [0x9a6a42, 0x86593a],
    metal: [0x9aa1ad, 0x8a909c],
    energy: [0x8f7bff, 0x7a66e6],
  }[style]
  const bottom = Math.min(ha, hb) - 0.6
  for (let k = 0; k < steps; k++) {
    const top = ha + (rise * (k + 1)) / steps
    const extra = style === 'energy' ? { emissive: 0x5a3fd6, emissiveIntensity: 0.6 } : {}
    if (style === 'stone') {
      // Marches en planches sur deux limons.
      stairs.add(mesh(new THREE.BoxGeometry(w - 0.1, 0.16, depth + 0.04), mat(colors[k % 2]), { y: top - 0.08, z: depth * (k + 0.5) }))
      stairs.add(mesh(new THREE.BoxGeometry(w - 0.4, top - bottom - 0.16, 0.08), mat(0x4a2e1c), { y: (top - 0.16 + bottom) / 2, z: depth * k + 0.04 }))
    } else {
      stairs.add(mesh(new THREE.BoxGeometry(w, top - bottom, depth + 0.02), mat(colors[k % 2], extra), { y: (top + bottom) / 2, z: depth * (k + 0.5) }))
    }
  }
  const railColor = style === 'stone' ? 0x5a3a22 : style === 'metal' ? 0xdddddd : 0xd9ccff
  for (const side of [-1, 1]) {
    if (style === 'stone') {
      // Limon, poteaux et main courante en bois sombre.
      const stringer = mesh(new THREE.BoxGeometry(0.22, 0.7, Math.hypot(length, rise) + 0.2), mat(0x5a3a22), { x: side * (w / 2), y: (ha + hb) / 2, z: length / 2 })
      stringer.rotation.x = -Math.atan2(rise, length)
      stairs.add(stringer)
      for (let k = 0; k <= 2; k++) {
        const t = k / 2
        stairs.add(mesh(new THREE.BoxGeometry(0.16, 1.2, 0.16), mat(railColor), { x: side * (w / 2), y: ha + rise * t + 0.6, z: length * t }))
      }
    }
    const rail = mesh(new THREE.BoxGeometry(style === 'stone' ? 0.1 : 0.25, style === 'stone' ? 0.1 : 0.5, Math.hypot(length, rise)), mat(railColor, style === 'energy' ? { emissive: 0xb48cff, emissiveIntensity: 1.5 } : {}), { x: side * (w / 2 + 0.05), y: (ha + hb) / 2 + (style === 'stone' ? 1.15 : 0.3), z: length / 2 })
    rail.rotation.x = -Math.atan2(rise, length)
    stairs.add(rail)
  }
  group.add(stairs)
}

// Pose les décors à la hauteur du terrain sous eux.
export function settle(group, from, ground, warn) {
  const world = new THREE.Vector3()
  for (let i = from; i < group.children.length; i++) {
    const child = group.children[i]
    if (child.userData.terrain || child.userData.settled) continue
    child.getWorldPosition(world)
    const h = ground.heightAt(world.x, world.z, Infinity, true)
    if (h === null) {
      warn?.(child, world)
      continue
    }
    if (!h) continue
    // Enveloppe à la bonne hauteur : les animations qui fixent position.y restent relatives.
    const holder = new THREE.Group()
    holder.position.y = h
    holder.userData.settled = true
    group.children[i] = holder
    holder.parent = group
    child.parent = holder
    holder.children.push(child)
  }
}
