import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { jitter, mat, mesh } from './helpers.js'

// Relief des îles : chaque île est faite de « lobes » (disques à une hauteur donnée)
// qui se chevauchent, et de rampes ou escaliers qui relient les niveaux.
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
      if (s.type === 'circle') {
        const dx = x - s.x
        const dz = z - s.z
        if (dx * dx + dz * dz <= s.r * s.r) best = s.h
      } else {
        const t = alongSegment(s, x, z)
        if (t === null) continue
        // Rampe : hauteur interpolée ; pont : hauteur fixe.
        if (s.type === 'bridge') best = s.h
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
      if (s.type !== 'circle' || s.solid === false || s.h <= position.y + 0.35) continue
      const dx = position.x - s.x
      const dz = position.z - s.z
      const min = s.r + radius
      const d2 = dx * dx + dz * dz
      if (d2 < min * min) {
        const d = Math.sqrt(d2) || 0.0001
        position.x = s.x + (dx / d) * min
        position.z = s.z + (dz / d) * min
      }
    }
  }

  return { surfaces, ramps, heightAt, onRamp, pushOut }
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

// Rayon englobant d'une forme, pour savoir sur quelle île on se trouve.
export function shapeRadius(shape) {
  return Math.max(...shape.lobes.map(([x, z, r]) => Math.hypot(x, z) + r))
}

// Point de bord d'une île le long d'une direction (pour poser les passerelles).
export function edgeAlong(shape, dir) {
  const inside = (x, z) => shape.lobes.some(([lx, lz, r, h]) => h === 0 && (x - lx) ** 2 + (z - lz) ** 2 <= r * r)
  let last = 0
  for (let t = 0; t < 80; t += 0.25) {
    if (inside(dir.x * t, dir.z * t)) last = t
    else if (last > 0) break
  }
  return last
}

const rng = (seed) => {
  let s = Math.abs(Math.round(seed * 7919)) % 2147483647 || 1
  return () => (s = (s * 16807) % 2147483647) / 2147483647
}

