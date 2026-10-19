import * as THREE from 'three'

// Faune des îles : lapins, moutons, canards, corbeaux et chauves-souris au Passé ;
// pigeons, chats, chien et vols d'oiseaux au Présent ; méduses spatiales, orbes,
// robots-chiens et papillons de nuit lumineux au Futur. Papillons dans les prés fleuris.
//
// Performances : chaque animal est un petit assemblage de « briques » (cubes et boules
// low-poly). Toutes les briques de tous les animaux sont des instances de 4 maillages
// instanciés (cube, boule, cube lumineux, boule lumineuse) : 4 appels de dessin au total,
// sans ombres portées. Les animaux loin du point regardé restent figés.

const ACTIVE_RANGE = 60
const HIDE_RANGE = 150
const TAU = Math.PI * 2

// Brique : [maillage, couleur, taille, position, options]
// options : pv = pivot de l'animation, a = animation, r = rotation de repos.
// Animations : legA / legB (balancier des pattes), head (tête qui pique du nez),
// tail (queue qui frétille), wing (battement d'aile, côté selon x), pulse (méduse), sway (tentacule).
const B = (m, c, s, p, o = {}) => ({ m, c, s, p, ...o })

function rabbit(c) {
  const head = [0, 0.3, 0.1]
  const parts = [
    B('box', c, [0.26, 0.24, 0.36], [0, 0.2, -0.02]),
    B('box', c, [0.22, 0.2, 0.2], [0, 0.34, 0.17], { pv: head, a: 'head' }),
    B('ico', 0xffffff, [0.13, 0.13, 0.13], [0, 0.26, -0.22]),
    B('box', 0x1b1530, [0.035, 0.05, 0.02], [-0.065, 0.37, 0.27], { pv: head, a: 'head' }),
    B('box', 0x1b1530, [0.035, 0.05, 0.02], [0.065, 0.37, 0.27], { pv: head, a: 'head' }),
    B('box', 0xff9ab5, [0.045, 0.035, 0.02], [0, 0.32, 0.275], { pv: head, a: 'head' }),
  ]
  for (const x of [-1, 1]) {
    parts.push(B('box', c, [0.065, 0.24, 0.045], [x * 0.065, 0.54, 0.14], { pv: head, a: 'head', r: [-0.15, 0, x * 0.18] }))
    parts.push(B('box', 0xffb3c8, [0.035, 0.16, 0.05], [x * 0.068, 0.54, 0.15], { pv: head, a: 'head', r: [-0.15, 0, x * 0.18] }))
    parts.push(B('box', c, [0.07, 0.08, 0.09], [x * 0.08, 0.04, 0.12], { pv: [x * 0.08, 0.12, 0.08], a: 'legA' }))
    parts.push(B('box', c, [0.09, 0.08, 0.17], [x * 0.1, 0.04, -0.1], { pv: [x * 0.1, 0.12, -0.08], a: 'legB' }))
  }
  return parts
}

function sheep() {
  const wool = 0xf2eef6
  const dark = 0x2e2838
  const head = [0, 0.6, 0.3]
  const parts = [
    B('ico', wool, [0.56, 0.46, 0.74], [0, 0.52, 0]),
    B('ico', wool, [0.36, 0.3, 0.42], [0, 0.73, 0.06]),
    B('ico', wool, [0.3, 0.26, 0.3], [0, 0.66, -0.28]),
    B('box', dark, [0.2, 0.22, 0.26], [0, 0.62, 0.42], { pv: head, a: 'head' }),
    B('ico', wool, [0.2, 0.12, 0.16], [0, 0.75, 0.38], { pv: head, a: 'head' }),
    B('box', 0xffffff, [0.04, 0.04, 0.02], [-0.06, 0.66, 0.555], { pv: head, a: 'head' }),
    B('box', 0xffffff, [0.04, 0.04, 0.02], [0.06, 0.66, 0.555], { pv: head, a: 'head' }),
  ]
  for (const x of [-1, 1]) {
    parts.push(B('box', dark, [0.15, 0.05, 0.08], [x * 0.15, 0.67, 0.38], { pv: head, a: 'head', r: [0, 0, x * -0.3] }))
    parts.push(B('box', dark, [0.08, 0.32, 0.08], [x * 0.14, 0.16, 0.2], { pv: [x * 0.14, 0.32, 0.2], a: x < 0 ? 'legA' : 'legB' }))
    parts.push(B('box', dark, [0.08, 0.32, 0.08], [x * 0.14, 0.16, -0.2], { pv: [x * 0.14, 0.32, -0.2], a: x < 0 ? 'legB' : 'legA' }))
  }
  return parts
}

function crow() {
  const c = 0x2a2440
  return [
    B('box', c, [0.14, 0.12, 0.32], [0, 0, 0]),
    B('box', c, [0.12, 0.11, 0.12], [0, 0.04, 0.2]),
    B('box', 0xe0a040, [0.04, 0.03, 0.09], [0, 0.03, 0.3]),
    B('box', 0x3a3058, [0.38, 0.025, 0.18], [-0.21, 0.02, 0], { pv: [-0.05, 0.02, 0], a: 'wing' }),
    B('box', 0x3a3058, [0.38, 0.025, 0.18], [0.21, 0.02, 0], { pv: [0.05, 0.02, 0], a: 'wing' }),
    B('box', c, [0.13, 0.02, 0.14], [0, 0.01, -0.21]),
    B('glowBox', 0xffc860, [0.025, 0.025, 0.02], [-0.045, 0.06, 0.26]),
    B('glowBox', 0xffc860, [0.025, 0.025, 0.02], [0.045, 0.06, 0.26]),
  ]
}

function bat() {
  const c = 0x3b2d5c
  return [
    B('ico', c, [0.15, 0.15, 0.22], [0, 0, 0]),
    B('box', c, [0.04, 0.08, 0.03], [-0.045, 0.1, 0.05]),
    B('box', c, [0.04, 0.08, 0.03], [0.045, 0.1, 0.05]),
    B('box', 0x5a3f8a, [0.4, 0.02, 0.22], [-0.22, 0.01, -0.02], { pv: [-0.05, 0.01, 0], a: 'wing' }),
    B('box', 0x5a3f8a, [0.4, 0.02, 0.22], [0.22, 0.01, -0.02], { pv: [0.05, 0.01, 0], a: 'wing' }),
    B('glowBox', 0xff6f9f, [0.03, 0.03, 0.02], [-0.035, 0.03, 0.11]),
    B('glowBox', 0xff6f9f, [0.03, 0.03, 0.02], [0.035, 0.03, 0.11]),
  ]
}

