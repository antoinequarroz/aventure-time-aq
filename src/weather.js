import * as THREE from 'three'

// Météo et cycle jour/nuit.
// - Le cycle dure quelques minutes : la lumière baisse, le soleil tourne (les ombres bougent)
//   et la nuit les étoiles brillent davantage.
// - Neige qui tombe sur le Passé, lucioles qui sortent la nuit, étoiles filantes au Futur.
export const DAY_LENGTH = 240

export function createWeather(scene) {
  // ---------- Neige (Passé) ----------
  const SNOW = 1400
  const BOX = { x: 70, y: 30, z: 60 }
  const snowPos = new Float32Array(SNOW * 3)
  const snowSeed = new Float32Array(SNOW)
  for (let i = 0; i < SNOW; i++) {
    snowPos.set([(Math.random() - 0.5) * BOX.x, Math.random() * BOX.y, (Math.random() - 0.5) * BOX.z], i * 3)
    snowSeed[i] = Math.random() * 100
  }
  const snowGeo = new THREE.BufferGeometry()
  snowGeo.setAttribute('position', new THREE.BufferAttribute(snowPos, 3))
  const snowMat = new THREE.PointsMaterial({ size: 0.22, map: dotTexture(), color: 0xffffff, transparent: true, opacity: 0, depthWrite: false })
  const snow = new THREE.Points(snowGeo, snowMat)
  snow.frustumCulled = false
  scene.add(snow)

  // ---------- Lucioles de nuit (Passé et Présent) ----------
  const FLIES = 140
  const flyBase = new Float32Array(FLIES * 3)
  for (let i = 0; i < FLIES; i++) flyBase.set([(Math.random() - 0.5) * 50, 0.5 + Math.random() * 3.5, (Math.random() - 0.5) * 40], i * 3)
  const flyGeo = new THREE.BufferGeometry()
  flyGeo.setAttribute('position', new THREE.BufferAttribute(flyBase.slice(), 3))
  const flyMat = new THREE.PointsMaterial({ size: 0.3, map: dotTexture(), color: new THREE.Color(0xfff08a).multiplyScalar(2.5), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })
  const flies = new THREE.Points(flyGeo, flyMat)
  flies.frustumCulled = false
  scene.add(flies)

  // ---------- Étoiles filantes ----------
  const shooting = []
  let nextStar = 2
  function spawnStar(center) {
    const SEG = 24
    const pos = new Float32Array(SEG * 3)
    const col = new Float32Array(SEG * 4)
    for (let i = 0; i < SEG; i++) {
      const k = 1 - i / (SEG - 1)
      col.set([1, 0.95, 1, k * k], i * 4)
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    geo.setAttribute('color', new THREE.BufferAttribute(col, 4))
    const material = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending })
    material.color.setScalar(3)
    const line = new THREE.Line(geo, material)
    line.frustumCulled = false
    // La caméra plonge vers les îles : le « ciel » visible est le fond étoilé derrière et sous elles.
    // Les étoiles filantes traversent donc cette zone, en légère diagonale.
    const side = Math.random() < 0.5 ? -1 : 1
    const start = new THREE.Vector3(center.x - side * (40 + Math.random() * 60), center.y - 4 - Math.random() * 16, center.z - 110 - Math.random() * 80)
    const dir = new THREE.Vector3(side, -0.08 - Math.random() * 0.14, (Math.random() - 0.5) * 0.3).normalize()
    // Tête lumineuse de l'étoile filante.
    const head = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTexture(), color: new THREE.Color(0xdff4ff).multiplyScalar(3), transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }))
    head.scale.setScalar(2.4)
    line.add(head)
    scene.add(line)
    shooting.push({ line, head, start, dir, t: 0, life: 1.1 + Math.random() * 0.7, speed: 110 + Math.random() * 70, len: 26 + Math.random() * 18 })
  }

  let era = 'past'
  let snowK = 0
  let flyK = 0
  const state = { day: 1, phase: 0, shift: 0, force: null }

  let lastCenter = new THREE.Vector3()
  return {
    state,
    // Débogage : lance une étoile filante tout de suite.
    shootingStar: () => spawnStar(lastCenter),
    setEra(next) {
      era = next ?? era
    },
    // Lumière du jour entre 0 (nuit) et 1 (plein jour), selon le temps écoulé.
    update(dt, t, center) {
      lastCenter = center
      // Le cycle commence en fin de journée pour que la première nuit arrive vite.
      state.phase = state.force ?? ((t / DAY_LENGTH) + 0.15 + state.shift) % 1
      state.day = 0.5 + 0.5 * Math.cos(state.phase * Math.PI * 2)

      snowK += ((era === 'past' ? 1 : 0) - snowK) * Math.min(1, dt * 1.5)
      snowMat.opacity = snowK * 0.9
      snow.visible = snowK > 0.01
      if (snow.visible) {
        snow.position.set(center.x, center.y - 4, center.z)
        for (let i = 0; i < SNOW; i++) {
          const s = snowSeed[i]
          let x = snowPos[i * 3] + Math.sin(t * 0.8 + s) * dt * 0.6 + dt * 0.4
          let y = snowPos[i * 3 + 1] - dt * (1.2 + (s % 1) * 0.8)
          let z = snowPos[i * 3 + 2] + Math.cos(t * 0.6 + s) * dt * 0.4
          if (y < 0) y += BOX.y
          if (x > BOX.x / 2) x -= BOX.x
          snowPos[i * 3] = x
          snowPos[i * 3 + 1] = y
          snowPos[i * 3 + 2] = z
        }
        // La neige suit le joueur : on recentre les flocons sortis de la boîte.
        snowGeo.attributes.position.needsUpdate = true
      }

      const night = 1 - state.day
      flyK += ((era !== 'future' ? Math.max(0, night * 1.6 - 0.4) : 0) - flyK) * Math.min(1, dt)
      flyMat.opacity = Math.min(1, flyK) * (0.65 + Math.sin(t * 3) * 0.2)
      flies.visible = flyK > 0.02
      if (flies.visible) {
        flies.position.set(center.x, center.y, center.z)
        const p = flyGeo.attributes.position.array
        for (let i = 0; i < FLIES; i++) {
          const s = i * 1.37
          p[i * 3] = flyBase[i * 3] + Math.sin(t * 0.4 + s) * 1.2
          p[i * 3 + 1] = flyBase[i * 3 + 1] + Math.sin(t * 0.7 + s * 2) * 0.6
          p[i * 3 + 2] = flyBase[i * 3 + 2] + Math.cos(t * 0.35 + s * 1.3) * 1.2
        }
        flyGeo.attributes.position.needsUpdate = true
      }

      // Étoiles filantes : fréquentes au Futur, plus rares ailleurs la nuit.
      nextStar -= dt
      if (nextStar <= 0) {
        if (era === 'future' || night > 0.6) spawnStar(center)
        nextStar = era === 'future' ? 0.8 + Math.random() * 2.2 : 4 + Math.random() * 6
      }
      for (let i = shooting.length - 1; i >= 0; i--) {
        const s = shooting[i]
        s.t += dt
        const head = s.start.clone().addScaledVector(s.dir, s.t * s.speed)
        const arr = s.line.geometry.attributes.position.array
        const n = arr.length / 3
        const len = Math.min(s.len, s.t * s.speed)
        for (let k = 0; k < n; k++) {
          arr[k * 3] = head.x - s.dir.x * len * (k / (n - 1))
          arr[k * 3 + 1] = head.y - s.dir.y * len * (k / (n - 1))
          arr[k * 3 + 2] = head.z - s.dir.z * len * (k / (n - 1))
        }
        s.line.geometry.attributes.position.needsUpdate = true
        s.head.position.copy(head)
        const fade = Math.min(1, s.t * 6, (s.life - s.t) * 3)
        s.line.material.opacity = Math.max(0, fade)
        s.head.material.opacity = Math.max(0, fade)
        if (s.t > s.life) {
          scene.remove(s.line)
          s.line.geometry.dispose()
          s.line.material.dispose()
          s.head.material.dispose()
          shooting.splice(i, 1)
        }
      }
      return state
    },
    label() {
      const p = state.phase
      if (p < 0.2 || p > 0.8) return { icon: '☀️', text: 'Jour' }
      if (p < 0.3) return { icon: '🌇', text: 'Crépuscule' }
      if (p < 0.7) return { icon: '🌙', text: 'Nuit' }
      return { icon: '🌅', text: 'Aube' }
    },
  }
}

let dot
function dotTexture() {
  if (dot) return dot
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 64
  const g = canvas.getContext('2d')
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32)
  grad.addColorStop(0, 'rgba(255,255,255,1)')
  grad.addColorStop(0.4, 'rgba(255,255,255,0.8)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 64, 64)
  dot = new THREE.CanvasTexture(canvas)
  return dot
}
