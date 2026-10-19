// Visuels des projets pour les grands écrans des lieux de projets.
// Chaque projet a une vignette 1200 × 600 : sa capture (public/projects/…) quand elle existe,
// sinon une maquette dessinée (navigateur, téléphones ou logiciel) à ses couleurs.

export const VISUAL_W = 1200
export const VISUAL_H = 600

const images = new Map()
// Charge une capture une seule fois ; `onLoad` redessine l'écran quand elle arrive.
export function loadImage(src, onLoad) {
  if (!src) return null
  let entry = images.get(src)
  if (!entry) {
    const img = new Image()
    entry = { img, ready: false, callbacks: [] }
    img.onload = () => {
      entry.ready = true
      for (const cb of entry.callbacks) cb()
    }
    img.src = src
    images.set(src, entry)
  }
  if (entry.ready) return entry.img
  entry.callbacks.push(onLoad)
  return null
}

function cover(g, img, x, y, w, h) {
  const s = Math.max(w / img.width, h / img.height)
  const iw = img.width * s
  const ih = img.height * s
  g.save()
  g.beginPath()
  g.rect(x, y, w, h)
  g.clip()
  g.drawImage(img, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih)
  g.restore()
}

function rr(g, x, y, w, h, r, fill) {
  g.beginPath()
  g.roundRect(x, y, w, h, r)
  if (fill) {
    g.fillStyle = fill
    g.fill()
  }
}

function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16)
  const f = (c) => Math.max(0, Math.min(255, Math.round(k < 0 ? c * (1 + k) : c + (255 - c) * k)))
  return `rgb(${f(n >> 16)}, ${f((n >> 8) & 255)}, ${f(n & 255)})`
}

function rand(seed) {
  let s = 0
  for (const c of seed) s = (s * 31 + c.charCodeAt(0)) % 2147483647
  s = s || 7
  return () => ((s = (s * 16807) % 2147483647) / 2147483647)
}

// Dessine le visuel d'un projet dans le rectangle donné.
export function drawVisual(g, project, x, y, w, h, redraw) {
  const img = loadImage(project.image, redraw)
  g.save()
  g.translate(x, y)
  g.scale(w / VISUAL_W, h / VISUAL_H)
  if (project.kind === 'full') {
    if (img) cover(g, img, 0, 0, VISUAL_W, VISUAL_H)
    else placeholder(g, project)
  } else if (project.kind === 'mobile') mobile(g, project)
  else if (project.kind === 'app') desktopApp(g, project, img)
  else browser(g, project, img)
  g.restore()
}

function placeholder(g, p) {
  const grad = g.createLinearGradient(0, 0, VISUAL_W, VISUAL_H)
  grad.addColorStop(0, shade(p.color, -0.5))
  grad.addColorStop(1, shade(p.color, -0.8))
  g.fillStyle = grad
  g.fillRect(0, 0, VISUAL_W, VISUAL_H)
}

