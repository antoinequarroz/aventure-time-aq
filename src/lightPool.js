import * as THREE from 'three'

// Réserve de lumières ponctuelles.
// Chaque lumière ponctuelle de la scène coûte du calcul sur chaque pixel, même loin
// de la caméra (il y en a une trentaine : torches, lampes, écrans…). On les rend toutes
// invisibles et on garde seulement quelques vraies lumières, placées chaque image sur
// les lumières les plus proches de la caméra. Leur nombre ne change jamais : les shaders
// ne sont donc jamais recompilés en se déplaçant.
export function createLightPool(scene, size = 6) {
  const pool = []
  for (let i = 0; i < size; i++) {
    const l = new THREE.PointLight(0xffffff, 0, 1, 2)
    l.userData.pooled = true
    pool.push(l)
    scene.add(l)
  }
  const sources = []
  const known = new Set()
  const pos = new THREE.Vector3()
  const ranked = []

  // Recense les lumières ponctuelles (à relancer si de nouvelles apparaissent).
  function scan() {
    scene.traverse((o) => {
      if (o.isPointLight && !o.userData.pooled && !known.has(o)) {
        o.visible = false
        known.add(o)
        sources.push(o)
      }
    })
  }

  function update(focus) {
    ranked.length = 0
    for (const s of sources) {
      // Lumière d'une île retirée de la scène (trop loin) : ignorée.
      if (!inScene(s)) continue
      s.getWorldPosition(pos)
      const d = pos.distanceToSquared(focus)
      ranked.push({ s, d, x: pos.x, y: pos.y, z: pos.z })
    }
    ranked.sort((a, b) => a.d - b.d)
    for (let i = 0; i < pool.length; i++) {
      const l = pool[i]
      const r = ranked[i]
      if (!r) {
        l.intensity = 0
        continue
      }
      l.position.set(r.x, r.y, r.z)
      l.color.copy(r.s.color)
      l.intensity = r.s.intensity
      l.distance = r.s.distance
      l.decay = r.s.decay
    }
  }

  function inScene(o) {
    let p = o.parent
    while (p) {
      if (p === scene) return true
      p = p.parent
    }
    return false
  }

  return { scan, update, get count() { return sources.length } }
}
