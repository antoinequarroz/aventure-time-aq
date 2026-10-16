import * as THREE from 'three'
import { mat, mesh } from './helpers.js'

// Fond spatial : étoiles et quelques planètes lointaines.
export function createSpace(scene) {
  scene.background = new THREE.Color(0x070a1f)
  scene.fog = new THREE.Fog(0x070a1f, 120, 420)

  const count = 4000
  const positions = new Float32Array(count * 3)
  const colors = new Float32Array(count * 3)
  const color = new THREE.Color()
  for (let i = 0; i < count; i++) {
    const r = 350 + Math.random() * 150
    const theta = Math.random() * Math.PI * 2
    const phi = Math.acos(2 * Math.random() - 1)
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta)
    positions[i * 3 + 1] = r * Math.cos(phi)
    positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta)
    color.setHSL(0.55 + Math.random() * 0.15, 0.6, 0.75 + Math.random() * 0.25)
    colors.set([color.r, color.g, color.b], i * 3)
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  const stars = new THREE.Points(geometry, new THREE.PointsMaterial({ size: 1.6, vertexColors: true, fog: false, sizeAttenuation: true }))
  scene.add(stars)

  const planets = new THREE.Group()
  const ringed = mesh(new THREE.SphereGeometry(28, 32, 24), mat(0xd9a86c, { fog: false }), { x: 160, y: 70, z: -260, shadow: false })
  const ring = mesh(new THREE.RingGeometry(36, 52, 64), new THREE.MeshBasicMaterial({ color: 0xc7a37a, side: THREE.DoubleSide, transparent: true, opacity: 0.6, fog: false }), { shadow: false })
  ring.rotation.x = Math.PI / 2.4
  ringed.add(ring)
  const blue = mesh(new THREE.SphereGeometry(14, 24, 18), mat(0x4a7bd1, { fog: false }), { x: -190, y: 40, z: -220, shadow: false })
  const red = mesh(new THREE.SphereGeometry(8, 20, 14), mat(0xb5523b, { fog: false }), { x: -40, y: 110, z: -300, shadow: false })
  planets.add(ringed, blue, red)
  scene.add(planets)

  return {
    update(dt) {
      stars.rotation.y += dt * 0.004
      ringed.rotation.y += dt * 0.05
      blue.rotation.y += dt * 0.08
    },
  }
}
