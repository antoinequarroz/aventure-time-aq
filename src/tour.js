import * as THREE from 'three'

// Visite guidée : pour qui n'a pas envie de jouer, un tour automatique de tous les points
// en deux minutes environ, île par île, qui se termine par l'ouverture du coffre final.
const TOTAL_TIME = 120
const ERA_ORDER = { past: 0, present: 1, future: 2 }

export function createTour({ ui, world, player, signs, quest, discover, onMove, sfx }) {
  // Ordre : Passé, Présent, Futur ; dans chaque île, extérieur puis intérieurs.
  const stops = [...signs].sort((a, b) => ERA_ORDER[a.era] - ERA_ORDER[b.era] || (a.z > 400) - (b.z > 400))
  const per = TOTAL_TIME / (stops.length + 1)
  let active = false
  let index = 0
  let timer = 0
  let phase = 'idle'

  // Place libre à côté du point, face à lui, du côté de la caméra de préférence.
  function standNear(item) {
    if (item.stand) return item.stand.clone()
    const tries = [[0, 2.4], [2.4, 1.2], [-2.4, 1.2], [0, 3.2], [2.6, 0], [-2.6, 0], [0, -2.4], [3.4, 2.4], [-3.4, 2.4]]
    for (const [dx, dz] of tries) {
      const x = item.x + dx
      const z = item.z + dz
      const y = world.groundAt(x, z, Infinity, true)
      if (y === null || y === undefined) continue
      if (world.blocked(x, z, y)) continue
      if (world.colliders.some((c) => Math.hypot(c.x - x, c.z - z) < c.r + 0.5 && y < c.top - 0.2)) continue
      return new THREE.Vector3(x, y, z)
    }
    const y = world.groundAt(item.x, item.z + 2.4, Infinity, true) ?? 0
    return new THREE.Vector3(item.x, y, item.z + 2.4)
  }

  function go(i) {
    index = i
    timer = 0
    phase = 'moving'
    ui.closePanel()
    const item = i < stops.length ? stops[i] : quest.interactable
    sfx?.blip('whoosh')
    ui.fade(() => {
      if (!active) return
      const spot = standNear(item)
      player.teleport(spot)
      player.face(Math.atan2(item.x - spot.x, item.z - spot.z))
      onMove?.()
      phase = 'arriving'
      timer = 0
    })
  }

  function show() {
    phase = 'reading'
    timer = 0
    if (index < stops.length) {
      const item = stops[index]
      discover(item)
      sfx?.blip('open')
      if (item.showcase) item.showcase.open()
      else ui.openPanel({ ...item, side: true, count: `Étape ${index + 1} / ${stops.length + 1}` })
    } else {
      // Tous les points ont défilé : la visite compte comme une exploration complète.
      for (const item of stops) discover(item)
      quest.open(player)
    }
  }

  function stop() {
    if (!active) return
    active = false
    phase = 'idle'
    ui.setTour(null)
  }

  return {
    get active() {
      return active
    },
    start() {
      active = true
      go(0)
    },
    stop,
    next() {
      if (!active) return
      if (index + 1 > stops.length) return stop()
      go(index + 1)
    },
    update(dt) {
      if (!active) return
      timer += dt
      if (phase === 'arriving' && timer > 0.6) show()
      else if (phase === 'reading') {
        // Fiche fermée à la main : le visiteur reprend la main.
        if (!ui.panelOpen() && timer > 0.3) return stop()
        if (timer > per - 0.6) {
          if (index >= stops.length) {
            // Fin de la visite : la fiche du coffre reste ouverte.
            active = false
            phase = 'idle'
            ui.setTour(null)
            return
          }
          go(index + 1)
        }
      }
      ui.setTour({ index: Math.min(index + 1, stops.length + 1), total: stops.length + 1, progress: (index + Math.min(1, timer / per)) / (stops.length + 1) })
    },
  }
}