// Site web dans une fenêtre de navigateur.
function browser(g, p, img) {
  const W = VISUAL_W
  const H = VISUAL_H
  const r = rand(p.id)
  g.fillStyle = '#e9e6f2'
  g.fillRect(0, 0, W, H)
  // Barre du navigateur.
  g.fillStyle = '#2a2540'
  g.fillRect(0, 0, W, 50)
  for (const [i, c] of ['#ff5f56', '#ffbd2e', '#27c93f'].entries()) {
    g.fillStyle = c
    g.beginPath()
    g.arc(26 + i * 24, 25, 7, 0, Math.PI * 2)
    g.fill()
  }
  rr(g, 120, 11, 620, 28, 14, '#3d3758')
  g.fillStyle = '#c9c3e6'
  g.font = '18px "Inter Variable", system-ui, sans-serif'
  g.textBaseline = 'middle'
  g.fillText(`🔒 ${p.domain ?? 'antoinequarroz.ch'}`, 138, 26)
  const top = 50
  if (img) {
    cover(g, img, 0, top, W, H - top)
    if (p.overlay) {
      // Photo en fond : bandeau du site par-dessus.
      const grad = g.createLinearGradient(0, 0, W * 0.75, 0)
      grad.addColorStop(0, 'rgba(10, 20, 40, 0.85)')
      grad.addColorStop(1, 'rgba(10, 20, 40, 0)')
      g.fillStyle = grad
      g.fillRect(0, top, W, H - top)
      g.fillStyle = '#ffffff'
      g.font = 'bold 30px "Inter Variable", system-ui, sans-serif'
      g.fillText(p.title, 60, top + 50)
      g.font = 'bold 64px "Inter Variable", system-ui, sans-serif'
      wrap(g, p.tagline, 60, top + 170, 620, 72)
      rr(g, 60, top + 340, 260, 64, 32, p.color)
      g.fillStyle = '#ffffff'
      g.font = 'bold 24px "Inter Variable", system-ui, sans-serif'
      g.fillText('Prendre rendez-vous', 82, top + 373)
    }
    return
  }
  // Page dessinée : menu, grand titre, bouton, illustration et cartes.
  const dark = p.dashboard || ['velqora', 'staq', 'threejs-cv'].includes(p.id)
  const bg = g.createLinearGradient(0, top, W, H)
  bg.addColorStop(0, dark ? '#120f24' : shade(p.color, 0.88))
  bg.addColorStop(1, dark ? shade(p.color, -0.72) : shade(p.color, 0.7))
  g.fillStyle = bg
  g.fillRect(0, top, W, H - top)
  const ink = dark ? '#ffffff' : '#1d1830'
  g.fillStyle = p.color
  g.font = 'bold 30px "Inter Variable", system-ui, sans-serif'
  g.fillText(p.title, 50, top + 44)
  g.globalAlpha = 0.6
  for (let i = 0; i < 4; i++) rr(g, 640 + i * 120, top + 34, 90, 18, 9, ink)
  g.globalAlpha = 1
  if (p.dashboard) return dashboard(g, p, top, r)
  g.fillStyle = ink
  g.font = 'bold 58px "Inter Variable", system-ui, sans-serif'
  wrap(g, p.tagline, 50, top + 150, 560, 66)
  g.globalAlpha = 0.55
  for (let i = 0; i < 3; i++) rr(g, 50, top + 300 + i * 26, 440 - i * 90, 14, 7, ink)
  g.globalAlpha = 1
  rr(g, 50, top + 400, 220, 58, 29, p.color)
  rr(g, 290, top + 400, 170, 58, 29, null)
  g.strokeStyle = ink
  g.lineWidth = 3
  g.stroke()
  g.fillStyle = '#ffffff'
  g.font = 'bold 22px "Inter Variable", system-ui, sans-serif'
  g.fillText('Commencer', 92, top + 430)
  // Illustration : cartes empilées et formes douces.
  g.globalAlpha = 0.9
  g.fillStyle = shade(p.color, 0.35)
  g.beginPath()
  g.arc(910, top + 260, 190, 0, Math.PI * 2)
  g.fill()
  g.globalAlpha = 1
  for (let i = 0; i < 3; i++) {
    const cx = 720 + i * 120
    const cy = top + 130 + i * 70
    rr(g, cx, cy, 250, 170, 18, dark ? '#221d3a' : '#ffffff')
    rr(g, cx + 18, cy + 18, 214, 80, 10, shade(p.color, i === 1 ? 0 : 0.5 - i * 0.1))
    g.globalAlpha = 0.4
    rr(g, cx + 18, cy + 112, 150, 12, 6, ink)
    rr(g, cx + 18, cy + 134, 100, 12, 6, ink)
    g.globalAlpha = 1
  }
  icon(g, p, 910, top + 260)
}

// Petit symbole propre à chaque projet, au centre de l'illustration.
function icon(g, p, x, y) {
  const glyph = { livrematch: '📖', 'chat-d-interieur': '🐈', 'bagage-malin': '🧳', 'rangements-malins': '📦', rallye: '🏁', velqora: '✨', staq: '🧰', 'threejs-cv': '🪐' }[p.id]
  if (!glyph) return
  g.font = '120px "Inter Variable", system-ui, sans-serif'
  g.textAlign = 'center'
  g.fillText(glyph, x - 70, y - 90)
  g.textAlign = 'left'
}

