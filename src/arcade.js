// Borne d'arcade du château : un menu et trois petits jeux en pixel art (Serpent, Casse-briques,
// Dragon volant), dessinés sur un canvas basse résolution agrandi sans lissage.
// Module autonome : il crée son overlay au premier `open()` et capture le clavier tant qu'il est ouvert.

const W = 240
const H = 270
const HUD = 22 // bandeau du score en haut de l'écran
const RES = 2 // sur-échantillonnage : pixels nets, texte plus lisible
const STORE_KEY = 'aventure-time-aq:arcade'
const FONT = '"Outfit Variable", "Outfit", sans-serif'

const C = {
  bg: '#070a1f', night: '#140f2e', deep: '#231a4a', line: '#3d3378',
  gold: '#ffd27a', orange: '#ffb347', violet: '#b48cff', violetDark: '#7b5cd6',
  cyan: '#8fe3ff', pink: '#ff6f9f', mint: '#6fd38a', mintDark: '#3f9a5c',
  stone: '#8f88c8', stoneDark: '#3d3378', text: '#f4f1ff', dim: '#9d93c9', ink: '#1a1530',
}

const GAMES = [
  { id: 'snake', name: 'Serpent', desc: 'Mange les gemmes', color: C.mint },
  { id: 'bricks', name: 'Casse-briques', desc: 'Brise tout le mur', color: C.pink },
  { id: 'dragon', name: 'Dragon volant', desc: 'Passe entre les tours', color: C.violet },
]

// --- Meilleurs scores (top 5 par jeu) ---
function loadScores () {
  try {
    const data = JSON.parse(localStorage.getItem(STORE_KEY) || '{}')
    return data && typeof data === 'object' ? data : {}
  } catch { return {} }
}
function bestOf (id) {
  const list = loadScores()[id]
  return Array.isArray(list) && list.length ? Math.max(...list) : 0
}
function submitScore (id, score) {
  const best = bestOf(id)
  try {
    const data = loadScores()
    const list = Array.isArray(data[id]) ? data[id].filter(Number.isFinite) : []
    list.push(score)
    data[id] = list.sort((a, b) => b - a).slice(0, 5)
    localStorage.setItem(STORE_KEY, JSON.stringify(data))
  } catch { /* stockage indisponible : on joue quand même */ }
  return score > 0 && score > best
}

// --- Petits utilitaires de dessin ---
function text (ctx, str, x, y, { color = C.text, size = 10, align = 'center', weight = 'bold', glow = null } = {}) {
  ctx.font = `${weight} ${size}px ${FONT}`
  ctx.textAlign = align
  ctx.textBaseline = 'middle'
  if (glow) {
    ctx.fillStyle = glow
    ctx.fillText(str, x + 1, y + 1)
  }
  ctx.fillStyle = color
  ctx.fillText(str, x, y)
}
function rect (ctx, x, y, w, h, color) {
  ctx.fillStyle = color
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h))
}
function gem (ctx, x, y, s = 1) {
  // Losange doré à facettes
  rect(ctx, x - 1 * s, y - 4 * s, 2 * s, 1 * s, C.gold)
  rect(ctx, x - 3 * s, y - 3 * s, 6 * s, 2 * s, C.gold)
  rect(ctx, x - 4 * s, y - 1 * s, 8 * s, 2 * s, C.orange)
  rect(ctx, x - 3 * s, y + 1 * s, 6 * s, 2 * s, '#e0902e')
  rect(ctx, x - 1 * s, y + 3 * s, 2 * s, 1 * s, '#e0902e')
  rect(ctx, x - 2 * s, y - 3 * s, 1 * s, 1 * s, '#fff6d8')
}
function dragonSprite (ctx, x, y, frame, tilt = 0) {
  ctx.save()
  ctx.translate(Math.round(x), Math.round(y))
  ctx.rotate(tilt)
  rect(ctx, -9, -1, 4, 2, C.violetDark) // queue
  rect(ctx, -11, -2, 2, 2, C.orange)
  rect(ctx, -6, -4, 11, 8, C.violet) // corps
  rect(ctx, -4, 1, 8, 3, C.orange) // ventre
  rect(ctx, 3, -7, 7, 6, C.violet) // tête
  rect(ctx, 9, -5, 3, 3, C.violet) // museau
  rect(ctx, 6, -6, 2, 2, '#fff') // œil
  rect(ctx, 7, -5, 1, 1, C.ink)
  rect(ctx, 4, -9, 2, 2, C.gold) // corne
  const wy = frame ? -9 : -2 // aile haute / basse
  rect(ctx, -4, wy, 7, frame ? 6 : 5, C.violetDark)
  rect(ctx, -3, wy + (frame ? 0 : 4), 5, 2, '#9a7ae8')
  ctx.restore()
}

