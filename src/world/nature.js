import * as THREE from 'three'
import { insidePoly, rng } from './terrain.js'

// Végétation et effets vivants, inspirés de bruno-simon.com et mike-fernandez.dev :
// herbe en brins pointus qui ondule, arbres et buissons en nuées de petites feuilles,
// feuilles tombées au sol, lucioles et eau turquoise bordée d'écume.

const time = { value: 0 }
export function updateNature(t) {
  time.value = t
}

// Niveau de détail : sur un appareil qui peine, on dessine moins de brins d'herbe
// (l'ordre est mélangé, donc il en reste partout) et les feuillages ne projettent plus d'ombre.
const grassMeshes = []
const leafMeshes = []
export function setNatureDetail(level) {
  const share = [1, 0.65, 0.4, 0.25][level] ?? 1
  for (const m of grassMeshes) m.count = Math.max(1, Math.round(m.userData.fullCount * share))
  for (const m of leafMeshes) m.castShadow = level < 2
}

// Ondulation au vent, appliquée dans le shader : rien à recalculer côté JavaScript.
function windy(material, amount) {
  material.customProgramCacheKey = () => `windy${amount}`
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = time
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vec4 wp = modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        float sway = sin(uTime * 1.6 + wp.x * 0.35 + wp.z * 0.22) + 0.45 * sin(uTime * 2.7 + wp.x * 0.9 - wp.z * 0.5);
        float bend = ${amount.toFixed(3)} * max(position.y, 0.0);
        vec3 wind = vec3(sway * bend, 0.0, sway * bend * 0.5);
        transformed += (inverse(mat3(modelMatrix * instanceMatrix)) * wind);`,
      )
  }
  return material
}

// Brin d'herbe : un triangle pointu, sombre à la base et clair à la pointe.
// Les normales pointent vers le haut : le brin s'éclaire comme le sol.
function bladeGeometry() {
  const g = new THREE.BufferGeometry()
  // Deux faces (une par sens) plutôt que DoubleSide : le dos garderait une normale inversée et serait noir.
  g.setAttribute('position', new THREE.Float32BufferAttribute([-0.07, 0, 0, 0.07, 0, 0, 0.01, 1, 0.02, 0.07, 0, 0, -0.07, 0, 0, 0.01, 1, 0.02], 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(Array(6).fill([0, 1, 0]).flat(), 3))
  const base = 0.5
  g.setAttribute('color', new THREE.Float32BufferAttribute([base, base, base, base, base, base, 1.2, 1.2, 1.2, base, base, base, base, base, base, 1.2, 1.2, 1.2], 3))
  return g
}

const GRASS = {
  past: { hue: 0.3, sat: 0.6, light: 0.3, density: 1.0, patch: 0.35, height: 0.55 },
  present: { hue: 0.19, sat: 0.7, light: 0.4, density: 3.2, patch: 0.3, height: 0.6 },
}

// Pousse de l'herbe sur une île, après la pose des décors (pour les éviter).
export function growGrass(ctx, ground, colliders, era) {
  const style = GRASS[era]
  if (!style) return growPebbles(ctx, ground)
  const { center, polys } = ctx
  const lobes = ctx.shape.lobes
  const rnd = rng(center.x * 0.7 + center.z * 0.3 + 5)
  const points = []
  const noise = (x, z) => Math.sin(x * 0.31 + 1.3) * Math.cos(z * 0.27 - 0.4) + Math.sin(x * 0.12 - z * 0.17 + 2) * 0.6 + Math.sin(x * 0.8 + z * 0.7) * 0.25
  const blocked = (x, z) => {
    for (const n of ctx.noGrass) {
      if (n.type === 'rect' ? Math.abs(x - n.x) < n.w / 2 && Math.abs(z - n.z) < n.l / 2 : n.type === 'circle' ? (x - n.x) ** 2 + (z - n.z) ** 2 < n.r * n.r : distSeg(n, x, z) < n.w / 2) return true
    }
    const wx = center.x + x
    const wz = center.z + z
    for (const c of colliders) if ((wx - c.x) ** 2 + (wz - c.z) ** 2 < (c.r + 0.15) ** 2) return true
    return false
  }
  const tryAdd = (x, z, lobeH, edge) => {
    const h = ground.heightAt(center.x + x, center.z + z, Infinity, true)
    if (h === null || Math.abs(h - lobeH) > 0.01 || ground.onRamp(center.x + x, center.z + z) || blocked(x, z)) return
    points.push([x, h, z, edge])
  }

  polys.forEach((pts, i) => {
    const [lx, lz, r, h] = lobes[i]
    // Touffes en nappes : la densité suit un bruit, comme les prés de Bruno.
    const n = Math.round(r * r * 3.1 * style.density)
    for (let k = 0; k < n; k++) {
      const x = lx + (rnd() * 2 - 1) * r * 1.15
      const z = lz + (rnd() * 2 - 1) * r * 1.15
      if (!insidePoly(pts, x, z)) continue
      const v = noise(x + center.x, z + center.z)
      if (v < style.patch + rnd() * 0.5) continue
      for (let c = 0; c < 4; c++) tryAdd(x + (rnd() - 0.5) * 0.5, z + (rnd() - 0.5) * 0.5, h, 0)
    }
    // Frange dense le long des bords, qui déborde un peu au-dessus du vide.
    for (let e = 0; e < pts.length; e++) {
      const [ax, az] = pts[e]
      const [bx, bz] = pts[(e + 1) % pts.length]
      const len = Math.hypot(bx - ax, bz - az)
      const nx = (bz - az) / len
      const nz = -(bx - ax) / len
      const inward = insidePoly(pts, (ax + bx) / 2 + nx * 0.5, (az + bz) / 2 + nz * 0.5) ? 1 : -1
      for (let d = 0; d < len; d += 0.12) {
        const depth = 0.1 + rnd() * rnd() * 1.6
        tryAdd(ax + ((bx - ax) * d) / len + nx * inward * depth, az + ((bz - az) * d) / len + nz * inward * depth, h, 1)
      }
    }
  })

  for (let i = points.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[points[i], points[j]] = [points[j], points[i]]
  }
  const blades = new THREE.InstancedMesh(bladeGeometry(), windy(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }), 0.14), points.length)
  const m4 = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const e = new THREE.Euler()
  const s = new THREE.Vector3()
  const p = new THREE.Vector3()
  const c = new THREE.Color()
  points.forEach(([x, y, z, edge], k) => {
    e.set((rnd() - 0.5) * 0.5, rnd() * Math.PI * 2, (rnd() - 0.5) * 0.5)
    q.setFromEuler(e)
    const hh = style.height * (0.6 + rnd() * 0.8) * (edge ? 0.8 : 1)
    s.set(0.8 + rnd() * 0.8, hh, 1)
    p.set(x, y - 0.02, z)
    blades.setMatrixAt(k, m4.compose(p, q, s))
    blades.setColorAt(k, c.setHSL(style.hue + (rnd() - 0.5) * 0.05, style.sat, style.light + (rnd() - 0.5) * 0.12))
  })
  blades.receiveShadow = true
  blades.userData.terrain = true
  blades.userData.fullCount = points.length
  grassMeshes.push(blades)
  ctx.group.add(blades)
}

// Sur la lune : petits cailloux à facettes.
function growPebbles(ctx, ground) {
  const { center, polys } = ctx
  const lobes = ctx.shape.lobes
  const rnd = rng(center.x + 3)
  const points = []
  polys.forEach((pts, i) => {
    const [lx, lz, r, h] = lobes[i]
    for (let k = 0; k < r * r * 0.35; k++) {
      const x = lx + (rnd() * 2 - 1) * r
      const z = lz + (rnd() * 2 - 1) * r
      if (!insidePoly(pts, x, z)) continue
      const gh = ground.heightAt(center.x + x, center.z + z, Infinity, true)
      if (gh === h) points.push([x, h, z])
    }
  })
  const pebbles = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(0.16, 0), new THREE.MeshStandardMaterial({ flatShading: true, roughness: 1 }), points.length)
  const m4 = new THREE.Matrix4()
  const c = new THREE.Color()
  points.forEach(([x, y, z], k) => {
    const sc = 0.5 + rnd() * 1.3
    m4.compose(new THREE.Vector3(x, y + 0.02, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rnd() * 3, rnd() * 3, 0)), new THREE.Vector3(sc, sc * 0.6, sc))
    pebbles.setMatrixAt(k, m4)
    pebbles.setColorAt(k, c.setHSL(0.65, 0.08, 0.45 + rnd() * 0.25))
  })
  pebbles.receiveShadow = true
  pebbles.userData.terrain = true
  ctx.group.add(pebbles)
}

function distSeg({ ax, az, bx, bz }, x, z) {
  const abx = bx - ax
  const abz = bz - az
  const t = Math.max(0, Math.min(1, ((x - ax) * abx + (z - az) * abz) / (abx * abx + abz * abz)))
  return Math.hypot(x - (ax + abx * t), z - (az + abz * t))
}

// ---------- Feuillages en particules ----------

export const PALETTES = {
  pink: [0xff7fa8, 0xf0588f, 0xffa3c4, 0xd94a86],
  purple: [0xa77bff, 0x8a5cf0, 0xc6a3ff, 0x6f4ad9],
  orange: [0xffa142, 0xff7b2e, 0xffc65c, 0xe85c2a],
  yellow: [0xd8e04a, 0xb9cf3a, 0xeef070, 0x93b02f],
  green: [0x5fae46, 0x4a9a3c, 0x7cc65a, 0x3d8436],
  teal: [0x3fe0d0, 0x2bb8c9, 0x8af5e6, 0x1f8fb0],
}

// Rassemble toutes les nuées de feuilles d'une île en un seul objet instancié.
// Les arbres et buissons déclarent userData.leafClouds = [{ x, y, z, r, palette }].
export function buildLeaves(ctx, ground) {
  const { group, center } = ctx
  group.updateMatrixWorld(true)
  const clouds = []
  group.traverse((o) => {
    for (const cl of o.userData.leafClouds ?? []) {
      const p = new THREE.Vector3(cl.x, cl.y, cl.z).applyMatrix4(o.matrixWorld)
      const s = o.matrixWorld.getMaxScaleOnAxis()
      clouds.push({ ...cl, p: p.sub(group.position), r: cl.r * s })
    }
  })
  if (!clouds.length) return
  const rnd = rng(center.x + center.z * 2 + 11)
  const leaves = []
  const fallen = []
  for (const cl of clouds) {
    const palette = PALETTES[cl.palette] ?? PALETTES.green
    const n = Math.round(cl.r * cl.r * 380)
    for (let k = 0; k < n; k++) {
      // Plus de feuilles vers la surface de la boule : silhouette nette mais aérée.
      const u = rnd() * 2 - 1
      const a = rnd() * Math.PI * 2
      const d = cl.r * Math.pow(rnd(), 0.35)
      const sx = Math.sqrt(1 - u * u) * Math.cos(a)
      const sz = Math.sqrt(1 - u * u) * Math.sin(a)
      const top = (u + 1) / 2
      leaves.push({ x: cl.p.x + sx * d, y: cl.p.y + u * d * 0.85, z: cl.p.z + sz * d, color: palette[Math.floor(rnd() * palette.length)], light: (top - 0.5) * 0.16 + (d / cl.r - 0.7) * 0.1 })
    }
    // Feuilles tombées autour.
    if (cl.fall !== false) {
      for (let k = 0; k < cl.r * 14; k++) {
        const a = rnd() * Math.PI * 2
        const d = cl.r * (0.3 + rnd() * 1.6)
        const x = cl.p.x + Math.cos(a) * d
        const z = cl.p.z + Math.sin(a) * d
        const h = ground.heightAt(center.x + x, center.z + z, Infinity, true)
        if (h !== null) fallen.push({ x, y: h + 0.03, z, color: palette[Math.floor(rnd() * palette.length)] })
      }
    }
  }
  const leafGeo = new THREE.PlaneGeometry(0.12, 0.12)
  const inst = new THREE.InstancedMesh(leafGeo, windy(new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.8 }), 0.0), leaves.length)
  const m4 = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const e = new THREE.Euler()
  const one = new THREE.Vector3(1, 1, 1)
  const p = new THREE.Vector3()
  const c = new THREE.Color()
  leaves.forEach((l, k) => {
    e.set(rnd() * Math.PI, rnd() * Math.PI, rnd() * Math.PI)
    inst.setMatrixAt(k, m4.compose(p.set(l.x, l.y, l.z), q.setFromEuler(e), one.setScalar(0.8 + rnd() * 0.6)))
    inst.setColorAt(k, c.set(l.color).offsetHSL(0, 0, l.light))
  })
  inst.castShadow = true
  inst.receiveShadow = true
  inst.userData.terrain = true
  leafMeshes.push(inst)
  group.add(inst)

  if (fallen.length) addConfetti(group, fallen, rnd)
}

// Petites feuilles posées à plat sur le sol.
export function addConfetti(group, items, rnd) {
  const inst = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.16, 0.16).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ roughness: 1 }), items.length)
  const m4 = new THREE.Matrix4()
  const c = new THREE.Color()
  items.forEach((l, k) => {
    m4.makeRotationY(rnd() * Math.PI)
    m4.setPosition(l.x, l.y, l.z)
    inst.setMatrixAt(k, m4)
    inst.setColorAt(k, c.set(l.color).offsetHSL(0, 0, -0.06))
  })
  inst.receiveShadow = true
  inst.userData.terrain = true
  group.add(inst)
}

// Confettis répandus sur tout le sol d'une île (Présent : feuilles rouges sur le dallage).
export function scatterConfetti(ctx, ground, { count = 300, colors = [0xb8401f, 0x8f2f18, 0xd8562a] } = {}) {
  const { center, polys } = ctx
  const lobes = ctx.shape.lobes
  const rnd = rng(center.x * 3 + center.z + 1)
  const items = []
  for (let k = 0; k < count; k++) {
    const i = Math.floor(rnd() * lobes.length)
    const [lx, lz, r] = lobes[i]
    const x = lx + (rnd() * 2 - 1) * r
    const z = lz + (rnd() * 2 - 1) * r
    if (!insidePoly(polys[i], x, z)) continue
    const h = ground.heightAt(center.x + x, center.z + z, Infinity, true)
    if (h !== null) items.push({ x, y: h + 0.025, z, color: colors[Math.floor(rnd() * colors.length)] })
  }
  addConfetti(ctx.group, items, rnd)
}

// ---------- Lucioles ----------

export function fireflies(ctx, { count = 60, color = 0xfff08a, radius, height = 3 } = {}) {
  const rnd = rng(ctx.center.x + 77)
  const positions = []
  const seeds = []
  const r = radius ?? ctx.radius
  for (let i = 0; i < count; i++) {
    const a = rnd() * Math.PI * 2
    const d = Math.sqrt(rnd()) * r
    positions.push(Math.cos(a) * d, 0.6 + rnd() * height, Math.sin(a) * d)
    seeds.push(rnd() * 100)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  g.setAttribute('seed', new THREE.Float32BufferAttribute(seeds, 1))
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: time, uColor: { value: new THREE.Color(color) }, uScale: { value: window.innerHeight * 0.5 } },
    vertexShader: `
      attribute float seed;
      uniform float uTime;
      uniform float uScale;
      varying float vBlink;
      void main() {
        vec3 p = position;
        p.x += sin(uTime * 0.4 + seed) * 0.9;
        p.y += sin(uTime * 0.7 + seed * 2.0) * 0.5;
        p.z += cos(uTime * 0.35 + seed * 1.3) * 0.9;
        vBlink = 0.45 + 0.55 * sin(uTime * 2.3 + seed * 5.0);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = uScale * 0.45 / -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform vec3 uColor;
      varying float vBlink;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d);
        gl_FragColor = vec4(uColor * (1.5 + a), a * a * vBlink);
      }`,
  })
  const points = new THREE.Points(g, material)
  points.frustumCulled = false
  points.userData.terrain = true
  ctx.group.add(points)
}

// ---------- Eau ----------

// Étang aux bords irréguliers : turquoise sur les bords, profond au centre, écume animée.
export function water(ctx, x, z, { r = 3, y = 0.07, deep = 0x0f5f78, shallow = 0x3fd6c8, bank = null } = {}) {
  const rnd = rng(x * 5 + z * 3 + ctx.center.x)
  const seg = 56
  const fr = [0, 0.4, 0.65, 0.8, 0.9, 0.96, 1]
  const s1 = rnd() * 6
  const s2 = rnd() * 6
  const rim = []
  for (let i = 0; i < seg; i++) {
    const a = (i / seg) * Math.PI * 2
    rim.push(r * (1 + 0.13 * Math.sin(3 * a + s1) + 0.07 * Math.sin(5 * a + s2)))
  }
  const positions = []
  const shore = []
  const ang = []
  const vert = (ri, i) => {
    const a = (i / seg) * Math.PI * 2
    const d = fr[ri] * rim[i % seg]
    positions.push(Math.cos(a) * d, 0, Math.sin(a) * d)
    shore.push(fr[ri])
    ang.push(a)
  }
  for (let ri = 0; ri < fr.length - 1; ri++) {
    for (let i = 0; i < seg; i++) {
      vert(ri, i), vert(ri + 1, i + 1), vert(ri + 1, i)
      vert(ri, i), vert(ri, i + 1), vert(ri + 1, i + 1)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  g.setAttribute('shore', new THREE.Float32BufferAttribute(shore, 1))
  g.setAttribute('ang', new THREE.Float32BufferAttribute(ang, 1))
  g.computeVertexNormals()
  const material = new THREE.MeshStandardMaterial({ roughness: 0.2, metalness: 0.1, side: THREE.DoubleSide })
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = time
    shader.uniforms.uDeep = { value: new THREE.Color(deep) }
    shader.uniforms.uShallow = { value: new THREE.Color(shallow) }
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float shore;\nattribute float ang;\nvarying float vShore;\nvarying float vAng;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvShore = shore;\nvAng = ang;')
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;\nuniform vec3 uDeep;\nuniform vec3 uShallow;\nvarying float vShore;\nvarying float vAng;')
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        vec3 water = mix(uDeep, uShallow, smoothstep(0.35, 0.97, vShore));
        // Lignes d'écume qui avancent vers le bord, coupées en tirets.
        float wave = abs(fract(vShore * 4.5 - uTime * 0.22) - 0.5);
        float dash = smoothstep(0.1, 0.5, sin(vAng * 9.0 + uTime * 0.3 + vShore * 7.0));
        float foam = (1.0 - smoothstep(0.02, 0.05, wave)) * dash * smoothstep(0.55, 0.85, vShore);
        foam = max(foam, smoothstep(0.93, 0.985, vShore) * (0.75 + 0.25 * sin(vAng * 23.0 + uTime * 2.0)));
        diffuseColor.rgb = mix(water, vec3(1.0), foam);
        float glowFoam = foam;`,
      )
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += uShallow * 0.12 * vShore + vec3(glowFoam * 0.35);')
  }
  const surface = new THREE.Mesh(g, material)
  surface.position.set(x, y, z)
  surface.receiveShadow = true
  ctx.group.add(surface)
  if (bank !== null) {
    // Berge : un liseré de terre un peu plus large que l'eau.
    const pts = rim.map((d, i) => new THREE.Vector2(Math.cos((i / seg) * Math.PI * 2) * (d + 0.5), Math.sin((i / seg) * Math.PI * 2) * (d + 0.5)))
    const bankGeo = new THREE.ShapeGeometry(new THREE.Shape(pts))
    bankGeo.rotateX(Math.PI / 2)
    const b = new THREE.Mesh(bankGeo, new THREE.MeshStandardMaterial({ color: bank, roughness: 1, side: THREE.DoubleSide }))
    b.position.set(x, y - 0.03, z)
    b.receiveShadow = true
    ctx.group.add(b)
  }
  ctx.noGrass?.push({ type: 'circle', x, z, r: r * 1.12 })
  return surface
}