function dashboard(g, p, top, r) {
  // Score de santé, cartes de projets et courbes.
  g.strokeStyle = 'rgba(255,255,255,0.12)'
  g.lineWidth = 26
  g.beginPath()
  g.arc(200, top + 280, 120, 0, Math.PI * 2)
  g.stroke()
  g.strokeStyle = p.color
  g.beginPath()
  g.arc(200, top + 280, 120, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * 0.92)
  g.stroke()
  g.fillStyle = '#ffffff'
  g.font = 'bold 76px "Inter Variable", system-ui, sans-serif'
  g.textAlign = 'center'
  g.fillText('92', 200, top + 280)
  g.font = '22px "Inter Variable", system-ui, sans-serif'
  g.fillText('santé globale', 200, top + 335)
  g.textAlign = 'left'
  const names = ['VELQORA', 'STAQ', 'LivreMatch', 'PhysioBaur']
  names.forEach((name, i) => {
    const x = 400 + (i % 2) * 390
    const y = top + 100 + Math.floor(i / 2) * 220
    rr(g, x, y, 360, 190, 16, '#1d1934')
    g.fillStyle = '#ffffff'
    g.font = 'bold 26px "Inter Variable", system-ui, sans-serif'
    g.fillText(name, x + 22, y + 36)
    rr(g, x + 250, y + 22, 88, 30, 15, i === 2 ? '#ffbd2e' : '#27c93f')
    g.fillStyle = '#10121e'
    g.font = 'bold 16px "Inter Variable", system-ui, sans-serif'
    g.fillText(i === 2 ? 'LENT' : 'EN LIGNE', x + 262, y + 38)
    g.strokeStyle = p.color
    g.lineWidth = 4
    g.beginPath()
    for (let k = 0; k <= 12; k++) {
      const px = x + 22 + k * 26
      const py = y + 150 - r() * 60
      if (k) g.lineTo(px, py)
      else g.moveTo(px, py)
    }
    g.stroke()
  })
}

// Appli mobile : deux téléphones sur fond coloré.
function mobile(g, p) {
  const W = VISUAL_W
  const H = VISUAL_H
  const bg = g.createRadialGradient(W / 2, H / 2, 50, W / 2, H / 2, 700)
  bg.addColorStop(0, shade(p.color, -0.35))
  bg.addColorStop(1, shade(p.color, -0.85))
  g.fillStyle = bg
  g.fillRect(0, 0, W, H)
  g.fillStyle = '#ffffff'
  g.font = 'bold 64px "Inter Variable", system-ui, sans-serif'
  g.textBaseline = 'middle'
  g.fillText(p.title, 60, 200)
  g.font = '30px "Inter Variable", system-ui, sans-serif'
  g.globalAlpha = 0.85
  wrap(g, p.tagline, 60, 270, 440, 40)
  g.globalAlpha = 1
  rr(g, 60, 380, 200, 56, 14, '#000000')
  rr(g, 280, 380, 200, 56, 14, '#000000')
  g.fillStyle = '#ffffff'
  g.font = 'bold 20px "Inter Variable", system-ui, sans-serif'
  g.fillText(' App Store', 90, 408)
  g.fillText('▶ Google Play', 300, 408)
  phone(g, p, 620, 40, -0.06, 0)
  phone(g, p, 880, 70, 0.06, 1)
}