function butterfly(c, glow = false) {
  const wingMesh = glow ? 'glowBox' : 'box'
  return [
    B('box', 0x2a2240, [0.03, 0.03, 0.13], [0, 0, 0]),
    B(wingMesh, c, [0.15, 0.012, 0.14], [-0.08, 0, 0.02], { pv: [-0.01, 0, 0], a: 'wing' }),
    B(wingMesh, c, [0.15, 0.012, 0.14], [0.08, 0, 0.02], { pv: [0.01, 0, 0], a: 'wing' }),
    B(wingMesh, c, [0.1, 0.012, 0.09], [-0.06, 0, -0.08], { pv: [-0.01, 0, 0], a: 'wing' }),
    B(wingMesh, c, [0.1, 0.012, 0.09], [0.06, 0, -0.08], { pv: [0.01, 0, 0], a: 'wing' }),
  ]
}

function duck(c, headColor) {
  const head = [0, 0.18, 0.12]
  return [
    B('ico', c, [0.3, 0.22, 0.42], [0, 0.1, 0]),
    B('ico', headColor, [0.17, 0.17, 0.17], [0, 0.3, 0.17], { pv: head, a: 'head' }),
    B('box', 0xffa640, [0.08, 0.035, 0.11], [0, 0.28, 0.29], { pv: head, a: 'head' }),
    B('box', 0x1b1530, [0.03, 0.03, 0.02], [-0.06, 0.33, 0.23], { pv: head, a: 'head' }),
    B('box', 0x1b1530, [0.03, 0.03, 0.02], [0.06, 0.33, 0.23], { pv: head, a: 'head' }),
    B('box', c, [0.12, 0.06, 0.1], [0, 0.17, -0.22], { r: [-0.5, 0, 0] }),
    B('box', 0xd8d0c0, [0.04, 0.1, 0.22], [-0.14, 0.14, -0.03]),
    B('box', 0xd8d0c0, [0.04, 0.1, 0.22], [0.14, 0.14, -0.03]),
  ]
}

function pigeon() {
  const head = [0, 0.22, 0.08]
  const wing = 0x7a7c9e
  return [
    B('ico', 0x8d8fae, [0.18, 0.17, 0.3], [0, 0.18, 0]),
    B('ico', 0x6d6f96, [0.12, 0.12, 0.12], [0, 0.3, 0.12], { pv: head, a: 'head' }),
    B('box', 0x5fbf9a, [0.11, 0.06, 0.07], [0, 0.24, 0.1], { pv: head, a: 'head' }),
    B('box', 0xd8c8a8, [0.03, 0.03, 0.06], [0, 0.3, 0.2], { pv: head, a: 'head' }),
    B('box', 0xff8a3a, [0.022, 0.022, 0.02], [-0.045, 0.32, 0.165], { pv: head, a: 'head' }),
    B('box', 0xff8a3a, [0.022, 0.022, 0.02], [0.045, 0.32, 0.165], { pv: head, a: 'head' }),
    B('box', wing, [0.03, 0.17, 0.22], [-0.095, 0.17, -0.03], { pv: [-0.085, 0.25, -0.02], a: 'wing' }),
    B('box', wing, [0.03, 0.17, 0.22], [0.095, 0.17, -0.03], { pv: [0.085, 0.25, -0.02], a: 'wing' }),
    B('box', 0x6d6f96, [0.1, 0.03, 0.13], [0, 0.16, -0.2]),
    B('box', 0xd86a6a, [0.025, 0.09, 0.025], [-0.04, 0.045, 0.02], { pv: [-0.04, 0.09, 0.02], a: 'legA' }),
    B('box', 0xd86a6a, [0.025, 0.09, 0.025], [0.04, 0.045, 0.02], { pv: [0.04, 0.09, 0.02], a: 'legB' }),
  ]
}

function cat(c, belly) {
  const head = [0, 0.33, 0.2]
  const parts = [
    B('box', c, [0.2, 0.18, 0.42], [0, 0.25, 0]),
    B('box', belly, [0.16, 0.04, 0.3], [0, 0.16, 0.02]),
    B('box', c, [0.22, 0.18, 0.18], [0, 0.38, 0.25], { pv: head, a: 'head' }),
    B('box', belly, [0.1, 0.06, 0.03], [0, 0.34, 0.34], { pv: head, a: 'head' }),
    B('box', 0xff9ab5, [0.03, 0.02, 0.02], [0, 0.37, 0.35], { pv: head, a: 'head' }),
    B('glowBox', 0xa8ff9a, [0.045, 0.03, 0.02], [-0.05, 0.41, 0.34], { pv: head, a: 'head' }),
    B('glowBox', 0xa8ff9a, [0.045, 0.03, 0.02], [0.05, 0.41, 0.34], { pv: head, a: 'head' }),
    B('box', c, [0.045, 0.045, 0.34], [0, 0.43, -0.32], { pv: [0, 0.3, -0.2], a: 'tail', r: [0.88, 0, 0] }),
  ]
  for (const x of [-1, 1]) {
    parts.push(B('box', c, [0.065, 0.09, 0.05], [x * 0.065, 0.5, 0.24], { pv: head, a: 'head', r: [0, 0, x * -0.25] }))
    parts.push(B('box', c, [0.06, 0.17, 0.06], [x * 0.07, 0.085, 0.15], { pv: [x * 0.07, 0.17, 0.15], a: x < 0 ? 'legA' : 'legB' }))
    parts.push(B('box', c, [0.06, 0.17, 0.06], [x * 0.07, 0.085, -0.15], { pv: [x * 0.07, 0.17, -0.15], a: x < 0 ? 'legB' : 'legA' }))
  }
  return parts
}

