import * as THREE from 'three'
import { vehicles as labels } from '../content.js'
import { mat, mesh } from './helpers.js'
import { model } from './models.js'
import { THEMES } from './islands.js'

// Deux véhicules partagés : la voiture relie le passé et le présent,
// la fusée relie le présent et le futur. Chacun attend sur l'île où on l'a laissé.
export function createVehicles(scene) {
  const list = [
    makeVehicle(scene, {
      id: 'car',
      model: buildCar(),
      stations: [
        { island: 'past', at: [17, 0], exit: [-3, 0] },
        { island: 'present', at: [-17, 0], exit: [3, 0] },
      ],
      duration: 5,
      height: 30,
      upright: false,
    }),
    makeVehicle(scene, {
      id: 'rocket',
      model: buildRocket(),
      stations: [
        { island: 'present', at: [17, 0], exit: [-3.5, 0] },
        { island: 'future', at: [-17, 0], exit: [3.5, 0] },
      ],
      duration: 6,
      height: 70,
      upright: true,
    }),
  ]

  let trip = null

  return {
    interactables: list.map((v) => v.interactable),
    get traveling() {
      return trip !== null
    },
    start(interactable, player) {
      const vehicle = list.find((v) => v.interactable === interactable)
      if (!vehicle || trip) return
      trip = { vehicle, t: 0, player }
      player.setVisible(false)
    },
    update(dt, t) {
      for (const v of list) v.idle(t, trip?.vehicle === v)
      if (!trip) return
      const { vehicle, player } = trip
      trip.t += dt / vehicle.duration
      const done = trip.t >= 1
      const pos = vehicle.fly(Math.min(trip.t, 1), t)
      player.teleport(pos)
      if (done) {
        const exit = vehicle.arrive()
        player.teleport(exit)
        player.setVisible(true)
        trip = null
      }
    },
  }
}

function stationWorld(station) {
  const c = THEMES[station.island].center
  return {
    pos: new THREE.Vector3(c.x + station.at[0], 0, c.z + station.at[1]),
    exit: new THREE.Vector3(c.x + station.at[0] + station.exit[0], 0, c.z + station.at[1] + station.exit[1]),
  }
}

function makeVehicle(scene, { id, model, stations, duration, height, upright }) {
  scene.add(model)
  const world = stations.map(stationWorld)
  let index = 0
  const from = new THREE.Vector3()
  const to = new THREE.Vector3()
  const prev = new THREE.Vector3()
  const up = new THREE.Vector3(0, 1, 0)

  const interactable = {
    type: 'vehicle',
    id,
    r: 3.5,
    x: 0,
    z: 0,
    title: '',
  }

  function park() {
    const { pos } = world[index]
    model.position.copy(pos)
    model.quaternion.identity()
    // La voiture regarde vers l'autre île.
    if (!upright) model.lookAt(world[1 - index].pos.x, 0, world[1 - index].pos.z)
    interactable.x = pos.x
    interactable.z = pos.z
    const island = stations[index].island
    interactable.title = `${labels[id].label} vers le ${labels[id].to[island]}`
  }
  park()

  const pointAt = (k, target) => {
    const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2
    target.lerpVectors(from, to, e)
    // Fusée : décollage vertical marqué ; voiture : grand saut en arc.
    const lift = upright ? Math.sin(Math.PI * Math.pow(k, 0.7)) : Math.sin(Math.PI * k)
    target.y += lift * height
    return target
  }

  return {
    interactable,
    duration,
    fly(k, t) {
      if (k === 0 || prev.lengthSq() === 0) {
        from.copy(world[index].pos)
        to.copy(world[1 - index].pos)
      }
      const pos = pointAt(k, new THREE.Vector3())
      const ahead = pointAt(Math.min(k + 0.01, 1), new THREE.Vector3())
      const dir = ahead.sub(pos)
      if (dir.lengthSq() > 1e-6) {
        dir.normalize()
        if (upright) model.quaternion.setFromUnitVectors(up, dir)
        else model.lookAt(pos.clone().add(dir))
      }
      model.position.copy(pos)
      prev.copy(pos)
      model.userData.onFly?.(t)
      return pos.clone()
    },
    arrive() {
      index = 1 - index
      prev.set(0, 0, 0)
      park()
      model.userData.onPark?.()
      return world[index].exit.clone()
    },
    idle(t, flying) {
      if (!flying) model.userData.onIdle?.(t)
    },
  }
}

// Pick-up rouge du Racing Kit de Kenney.
function buildCar() {
  const car = new THREE.Group()
  const truck = model('truck', { width: 4 })
  car.add(truck)
  car.userData.onIdle = (t) => {
    truck.position.y = Math.sin(t * 30) * 0.015
  }
  car.userData.onFly = (t) => {
    truck.rotation.z = Math.sin(t * 6) * 0.08
  }
  car.userData.onPark = () => {
    truck.rotation.z = 0
  }
  return car
}

function buildRocket() {
  const rocket = new THREE.Group()
  rocket.add(mesh(new THREE.CylinderGeometry(1, 1.1, 6, 14), mat(0xf2f2f2), { y: 4 }))
  rocket.add(mesh(new THREE.ConeGeometry(1, 2.2, 14), mat(0xd6402f), { y: 8.1 }))
  rocket.add(mesh(new THREE.CircleGeometry(0.45, 14), mat(0x6fd3ff, { emissive: 0x2a8fd0 }), { y: 5.5, z: 1.03 }))
  for (let i = 0; i < 3; i++) {
    const fin = mesh(new THREE.BoxGeometry(0.15, 1.8, 1.2), mat(0xd6402f), { y: 1.6 })
    const a = (i / 3) * Math.PI * 2
    fin.position.x = Math.cos(a) * 1.15
    fin.position.z = Math.sin(a) * 1.15
    fin.rotation.y = -a
    rocket.add(fin)
  }
  const flame = mesh(
    new THREE.ConeGeometry(0.75, 2.6, 12),
    new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0.9 }),
    { y: -0.2, shadow: false },
  )
  flame.rotation.x = Math.PI
  flame.visible = false
  rocket.add(flame)
  // Pas de tir au sol.
  const pad = mesh(new THREE.CylinderGeometry(2.2, 2.4, 0.3, 16), mat(0x555a66), { y: 0.15 })
  rocket.add(pad)

  rocket.userData.onFly = (t) => {
    pad.visible = false
    flame.visible = true
    flame.scale.y = 1 + Math.sin(t * 40) * 0.25
  }
  rocket.userData.onPark = () => {
    pad.visible = true
    flame.visible = false
  }
  return rocket
}