function phone(g, p, x, y, tilt, screenIndex) {
  g.save()
  g.translate(x + 120, y + 250)
  g.rotate(tilt)
  g.translate(-120, -250)
  rr(g, 0, 0, 240, 500, 40, '#0c0b14')
  rr(g, 10, 10, 220, 480, 32, '#f6f4fb')
  g.save()
  g.beginPath()
  g.roundRect(10, 10, 220, 480, 32)
  g.clip()
  const c = p.color
  if (p.id === 'remembeyes') {
    g.fillStyle = '#1a1424'
    g.fillRect(10, 10, 220, 480)
    g.fillStyle = '#ffffff'
    g.font = 'bold 20px "Inter Variable", system-ui, sans-serif'
    g.fillText(screenIndex ? 'Diaporama' : 'Mariage de Léa', 26, 60)
    if (screenIndex) {
      const grad = g.createLinearGradient(10, 90, 230, 400)
      grad.addColorStop(0, '#ffb347')
      grad.addColorStop(1, c)
      g.fillStyle = grad
      g.fillRect(20, 90, 200, 300)
      g.font = '80px "Inter Variable", system-ui, sans-serif'
      g.fillText('📸', 70, 240)
    } else {
      const colors = ['#ff6fb1', '#ffb347', '#6fd3ff', '#9b6bff', '#3fd6a8', '#ff8a5c', '#ffd34f', '#b48cff', '#58d0ff']
      for (let i = 0; i < 9; i++) rr(g, 22 + (i % 3) * 68, 86 + Math.floor(i / 3) * 68, 62, 62, 8, colors[i])
      rr(g, 40, 330, 160, 160, 12, '#ffffff')
      g.fillStyle = '#1a1424'
      for (let i = 0; i < 64; i++) if ((i * 37) % 5 < 2) g.fillRect(52 + (i % 8) * 17, 342 + Math.floor(i / 8) * 17, 15, 15)
    }
  } else {
    // Respire et autres : compteur, anneau de progression et cartes.
    g.fillStyle = shade(c, 0.85)
    g.fillRect(10, 10, 220, 480)
    g.fillStyle = '#1d2b28'
    g.font = 'bold 20px "Inter Variable", system-ui, sans-serif'
    g.fillText(screenIndex ? 'Mes progrès' : p.title, 26, 60)
    g.strokeStyle = shade(c, 0.5)
    g.lineWidth = 16
    g.beginPath()
    g.arc(120, 180, 70, 0, Math.PI * 2)
    g.stroke()
    g.strokeStyle = c
    g.beginPath()
    g.arc(120, 180, 70, -Math.PI / 2, Math.PI * (screenIndex ? 0.9 : 0.4))
    g.stroke()
    g.textAlign = 'center'
    g.fillStyle = '#1d2b28'
    g.font = 'bold 34px "Inter Variable", system-ui, sans-serif'
    g.fillText(screenIndex ? '214 CHF' : '12 j', 120, 182)
    g.font = '14px "Inter Variable", system-ui, sans-serif'
    g.fillText(screenIndex ? 'économisés' : 'sans fumer', 120, 214)
    g.textAlign = 'left'
    for (let i = 0; i < 3; i++) {
      rr(g, 24, 280 + i * 64, 192, 52, 12, '#ffffff')
      rr(g, 36, 292 + i * 64, 28, 28, 14, i === 0 && !screenIndex ? '#ff5f56' : c)
      g.fillStyle = '#1d2b28'
      g.font = 'bold 15px "Inter Variable", system-ui, sans-serif'
      g.fillText(screenIndex ? ['Souffle +18 %', 'Goût retrouvé', 'Cœur au calme'][i] : ['SOS envie', 'Respiration', 'Widgets'][i], 76, 307 + i * 64)
    }
  }
  g.restore()
  rr(g, 90, 18, 60, 16, 8, '#0c0b14')
  g.restore()
}

