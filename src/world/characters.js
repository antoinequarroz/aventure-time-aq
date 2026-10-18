import * as THREE from 'three'
import { model, animate } from './models.js'
import { mat, mesh } from './helpers.js'

// Personnages KayKit Adventurers (CC0) : chevalier, voleur, barbare et mage, tous animés
// (Idle, Walking_A, Running_A, Jump_Idle, Jump_Land, Cheer, Interact, Sit_Chair_Idle, Spellcasting).
// Chaque modèle contient toutes ses armes et accessoires : on masque ceux qu'on ne garde pas.

const PROPS = {
  knight: ['1H_Sword_Offhand', 'Badge_Shield', 'Rectangle_Shield', 'Round_Shield', 'Spike_Shield', '1H_Sword', '2H_Sword', 'Knight_Helmet', 'Knight_Cape'],
  rogue: ['Knife_Offhand', '1H_Crossbow', '2H_Crossbow', 'Knife', 'Throwable', 'Rogue_Cape'],
  barbarian: ['1H_Axe_Offhand', 'Barbarian_Round_Shield', '1H_Axe', '2H_Axe', 'Mug', 'Barbarian_Hat', 'Barbarian_Cape'],
  mage: ['Spellbook', 'Spellbook_open', '1H_Wand', '2H_Staff', 'Mage_Hat', 'Mage_Cape'],
}

export function character(key, { height = 1.9, keep = [], x = 0, z = 0, rotY = 0 } = {}) {
  const object = model(key, { height, x, z, rotY })
  object.traverse((o) => {
    if (PROPS[key].includes(o.name) && !keep.includes(o.name)) o.visible = false
  })
  return object
}

// Position du joueur, mise à jour par main.js : les PNJ se tournent vers lui et le saluent.
export const focus = new THREE.Vector3(1e6, 0, 0)

// Personnage non joueur posé sur une île. Sans `path`, il joue son animation sur place ;
// avec `path` (points [x, z] locaux), il se promène de point en point et fait une pause à chacun.
// Quand le joueur s'approche, il s'arrête, se tourne vers lui et le salue.
// PNJ à qui on peut parler (option `talk` = identifiant du dialogue, voir `dialogues` dans content.js).
export const talkers = []

export function npc(ctx, key, x, z, { rotY = 0, anim = 'Idle', keep, height = 1.9, r = 0.5, speed = 1, path = null, walk = 1.3, pause = 2.5, greet = true, talk = null } = {}) {
  const object = character(key, { height, keep, x, z, rotY })
  if (talk) talkers.push({ id: talk, key, object, center: ctx.center })
  ctx.group.add(object)
  // Hauteur gérée ici (pas par le calage automatique), car le PNJ peut changer de niveau en marchant.
  object.userData.terrain = true
  object.position.y = ctx.heightAt(x, z)
  const { mixer, actions } = animate(object, anim)
  if (actions[anim]) actions[anim].timeScale = speed
  // Décalage pour que les PNJ ne bougent pas tous en même temps.
  mixer.update(Math.abs(x * 1.7 + z) % 3)
  let col = null
  if (r) {
    ctx.addCollider(x, z, r)
    col = ctx.colliders[ctx.colliders.length - 1]
  }
  let current = actions[anim]
  const play = (name, scale = 1) => {
    const next = actions[name]
    if (!next) return
    next.timeScale = scale
    if (next === current) return
    next.reset().fadeIn(0.25).play()
    current?.fadeOut(0.25)
    current = next
  }
  let target = 0
  let wait = pause * (0.3 + Math.random())
  let greeted = 0
  const pos = object.position
  ctx.animated.push((dt) => {
    mixer.update(dt)
    const px = focus.x - ctx.center.x - pos.x
    const pz = focus.z - ctx.center.z - pos.z
    const near = greet && px * px + pz * pz < 3.2 * 3.2
    if (near) {
      turn(Math.atan2(px, pz), dt)
      if (greeted <= 0) {
        play('Cheer')
        greeted = 2.2
      }
      greeted -= dt
      if (greeted < 0.3) play(anim === 'Cheer' ? 'Idle' : anim, speed)
      return
    }
    greeted = 0
    if (!path) {
      play(anim, speed)
      return
    }
    if (wait > 0) {
      play(anim, speed)
      wait -= dt
      return
    }
    const [tx, tz] = path[target]
    const dx = tx - pos.x
    const dz = tz - pos.z
    const d = Math.hypot(dx, dz)
    if (d < 0.12) {
      target = (target + 1) % path.length
      wait = pause * (0.6 + Math.random() * 0.8)
      return
    }
    play('Walking_A', walk / 1.3)
    const step = Math.min(d, walk * dt)
    pos.x += (dx / d) * step
    pos.z += (dz / d) * step
    pos.y = ctx.heightAt(pos.x, pos.z)
    turn(Math.atan2(dx, dz), dt)
    if (col) {
      col.x = ctx.center.x + pos.x
      col.z = ctx.center.z + pos.z
    }
  })
  function turn(angle, dt) {
    let diff = angle - object.rotation.y
    diff = Math.atan2(Math.sin(diff), Math.cos(diff))
    object.rotation.y += diff * Math.min(1, dt * 6)
  }
  return { object, mixer, actions }
}

// Casque de cosmonaute (bulle de verre) et réservoirs, accrochés aux os de la tête et du torse.
export function spaceSuit(object) {
  object.updateMatrixWorld(true)
  const head = object.getObjectByName('head')
  const chest = object.getObjectByName('chest')
  const scale = new THREE.Vector3()
  const bubble = new THREE.Group()
  bubble.add(mesh(new THREE.SphereGeometry(0.62, 20, 14), mat(0xa8d8ff, { transparent: true, opacity: 0.3, roughness: 0.05, metalness: 0.2, depthWrite: false }), { y: 0.42, shadow: false }))
  bubble.add(mesh(new THREE.TorusGeometry(0.5, 0.07, 6, 20).rotateX(Math.PI / 2), mat(0xe8e8f0), { y: 0.02 }))
  head.getWorldScale(scale)
  bubble.scale.setScalar(1 / scale.x * 1.05)
  head.add(bubble)
  const pack = new THREE.Group()
  for (const px of [-0.16, 0.16]) pack.add(mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.55, 10), mat(0xf2f2f2), { x: px, z: -0.42, y: 0.15 }))
  pack.add(mesh(new THREE.SphereGeometry(0.05, 6, 4), mat(0xff4a4a, { emissive: 0xff2a2a, emissiveIntensity: 2 }), { y: 0.48, z: -0.5, shadow: false }))
  chest.getWorldScale(scale)
  pack.scale.setScalar(1 / scale.x * 0.62)
  chest.add(pack)
}
