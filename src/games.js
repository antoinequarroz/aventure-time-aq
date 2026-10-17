import * as THREE from 'three'
import { mat, mesh } from './world/helpers.js'
import { model } from './world/models.js'

// Moteur des mini-jeux : collecte, parcours et course.
// Chaque jeu est décrit dans src/world/eras/*.js ; les textes sont dans src/content.js.

const RECORDS_KEY = 'aventure-time-aq:records'

function loadRecords() {
  try {
    return JSON.parse(localStorage.getItem(RECORDS_KEY)) || {}
  } catch {
    return {}
  }
}

function saveRecords(records) {
  try {
    localStorage.setItem(RECORDS_KEY, JSON.stringify(records))
  } catch {
    // Stockage indisponible (navigation privée) : les records ne sont pas gardés.
  }
}

function makeItem(kind) {
  if (kind === 'coin') return model('coin', { height: 0.9 })
  const g = new THREE.Group()
  if (kind === 'bug') {
    // Petit bug vert lumineux avec des pattes.
    g.add(mesh(new THREE.SphereGeometry(0.35, 12, 8), mat(0x3ddc84, { emissive: 0x1fa85a, emissiveIntensity: 1.2 })))
    g.add(mesh(new THREE.SphereGeometry(0.2, 10, 8), mat(0x222222), { z: 0.38 }))
    for (const side of [-1, 1]) {
      for (const dz of [-0.2, 0, 0.2]) {
        const leg = mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.4, 4), mat(0x222222), { x: side * 0.38, y: -0.1, z: dz })
        leg.rotation.z = side * 1.1
        g.add(leg)
      }
    }
    return g
  }
  // Cellule d'énergie.
  g.add(mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.7, 8), mat(0x6fd3ff, { emissive: 0x6fd3ff, emissiveIntensity: 2, transparent: true, opacity: 0.85 })))
  g.add(mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.12, 8), mat(0xdddddd), { y: 0.4 }))
  g.add(mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.12, 8), mat(0xdddddd), { y: -0.4 }))
  return g
}

// Dalle lumineuse du jeu « tiles », posée au hasard autour du centre de l'arène.
const tileGeo = new THREE.CylinderGeometry(0.95, 0.95, 0.08, 28)
const ringGeo = new THREE.RingGeometry(1.0, 1.15, 32).rotateX(-Math.PI / 2)
const beamGeo = new THREE.CylinderGeometry(0.75, 0.95, 2.6, 24, 1, true).translate(0, 1.3, 0)
function spawnTile(def, others) {
  for (let tries = 0; tries < 12; tries++) {
    const a = Math.random() * Math.PI * 2
    const r = Math.sqrt(Math.random()) * def.radius
    const x = def.center.x + Math.cos(a) * r
    const z = def.center.z + Math.sin(a) * r
    if (others.some((o) => Math.hypot(o.position.x - x, o.position.z - z) < 2.3)) continue
    const gold = Math.random() < 0.16
    const color = gold ? 0xffd34f : def.accent
    const g = new THREE.Group()
    const glow = mesh(tileGeo, mat(color, { emissive: color, emissiveIntensity: 2 }), { shadow: false })
    const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false }))
    ring.position.y = 0.06
    // Colonne de lumière : la dalle se repère de loin, même derrière le décor.
    const beam = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.28, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }))
    g.add(glow, ring, beam)
    g.position.set(x, def.center.y + 0.05, z)
    const max = gold ? 1.7 : 2.4
    g.userData = { life: max, max, gold, glow, ring }
    return g
  }
  return null
}

function makeRing(color) {
  const ring = new THREE.Group()
  const torus = mesh(new THREE.TorusGeometry(1.6, 0.14, 8, 40), mat(color, { emissive: color, emissiveIntensity: 1.5 }), { shadow: false })
  ring.add(torus)
  ring.userData.torus = torus
  return ring
}

// Médailles : or, argent, bronze selon le temps (ou le score pour les jeux à points).
export function medalThresholds(def) {
  if (def.medals) return def.medals
  if (def.type === 'parkour') return [20, 35]
  return [def.time * 0.55, def.time * 0.8]
}

export function medalFor(def, value) {
  const [gold, silver] = medalThresholds(def)
  const better = (a, b) => (def.score ? a >= b : a <= b)
  if (better(value, gold)) return { icon: '🥇', label: 'Médaille d\'or', rank: 3 }
  if (better(value, silver)) return { icon: '🥈', label: 'Médaille d\'argent', rank: 2 }
  return { icon: '🥉', label: 'Médaille de bronze', rank: 1 }
}