// Logiciel de bureau : fenêtre macOS avec barre latérale.
function desktopApp(g, p, img) {
  const W = VISUAL_W
  const H = VISUAL_H
  const bg = g.createLinearGradient(0, 0, W, H)
  bg.addColorStop(0, shade(p.color, -0.55))
  bg.addColorStop(1, '#0d0b1d')
  g.fillStyle = bg
  g.fillRect(0, 0, W, H)
  rr(g, 60, 40, W - 120, H - 80, 18, '#1b1830')
  g.save()
  g.beginPath()
  g.roundRect(60, 40, W - 120, H - 80, 18)
  g.clip()
  g.fillStyle = '#262240'
  g.fillRect(60, 40, W - 120, 44)
  for (const [i, c] of ['#ff5f56', '#ffbd2e', '#27c93f'].entries()) {
    g.fillStyle = c
    g.beginPath()
    g.arc(86 + i * 22, 62, 7, 0, Math.PI * 2)
    g.fill()
  }
  g.fillStyle = '#d9d4f5'
  g.font = 'bold 18px "Inter Variable", system-ui, sans-serif'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText(p.title, W / 2, 62)
  g.textAlign = 'left'
  if (img) {
    // Vraie capture du logiciel dans la fenêtre.
    cover(g, img, 60, 84, W - 120, H - 124)
    g.restore()
    return
  }
  if (p.terminal) {
    // EnvVault : terminal et historique de versions chiffrées.
    g.fillStyle = '#0f0d1c'
    g.fillRect(60, 84, W - 120, H - 124)
    g.font = '24px ui-monospace, Menlo, monospace'
    const lines = [
      ['#7df9ff', '$ envvault backup ./mon-projet/.env'],
      ['#c3e88d', '✔ .env chiffré (AES-256) · version 14'],
      ['#7df9ff', '$ envvault history .env'],
      ['#d9d4f5', '  v14  aujourd\'hui 11:42   🔒 3 clés modifiées'],
      ['#d9d4f5', '  v13  hier 18:05           🔒 STRIPE_KEY ajoutée'],
      ['#d9d4f5', '  v12  12 oct. 09:30         🔒 base de données'],
      ['#7df9ff', '$ envvault restore .env --version 13'],
      ['#c3e88d', '✔ configuration restaurée'],
    ]
    lines.forEach(([color, text], i) => {
      g.fillStyle = color
      g.fillText(text, 90, 130 + i * 46)
    })
    g.restore()
    return
  }
  // Hermes Cockpit : projets à gauche, missions des agents à droite.
  g.fillStyle = '#211d38'
  g.fillRect(60, 84, 250, H - 124)
  g.font = 'bold 16px "Inter Variable", system-ui, sans-serif'
  g.fillStyle = '#8f88b8'
  g.fillText('PROJETS', 84, 116)
  for (const [i, name] of ['Portfolio 3D', 'VELQORA', 'LivreMatch', 'Orion', 'STAQ'].entries()) {
    if (i === 0) rr(g, 72, 136, 226, 40, 10, shade(p.color, -0.3))
    g.fillStyle = '#ece8ff'
    g.font = '20px "Inter Variable", system-ui, sans-serif'
    g.fillText(name, 92, 157 + i * 48)
  }
  const missions = [
    ['Agent design', 'Refaire la place des réseaux', 'Terminé', '#27c93f'],
    ['Agent code', 'Construire les lieux de projets', 'En cours', p.color],
    ['Agent tests', 'Captures et vérifications', 'En attente', '#8f88b8'],
  ]
  missions.forEach(([agent, task, state, color], i) => {
    const y = 110 + i * 132
    rr(g, 340, y, 740, 112, 16, '#28233f')
    rr(g, 362, y + 22, 64, 64, 32, shade(color, -0.2))
    g.fillStyle = '#ffffff'
    g.font = '34px "Inter Variable", system-ui, sans-serif'
    g.fillText('🤖', 375, y + 56)
    g.font = 'bold 24px "Inter Variable", system-ui, sans-serif'
    g.fillText(agent, 450, y + 40)
    g.fillStyle = '#b9b2dd'
    g.font = '20px "Inter Variable", system-ui, sans-serif'
    g.fillText(task, 450, y + 76)
    rr(g, 920, y + 38, 136, 36, 18, color)
    g.fillStyle = '#121022'
    g.font = 'bold 17px "Inter Variable", system-ui, sans-serif'
    g.fillText(state, 940, y + 57)
  })
  g.restore()
}

function wrap(g, text, x, y, max, line) {
  const words = text.split(' ')
  let row = ''
  for (const word of words) {
    const test = row ? `${row} ${word}` : word
    if (g.measureText(test).width > max && row) {
      g.fillText(row, x, y)
      row = word
      y += line
    } else row = test
  }
  g.fillText(row, x, y)
  return y
}
