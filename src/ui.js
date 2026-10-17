import { intro, islands, showcases } from './content.js'

const GAME_COUNT = islands.reduce((n, i) => n + (i.satellites?.filter((s) => s.game).length ?? 0) + (i.arena ? 1 : 0), 0)
const PROJECT_COUNT = showcases.reduce((n, p) => n + p.projects.length, 0)

const CHARACTERS = [
  { key: 'rogue', icon: '🧭', name: 'Aventurier' },
  { key: 'knight', icon: '🛡️', name: 'Chevalier' },
  { key: 'mage', icon: '🪄', name: 'Mage' },
  { key: 'barbarian', icon: '🪓', name: 'Barbare' },
]

export function createUI() {
  const root = document.getElementById('ui')
  root.innerHTML = `
    <div class="intro" id="intro">
      <div class="intro-card">
        <span class="intro-kicker">${intro.kicker}</span>
        <h1>${intro.title}</h1>
        <p class="intro-role">${intro.role}</p>
        <p>${intro.subtitle}</p>
        <div class="pick">
          <span>Choisis ton personnage</span>
          <div class="chars">${CHARACTERS.map((c) => `<button class="char" data-key="${c.key}"><b>${c.icon}</b>${c.name}</button>`).join('')}</div>
        </div>
        <ul class="intro-stats" aria-label="En chiffres">
          <li><b>${islands.length}</b> îles à explorer</li>
          <li><b>${PROJECT_COUNT}</b> projets</li>
          <li><b>${GAME_COUNT}</b> mini-jeux</li>
        </ul>
        <div class="intro-actions">
          <button id="start" class="btn primary big" disabled>Chargement…</button>
          <button id="start-list" class="btn">📄 Voir en liste</button>
          <button id="start-tour" class="btn" disabled>🧭 Visite guidée · 2 min</button>
        </div>
        <p class="intro-hint">Pressé ? La version liste montre mes projets, mon parcours et mes contacts, sans jouer.</p>
        <p class="controls">${intro.controls}</p>
      </div>
    </div>
    <div class="hello" id="hello">Salut, moi c'est Antoine ! 👋</div>
    <div class="hud-right" id="hud-right">
      <div class="quest-chip" id="quest-chip" title="Quête : découvre tous les points pour ouvrir le coffre final"><b>🗝️</b><span></span></div>
      <div class="hud-chip" id="day-chip"></div>
      <button class="hud-btn" id="btn-list" title="Version liste : projets, CV et contact" aria-label="Version liste">📄</button>
      <button class="hud-btn trophy-btn" id="btn-trophies" title="Trophées : succès et classements">🏆<i></i></button>
      <button class="hud-btn" id="btn-tour" title="Visite guidée">🧭</button>
      <button class="hud-btn off" id="btn-music" title="Activer la musique">🎵</button>
      <button class="hud-btn" id="btn-mute" title="Couper le son">🔊</button>
      <button class="hud-btn" id="btn-settings" title="Réglages et accessibilité" aria-label="Réglages">⚙️</button>
    </div>
    <div class="tour-bar" id="tour-bar">
      <span class="tour-step"></span>
      <div class="tour-progress"><i></i></div>
      <button data-act="next">Suivant ›</button>
      <button data-act="stop">Arrêter</button>
    </div>
    <button class="brand" id="brand" title="À propos de ce portfolio"><b>Antoine Quarroz</b><span>Portfolio · Développeur web &amp; mobile</span></button>
    <div class="island-name" id="island-name"><strong></strong><span></span></div>
    <button class="objective" id="objective" title="Prochain objectif : suis la flèche dorée"><b>🎯</b><span></span><i aria-hidden="true">➜</i></button>
    <div class="guide-marker" id="guide-marker" aria-hidden="true"><span>▼</span></div>
    <div class="era-card" id="era-card" aria-live="polite"><i class="bar top"></i><i class="bar bottom"></i><div><small></small><strong></strong><span></span></div></div>
    <div class="captions" id="captions" aria-live="polite"></div>
    <div class="prompt" id="prompt"></div>
    <div class="panel-backdrop" id="panel-backdrop"></div>
    <div class="panel" id="panel" role="dialog" aria-modal="true">
      <button class="panel-close" aria-label="Fermer">×</button>
      <div class="panel-hero">
        <div class="panel-icon"></div>
        <div><span class="panel-kicker"></span><h2></h2></div>
      </div>
      <div class="panel-media"></div>
      <div class="panel-nav"><button class="panel-prev" aria-label="Projet précédent">‹</button><span class="panel-nav-label"></span><button class="panel-next" aria-label="Projet suivant">›</button></div>
      <div class="panel-tags"></div>
      <div class="panel-text"></div>
      <div class="panel-links"></div>
      <div class="panel-foot"><small>E, Échap ou clic à côté pour fermer</small><span class="panel-count"></span></div>
    </div>
    <div class="fade" id="fade"></div>
    <div class="game-hud" id="game-hud"><strong></strong><span class="status"></span><span class="record"></span><small></small></div>
    <div class="toast" id="toast"></div>
    <div class="achievement" id="achievement"><b></b><div><small>Succès débloqué</small><strong></strong><span></span></div></div>
    <div class="bigtext" id="bigtext"></div>
    <div class="help">${intro.controls}</div>
  `
  const $ = (id) => document.getElementById(id)
  const islandName = $('island-name')
  const prompt = $('prompt')
  const panel = $('panel')
  const fadeEl = $('fade')
  const backdrop = $('panel-backdrop')
  const close = () => {
    if (panel.classList.contains('visible')) handlers.panel?.(false)
    panel.classList.remove('visible')
    backdrop.classList.remove('visible')
  }
  backdrop.addEventListener('pointerdown', close)
  panel.querySelector('.panel-close').addEventListener('click', close)
  // Navigation entre projets d'un même lieu (boutons ‹ › et flèches du clavier).
  let nav = null
  panel.querySelector('.panel-prev').addEventListener('click', () => nav?.prev())
  panel.querySelector('.panel-next').addEventListener('click', () => nav?.next())
  window.addEventListener('keydown', (e) => {
    if (!nav || !panel.classList.contains('visible')) return
    if (e.code === 'ArrowLeft') nav.prev()
    if (e.code === 'ArrowRight') nav.next()
  })
  const handlers = { character: null, start: null, tour: null, tourNext: null, tourStop: null, mute: null, music: null, about: null }
  root.querySelectorAll('.char').forEach((b) => b.addEventListener('click', () => {
    root.querySelectorAll('.char').forEach((o) => o.classList.toggle('active', o === b))
    handlers.character?.(b.dataset.key)
  }))
  const begin = (tour) => {
    $('intro').classList.add('hidden')
    $('hello').classList.remove('visible')
    root.classList.add('playing')
    handlers.start?.(tour)
  }
  $('start').addEventListener('click', () => begin(false))
  $('start-tour').addEventListener('click', () => begin(true))
  $('btn-tour').addEventListener('click', () => handlers.tour?.())
  $('start-list').addEventListener('click', () => handlers.list?.())
  $('btn-list').addEventListener('click', () => handlers.list?.())
  $('btn-settings').addEventListener('click', () => handlers.settings?.())
  $('btn-trophies').addEventListener('click', () => handlers.trophies?.())
  $('btn-mute').addEventListener('click', () => handlers.mute?.())
  $('btn-music').addEventListener('click', () => handlers.music?.())
  $('brand').addEventListener('click', () => handlers.about?.())
  $('tour-bar').addEventListener('click', (e) => {
    const act = e.target.closest('button')?.dataset.act
    if (act === 'next') handlers.tourNext?.()
    if (act === 'stop') handlers.tourStop?.()
  })
  let islandTimer = null
  let toastTimer = null
  let achTimer = null
  const achQueue = []

  return {
    // cb(tour) : tour = true si le visiteur a choisi la visite guidée.
    onStart(cb) {
      handlers.start = cb
    },
    on(name, cb) {
      handlers[name] = cb
    },
    selectCharacter(key) {
      root.querySelectorAll('.char').forEach((o) => o.classList.toggle('active', o.dataset.key === key))
    },
    // Bulle « Salut » au-dessus de l'avatar sur l'écran d'accueil (coordonnées écran).
    setHello(x, y, visible) {
      const el = $('hello')
      el.classList.toggle('visible', visible)
      if (visible) el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px) translate(-50%, -100%)`
    },
    setSound({ muted, music }) {
      $('btn-mute').textContent = muted ? '🔇' : '🔊'
      $('btn-mute').title = muted ? 'Remettre le son' : 'Couper le son'
      $('btn-music').classList.toggle('off', !music || muted)
      $('btn-music').title = music && !muted ? 'Couper la musique' : 'Activer la musique'
    },
    setQuest({ found, total, ready, opened }) {
      const chip = $('quest-chip')
      chip.querySelector('span').textContent = opened ? 'Quête accomplie' : ready ? 'Le coffre est prêt !' : `${found} / ${total}`
      chip.classList.toggle('ready', ready && !opened)
    },
    setDay({ icon, text }) {
      $('day-chip').textContent = `${icon} ${text}`
    },
    setTour(state) {
      const bar = $('tour-bar')
      bar.classList.toggle('visible', !!state)
      root.classList.toggle('touring', !!state)
      if (!state) return
      bar.querySelector('.tour-step').textContent = `Visite guidée · ${state.index} / ${state.total}`
      bar.querySelector('.tour-progress i').style.width = `${Math.round(state.progress * 100)}%`
    },
    setGameHud(title, status, record, hint) {
      const hud = $('game-hud')
      hud.classList.toggle('visible', !!title)
      if (!title) return
      hud.querySelector('strong').textContent = title
      hud.querySelector('.status').textContent = status
      hud.querySelector('.record').textContent = record
      hud.querySelector('small').textContent = hint
    },
    // Grand texte au centre (compte à rebours, combos), qui apparaît puis s'efface.
    bigText(text, small = false) {
      const el = $('bigtext')
      el.textContent = text
      el.classList.toggle('small', small)
      el.classList.remove('pop')
      void el.offsetWidth
      el.classList.add('pop')
    },
    toast(text) {
      const toast = $('toast')
      toast.textContent = text
      toast.classList.add('visible')
      clearTimeout(toastTimer)
      toastTimer = setTimeout(() => toast.classList.remove('visible'), 4000)
    },
    // Petite carte « Succès débloqué » en haut de l'écran (une à la fois).
    achievement(a) {
      achQueue.push(a)
      if (achQueue.length > 1) return
      const show = () => {
        const next = achQueue[0]
        const el = $('achievement')
        el.querySelector('b').textContent = next.icon
        el.querySelector('strong').textContent = next.title
        el.querySelector('span').textContent = next.text
        el.classList.add('visible')
        clearTimeout(achTimer)
        achTimer = setTimeout(() => {
          el.classList.remove('visible')
          setTimeout(() => {
            achQueue.shift()
            if (achQueue.length) show()
          }, 400)
        }, 3200)
      }
      show()
    },
    setTrophies(count) {
      $('btn-trophies').querySelector('i').textContent = count ? String(count) : ''
    },
    setLoading(progress) {
      $('start').textContent = `Chargement… ${Math.round(progress * 100)} %`
    },
    setReady() {
      $('start').disabled = false
      $('start-tour').disabled = false
      $('start').textContent = '▶ Jouer'
    },
    showIsland(name, tagline) {
      islandName.querySelector('strong').textContent = name
      islandName.querySelector('span').textContent = tagline
      islandName.classList.add('visible')
      clearTimeout(islandTimer)
      islandTimer = setTimeout(() => islandName.classList.remove('visible'), 3500)
    },
    setPrompt(text) {
      prompt.textContent = text || ''
      prompt.classList.toggle('visible', !!text)
    },
    // Fiche d'un point d'intérêt : icône, lieu, titre, texte et liens, aux couleurs de l'île.
    openPanel({ title, text, links = [], icon = '✦', kicker = '', era = 'present', count = '', side = false, tags = [], nav: navigation = null, extra = null, media = null }) {
      const mediaBox = panel.querySelector('.panel-media')
      mediaBox.replaceChildren(...(media ? [media] : []))
      panel.classList.toggle('has-media', !!media)
      nav = navigation
      panel.classList.toggle('has-nav', !!nav)
      panel.querySelector('.panel-nav-label').textContent = nav?.label ?? ''
      panel.querySelector('.panel-tags').replaceChildren(...tags.map((tag) => {
        const span = document.createElement('span')
        span.textContent = tag
        return span
      }))
      panel.dataset.era = era
      panel.classList.toggle('side', side)
      backdrop.classList.toggle('light', side)
      panel.querySelector('h2').textContent = title
      panel.querySelector('.panel-icon').textContent = icon
      panel.querySelector('.panel-kicker').textContent = kicker
      panel.querySelector('.panel-count').textContent = count
      const body = panel.querySelector('.panel-text')
      body.replaceChildren(...[].concat(text).flatMap((t) => t.split(/\s(?=\[à compléter)/)).map((paragraph, i) => {
        const p = document.createElement('p')
        const todo = /^\[à compléter/.test(paragraph)
        p.className = todo ? 'todo' : i === 0 ? 'lead' : ''
        p.textContent = todo ? paragraph.replace(/^\[|\]$/g, '') : paragraph
        return p
      }))
      if (extra) body.append(extra)
      panel.querySelector('.panel-links').replaceChildren(...links.map(({ label, url, primary }) => {
        const a = document.createElement('a')
        if (primary) a.className = 'primary'
        a.href = url
        a.textContent = `${label} ↗`
        a.target = '_blank'
        a.rel = 'noopener'
        return a
      }))
      panel.scrollTop = 0
      const wasOpen = panel.classList.contains('visible')
      panel.classList.add('visible')
      backdrop.classList.add('visible')
      if (!wasOpen) {
        handlers.panel?.(true)
        // Clavier : le focus va dans la fiche (Tab pour parcourir les liens).
        panel.querySelector('.panel-close').focus({ preventScroll: true })
      }
    },
    closePanel() {
      close()
    },
    navStep(dir) {
      if (!nav || !panel.classList.contains('visible')) return
      if (dir < 0) nav.prev()
      else nav.next()
    },
    // Objectif en cours (haut de l'écran) ; angle = direction à l'écran, en degrés.
    setObjective(text, angle = null) {
      const el = $('objective')
      el.classList.toggle('visible', !!text)
      if (!text) return
      if (el.dataset.text !== text) {
        el.dataset.text = text
        el.querySelector('span').textContent = text
      }
      const arrow = el.querySelector('i')
      arrow.style.visibility = angle === null ? 'hidden' : 'visible'
      if (angle !== null) arrow.style.transform = `rotate(${angle.toFixed(1)}deg)`
    },
    onObjective(cb) {
      $('objective').onclick = cb
    },
    // Repère doré au-dessus du prochain point (ou au bord de l'écran s'il est hors champ).
    setMarker(state) {
      const el = $('guide-marker')
      el.classList.toggle('visible', !!state)
      if (!state) return
      el.classList.toggle('edge', !!state.edge)
      el.style.transform = `translate(${Math.round(state.x)}px, ${Math.round(state.y)}px) translate(-50%, -50%)`
      el.firstChild.style.transform = state.edge ? `rotate(${(state.angle - 90).toFixed(1)}deg)` : ''
    },
    // Arrivée sur une nouvelle époque : carte de titre façon cinéma.
    eraCard(era, kicker, name, tagline) {
      const el = $('era-card')
      el.dataset.era = era
      el.querySelector('small').textContent = kicker
      el.querySelector('strong').textContent = name
      el.querySelector('span').textContent = tagline
      el.classList.remove('visible')
      void el.offsetWidth
      el.classList.add('visible')
      clearTimeout(el.timer)
      el.timer = setTimeout(() => el.classList.remove('visible'), 3600)
    },
    // Sous-titres des sons (option d'accessibilité).
    caption(text) {
      const box = $('captions')
      const line = document.createElement('div')
      line.textContent = text
      box.append(line)
      while (box.children.length > 3) box.firstChild.remove()
      setTimeout(() => line.remove(), 2800)
    },
    panelOpen() {
      return panel.classList.contains('visible')
    },
    fade(midway) {
      fadeEl.classList.add('visible')
      setTimeout(() => {
        midway()
        fadeEl.classList.remove('visible')
      }, 450)
    },
  }
}
