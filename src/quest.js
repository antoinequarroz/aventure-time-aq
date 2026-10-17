import * as THREE from 'three'
import { mat, mesh } from './world/helpers.js'
import { labelTexture } from './world/points.js'
import { quest } from './content.js'

// Quête principale : un coffre sur la place du Présent, verrouillé tant que tous les points
// d'intérêt n'ont pas été découverts. Ouvert, il révèle le CV et un bouton de contact.
const SPOT = new THREE.Vector3(8.5, 0, 9.5)

export function createQuest(scene, world, { ui, sfx, discovered, total, signs }) {
  const group = new THREE.Group()
  const y = world.groundAt(SPOT.x, SPOT.z, Infinity, true) ?? 0
  group.position.set(SPOT.x, y, SPOT.z)
  group.rotation.y = Math.atan2(-SPOT.x, -SPOT.z)
  scene.add(group)

  // Socle en pierre avec un cercle de runes lumineuses.
  group.add(mesh(new THREE.CylinderGeometry(2.1, 2.3, 0.3, 8), mat(0x6c6890, { roughness: 0.9 }), { y: 0.15 }))
  group.add(mesh(new THREE.CylinderGeometry(1.6, 1.75, 0.2, 8), mat(0x8a86b0, { roughness: 0.8 }), { y: 0.38 }))
  const runeMat = new THREE.MeshBasicMaterial({ color: 0xff7ad9, transparent: true, opacity: 0.8, side: THREE.DoubleSide })
  const rune = mesh(new THREE.RingGeometry(1.85, 2.0, 48), runeMat, { y: 0.31, shadow: false })
  rune.rotation.x = -Math.PI / 2
  group.add(rune)

  // Coffre : caisse en bois cerclée d'or, couvercle bombé monté sur charnière.
  const chest = new THREE.Group()
  chest.position.y = 0.48
  group.add(chest)
  const wood = mat(0x8a4f2a, { roughness: 0.75 })
  const gold = mat(0xffc54a, { metalness: 0.8, roughness: 0.3, emissive: 0x6a3a00, emissiveIntensity: 0.3 })
  chest.add(mesh(new THREE.BoxGeometry(1.6, 0.85, 1.0), wood, { y: 0.425 }))
  for (const x of [-0.62, 0.62]) chest.add(mesh(new THREE.BoxGeometry(0.12, 0.88, 1.04), gold, { x, y: 0.425 }))
  chest.add(mesh(new THREE.BoxGeometry(1.64, 0.1, 1.04), gold, { y: 0.06 }))
  const lid = new THREE.Group()
  lid.position.set(0, 0.85, -0.5)
  chest.add(lid)
  const dome = new THREE.CylinderGeometry(0.5, 0.5, 1.6, 16, 1, false, 0, Math.PI).rotateZ(Math.PI / 2)
  lid.add(mesh(dome, wood, { z: 0.5 }))
  for (const x of [-0.62, 0.62]) {
    const band = new THREE.CylinderGeometry(0.53, 0.53, 0.12, 16, 1, false, 0, Math.PI).rotateZ(Math.PI / 2)
    lid.add(mesh(band, gold, { x, z: 0.5 }))
  }
  // Cadenas.
  const lock = new THREE.Group()
  lock.position.set(0, 0.72, 0.52)
  lock.add(mesh(new THREE.BoxGeometry(0.3, 0.3, 0.1), gold))
  lock.add(mesh(new THREE.TorusGeometry(0.1, 0.03, 6, 12, Math.PI), gold, { y: 0.15 }))
  chest.add(lock)
  // Trésor : lumière dorée qui sort du coffre une fois ouvert.
  const glow = mesh(new THREE.BoxGeometry(1.4, 0.05, 0.85), new THREE.MeshBasicMaterial({ color: 0xffe08a }), { y: 0.84, shadow: false })
  glow.visible = false
  chest.add(glow)
  const light = new THREE.PointLight(0xffc56a, 0, 7)
  light.position.y = 1.8
  group.add(light)

  // Faisceau visible de loin : rose tant que la quête est en cours, doré quand le coffre est prêt.
  const beamMat = new THREE.MeshBasicMaterial({ color: 0xff7ad9, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
  const beam = mesh(new THREE.CylinderGeometry(0.9, 1.4, 22, 20, 1, true), beamMat, { y: 11, shadow: false })
  group.add(beam)

  const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTexture(quest.title, '🗝️', '#ff7ad9'), depthWrite: false }))
  label.scale.set(3.6, 1.01, 1)
  label.position.y = 3.4
  group.add(label)

  world.colliders.push({ x: SPOT.x, z: SPOT.z, r: 1.15, top: y + 1.6 })

  const interactable = { type: 'chest', x: SPOT.x, z: SPOT.z, r: 2.6, title: quest.title }
  let opened = false
  let openT = 0
  const sparks = []

  const remaining = () => signs.filter((s) => !discovered.has(s.title))
  const ready = () => discovered.size >= total

  function open(player) {
    if (!ready()) {
      sfx?.blip('locked')
      const missing = remaining()
      const ERA = { past: 'Passé', present: 'Présent', future: 'Futur' }
      ui.openPanel({
        title: `${quest.title} : verrouillé`,
        icon: '🔒',
        kicker: 'Quête principale',
        era: 'present',
        text: [
          quest.locked,
          `Encore ${missing.length} à trouver :`,
          ...missing.slice(0, 12).map((s) => `${s.icon ?? '✦'} ${s.title} (${s.kicker ?? ERA[s.era]})`),
          ...(missing.length > 12 ? [`… et ${missing.length - 12} autre(s).`] : []),
          'Pressé ? Lance la visite guidée : elle fait le tour de tous les points et ouvre le coffre à la fin.',
        ],
        count: `Découverts : ${discovered.size} / ${total}`,
      })
      return
    }
    if (!opened) {
      opened = true
      openT = 0
      sfx?.fanfare()
      player?.cheer?.()
      setTimeout(() => showCV(), 1300)
      return
    }
    showCV()
  }

  function showCV() {
    ui.openPanel({ ...quest.cv, icon: '🏆', kicker: 'Quête accomplie', era: 'present', count: `Découverts : ${discovered.size} / ${total}` })
  }

  return {
    interactable,
    open,
    get opened() {
      return opened
    },
    // Avancement affiché dans le coin de l'écran.
    progress: () => ({ found: Math.min(discovered.size, total), total, ready: ready(), opened }),
    update(dt, t) {
      const isReady = ready()
      beamMat.color.set(isReady ? 0xffc54a : 0xff7ad9)
      runeMat.color.copy(beamMat.color)
      beamMat.opacity = (opened ? 0.1 : 0.16) + Math.sin(t * 2) * 0.04
      rune.rotation.z += dt * 0.4
      label.position.y = 3.4 + Math.sin(t * 2) * 0.1
      lock.visible = !opened
      if (!opened && isReady) chest.rotation.z = Math.sin(t * 9) * 0.02 * (Math.sin(t * 1.5) > 0.6 ? 1 : 0)
      if (opened) {
        openT += dt
        chest.rotation.z = 0
        const k = Math.min(1, openT / 0.9)
        lid.rotation.x = -(1 - (1 - k) ** 3) * 1.9
        glow.visible = true
        light.intensity = 6 + Math.sin(t * 5)
        if (sparks.length < 40 && Math.random() < dt * 30) {
          const s = mesh(new THREE.OctahedronGeometry(0.06), new THREE.MeshBasicMaterial({ color: 0xffe08a }), { x: (Math.random() - 0.5) * 1.2, y: 1.4, z: (Math.random() - 0.5) * 0.7, shadow: false })
          s.userData.v = 1 + Math.random() * 1.5
          group.add(s)
          sparks.push(s)
        }
      }
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i]
        s.position.y += s.userData.v * dt
        s.rotation.y += dt * 4
        if (s.position.y > 4.5) {
          group.remove(s)
          s.geometry.dispose()
          sparks.splice(i, 1)
        }
      }
    },
  }
}
