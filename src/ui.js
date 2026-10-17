import { intro } from './content.js'

export function createUI() {
  const root = document.getElementById('ui')
  root.innerHTML = `
    <div class="intro" id="intro">
      <h1>${intro.title}</h1>
      <p>${intro.subtitle}</p>
      <p class="controls">${intro.controls}</p>
      <button id="start" disabled>Chargement…</button>
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
  let islandTimer = null
  let toastTimer = null

  return {
    onStart(cb) {
      $('start').addEventListener('click', () => {
        $('intro').classList.add('hidden')
        root.classList.add('playing')
        cb()
      })
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
    openPanel({ title, text, links = [], icon = '✦', kicker = '', era = 'present', count = '' }) {
      panel.dataset.era = era
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
      panel.querySelector('.panel-links').replaceChildren(...links.map(({ label, url }) => {
        const a = document.createElement('a')
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
