// Succès à débloquer et classements des mini-jeux.
// Les succès et le classement local restent dans le navigateur (localStorage). Les scores
// partent aussi au classement mondial quand le serveur du site répond (src/leaderboard.js).
import { globalLines } from './leaderboard.js'

const ACH_KEY = 'aventure-time-aq:achievements'
const BOARD_KEY = 'aventure-time-aq:board'
const BOARD_SIZE = 5

export const ACHIEVEMENTS = [
  { id: 'first-steps', icon: '👣', title: 'Premiers pas', text: 'Lire ton premier point d\'intérêt.' },
  { id: 'past', icon: '🏰', title: 'Historien', text: 'Découvrir tous les points de l\'île du Passé.' },
  { id: 'present', icon: '🏘️', title: 'Habitué du village', text: 'Découvrir tous les points de l\'île du Présent.' },
  { id: 'future', icon: '🚀', title: 'Explorateur spatial', text: 'Découvrir tous les points de l\'île du Futur.' },
  { id: 'chest', icon: '🗝️', title: 'Le coffre final', text: 'Tout découvrir et ouvrir le coffre avec mon CV.' },
  { id: 'tour', icon: '🧭', title: 'Touriste', text: 'Suivre la visite guidée jusqu\'au bout.' },
  { id: 'social', icon: '🤝', title: 'Restons en contact', text: 'Ouvrir un de mes réseaux depuis la place des réseaux.' },
  { id: 'library', icon: '📚', title: 'Rat de bibliothèque', text: 'Entrer dans la bibliothèque du château.' },
  { id: 'driver', icon: '🚗', title: 'Pilote', text: 'Prendre le volant de la voiture rouge.' },
  { id: 'flight', icon: '🛫', title: 'Cascadeur', text: 'S\'envoler depuis un tremplin en voiture.' },
  { id: 'rocket', icon: '🌙', title: 'Décollage', text: 'Voyager en fusée.' },
  { id: 'goal', icon: '⚽', title: 'But !', text: 'Pousser le ballon dans le but du stade.' },
  { id: 'strike', icon: '🎳', title: 'Strike', text: 'Renverser toutes les quilles.' },
  { id: 'first-game', icon: '🎮', title: 'Joueur', text: 'Gagner un premier mini-jeu.' },
  { id: 'gold', icon: '🥇', title: 'Médaille d\'or', text: 'Décrocher une médaille d\'or.' },
  { id: 'combo', icon: '🔥', title: 'En feu', text: 'Faire un combo ×5 dans un mini-jeu.' },
  { id: 'all-games', icon: '🏁', title: 'Touche-à-tout', text: 'Gagner tous les mini-jeux au moins une fois.' },
  { id: 'all-gold', icon: '👑', title: 'Légende', text: 'L\'or dans tous les mini-jeux.' },
  { id: 'night', icon: '🌌', title: 'Oiseau de nuit', text: 'Rester jusqu\'à la nuit.' },
  { id: 'secrets', icon: '✨', title: 'Chasseur de secrets', text: 'Trouver les trois étoiles cachées au bord des îles.' },
  { id: 'relic', icon: '🗿', title: 'Fouineur', text: 'Trouver une relique cachée.' },
  { id: 'relics', icon: '🏺', title: 'Archéologue du temps', text: 'Trouver les trois reliques cachées, une par époque.' },
  { id: 'konami', icon: '🕹️', title: 'Vieille école', text: 'Taper un code bien connu des joueurs.' },
  { id: 'chatty', icon: '💬', title: 'Bavard', text: 'Parler à un habitant des îles.' },
  { id: 'sociable', icon: '🤝', title: 'Ami de tous', text: 'Discuter avec huit habitants différents.' },
  { id: 'skier', icon: '⛷️', title: 'Skieur', text: 'Finir la descente de ski.' },
  { id: 'ski-gold', icon: '🏔️', title: 'Champion des pistes', text: 'Décrocher l\'or à la descente de ski (1900 points).' },
  { id: 'footballer', icon: '⚽', title: 'Coup d\'envoi', text: 'Jouer un match de foot complet au stade.' },
  { id: 'foot-win', icon: '🏆', title: 'Victoire !', text: 'Gagner un match de foot.' },
  { id: 'hat-trick', icon: '🎩', title: 'Coup du chapeau', text: 'Marquer trois buts dans un même match.' },
  { id: 'arcade', icon: '🕹️', title: 'Insère une pièce', text: 'Jouer une partie à la borne d\'arcade du château.' },
  { id: 'arcade-all', icon: '👾', title: 'Pilier d\'arcade', text: 'Jouer aux six jeux de la borne d\'arcade.' },
  { id: 'photographer', icon: '📷', title: 'Photographe', text: 'Prendre une photo avec le mode photo.' },
  { id: 'photo-album', icon: '🖼️', title: 'Album souvenir', text: 'Prendre cinq photos.' },
  { id: 'astronomer', icon: '🔭', title: 'Astronome', text: 'Observer les huit planètes au télescope du Futur.' },
]

function load(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) || fallback
  } catch {
    return fallback
  }
}

function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Navigation privée : on garde en mémoire pour cette visite seulement.
  }
}

