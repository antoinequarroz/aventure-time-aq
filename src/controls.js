import * as THREE from 'three'

// Commandes en plus du clavier : clic (ou tap) sur le sol pour y aller, joystick et boutons
// à l'écran sur téléphone. Rend aussi le focus clavier à la page à chaque clic, utile quand
// le jeu tourne dans une iframe (aperçu, artifact…).

export function createControls({ canvas, camera, scene, player, onInteract, isActive }) {
  const ui = document.getElementById('ui')
  canvas.tabIndex = 0
  canvas.style.outline = 'none'
  const focus = () => {
    window.focus()
    canvas.focus({ preventScroll: true })
  }

  // Marqueur de destination.
  const marker = new THREE.Mesh(
    new THREE.RingGeometry(0.35, 0.55, 24).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }),
  )
  marker.renderOrder = 10
  scene.add(marker)

  const ray = new THREE.Raycaster()
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
  const hit = new THREE.Vector3()
  const ndc = new THREE.Vector2()
  let down = null

  canvas.addEventListener('pointerdown', (e) => {
    focus()
    if (e.pointerType === 'touch') ui.classList.add('touch')
    down = { x: e.clientX, y: e.clientY, t: performance.now() }
  })
  canvas.addEventListener('pointerup', (e) => {
    if (!down || !isActive()) return
    // Un vrai clic (pas un glissé) : on part vers ce point.
    if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 12) return
    const rect = canvas.getBoundingClientRect()
    ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1)
    ray.setFromCamera(ndc, camera)
    plane.constant = -player.position.y
    if (!ray.ray.intersectPlane(plane, hit)) return
    player.setTarget(hit.x, hit.z)
    marker.position.set(hit.x, player.position.y + 0.08, hit.z)
    marker.material.opacity = 0.9
    marker.scale.setScalar(1.4)
    down = null
  })

  // Joystick virtuel (affiché après le premier toucher, ou d'emblée sur écran tactile).
  if (matchMedia('(pointer: coarse)').matches) ui.classList.add('touch')
  const pad = document.createElement('div')
  pad.className = 'stick'
  pad.innerHTML = '<div class="stick-knob"></div>'
  const knob = pad.firstChild
  ui.appendChild(pad)
  let stickId = null
  let origin = null
  const R = 50
  pad.addEventListener('pointerdown', (e) => {
    e.preventDefault()
    focus()
    stickId = e.pointerId
    pad.setPointerCapture(e.pointerId)
    const rect = pad.getBoundingClientRect()
    origin = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
    move(e)
  })
  const move = (e) => {
    if (e.pointerId !== stickId) return
    let dx = e.clientX - origin.x
    let dy = e.clientY - origin.y
    const d = Math.hypot(dx, dy)
    if (d > R) {
      dx = (dx / d) * R
      dy = (dy / d) * R
    }
    knob.style.transform = `translate(${dx}px, ${dy}px)`
    player.setStick(dx / R, dy / R)
  }
  const release = (e) => {
    if (e.pointerId !== stickId) return
    stickId = null
    knob.style.transform = ''
    player.setStick(0, 0)
  }
  pad.addEventListener('pointermove', move)
  pad.addEventListener('pointerup', release)
  pad.addEventListener('pointercancel', release)

  const button = (label, cls, action) => {
    const b = document.createElement('button')
    b.className = `touch-btn ${cls}`
    b.textContent = label
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault()
      focus()
      action()
    })
    ui.appendChild(b)
    return b
  }
  button('⤒', 'jump', () => player.jump())
  button('E', 'act', () => onInteract())

  // Le texte « E · Lire… » est aussi cliquable.
  const prompt = document.getElementById('prompt')
  prompt?.addEventListener('pointerdown', (e) => {
    e.preventDefault()
    focus()
    onInteract()
  })

  return {
    focus,
    update(dt) {
      if (marker.material.opacity > 0) {
        marker.material.opacity = Math.max(0, marker.material.opacity - dt * 1.2)
        marker.scale.multiplyScalar(1 - dt * 0.8)
      }
    },
  }
}
