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
    <div class="panel" id="panel">
      <h2></h2>
      <div class="panel-text"></div>
      <div class="panel-links"></div>
      <small>E ou Échap pour fermer</small>
    </div>
    <div class="fade" id="fade"></div>
    <div class="game-hud" id="game-hud"><strong></strong><span class="status"></span><span class="record"></span><small></small></div>
    <div class="toast" id="toast"></div>
    <div class="help">${intro.controls}</div>
  `
  const $ = (id) => document.getElementById(id)
  const islandName = $('island-name')
  const prompt = $('prompt')
  const panel = $('panel')
  const fadeEl = $('fade')
  let islandTimer = null
  let toastTimer = null

  return {
    onStart(cb) {
      $('start').addEventListener('click', () => {
        $('intro').classList.add('hidden')
        root.classList.add('playing')
        $('start').blur()
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
    openPanel(title, text, links = []) {
      panel.querySelector('h2').textContent = title
      const body = panel.querySelector('.panel-text')
      body.replaceChildren(...[].concat(text).map((paragraph) => {
        const p = document.createElement('p')
        p.textContent = paragraph
        return p
      }))
      panel.querySelector('.panel-links').replaceChildren(...links.map(({ label, url }) => {
        const a = document.createElement('a')
        a.href = url
        a.textContent = label
        a.target = '_blank'
        a.rel = 'noopener'
        return a
      }))
      panel.classList.add('visible')
    },
    closePanel() {
      panel.classList.remove('visible')
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
