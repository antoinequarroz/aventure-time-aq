// Version liste du portfolio : tout le contenu sur une seule page, sans jouer.
// Pensée pour les recruteurs pressés : projets, parcours, passions et contact.
// Ouverte depuis l'écran d'accueil (« Voir en liste »), le bouton 📄 en jeu, ou l'adresse ?liste.

import { intro, about, showcases, quest, islands, socials } from './content.js'
import { drawVisual, VISUAL_W, VISUAL_H } from './world/screens.js'

const h = (tag, cls, text) => {
  const el = document.createElement(tag)
  if (cls) el.className = cls
  if (text !== undefined) el.textContent = text
  return el
}

// Paragraphes, avec les mentions « [à compléter …] » mises à part.
function paragraphs(text) {
  return [].concat(text).flatMap((t) => t.split(/\s(?=\[à compléter)/)).map((t) => {
    const todo = /^\[à compléter/.test(t)
    return h('p', todo ? 'todo' : '', todo ? t.replace(/^\[|\]$/g, '') : t)
  })
}

function link({ label, url, primary }) {
  const a = h('a', primary ? 'btn primary' : 'btn', label)
  a.href = url
  if (!url.startsWith('mailto:') && !url.startsWith('tel:')) {
    a.target = '_blank'
    a.rel = 'noopener'
  }
  return a
}

// Vignette d'un projet : sa capture, ou la maquette dessinée du jeu.
function thumb(project) {
  const canvas = h('canvas', 'list-thumb')
  canvas.width = VISUAL_W / 2
  canvas.height = VISUAL_H / 2
  canvas.setAttribute('role', 'img')
  canvas.setAttribute('aria-label', `Aperçu de ${project.title}`)
  const g = canvas.getContext('2d')
  const draw = () => {
    g.clearRect(0, 0, canvas.width, canvas.height)
    drawVisual(g, project, 0, 0, canvas.width, canvas.height, draw)
  }
  canvas.draw = draw
  return canvas
}

export function createListView({ onPlay }) {
  const root = h('div', 'list-view')
  root.setAttribute('role', 'dialog')
  root.setAttribute('aria-label', 'Portfolio en version liste')
  const page = h('div', 'list-page')
  root.append(page)

  // En-tête.
  const head = h('header', 'list-head')
  const id = h('div', 'list-id')
  id.append(h('span', 'list-kicker', 'Portfolio · version liste'), h('h1', '', intro.title), h('p', 'list-role', intro.role))
  const actions = h('div', 'list-actions')
  const play = h('button', 'btn primary', '▶ Jouer à la version 3D')
  play.addEventListener('click', () => onPlay?.())
  actions.append(link({ label: '✉️ Me contacter', url: about.links[0].url }), play)
  head.append(id, actions)
  const nav = h('nav', 'list-nav')
  for (const [anchor, label] of [['projets', 'Projets'], ['parcours', 'Parcours et CV'], ['passions', 'Passions'], ['contact', 'Contact']]) {
    const a = h('a', '', label)
    a.href = `#liste-${anchor}`
    a.addEventListener('click', (e) => {
      e.preventDefault()
      page.querySelector(`#liste-${anchor}`)?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
    })
    nav.append(a)
  }
  const close = h('button', 'list-close', '×')
  close.setAttribute('aria-label', 'Fermer la version liste')
  close.addEventListener('click', () => api.close())
  page.append(close, head, nav)

  const section = (anchor, title, lead) => {
    const s = h('section', 'list-section')
    s.id = `liste-${anchor}`
    s.append(h('h2', '', title))
    if (lead) s.append(h('p', 'list-lead', lead))
    page.append(s)
    return s
  }

  // À propos.
  const aboutSec = section('apropos', 'En bref')
  aboutSec.append(...paragraphs(about.text.slice(0, 1)))

  // Projets, groupés comme dans le jeu.
  const projectsSec = section('projets', 'Projets', `${showcases.reduce((n, p) => n + p.projects.length, 0)} projets publiés, du site vitrine à l'appli mobile.`)
  const thumbs = []
  for (const place of showcases) {
    projectsSec.append(h('h3', '', `${place.icon} ${place.kicker}`))
    const grid = h('div', 'list-grid')
    for (const p of place.projects) {
      const card = h('article', 'list-card')
      const t = thumb(p)
      thumbs.push(t)
      const body = h('div', 'list-card-body')
      body.append(h('h4', '', p.title), h('p', 'list-tagline', p.tagline))
      body.append(...paragraphs(p.text))
      const tags = h('div', 'list-tags')
      for (const tech of p.tech ?? []) tags.append(h('span', '', tech))
      const links = h('div', 'list-links')
      p.links.forEach((l, i) => links.append(link({ ...l, primary: i === 0 })))
      body.append(tags, links)
      card.append(t, body)
      grid.append(card)
    }
    projectsSec.append(grid)
  }

  // Parcours et CV.
  const cvSec = section('parcours', 'Parcours et CV')
  const chapters = islands.flatMap((i) => i.signs).filter((s) => s.room === 'library')
  for (const c of chapters) {
    const block = h('div', 'list-block')
    block.append(h('h3', '', `${c.icon} ${c.title}`), ...paragraphs(c.text))
    cvSec.append(block)
  }
  const cv = h('div', 'list-block cv')
  cv.append(h('h3', '', `📜 ${quest.cv.title}`), ...paragraphs(quest.cv.text))
  const cvLinks = h('div', 'list-links')
  quest.cv.links.forEach((l) => cvLinks.append(link(l)))
  cv.append(cvLinks)
  cvSec.append(cv)

  // Passions et compétences : les autres points des îles.
  const passionsSec = section('passions', 'Compétences et passions')
  const grid = h('div', 'list-grid small')
  for (const island of islands) {
    for (const s of island.signs) {
      if (s.room === 'library' || s.title === 'Contact') continue
      const card = h('article', `list-card mini era-${island.id}`)
      card.append(h('h4', '', `${s.icon ?? '✦'} ${s.title}`), ...paragraphs(s.text))
      if (s.links?.length) {
        const links = h('div', 'list-links')
        s.links.forEach((l) => links.append(link(l)))
        card.append(links)
      }
      grid.append(card)
    }
  }
  passionsSec.append(grid)

  // Contact.
  const contactSec = section('contact', 'Contact', 'Une idée, un projet, un poste ? Écris-moi, je réponds vite.')
  const socialsRow = h('div', 'list-socials')
  for (const s of socials) {
    const a = link({ label: s.label, url: s.url })
    a.title = s.text
    socialsRow.append(a)
  }
  contactSec.append(socialsRow)
  page.append(h('footer', 'list-foot', 'Ce portfolio est aussi un jeu : trois îles à explorer, des mini-jeux et des secrets.'))

  let drawn = false
  const api = {
    el: root,
    get open() {
      return root.classList.contains('visible')
    },
    show() {
      if (!root.isConnected) document.body.append(root)
      root.classList.add('visible')
      document.body.classList.add('list-open')
      page.scrollTop = 0
      // Vignettes dessinées au premier affichage (17 petits canevas, c'est rapide).
      if (!drawn) {
        drawn = true
        requestAnimationFrame(() => thumbs.forEach((t) => t.draw()))
      }
      close.focus({ preventScroll: true })
    },
    close() {
      root.classList.remove('visible')
      document.body.classList.remove('list-open')
    },
  }
  root.addEventListener('keydown', (e) => {
    if (e.code === 'Escape') {
      e.stopPropagation()
      api.close()
    }
  })
  return api
}
