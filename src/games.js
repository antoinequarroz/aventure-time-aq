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

function makeRing(color) {
  const ring = new THREE.Group()
  const torus = mesh(new THREE.TorusGeometry(1.6, 0.14, 8, 40), mat(color, { emissive: color, emissiveIntensity: 1.5 }), { shadow: false })
  ring.add(torus)
  ring.userData.torus = torus
  return ring
}

export function createGames(scene, ui, player) {
  const records = loadRecords()
  const burst = createBurst(scene)
  let active = null

  function finish(success, message) {
    const game = active.def
    const time = active.time
    cleanup()
    if (!success) {
      ui.openPanel(`${game.title} : raté !`, [message, 'Retourne sur le point de départ et appuie sur E pour réessayer.'])
      return
    }
    const previous = records[game.id]
    const best = previous === undefined || time < previous
    if (best) {
      records[game.id] = time
      saveRecords(records)
    }
    ui.openPanel(`${game.title} : bravo !`, [
      `Ton temps : ${time.toFixed(1)} s.`,
      best ? (previous === undefined ? 'Premier record enregistré !' : `Nouveau record ! L'ancien était de ${previous.toFixed(1)} s.`) : `Ton record reste de ${previous.toFixed(1)} s.`,
    ])
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
    start(def) {
      cleanup()
      active = { def, t: 0, objects: [], index: 0, collected: 0 }
      if (def.type === 'collect') {
        active.items = def.items.map((p) => {
          const item = makeItem(def.item)
          item.position.copy(p).setY(p.y + 0.9)
          item.userData.baseY = p.y + 0.9
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
      ui.toast(def.intro)
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
      active.t += dt
      const p = player.position
      let status = ''

      if (def.type === 'collect') {
        for (const item of active.items) {
          if (!item.visible) continue
          item.rotation.y += dt * 3
          item.position.y = item.userData.baseY + Math.sin(t * 3 + item.position.x) * 0.2
          if (Math.hypot(item.position.x - p.x, item.position.z - p.z) < 1.3 && Math.abs(item.position.y - (p.y + 0.9)) < 1.6) {
            item.visible = false
            active.collected++
            burst.emit(item.position, def.accent)
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
        if (Math.hypot(ring.position.x - p.x, ring.position.z - p.z) < 1.9 && Math.abs(ring.position.y - (p.y + 1)) < 1.9) {
          burst.emit(ring.position, def.accent)
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

      if (def.type === 'parkour') {
        status = `Chrono : ${active.t.toFixed(1)} s`
        if (Math.hypot(def.goal.x - p.x, def.goal.z - p.z) < 1.6 && p.y > def.goal.y - 0.3) {
          burst.emit(def.goal.clone().setY(def.goal.y + 1), def.accent)
          active.time = active.t
          return finish(true)
        }
      }

      const record = records[def.id]
      ui.setGameHud(def.title, status, record !== undefined ? `Record : ${record.toFixed(1)} s` : 'Pas encore de record', 'Échap pour abandonner')
    },
  }
}

// Petites explosions de particules quand on ramasse un objet ou qu'on gagne.
function createBurst(scene) {
  const pool = []
  return {
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
        s.material.opacity = Math.max(0, s.userData.life / 0.8)
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
