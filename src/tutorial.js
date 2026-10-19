// Mini-tutoriel de trois gestes, montré à la première partie seulement.
// Chaque étape passe toute seule quand le geste est fait (ou avec « Suivant »).

const KEY = 'aventure-time-aq:tutorial'

const STEPS = {
  desktop: [
    { id: 'move', icon: '🕹️', title: 'Se déplacer', text: 'ZQSD ou les flèches pour marcher, ou clique sur le sol. Maj pour courir, Espace pour sauter.' },
    { id: 'interact', icon: '✨', title: 'Découvrir', text: 'Approche-toi d\'un point lumineux et appuie sur E pour lire la fiche.' },
    { id: 'map', icon: '🗺️', title: 'S\'orienter', text: 'Suis l\'objectif et la flèche dorée. M ouvre la carte : clique sur un point pour y aller.' },
  ],
  touch: [
    { id: 'move', icon: '🕹️', title: 'Se déplacer', text: 'Le joystick en bas à gauche pour marcher, ou touche le sol. Le bouton ⤒ pour sauter.' },
    { id: 'interact', icon: '✨', title: 'Découvrir', text: 'Approche-toi d\'un point lumineux et touche le bouton E pour lire la fiche.' },
    { id: 'map', icon: '🗺️', title: 'S\'orienter', text: 'Suis l\'objectif et la flèche dorée. Touche la mini-carte pour voir les trois îles.' },
  ],
}

export function createTutorial() {
  let done = false
  try {
    done = localStorage.getItem(KEY) === '1'
  } catch {
    done = false
  }
  const el = document.createElement('div')
  el.className = 'tuto'
  el.setAttribute('role', 'status')
  el.innerHTML = `
    <div class="tuto-icon"></div>
    <div class="tuto-body"><small></small><strong></strong><p></p></div>
    <div class="tuto-actions"><button class="btn primary" data-act="next">Suivant</button><button class="btn ghost" data-act="skip">Passer</button></div>
    <div class="tuto-dots"></div>`
  document.getElementById('ui').append(el)
  let steps = []
  let index = -1
  let wait = 0

  const finish = () => {
    el.classList.remove('visible')
    index = -1
    done = true
    try {
      localStorage.setItem(KEY, '1')
    } catch {
      // Navigation privée.
    }
  }
  const show = (i) => {
    index = i
    if (index >= steps.length) return finish()
    const s = steps[index]
    el.querySelector('.tuto-icon').textContent = s.icon
    el.querySelector('small').textContent = `Astuce ${index + 1} / ${steps.length}`
    el.querySelector('strong').textContent = s.title
    el.querySelector('p').textContent = s.text
    el.querySelector('[data-act="next"]').textContent = index === steps.length - 1 ? 'C\'est parti !' : 'Suivant'
    el.querySelector('.tuto-dots').innerHTML = steps.map((_, k) => `<i class="${k === index ? 'on' : ''}"></i>`).join('')
    el.classList.remove('visible')
    void el.offsetWidth
    el.classList.add('visible')
    wait = 0
  }
  el.addEventListener('click', (e) => {
    const act = e.target.closest('button')?.dataset.act
    if (act === 'next') show(index + 1)
    if (act === 'skip') finish()
  })

  return {
    get active() {
      return index >= 0
    },
    start(touch) {
      if (done) return
      steps = STEPS[touch ? 'touch' : 'desktop']
      show(0)
    },
    // Signale un geste fait par le joueur ('move', 'interact', 'map').
    did(id) {
      if (index < 0 || steps[index].id !== id || wait < 0.8) return
      setTimeout(() => {
        if (steps[index]?.id === id) show(index + 1)
      }, 700)
    },
    update(dt) {
      if (index >= 0) wait += dt
    },
    reset() {
      done = false
      try {
        localStorage.removeItem(KEY)
      } catch {
        // Navigation privée.
      }
    },
  }
}
