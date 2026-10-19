import * as THREE from 'three'

// Mode photo : l'interface disparaît, on tourne autour de son personnage, on choisit un filtre
// et un cadre, puis on capture l'image pour la télécharger ou la partager.

const SITE = 'aventuretime.antoinequarroz.ch'

// Filtres en matrices de couleur (4 lignes × 5 : r, g, b, a, décalage). La même matrice sert
// à l'aperçu en direct (filtre SVG sur le canvas) et à l'image finale (calcul pixel par pixel).
const FILTERS = [
  { id: 'none', label: 'Naturel', m: [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0] },
  { id: 'gold', label: 'Heure dorée', m: [1.12, 0.08, 0, 0, 0.02, 0.04, 1.02, 0, 0, 0.01, 0, 0.02, 0.82, 0, 0, 0, 0, 0, 1, 0] },
  { id: 'dream', label: 'Rêve violet', m: [0.95, 0.05, 0.1, 0, 0.04, 0, 0.85, 0.12, 0, 0.02, 0.08, 0.05, 1.12, 0, 0.06, 0, 0, 0, 1, 0] },
  { id: 'neon', label: 'Néon', m: [1.25, -0.15, 0.05, 0, -0.02, -0.1, 1.15, 0.1, 0, -0.02, 0.05, -0.1, 1.35, 0, 0, 0, 0, 0, 1, 0] },
  { id: 'sepia', label: 'Parchemin', m: [0.393, 0.769, 0.189, 0, 0, 0.349, 0.686, 0.168, 0, 0, 0.272, 0.534, 0.131, 0, 0, 0, 0, 0, 1, 0] },
  { id: 'bw', label: 'Noir et blanc', m: [0.36, 0.7, 0.14, 0, -0.06, 0.36, 0.7, 0.14, 0, -0.06, 0.36, 0.7, 0.14, 0, -0.06, 0, 0, 0, 1, 0] },
]

const FRAMES = [
  { id: 'card', label: 'Carte' },
  { id: 'film', label: 'Pellicule' },
  { id: 'none', label: 'Sans cadre' },
]

const ERA_NAMES = { past: 'Île du Passé', present: 'Île du Présent', future: 'Île du Futur', interior: 'Intérieur' }

