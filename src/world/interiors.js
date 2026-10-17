import * as THREE from 'three'
import { mat, mesh, textTexture } from './helpers.js'
import { canvasTexture, codeScreen } from './points.js'
import { torch } from './buildings.js'
import * as C from './characters.js'

// Intérieurs façon « maison dans Pokémon » : une pièce posée loin des îles, sur fond noir,
// vue de plus près et plus en plongée. On y entre par une porte (château, maison du
// développeur, base lunaire) et on en ressort par le tapis de sortie.

export const ROOMS = {
  castle: { era: 'past', name: 'La grande salle du château', tagline: 'Histoires et jeux du royaume', center: [-150, 520], w: 18, d: 13, wall: 0x6e6590, floor: 'stone' },
  studio: { era: 'present', name: 'Le studio du développeur', tagline: 'Là où naissent les projets', center: [0, 520], w: 14, d: 10, wall: 0xe8d5bf, floor: 'wood' },
  base: { era: 'future', name: 'La base lunaire', tagline: 'Poste de commandement', center: [150, 520], w: 16, d: 12, wall: 0x9aa0c0, floor: 'metal' },
}

const floorTexture = (kind) => canvasTexture(256, 256, (g, w, h) => {
  if (kind === 'stone') {
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 4; x++) {
        const l = 42 + ((x + y) % 2) * 10 + Math.random() * 6
        g.fillStyle = `hsl(258, 18%, ${l}%)`
        g.fillRect(x * 64 + 2, y * 64 + 2, 60, 60)
      }
    }
  } else if (kind === 'wood') {
    g.fillStyle = '#7a4f30'
    g.fillRect(0, 0, w, h)
    for (let y = 0; y < 8; y++) {
      const off = (y % 2) * 64
      for (let x = -1; x < 3; x++) {
        g.fillStyle = `hsl(26, 40%, ${36 + Math.random() * 8}%)`
        g.fillRect(x * 128 + off + 1, y * 32 + 1, 126, 30)
      }
    }
  } else {
    g.fillStyle = '#5b6078'
    g.fillRect(0, 0, w, h)
    g.strokeStyle = '#3b3f55'
    g.lineWidth = 4
    for (let i = 0; i <= 4; i++) {
      g.beginPath()
      g.moveTo(i * 64, 0)
      g.lineTo(i * 64, h)
      g.moveTo(0, i * 64)
      g.lineTo(w, i * 64)
      g.stroke()
    }
    g.fillStyle = '#7df9ff'
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) g.fillRect(i * 64 + 30, j * 64 + 30, 4, 4)
  }
})

