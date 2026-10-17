import * as THREE from 'three'
import { mergeStatic } from './merge.js'
import { mat, mesh } from './helpers.js'
import { canvasTexture, codeScreen } from './points.js'
import { npc } from './characters.js'
import { model } from './models.js'
import { THEMES } from './islands.js'
import { satellites as pastSats } from './eras/past.js'
import { satellites as presentSats } from './eras/present.js'
import { satellites as futureSats } from './eras/future.js'
import { drawVisual } from './screens.js'

// Lieux de projets : une petite scène par groupe de projets, comme une salle d'exposition.
// Au fond, un grand écran montre le projet courant (image, titre, technologies) avec les
// miniatures des autres en bas. Devant, deux dalles fléchées au sol font défiler les projets
// quand on marche dessus, et E ouvre la fiche détaillée. Autour, un décor propre au lieu.

const SATS = { past: pastSats, present: presentSats, future: futureSats }
const SCREEN_W = 1280
const SCREEN_H = 800

const STYLE = {
  library: { accent: '#ffb347', ink: '#fbe9c8', bg: '#22182e', frame: 0x5a3a22, trim: 0xc8a050, light: 0xffb347, chalk: true },
  tavern: { accent: '#ff8a5c', ink: '#fff1dc', bg: '#2a1a14', frame: 0x6b4428, trim: 0x3a2a1a, light: 0xffa04a, chalk: true },
  workshop: { accent: '#6fd3ff', ink: '#ffffff', bg: '#141a2e', frame: 0x23233a, trim: 0x6fd3ff, light: 0xffd9a8, chalk: false },
  lab: { accent: '#7df9ff', ink: '#e9fbff', bg: '#0c0a24', frame: 0x2a2950, trim: 0x7df9ff, light: 0x7df9ff, chalk: false },
}

export function createShowcases(scene, world, { places, ui, sfx }) {
  const list = places.map((place) => buildPlace(scene, world, place, { ui, sfx }))
  return {
    places: list,
    interactables: list.map((p) => p.interactable),
    update(dt, t, player) {
      for (const p of list) p.update(dt, t, player)
    },
  }
}

function placeCenter(place) {
  const base = THEMES[place.era].center.clone()
  if (place.sat) {
    const [ox, oz] = SATS[place.era][place.sat].offset
    base.x += ox
    base.z += oz
  }
  return { base, center: new THREE.Vector3(base.x + place.at[0], 0, base.z + place.at[1]) }
}