export function createPhoto({ renderer, camera, sfx, getFocus, getPlace, onPose, onOpen, onClose, onShot }) {
  const state = { active: false, yaw: 0, pitch: 0.42, dist: 8, filter: FILTERS[0], frame: FRAMES[0], shot: false, shots: 0 }
  const focus = new THREE.Vector3()
  const look = new THREE.Vector3()

  // Filtre SVG pour l'aperçu en direct.
  const svgNS = 'http://www.w3.org/2000/svg'
  const svg = document.createElementNS(svgNS, 'svg')
  svg.setAttribute('width', '0')
  svg.setAttribute('height', '0')
  svg.style.position = 'absolute'
  svg.innerHTML = `<filter id="photo-filter" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values=""/></filter>`
  document.body.append(svg)
  const matrixEl = svg.querySelector('feColorMatrix')

  const root = document.createElement('div')
  root.className = 'photo'
  root.innerHTML = `
    <div class="photo-top">
      <span class="photo-title">📷 Mode photo</span>
      <span class="photo-help">Fais glisser pour tourner · molette ou pincer pour zoomer</span>
      <button class="photo-x" data-act="close" aria-label="Quitter le mode photo">✕</button>
    </div>
    <div class="photo-frame-guide"></div>
    <div class="photo-bottom">
      <div class="photo-row photo-filters"></div>
      <div class="photo-row photo-tools">
        <button data-act="left" title="Tourner à gauche">⟲</button>
        <button data-act="out" title="Reculer">−</button>
        <button class="photo-shutter" data-act="shot" aria-label="Prendre la photo"><i></i></button>
        <button data-act="in" title="Approcher">+</button>
        <button data-act="right" title="Tourner à droite">⟳</button>
      </div>
      <div class="photo-row photo-options">
        <button data-act="pose">👋 Pose</button>
        <span class="photo-frames"></span>
      </div>
    </div>
    <div class="photo-flash"></div>
    <div class="photo-result">
      <div class="photo-card">
        <canvas class="photo-preview"></canvas>
        <div class="photo-actions">
          <button class="btn primary" data-act="download">⬇ Télécharger</button>
          <button class="btn" data-act="share">↗ Partager</button>
          <button class="btn ghost" data-act="again">Reprendre</button>
        </div>
        <p class="photo-note"></p>
      </div>
    </div>`
  document.body.append(root)
  const $ = (s) => root.querySelector(s)

  const chip = (label, active, onClick) => {
    const b = document.createElement('button')
    b.className = `photo-chip${active ? ' active' : ''}`
    b.textContent = label
    b.addEventListener('click', onClick)
    return b
  }
  function renderChips() {
    $('.photo-filters').replaceChildren(...FILTERS.map((f) => chip(f.label, f === state.filter, () => setFilter(f))))
    $('.photo-frames').replaceChildren(...FRAMES.map((f) => chip(f.label, f === state.frame, () => {
      state.frame = f
      root.dataset.frame = f.id
      sfx?.blip?.('tick')
      renderChips()
    })))
  }
  function setFilter(f) {
    state.filter = f
    matrixEl.setAttribute('values', f.m.join(' '))
    renderer.domElement.style.filter = f.id === 'none' ? '' : 'url(#photo-filter)'
    sfx?.blip?.('tick')
    renderChips()
  }

  // Caméra : glisser pour tourner, molette / pincement pour zoomer.
  const pointers = new Map()
  let pinch = 0
  const canvas = renderer.domElement
  canvas.addEventListener('pointerdown', (e) => {
    if (!state.active) return
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
    canvas.setPointerCapture?.(e.pointerId)
  })
  canvas.addEventListener('pointermove', (e) => {
    if (!state.active || !pointers.has(e.pointerId)) return
    const prev = pointers.get(e.pointerId)
    if (pointers.size === 2) {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
      const [a, b] = [...pointers.values()]
      const d = Math.hypot(a.x - b.x, a.y - b.y)
      if (pinch) zoom(pinch / d)
      pinch = d
      return
    }
    state.yaw -= (e.clientX - prev.x) * 0.006
    state.pitch = THREE.MathUtils.clamp(state.pitch + (e.clientY - prev.y) * 0.004, 0.02, 1.35)
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
  })
  const release = (e) => {
    pointers.delete(e.pointerId)
    pinch = 0
  }
  canvas.addEventListener('pointerup', release)
  canvas.addEventListener('pointercancel', release)
  canvas.addEventListener('wheel', (e) => {
    if (!state.active) return
    e.preventDefault()
    zoom(Math.exp(e.deltaY * 0.0012))
  }, { passive: false })
  const zoom = (k) => (state.dist = THREE.MathUtils.clamp(state.dist * k, 2.2, 26))

  root.addEventListener('click', (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act
    if (!act) return
    if (act === 'close') api.close()
    if (act === 'left') state.yaw += 0.4
    if (act === 'right') state.yaw -= 0.4
    if (act === 'in') zoom(0.8)
    if (act === 'out') zoom(1.25)
    if (act === 'shot') state.shot = true
    if (act === 'pose') onPose?.()
    if (act === 'again') root.classList.remove('done')
    if (act === 'download') download()
    if (act === 'share') share()
  })

  // --- capture -------------------------------------------------------------
  const out = $('.photo-preview')
  let blob = null

  function applyMatrix(img, m) {
    if (state.filter.id === 'none') return
    const d = img.data
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i] / 255
      const g = d[i + 1] / 255
      const b = d[i + 2] / 255
      d[i] = (m[0] * r + m[1] * g + m[2] * b + m[4]) * 255
      d[i + 1] = (m[5] * r + m[6] * g + m[7] * b + m[9]) * 255
      d[i + 2] = (m[10] * r + m[11] * g + m[12] * b + m[14]) * 255
    }
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.arcTo(x + w, y, x + w, y + h, r)
    ctx.arcTo(x + w, y + h, x, y + h, r)
    ctx.arcTo(x, y + h, x, y, r)
    ctx.arcTo(x, y, x + w, y, r)
    ctx.closePath()
  }

  // Appelé juste après le rendu de l'image : le contenu du canvas WebGL est encore là.
  function capture() {
    state.shot = false
    const src = renderer.domElement
    const maxW = 1600
    const s = Math.min(1, maxW / src.width)
    const w = Math.round(src.width * s)
    const h = Math.round(src.height * s)
    const frame = state.frame.id
    const pad = frame === 'none' ? 0 : Math.round(w * 0.035)
    const bar = frame === 'none' ? 0 : Math.round(Math.max(64, w * 0.075))
    const filmHoles = frame === 'film'
    out.width = w + pad * 2
    out.height = h + pad * 2 + bar
    const ctx = out.getContext('2d')

    // Fond du cadre : verre sombre violet du jeu.
    const bg = ctx.createLinearGradient(0, 0, out.width, out.height)
    bg.addColorStop(0, '#1d1640')
    bg.addColorStop(1, '#2a1c4f')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, out.width, out.height)

    // L'image, avec le filtre appliqué pixel par pixel.
    const tmp = document.createElement('canvas')
    tmp.width = w
    tmp.height = h
    const tctx = tmp.getContext('2d', { willReadFrequently: true })
    tctx.drawImage(src, 0, 0, w, h)
    const img = tctx.getImageData(0, 0, w, h)
    applyMatrix(img, state.filter.m)
    tctx.putImageData(img, 0, 0)
    // Vignette douce.
    const vg = tctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75)
    vg.addColorStop(0, 'rgba(10,6,30,0)')
    vg.addColorStop(1, 'rgba(10,6,30,0.42)')
    tctx.fillStyle = vg
    tctx.fillRect(0, 0, w, h)

    ctx.save()
    if (frame !== 'none') {
      roundRect(ctx, pad, pad, w, h, Math.round(w * 0.012))
      ctx.clip()
    }
    ctx.drawImage(tmp, pad, pad)
    ctx.restore()

    if (frame !== 'none') {
      ctx.strokeStyle = 'rgba(180,140,255,0.55)'
      ctx.lineWidth = Math.max(2, w * 0.0018)
      roundRect(ctx, pad, pad, w, h, Math.round(w * 0.012))
      ctx.stroke()
      if (filmHoles) {
        ctx.fillStyle = 'rgba(255,255,255,0.14)'
        const hw = pad * 0.42
        for (let x = pad; x < out.width - pad; x += hw * 2.4) {
          roundRect(ctx, x, pad * 0.28, hw, pad * 0.44, 3)
          ctx.fill()
          roundRect(ctx, x, out.height - pad * 0.72, hw, pad * 0.44, 3)
          ctx.fill()
        }
      }
      // Bandeau : titre, lieu, date et adresse du site.
      const y = pad + h + bar / 2 + (filmHoles ? -pad * 0.15 : 0)
      const fs = Math.round(bar * 0.34)
      ctx.textBaseline = 'middle'
      ctx.fillStyle = '#ffd27a'
      ctx.font = `600 ${fs}px "Outfit Variable", Outfit, system-ui, sans-serif`
      ctx.textAlign = 'left'
      ctx.fillText('Aventure Time', pad + fs * 0.2, y - fs * 0.32)
      ctx.fillStyle = 'rgba(244,241,255,0.78)'
      ctx.font = `500 ${Math.round(fs * 0.58)}px "Inter Variable", Inter, system-ui, sans-serif`
      const place = getPlace?.() ?? {}
      const date = new Date().toLocaleDateString('fr-CH', { day: 'numeric', month: 'long', year: 'numeric' })
      ctx.fillText(`${place.name ?? ERA_NAMES[place.era] ?? 'Les trois îles'} · ${date}`, pad + fs * 0.2, y + fs * 0.5)
      ctx.textAlign = 'right'
      ctx.fillStyle = 'rgba(244,241,255,0.9)'
      ctx.font = `600 ${Math.round(fs * 0.62)}px "Outfit Variable", Outfit, system-ui, sans-serif`
      ctx.fillText('Portfolio d\'Antoine Quarroz', out.width - pad - fs * 0.2, y - fs * 0.32)
      ctx.fillStyle = '#b48cff'
      ctx.font = `500 ${Math.round(fs * 0.58)}px "Inter Variable", Inter, system-ui, sans-serif`
      ctx.fillText(SITE, out.width - pad - fs * 0.2, y + fs * 0.5)
    }

    blob = null
    out.toBlob((b) => (blob = b), 'image/jpeg', 0.92)
    root.classList.add('flash', 'done')
    setTimeout(() => root.classList.remove('flash'), 400)
    const canShare = !!navigator.canShare
    $('[data-act="share"]').hidden = !canShare
    $('.photo-note').textContent = canShare ? 'Partage-la où tu veux !' : `Télécharge-la pour la partager, avec le lien ${SITE}.`
    sfx?.blip?.('secret')
    state.shots++
    onShot?.(state.shots)
  }

  const fileName = () => `aventure-time-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.jpg`
  async function getBlob() {
    if (blob) return blob
    return new Promise((r) => out.toBlob((b) => r((blob = b)), 'image/jpeg', 0.92))
  }
  async function download() {
    const b = await getBlob()
    if (!b) return
    const a = document.createElement('a')
    try {
      a.href = URL.createObjectURL(b)
    } catch {
      a.href = out.toDataURL('image/jpeg', 0.92)
    }
    a.download = fileName()
    document.body.append(a)
    a.click()
    a.remove()
    setTimeout(() => a.href.startsWith('blob:') && URL.revokeObjectURL(a.href), 4000)
  }
  async function share() {
    const b = await getBlob()
    const file = b && new File([b], fileName(), { type: 'image/jpeg' })
    const data = { title: 'Aventure Time', text: `Mon aventure dans le portfolio 3D d'Antoine Quarroz : https://${SITE}`, url: `https://${SITE}` }
    try {
      if (file && navigator.canShare?.({ files: [file] })) await navigator.share({ ...data, files: [file] })
      else await navigator.share(data)
    } catch {
      // Partage annulé.
    }
  }

  const api = {
    get active() {
      return state.active
    },
    get wantsShot() {
      return state.active && state.shot
    },
    capture,
    open() {
      if (state.active) return
      state.active = true
      const f = getFocus()
      focus.copy(f)
      // Point de départ : la vue de jeu actuelle.
      const off = camera.position.clone().sub(focus)
      state.dist = THREE.MathUtils.clamp(off.length() * 0.7, 4, 16)
      state.yaw = Math.atan2(off.x, off.z)
      state.pitch = THREE.MathUtils.clamp(Math.asin(off.y / off.length()), 0.08, 1.2)
      root.dataset.frame = state.frame.id
      renderChips()
      setFilter(state.filter)
      root.classList.remove('done')
      root.classList.add('visible')
      document.body.classList.add('photo-open')
      sfx?.blip?.('open')
      onOpen?.()
    },
    close() {
      if (!state.active) return
      state.active = false
      root.classList.remove('visible', 'done')
      document.body.classList.remove('photo-open')
      renderer.domElement.style.filter = ''
      pointers.clear()
      sfx?.blip?.('close')
      onClose?.()
    },
    // Place la caméra (après la caméra du jeu, qu'elle remplace).
    update(dt) {
      if (!state.active) return
      focus.lerp(getFocus(), 1 - Math.exp(-dt * 6))
      const cp = Math.cos(state.pitch)
      camera.position.set(focus.x + Math.sin(state.yaw) * cp * state.dist, focus.y + 1.1 + Math.sin(state.pitch) * state.dist, focus.z + Math.cos(state.yaw) * cp * state.dist)
      look.set(focus.x, focus.y + 1.1, focus.z)
      camera.lookAt(look)
    },
    key(e) {
      if (!state.active) return false
      if (e.code === 'Escape' || e.code === 'KeyP') {
        if (root.classList.contains('done') && e.code === 'Escape') root.classList.remove('done')
        else api.close()
      } else if (e.code === 'Space' || e.code === 'Enter') state.shot = !root.classList.contains('done')
      else if (e.code === 'ArrowLeft' || e.code === 'KeyA' || e.code === 'KeyQ') state.yaw += 0.15
      else if (e.code === 'ArrowRight' || e.code === 'KeyD') state.yaw -= 0.15
      else if (e.code === 'ArrowUp' || e.code === 'KeyW' || e.code === 'KeyZ') zoom(0.9)
      else if (e.code === 'ArrowDown' || e.code === 'KeyS') zoom(1.1)
      else if (e.code === 'KeyF') setFilter(FILTERS[(FILTERS.indexOf(state.filter) + 1) % FILTERS.length])
      else return true
      e.preventDefault()
      return true
    },
  }
  return api
}