// Crée la pièce (sol, murs, collisions) et renvoie un contexte comme celui des îles.
export function buildRoom(scene, ground, colliders, animated, key) {
  const room = ROOMS[key]
  const center = new THREE.Vector3(room.center[0], 0, room.center[1])
  const group = new THREE.Group()
  group.position.copy(center)
  scene.add(group)
  const { w, d } = room
  const ctx = {
    group,
    center,
    colliders,
    animated,
    era: room.era,
    heightAt: () => 0,
    addCollider: (x, z, r, top = 6) => colliders.push({ x: center.x + x, z: center.z + z, r, top }),
    addFadeable: () => {},
    room,
    key,
  }

  // Grand fond noir : la pièce flotte dans le noir, comme dans les jeux Pokémon.
  const voidPlane = mesh(new THREE.PlaneGeometry(260, 260), new THREE.MeshBasicMaterial({ color: 0x05040c }), { y: -0.6, shadow: false })
  voidPlane.rotation.x = -Math.PI / 2
  group.add(voidPlane)

  const tex = floorTexture(room.floor)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(w / 4, d / 4)
  const floor = mesh(new THREE.BoxGeometry(w, 0.5, d), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 }), { y: -0.25 })
  floor.castShadow = false
  group.add(floor)
  const rect = (x0, z0, x1, z1) => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]].map(([x, z]) => [center.x + x, center.z + z])
  const R = Math.hypot(w, d) / 2 + 1
  ground.surfaces.push({ type: 'poly', pts: rect(-w / 2, -d / 2, w / 2, d / 2), x: center.x, z: center.z, r: R, h: 0, room: true })

  // Murs : fond et côtés pleins, mur de devant bas (on voit dedans depuis la caméra).
  const wallMat = mat(room.wall)
  const trim = mat(new THREE.Color(room.wall).offsetHSL(0, 0, -0.18))
  const H = 3.6
  const wall = (x, z, sx, sz, h) => {
    group.add(mesh(new THREE.BoxGeometry(sx, h, sz), wallMat, { x, y: h / 2, z }))
    group.add(mesh(new THREE.BoxGeometry(sx + 0.05, 0.25, sz + 0.05), trim, { x, y: h, z }))
    ground.surfaces.push({ type: 'poly', pts: rect(x - sx / 2, z - sz / 2, x + sx / 2, z + sz / 2), x: center.x + x, z: center.z + z, r: Math.hypot(sx, sz) / 2 + 0.5, h: 4, room: true, wall: true })
  }
  wall(0, -d / 2 - 0.3, w + 1.2, 0.6, H)
  wall(-w / 2 - 0.3, 0, 0.6, d, H)
  wall(w / 2 + 0.3, 0, 0.6, d, H)
  // Devant : deux murets de part et d'autre de la porte.
  const side = (w - 2.4) / 2
  wall(-w / 2 + side / 2, d / 2 + 0.3, side, 0.6, 0.7)
  wall(w / 2 - side / 2, d / 2 + 0.3, side, 0.6, 0.7)

  // Tapis de sortie devant la porte.
  const mat0 = mesh(new THREE.BoxGeometry(2.2, 0.04, 1.2), mat(0xc0392b), { y: 0.02, z: d / 2 - 0.5, shadow: false })
  group.add(mat0)
  const arrow = mesh(new THREE.ConeGeometry(0.3, 0.6, 3).rotateX(Math.PI / 2), mat(0xffd27a, { emissive: 0xffb347, emissiveIntensity: 1.5 }), { y: 0.1, z: d / 2 + 0.2, shadow: false })
  arrow.scale.y = 0.3
  group.add(arrow)
  animated.push((dt, t) => { arrow.position.z = d / 2 + 0.2 + Math.sin(t * 4) * 0.12 })

  // Lumière d'ambiance de la pièce.
  const light = new THREE.PointLight(room.floor === 'metal' ? 0xbfd8ff : 0xffc98a, 40, 26, 1.6)
  light.position.set(0, 5, 1)
  group.add(light)

  ctx.exit = new THREE.Vector3(center.x, 0, center.z + d / 2 - 0.4)
  ctx.arrival = new THREE.Vector3(center.x, 0, center.z + d / 2 - 2.4)
  ctx.info = { id: `room-${key}`, era: room.era, name: room.name, tagline: room.tagline, center, radius: Math.max(w, d) / 2 + 1, gravity: 1, interior: true }
  DECOR[key](ctx, w, d)
  return ctx
}

const box = (ctx, sx, sy, sz, color, x, y, z, extra) => {
  const m = mesh(new THREE.BoxGeometry(sx, sy, sz), mat(color, extra), { x, y, z })
  ctx.group.add(m)
  return m
}

const poster = (text, bg, fg) => new THREE.MeshStandardMaterial({ map: textTexture(text, { bg, fg, width: 256, height: 340, font: 'bold 40px Georgia, serif' }) })