// --- Jeu 1 : Serpent ---
function createSnake () {
  const CELL = 12
  const COLS = W / CELL
  const ROWS = Math.floor((H - HUD) / CELL)
  const top = H - ROWS * CELL
  let body, dir, queue, food, timer, step, score, grow
  const place = () => {
    do food = { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) }
    while (body.some((p) => p.x === food.x && p.y === food.y))
  }
  return {
    id: 'snake',
    hint: '←↑↓→ diriger · Espace jouer · Échap menu',
    get score () { return score },
    reset () {
      body = [{ x: 6, y: 10 }, { x: 5, y: 10 }, { x: 4, y: 10 }]
      dir = { x: 1, y: 0 }; queue = []; timer = 0; step = 0.16; score = 0; grow = 0
      place()
    },
    turn (d) {
      const last = queue[queue.length - 1] || dir
      if (d.x === -last.x && d.y === -last.y) return
      if (d.x === last.x && d.y === last.y) return
      if (queue.length < 2) queue.push(d)
    },
    update (dt, api) {
      timer += dt
      while (timer >= step) {
        timer -= step
        if (queue.length) dir = queue.shift()
        const head = { x: body[0].x + dir.x, y: body[0].y + dir.y }
        const hitWall = head.x < 0 || head.y < 0 || head.x >= COLS || head.y >= ROWS
        const hitSelf = body.some((p, i) => i < body.length - (grow ? 0 : 1) && p.x === head.x && p.y === head.y)
        if (hitWall || hitSelf) return api.over()
        body.unshift(head)
        if (head.x === food.x && head.y === food.y) {
          score += 10; grow += 1; step = Math.max(0.075, step - 0.005)
          api.sfx('coin'); place()
        }
        if (grow) grow--
        else body.pop()
      }
    },
    draw (ctx, t) {
      rect(ctx, 0, top, W, H - top, '#0d0a24')
      for (let x = 0; x < COLS; x++) {
        for (let y = 0; y < ROWS; y++) if ((x + y) % 2) rect(ctx, x * CELL, top + y * CELL, CELL, CELL, '#110d2c')
      }
      const bob = Math.sin(t * 6) > 0 ? 0 : 1
      gem(ctx, food.x * CELL + 6, top + food.y * CELL + 6 - bob)
      body.forEach((p, i) => {
        const px = p.x * CELL; const py = top + p.y * CELL
        rect(ctx, px + 1, py + 1, CELL - 2, CELL - 2, i % 2 ? C.mintDark : C.mint)
        rect(ctx, px + 2, py + 2, 3, 2, '#b8f5c9')
      })
      const h = body[0]; const hx = h.x * CELL; const hy = top + h.y * CELL
      // Yeux tournés dans la direction
      const ex = dir.x === 0 ? [3, 7] : [dir.x > 0 ? 7 : 3, dir.x > 0 ? 7 : 3]
      const ey = dir.y === 0 ? [3, 7] : [dir.y > 0 ? 7 : 3, dir.y > 0 ? 7 : 3]
      rect(ctx, hx + ex[0], hy + ey[0], 2, 2, C.ink)
      rect(ctx, hx + ex[1], hy + ey[1], 2, 2, C.ink)
    },
  }
}