export function createGames(scene, ui, player, sfx = null, rewards = null, allGames = () => []) {
  // Anciens records (avant le classement) : repris une fois dans le classement local.
  const legacy = loadRecords()
  const records = {
    get(id) {
      return rewards?.board[id]?.[0]?.v ?? legacy[id]
    },
  }
  const burst = createBurst(scene)
  const arrow = new THREE.Group()
  const arrowMat = mat(0xffd27a, { emissive: 0xffb347, emissiveIntensity: 2 })
  const head = mesh(new THREE.ConeGeometry(0.35, 0.8, 4).rotateX(Math.PI / 2), arrowMat, { z: 0.5, shadow: false })
  arrow.add(head, mesh(new THREE.BoxGeometry(0.2, 0.12, 0.7), arrowMat, { z: -0.1, shadow: false }))
  let active = null

  function finish(success, message) {
    const game = active.def
    const value = game.score ? active.score : active.time
    cleanup()
    if (!success) {
      sfx?.blip('locked')
      ui.openPanel({ title: `${game.title} : raté !`, icon: '💥', kicker: 'Mini-jeu', era: game.era, text: [message, 'Retourne sur le point de départ et appuie sur E pour réessayer.'] })
      return
    }
    const previous = records.get(game.id)
    const fmt = (v) => (game.score ? `${v} points` : `${v.toFixed(1)} s`)
    const best = previous === undefined || (game.score ? value > previous : value < previous)
    if (rewards && previous !== undefined && !rewards.board[game.id]) rewards.record(game, previous, 'Ancien record')
    const rank = rewards ? rewards.record(game, value, ({ rogue: 'Aventurier', knight: 'Chevalier', mage: 'Mage', barbarian: 'Barbare' })[player.character] ?? 'Toi') : 0
    if (!rewards && best) {
      legacy[game.id] = value
      saveRecords(legacy)
    }
    const medal = medalFor(game, value)
    const [gold] = medalThresholds(game)
    burst.confetti(player.position)
    player.cheer?.()
    sfx?.jingle()
    if (rewards) {
      rewards.unlock('first-game')
      if (medal.rank === 3) rewards.unlock('gold')
      const list = allGames()
      if (list.length && list.every((g) => rewards.best(g) !== undefined)) rewards.unlock('all-games')
      if (list.length && list.every((g) => rewards.best(g) !== undefined && medalFor(g, rewards.best(g)).rank === 3)) rewards.unlock('all-gold')
    }
    const board = rewards?.lines(game, rank) ?? []
    ui.openPanel({
      title: `${game.title} : bravo !`,
      icon: medal.icon,
      kicker: medal.label,
      era: game.era,
      text: [
        game.score ? `Ton score : ${fmt(value)}.` : `Ton temps : ${fmt(value)}.`,
        best ? (previous === undefined ? 'Premier record enregistré !' : `Nouveau record ! L'ancien était de ${fmt(previous)}.`) : `Ton record reste de ${fmt(previous)}.`,
        medal.rank === 3 ? 'Imbattable. Tu peux quand même essayer de faire encore mieux !' : game.score ? `Pour l'or, il faut au moins ${gold} points.` : `Pour l'or, il faut finir en moins de ${gold.toFixed(1)} s.`,
        ...(board.length ? ['Classement sur cet appareil :', ...board] : []),
      ],
    })
  }

  function recordText(def) {
    const r = records.get(def.id)
    if (r === undefined) return 'Pas encore de record'
    return def.score ? `Record : ${r} pts` : `Record : ${r.toFixed(1)} s`
  }

  function cleanup() {
    if (!active) return
    for (const o of active.objects) scene.remove(o)
    player.clearCheckpoint()
    ui.setGameHud(null)
    active = null
  }

  return {
    get active() {
      return active !== null
    },
    // Pendant le compte à rebours, le joueur ne bouge pas.
    get frozen() {
      return active !== null && active.countdown > 0
    },
    start(def) {
      cleanup()
      active = { def, t: 0, objects: [], index: 0, collected: 0, countdown: 3, combo: 0, lastPick: -9 }
      if (def.type === 'race' || def.type === 'parkour' || def.type === 'collect') {
        arrow.visible = def.type === 'race'
        scene.add(arrow)
        active.objects.push(arrow)
      }
      if (def.type === 'collect') {
        active.items = def.items.map((p) => {
          const item = makeItem(def.item)
          item.position.copy(p).setY(p.y + 0.9)
          item.userData.baseY = p.y + 0.9
          item.userData.home = p.clone()
          item.userData.flee = def.item === 'bug'
          scene.add(item)
          active.objects.push(item)
          return item
        })
      }
      if (def.type === 'race') {
        active.rings = def.rings.map((p, i) => {
          const ring = makeRing(def.accent)
          ring.position.copy(p)
          const next = def.rings[(i + 1) % def.rings.length]
          ring.lookAt(next.x, ring.position.y, next.z)
          scene.add(ring)
          active.objects.push(ring)
          return ring
        })
      }
      if (def.type === 'parkour') player.setCheckpoint(def.start)
      if (def.type === 'tiles') Object.assign(active, { tiles: [], score: 0, spawn: 0.2 })
      ui.toast(def.intro)
      ui.bigText?.('3')
    },
    abort() {
      if (!active) return
      cleanup()
      ui.toast('Mini-jeu abandonné.')
    },
    update(dt, t) {
      burst.update(dt)
      if (!active) return
      const { def } = active
      const p = player.position
      if (active.countdown > 0) {
        const before = Math.ceil(active.countdown)
        active.countdown -= dt
        const now = Math.ceil(active.countdown)
        if (now !== before) ui.bigText?.(now > 0 ? String(now) : 'Partez !')
        ui.setGameHud(def.title, 'Prêt ?', recordText(def), 'Échap pour abandonner')
        return
      }
      active.t += dt
      let status = ''

      if (def.type === 'collect') {
        for (const item of active.items) {
          if (!item.visible) continue
          item.rotation.y += dt * 3
          item.position.y = item.userData.baseY + Math.sin(t * 3 + item.position.x) * 0.2
          const dx = item.position.x - p.x
          const dz = item.position.z - p.z
          const d = Math.hypot(dx, dz)
          // Les bugs s'enfuient quand on approche (sans trop s'éloigner de leur cachette).
          if (item.userData.flee) {
            const home = item.userData.home
            if (d < 4 && d > 0.01) {
              item.position.x += (dx / d) * dt * 3.2
              item.position.z += (dz / d) * dt * 3.2
              item.rotation.y = Math.atan2(dx, dz)
            }
            const hx = item.position.x - home.x
            const hz = item.position.z - home.z
            const hd = Math.hypot(hx, hz)
            if (hd > 2.6) {
              item.position.x = home.x + (hx / hd) * 2.6
              item.position.z = home.z + (hz / hd) * 2.6
            }
          }
          if (d < 1.3 && Math.abs(item.position.y - (p.y + 0.9)) < 1.6) {
            item.visible = false
            active.collected++
            burst.emit(item.position, def.accent)
            sfx?.blip('coin')
            // Combo : plusieurs objets ramassés coup sur coup.
            active.combo = active.t - active.lastPick < 1.8 ? active.combo + 1 : 1
            active.lastPick = active.t
            if (active.combo >= 2) ui.bigText?.(`Combo ×${active.combo} !`, true)
            if (active.combo >= 5) rewards?.unlock('combo')
          }
        }
        const left = def.time - active.t
        status = `${active.collected} / ${active.items.length} · ${Math.max(0, left).toFixed(1)} s`
        if (active.collected === active.items.length) {
          active.time = active.t
          return finish(true)
        }
        if (left <= 0) return finish(false, `Il restait ${active.items.length - active.collected} objet(s) à ramasser.`)
      }

      if (def.type === 'race') {
        active.rings.forEach((ring, i) => {
          const current = i === active.index
          ring.visible = i >= active.index
          ring.userData.torus.material.emissiveIntensity = current ? 3 + Math.sin(t * 8) : 0.6
          ring.scale.setScalar(current ? 1 + Math.sin(t * 6) * 0.06 : 0.8)
        })
        const ring = active.rings[active.index]
        // Flèche au-dessus du joueur vers le prochain anneau.
        arrow.position.set(p.x, p.y + 3, p.z)
        arrow.rotation.y = Math.atan2(ring.position.x - p.x, ring.position.z - p.z)
        arrow.children[0].material.emissiveIntensity = 1.5 + Math.sin(t * 8)
        if (Math.hypot(ring.position.x - p.x, ring.position.z - p.z) < 1.9 && Math.abs(ring.position.y - (p.y + 1)) < 1.9) {
          burst.emit(ring.position, def.accent)
          sfx?.blip('coin')
          active.index++
          if (active.index === active.rings.length) {
            active.time = active.t
            return finish(true)
          }
        }
        const left = def.time - active.t
        status = `Anneau ${active.index + 1} / ${active.rings.length} · ${Math.max(0, left).toFixed(1)} s`
        if (left <= 0) return finish(false, 'Le temps est écoulé.')
      }

      if (def.type === 'tiles') {
        // Dalles lumineuses : marche dessus avant qu'elles s'éteignent. Les dorées valent 3 points.
        const left = def.time - active.t
        const pace = 1 - Math.min(1, active.t / def.time)
        active.spawn -= dt
        if (active.spawn <= 0 && active.tiles.length < 3) {
          active.spawn = 0.45 + pace * 0.55
          const tile = spawnTile(def, active.tiles)
          if (tile) {
            scene.add(tile)
            active.objects.push(tile)
            active.tiles.push(tile)
          }
        }
        for (let i = active.tiles.length - 1; i >= 0; i--) {
          const tile = active.tiles[i]
          const u = tile.userData
          u.life -= dt
          const k = Math.max(0, u.life / u.max)
          tile.scale.setScalar(0.35 + 0.65 * k)
          u.glow.material.emissiveIntensity = (u.gold ? 2.6 : 1.8) + Math.sin(t * 10) * 0.5
          u.ring.scale.setScalar(1 + (1 - k) * 0.6)
          u.ring.material.opacity = 0.9 * k
          const stepped = Math.hypot(tile.position.x - p.x, tile.position.z - p.z) < 0.95 * tile.scale.x + 0.25 && Math.abs(p.y - tile.position.y) < 0.8
          if (stepped || u.life <= 0) {
            scene.remove(tile)
            active.tiles.splice(i, 1)
            if (!stepped) {
              active.combo = 0
              continue
            }
            active.combo = active.t - active.lastPick < 1.6 ? active.combo + 1 : 1
            active.lastPick = active.t
            const gain = (u.gold ? 3 : 1) + (active.combo >= 3 ? 1 : 0)
            active.score += gain
            burst.emit(tile.position.clone().setY(tile.position.y + 0.4), u.gold ? 0xffd34f : def.accent)
            sfx?.blip('coin')
            ui.bigText?.(active.combo >= 3 ? `+${gain} · combo ×${active.combo}` : `+${gain}`, true)
            if (active.combo >= 5) rewards?.unlock('combo')
          }
        }
        status = `${active.score} pts · ${Math.max(0, left).toFixed(1)} s`
        if (left <= 0) {
          if (active.score > 0) return finish(true)
          return finish(false, 'Aucune dalle attrapée : marche sur les dalles qui s\'allument !')
        }
      }

      if (def.type === 'parkour') {
        status = `Chrono : ${active.t.toFixed(1)} s`
        if (Math.hypot(def.goal.x - p.x, def.goal.z - p.z) < 1.6 && p.y > def.goal.y - 0.3) {
          burst.emit(def.goal.clone().setY(def.goal.y + 1), def.accent)
          active.time = active.t
          return finish(true)
        }
      }

      ui.setGameHud(def.title, status, recordText(def), 'Échap pour abandonner')
    },
  }
}