const DECOR = {
  castle(ctx, w, d) {
    const { group } = ctx
    // Tapis rouge jusqu'au trône.
    box(ctx, 2.4, 0.03, d - 1, 0x9b1d2a, 0, 0.015, 0.3)
    box(ctx, 2.0, 0.035, d - 1.2, 0xc0392b, 0, 0.02, 0.3)
    // Estrade et trône.
    box(ctx, 5, 0.4, 2.2, 0x56507a, 0, 0.2, -d / 2 + 1.3)
    box(ctx, 1.4, 0.6, 1.1, 0x7a2a8a, 0, 0.7, -d / 2 + 1.2)
    box(ctx, 1.4, 2.4, 0.25, 0xd4a017, 0, 1.6, -d / 2 + 0.7, { metalness: 0.6, roughness: 0.3 })
    for (const x of [-0.75, 0.75]) box(ctx, 0.2, 1, 1.1, 0xd4a017, x, 0.9, -d / 2 + 1.2, { metalness: 0.6, roughness: 0.3 })
    ctx.addCollider(0, -d / 2 + 1.2, 1.1, 2)
    // Bannières sur le mur du fond.
    for (const [x, c] of [[-5, 0x5a2a8a], [5, 0x5a2a8a], [-2.6, 0xd4a017], [2.6, 0xd4a017]]) {
      box(ctx, 1.1, 2.2, 0.05, c, x, 2.3, -d / 2 + 0.05)
      const tip = mesh(new THREE.ConeGeometry(0.55, 0.5, 3), mat(c), { x, y: 1.0, z: -d / 2 + 0.05 })
      tip.rotation.z = Math.PI
      group.add(tip)
    }
    // Colonnes.
    for (const x of [-4.5, 4.5]) for (const z of [-2.5, 2]) {
      group.add(mesh(new THREE.CylinderGeometry(0.4, 0.45, 3.6, 8), mat(0x8a83ad), { x, y: 1.8, z }))
      ctx.addCollider(x, z, 0.5)
    }
    // Table de banquet avec chandelles et coupes.
    box(ctx, 1.4, 0.1, 5, 0x6b4226, -6.5, 0.85, 1)
    for (const z of [-1, 1, 3]) box(ctx, 0.12, 0.85, 0.12, 0x5a3a22, -6.5, 0.42, z)
    for (const z of [-0.8, 0.6, 2.2]) {
      box(ctx, 0.08, 0.3, 0.08, 0xfff4dc, -6.5, 1.05, z)
      group.add(mesh(new THREE.ConeGeometry(0.05, 0.12, 6), mat(0xffb347, { emissive: 0xff8a20, emissiveIntensity: 3 }), { x: -6.5, y: 1.26, z, shadow: false }))
      group.add(mesh(new THREE.CylinderGeometry(0.06, 0.04, 0.16, 8), mat(0xd4a017, { metalness: 0.7, roughness: 0.3 }), { x: -6.2, y: 0.98, z: z + 0.4 }))
    }
    for (const z of [-1, 1, 3]) for (const x of [-7.5, -5.5]) box(ctx, 0.5, 0.5, 0.5, 0x5a3a22, x, 0.25, z)
    ctx.addCollider(-6.5, 1, 1.4, 1.2)
    ctx.addCollider(-6.5, -1, 1, 1.2)
    ctx.addCollider(-6.5, 3, 1, 1.2)
    // Cheminée avec feu qui danse.
    box(ctx, 2.6, 2.4, 0.9, 0x5a5578, 6.5, 1.2, -d / 2 + 0.6)
    box(ctx, 1.6, 1.2, 0.3, 0x1a1020, 6.5, 0.6, -d / 2 + 1.0)
    const fire = []
    for (let i = 0; i < 3; i++) {
      const f = mesh(new THREE.ConeGeometry(0.22, 0.7, 5), mat(i ? 0xffb347 : 0xff5a1f, { emissive: i ? 0xff9a2a : 0xff4a10, emissiveIntensity: 3 }), { x: 6.2 + i * 0.3, y: 0.4, z: -d / 2 + 1.1, shadow: false })
      fire.push(f)
      group.add(f)
    }
    ctx.animated.push((dt, t) => fire.forEach((f, i) => { f.scale.y = 0.8 + Math.sin(t * 9 + i * 2) * 0.25 }))
    ctx.addCollider(6.5, -d / 2 + 0.8, 1.4, 3)
    // Torches aux murs.
    for (const [x, z] of [[-w / 2 + 0.25, -2], [-w / 2 + 0.25, 3], [w / 2 - 0.25, 1], [w / 2 - 0.25, 4]]) torch(group, x, 2.2, z, ctx.animated)
    // Râtelier d'armes et armure.
    box(ctx, 2, 1.6, 0.4, 0x6b4226, 6.5, 0.8, 3.8)
    for (const x of [5.8, 6.3, 6.8, 7.2]) box(ctx, 0.08, 1.4, 0.08, 0xcfd3e0, x, 1.1, 3.6, { metalness: 0.7 })
    ctx.addCollider(6.5, 3.8, 1.1, 2)
    // Le roi sur son trône, un mage et un garde qui fait sa ronde.
    const king = C.npc(ctx, 'knight', 0, -d / 2 + 1.35, { keep: ['Knight_Cape', 'Knight_Helmet'], anim: 'Sit_Chair_Idle', r: 0, greet: false })
    king.object.position.y = 0.8
    C.npc(ctx, 'mage', -3, -3.5, { keep: ['Spellbook_open', 'Mage_Hat'], anim: 'Spellcasting', speed: 0.5, path: [[-3, -3.5], [-2.5, 2.5]], walk: 0.8, pause: 4 })
    C.npc(ctx, 'barbarian', 3, 3, { keep: ['1H_Axe', 'Barbarian_Hat'], path: [[3, 3], [3, -3], [5.5, 0]], walk: 1, pause: 2.5 })
  },

  studio(ctx, w, d) {
    const { group } = ctx
    // Grande baie vitrée avec la ville au crépuscule.
    const sky = canvasTexture(512, 160, (g, W, H) => {
      const grad = g.createLinearGradient(0, 0, 0, H)
      grad.addColorStop(0, '#ff9a4a')
      grad.addColorStop(1, '#6a3a7a')
      g.fillStyle = grad
      g.fillRect(0, 0, W, H)
      for (let x = 0; x < W; x += 24 + Math.random() * 20) {
        const bh = 40 + Math.random() * 90
        g.fillStyle = '#2a1a3a'
        g.fillRect(x, H - bh, 22, bh)
        g.fillStyle = '#ffd27a'
        for (let y = H - bh + 6; y < H - 6; y += 12) if (Math.random() > 0.4) g.fillRect(x + 5, y, 4, 5)
      }
    })
    const win = mesh(new THREE.PlaneGeometry(7, 2), new THREE.MeshStandardMaterial({ map: sky, emissiveMap: sky, emissive: 0xffffff, emissiveIntensity: 0.9 }), { y: 2.1, z: -d / 2 + 0.02, shadow: false })
    group.add(win)
    for (const x of [-3.5, 0, 3.5]) box(ctx, 0.12, 2.2, 0.1, 0x333344, x, 2.1, -d / 2 + 0.05)
    // Bureau d'angle avec double écran et le développeur.
    box(ctx, 3.2, 0.08, 1, 0xf2f2f2, -4, 0.82, -d / 2 + 1)
    for (const x of [-5.4, -2.6]) box(ctx, 0.08, 0.82, 0.9, 0xcccccc, x, 0.41, -d / 2 + 1)
    for (const x of [-4.6, -3.4]) {
      box(ctx, 1.05, 0.65, 0.05, 0x1a1a22, x, 1.32, -d / 2 + 0.7)
      group.add(mesh(new THREE.PlaneGeometry(0.98, 0.58), new THREE.MeshStandardMaterial({ map: codeScreen(x > -4 ? 5 : 7), emissiveMap: codeScreen(x > -4 ? 5 : 7), emissive: 0xffffff, emissiveIntensity: 1.2 }), { x, y: 1.32, z: -d / 2 + 0.73, shadow: false }))
    }
    ctx.addCollider(-4, -d / 2 + 1, 1.6, 2)
    const dev = C.npc(ctx, 'rogue', -4, -d / 2 + 1.9, { rotY: Math.PI, anim: 'Sit_Chair_Idle', r: 0, greet: false })
    dev.object.position.y = 0.05
    box(ctx, 0.6, 0.45, 0.6, 0x2b2b33, -4, 0.22, -d / 2 + 2)
    // Canapé, tapis et table basse.
    box(ctx, 3, 0.5, 1, 0x4f6fd8, 3.5, 0.25, 2.6)
    box(ctx, 3, 0.8, 0.3, 0x3f5fc8, 3.5, 0.6, 3.05)
    ctx.addCollider(3.5, 2.7, 1.6, 1.2)
    group.add(mesh(new THREE.CylinderGeometry(1.8, 1.8, 0.02, 24), mat(0xff9a4a), { x: 3.5, y: 0.01, z: 0.8, shadow: false }))
    C.npc(ctx, 'mage', 2.6, 2.5, { keep: [], anim: 'Sit_Chair_Idle', rotY: Math.PI, r: 0, greet: false }).object.position.y = 0.4
    // Bibliothèque et plantes.
    box(ctx, 2.4, 2.4, 0.5, 0x8a5a32, w / 2 - 1.4, 1.2, -d / 2 + 0.35)
    const colors = [0xe74c3c, 0x2f6fd8, 0x27ae60, 0xffd34f, 0xb48cff]
    for (let r = 0; r < 3; r++) for (let i = 0; i < 7; i++) box(ctx, 0.2, 0.5, 0.3, colors[(r + i) % 5], w / 2 - 2.4 + i * 0.32, 0.5 + r * 0.75, -d / 2 + 0.4)
    ctx.addCollider(w / 2 - 1.4, -d / 2 + 0.4, 1.2, 3)
    for (const [x, z] of [[-w / 2 + 0.7, 3.5], [w / 2 - 0.7, 3.8]]) {
      group.add(mesh(new THREE.CylinderGeometry(0.3, 0.25, 0.5, 8), mat(0xd9cbe8), { x, y: 0.25, z }))
      group.add(mesh(new THREE.IcosahedronGeometry(0.55, 0), mat(0x3f9a4a), { x, y: 0.9, z }))
      ctx.addCollider(x, z, 0.5)
    }
    // Affiches de projets.
    for (const [x, t, bg, fg] of [[-w / 2 + 0.06, 'VELQORA', '#1a1530', '#ffb347'], [-w / 2 + 0.06, 'Remembeyes', '#ff7ab6', '#ffffff']].map((p, i) => [p[0], p[1], p[2], p[3], i])) {
      const z = t === 'VELQORA' ? -1.5 : 1
      const p = mesh(new THREE.PlaneGeometry(1.1, 1.45), poster(t, bg, fg), { x, y: 2, z, shadow: false })
      p.rotation.y = Math.PI / 2
      group.add(p)
    }
    // Néon « Code · Café · Commit » au-dessus du coin café.
    const neon = mesh(new THREE.PlaneGeometry(3, 0.6), new THREE.MeshBasicMaterial({ map: textTexture('Code · Café · Commit', { bg: '#1a1530', fg: '#ff9ad9', font: 'bold 46px sans-serif' }) }), { x: w / 2 - 0.05, y: 2.6, z: 0.8, shadow: false })
    neon.rotation.y = -Math.PI / 2
    group.add(neon)
  },

  base(ctx, w, d) {
    const { group } = ctx
    // Hublot panoramique sur les étoiles et la Terre.
    const stars = canvasTexture(512, 160, (g, W, H) => {
      g.fillStyle = '#05061a'
      g.fillRect(0, 0, W, H)
      for (let i = 0; i < 160; i++) {
        g.fillStyle = `rgba(255,255,255,${Math.random()})`
        g.fillRect(Math.random() * W, Math.random() * H, 2, 2)
      }
      const earth = g.createRadialGradient(380, 70, 5, 380, 70, 46)
      earth.addColorStop(0, '#7ad0ff')
      earth.addColorStop(0.7, '#2f6fd8')
      earth.addColorStop(1, '#0b1a40')
      g.fillStyle = earth
      g.beginPath()
      g.arc(380, 70, 46, 0, Math.PI * 2)
      g.fill()
      g.fillStyle = '#3ddc84'
      g.beginPath()
      g.arc(368, 60, 14, 0, Math.PI * 2)
      g.fill()
    })
    group.add(mesh(new THREE.PlaneGeometry(9, 2.2), new THREE.MeshStandardMaterial({ map: stars, emissiveMap: stars, emissive: 0xffffff, emissiveIntensity: 1 }), { y: 2.1, z: -d / 2 + 0.02, shadow: false }))
    box(ctx, 9.3, 0.2, 0.2, 0xcfd3e0, 0, 3.25, -d / 2 + 0.1)
    box(ctx, 9.3, 0.2, 0.2, 0xcfd3e0, 0, 0.95, -d / 2 + 0.1)
    // Bandes lumineuses au sol.
    for (const x of [-2, 2]) {
      const strip = mesh(new THREE.BoxGeometry(0.12, 0.02, d - 1), mat(0x7df9ff, { emissive: 0x3ad0ff, emissiveIntensity: 2 }), { x, y: 0.02, z: 0.5, shadow: false })
      group.add(strip)
    }
    // Couchettes et serre hydroponique.
    for (const z of [-2, 1]) {
      box(ctx, 1.2, 0.5, 2.4, 0xcfd3e0, -w / 2 + 1, 0.25, z)
      box(ctx, 1.1, 0.15, 2.2, 0x6a5cff, -w / 2 + 1, 0.55, z)
      ctx.addCollider(-w / 2 + 1, z, 1.3, 1)
    }
    for (let i = 0; i < 4; i++) {
      const x = w / 2 - 1
      const z = -3.5 + i * 1.6
      box(ctx, 1.2, 0.6, 1.2, 0x3a3d55, x, 0.3, z)
      group.add(mesh(new THREE.IcosahedronGeometry(0.45, 0), mat(0x3ddc84, { emissive: 0x1a8a4a, emissiveIntensity: 0.5 }), { x, y: 0.9, z }))
      ctx.addCollider(x, z, 0.8, 1.5)
    }
    box(ctx, 0.1, 0.1, 6.4, 0xb48cff, w / 2 - 0.4, 2.4, -1, { emissive: 0xb48cff, emissiveIntensity: 2.5 })
    // Équipage.
    for (const [x, z, route] of [[-3, 2, [[-3, 2], [2, 2.5], [0, -2]]], [3, -3, [[3, -3], [4, 1]]]]) {
      const a = C.npc(ctx, 'knight', x, z, { keep: [], path: route, walk: 0.9, pause: 3 })
      C.spaceSuit(a.object)
    }
    const pilot = C.npc(ctx, 'rogue', 2.5, -d / 2 + 1.6, { rotY: Math.PI, anim: 'Interact', speed: 0.6, r: 0, greet: false })
    C.spaceSuit(pilot.object)
    box(ctx, 2.2, 1, 0.7, 0x3a3d55, 2.5, 0.5, -d / 2 + 0.8, { metalness: 0.5 })
    ctx.addCollider(2.5, -d / 2 + 0.8, 1.2, 2)
  },
}