// --- Jeu 2 : Casse-briques ---
function createBricks () {
  const ROWS_COL = [C.pink, C.orange, C.gold, C.mint, C.cyan, C.violet]
  const COLS = 8; const BW = 26; const BH = 9; const GAP = 2
  const left = (W - COLS * (BW + GAP) + GAP) / 2
  const PY = H - 20
  let paddle, ball, bricks, lives, score, level, stuck
  const build = () => {
    bricks = []
    ROWS_COL.forEach((color, r) => {
      for (let c = 0; c < COLS; c++) bricks.push({ x: left + c * (BW + GAP), y: HUD + 22 + r * (BH + GAP), color, pts: (6 - r) * 5, alive: true })
    })
  }
  const serve = () => { stuck = true; ball = { x: paddle.x, y: PY - 4, vx: 0, vy: 0 } }
  return {
    id: 'bricks',
    hint: '← → bouger · Espace lancer · Échap menu',
    get score () { return score },
    reset () {
      paddle = { x: W / 2, w: 42, target: null }
      lives = 3; score = 0; level = 1
      build(); serve()
    },
    action () {
      if (!stuck) return
      stuck = false
      const speed = 150 + level * 15
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 0.8
      ball.vx = Math.cos(a) * speed; ball.vy = Math.sin(a) * speed
    },
    pointer (x) { paddle.target = x },
    update (dt, api) {
      const move = (api.held.right ? 1 : 0) - (api.held.left ? 1 : 0)
      if (move) { paddle.x += move * 210 * dt; paddle.target = null }
      else if (paddle.target != null) paddle.x += Math.max(-260 * dt, Math.min(260 * dt, paddle.target - paddle.x))
      paddle.x = Math.max(paddle.w / 2, Math.min(W - paddle.w / 2, paddle.x))
      if (stuck) { ball.x = paddle.x; return }
      ball.x += ball.vx * dt; ball.y += ball.vy * dt
      if (ball.x < 3) { ball.x = 3; ball.vx = Math.abs(ball.vx) }
      if (ball.x > W - 3) { ball.x = W - 3; ball.vx = -Math.abs(ball.vx) }
      if (ball.y < HUD + 3) { ball.y = HUD + 3; ball.vy = Math.abs(ball.vy) }
      // Raquette : l'angle dépend du point d'impact
      if (ball.vy > 0 && ball.y >= PY - 3 && ball.y <= PY + 4 && Math.abs(ball.x - paddle.x) <= paddle.w / 2 + 3) {
        const speed = Math.hypot(ball.vx, ball.vy)
        const k = (ball.x - paddle.x) / (paddle.w / 2)
        const a = -Math.PI / 2 + k * 1.05
        ball.vx = Math.cos(a) * speed; ball.vy = Math.sin(a) * speed; ball.y = PY - 3
        api.sfx('tick')
      }
      for (const b of bricks) {
        if (!b.alive) continue
        if (ball.x + 3 < b.x || ball.x - 3 > b.x + BW || ball.y + 3 < b.y || ball.y - 3 > b.y + BH) continue
        b.alive = false; score += b.pts
        const overX = Math.min(ball.x + 3 - b.x, b.x + BW - (ball.x - 3))
        const overY = Math.min(ball.y + 3 - b.y, b.y + BH - (ball.y - 3))
        if (overX < overY) ball.vx = -ball.vx
        else ball.vy = -ball.vy
        api.sfx('coin')
        break
      }
      if (bricks.every((b) => !b.alive)) { level++; build(); serve(); api.sfx('achievement') }
      if (ball.y > H + 6) {
        lives--
        api.sfx('locked')
        if (lives <= 0) return api.over(true)
        serve()
      }
    },
    draw (ctx) {
      rect(ctx, 0, HUD, W, H - HUD, '#0d0a24')
      for (const b of bricks) {
        if (!b.alive) continue
        rect(ctx, b.x, b.y, BW, BH, b.color)
        rect(ctx, b.x, b.y, BW, 2, 'rgba(255,255,255,0.45)')
        rect(ctx, b.x, b.y + BH - 2, BW, 2, 'rgba(0,0,0,0.25)')
      }
      rect(ctx, paddle.x - paddle.w / 2, PY, paddle.w, 6, C.orange)
      rect(ctx, paddle.x - paddle.w / 2, PY, paddle.w, 2, C.gold)
      rect(ctx, paddle.x - paddle.w / 2 - 2, PY + 1, 2, 4, C.violet)
      rect(ctx, paddle.x + paddle.w / 2, PY + 1, 2, 4, C.violet)
      rect(ctx, ball.x - 3, ball.y - 2, 6, 4, '#fff')
      rect(ctx, ball.x - 2, ball.y - 3, 4, 6, '#fff')
      for (let i = 0; i < lives; i++) {
        rect(ctx, W - 12 - i * 10, H - 8, 6, 4, C.pink)
        rect(ctx, W - 11 - i * 10, H - 9, 4, 6, C.pink)
      }
      text(ctx, `Niv. ${level}`, 6, H - 7, { size: 8, align: 'left', color: C.dim })
      if (stuck) text(ctx, 'Espace : lancer', W / 2, PY - 18, { size: 9, color: C.gold })
    },
  }
}