function buildPlace(scene, world, place, { ui, sfx }) {
  const style = STYLE[place.theme]
  const { base, center } = placeCenter(place)
  const y0 = world.groundAt(center.x, center.z, Infinity, true) ?? 0
  center.y = y0
  // L'écran fait face à la caméra (vers le sud), légèrement tourné vers le centre de l'île.
  // On arrive par l'arrière en longeant les côtés, laissés libres.
  const side = base.x - center.x
  const facing = place.facing ?? (Math.abs(side) > 3 ? Math.sign(side) * 0.35 : 0)
  const group = new THREE.Group()
  group.position.copy(center)
  group.rotation.y = facing
  scene.add(group)
  const cos = Math.cos(facing)
  const sin = Math.sin(facing)
  const toWorld = (x, z) => ({ x: center.x + x * cos + z * sin, z: center.z - x * sin + z * cos })
  const toLocal = (x, z) => {
    const dx = x - center.x
    const dz = z - center.z
    return { x: dx * cos - dz * sin, z: dx * sin + dz * cos }
  }
  const col = (x, z, r, top = 2.5) => {
    const p = toWorld(x, z)
    world.colliders.push({ x: p.x, z: p.z, r, top: y0 + top })
  }
  const animated = []
  const add = (object) => {
    group.add(object)
    return object
  }

  // ---------- Écran ----------
  let index = 0
  const projects = place.projects
  let texture = null
  const redraw = () => {
    const canvas = texture.image
    drawScreen(canvas.getContext('2d'), place, style, index, redraw)
    texture.needsUpdate = true
  }
  texture = canvasTexture(SCREEN_W, SCREEN_H, () => {})
  texture.anisotropy = 8
  redraw()
  const screenW = 5.8
  const screenH = screenW * (SCREEN_H / SCREEN_W)
  const screenY = 0.95 + screenH / 2
  const screenZ = -3.2
  const screenMat = new THREE.MeshBasicMaterial({ map: texture })
  screenMat.color.setScalar(0.82)
  const screen = mesh(new THREE.PlaneGeometry(screenW, screenH), screenMat, { y: screenY, z: screenZ + 0.13, shadow: false })
  add(screen)
  buildFrame(add, place.theme, style, screenW, screenH, screenY, screenZ, animated)
  col(-screenW / 2 + 0.2, screenZ, 0.5, 6)
  col(screenW / 2 - 0.2, screenZ, 0.5, 6)
  col(0, screenZ, 0.6, 6)
  col(-1.4, screenZ, 0.6, 6)
  col(1.4, screenZ, 0.6, 6)

  // Lueur de l'écran sur la scène.
  const glow = new THREE.PointLight(style.light, 5, 10)
  glow.position.set(0, 3, -1)
  add(glow)

  // ---------- Tapis ----------
  const rug = mesh(new THREE.PlaneGeometry(6.4, 4.4), new THREE.MeshStandardMaterial({ map: rugTexture(place.theme, style), roughness: 1 }), { y: 0.19, z: 0.9, shadow: false })
  rug.rotation.x = -Math.PI / 2
  rug.receiveShadow = true
  add(rug)

  // ---------- Dalles fléchées ----------
  const pads = [-1, 1].map((dir) => {
    const padMat = new THREE.MeshBasicMaterial({ map: padTexture(dir, style), transparent: true })
    padMat.color.setScalar(0.8)
    const pad = mesh(new THREE.CircleGeometry(0.75, 32), padMat, { x: dir * 2.5, y: 0.22, z: 1.5, shadow: false })
    pad.rotation.x = -Math.PI / 2
    add(pad)
    add(mesh(new THREE.CylinderGeometry(0.85, 0.92, 0.1, 32), mat(style.frame), { x: dir * 2.5, y: 0.16, z: 1.5 }))
    // Flèche flottante au-dessus de la dalle.
    const arrow = mesh(arrowGeometry(), new THREE.MeshStandardMaterial({ color: style.accent, emissive: style.accent, emissiveIntensity: 0.9 }), { x: dir * 2.5, y: 1.3, z: 1.5, shadow: false })
    arrow.rotation.y = dir > 0 ? 0 : Math.PI
    add(arrow)
    return { dir, pad, padMat, arrow, inside: false, flash: 0 }
  })

  // ---------- Panneau des commandes ----------
  const board = buildBoard(place.theme, style)
  board.position.set(-6.1, 0, -0.2)
  board.rotation.y = 1.1
  add(board)
  col(-6.1, -0.2, 0.6)

  // ---------- Décor du lieu ----------
  const ctx = { add, col, animated, center, y0, toWorld, scene }
  DECOR[place.theme](ctx, style)

  // ---------- Titre flottant ----------
  const title = new THREE.Sprite(new THREE.SpriteMaterial({ map: titleTexture(place, style), depthWrite: false }))
  const titleW = Math.min(6.4, 1.6 + place.title.length * 0.2)
  title.scale.set(titleW, titleW * (150 / 760), 1)
  const titleY = screenY + screenH / 2 + (style.chalk ? 1.9 : 1.1)
  title.position.set(0, titleY, screenZ)
  add(title)

  // ---------- Interaction ----------
  const front = toWorld(0, 1.3)
  const stand = toWorld(0, 2.6)
  const interactable = {
    type: 'sign',
    x: front.x,
    z: front.z,
    r: 1.8,
    era: place.era,
    icon: place.icon,
    title: place.title,
    kicker: place.kicker,
    text: [place.text, ...projects.map((p) => `${p.title} : ${p.tagline}.`)],
    links: projects.flatMap((p) => p.links.slice(0, 1)),
    stand: new THREE.Vector3(stand.x, y0, stand.z),
    showcase: null,
  }

  function open() {
    const p = projects[index]
    ui.openPanel({
      title: p.title,
      icon: place.icon,
      kicker: place.title,
      era: place.era,
      text: p.text,
      tags: p.tech,
      side: true,
      links: p.links.map((l, i) => ({ ...l, primary: i === 0 })),
      count: `${place.kicker}`,
      nav: { label: `Projet ${index + 1} / ${projects.length}`, prev: () => step(-1, true), next: () => step(1, true) },
    })
  }

  function step(dir, reopen = false) {
    index = (index + dir + projects.length) % projects.length
    redraw()
    sfx?.blip('whoosh')
    const pad = pads.find((p) => p.dir === dir)
    if (pad) pad.flash = 1
    if (reopen && ui.panelOpen()) open()
  }

  const api = {
    place,
    open,
    step,
    get index() {
      return index
    },
    get project() {
      return projects[index]
    },
  }
  interactable.showcase = api
  // Décor fixe fusionné (les écrans, dont l'image change, restent à part).
  mergeStatic(group, animated, { noMaps: true })
  world.addRegion?.(group, center.x, center.z, 9)

  return {
    interactable,
    api,
    update(dt, t, player) {
      for (const fn of animated) fn(dt, t)
      // Marcher sur une dalle fléchée fait défiler les projets (une fois par passage).
      const local = toLocal(player.position.x, player.position.z)
      const near = Math.abs(player.position.y - y0) < 1.5
      for (const pad of pads) {
        const inside = near && Math.hypot(local.x - pad.dir * 2.5, local.z - 1.5) < 0.8
        if (inside && !pad.inside && !ui.panelOpen()) step(pad.dir)
        pad.inside = inside
        pad.flash = Math.max(0, pad.flash - dt * 2.5)
        const k = 0.75 + Math.sin(t * 3 + pad.dir) * 0.08 + pad.flash * 0.5 + (inside ? 0.2 : 0)
        pad.padMat.color.setScalar(Math.min(1.4, k))
        pad.arrow.position.x = pad.dir * (2.5 + Math.sin(t * 3) * 0.12)
        pad.arrow.position.y = 1.3 + Math.sin(t * 2 + pad.dir) * 0.08 + pad.flash * 0.25
      }
      title.position.y = titleY + Math.sin(t * 1.3) * 0.08
    },
  }
}

// ---------- Contenu de l'écran ----------

