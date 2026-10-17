// Mini-carte en haut à gauche : l'île autour du joueur vue de dessus (le haut = vers le fond
// de l'écran), avec les panneaux, les jeux et les véhicules. Touche M (ou clic) pour voir
// les trois îles en entier.
const COLORS = { past: '#7a62c9', present: '#d9823f', future: '#8f93b5' }
const DOTS = { sign: '#ffd27a', game: '#6dff9a', vehicle: '#ff5a5a', chest: '#ff7ad9' }

export function createMinimap({ world, player, interactables, eraOf }) {
  const ui = document.getElementById('ui')
  const wrap = document.createElement('div')
  wrap.className = 'minimap'
  wrap.title = 'Carte (M)'
  const canvas = document.createElement('canvas')
  const label = document.createElement('span')
  wrap.append(canvas, label)
  ui.appendChild(wrap)
  const g = canvas.getContext('2d')
  let big = false
  let timer = 0

  const toggle = () => {
    big = !big
    wrap.classList.toggle('big', big)
    timer = 0
  }
  wrap.addEventListener('pointerdown', (e) => {
    e.preventDefault()
    toggle()
  })
  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyM') toggle()
  })

  const polys = world.surfaces.filter((s) => s.type === 'poly' && !s.wall).sort((a, b) => a.h - b.h)
  const bridges = world.surfaces.filter((s) => s.type === 'bridge')

  function draw() {
    const dpr = Math.min(devicePixelRatio, 2)
    const w = big ? Math.min(innerWidth - 32, 760) : 170
    const h = big ? Math.min(innerHeight * 0.5, 300) : 170
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
    }
    const p = player.position
    // Petite carte : 34 m autour du joueur. Grande carte : tout le monde.
    const scale = big ? Math.min(w / 380, h / 120) : w / 68
    const cx = big ? 0 : p.x
    const cz = big ? 0 : p.z
    const X = (x) => (w / 2 + (x - cx) * scale) * dpr
    const Z = (z) => (h / 2 + (z - cz) * scale) * dpr
    g.clearRect(0, 0, canvas.width, canvas.height)

    g.lineCap = 'round'
    g.strokeStyle = 'rgba(220,200,255,0.55)'
    for (const b of bridges) {
      g.lineWidth = Math.max(1.5, b.w * scale * dpr * 0.8)
      g.beginPath()
      g.moveTo(X(b.ax), Z(b.az))
      g.lineTo(X(b.bx), Z(b.bz))
      g.stroke()
    }
    for (const s of polys) {
      g.fillStyle = COLORS[eraOf(s.x)]
      g.globalAlpha = 0.55 + Math.min(0.4, s.h * 0.12)
      g.beginPath()
      s.pts.forEach(([x, z], i) => (i ? g.lineTo(X(x), Z(z)) : g.moveTo(X(x), Z(z))))
      g.closePath()
      g.fill()
    }
    g.globalAlpha = 1
    for (const it of interactables) {
      if (!big && (Math.abs(it.x - p.x) > 40 || Math.abs(it.z - p.z) > 40)) continue
      g.fillStyle = DOTS[it.type] ?? '#fff'
      g.beginPath()
      g.arc(X(it.x), Z(it.z), (big ? 2.5 : 3.2) * dpr, 0, Math.PI * 2)
      g.fill()
    }
    // Le joueur : flèche blanche.
    g.save()
    g.translate(X(p.x), Z(p.z))
    const v = player.velocity
    if (Math.hypot(v.x, v.z) > 0.5) player.mapAngle = Math.atan2(v.x, v.z)
    g.rotate(-(player.mapAngle ?? Math.PI))
    g.fillStyle = '#fff'
    g.strokeStyle = 'rgba(0,0,0,0.6)'
    g.lineWidth = dpr
    const s = (big ? 5 : 6) * dpr
    g.beginPath()
    g.moveTo(0, s * 1.3)
    g.lineTo(s * 0.8, -s * 0.8)
    g.lineTo(0, -s * 0.3)
    g.lineTo(-s * 0.8, -s * 0.8)
    g.closePath()
    g.fill()
    g.stroke()
    g.restore()

    const island = player.currentIsland()
    label.textContent = big ? 'Passé · Présent · Futur  —  M pour fermer' : island ? island.name : 'Entre les îles'
  }

  return {
    update(dt) {
      timer -= dt
      if (timer > 0) return
      timer = 0.08
      draw()
    },
  }
}