// Construit le relief d'une île et enregistre ses surfaces dans le sol.
export function buildTerrain(ctx, shape, ground, { lunar = false, stairs = 'stone' } = {}) {
  const { group, theme, center } = ctx
  const lobes = shape.lobes
  const isOver = (x, z, h) => lobes.some(([lx, lz, r, lh]) => lh < h && (x - lx) ** 2 + (z - lz) ** 2 <= (r - 1) ** 2)

  lobes.forEach(([x, z, r, h], i) => {
    const seed = center.x * 0.13 + center.z * 0.07 + i * 11 + r
    const rnd = rng(seed)
    ground.surfaces.push({ type: 'circle', x: center.x + x, z: center.z + z, r, h })
    const floating = h === 0 || !isOver(x, z, h)

    // Dessus herbeux avec variations de couleur, bord plus sombre.
    const cap = new THREE.CylinderGeometry(r, r - 0.4, 1, Math.max(10, Math.round(r * 1.8)), 3)
    const colors = []
    const base = new THREE.Color(theme.top)
    const c = new THREE.Color()
    const pos = cap.attributes.position
    const offsets = new Map()
    for (let k = 0; k < pos.count; k++) {
      // Léger relief, surtout horizontal pour que les lobes se raccordent sans marches.
      const key = `${pos.getX(k).toFixed(2)},${pos.getY(k).toFixed(2)},${pos.getZ(k).toFixed(2)}`
      // Dessus parfaitement plat : deux lobes qui se chevauchent ne laissent pas de taches.
      if (!offsets.has(key)) offsets.set(key, [(rnd() - 0.5) * 0.3, pos.getY(k) > 0.4 ? 0 : (rnd() - 0.5) * 0.06, (rnd() - 0.5) * 0.3])
      const [ox, oy, oz] = offsets.get(key)
      const vx = pos.getX(k) + ox
      const vz = pos.getZ(k) + oz
      pos.setXYZ(k, vx, pos.getY(k) + oy, vz)
      // Pas de bord sombre là où un autre lobe au même niveau prolonge le sol.
      const wx = vx + x
      const wz = vz + z
      const covered = lobes.some(([lx, lz, lr, lh], j) => j !== i && lh === h && (wx - lx) ** 2 + (wz - lz) ** 2 < (lr - 0.6) ** 2)
      const n = Math.sin(wx * 0.33 + seed) * Math.cos(wz * 0.29) + Math.sin(wx * 0.11 - wz * 0.13) * 0.8
      const edge = covered ? 0 : (Math.hypot(vx, vz) / r) ** 4 * 0.06
      const side = !covered && pos.getY(k) < 0.2 ? -0.1 : 0
      c.copy(base).offsetHSL(0, 0, n * 0.045 - edge + side + h * 0.012)
      colors.push(c.r, c.g, c.b)
    }
    cap.computeVertexNormals()
    cap.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
    // Ombrage lisse sur le dessus : dégradés doux plutôt que facettes.
    const capMesh = mesh(cap, mat(0xffffff, { vertexColors: true, flatShading: false }), { x, y: h - 0.5, z })
    capMesh.castShadow = h > 0
    capMesh.userData.terrain = true
    group.add(capMesh)

    if (h > 0) {
      // Falaise de la terrasse : strates de roche jusqu'au niveau inférieur.
      const bottom = floating ? -1 : Math.max(...lobes.filter(([lx, lz, lr, lh]) => lh < h && (x - lx) ** 2 + (z - lz) ** 2 <= (lr + r) ** 2).map((l) => l[3]), 0) - 0.6
      const height = h - 0.4 - bottom
      const layers = Math.max(1, Math.round(height / 1.1))
      for (let k = 0; k < layers; k++) {
        const lh = height / layers
        const shade = new THREE.Color(theme.rock).offsetHSL(0, 0, (k % 2 ? 0.05 : -0.02) + rnd() * 0.03)
        const rr = r - 0.15 - (k % 2) * 0.2
        const layer = jitter(new THREE.CylinderGeometry(rr, rr + 0.15, lh, Math.max(9, Math.round(r * 1.6)), 1), 0.18, seed + k)
        const m = mesh(layer, mat(shade), { x, y: bottom + lh * (k + 0.5), z })
        m.userData.terrain = true
        group.add(m)
      }
    }

    if (floating) {
      // Dessous rocheux : terre, roche, strate claire et stalactites.
      const y0 = h - 1
      const depth = r * 0.9
      const dirt = mesh(jitter(new THREE.CylinderGeometry(r - 0.4, r - 1.6, 2.2, Math.round(r * 1.1), 1), 0.35, seed + 3), mat(theme.dirt), { x, y: y0 - 1.1, z })
      const rock = jitter(new THREE.ConeGeometry(Math.max(1, r - 1.5), depth, 12, 3), r * 0.07, seed + 13)
      rock.rotateX(Math.PI)
      const rockMesh = mesh(rock, mat(theme.rock), { x, y: y0 - 2.2 - depth / 2, z })
      const strata = mesh(jitter(new THREE.CylinderGeometry(r - 1.4, r - 2.8, 1.5, Math.round(r * 0.9), 1), 0.4, seed + 5), mat(new THREE.Color(theme.rock).offsetHSL(0, 0, 0.08)), { x, y: y0 - 2.9, z })
      for (const m of [dirt, rockMesh, strata]) m.userData.terrain = true
      group.add(dirt, rockMesh, strata)
      const spikes = Math.round(r * 0.6)
      for (let k = 0; k < spikes; k++) {
        const a = rnd() * Math.PI * 2
        const d = (0.3 + rnd() * 0.5) * Math.max(1, r - 2)
        const len = 2 + rnd() * r * 0.4
        const spike = jitter(new THREE.ConeGeometry(0.5 + rnd() * 1.3, len, 5), 0.15, k + seed)
        spike.rotateX(Math.PI)
        const m = mesh(spike, mat(k % 3 ? theme.rock : theme.dirt), { x: x + Math.cos(a) * d, y: y0 - 3.2 - (d / r) * depth * 0.25 - len / 2, z: z + Math.sin(a) * d, shadow: false })
        m.userData.terrain = true
        group.add(m)
      }
    }

    // Lianes qui pendent des bords (pas sur la lune).
    if (!lunar) {
      const vines = Math.round(r * 1.1)
      const vineMat = mat(new THREE.Color(theme.top).offsetHSL(0, 0, -0.14))
      for (let k = 0; k < vines; k++) {
        const a = (k / vines) * Math.PI * 2 + rnd() * 0.3
        const vx = x + Math.cos(a) * (r - 0.2)
        const vz = z + Math.sin(a) * (r - 0.2)
        if (lobes.some(([lx, lz, lr, lh], j) => j !== i && lh >= h && (vx - lx) ** 2 + (vz - lz) ** 2 < (lr - 0.3) ** 2)) continue
        const len = 0.8 + rnd() * (h > 0 ? Math.min(h, 2.5) : 2.5)
        const vine = new THREE.ConeGeometry(0.1 + rnd() * 0.1, len, 4)
        vine.rotateX(Math.PI)
        const m = mesh(vine, vineMat, { x: vx, y: h - 0.6 - len / 2, z: vz, shadow: false })
        m.userData.terrain = true
        group.add(m)
      }
    }

    // Touffes d'herbe (ou cailloux sur la lune) en instances.
    const tuftGeo = lunar ? new THREE.DodecahedronGeometry(0.16, 0) : new THREE.ConeGeometry(0.11, 0.55, 3)
    const count = Math.round((lunar ? 0.25 : 1.1) * r * r)
    const tufts = new THREE.InstancedMesh(tuftGeo, mat(0xffffff), count)
    const m4 = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const s = new THREE.Vector3()
    const p = new THREE.Vector3()
    const tc = new THREE.Color()
    for (let k = 0; k < count; k++) {
      const a = rnd() * Math.PI * 2
      const d = Math.sqrt(rnd()) * (r - 0.8)
      q.setFromEuler(new THREE.Euler((rnd() - 0.5) * 0.4, rnd() * 3, (rnd() - 0.5) * 0.4))
      s.setScalar(0.7 + rnd() * 0.8)
      p.set(x + Math.cos(a) * d, h + (lunar ? 0.03 : 0.15), z + Math.sin(a) * d)
      m4.compose(p, q, s)
      tufts.setMatrixAt(k, m4)
      tufts.setColorAt(k, tc.set(theme.top).offsetHSL(lunar ? 0 : (rnd() - 0.5) * 0.04, lunar ? -0.05 : 0.08, lunar ? (rnd() - 0.55) * 0.18 : 0.04 + (rnd() - 0.5) * 0.14))
    }
    tufts.receiveShadow = true
    tufts.userData.terrain = true
    group.add(tufts)
  })

  mergeStatic(group)

  // Rampes et escaliers entre les niveaux.
  for (const [ax, az, ha, bx, bz, hb, w = 3] of shape.ramps ?? []) {
    ground.ramps.push({ ax: center.x + ax, az: center.z + az, ha, bx: center.x + bx, bz: center.z + bz, hb, w })
    buildStairs(group, theme, [ax, az, ha], [bx, bz, hb], w, stairs)
  }

  // Petits rochers flottants autour de l'île.
  const rnd = rng(center.x + center.z)
  const radius = shapeRadius(shape)
  for (let i = 0; i < Math.round(radius / 3.5); i++) {
    const a = rnd() * Math.PI * 2
    const g = jitter(new THREE.IcosahedronGeometry(0.5 + rnd() * 1.1, 0), 0.3, i + 3)
    const m = mesh(g, mat(theme.rock), { x: Math.cos(a) * (radius + 4 + rnd() * 6), y: -3 - rnd() * 9, z: Math.sin(a) * (radius + 4 + rnd() * 6) })
    m.userData.terrain = true
    group.add(m)
  }
}