function drawScreen(g, place, style, index, redraw) {
  const W = SCREEN_W
  const H = SCREEN_H
  const projects = place.projects
  const p = projects[index]
  g.fillStyle = style.bg
  g.fillRect(0, 0, W, H)
  // Grande image du projet.
  const ix = 40
  const iy = 36
  const iw = W - 80
  const ih = 560
  g.save()
  g.beginPath()
  g.roundRect(ix, iy, iw, ih, 22)
  g.clip()
  drawVisual(g, p, ix, iy, iw, ih, redraw)
  // Dégradé en bas pour lire le titre.
  const grad = g.createLinearGradient(0, iy + ih - 230, 0, iy + ih)
  grad.addColorStop(0, 'rgba(0,0,0,0)')
  grad.addColorStop(1, 'rgba(8,6,20,0.92)')
  g.fillStyle = grad
  g.fillRect(ix, iy + ih - 230, iw, 230)
  g.restore()
  g.lineWidth = 4
  g.strokeStyle = style.accent
  g.beginPath()
  g.roundRect(ix, iy, iw, ih, 22)
  g.stroke()
  // Titre, accroche et technologies.
  g.textBaseline = 'alphabetic'
  g.textAlign = 'left'
  g.fillStyle = '#ffffff'
  g.font = 'bold 68px "Inter Variable", system-ui, sans-serif'
  g.fillText(p.title, ix + 44, iy + ih - 92)
  g.font = '32px "Inter Variable", system-ui, sans-serif'
  g.fillStyle = 'rgba(255,255,255,0.85)'
  g.fillText(p.tagline, ix + 46, iy + ih - 46)
  let tx = ix + iw - 40
  g.font = 'bold 24px "Inter Variable", system-ui, sans-serif'
  for (const tech of [...p.tech].reverse().slice(0, 3)) {
    const w = g.measureText(tech).width + 32
    tx -= w
    g.beginPath()
    g.roundRect(tx, iy + ih - 76, w, 42, 21)
    g.fillStyle = 'rgba(255,255,255,0.14)'
    g.fill()
    g.fillStyle = '#ffffff'
    g.fillText(tech, tx + 16, iy + ih - 47)
    tx -= 10
  }
  // Compteur en haut à droite.
  g.beginPath()
  g.roundRect(ix + iw - 150, iy + 22, 128, 52, 26)
  g.fillStyle = 'rgba(8,6,20,0.75)'
  g.fill()
  g.fillStyle = style.accent
  g.font = 'bold 30px "Inter Variable", system-ui, sans-serif'
  g.textAlign = 'center'
  g.fillText(`${index + 1} / ${projects.length}`, ix + iw - 86, iy + 58)
  // Flèches sur les côtés de l'image.
  for (const dir of [-1, 1]) {
    const cx = dir < 0 ? ix + 50 : ix + iw - 50
    const cy = iy + ih / 2 - 30
    g.beginPath()
    g.arc(cx, cy, 34, 0, Math.PI * 2)
    g.fillStyle = 'rgba(8,6,20,0.7)'
    g.fill()
    g.strokeStyle = style.accent
    g.lineWidth = 3
    g.stroke()
    g.fillStyle = '#ffffff'
    g.font = 'bold 44px "Inter Variable", system-ui, sans-serif'
    g.fillText(dir < 0 ? '‹' : '›', cx - dir * 2, cy + 15)
  }
  // Miniatures des projets du lieu.
  const tw = 170
  const th = 106
  const gap = 18
  const total = projects.length * tw + (projects.length - 1) * gap
  let x = (W - total) / 2
  const y = iy + ih + 26
  projects.forEach((q, i) => {
    g.save()
    g.beginPath()
    g.roundRect(x, y, tw, th, 12)
    g.clip()
    drawVisual(g, q, x, y, tw, th, redraw)
    if (i !== index) {
      g.fillStyle = 'rgba(8,6,20,0.55)'
      g.fillRect(x, y, tw, th)
    }
    g.restore()
    g.beginPath()
    g.roundRect(x, y, tw, th, 12)
    g.lineWidth = i === index ? 6 : 2
    g.strokeStyle = i === index ? style.accent : 'rgba(255,255,255,0.25)'
    g.stroke()
    x += tw + gap
  })
  g.textAlign = 'left'
}

// ---------- Textures ----------

function titleTexture(place, style) {
  return canvasTexture(760, 150, (g, w, h) => {
    g.beginPath()
    g.roundRect(8, 8, w - 16, h - 16, 40)
    g.fillStyle = 'rgba(26, 20, 52, 0.92)'
    g.fill()
    g.lineWidth = 6
    g.strokeStyle = style.accent
    g.stroke()
    g.fillStyle = '#ffffff'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    let size = 62
    do {
      g.font = `bold ${size}px "Outfit Variable", "Inter Variable", sans-serif`
      size -= 2
    } while (g.measureText(`${place.icon} ${place.title}`).width > w - 70)
    g.fillText(`${place.icon} ${place.title}`, w / 2, h / 2 + 2)
  })
}

function padTexture(dir, style) {
  return canvasTexture(256, 256, (g, w, h) => {
    const grad = g.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w / 2)
    grad.addColorStop(0, style.accent)
    grad.addColorStop(0.75, 'rgba(20,14,40,0.95)')
    grad.addColorStop(1, 'rgba(20,14,40,0)')
    g.fillStyle = grad
    g.beginPath()
    g.arc(w / 2, h / 2, w / 2, 0, Math.PI * 2)
    g.fill()
    g.lineWidth = 8
    g.strokeStyle = style.accent
    g.beginPath()
    g.arc(w / 2, h / 2, w / 2 - 14, 0, Math.PI * 2)
    g.stroke()
    g.fillStyle = '#ffffff'
    g.beginPath()
    g.moveTo(w / 2 + dir * 54, h / 2)
    g.lineTo(w / 2 - dir * 34, h / 2 - 56)
    g.lineTo(w / 2 - dir * 34, h / 2 + 56)
    g.closePath()
    g.fill()
  })
}

function rugTexture(theme, style) {
  const palettes = {
    library: ['#6b2337', '#8e3348', '#d7a24a'],
    tavern: ['#7a3b1f', '#a4552a', '#f0c27a'],
    workshop: ['#2b3350', '#3b4670', '#6fd3ff'],
    lab: ['#16143a', '#221f55', '#7df9ff'],
  }
  const [a, b, c] = palettes[theme]
  return canvasTexture(512, 352, (g, w, h) => {
    g.fillStyle = a
    g.fillRect(0, 0, w, h)
    g.strokeStyle = c
    g.lineWidth = 6
    g.strokeRect(18, 18, w - 36, h - 36)
    g.fillStyle = b
    g.fillRect(36, 36, w - 72, h - 72)
    if (theme === 'lab' || theme === 'workshop') {
      g.strokeStyle = c
      g.globalAlpha = 0.25
      g.lineWidth = 2
      for (let x = 36; x < w - 36; x += 32) {
        g.beginPath()
        g.moveTo(x, 36)
        g.lineTo(x, h - 36)
        g.stroke()
      }
      for (let y = 36; y < h - 36; y += 32) {
        g.beginPath()
        g.moveTo(36, y)
        g.lineTo(w - 36, y)
        g.stroke()
      }
      g.globalAlpha = 1
    } else {
      g.fillStyle = c
      for (let i = 0; i < 5; i++) {
        g.save()
        g.translate(w / 2, h / 2)
        g.rotate(Math.PI / 4)
        const s = 120 - i * 22
        g.globalAlpha = i % 2 ? 0.35 : 0.8
        g.fillRect(-s / 2, -s / 2, s, s)
        g.restore()
      }
      g.globalAlpha = 1
      for (let x = 60; x < w - 40; x += 40) {
        g.fillRect(x, 50, 14, 14)
        g.fillRect(x, h - 64, 14, 14)
      }
    }
    // Franges.
    g.fillStyle = c
    for (let y = 4; y < h; y += 10) {
      g.fillRect(0, y, 10, 4)
      g.fillRect(w - 10, y, 10, 4)
    }
  })
}

