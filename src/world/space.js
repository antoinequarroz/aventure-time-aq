import * as THREE from 'three'
import { mat, mesh } from './helpers.js'

// Fond spatial : dôme dégradé avec nébuleuses, étoiles scintillantes et planètes lointaines.
export function createSpace(scene) {
  scene.background = new THREE.Color(0x070a1f)
  scene.fog = new THREE.Fog(0x120d2e, 110, 380)

  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(600, 48, 24),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: { time: { value: 0 } },
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec3 vDir;
        uniform float time;
        float hash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
        float noise(vec3 p) {
          vec3 i = floor(p); vec3 f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
                     mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
        }
        float fbm(vec3 p) { float v = 0.0; float a = 0.5; for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.1; a *= 0.5; } return v; }
        void main() {
          float h = vDir.y;
          vec3 top = vec3(0.02, 0.025, 0.09);
          vec3 horizon = vec3(0.055, 0.035, 0.13);
          vec3 bottom = vec3(0.025, 0.012, 0.06);
          vec3 col = h > 0.0 ? mix(horizon, top, pow(h, 0.6)) : mix(horizon, bottom, pow(-h, 0.5));
          // Nébuleuses violettes et bleues.
          float n = fbm(vDir * 2.5 + vec3(0.0, 0.0, time * 0.003));
          float n2 = fbm(vDir * 4.0 + 10.0);
          col += vec3(0.30, 0.10, 0.40) * smoothstep(0.6, 0.9, n) * 0.45;
          col += vec3(0.06, 0.20, 0.40) * smoothstep(0.65, 0.95, n2) * 0.4;
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    }),
  )
  scene.add(sky)

  const count = 5000
  const positions = new Float32Array(count * 3)
  const colors = new Float32Array(count * 3)
  const seeds = new Float32Array(count)
  const sizes = new Float32Array(count)
  const color = new THREE.Color()
  for (let i = 0; i < count; i++) {
    const r = 400 + Math.random() * 150
    const theta = Math.random() * Math.PI * 2
    const phi = Math.acos(2 * Math.random() - 1)
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta)
    positions[i * 3 + 1] = r * Math.cos(phi)
    positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta)
    color.setHSL(0.55 + Math.random() * 0.2, 0.7, 0.75 + Math.random() * 0.25)
    colors.set([color.r, color.g, color.b], i * 3)
    seeds[i] = Math.random() * 100
    sizes[i] = Math.random() < 0.03 ? 5 + Math.random() * 3 : 1.5 + Math.random() * 2
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geometry.setAttribute('seed', new THREE.BufferAttribute(seeds, 1))
  geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1))
  const starMaterial = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { time: { value: 0 }, pixelRatio: { value: Math.min(window.devicePixelRatio, 2) } },
    vertexShader: /* glsl */ `
      attribute float seed;
      attribute float size;
      attribute vec3 color;
      uniform float time;
      uniform float pixelRatio;
      varying vec3 vColor;
      varying float vTwinkle;
      void main() {
        vColor = color;
        vTwinkle = 0.55 + 0.45 * sin(time * (1.0 + mod(seed, 3.0)) + seed);
        gl_PointSize = size * pixelRatio;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vColor;
      varying float vTwinkle;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d);
        gl_FragColor = vec4(vColor * 1.6, a * vTwinkle);
      }
    `,
  })
  const stars = new THREE.Points(geometry, starMaterial)
  scene.add(stars)

  const planets = new THREE.Group()
  const ringed = mesh(new THREE.SphereGeometry(28, 32, 24), mat(0xd9a86c, { fog: false }), { x: 160, y: 70, z: -260, shadow: false })
  const ring = mesh(new THREE.RingGeometry(36, 52, 64), new THREE.MeshBasicMaterial({ color: 0xc7a37a, side: THREE.DoubleSide, transparent: true, opacity: 0.6, fog: false }), { shadow: false })
  ring.rotation.x = Math.PI / 2.4
  ringed.add(ring)
  const blue = mesh(new THREE.SphereGeometry(14, 24, 18), mat(0x4a7bd1, { fog: false }), { x: -190, y: 40, z: -220, shadow: false })
  const red = mesh(new THREE.SphereGeometry(8, 20, 14), mat(0xb5523b, { fog: false }), { x: -40, y: 110, z: -300, shadow: false })
  // Halo lumineux autour des planètes.
  for (const [planet, radius, tint] of [[ringed, 28, 0xffc98a], [blue, 14, 0x7fb0ff], [red, 8, 0xff8a6a]]) {
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: tint, transparent: true, opacity: 0.5, depthWrite: false, fog: false }))
    halo.scale.setScalar(radius * 3.4)
    planet.add(halo)
  }
  planets.add(ringed, blue, red)
  scene.add(planets)

  // Poussière d'étoiles qui flotte autour des îles.
  const dustCount = 600
  const dustPos = new Float32Array(dustCount * 3)
  for (let i = 0; i < dustCount; i++) {
    dustPos.set([-120 + Math.random() * 240, -30 + Math.random() * 60, -60 + Math.random() * 100], i * 3)
  }
  const dustGeo = new THREE.BufferGeometry()
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3))
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ size: 0.25, color: 0xcfc4ff, transparent: true, opacity: 0.6, depthWrite: false }))
  scene.add(dust)

  return {
    update(dt, t) {
      stars.rotation.y += dt * 0.003
      starMaterial.uniforms.time.value = t
      sky.material.uniforms.time.value = t
      ringed.rotation.y += dt * 0.05
      blue.rotation.y += dt * 0.08
      dust.position.y = Math.sin(t * 0.2) * 1.5
      dust.rotation.y += dt * 0.002
    },
  }
}

let glow
function glowTexture() {
  if (glow) return glow
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 128
  const ctx = canvas.getContext('2d')
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.35, 'rgba(255,255,255,0.35)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 128, 128)
  glow = new THREE.CanvasTexture(canvas)
  return glow
}
