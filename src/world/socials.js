import * as THREE from 'three'
import { mat, mesh, jitter } from './helpers.js'
import { canvasTexture } from './points.js'

// Réseaux sociaux en pierres gravées (île du Passé) et grande bannière « portfolio » à l'arrivée.

const GITHUB = new Path2D('M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z')

// Dessine le logo centré en (0, 0), dans un carré de côté `s`, avec la couleur courante.
function drawLogo(g, logo, s) {
  g.save()
  g.lineWidth = s * 0.08
  g.lineJoin = 'round'
  g.lineCap = 'round'
  if (logo === 'github') {
    g.scale(s / 16, s / 16)
    g.translate(-8, -8)
    g.fill(GITHUB)
  } else if (logo === 'linkedin') {
    g.beginPath()
    g.roundRect(-s / 2, -s / 2, s, s, s * 0.16)
    g.fill()
    g.globalCompositeOperation = 'destination-out'
    g.font = `bold ${s * 0.68}px Helvetica, Arial, sans-serif`
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText('in', s * 0.03, s * 0.06)
  } else if (logo === 'mail') {
    g.strokeRect(-s / 2, -s * 0.34, s, s * 0.68)
    g.beginPath()
    g.moveTo(-s / 2, -s * 0.34)
    g.lineTo(0, s * 0.08)
    g.lineTo(s / 2, -s * 0.34)
    g.stroke()
  } else if (logo === 'instagram') {
    g.beginPath()
    g.roundRect(-s / 2, -s / 2, s, s, s * 0.28)
    g.stroke()
    g.beginPath()
    g.arc(0, 0, s * 0.22, 0, Math.PI * 2)
    g.stroke()
    g.beginPath()
    g.arc(s * 0.27, -s * 0.27, s * 0.05, 0, Math.PI * 2)
    g.fill()
  } else if (logo === 'youtube') {
    g.beginPath()
    g.roundRect(-s / 2, -s * 0.34, s, s * 0.68, s * 0.18)
    g.fill()
    g.globalCompositeOperation = 'destination-out'
    g.beginPath()
    g.moveTo(-s * 0.12, -s * 0.16)
    g.lineTo(s * 0.2, 0)
    g.lineTo(-s * 0.12, s * 0.16)
    g.fill()
  } else {
    // Globe : site web.
    g.beginPath()
    g.arc(0, 0, s / 2, 0, Math.PI * 2)
    g.stroke()
    g.beginPath()
    g.ellipse(0, 0, s * 0.2, s / 2, 0, 0, Math.PI * 2)
    g.stroke()
    g.beginPath()
    g.moveTo(-s / 2, 0)
    g.lineTo(s / 2, 0)
    g.moveTo(-s * 0.43, -s * 0.24)
    g.lineTo(s * 0.43, -s * 0.24)
    g.moveTo(-s * 0.43, s * 0.24)
    g.lineTo(s * 0.43, s * 0.24)
    g.stroke()
  }
  g.restore()
}