// Fusionne les morceaux de terrain de même matériau : beaucoup moins d'appels de rendu.
function mergeStatic(group) {
  const buckets = new Map()
  for (const child of [...group.children]) {
    if (!child.isMesh || child.isInstancedMesh || !child.userData.terrain) continue
    const m = child.material
    const key = `${m.color.getHexString()}|${m.vertexColors}|${m.emissive?.getHexString()}|${child.castShadow}`
    if (!buckets.has(key)) buckets.set(key, [])
    buckets.get(key).push(child)
  }
  for (const meshes of buckets.values()) {
    if (meshes.length < 2) continue
    const geometries = meshes.map((m) => {
      m.updateMatrix()
      const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone()
      g.deleteAttribute('uv')
      return g.applyMatrix4(m.matrix)
    })
    const merged = new THREE.Mesh(mergeGeometries(geometries), meshes[0].material)
    merged.castShadow = meshes[0].castShadow
    merged.receiveShadow = true
    merged.userData.terrain = true
    for (const m of meshes) group.remove(m)
    group.add(merged)
  }
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
    stone: [0xb3aa98, 0xa0977f],
    metal: [0x9aa1ad, 0x8a909c],
    energy: [0x8f7bff, 0x7a66e6],
  }[style]
  for (let k = 0; k < steps; k++) {
    const top = ha + (rise * (k + 1)) / steps
    const bottom = Math.min(ha, hb) - 0.6
    const extra = style === 'energy' ? { emissive: 0x5a3fd6, emissiveIntensity: 0.6 } : {}
    stairs.add(mesh(new THREE.BoxGeometry(w, top - bottom, depth + 0.02), mat(colors[k % 2], extra), { y: (top + bottom) / 2, z: depth * (k + 0.5) }))
  }
  // Rampes sur les côtés.
  const railColor = style === 'stone' ? 0x8a8273 : style === 'metal' ? 0xdddddd : 0xd9ccff
  for (const side of [-1, 1]) {
    const rail = mesh(new THREE.BoxGeometry(0.25, 0.5, Math.hypot(length, rise)), mat(railColor, style === 'energy' ? { emissive: 0xb48cff, emissiveIntensity: 1.5 } : {}), { x: side * (w / 2 + 0.05), y: (ha + hb) / 2 + 0.3, z: length / 2 })
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