// --- Jeu 3 : Dragon volant ---
function createDragon () {
  const GROUND = H - 14
  const TW = 26; const GAPH = 80; const SPACING = 112; const SPEED = 72
  let dragon, towers, score, scroll, flapT
  const addTower = (x) => {
    const min = HUD + 24; const max = GROUND - GAPH - 24
    towers.push({ x, gap: min + Math.random() * (max - min), passed: false })
  }
  const towerDraw = (ctx, x, y0, y1, capDown) => {
    rect(ctx, x, y0, TW, y1 - y0, C.stone)
    rect(ctx, x + TW - 5, y0, 5, y1 - y0, '#6d66a8')
    for (let y = y0 + 4; y < y1; y += 8) {
      rect(ctx, x, y, TW, 1, C.stoneDark)
      rect(ctx, x + ((y / 8) % 2 ? 8 : 16), y - 7, 1, 7, C.stoneDark)
    }
    // Créneaux du côté du passage
    const cy = capDown ? y1 : y0 - 6
    rect(ctx, x - 3, capDown ? y1 - 4 : y0, TW + 6, 4, C.stone)
    for (let i = 0; i < 4; i++) rect(ctx, x - 3 + i * 9, cy, 5, 6, i % 2 ? C.stone : '#a39dd8')
    // Fenêtre éclairée
    const wy = capDown ? y1 - 18 : y0 + 10
    if (Math.abs(y1 - y0) > 26) rect(ctx, x + 10, wy, 5, 7, C.gold)
  }
  return {
    id: 'dragon',
    hint: 'Espace / ↑ battre des ailes · Échap menu',
    get score () { return score },
    reset () {
      dragon = { y: H / 2, vy: 0 }
      towers = []; score = 0; scroll = 0; flapT = 0
      addTower(W + 40); addTower(W + 40 + SPACING); addTower(W + 40 + SPACING * 2)
    },
    action (api) { dragon.vy = -168; flapT = 0.18; api?.sfx('whoosh') },
    update (dt, api) {
      scroll += dt * SPEED; flapT -= dt
      dragon.vy = Math.min(dragon.vy + 540 * dt, 260)
      dragon.y += dragon.vy * dt
      if (dragon.y < HUD + 6) { dragon.y = HUD + 6; dragon.vy = 0 }
      for (const t of towers) {
        t.x -= SPEED * dt
        if (!t.passed && t.x + TW < 60) { t.passed = true; score++; api.sfx('coin') }
        const inX = 60 + 7 > t.x && 60 - 7 < t.x + TW
        if (inX && (dragon.y - 5 < t.gap || dragon.y + 5 > t.gap + GAPH)) return api.over(true)
      }
      if (towers[0].x < -TW - 6) { towers.shift(); addTower(towers[towers.length - 1].x + SPACING) }
      if (dragon.y + 5 > GROUND) return api.over(true)
    },
    draw (ctx, t) {
      // Ciel de nuit, étoiles et lune
      const g = ctx.createLinearGradient(0, HUD, 0, H)
      g.addColorStop(0, '#140f2e'); g.addColorStop(1, '#2c1f63')
      ctx.fillStyle = g; ctx.fillRect(0, HUD, W, H - HUD)
      for (let i = 0; i < 26; i++) {
        const sx = ((i * 53 - scroll * 0.15) % W + W) % W
        rect(ctx, sx, HUD + ((i * 37) % 150), 1, 1, i % 5 ? '#d8d0ff' : C.gold)
      }
      // Lune en croissant, disque pixelisé
      for (let dy = -7; dy <= 7; dy++) {
        const hw = Math.round(Math.sqrt(49 - dy * dy))
        rect(ctx, 192 - hw, HUD + 26 + dy, hw * 2, 1, '#fff3c4')
        const cw = Math.round(Math.sqrt(Math.max(0, 36 - (dy + 2) * (dy + 2))))
        if (cw) rect(ctx, 196 - cw, HUD + 26 + dy, cw * 2, 1, '#171133')
      }
      // Collines lointaines en parallaxe
      for (let x = 0; x < W; x += 4) {
        const hh = 18 + Math.sin((x + scroll * 0.3) * 0.04) * 8
        rect(ctx, x, GROUND - hh, 4, hh, '#2a2160')
      }
      for (const tw of towers) {
        towerDraw(ctx, tw.x, HUD, tw.gap, true)
        towerDraw(ctx, tw.x, tw.gap + GAPH, GROUND, false)
      }
      rect(ctx, 0, GROUND, W, H - GROUND, '#3d3378')
      for (let x = -(scroll % 8); x < W; x += 8) rect(ctx, x, GROUND, 4, 2, C.mint)
      const frame = flapT > 0 || Math.sin(t * 14) > 0.6 ? 1 : 0
      dragonSprite(ctx, 60, dragon.y, frame, Math.max(-0.4, Math.min(0.6, dragon.vy / 400)))
    },
  }
}