function arrowGeometry() {
  const s = new THREE.Shape()
  s.moveTo(0.45, 0)
  s.lineTo(-0.1, 0.38)
  s.lineTo(-0.1, 0.16)
  s.lineTo(-0.42, 0.16)
  s.lineTo(-0.42, -0.16)
  s.lineTo(-0.1, -0.16)
  s.lineTo(-0.1, -0.38)
  s.closePath()
  const geo = new THREE.ExtrudeGeometry(s, { depth: 0.12, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 1 })
  geo.translate(0, 0, -0.06)
  return geo
}

// Panneau des commandes, façon ardoise de taverne ou tableau blanc.
function buildBoard(theme, style) {
  const g = new THREE.Group()
  const lines = [['◀', 'Projet précédent'], ['▶', 'Projet suivant'], ['E', 'Ouvrir la fiche'], ['Échap', 'Fermer']]
  const tex = canvasTexture(512, 400, (c, w, h) => {
    c.fillStyle = style.chalk ? '#2b2f2c' : theme === 'lab' ? '#0f0d2a' : '#f4f6fb'
    c.fillRect(0, 0, w, h)
    const ink = style.chalk ? '#f2efe6' : theme === 'lab' ? '#7df9ff' : '#1d2b4a'
    c.fillStyle = ink
    c.strokeStyle = ink
    c.font = style.chalk ? 'bold 46px "Comic Sans MS", "Chalkboard SE", cursive' : 'bold 44px "Inter Variable", system-ui, sans-serif'
    c.textBaseline = 'middle'
    c.textAlign = 'center'
    c.fillText('Commandes', w / 2, 56)
    c.textAlign = 'left'
    c.font = style.chalk ? '34px "Comic Sans MS", "Chalkboard SE", cursive' : '32px "Inter Variable", system-ui, sans-serif'
    lines.forEach(([key, label], i) => {
      const y = 130 + i * 70
      c.lineWidth = 3
      c.beginPath()
      c.roundRect(30, y - 26, 110, 52, 12)
      c.stroke()
      c.textAlign = 'center'
      c.fillText(key, 85, y + 2)
      c.textAlign = 'left'
      c.fillText(label, 162, y + 2)
    })
  })
  const frameMat = mat(style.frame)
  const w = 1.6
  const h = 1.25
  g.add(mesh(new THREE.BoxGeometry(w + 0.16, h + 0.16, 0.08), frameMat, { y: 1.55 }))
  const face = mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: theme === 'lab' ? 0.6 : 0.15 }), { y: 1.55, z: 0.045 })
  g.add(face)
  for (const s of [-1, 1]) {
    const leg = mesh(new THREE.BoxGeometry(0.08, 1.6, 0.08), frameMat, { x: s * 0.62, y: 0.8, z: -0.12 })
    leg.rotation.x = 0.12
    g.add(leg)
  }
  const back = mesh(new THREE.BoxGeometry(0.08, 1.7, 0.08), frameMat, { y: 0.85, z: -0.5 })
  back.rotation.x = -0.3
  g.add(back)
  return g
}

// ---------- Cadres d'écran ----------

