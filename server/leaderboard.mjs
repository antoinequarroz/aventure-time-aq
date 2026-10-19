#!/usr/bin/env node
// Classement mondial des mini-jeux d'Aventure Time AQ.
// Petit serveur HTTP sans dépendance : les scores sont gardés dans un fichier JSON.
// nginx lui transmet les requêtes /api/ (voir deploy/nginx-aventuretime.conf).
//
//   PORT=8787 DATA_FILE=/var/lib/aventuretime/scores.json node server/leaderboard.mjs
//
// GET  /api/health                 -> { ok: true }
// GET  /api/scores?game=ski        -> { game, top: [{ name, v, d }] }
// POST /api/scores { game, value, name } -> { rank, top }

import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'

const PORT = +(process.env.PORT || 8787)
const HOST = process.env.HOST || '127.0.0.1'
const DATA_FILE = process.env.DATA_FILE || path.resolve('scores.json')
const TOP = 10
const KEEP = 50

// Jeux acceptés : sens du classement et bornes plausibles.
// score = plus c'est haut, mieux c'est. time = plus c'est court, mieux c'est (secondes).
const SCORE = (max) => ({ score: true, min: 0, max })
const TIME = { score: false, min: 2, max: 900 }
export const GAMES = {
  ski: SCORE(6000),
  foot: SCORE(20000),
  snake: SCORE(5000),
  bricks: SCORE(20000),
  dragon: SCORE(2000),
  invaders: SCORE(50000),
  blocks: SCORE(100000),
  pong: SCORE(2000),
  'past-arena': SCORE(400),
  'present-arena': SCORE(400),
  'future-arena': SCORE(400),
}
for (const era of ['past', 'present', 'future'])
  for (const sat of { past: ['ruins', 'camp', 'lake'], present: ['rooftops', 'park', 'stadium'], future: ['asteroids', 'crystals', 'orbit'] }[era]) GAMES[`${era}-${sat}`] = TIME

// --- stockage -------------------------------------------------------------
let db = {}
try {
  db = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'))
} catch {
  db = {}
}
let saveTimer = null
function save() {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true })
    const tmp = `${DATA_FILE}.tmp`
    fs.writeFileSync(tmp, JSON.stringify(db))
    fs.renameSync(tmp, DATA_FILE)
  }, 300)
}

// --- règles ---------------------------------------------------------------
export function cleanName(name) {
  const s = String(name ?? '')
    .normalize('NFC')
    .replace(/[^\p{L}\p{N} _.\-']/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 16)
  return s.length >= 2 ? s : 'Aventurier'
}

export function insert(list, rules, entry) {
  list.push(entry)
  list.sort((a, b) => (rules.score ? b.v - a.v : a.v - b.v) || a.d - b.d)
  list.length = Math.min(list.length, KEEP)
  return list.indexOf(entry) + 1
}

const top = (game) => (db[game] ?? []).slice(0, TOP).map(({ name, v, d }) => ({ name, v, d }))

// Limite : 12 envois par minute et par adresse.
const hits = new Map()
function limited(ip) {
  const now = Date.now()
  const list = (hits.get(ip) ?? []).filter((t) => now - t < 60_000)
  list.push(now)
  hits.set(ip, list)
  if (hits.size > 5000) hits.clear()
  return list.length > 12
}

// --- HTTP -----------------------------------------------------------------
function send(res, status, body) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'access-control-allow-origin': process.env.ALLOW_ORIGIN || '*',
    'access-control-allow-headers': 'content-type',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
  })
  res.end(status === 204 ? undefined : JSON.stringify(body))
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks = []
    req.on('data', (c) => {
      size += c.length
      if (size > 2048) {
        reject(new Error('too big'))
        req.destroy()
      } else chunks.push(c)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

export function handler(req, res) {
  const url = new URL(req.url, 'http://x')
  const route = url.pathname.replace(/^\/api/, '')
  if (req.method === 'OPTIONS') return send(res, 204)
  if (route === '/health') return send(res, 200, { ok: true })
  if (route !== '/scores') return send(res, 404, { error: 'not found' })

  if (req.method === 'GET') {
    const game = url.searchParams.get('game')
    if (!GAMES[game]) return send(res, 400, { error: 'unknown game' })
    return send(res, 200, { game, top: top(game) })
  }
  if (req.method !== 'POST') return send(res, 405, { error: 'method' })

  const ip = String(req.headers['x-real-ip'] || req.socket.remoteAddress || '')
  if (limited(ip)) return send(res, 429, { error: 'slow down' })
  readBody(req)
    .then((raw) => {
      let data
      try {
        data = JSON.parse(raw)
      } catch {
        return send(res, 400, { error: 'json' })
      }
      const rules = GAMES[data?.game]
      const value = Number(data?.value)
      if (!rules) return send(res, 400, { error: 'unknown game' })
      if (!Number.isFinite(value) || value < rules.min || value > rules.max) return send(res, 400, { error: 'value' })
      const entry = { name: cleanName(data.name), v: rules.score ? Math.round(value) : Math.round(value * 10) / 10, d: Date.now() }
      const list = (db[data.game] ??= [])
      const rank = insert(list, rules, entry)
      save()
      send(res, 200, { rank: rank <= TOP ? rank : 0, top: top(data.game) })
    })
    .catch(() => send(res, 413, { error: 'too big' }))
}

if (import.meta.url === `file://${process.argv[1]}`) {
  http.createServer(handler).listen(PORT, HOST, () => console.log(`Classement : http://${HOST}:${PORT}/api/health · ${DATA_FILE}`))
}