const FACTORIES = { snake: createSnake, bricks: createBricks, dragon: createDragon }
const DIRS = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } }
const KEYMAP = {
  ArrowUp: 'up', KeyW: 'up', KeyZ: 'up',
  ArrowDown: 'down', KeyS: 'down',
  ArrowLeft: 'left', KeyA: 'left', KeyQ: 'left',
  ArrowRight: 'right', KeyD: 'right',
  Space: 'a', Enter: 'a', NumpadEnter: 'a', KeyE: 'a',
  Escape: 'b', KeyP: 'pause',
}

export function createArcade ({ sfx, onPlayed, onClose } = {}) {
  let root = null; let canvas = null; let ctx = null; let hintEl = null; let introEl = null
  let active = false; let raf = 0; let last = 0; let clock = 0; let openedAt = 0
  let screen = 'menu' // 'menu' ou id de jeu
  let sel = 0
  let game = null
  let phase = 'ready' // ready | play | over | pause
  let result = null // { score, best, record }
  let overAt = 0
  const held = { up: false, down: false, left: false, right: false }
  const play = (kind) => sfx?.blip?.(kind)
  const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

  const gameApi = {
    held,
    sfx: play,
    over () {
      const score = game.score
      const best = bestOf(game.id)
      const record = submitScore(game.id, score)
      result = { score, best: Math.max(best, score), record }
      phase = 'over'; overAt = clock
      if (record) sfx?.jingle?.()
      else play('locked')
      onPlayed?.(game.id, score, record)
    },
  }

  function build () {
    root = document.createElement('div')
    root.className = 'arcade'
    root.setAttribute('role', 'dialog')
    root.setAttribute('aria-label', 'Borne d\'arcade')
    root.innerHTML = `
      <button type="button" class="arcade-quit" aria-label="Quitter la borne">✕ Quitter</button>
      <div class="arcade-cabinet">
        <div class="arcade-marquee"><span>ARCADE AQ</span></div>
        <p class="arcade-intro"></p>
        <div class="arcade-bezel"><div class="arcade-screen"><canvas width="${W * RES}" height="${H * RES}"></canvas></div></div>
        <div class="arcade-panel">
          <div class="arcade-dpad">
            <button type="button" data-key="up" aria-label="Haut">▲</button>
            <button type="button" data-key="left" aria-label="Gauche">◀</button>
            <button type="button" data-key="right" aria-label="Droite">▶</button>
            <button type="button" data-key="down" aria-label="Bas">▼</button>
          </div>
          <p class="arcade-hint"></p>
          <div class="arcade-ab">
            <button type="button" data-key="b" class="arcade-b" aria-label="Retour">B</button>
            <button type="button" data-key="a" class="arcade-a" aria-label="Action">A</button>
          </div>
        </div>
      </div>`
    document.body.appendChild(root)
    canvas = root.querySelector('canvas')
    ctx = canvas.getContext('2d')
    ctx.setTransform(RES, 0, 0, RES, 0, 0)
    ctx.imageSmoothingEnabled = false
    hintEl = root.querySelector('.arcade-hint')
    introEl = root.querySelector('.arcade-intro')
    root.querySelector('.arcade-quit').addEventListener('click', () => api.close())

    // Boutons de la borne : appui maintenu possible (raquette)
    root.querySelectorAll('[data-key]').forEach((btn) => {
      const key = btn.dataset.key
      const release = () => { if (key in held) held[key] = false; btn.classList.remove('down') }
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault()
        btn.setPointerCapture?.(e.pointerId)
        btn.classList.add('down')
        if (key in held) held[key] = true
        press(key)
      })
      btn.addEventListener('pointerup', release)
      btn.addEventListener('pointercancel', release)
      btn.addEventListener('lostpointercapture', release)
      btn.addEventListener('contextmenu', (e) => e.preventDefault())
    })

    // Toucher l'écran : choisir un jeu, agir, ou guider la raquette
    const toLocal = (e) => {
      const r = canvas.getBoundingClientRect()
      return { x: (e.clientX - r.left) * W / r.width, y: (e.clientY - r.top) * H / r.height }
    }
    let dragging = false
    canvas.addEventListener('pointerdown', (e) => {
      e.preventDefault()
      const p = toLocal(e)
      if (screen === 'menu') {
        const i = menuHit(p)
        if (i >= 0) { sel = i; start(GAMES[i].id) }
        return
      }
      if (game.id === 'bricks' && phase === 'play') { dragging = true; game.pointer(p.x) }
      press('a')
    })
    canvas.addEventListener('pointermove', (e) => {
      if (screen === 'menu') {
        const i = menuHit(toLocal(e))
        if (i >= 0 && i !== sel && e.pointerType === 'mouse') { sel = i; play('tick') }
        canvas.style.cursor = i >= 0 ? 'pointer' : ''
      } else if (dragging && phase === 'play') game.pointer(toLocal(e).x)
    })
    const stopDrag = () => { dragging = false }
    canvas.addEventListener('pointerup', stopDrag)
    canvas.addEventListener('pointercancel', stopDrag)
  }

  // --- Navigation ---
  const menuItem = (i) => ({ x: 16, y: 76 + i * 58, w: W - 32, h: 50 })
  function menuHit ({ x, y }) {
    return GAMES.findIndex((_, i) => {
      const r = menuItem(i)
      return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h
    })
  }
  function setHint () {
    if (!hintEl) return
    const hint = screen === 'menu' ? '↑↓ choisir · Espace jouer · Échap quitter' : game.hint
    // Sur écran tactile, on parle des boutons A / B de la borne
    hintEl.textContent = matchMedia('(pointer: coarse)').matches ? hint.replace(/Espace/g, 'A').replace(/Échap/g, 'B') : hint
  }
  function start (id) {
    screen = id
    game = FACTORIES[id]()
    game.reset()
    phase = 'ready'; result = null
    play('open'); setHint()
  }
  function toMenu () {
    screen = 'menu'; game = null; phase = 'ready'
    play('close'); setHint()
  }

  function press (key) {
    if (!active) return
    if (clock - openedAt < 0.25 && key === 'a') return // évite le E qui vient d'ouvrir la borne
    if (screen === 'menu') {
      if (key === 'up' || key === 'down') {
        sel = (sel + (key === 'up' ? -1 : 1) + GAMES.length) % GAMES.length
        play('tick')
      } else if (key === 'a') start(GAMES[sel].id)
      else if (key === 'b') api.close()
      return
    }
    if (key === 'b') return toMenu()
    if (phase === 'over') {
      if (key === 'a' && clock - overAt > 0.45) { game.reset(); phase = 'ready'; result = null; play('tick') }
      return
    }
    if (key === 'pause') {
      if (phase === 'play') phase = 'pause'
      else if (phase === 'pause') phase = 'play'
      return
    }
    if (phase === 'pause') { if (key === 'a') phase = 'play'; return }
    if (phase === 'ready') {
      if (key === 'a' || (game.id === 'dragon' && key === 'up')) {
        phase = 'play'
        if (game.id !== 'snake') game.action?.(gameApi)
      } else if (game.id === 'snake' && DIRS[key]) { game.turn(DIRS[key]); phase = 'play' }
      return
    }
    // En jeu
    if (DIRS[key] && game.turn) game.turn(DIRS[key])
    if (key === 'a' || (game.id === 'dragon' && key === 'up')) game.action?.(gameApi)
  }

  function onKey (e) {
    if (!active) return
    const key = KEYMAP[e.code]
    if (!key) return
    e.preventDefault()
    e.stopImmediatePropagation()
    if (e.type === 'keyup') { if (key in held) held[key] = false; return }
    if (key in held) held[key] = true
    if (e.repeat && (key === 'a' || key === 'b' || key === 'pause')) return
    if (e.repeat && screen !== 'menu') return
    press(key)
  }
  window.addEventListener('keydown', onKey, { capture: true })
  window.addEventListener('keyup', onKey, { capture: true })
  window.addEventListener('blur', () => { for (const k in held) held[k] = false })

  // --- Rendu ---
  function drawHud () {
    rect(ctx, 0, 0, W, HUD, C.night)
    rect(ctx, 0, HUD - 1, W, 1, C.line)
    if (screen === 'menu') {
      text(ctx, 'INSÈRE UNE PIÈCE', W / 2, HUD / 2 + 1, { size: 9, color: Math.floor(clock * 2) % 2 && !reduced ? C.dim : C.gold })
      return
    }
    const info = GAMES.find((g) => g.id === game.id)
    text(ctx, info.name.toUpperCase(), 6, HUD / 2 + 1, { size: 9, align: 'left', color: info.color })
    text(ctx, `${game.score}`, W / 2, HUD / 2 + 1, { size: 12, color: C.gold })
    text(ctx, `REC ${Math.max(bestOf(game.id), phase === 'over' ? game.score : 0)}`, W - 6, HUD / 2 + 1, { size: 8, align: 'right', color: C.dim })
  }

  function drawMenu () {
    rect(ctx, 0, HUD, W, H - HUD, C.night)
    for (let i = 0; i < 30; i++) {
      const tw = reduced ? 1 : (Math.sin(clock * 2 + i * 1.7) + 1) / 2
      rect(ctx, (i * 71) % W, HUD + ((i * 43) % (H - HUD)), 1, 1, tw > 0.5 ? '#d8d0ff' : '#4a3f8a')
    }
    text(ctx, 'CHOISIS TON JEU', W / 2, HUD + 26, { size: 14, color: C.text, glow: C.violetDark })
    text(ctx, '★ ★ ★', W / 2, HUD + 42, { size: 8, color: C.gold })
    GAMES.forEach((g, i) => {
      const r = menuItem(i)
      const on = i === sel
      rect(ctx, r.x, r.y, r.w, r.h, on ? C.deep : '#1a1440')
      const border = on ? g.color : C.line
      rect(ctx, r.x, r.y, r.w, 1, border); rect(ctx, r.x, r.y + r.h - 1, r.w, 1, border)
      rect(ctx, r.x, r.y, 1, r.h, border); rect(ctx, r.x + r.w - 1, r.y, 1, r.h, border)
      // Petite icône
      const ix = r.x + 22; const iy = r.y + r.h / 2
      if (g.id === 'snake') {
        for (let k = 0; k < 4; k++) rect(ctx, ix - 14 + k * 6, iy - 2, 5, 5, k % 2 ? C.mintDark : C.mint)
        gem(ctx, ix + 12, iy, 1)
      } else if (g.id === 'bricks') {
        ;[C.pink, C.orange, C.cyan].forEach((col, k) => rect(ctx, ix - 13 + k * 9, iy - 9, 8, 5, col))
        rect(ctx, ix - 1, iy + 1, 3, 3, '#fff'); rect(ctx, ix - 9, iy + 7, 18, 3, C.orange)
      } else dragonSprite(ctx, ix, iy + 2, Math.sin(clock * 8) > 0 ? 1 : 0)
      text(ctx, g.name, r.x + 48, r.y + 17, { size: 12, align: 'left', color: on ? '#fff' : C.text })
      text(ctx, g.desc, r.x + 48, r.y + 33, { size: 8, align: 'left', weight: '500', color: C.dim })
      text(ctx, `${bestOf(g.id)}`, r.x + r.w - 10, r.y + 17, { size: 11, align: 'right', color: C.gold })
      text(ctx, 'record', r.x + r.w - 10, r.y + 33, { size: 7, align: 'right', weight: '500', color: C.dim })
      if (on && (reduced || Math.sin(clock * 8) > -0.3)) text(ctx, '▶', r.x - 7, r.y + r.h / 2, { size: 9, color: g.color })
    })
    text(ctx, '↑↓ choisir · Espace jouer', W / 2, H - 14, { size: 8, weight: '500', color: C.dim })
  }

  function panel (lines, h) {
    const y = (H - h) / 2 + 8
    rect(ctx, 20, y, W - 40, h, 'rgba(7,10,31,0.86)')
    rect(ctx, 20, y, W - 40, 1, C.violet); rect(ctx, 20, y + h - 1, W - 40, 1, C.violet)
    rect(ctx, 20, y, 1, h, C.violet); rect(ctx, W - 21, y, 1, h, C.violet)
    lines.forEach(([str, opts], i) => text(ctx, str, W / 2, y + 16 + i * 17, opts))
  }

  function drawOverlay () {
    const blink = reduced || Math.floor(clock * 2.2) % 2 === 0
    const touch = matchMedia('(pointer: coarse)').matches
    if (phase === 'ready') {
      const info = GAMES.find((g) => g.id === game.id)
      panel([
        [info.name.toUpperCase(), { size: 14, color: info.color }],
        [game.hint.split(' · ')[0], { size: 8, weight: '500', color: C.dim }],
        [blink ? (touch ? 'Touche l\'écran' : 'Appuie sur Espace') : '', { size: 10, color: C.gold }],
      ], 62)
    } else if (phase === 'pause') {
      panel([['PAUSE', { size: 14, color: C.cyan }], ['P ou Espace : reprendre', { size: 8, color: C.dim }]], 46)
    } else if (phase === 'over') {
      const lines = [
        ['PARTIE TERMINÉE', { size: 13, color: C.pink }],
        [`Score : ${result.score}`, { size: 11, color: C.text }],
        [`Meilleur : ${result.best}`, { size: 9, weight: '500', color: C.dim }],
      ]
      if (result.record) lines.push(['NOUVEAU RECORD !', { size: 11, color: blink ? C.gold : C.orange }])
      lines.push([touch ? 'A : rejouer · B : menu' : 'Espace : rejouer · Échap : menu', { size: 8, weight: '500', color: C.cyan }])
      panel(lines, lines.length * 17 + 14)
    }
  }

  function frame (now) {
    raf = requestAnimationFrame(frame)
    const dt = Math.min(0.05, (now - last) / 1000 || 0)
    last = now; clock += dt
    if (screen !== 'menu' && phase === 'play') game.update(dt, gameApi)
    ctx.clearRect(0, 0, W, H)
    if (screen === 'menu') drawMenu()
    else { game.draw(ctx, clock); drawOverlay() }
    drawHud()
  }

  const api = {
    get active () { return active },
    open (intro) {
      if (active) return
      if (!root) build()
      active = true
      openedAt = clock
      introEl.textContent = intro?.text || ''
      introEl.hidden = !intro?.text
      screen = 'menu'; game = null; phase = 'ready'
      for (const k in held) held[k] = false
      setHint()
      document.body.classList.add('arcade-open')
      root.style.display = ''
      requestAnimationFrame(() => root.classList.add('visible'))
      last = performance.now()
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(frame)
      play('open')
    },
    close () {
      if (!active) return
      active = false
      cancelAnimationFrame(raf); raf = 0
      root.classList.remove('visible')
      document.body.classList.remove('arcade-open')
      play('close')
      setTimeout(() => { if (!active) root.style.display = 'none' }, 350)
      onClose?.()
    },
  }
  return api
}