function buildFrame(add, theme, style, w, h, y, z, animated) {
  const frame = mat(style.frame)
  const trim = mat(style.trim, theme === 'lab' || theme === 'workshop' ? { emissive: style.trim, emissiveIntensity: 1.4 } : {})
  if (theme === 'library' || theme === 'tavern') {
    // Grand cadre en bois sur deux poteaux, avec fronton.
    add(mesh(new THREE.BoxGeometry(w + 0.5, h + 0.5, 0.22), frame, { y, z }))
    for (const s of [-1, 1]) {
      add(mesh(new THREE.BoxGeometry(0.34, y + h / 2 + 0.6, 0.34), frame, { x: s * (w / 2 + 0.35), y: (y + h / 2 + 0.6) / 2, z }))
      add(mesh(new THREE.SphereGeometry(0.24, 8, 6), trim, { x: s * (w / 2 + 0.35), y: y + h / 2 + 0.75, z }))
    }
    add(mesh(new THREE.BoxGeometry(w + 1.2, 0.26, 0.5), frame, { y: y + h / 2 + 0.35, z }))
    if (theme === 'library') {
      // Fronton triangulaire.
      const tri = new THREE.Shape()
      tri.moveTo(-(w + 1.2) / 2, 0)
      tri.lineTo((w + 1.2) / 2, 0)
      tri.lineTo(0, 0.9)
      tri.closePath()
      const ped = mesh(new THREE.ExtrudeGeometry(tri, { depth: 0.4, bevelEnabled: false }), mat(0x6b2337), { y: y + h / 2 + 0.48, z: z - 0.2 })
      add(ped)
    } else {
      // Enseigne suspendue de la taverne.
      const sign = canvasTexture(512, 128, (g, cw, ch) => {
        g.fillStyle = '#6b4428'
        g.fillRect(0, 0, cw, ch)
        g.strokeStyle = '#f0c27a'
        g.lineWidth = 8
        g.strokeRect(8, 8, cw - 16, ch - 16)
        g.fillStyle = '#f0c27a'
        g.font = 'bold 54px "Outfit Variable", "Inter Variable", sans-serif'
        g.textAlign = 'center'
        g.textBaseline = 'middle'
        g.fillText('Val d\'Hérens', cw / 2, ch / 2 + 2)
      })
      add(mesh(new THREE.PlaneGeometry(2.4, 0.6), new THREE.MeshStandardMaterial({ map: sign }), { y: y + h / 2 + 0.85, z: z + 0.26 }))
    }
    // Bougeoirs de part et d'autre.
    for (const s of [-1, 1]) {
      const flame = mesh(new THREE.SphereGeometry(0.09, 6, 5), new THREE.MeshBasicMaterial({ color: 0xffd27a }), { x: s * (w / 2 + 0.35), y: y - 0.2, z: z + 0.35, shadow: false })
      add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.25, 6), mat(0xf4ead2), { x: s * (w / 2 + 0.35), y: y - 0.4, z: z + 0.35 }))
      add(flame)
      animated.push((dt, t) => flame.scale.setScalar(1 + Math.sin(t * 12 + s) * 0.15))
    }
  } else if (theme === 'workshop') {
    // Écran fin sur pied métallique, liseré lumineux.
    add(mesh(new THREE.BoxGeometry(w + 0.24, h + 0.24, 0.18), frame, { y, z }))
    add(mesh(new THREE.BoxGeometry(w + 0.3, 0.05, 0.05), trim, { y: y - h / 2 - 0.14, z: z + 0.1, shadow: false }))
    add(mesh(new THREE.BoxGeometry(0.3, y - h / 2 + 0.1, 0.2), mat(0x8a8fa8, { metalness: 0.6, roughness: 0.4 }), { y: (y - h / 2) / 2, z: z - 0.05 }))
    add(mesh(new THREE.BoxGeometry(2.2, 0.08, 1), mat(0x8a8fa8, { metalness: 0.6, roughness: 0.4 }), { y: 0.24, z }))
  } else {
    // Labo : écran flottant cerclé de néon, au-dessus d'un socle à anneaux.
    add(mesh(new THREE.BoxGeometry(w + 0.18, h + 0.18, 0.1), frame, { y, z }))
    for (const [dx, dy, sw, sh] of [[0, h / 2 + 0.12, w + 0.3, 0.05], [0, -h / 2 - 0.12, w + 0.3, 0.05], [w / 2 + 0.12, 0, 0.05, h + 0.3], [-w / 2 - 0.12, 0, 0.05, h + 0.3]]) {
      add(mesh(new THREE.BoxGeometry(sw, sh, 0.05), trim, { x: dx, y: y + dy, z: z + 0.08, shadow: false }))
    }
    add(mesh(new THREE.CylinderGeometry(1.4, 1.6, 0.3, 24), mat(0x3a3866), { y: 0.3, z }))
    const ring = mesh(new THREE.TorusGeometry(1.2, 0.04, 6, 40), trim, { y: 0.55, z, shadow: false })
    ring.rotation.x = Math.PI / 2
    add(ring)
    const beam = mesh(new THREE.CylinderGeometry(0.15, 0.4, y - h / 2, 12, 1, true), new THREE.MeshBasicMaterial({ color: style.trim, transparent: true, opacity: 0.25, depthWrite: false }), { y: (y - h / 2) / 2 + 0.3, z, shadow: false })
    add(beam)
    animated.push((dt, t) => {
      ring.scale.setScalar(1 + Math.sin(t * 2) * 0.05)
      beam.material.opacity = 0.18 + Math.sin(t * 3) * 0.06
    })
  }
}

// ---------- Décors ----------

function lanternPost(ctx, x, z, { color = 0xffb347, h = 2.4 } = {}) {
  const { add, col } = ctx
  add(mesh(new THREE.BoxGeometry(0.3, 0.2, 0.3), mat(0x2b2440), { x, y: 0.1, z }))
  add(mesh(new THREE.CylinderGeometry(0.06, 0.08, h, 6), mat(0x2b2440), { x, y: h / 2, z }))
  add(mesh(new THREE.BoxGeometry(0.4, 0.48, 0.4), mat(0x2b2440), { x, y: h + 0.25, z }))
  add(mesh(new THREE.BoxGeometry(0.3, 0.38, 0.42), mat(0xffd27a, { emissive: color, emissiveIntensity: 2.6 }), { x, y: h + 0.25, z, shadow: false }))
  add(mesh(new THREE.ConeGeometry(0.34, 0.28, 4).rotateY(Math.PI / 4), mat(0x2b2440), { x, y: h + 0.63, z }))
  col(x, z, 0.3, 3)
}

function woodBench(ctx, x, z, rotY = 0, length = 2) {
  const g = new THREE.Group()
  const wood = mat(0x7a5232)
  g.add(mesh(new THREE.BoxGeometry(length, 0.12, 0.45), wood, { y: 0.48 }))
  for (const s of [-1, 1]) g.add(mesh(new THREE.BoxGeometry(0.12, 0.46, 0.4), mat(0x5a3a22), { x: s * (length / 2 - 0.2), y: 0.23 }))
  g.position.set(x, 0, z)
  g.rotation.y = rotY
  ctx.add(g)
  ctx.col(x, z, length * 0.4, 0.8)
}

function table(ctx, x, z, { w = 1.8, d = 0.9, rotY = 0, color = 0x7a5232 } = {}) {
  const g = new THREE.Group()
  g.add(mesh(new THREE.BoxGeometry(w, 0.1, d), mat(color), { y: 0.82 }))
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(mesh(new THREE.BoxGeometry(0.1, 0.8, 0.1), mat(0x4a3020), { x: sx * (w / 2 - 0.1), y: 0.4, z: sz * (d / 2 - 0.1) }))
  g.position.set(x, 0, z)
  g.rotation.y = rotY
  ctx.add(g)
  ctx.col(x, z, Math.max(w, d) * 0.5, 1)
  return g
}

function books(group, x, y, z, count = 4, rotY = 0) {
  const colors = [0x8e3348, 0x2f4e8c, 0x3f7d4a, 0xd7a24a, 0x6b3f8c]
  for (let i = 0; i < count; i++) {
    const b = mesh(new THREE.BoxGeometry(0.34, 0.07, 0.24), mat(colors[i % colors.length]), { x, y: y + 0.035 + i * 0.075, z })
    b.rotation.y = rotY + (i % 2 ? 0.25 : -0.15)
    group.add(b)
  }
}