// Face gravée : pierre mouchetée, logo creusé (ombre + reflet) et nom en dessous.
function stoneFace(logo, label) {
  const W = 256
  const H = 384
  const map = canvasTexture(W, H, (g) => {
    g.fillStyle = '#8a87a6'
    g.fillRect(0, 0, W, H)
    for (let i = 0; i < 900; i++) {
      g.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '20,16,40'}, ${Math.random() * 0.12})`
      const r = 1 + Math.random() * 4
      g.fillRect(Math.random() * W, Math.random() * H, r, r)
    }
    // Cadre taillé.
    g.strokeStyle = 'rgba(30, 24, 56, 0.55)'
    g.lineWidth = 6
    g.strokeRect(18, 18, W - 36, H - 36)
    const carve = (dx, dy, color) => {
      g.save()
      g.translate(W / 2 + dx, 150 + dy)
      g.fillStyle = g.strokeStyle = color
      drawLogo(g, logo, 130)
      g.restore()
      g.fillStyle = color
      g.font = 'bold 34px Georgia, serif'
      g.textAlign = 'center'
      g.fillText(label, W / 2 + dx, 300 + dy)
    }
    carve(3, 4, 'rgba(20, 14, 40, 0.85)')
    carve(0, 0, '#d8d2ff')
  })
  // Carte lumineuse : seul le logo gravé brille (lueur magique).
  const glow = canvasTexture(W, H, (g) => {
    g.fillStyle = '#000'
    g.fillRect(0, 0, W, H)
    g.save()
    g.translate(W / 2, 150)
    g.fillStyle = g.strokeStyle = '#fff'
    drawLogo(g, logo, 130)
    g.restore()
    g.fillStyle = '#fff'
    g.font = 'bold 34px Georgia, serif'
    g.textAlign = 'center'
    g.fillText(label, W / 2, 300)
  })
  return { map, glow }
}

export function createSocialStones(scene, world, { center, socials }) {
  const group = new THREE.Group()
  scene.add(group)
  const interactables = []
  const runes = []
  const stoneMat = mat(0x8a87a6, { roughness: 0.95, flatShading: true })
  socials.forEach((social, i) => {
    const x = center.x + social.pos[0]
    const z = center.z + social.pos[1]
    const y = world.groundAt(x, z, Infinity, true) ?? 0
    const stone = new THREE.Group()
    stone.position.set(x, y, z)
    stone.rotation.y = (i % 2 ? 1 : -1) * 0.08
    // Bloc de pierre brut, légèrement irrégulier, sur un socle.
    stone.add(mesh(jitter(new THREE.BoxGeometry(1.9, 0.35, 1.0, 2, 1, 2), 0.06, i + 3), stoneMat, { y: 0.17 }))
    // Menhir : bloc taillé qui s'affine vers le haut, coiffé d'une pointe.
    const menhir = new THREE.CylinderGeometry(0.62, 0.85, 2.8, 4, 3).rotateY(Math.PI / 4)
    stone.add(mesh(jitter(menhir, 0.04, i + 9), stoneMat, { y: 1.75 }))
    stone.add(mesh(jitter(new THREE.CylinderGeometry(0.05, 0.62, 0.55, 4).rotateY(Math.PI / 4), 0.05, i + 15), stoneMat, { y: 3.42 }))
    const { map, glow } = stoneFace(social.logo, social.label)
    const color = new THREE.Color(social.color)
    const face = mesh(new THREE.PlaneGeometry(0.95, 1.45), new THREE.MeshStandardMaterial({ map, emissiveMap: glow, emissive: color, emissiveIntensity: 0.9, roughness: 0.9 }), { y: 1.6, z: 0.565 })
    face.rotation.x = -0.057
    stone.add(face)
    // Cercle de runes au sol, aux couleurs du réseau.
    const rune = mesh(new THREE.RingGeometry(1.15, 1.3, 32), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.6, side: THREE.DoubleSide }), { y: 0.04, z: 0.9, shadow: false })
    rune.rotation.x = -Math.PI / 2
    stone.add(rune)
    runes.push({ rune, face, phase: i * 1.3 })
    group.add(stone)
    world.colliders.push({ x, z, r: 0.85, top: y + 3.6 })
    interactables.push({ type: 'social', x, z: z + 0.9, r: 1.9, title: social.label, url: social.url, text: social.text, logo: social.logo, era: 'past' })
  })

  return {
    interactables,
    update(dt, t) {
      for (const r of runes) {
        r.rune.material.opacity = 0.35 + 0.3 * (0.5 + 0.5 * Math.sin(t * 2 + r.phase))
        r.face.material.emissiveIntensity = 0.7 + 0.35 * Math.sin(t * 1.6 + r.phase)
      }
    },
  }
}

// Grande bannière flottante à l'arrivée : on comprend tout de suite qu'on est sur un portfolio.
export function createPortfolioBanner(scene, world, { x, z, height = 4.6 }) {
  const texture = canvasTexture(1024, 300, (g, w, h) => {
    g.beginPath()
    g.roundRect(10, 10, w - 20, h - 20, 60)
    const grad = g.createLinearGradient(0, 0, w, h)
    grad.addColorStop(0, 'rgba(46, 30, 88, 0.95)')
    grad.addColorStop(1, 'rgba(20, 14, 44, 0.95)')
    g.fillStyle = grad
    g.fill()
    g.lineWidth = 8
    g.strokeStyle = '#ffb347'
    g.stroke()
    g.textAlign = 'center'
    g.fillStyle = '#ffb347'
    g.font = 'bold 38px system-ui, sans-serif'
    g.fillText('PORTFOLIO', w / 2, 82)
    g.fillStyle = '#ffffff'
    g.font = 'bold 92px Georgia, serif'
    g.fillText('Antoine Quarroz', w / 2, 175)
    g.fillStyle = '#d9ccff'
    g.font = '40px system-ui, sans-serif'
    g.fillText('Développeur web & mobile · Valais', w / 2, 240)
  })
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthWrite: false, fog: false }))
  const y = world.groundAt(x, z, Infinity, true) ?? 0
  sprite.scale.set(7, 2.05, 1)
  sprite.position.set(x, y + height, z)
  sprite.renderOrder = 2
  scene.add(sprite)
  return {
    update(dt, t) {
      sprite.position.y = y + height + Math.sin(t * 1.2) * 0.12
    },
  }
}
