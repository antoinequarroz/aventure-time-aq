// Classement mondial : envoie les scores au petit serveur du site (/api, voir server/leaderboard.mjs).
// Si le serveur ne répond pas (aperçu, hors ligne), tout continue avec le classement local.

const NAME_KEY = 'aventure-time-aq:pseudo'
const BASE = (import.meta.env.VITE_SCORES_URL ?? '/api').replace(/\/$/, '')
const TIMEOUT = 2500

async function call(path, options = {}) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT)
  try {
    const res = await fetch(`${BASE}${path}`, { ...options, signal: ctrl.signal, headers: { 'content-type': 'application/json' } })
    if (!res.ok) return null
    if (!(res.headers.get('content-type') ?? '').includes('json')) return null
    return await res.json()
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

export function cleanName(name) {
  return String(name ?? '')
    .replace(/[^\p{L}\p{N} _.\-']/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 16)
}

export function createLeaderboard() {
  let online = null // null = pas encore testé
  let name = ''
  try {
    name = localStorage.getItem(NAME_KEY) ?? ''
  } catch {
    name = ''
  }
  const cache = new Map()
  const listeners = []
  const ready = call('/health').then((r) => {
    online = !!r?.ok
    for (const cb of listeners) cb(online)
    return online
  })

  return {
    ready,
    get online() {
      return online
    },
    onStatus(cb) {
      listeners.push(cb)
      if (online !== null) cb(online)
    },
    get name() {
      return name
    },
    setName(value) {
      name = cleanName(value)
      try {
        localStorage.setItem(NAME_KEY, name)
      } catch {
        // Navigation privée.
      }
      return name
    },
    // Envoie un résultat. Renvoie { rank, top } ou null si le serveur n'est pas joignable.
    async submit(game, value, fallbackName) {
      if (!(await ready)) return null
      const r = await call('/scores', { method: 'POST', body: JSON.stringify({ game: game.id, value, name: name || fallbackName }) })
      if (r?.top) cache.set(game.id, { at: Date.now(), top: r.top })
      return r
    },
    // Meilleurs scores mondiaux d'un jeu (gardés 30 s), ou null.
    async top(gameId) {
      if (!(await ready)) return null
      const hit = cache.get(gameId)
      if (hit && Date.now() - hit.at < 30_000) return hit.top
      const r = await call(`/scores?game=${encodeURIComponent(gameId)}`)
      if (!r?.top) return null
      cache.set(gameId, { at: Date.now(), top: r.top })
      return r.top
    },
  }
}

// Lignes prêtes à afficher pour un classement mondial.
export function globalLines(game, top, rank = 0) {
  const fmt = (v) => (game.score ? `${v} pts` : `${(+v).toFixed(1)} s`)
  const marks = ['🥇', '🥈', '🥉']
  return top.map((e, i) => `${marks[i] ?? `${i + 1}.`} ${fmt(e.v)} · ${e.name}${i + 1 === rank ? '  ← toi' : ''}`)
}