function bookshelf(ctx, x, z, rotY = 0) {
  const g = new THREE.Group()
  const wood = mat(0x5a3a22)
  g.add(mesh(new THREE.BoxGeometry(1.8, 2.6, 0.5), wood, { y: 1.3, z: -0.05 }))
  const colors = [0x8e3348, 0x2f4e8c, 0x3f7d4a, 0xd7a24a, 0x6b3f8c, 0xc0392b, 0x1f6f6a]
  let seed = Math.abs(x * 13 + z * 7)
  const rnd = () => ((seed = (seed * 16807 + 11) % 2147483647) / 2147483647)
  for (let row = 0; row < 4; row++) {
    const y = 0.25 + row * 0.6
    g.add(mesh(new THREE.BoxGeometry(1.7, 0.05, 0.42), mat(0x7a5232), { y, z: 0.05 }))
    let bx = -0.78
    while (bx < 0.72) {
      const bw = 0.07 + rnd() * 0.07
      const bh = 0.36 + rnd() * 0.16
      const book = mesh(new THREE.BoxGeometry(bw, bh, 0.3), mat(colors[Math.floor(rnd() * colors.length)]), { x: bx + bw / 2, y: y + 0.025 + bh / 2, z: 0.1 })
      if (rnd() < 0.08) book.rotation.z = 0.3
      g.add(book)
      bx += bw + 0.01
    }
  }
  g.position.set(x, 0, z)
  g.rotation.y = rotY
  ctx.add(g)
  ctx.col(x, z, 0.95, 3)
}

function cauldron(ctx, x, z) {
  const { add, col, animated } = ctx
  const pot = mesh(new THREE.SphereGeometry(0.6, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.62), mat(0x2b2b33, { roughness: 0.6, side: THREE.DoubleSide }), { x, y: 0.7, z })
  pot.rotation.x = Math.PI
  add(pot)
  const brew = mesh(new THREE.CircleGeometry(0.5, 20), new THREE.MeshBasicMaterial({ color: 0x7dff9a }), { x, y: 0.88, z, shadow: false })
  brew.rotation.x = -Math.PI / 2
  add(brew)
  for (const a of [0, 2.1, 4.2]) add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.5, 5), mat(0x2b2b33), { x: x + Math.cos(a) * 0.45, y: 0.25, z: z + Math.sin(a) * 0.45 }))
  // Braises et bulles.
  add(mesh(new THREE.ConeGeometry(0.35, 0.35, 6), mat(0xff6b2b, { emissive: 0xff4b1b, emissiveIntensity: 2 }), { x, y: 0.2, z, shadow: false }))
  const light = new THREE.PointLight(0x7dff9a, 3, 4)
  light.position.set(x, 1.4, z)
  add(light)
  const bubbles = [0, 1, 2, 3, 4].map((i) => {
    const b = mesh(new THREE.SphereGeometry(0.07, 6, 5), new THREE.MeshBasicMaterial({ color: 0xb8ffc8, transparent: true }), { x, y: 1, z, shadow: false })
    add(b)
    return { b, phase: i / 5 }
  })
  animated.push((dt, t) => {
    for (const { b, phase } of bubbles) {
      const k = (t * 0.5 + phase) % 1
      b.position.set(x + Math.sin(phase * 20) * 0.25, 0.9 + k * 1.1, z + Math.cos(phase * 20) * 0.25)
      b.material.opacity = 1 - k
      b.scale.setScalar(0.6 + k)
    }
    light.intensity = 2.6 + Math.sin(t * 7) * 0.5
  })
  col(x, z, 0.7, 1.2)
}

function plantPot(ctx, x, z, { color = 0x3f9d5a, h = 1 } = {}) {
  ctx.add(mesh(new THREE.CylinderGeometry(0.28, 0.22, 0.45, 10), mat(0xd9d4e6), { x, y: 0.42, z }))
  for (let i = 0; i < 5; i++) {
    const leaf = mesh(new THREE.ConeGeometry(0.12, h * 0.9, 5), mat(color), { x: x + Math.cos(i * 1.3) * 0.1, y: 0.62 + h * 0.4, z: z + Math.sin(i * 1.3) * 0.1 })
    leaf.rotation.set(Math.cos(i * 1.3) * 0.35, 0, Math.sin(i * 1.3) * 0.35)
    ctx.add(leaf)
  }
  ctx.col(x, z, 0.35, 1.5)
}

function desk(ctx, x, z, rotY, seed) {
  const g = table(ctx, x, z, { w: 1.6, d: 0.8, rotY, color: 0xe8e4f0 })
  const screen = mesh(new THREE.PlaneGeometry(0.9, 0.56), new THREE.MeshStandardMaterial({ map: codeScreen(seed), emissive: 0xffffff, emissiveMap: codeScreen(seed), emissiveIntensity: 1 }), { y: 1.32, z: -0.18, shadow: false })
  g.add(mesh(new THREE.BoxGeometry(0.96, 0.62, 0.05), mat(0x23233a), { y: 1.32, z: -0.21 }))
  g.add(screen)
  g.add(mesh(new THREE.BoxGeometry(0.08, 0.3, 0.06), mat(0x8a8fa8), { y: 0.98, z: -0.24 }))
  g.add(mesh(new THREE.BoxGeometry(0.5, 0.02, 0.16), mat(0x3a3a4a), { y: 0.88, z: 0.12 }))
  g.add(mesh(new THREE.CylinderGeometry(0.05, 0.04, 0.1, 8), mat(0xff7ad9), { x: 0.6, y: 0.92, z: 0.1 }))
  // Chaise de bureau.
  const chair = new THREE.Group()
  chair.add(mesh(new THREE.BoxGeometry(0.5, 0.08, 0.5), mat(0x2f6fd8), { y: 0.5 }))
  chair.add(mesh(new THREE.BoxGeometry(0.5, 0.55, 0.08), mat(0x2f6fd8), { y: 0.8, z: 0.24 }))
  chair.add(mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.45, 6), mat(0x3a3a4a), { y: 0.25 }))
  chair.add(mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.04, 5), mat(0x3a3a4a), { y: 0.04 }))
  chair.position.set(0, 0, 0.75)
  chair.rotation.y = 0.3
  g.add(chair)
}

