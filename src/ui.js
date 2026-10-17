import { intro } from './content.js'

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
        <span class="intro-kicker">Portfolio interactif</span>
        <h1>${intro.title}</h1>
        <p>${intro.subtitle}</p>
        <div class="pick">
          <span>Choisis ton personnage</span>
          <div class="chars">${CHARACTERS.map((c) => `<button class="char" data-key="${c.key}"><b>${c.icon}</b>${c.name}</button>`).join('')}</div>
        </div>
        <div class="intro-actions">
          <button id="start" disabled>Chargement…</button>
          <button id="start-tour" class="ghost" disabled>🧭 Visite guidée (2 min)</button>
        </div>
        <p class="controls">${intro.controls}</p>
      </div>
    </div>
    <div class="hello" id="hello">Salut, moi c'est Antoine ! 👋</div>
    <div class="hud-right" id="hud-right">
      <div class="quest-chip" id="quest-chip" title="Quête : découvre tous les points pour ouvrir le coffre final"><b>🗝️</b><span></span></div>
      <div class="hud-chip" id="day-chip"></div>
      <button class="hud-btn" id="btn-tour" title="Visite guidée">🧭</button>
      <button class="hud-btn" id="btn-mute" title="Couper le son">🔊</button>
    </div>
    <div class="tour-bar" id="tour-bar">
      <span class="tour-step"></span>
      <div class="tour-progress"><i></i></div>
      <button data-act="next">Suivant ›</button>
      <button data-act="stop">Arrêter</button>
    </div>
    <div class="island-name" id="island-name"><strong></strong><span></span></div>
    <div class="prompt" id="prompt"></div>
    <div class="panel-backdrop" id="panel-backdrop"></div>
    <div class="panel" id="panel" role="dialog" aria-modal="true">
      <button class="panel-close" aria-label="Fermer">×</button>
      <div class="panel-hero">
        <div class="panel-icon"></div>
        <div><span class="panel-kicker"></span><h2></h2></div>
      </div>
      <div class="panel-text"></div>
      <div class="panel-links"></div>
      <div class="panel-foot"><small>E, Échap ou clic à côté pour fermer</small><span class="panel-count"></span></div>
    </div>
    <div class="fade" id="fade"></div>
    <div class="game-hud" id="game-hud"><strong></strong><span class="status"></span><span class="record"></span><small></small></div>
    <div class="toast" id="toast"></div>
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
    panel.classList.remove('visible')
    backdrop.classList.remove('visible')
  }
  backdrop.addEventListener('pointerdown', close)
  panel.querySelector('.panel-close').addEventListener('click', close)
  const handlers = { character: null, start: null, tour: null, tourNext: null, tourStop: null, mute: null }
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
  $('btn-mute').addEventListener('click', () => handlers.mute?.())
  $('tour-bar').addEventListener('click', (e) => {
    const act = e.target.closest('button')?.dataset.act
    if (act === 'next') handlers.tourNext?.()
    if (act === 'stop') handlers.tourStop?.()
  })
  let islandTimer = null
  let toastTimer = null

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
    setMuted(muted) {
      $('btn-mute').textContent = muted ? '🔇' : '🔊'
      $('btn-mute').title = muted ? 'Remettre le son' : 'Couper le son'
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
    setLoading(progress) {
      $('start').textContent = `Chargement… ${Math.round(progress * 100)} %`
    },
    setReady() {
      $('start').disabled = false
      $('start-tour').disabled = false
      $('start').textContent = 'Commencer l\'aventure'
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
    openPanel({ title, text, links = [], icon = '✦', kicker = '', era = 'present', count = '', side = false }) {
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
      panel.classList.add('visible')
      backdrop.classList.add('visible')
    },
    closePanel() {
      panel.classList.remove('visible')
      backdrop.classList.remove('visible')
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