function dog() {
  const c = 0xc98a4a
  const cream = 0xf3e6d6
  const ear = 0x7a4a2a
  const head = [0, 0.45, 0.22]
  const parts = [
    B('box', c, [0.26, 0.24, 0.5], [0, 0.34, 0]),
    B('box', cream, [0.2, 0.16, 0.08], [0, 0.3, 0.24]),
    B('box', c, [0.24, 0.22, 0.22], [0, 0.52, 0.3], { pv: head, a: 'head' }),
    B('box', cream, [0.13, 0.1, 0.13], [0, 0.47, 0.46], { pv: head, a: 'head' }),
    B('box', 0x2a1f2a, [0.05, 0.04, 0.03], [0, 0.51, 0.53], { pv: head, a: 'head' }),
    B('box', 0xff7a9a, [0.06, 0.02, 0.06], [0, 0.42, 0.48], { pv: head, a: 'head' }),
    B('box', 0x2a1f2a, [0.035, 0.035, 0.02], [-0.06, 0.56, 0.415], { pv: head, a: 'head' }),
    B('box', 0x2a1f2a, [0.035, 0.035, 0.02], [0.06, 0.56, 0.415], { pv: head, a: 'head' }),
    B('box', 0x4f7ad8, [0.27, 0.05, 0.08], [0, 0.44, 0.2]),
    B('box', c, [0.05, 0.05, 0.24], [0, 0.5, -0.34], { pv: [0, 0.42, -0.25], a: 'tail', r: [0.69, 0, 0] }),
  ]
  for (const x of [-1, 1]) {
    parts.push(B('box', ear, [0.06, 0.15, 0.09], [x * 0.14, 0.53, 0.28], { pv: head, a: 'head', r: [0, 0, x * 0.2] }))
    parts.push(B('box', c, [0.08, 0.24, 0.08], [x * 0.09, 0.12, 0.18], { pv: [x * 0.09, 0.24, 0.18], a: x < 0 ? 'legA' : 'legB' }))
    parts.push(B('box', c, [0.08, 0.24, 0.08], [x * 0.09, 0.12, -0.18], { pv: [x * 0.09, 0.24, -0.18], a: x < 0 ? 'legB' : 'legA' }))
  }
  return parts
}

function bird(c) {
  return [
    B('ico', c, [0.14, 0.12, 0.26], [0, 0, 0]),
    B('ico', c, [0.1, 0.1, 0.1], [0, 0.04, 0.13]),
    B('box', 0xffb347, [0.03, 0.025, 0.06], [0, 0.03, 0.2]),
    B('box', c, [0.32, 0.02, 0.13], [-0.17, 0.02, 0], { pv: [-0.03, 0.02, 0], a: 'wing' }),
    B('box', c, [0.32, 0.02, 0.13], [0.17, 0.02, 0], { pv: [0.03, 0.02, 0], a: 'wing' }),
    B('box', c, [0.09, 0.02, 0.11], [0, 0, -0.16]),
  ]
}

function jelly(c) {
  const parts = [
    B('glowIco', c, [0.7, 0.42, 0.7], [0, 0, 0], { a: 'pulse' }),
    B('glowIco', 0xffffff, [0.24, 0.2, 0.24], [0, -0.04, 0]),
  ]
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU + 0.4
    const x = Math.cos(a) * 0.17
    const z = Math.sin(a) * 0.17
    parts.push(B('glowBox', c, [0.04, 0.5, 0.04], [x, -0.36, z], { pv: [x, -0.1, z], a: 'sway', k: i }))
  }
  return parts
}

function orb(c) {
  return [
    B('glowIco', c, [0.3, 0.3, 0.3], [0, 0, 0], { a: 'pulse' }),
    B('glowIco', 0xffffff, [0.14, 0.14, 0.14], [0, 0, 0]),
  ]
}

function rover() {
  const shell = 0xe6e9f2
  const joint = 0x5a5c78
  const head = [0, 0.48, 0.2]
  const parts = [
    B('box', shell, [0.36, 0.2, 0.5], [0, 0.38, 0]),
    B('box', 0xb48cff, [0.37, 0.05, 0.3], [0, 0.41, 0]),
    B('box', shell, [0.26, 0.2, 0.24], [0, 0.56, 0.3], { pv: head, a: 'head' }),
    B('glowBox', 0x3fe8ff, [0.2, 0.06, 0.02], [0, 0.58, 0.425], { pv: head, a: 'head' }),
    B('box', joint, [0.025, 0.18, 0.025], [0.08, 0.73, 0.26], { pv: head, a: 'head' }),
    B('glowIco', 0xff5fd0, [0.07, 0.07, 0.07], [0.08, 0.83, 0.26], { pv: head, a: 'head' }),
    B('box', joint, [0.03, 0.03, 0.22], [0, 0.5, -0.32], { pv: [0, 0.44, -0.24], a: 'tail', r: [0.6, 0, 0] }),
    B('glowIco', 0x3fe8ff, [0.06, 0.06, 0.06], [0, 0.57, -0.42], { pv: [0, 0.44, -0.24], a: 'tail' }),
  ]
  for (const x of [-1, 1]) {
    parts.push(B('box', joint, [0.07, 0.28, 0.07], [x * 0.13, 0.14, 0.17], { pv: [x * 0.13, 0.28, 0.17], a: x < 0 ? 'legA' : 'legB' }))
    parts.push(B('box', joint, [0.07, 0.28, 0.07], [x * 0.13, 0.14, -0.17], { pv: [x * 0.13, 0.28, -0.17], a: x < 0 ? 'legB' : 'legA' }))
  }
  return parts
}

// Générateur pseudo-aléatoire déterministe : la faune est la même à chaque visite.
function rng(seed) {
  let s = seed % 2147483647
  if (s <= 0) s += 2147483646
  return () => (s = (s * 16807) % 2147483647) / 2147483647
}
const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a))