function beanbag(ctx, x, z, color) {
  const bag = mesh(new THREE.SphereGeometry(0.55, 12, 8), mat(color, { roughness: 1 }), { x, y: 0.38, z })
  bag.scale.set(1, 0.65, 1)
  ctx.add(bag)
  ctx.col(x, z, 0.55, 0.8)
}

function barrelStack(ctx, x, z) {
  const barrel = (bx, by, bz, lying = false) => {
    const b = mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.95, 12), mat(0x8a5a32), { x: bx, y: by, z: bz })
    for (const k of [-0.3, 0.3]) {
      const hoop = mesh(new THREE.TorusGeometry(0.43, 0.035, 4, 18), mat(0x3a3a40), { y: k })
      hoop.rotation.x = Math.PI / 2
      b.add(hoop)
    }
    if (lying) b.rotation.x = Math.PI / 2
    ctx.add(b)
  }
  barrel(x - 0.45, 0.42, z, true)
  barrel(x + 0.45, 0.42, z, true)
  barrel(x, 1.15, z, true)
  ctx.col(x, z, 1, 1.6)
}

function mug(group, x, y, z) {
  group.add(mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.16, 8), mat(0xd9c7a0), { x, y: y + 0.08, z }))
  group.add(mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.02, 8), mat(0xfff6e0), { x, y: y + 0.17, z }))
}

function valaisFlag(ctx, x, z) {
  const tex = canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = '#ffffff'
    g.fillRect(0, 0, w / 2, h)
    g.fillStyle = '#d6202f'
    g.fillRect(w / 2, 0, w / 2, h)
    // Les 13 étoiles du Valais.
    const star = (cx, cy, r, color) => {
      g.fillStyle = color
      g.beginPath()
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5
        const rr = i % 2 ? r * 0.45 : r
        g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr)
      }
      g.fill()
    }
    const pos = [[0.25, 0.12], [0.75, 0.12], [0.25, 0.27], [0.75, 0.27], [0.25, 0.42], [0.75, 0.42], [0.25, 0.57], [0.75, 0.57], [0.25, 0.72], [0.75, 0.72], [0.25, 0.87], [0.75, 0.87], [0.25, 0.5]]
    pos.slice(0, 12).forEach(([px, py], i) => star(px * w, py * h, 14, i % 2 ? '#ffffff' : '#d6202f'))
  })
  ctx.add(mesh(new THREE.CylinderGeometry(0.05, 0.06, 4, 6), mat(0x3a2a1a), { x, y: 2, z }))
  const flag = mesh(new THREE.PlaneGeometry(1.1, 1.1, 8, 1), new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide }), { x: x + 0.58, y: 3.4, z, shadow: false })
  ctx.add(flag)
  const p = flag.geometry.attributes.position
  const base = p.array.slice()
  ctx.animated.push((dt, t) => {
    for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(t * 3 + base[i * 3] * 4) * 0.08 * (base[i * 3] + 0.55))
    p.needsUpdate = true
  })
  ctx.col(x, z, 0.2, 4)
}

function holoPillar(ctx, x, z, color = 0x7df9ff) {
  const { add, col, animated } = ctx
  add(mesh(new THREE.CylinderGeometry(0.35, 0.45, 1, 8), mat(0x3a3866), { x, y: 0.5, z }))
  add(mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.05, 8), mat(color, { emissive: color, emissiveIntensity: 2 }), { x, y: 1.02, z, shadow: false }))
  const holo = mesh(new THREE.IcosahedronGeometry(0.32, 0), new THREE.MeshBasicMaterial({ color, wireframe: true }), { x, y: 1.6, z, shadow: false })
  add(holo)
  animated.push((dt, t) => {
    holo.rotation.y += dt
    holo.rotation.x += dt * 0.6
    holo.position.y = 1.6 + Math.sin(t * 2 + x) * 0.1
  })
  col(x, z, 0.45, 1.5)
}

function tube(ctx, x, z, color) {
  const { add, col, animated } = ctx
  add(mesh(new THREE.CylinderGeometry(0.32, 0.36, 0.25, 12), mat(0x3a3866), { x, y: 0.12, z }))
  add(mesh(new THREE.CylinderGeometry(0.32, 0.36, 0.2, 12), mat(0x3a3866), { x, y: 2.1, z }))
  add(mesh(new THREE.CylinderGeometry(0.28, 0.28, 1.8, 12, 1, true), new THREE.MeshStandardMaterial({ color: 0xbfe8ff, transparent: true, opacity: 0.25, roughness: 0.1 }), { x, y: 1.1, z, shadow: false }))
  const liquid = mesh(new THREE.CylinderGeometry(0.26, 0.26, 1.2, 12), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.75 }), { x, y: 0.85, z, shadow: false })
  add(liquid)
  const plant = mesh(new THREE.IcosahedronGeometry(0.16, 0), new THREE.MeshBasicMaterial({ color: 0xffffff }), { x, y: 1.1, z, shadow: false })
  add(plant)
  animated.push((dt, t) => {
    plant.position.y = 1.1 + Math.sin(t * 1.5 + x) * 0.25
    plant.rotation.y += dt
  })
  col(x, z, 0.4, 2.2)
}