export function createRewards(ui, sfx = null, leaderboard = null) {
  const unlocked = load(ACH_KEY, {})
  const board = load(BOARD_KEY, {})
  const listeners = []
  const sent = new Map() // game.id -> promesse du dernier envoi au classement mondial

  const api = {
    unlocked,
    board,
    leaderboard,
    has: (id) => !!unlocked[id],
    count: () => ACHIEVEMENTS.filter((a) => unlocked[a.id]).length,
    onChange(cb) {
      listeners.push(cb)
    },
    unlock(id) {
      const a = ACHIEVEMENTS.find((x) => x.id === id)
      if (!a || unlocked[id]) return false
      unlocked[id] = Date.now()
      save(ACH_KEY, unlocked)
      ui.achievement?.(a)
      sfx?.blip?.('achievement')
      for (const cb of listeners) cb()
      return true
    },
    // Ajoute un résultat au classement local d'un jeu. Renvoie le rang (1 = premier) ou 0.
    defaultName: null, // fonction : nom affiché quand le jeu n'en donne pas
    record(game, value, who = api.defaultName?.()) {
      const list = board[game.id] ?? []
      const entry = { v: +value.toFixed(game.score ? 0 : 1), d: Date.now(), who }
      list.push(entry)
      list.sort((a, b) => (game.score ? b.v - a.v : a.v - b.v) || a.d - b.d)
      board[game.id] = list.slice(0, BOARD_SIZE)
      save(BOARD_KEY, board)
      const rank = board[game.id].indexOf(entry) + 1
      if (leaderboard && who !== 'Ancien record') sent.set(game.id, leaderboard.submit(game, entry.v, who))
      for (const cb of listeners) cb()
      return rank
    },
    // Classement mondial d'un jeu (après un envoi : avec « ← toi »). Promesse de lignes, ou null hors ligne.
    async globalBoard(game) {
      if (!leaderboard) return null
      const pending = sent.get(game.id)
      sent.delete(game.id)
      const r = pending ? await pending : null
      const top = r?.top ?? (await leaderboard.top(game.id))
      return top ? globalLines(game, top, r?.rank ?? 0) : null
    },
    best(game) {
      return board[game.id]?.[0]?.v
    },
    // Lignes du classement d'un jeu, prêtes à afficher.
    lines(game, highlight = 0) {
      const fmt = (v) => (game.score ? `${v} pts` : `${v.toFixed(1)} s`)
      const date = (d) => new Date(d).toLocaleDateString('fr-CH', { day: '2-digit', month: '2-digit' })
      return (board[game.id] ?? []).map((e, i) => `${['🥇', '🥈', '🥉', '4.', '5.'][i]} ${fmt(e.v)} · ${e.who ?? 'Aventurier'} · ${date(e.d)}${i + 1 === highlight ? '  ← toi' : ''}`)
    },
  }
  return api
}

// Fenêtre « Trophées » : succès et classements, construite en éléments HTML.
export function trophiesView(rewards, games, medalFor) {
  const root = document.createElement('div')
  root.className = 'trophies'
  const h = (tag, cls, text) => {
    const el = document.createElement(tag)
    if (cls) el.className = cls
    if (text !== undefined) el.textContent = text
    return el
  }
  root.append(h('h3', '', `Succès · ${rewards.count()} / ${ACHIEVEMENTS.length}`))
  const grid = h('div', 'ach-grid')
  for (const a of ACHIEVEMENTS) {
    const done = rewards.has(a.id)
    const card = h('div', `ach${done ? ' done' : ''}`)
    card.append(h('b', '', done ? a.icon : '🔒'), h('strong', '', a.title), h('small', '', a.text))
    grid.append(card)
  }
  root.append(grid, h('h3', '', 'Classement local des mini-jeux'))
  const table = h('div', 'board')
  for (const g of games) {
    const row = h('div', 'board-row')
    const best = rewards.best(g)
    const medal = best === undefined ? '·' : medalFor(g, best).icon
    row.append(h('span', 'board-medal', medal), h('strong', '', g.title), h('span', 'board-best', best === undefined ? 'à jouer' : g.score ? `${best} pts` : `${best.toFixed(1)} s`))
    table.append(row)
  }
  root.append(table)
  const lb = rewards.leaderboard
  if (!lb) {
    root.append(h('p', 'board-note', 'Scores gardés sur cet appareil uniquement.'))
    return root
  }
  // Classement mondial : pseudo et meilleurs joueurs, remplis dès que le serveur répond.
  const world = h('div', 'board-world')
  const note = h('p', 'board-note', 'Classement mondial : connexion…')
  root.append(h('h3', '', 'Classement mondial'), note, world)
  lb.ready.then((online) => {
    if (!online) {
      note.textContent = 'Classement mondial indisponible pour le moment : tes scores restent sur cet appareil.'
      return
    }
    note.textContent = 'Tes meilleurs scores sont envoyés avec ce pseudo.'
    const form = h('label', 'pseudo')
    const input = document.createElement('input')
    input.maxLength = 16
    input.placeholder = 'Ton pseudo'
    input.value = lb.name
    input.addEventListener('keydown', (e) => e.stopPropagation())
    input.addEventListener('change', () => (input.value = lb.setName(input.value)))
    form.append(h('span', '', 'Pseudo'), input)
    note.after(form)
    for (const g of games) {
      const block = h('div', 'board-row world-row')
      const list = h('small', 'world-list', '…')
      block.append(h('strong', '', g.title), list)
      world.append(block)
      lb.top(g.id).then((top) => (list.textContent = top?.length ? globalLines(g, top).slice(0, 3).join('   ') : 'Personne encore : à toi de jouer !'))
    }
  })
  return root
}
