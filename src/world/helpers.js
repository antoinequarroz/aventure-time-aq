import * as THREE from 'three'

export function mat(color, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.9, ...extra })
}

export function mesh(geometry, material, { x = 0, y = 0, z = 0, shadow = true } = {}) {
  const m = new THREE.Mesh(geometry, material)
  m.position.set(x, y, z)
  m.castShadow = shadow
  m.receiveShadow = true
  return m
}

// Déforme légèrement les sommets pour un rendu low-poly plus organique.
export function jitter(geometry, amount, seed = 1) {
  let s = seed
  const rand = () => {
    s = (s * 16807) % 2147483647
    return s / 2147483647 - 0.5
  }
  const pos = geometry.attributes.position
  const seen = new Map()
  for (let i = 0; i < pos.count; i++) {
    const key = `${pos.getX(i).toFixed(3)},${pos.getY(i).toFixed(3)},${pos.getZ(i).toFixed(3)}`
    if (!seen.has(key)) seen.set(key, [rand() * amount, rand() * amount, rand() * amount])
    const [dx, dy, dz] = seen.get(key)
    pos.setXYZ(i, pos.getX(i) + dx, pos.getY(i) + dy, pos.getZ(i) + dz)
  }
  geometry.computeVertexNormals()
  return geometry
}

export function textTexture(text, { width = 512, height = 128, bg = '#3b2a1a', fg = '#fbe9c8', font = 'bold 54px "Outfit Variable", "Inter Variable", sans-serif' } = {}) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, width, height)
  ctx.fillStyle = fg
  ctx.font = font
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, width / 2, height / 2, width - 30)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

// Personnage simple fait de primitives (utilisé pour le joueur et les PNJ).
export function makeCharacter({ body = 0x3f6fd8, skin = 0xf1c27d, legs = 0x2b2b3a, helmet = null } = {}) {
  const group = new THREE.Group()
  const torso = mesh(new THREE.CapsuleGeometry(0.45, 0.6, 4, 8), mat(body), { y: 1.25 })
  const head = mesh(new THREE.SphereGeometry(0.38, 12, 10), mat(skin), { y: 2.15 })
  group.add(torso, head)
  if (helmet) {
    const visor = mesh(new THREE.SphereGeometry(0.46, 14, 12), mat(helmet, { transparent: true, opacity: 0.45, roughness: 0.1 }), { y: 2.15 })
    group.add(visor)
  }
  const legL = mesh(new THREE.CapsuleGeometry(0.16, 0.45, 3, 6), mat(legs), { x: -0.2, y: 0.45 })
  const legR = legL.clone()
  legR.position.x = 0.2
  const armL = mesh(new THREE.CapsuleGeometry(0.13, 0.5, 3, 6), mat(body), { x: -0.6, y: 1.35 })
  const armR = armL.clone()
  armR.position.x = 0.6
  group.add(legL, legR, armL, armR)
  group.userData.limbs = { legL, legR, armL, armR }
  return group
}