function console3d(ctx, x, z, rotY, seed) {
  const g = new THREE.Group()
  g.add(mesh(new THREE.BoxGeometry(1.4, 0.95, 0.7), mat(0x3a3866), { y: 0.48 }))
  const top = mesh(new THREE.PlaneGeometry(1.3, 0.6), new THREE.MeshStandardMaterial({ map: codeScreen(seed), emissive: 0xffffff, emissiveMap: codeScreen(seed), emissiveIntensity: 1.1 }), { y: 0.99, z: 0, shadow: false })
  top.rotation.x = -Math.PI / 2 + 0.4
  g.add(top)
  g.position.set(x, 0, z)
  g.rotation.y = rotY
  ctx.add(g)
  ctx.col(x, z, 0.75, 1.2)
}

const DECOR = {
  // Bibliothèque médiévale : étagères, chaudron, table de lecture, bancs, lanternes.
  library(ctx) {
    bookshelf(ctx, -6.2, -2.6, 0.7)
    bookshelf(ctx, 6.2, -2.6, -0.7)
    cauldron(ctx, 6.2, 0.6)
    const t = table(ctx, -5.6, 2.6, { rotY: 0.5 })
    books(t, -0.4, 0.87, 0, 4, 0.2)
    books(t, 0.35, 0.87, 0.1, 2, -0.4)
    t.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.25, 6), mat(0xf4ead2), { x: 0.6, y: 1, z: -0.2 }))
    t.add(mesh(new THREE.SphereGeometry(0.06, 6, 5), new THREE.MeshBasicMaterial({ color: 0xffd27a }), { x: 0.6, y: 1.16, z: -0.2, shadow: false }))
    woodBench(ctx, -1.6, 4.4, 0)
    woodBench(ctx, 1.6, 4.4, 0)
    lanternPost(ctx, -3.4, 4.6)
    lanternPost(ctx, 3.6, 3.8)
    books({ add: ctx.add }, 6.4, 0, 2.4, 5, 0.6)
    npc({ group: flat(ctx), center: ctx.center, heightAt: () => 0, addCollider: () => {}, colliders: [], animated: ctx.animated }, 'mage', ...rot(ctx, 5.4, 3.4), { rotY: rotAngle(ctx, -2.2), r: 0 })
  },
  // Taverne valaisanne : tonneaux, longue table et chopes, drapeau du Valais, guirlande.
  tavern(ctx) {
    barrelStack(ctx, 6.2, -2.2)
    barrelStack(ctx, -6.2, -2.2)
    const t = table(ctx, 6, 2.2, { w: 1.9, d: 0.9, rotY: -1.2 })
    for (const [mx, mz] of [[-0.6, 0.15], [0.1, -0.2], [0.7, 0.2]]) mug(t, mx, 0.87, mz)
    woodBench(ctx, -1.6, 4.4, 0)
    woodBench(ctx, 1.6, 4.4, 0)
    valaisFlag(ctx, -5.6, -4)
    valaisFlag(ctx, 5.2, -4.2)
    lanternPost(ctx, -3.5, 4.2, { color: 0xffa04a })
    lanternPost(ctx, 3.4, 4.6, { color: 0xffa04a })
    npc({ group: flat(ctx), center: ctx.center, heightAt: () => 0, addCollider: () => {}, colliders: [], animated: ctx.animated }, 'barbarian', ...rot(ctx, 6.9, 2.6), { rotY: rotAngle(ctx, -1.9), r: 0 })
  },
  // Atelier web : bureaux avec écrans, plantes, poufs et lampe.
  workshop(ctx) {
    desk(ctx, -6.1, -1.9, 0.9, 3)
    desk(ctx, 6.1, -1.9, -0.9, 7)
    plantPot(ctx, -5.9, -4.1, { h: 1.3 })
    plantPot(ctx, 5.9, -4.1, { color: 0x58a05a, h: 1.1 })
    plantPot(ctx, 6.3, 1.4)
    beanbag(ctx, -1.5, 4.3, 0xff7ad9)
    beanbag(ctx, 1.5, 4.4, 0x6fd3ff)
    beanbag(ctx, -4.4, 4.2, 0xffb347)
    lanternPost(ctx, -6.2, 2.4, { color: 0xffe2b8, h: 2 })
    lanternPost(ctx, 3.8, 4.2, { color: 0xffe2b8, h: 2 })
    npc({ group: flat(ctx), center: ctx.center, heightAt: () => 0, addCollider: () => {}, colliders: [], animated: ctx.animated }, 'rogue', ...rot(ctx, 5.6, 3.2), { rotY: rotAngle(ctx, -2.2), r: 0 })
  },
  // Labo : consoles, tubes lumineux, piliers à hologrammes, caisses.
  lab(ctx) {
    console3d(ctx, -6.2, -1.6, 0.9, 5)
    console3d(ctx, 6.2, -1.6, -0.9, 9)
    tube(ctx, -5.8, -4, 0x7dff9a)
    tube(ctx, 5.8, -4, 0xff6fb1)
    tube(ctx, -6.3, 2.4, 0x58d0ff)
    holoPillar(ctx, -3.6, 3.8)
    holoPillar(ctx, 3.6, 3.8, 0xb48cff)
    for (const [cx, cz, cr] of [[6.3, 1.4, 0.4], [6.5, 2.6, -0.3]]) {
      const crate = model('sciCrate', { width: 0.9 })
      crate.position.set(cx, 0, cz)
      crate.rotation.y = cr
      ctx.add(crate)
      ctx.col(cx, cz, 0.6)
    }
  },
}

// Les PNJ vivent dans un groupe non tourné (leur logique d'orientation est en coordonnées monde).
function flat(ctx) {
  if (!ctx.flat) {
    ctx.flat = new THREE.Group()
    ctx.flat.position.copy(ctx.center)
    ctx.scene.add(ctx.flat)
  }
  return ctx.flat
}
function rot(ctx, x, z) {
  const p = ctx.toWorld(x, z)
  return [p.x - ctx.center.x, p.z - ctx.center.z]
}
function rotAngle(ctx, a) {
  // Angle local -> angle monde (le groupe de la scène est tourné de `facing`).
  const p = ctx.toWorld(Math.sin(a), Math.cos(a))
  const o = ctx.toWorld(0, 0)
  return Math.atan2(p.x - o.x, p.z - o.z)
}