export function createFauna(scene, world) {
  const rand = rng(4242)
  const R = (a, b) => a + rand() * (b - a)
  const groundAt = (x, z) => world.groundAt(x, z, Infinity, true)
  const islands = Object.fromEntries(world.islands.filter((i) => !i.interior).map((i) => [i.id, i]))
  const at = (id, dx = 0, dz = 0) => {
    const c = islands[id]?.center ?? new THREE.Vector3()
    return { x: c.x + dx, z: c.z + dz }
  }

  const animals = []
  const slots = { box: 0, ico: 0, glowBox: 0, glowIco: 0 }

  function add(kind, parts, props) {
    const a = {
      kind,
      parts: parts.map((p) => ({ ...p, slot: slots[p.m]++ })),
      x: 0, y: 0, z: 0, yaw: rand() * TAU, pitch: 0, roll: 0, lift: 0, scale: 1,
      phase: rand() * TAU, gait: 0, head: 0, flap: 0, tail: 0, pulse: 0,
      seed: rand() * 100,
      state: 'idle', timer: R(0.5, 4),
      optional: false, hidden: false, dirty: true,
      ...props,
    }
    // Les volants partent de leur point d'ancrage.
    if (props.ax !== undefined && props.x === undefined) {
      a.x = props.ax
      a.y = props.ay
      a.z = props.az
    }
    animals.push(a)
    return a
  }

  // ---------- Placement au sol ----------
  const nearColliders = (home) => world.colliders.filter((c) => Math.hypot(c.x - home.x, c.z - home.z) < home.r + c.r + 3)
  function free(x, z, level, cols, margin = 0.35) {
    const h = groundAt(x, z)
    if (h === null || Math.abs(h - level) > 0.35) return false
    for (const c of cols) {
      const dx = x - c.x
      const dz = z - c.z
      const r = c.r + margin
      if (dx * dx + dz * dz < r * r) return false
    }
    return true
  }
  // Point sûr : sol au bon niveau, hors des obstacles, et pas au bord du vide.
  function safe(x, z, level, cols) {
    if (!free(x, z, level, cols)) return false
    for (let k = 0; k < 4; k++) {
      const h = groundAt(x + Math.cos(k * 1.57) * 0.9, z + Math.sin(k * 1.57) * 0.9)
      if (h === null || Math.abs(h - level) > 0.35) return false
    }
    return true
  }
  function spot(home, level, cols, tries = 60) {
    for (let i = 0; i < tries; i++) {
      const a = rand() * TAU
      const d = Math.sqrt(rand()) * home.r
      const x = home.x + Math.cos(a) * d
      const z = home.z + Math.sin(a) * d
      if (safe(x, z, level, cols)) return { x, z }
    }
    return null
  }

  // Animal qui marche : il choisit un but, s'y rend en tournant en douceur, se repose.
  function walker(kind, parts, home, opts) {
    const level = opts.level ?? groundAt(home.x, home.z) ?? 0
    const cols = nearColliders(home)
    const p = spot(home, level, cols)
    if (!p) return null
    return add(kind, parts, {
      type: 'walker', home, level, cols, x: p.x, z: p.z, y: groundAt(p.x, p.z) ?? level, tx: p.x, tz: p.z,
      speed: 1, run: 2, turn: 4, stride: 9, idle: [1.5, 5], walk: [2, 6], flee: 0, follow: 0, hop: false, graze: false, fly: false, sit: false,
      ...opts,
    })
  }

  // ---------- Le Passé ----------
  const RABBIT = [0xf3eef8, 0xb58a66, 0x9a93ad, 0xe8d6c0]
  const pastMain = { ...at('past'), r: 21 }
  for (let i = 0; i < 6; i++) walker('rabbit', rabbit(RABBIT[i % 4]), pastMain, { speed: 1.5, run: 2.6, turn: 7, stride: 11, hop: true, flee: 4.5, idle: [1, 4], walk: [1, 3], level: 0, scale: 1.4, optional: i >= 3 })
  const lake = { ...at('lake'), r: 11 }
  for (let i = 0; i < 2; i++) walker('rabbit', rabbit(RABBIT[(i + 1) % 4]), lake, { speed: 1.5, run: 2.6, turn: 7, stride: 11, hop: true, flee: 4.5, idle: [1, 4], walk: [1, 3], level: 0, scale: 1.4, optional: i === 1 })
  for (let i = 0; i < 4; i++) walker('sheep', sheep(), lake, { speed: 0.45, run: 2.2, turn: 2, stride: 6, graze: true, flee: 2.2, idle: [4, 10], walk: [2, 5], level: 0, scale: R(0.9, 1.1), optional: i >= 2 })

  // Corbeaux et chauves-souris qui tournent autour du château.
  const castle = at('past', 0, -14)
  for (let i = 0; i < 6; i++) {
    const isBat = i % 2 === 1
    add(isBat ? 'bat' : 'crow', isBat ? bat() : crow(), {
      type: 'circle', ax: castle.x + R(-2, 2), az: castle.z + R(-2, 2), ay: R(9, 13), R: R(5, 9), w: (i % 3 === 0 ? -1 : 1) * R(0.5, 0.8),
      ang: rand() * TAU, scale: isBat ? 1.6 : 1.5, flapSpeed: isBat ? 16 : 10, glide: !isBat, optional: i >= 4,
    })
  }

  // Papillons des prés fleuris.
  const BUTTERFLY = [0xff7ab8, 0xffd34f, 0x8fd3ff, 0xb28dff, 0xff9a4a, 0xffffff]
  function butterflies(places, n, glow = false, colors = BUTTERFLY, kind = 'butterfly') {
    for (let i = 0; i < n; i++) {
      const pl = places[i % places.length]
      const h = groundAt(pl.x, pl.z) ?? 0
      add(kind, butterfly(colors[i % colors.length], glow), {
        type: 'flutter', ax: pl.x, az: pl.z, ay: h + (pl.h ?? 0.9), R: pl.r ?? 2.2, scale: glow ? 1.6 : 1.4,
        f1: R(0.25, 0.45), f2: R(0.9, 1.4), f3: R(1.6, 2.4), optional: i % 2 === 1,
      })
    }
  }
  butterflies([at('past', 13, 12), at('lake', 6, 8), at('lake', -4, 11)], 6)

  // Canards sur l'étang du Lac.
  const pond = { ...at('lake', 0, 1), r: 3.4 }
  const waterY = (groundAt(pond.x + 5.5, pond.z) ?? 0) + 0.07
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU
    const small = i >= 2
    add('duck', duck(i % 2 ? 0x9a7250 : 0xf7f3e8, i % 2 ? 0x2f8a5a : 0xf7f3e8), {
      type: 'swim', home: pond, x: pond.x + Math.cos(a) * 3, z: pond.z + Math.sin(a) * 3, y: waterY, tx: pond.x, tz: pond.z,
      speed: 0.45, turn: 2.5, scale: small ? 0.85 : 1.45, optional: i === 3,
    })
  }

  // ---------- Le Présent ----------
  const square = { ...at('present'), r: 9 }
  for (let i = 0; i < 10; i++) walker('pigeon', pigeon(), square, { speed: 0.55, run: 1.4, turn: 6, stride: 16, graze: true, peck: true, flee: 3.2, fly: true, idle: [1, 4], walk: [1, 3], level: 0, scale: 1.35, optional: i >= 5 })
  const CATS = [[0xe8964a, 0xfbe3c8], [0x2e2a3a, 0x4a4458], [0x9a96b0, 0xf1ecf6]]
  const presentMain = { ...at('present'), r: 17 }
  for (let i = 0; i < 2; i++) walker('cat', cat(...CATS[i]), presentMain, { speed: 0.6, run: 2.4, turn: 3, stride: 8, sit: true, flee: 1.6, idle: [4, 12], walk: [3, 8], level: 0, scale: 1.3, optional: i === 1 })
  walker('cat', cat(...CATS[2]), { ...at('rooftops'), r: 10 }, { speed: 0.6, run: 2.4, turn: 3, stride: 8, sit: true, flee: 1.6, idle: [4, 12], walk: [3, 8], scale: 1.3 })
  walker('dog', dog(), { ...at('park'), r: 10 }, { speed: 1.5, run: 3.2, turn: 5, stride: 12, follow: 9, idle: [1, 3], walk: [2, 5], level: 0, scale: 1.3 })

  // Vol d'oiseaux (boids simplifiés) qui tournoie au-dessus du village.
  const flock = { ...at('present'), y: 8.5, R: 13, w: 0.22, members: [] }
  const BIRDS = [0xf6f2ff, 0xff9a5a, 0x5ac8ff]
  for (let i = 0; i < 9; i++) {
    const a = rand() * TAU
    flock.members.push(add('bird', bird(BIRDS[i % 3]), {
      type: 'flock', x: flock.x + Math.cos(a) * 12, y: flock.y + R(-1, 1), z: flock.z + Math.sin(a) * 12,
      vel: new THREE.Vector3(-Math.sin(a), 0, Math.cos(a)).multiplyScalar(4), scale: 1.6, optional: i >= 5,
    }))
  }
  butterflies([at('park', -6, 5), at('park', 8, -7), at('present', 0, -12.6), at('present', -18, 6), at('present', 18, 8)], 6)

  // ---------- Le Futur ----------
  const JELLY = [0xb48cff, 0x3fe8ff, 0xff6fcf]
  const jellyPlaces = [at('future', -6, 6), at('future', 9, 6), at('future', 2, -6), at('crystals'), at('orbit'), at('asteroids')]
  jellyPlaces.forEach((pl, i) => {
    const h = groundAt(pl.x, pl.z) ?? 0
    add('jelly', jelly(JELLY[i % 3]), { type: 'drift', ax: pl.x, az: pl.z, ay: h + R(3, 5), R: R(3, 6), f: R(0.05, 0.1), scale: R(0.9, 1.3), optional: i >= 3 })
  })
  for (let i = 0; i < 3; i++) {
    const pl = at('future', R(-12, 12), R(-10, 12))
    add('orb', orb(JELLY[(i + 1) % 3]), { type: 'drift', ax: pl.x, az: pl.z, ay: R(1.6, 3), R: R(3, 7), f: R(0.08, 0.14), scale: 1, optional: i >= 1 })
  }
  const moon = { ...at('future'), r: 17 }
  for (let i = 0; i < 4; i++) walker('rover', rover(), moon, { speed: 1.1, run: 2, turn: 3.5, stride: 10, bouncy: true, follow: i === 0 ? 7 : 0, idle: [2, 5], walk: [3, 7], level: 0, scale: 1.1, optional: i >= 2 })
  butterflies([
    { ...at('future', -15, 8), h: 1.2 }, { ...at('future', -9, 16), h: 1.2 }, { ...at('future', -8, 10), h: 1.6 },
    { ...at('future', 15, -11), h: 1.4 }, { ...at('crystals'), h: 1.5, r: 3 },
  ], 7, true, [0x6fe8ff, 0xff8fe0, 0x8fffc8], 'moth')

  // ---------- Maillages instanciés ----------
  const lit = new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true, roughness: 0.85 })
  const glow = new THREE.MeshBasicMaterial({ color: 0xffffff })
  const geos = {
    box: new THREE.BoxGeometry(1, 1, 1),
    ico: new THREE.IcosahedronGeometry(0.5, 1),
    glowBox: new THREE.BoxGeometry(1, 1, 1),
    glowIco: new THREE.IcosahedronGeometry(0.5, 1),
  }
  const meshes = {}
  const group = new THREE.Group()
  group.name = 'fauna'
  for (const key of Object.keys(slots)) {
    const m = new THREE.InstancedMesh(geos[key], key.startsWith('glow') ? glow : lit, Math.max(1, slots[key]))
    m.count = slots[key]
    m.castShadow = false
    // Avec les ombres VSM, un receveur est aussi dessiné dans la carte d'ombre : on s'en passe.
    m.receiveShadow = false
    m.frustumCulled = false
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    meshes[key] = m
    if (slots[key]) group.add(m)
  }
  const col = new THREE.Color()
  for (const a of animals) {
    for (const p of a.parts) {
      col.set(p.c)
      if (p.m.startsWith('glow')) col.multiplyScalar(1.8)
      meshes[p.m].setColorAt(p.slot, col)
    }
  }
  scene.add(group)

  // ---------- Pose ----------
  const base = new THREE.Matrix4()
  const local = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const qr = new THREE.Quaternion()
  const e = new THREE.Euler()
  const pos = new THREE.Vector3()
  const off = new THREE.Vector3()
  const scl = new THREE.Vector3()
  const ZERO = new THREE.Matrix4().makeScale(0, 0, 0)
  const restQ = new Map()

  function writePose(a, t) {
    e.set(a.pitch, a.yaw, a.roll, 'YXZ')
    q.setFromEuler(e)
    pos.set(a.x, a.y + a.lift, a.z)
    scl.setScalar(a.scale)
    base.compose(pos, q, scl)
    const swing = Math.sin(a.phase) * a.gait * 0.75
    for (const p of a.parts) {
      let rx = 0
      let ry = 0
      let rz = 0
      let sx = 1
      let sy = 1
      switch (p.a) {
        case 'legA': rx = swing; break
        case 'legB': rx = -swing; break
        case 'head': rx = a.head; break
        case 'tail': ry = a.tail; break
        case 'wing': rz = Math.sign(p.p[0]) * a.flap; break
        case 'sway': rx = Math.sin(t * 2.2 + a.seed + p.k * 1.7) * 0.35; rz = Math.cos(t * 1.7 + a.seed + p.k) * 0.25; break
        case 'pulse': sx = 1 + a.pulse * 0.12; sy = 1 - a.pulse * 0.15; break
      }
      const pv = p.pv ?? p.p
      e.set(rx, ry, rz)
      q.setFromEuler(e)
      off.set(p.p[0] - pv[0], p.p[1] - pv[1], p.p[2] - pv[2]).applyQuaternion(q)
      pos.set(pv[0], pv[1], pv[2]).add(off)
      if (p.r) {
        let rq = restQ.get(p)
        if (!rq) restQ.set(p, (rq = new THREE.Quaternion().setFromEuler(new THREE.Euler(...p.r))))
        qr.copy(q).multiply(rq)
      } else qr.copy(q)
      scl.set(p.s[0] * sx, p.s[1] * sy, p.s[2] * sx)
      local.compose(pos, qr, scl)
      local.premultiply(base)
      meshes[p.m].setMatrixAt(p.slot, local)
    }
  }
  function hide(a) {
    for (const p of a.parts) meshes[p.m].setMatrixAt(p.slot, ZERO)
  }

  // ---------- Comportements ----------
  const pickTarget = (a) => {
    for (let i = 0; i < 12; i++) {
      const ang = rand() * TAU
      const d = R(1.5, Math.min(6, a.home.r))
      const x = a.x + Math.cos(ang) * d
      const z = a.z + Math.sin(ang) * d
      if (Math.hypot(x - a.home.x, z - a.home.z) < a.home.r && safe(x, z, a.level, a.cols)) {
        a.tx = x
        a.tz = z
        return true
      }
    }
    // Pas de but trouvé : retour vers le centre de la zone.
    a.tx = a.home.x
    a.tz = a.home.z
    return false
  }
  const goIdle = (a) => {
    a.state = 'idle'
    a.timer = R(a.idle[0], a.idle[1])
    a.grazing = a.graze && rand() < 0.7
  }

  // Avance vers (tx, tz). Renvoie false si le pas est impossible (vide, obstacle, falaise).
  function steer(a, dt, speed) {
    const dx = a.tx - a.x
    const dz = a.tz - a.z
    const d = Math.hypot(dx, dz)
    if (d < 0.25) return 'arrived'
    const diff = wrapAngle(Math.atan2(dx, dz) - a.yaw)
    const maxTurn = a.turn * dt
    a.yaw += Math.max(-maxTurn, Math.min(maxTurn, diff))
    const v = speed * Math.max(0, Math.cos(diff)) * dt
    if (v <= 0) return 'turning'
    const fx = Math.sin(a.yaw)
    const fz = Math.cos(a.yaw)
    const nx = a.x + fx * v
    const nz = a.z + fz * v
    const ahead = groundAt(nx + fx * 0.55, nz + fz * 0.55)
    if (!free(nx, nz, a.level, a.cols, 0.25) || ahead === null || Math.abs(ahead - a.level) > 0.35 || Math.hypot(nx - a.home.x, nz - a.home.z) > a.home.r + 1) return 'blocked'
    a.x = nx
    a.z = nz
    a.moved = v / dt
    return 'moving'
  }

  function updateWalker(a, dt, t, focus) {
    let fd = Infinity
    let fdx = 0
    let fdz = 0
    if (focus && Math.abs(focus.y - a.y) < 3) {
      fdx = a.x - focus.x
      fdz = a.z - focus.z
      fd = Math.hypot(fdx, fdz)
    }
    // S'envoler (pigeons), fuir (lapins, moutons, chats) ou suivre le joueur (chien, robot).
    if (a.state !== 'fly') {
      if (a.flee && fd < a.flee) {
        if (a.fly) {
          a.state = 'fly'
          a.flyT = 0
          a.flyDur = R(4, 7)
          a.orbit = Math.atan2(a.z - a.home.z, a.x - a.home.x)
          a.orbitR = R(3, 6)
          a.orbitY = a.level + R(4, 6.5)
          a.orbitW = (rand() < 0.5 ? -1 : 1) * R(0.6, 0.9)
          a.landing = null
        } else if (a.state !== 'flee' || a.timer < 0) {
          a.state = 'flee'
          a.timer = 0.8
          const k = 3.5 / (fd || 1)
          a.tx = a.x + fdx * k
          a.tz = a.z + fdz * k
          if (!safe(a.tx, a.tz, a.level, a.cols)) pickTarget(a)
        }
      } else if (a.follow && fd < a.follow && fd > 2.4) {
        a.state = 'follow'
        a.tx = focus.x + (fdx / fd) * 1.8
        a.tz = focus.z + (fdz / fd) * 1.8
      } else if (a.state === 'follow') {
        goIdle(a)
        a.timer = R(0.8, 2)
      }
    }

    a.moved = 0
    let gaitTarget = 0
    let headTarget = 0
    let pitchTarget = 0
    switch (a.state) {
      case 'idle': {
        a.timer -= dt
        if (a.grazing) headTarget = a.peck ? (Math.sin(t * 9 + a.seed) > 0.3 ? 0.9 : 0.1) : 0.75 + Math.sin(t * 2 + a.seed) * 0.1
        else headTarget = Math.sin(t * 0.7 + a.seed) * 0.15
        if (a.sit && a.timer > 1.2) pitchTarget = -0.32
        if (a.timer <= 0) {
          pickTarget(a)
          a.state = 'walk'
          a.timer = R(a.walk[0], a.walk[1])
        }
        break
      }
      case 'walk':
      case 'follow':
      case 'flee': {
        const run = a.state !== 'walk'
        a.timer -= dt
        const r = steer(a, dt, a.speed * (run ? a.run : 1))
        if (r === 'arrived' || r === 'blocked' || (a.state === 'walk' && a.timer <= 0)) {
          if (r === 'blocked' && a.state !== 'walk') pickTarget(a)
          else if (a.state !== 'follow') goIdle(a)
          if (r === 'blocked' && a.state === 'walk') a.timer = R(0.3, 1)
        }
        gaitTarget = a.moved > 0.01 ? 1 : 0.25
        if (a.peck) headTarget = Math.sin(a.phase * 2) * 0.25
        break
      }
      case 'fly': {
        updatePigeonFlight(a, dt, t, focus)
        break
      }
    }

    if (a.state !== 'fly') {
      a.gait += (gaitTarget - a.gait) * Math.min(1, dt * 8)
      a.head += (headTarget - a.head) * Math.min(1, dt * 6)
      a.pitch += (pitchTarget - a.pitch) * Math.min(1, dt * 4)
      a.flap += (0 - a.flap) * Math.min(1, dt * 8)
      a.phase += dt * a.stride * (0.35 + Math.min(1.6, a.moved / Math.max(0.1, a.speed)) * 0.65) * a.gait
      const h = groundAt(a.x, a.z) ?? a.level
      a.y += (h - a.y) * Math.min(1, dt * 10)
      if (a.hop) {
        a.lift = Math.abs(Math.sin(a.phase * 0.5)) * 0.28 * a.gait
        a.pitch = -Math.cos(a.phase * 0.5) * 0.25 * a.gait + (pitchTarget - 0) * (1 - a.gait)
      } else if (a.bouncy) a.lift = Math.abs(Math.sin(a.phase)) * 0.09 * a.gait
      else a.lift = Math.abs(Math.sin(a.phase)) * 0.025 * a.gait
      a.roll *= 1 - Math.min(1, dt * 5)
    }
    a.tail = Math.sin(t * (a.kind === 'dog' ? 14 : 2.2) + a.seed) * (a.kind === 'dog' ? 0.6 : 0.35)
  }

  // Pigeons effrayés : envol, quelques tours en l'air, puis atterrissage loin du joueur.
  function updatePigeonFlight(a, dt, t, focus) {
    a.flyT += dt
    a.gait += (0 - a.gait) * Math.min(1, dt * 8)
    a.head += (-0.1 - a.head) * Math.min(1, dt * 6)
    let gx
    let gy
    let gz
    if (!a.landing && a.flyT > a.flyDur) {
      const s = spot(a.home, a.level, a.cols, 20)
      if (s && (!focus || Math.hypot(s.x - focus.x, s.z - focus.z) > a.flee + 1.5)) a.landing = s
      else a.flyDur += 1
    }
    if (a.landing) {
      gx = a.landing.x
      gz = a.landing.z
      const d = Math.hypot(gx - a.x, gz - a.z)
      gy = (groundAt(gx, gz) ?? a.level) + Math.min(3, d * 0.5)
      if (d < 0.2 && a.y - gy < 0.1) {
        a.state = 'idle'
        a.timer = R(1, 3)
        a.grazing = true
        a.lift = 0
        a.pitch = 0
        a.roll = 0
        return
      }
    } else {
      a.orbit += a.orbitW * dt
      gx = a.home.x + Math.cos(a.orbit) * a.orbitR
      gz = a.home.z + Math.sin(a.orbit) * a.orbitR
      gy = a.orbitY + Math.sin(t * 1.3 + a.seed) * 0.4
    }
    const k = Math.min(1, dt * (a.landing ? 2.2 : 1.6))
    const vx = (gx - a.x) * k
    const vz = (gz - a.z) * k
    const vy = (gy - a.y - a.lift) * Math.min(1, dt * 2)
    a.x += vx
    a.z += vz
    a.y += vy
    if (Math.abs(vx) + Math.abs(vz) > 1e-4) {
      const want = Math.atan2(vx, vz)
      const diff = wrapAngle(want - a.yaw)
      a.yaw += diff * Math.min(1, dt * 6)
      a.roll += (-diff * 0.8 - a.roll) * Math.min(1, dt * 4)
    }
    a.pitch += (-vy / Math.max(dt, 1e-3) * 0.08 - a.pitch) * Math.min(1, dt * 4)
    a.lift += (0 - a.lift) * Math.min(1, dt * 4)
    a.flap = 1.25 + Math.sin(t * 24 + a.seed) * 0.55
  }

  function updateCircle(a, dt, t) {
    a.ang += a.w * dt
    const r = a.R + Math.sin(t * 0.3 + a.seed) * 1.5
    a.x = a.ax + Math.cos(a.ang) * r
    a.z = a.az + Math.sin(a.ang) * r
    a.y = a.ay + Math.sin(t * 0.5 + a.seed) * 1.2
    const vx = -Math.sin(a.ang) * a.w
    const vz = Math.cos(a.ang) * a.w
    a.yaw = Math.atan2(vx, vz)
    a.roll = -Math.sign(a.w) * 0.35
    a.pitch = -Math.cos(t * 0.5 + a.seed) * 0.15
    const gliding = a.glide && Math.sin(t * 0.45 + a.seed) > 0.25
    a.flap = gliding ? 0.12 + Math.sin(t * 2 + a.seed) * 0.05 : Math.sin(t * a.flapSpeed + a.seed) * 0.75
  }

  function updateFlutter(a, dt, t) {
    const px = a.x
    const pz = a.z
    a.x = a.ax + Math.sin(t * a.f1 + a.seed) * a.R + Math.sin(t * a.f2 + a.seed * 2) * 0.45
    a.z = a.az + Math.cos(t * a.f1 * 0.8 + a.seed * 3) * a.R + Math.cos(t * a.f2 * 1.2 + a.seed) * 0.45
    a.y = a.ay + Math.sin(t * a.f3 + a.seed) * 0.3 + Math.sin(t * 0.4 + a.seed) * 0.3
    const vx = a.x - px
    const vz = a.z - pz
    if (Math.abs(vx) + Math.abs(vz) > 1e-5) a.yaw += wrapAngle(Math.atan2(vx, vz) - a.yaw) * Math.min(1, dt * 6)
    a.flap = 0.25 + Math.sin(t * 20 + a.seed) * 0.95
    a.pitch = -0.2
  }

  function updateDrift(a, dt, t) {
    a.x = a.ax + Math.sin(t * a.f + a.seed) * a.R
    a.z = a.az + Math.cos(t * a.f * 0.7 + a.seed * 2) * a.R
    a.y = a.ay + Math.sin(t * 0.6 + a.seed) * 0.5
    a.pulse = Math.sin(t * 2.2 + a.seed)
    a.lift = a.pulse * 0.08
    a.yaw += dt * 0.25
    a.roll = Math.sin(t * 0.5 + a.seed) * 0.12
  }

  function updateSwim(a, dt, t) {
    a.timer -= dt
    if (a.state === 'idle') {
      if (a.timer <= 0) {
        // On fait le tour de l'étang (une barque est amarrée au milieu).
        const ang = Math.atan2(a.z - a.home.z, a.x - a.home.x) + (rand() < 0.5 ? -1 : 1) * R(0.5, 1.1)
        const d = R(2.6, a.home.r)
        a.tx = a.home.x + Math.cos(ang) * d
        a.tz = a.home.z + Math.sin(ang) * d
        a.state = 'swim'
      }
    } else {
      const dx = a.tx - a.x
      const dz = a.tz - a.z
      const d = Math.hypot(dx, dz)
      if (d < 0.2) {
        a.state = 'idle'
        a.timer = R(1, 4)
        a.dive = rand() < 0.35 ? 1.4 : 0
      } else {
        const diff = wrapAngle(Math.atan2(dx, dz) - a.yaw)
        a.yaw += Math.max(-a.turn * dt, Math.min(a.turn * dt, diff))
        const v = a.speed * Math.max(0.2, Math.cos(diff)) * dt
        a.x += Math.sin(a.yaw) * v
        a.z += Math.cos(a.yaw) * v
      }
    }
    // Plongeon tête la première, queue en l'air.
    a.dive = Math.max(0, (a.dive ?? 0) - dt)
    const diving = a.dive > 0 && a.dive < 1.2
    a.pitch += ((diving ? 1.1 : 0) - a.pitch) * Math.min(1, dt * 5)
    a.head += ((diving ? 0.4 : Math.sin(t * 1.5 + a.seed) * 0.12) - a.head) * Math.min(1, dt * 5)
    a.lift = Math.sin(t * 2 + a.seed) * 0.015
    a.tail = 0
  }

  // Vol groupé : cohésion, alignement, séparation et un but qui tourne au-dessus du village.
  const steerV = new THREE.Vector3()
  const goal = new THREE.Vector3()
  function updateFlock(dt, t) {
    const ga = t * flock.w
    goal.set(flock.x + Math.cos(ga) * flock.R, flock.y + Math.sin(t * 0.3) * 1.5, flock.z + Math.sin(ga) * flock.R * 0.8)
    const live = flock.members.filter((m) => !m.hidden)
    for (const a of live) {
      steerV.set(goal.x - a.x, goal.y - a.y, goal.z - a.z).multiplyScalar(0.35)
      for (const b of live) {
        if (b === a) continue
        const dx = a.x - b.x
        const dy = a.y - b.y
        const dz = a.z - b.z
        const d2 = dx * dx + dy * dy + dz * dz
        if (d2 < 2.2 && d2 > 1e-4) steerV.x += (dx / d2) * 1.6, steerV.y += (dy / d2) * 1.6, steerV.z += (dz / d2) * 1.6
        if (d2 < 16) steerV.addScaledVector(b.vel, 0.05)
      }
      a.vel.addScaledVector(steerV, dt)
      const sp = a.vel.length()
      if (sp > 6) a.vel.multiplyScalar(6 / sp)
      else if (sp < 3) a.vel.multiplyScalar(3 / Math.max(sp, 0.01))
      a.x += a.vel.x * dt
      a.y += a.vel.y * dt
      a.z += a.vel.z * dt
      const yaw = Math.atan2(a.vel.x, a.vel.z)
      const turn = wrapAngle(yaw - a.yaw)
      a.yaw = yaw
      a.roll += (-turn / Math.max(dt, 1e-3) * 0.25 - a.roll) * Math.min(1, dt * 3)
      a.roll = Math.max(-0.8, Math.min(0.8, a.roll))
      a.pitch = -Math.atan2(a.vel.y, Math.hypot(a.vel.x, a.vel.z))
      a.flap = Math.sin(t * 13 + a.seed) * 0.7 * (Math.sin(t * 0.7 + a.seed) > -0.3 ? 1 : 0.15)
      a.dirty = true
    }
  }

  // ---------- Boucle ----------
  let detail = 0
  let visible = true
  for (const a of animals) writePose(a, 0)
  for (const m of Object.values(meshes)) {
    m.instanceMatrix.needsUpdate = true
    if (m.instanceColor) m.instanceColor.needsUpdate = true
  }

  const api = {
    group,
    meshes,
    animals,
    count: animals.length,
    setDetail(q) {
      detail = q
      for (const a of animals) {
        const hidden = a.optional && q >= 2
        if (hidden !== a.hidden) {
          a.hidden = hidden
          if (hidden) hide(a)
          else a.dirty = true
        }
      }
      for (const m of Object.values(meshes)) m.instanceMatrix.needsUpdate = true
    },
    get detail() {
      return detail
    },
    // `focus` : point regardé par la caméra (en général le joueur).
    update(dt, t, focus) {
      // Loin de toutes les îles (intérieurs) : rien à dessiner ni à animer.
      let near = !focus
      if (focus) for (const id of ['past', 'present', 'future']) if (islands[id] && Math.hypot(focus.x - islands[id].center.x, focus.z - islands[id].center.z) < HIDE_RANGE) near = true
      if (near !== visible) {
        visible = near
        group.visible = near
      }
      if (!visible) return
      let flockActive = false
      for (const a of flock.members) if (!a.hidden && (!focus || Math.hypot(focus.x - a.x, focus.z - a.z) < ACTIVE_RANGE + 20)) flockActive = true
      if (flockActive) updateFlock(dt, t)
      let changed = false
      for (const a of animals) {
        if (a.hidden) continue
        const active = !focus || Math.abs(focus.x - a.x) + Math.abs(focus.z - a.z) < ACTIVE_RANGE * 1.3
        if (active) {
          switch (a.type) {
            case 'walker': updateWalker(a, dt, t, focus); break
            case 'circle': updateCircle(a, dt, t); break
            case 'flutter': updateFlutter(a, dt, t); break
            case 'drift': updateDrift(a, dt, t); break
            case 'swim': updateSwim(a, dt, t); break
          }
          if (a.type !== 'flock' || flockActive) a.dirty = true
        }
        if (a.dirty) {
          writePose(a, t)
          a.dirty = false
          changed = true
        }
      }
      if (changed) for (const m of Object.values(meshes)) m.instanceMatrix.needsUpdate = true
    },
  }
  return api
}
