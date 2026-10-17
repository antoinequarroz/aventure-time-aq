import * as THREE from 'three'

// Petits secrets : trois étoiles cachées au bord des îles (une par époque), et un code
// bien connu des joueurs. Aucune n'apparaît sur la carte.

const KEY = 'aventure-time-aq:secrets'
const SPOTS = [
  { id: 'past', x: -171, z: -44, hint: 'derrière le château' },
  { id: 'present', x: 17, z: -14, hint: 'sur les hauteurs du village' },
  { id: 'future', x: 200, z: 19, hint: 'tout au bout de la Lune' },
]
const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'KeyB', 'KeyA']

export function createSecrets(scene, world, { onFound, onAll, onKonami }) {
  let found = []
  try {
    found = JSON.parse(localStorage.getItem(KEY)) || []
  } catch {
    found = []
  }
  const save = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify(found))
    } catch {
      // Navigation privée.
    }
  }
  const starGeo = new THREE.OctahedronGeometry(0.32, 0)
  const haloGeo = new THREE.RingGeometry(0.45, 0.6, 24)
  const stars = SPOTS.filter((s) => !found.includes(s.id)).map((spot) => {
    const g = new THREE.Group()
    const y = world.groundAt(spot.x, spot.z, Infinity, true) ?? 0
    g.position.set(spot.x, y + 1, spot.z)
    const star = new THREE.Mesh(starGeo, new THREE.MeshStandardMaterial({ color: 0xfff1b8, emissive: 0xffc94a, emissiveIntensity: 2.4 }))
    star.scale.set(1, 1.5, 1)
    const halo = new THREE.Mesh(haloGeo, new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false }))
    g.add(star, halo)
    g.userData = { spot, star, halo, baseY: y + 1 }
    scene.add(g)
    return g
  })

  let typed = []
  window.addEventListener('keydown', (e) => {
    typed.push(e.code)
    typed = typed.slice(-KONAMI.length)
    if (typed.join() === KONAMI.join()) {
      typed = []
      onKonami?.()
    }
  })

  return {
    total: SPOTS.length,
    get count() {
      return found.length
    },
    update(dt, t, player) {
      const p = player.position
      for (let i = stars.length - 1; i >= 0; i--) {
        const g = stars[i]
        const { star, halo, baseY, spot } = g.userData
        star.rotation.y += dt * 2
        g.position.y = baseY + Math.sin(t * 2 + i) * 0.15
        halo.lookAt(halo.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0, 1)))
        halo.scale.setScalar(1 + Math.sin(t * 3) * 0.12)
        if (Math.hypot(p.x - g.position.x, p.z - g.position.z) < 1.3 && Math.abs(p.y + 1 - g.position.y) < 1.8) {
          scene.remove(g)
          stars.splice(i, 1)
          found.push(spot.id)
          save()
          onFound?.(found.length, SPOTS.length, g.position.clone())
          if (found.length === SPOTS.length) onAll?.()
        }
      }
    },
  }
}
