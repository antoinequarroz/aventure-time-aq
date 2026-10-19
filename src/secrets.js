import * as THREE from 'three'

// Petits secrets : trois étoiles cachées au bord des îles (une par époque), et un code
// bien connu des joueurs. Aucune n'apparaît sur la carte.

const KEY = 'aventure-time-aq:secrets'
const SPOTS = [
  { id: 'past', x: -171, z: -44, hint: 'derrière le château' },
  { id: 'present', x: 17, z: -14, hint: 'sur les hauteurs du village' },
  { id: 'future', x: 200, z: 19, hint: 'tout au bout de la Lune' },
]
// Reliques cachées : un petit objet par époque, qui s'ouvre sur une fiche amusante.
const RELIC_KEY = 'aventure-time-aq:relics'
export const RELICS = [
  { id: 'grimoire', era: 'past', x: -133, z: 50, icon: '📖', title: 'Le grimoire perdu', text: ['Un vieux grimoire oublié au bord du lac. La première page dit : « Pour lancer un sort, il suffit d\'écrire les bonnes lignes dans le bon ordre. »', 'Les mages d\'autrefois étaient sans doute déjà un peu développeurs.'] },
  { id: 'duck', era: 'present', x: 38, z: 50, icon: '🦆', title: 'Le canard en plastique doré', text: ['Le célèbre canard du débogage ! Les développeurs lui expliquent leur code ligne par ligne, et le bug saute souvent aux yeux avant la fin de l\'explication.', 'Celui-ci est en or : il a dû résoudre beaucoup de bugs.'] },
  { id: 'cat', era: 'future', x: 157, z: 38, icon: '📦', title: 'La boîte de Schrödinger', text: ['Une boîte scellée flotte au bord de l\'orbite. Selon la physique quantique, le chat à l\'intérieur est à la fois endormi et réveillé… tant qu\'on ne l\'ouvre pas.', 'Tu préfères ne pas vérifier.'] },
]

function relicModel(id) {
  const g = new THREE.Group()
  const M = (color, emissive = 0x000000, e = 0) => new THREE.MeshStandardMaterial({ color, emissive, emissiveIntensity: e, roughness: 0.6, flatShading: true })
  const add = (geo, mat, x = 0, y = 0, z = 0) => {
    const m = new THREE.Mesh(geo, mat)
    m.position.set(x, y, z)
    m.castShadow = true
    g.add(m)
    return m
  }
  if (id === 'grimoire') {
    add(new THREE.BoxGeometry(0.62, 0.16, 0.46), M(0x6b2d5c, 0x4a1a40, 0.4), 0, 0.08)
    add(new THREE.BoxGeometry(0.56, 0.12, 0.42), M(0xf3e6c4), 0.03, 0.08)
    add(new THREE.OctahedronGeometry(0.08, 0), M(0xffd27a, 0xffb347, 2), 0, 0.18)
  } else if (id === 'duck') {
    const gold = M(0xffd24a, 0xffb347, 0.8)
    add(new THREE.SphereGeometry(0.26, 10, 8), gold, 0, 0.22).scale.set(1.25, 0.85, 1)
    add(new THREE.SphereGeometry(0.17, 10, 8), gold, 0.2, 0.48)
    add(new THREE.ConeGeometry(0.07, 0.16, 6).rotateZ(-Math.PI / 2), M(0xff8a3d), 0.4, 0.46)
    add(new THREE.SphereGeometry(0.03, 6, 4), M(0x1a1530), 0.3, 0.54, 0.09)
    add(new THREE.SphereGeometry(0.03, 6, 4), M(0x1a1530), 0.3, 0.54, -0.09)
  } else {
    add(new THREE.BoxGeometry(0.6, 0.5, 0.6), M(0xc9a26a), 0, 0.25)
    add(new THREE.BoxGeometry(0.64, 0.06, 0.64), M(0xa8824f), 0, 0.52)
    add(new THREE.TorusGeometry(0.12, 0.03, 6, 12, Math.PI * 1.4), M(0x7cf7ff, 0x3ad7ff, 2), 0, 0.27, 0.31)
  }
  return g
}

const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'KeyB', 'KeyA']

export function createSecrets(scene, world, { onFound, onAll, onKonami, onRelic }) {
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

  let relicsFound = []
  try {
    relicsFound = JSON.parse(localStorage.getItem(RELIC_KEY)) || []
  } catch {
    relicsFound = []
  }
  const relics = RELICS.filter((r) => !relicsFound.includes(r.id)).map((relic) => {
    const g = relicModel(relic.id)
    const y = world.groundAt(relic.x, relic.z, Infinity, true) ?? 0
    g.position.set(relic.x, y, relic.z)
    g.rotation.y = relic.x * 0.7
    // Petites étincelles qui trahissent la cachette quand on passe près.
    const glint = new THREE.Mesh(new THREE.OctahedronGeometry(0.06, 0), new THREE.MeshBasicMaterial({ color: 0xfff1b8 }))
    g.add(glint)
    g.userData = { relic, glint, baseY: y }
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
    relicTotal: RELICS.length,
    get relicCount() {
      return relicsFound.length
    },
    get count() {
      return found.length
    },
    update(dt, t, player) {
      const p = player.position
      for (let i = relics.length - 1; i >= 0; i--) {
        const g = relics[i]
        const { relic, glint } = g.userData
        const k = (t * 1.3 + i) % 2
        glint.position.set(Math.sin(t * 2 + i) * 0.35, 0.4 + k * 0.4, Math.cos(t * 2 + i) * 0.35)
        glint.visible = k < 1.2
        if (Math.hypot(p.x - relic.x, p.z - relic.z) < 1.4) {
          scene.remove(g)
          relics.splice(i, 1)
          relicsFound.push(relic.id)
          try {
            localStorage.setItem(RELIC_KEY, JSON.stringify(relicsFound))
          } catch {
            // Navigation privée.
          }
          onRelic?.(relic, relicsFound.length, RELICS.length)
        }
      }
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