// Petites explosions de particules quand on ramasse un objet ou qu'on gagne.
function createBurst(scene) {
  const pool = []
  const colors = [0xff5a7a, 0xffd34f, 0x6fd3ff, 0x7dff9a, 0xb48cff]
  return {
    // Pluie de confettis multicolores à la victoire.
    confetti(position) {
      for (let i = 0; i < 70; i++) {
        const s = mesh(new THREE.PlaneGeometry(0.18, 0.1), new THREE.MeshBasicMaterial({ color: colors[i % colors.length], transparent: true, side: THREE.DoubleSide }), { shadow: false })
        s.position.copy(position).setY(position.y + 1.5)
        s.userData.v = new THREE.Vector3((Math.random() - 0.5) * 9, Math.random() * 9 + 4, (Math.random() - 0.5) * 9)
        s.userData.life = 2
        s.userData.spin = (Math.random() - 0.5) * 12
        scene.add(s)
        pool.push(s)
      }
    },
    emit(position, color) {
      for (let i = 0; i < 14; i++) {
        const s = mesh(new THREE.OctahedronGeometry(0.12, 0), new THREE.MeshBasicMaterial({ color, transparent: true }), { shadow: false })
        s.position.copy(position)
        s.userData.v = new THREE.Vector3((Math.random() - 0.5) * 6, Math.random() * 5 + 1, (Math.random() - 0.5) * 6)
        s.userData.life = 0.8
        scene.add(s)
        pool.push(s)
      }
    },
    update(dt) {
      for (let i = pool.length - 1; i >= 0; i--) {
        const s = pool[i]
        s.userData.life -= dt
        s.userData.v.y -= 9 * dt
        s.position.addScaledVector(s.userData.v, dt)
        if (s.userData.spin) {
          s.rotation.x += s.userData.spin * dt
          s.rotation.y += s.userData.spin * 0.7 * dt
          s.userData.v.multiplyScalar(1 - dt * 1.5)
        }
        s.material.opacity = Math.max(0, Math.min(1, s.userData.life / 0.8))
        if (s.userData.life <= 0) {
          scene.remove(s)
          s.geometry.dispose()
          s.material.dispose()
          pool.splice(i, 1)
        }
      }
    },
  }
}
