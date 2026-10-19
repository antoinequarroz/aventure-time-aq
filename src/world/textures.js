import * as THREE from 'three'

// Textures de sol peintes à la main sur un canvas : herbe du Passé (Mike Fernandez),
// dallage orange du Présent (Bruno Simon), poussière grise et cratères du Futur.
// Les UV sont en coordonnées monde : `scale` = répétitions par mètre.

const cache = new Map()

export function groundTexture(era) {
  if (cache.has(era)) return cache.get(era)
  const size = 512
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const g = canvas.getContext('2d')
  let seed = 7
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647
  let scale = 1 / 10

  // Tache qui se répète sans couture (dessinée aussi de l'autre côté des bords).
  const blob = (x, y, r, color) => {
    g.fillStyle = color
    for (const ox of [-size, 0, size]) {
      for (const oy of [-size, 0, size]) {
        g.beginPath()
        g.arc(x + ox, y + oy, r, 0, Math.PI * 2)
        g.fill()
      }
    }
  }

  if (era === 'past') {
    g.fillStyle = '#5fae46'
    g.fillRect(0, 0, size, size)
    // Grandes nappes plus claires et plus sombres, très douces.
    for (let i = 0; i < 70; i++) blob(rnd() * size, rnd() * size, 20 + rnd() * 60, rnd() < 0.5 ? 'rgba(122,196,84,0.16)' : 'rgba(58,128,52,0.14)')
    // Petits brins peints.
    for (let i = 0; i < 2600; i++) {
      const x = rnd() * size
      const y = rnd() * size
      g.strokeStyle = rnd() < 0.5 ? 'rgba(140,210,96,0.35)' : 'rgba(40,110,45,0.3)'
      g.lineWidth = 1.5
      g.beginPath()
      g.moveTo(x, y)
      g.lineTo(x + (rnd() - 0.5) * 3, y - 4 - rnd() * 4)
      g.stroke()
    }
  } else if (era === 'present') {
    scale = 1 / 8
    // Dalles carrées orange, chacune d'une nuance légèrement différente.
    const tiles = 8
    const t = size / tiles
    g.fillStyle = '#c86f34'
    g.fillRect(0, 0, size, size)
    for (let i = 0; i < tiles; i++) {
      for (let j = 0; j < tiles; j++) {
        const l = 56 + (rnd() - 0.5) * 6
        g.fillStyle = `hsl(${24 + (rnd() - 0.5) * 4}, 78%, ${l}%)`
        g.fillRect(i * t + 2, j * t + 2, t - 4, t - 4)
        // Reflet clair en haut, ombre en bas : dalles légèrement bombées.
        g.fillStyle = 'rgba(255,220,170,0.12)'
        g.fillRect(i * t + 2, j * t + 2, t - 4, 5)
        g.fillStyle = 'rgba(120,50,20,0.12)'
        g.fillRect(i * t + 2, j * t + t - 7, t - 4, 5)
      }
    }
    for (let i = 0; i < 260; i++) {
      g.fillStyle = `rgba(150,60,30,${0.15 + rnd() * 0.2})`
      g.fillRect(rnd() * size, rnd() * size, 2 + rnd() * 3, 2 + rnd() * 3)
    }
  } else {
    scale = 1 / 14
    g.fillStyle = '#a9adbd'
    g.fillRect(0, 0, size, size)
    for (let i = 0; i < 90; i++) blob(rnd() * size, rnd() * size, 10 + rnd() * 50, rnd() < 0.5 ? 'rgba(200,204,222,0.18)' : 'rgba(110,112,135,0.16)')
    // Cratères : creux sombre et lèvre claire.
    for (let i = 0; i < 26; i++) {
      const x = rnd() * size
      const y = rnd() * size
      const r = 5 + rnd() * 22
      blob(x + r * 0.12, y + r * 0.12, r * 1.08, 'rgba(225,228,240,0.35)')
      blob(x, y, r, 'rgba(95,97,120,0.4)')
      blob(x - r * 0.15, y - r * 0.15, r * 0.7, 'rgba(80,82,104,0.25)')
    }
    for (let i = 0; i < 1500; i++) {
      g.fillStyle = rnd() < 0.5 ? 'rgba(255,255,255,0.12)' : 'rgba(60,60,80,0.12)'
      g.fillRect(rnd() * size, rnd() * size, 2, 2)
    }
  }

  const map = new THREE.CanvasTexture(canvas)
  map.wrapS = map.wrapT = THREE.RepeatWrapping
  map.colorSpace = THREE.SRGBColorSpace
  map.anisotropy = 8
  const result = { map, scale }
  cache.set(era, result)
  return result
}
