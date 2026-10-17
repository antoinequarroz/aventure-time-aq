// Réglages d'accessibilité, gardés d'une visite à l'autre.
// - Réduire les animations (activé d'office si le système le demande)
// - Texte plus grand
// - Sous-titres des sons

const KEY = 'aventure-time-aq:settings'

const OPTIONS = [
  { id: 'reduceMotion', icon: '🌀', title: 'Réduire les animations', text: 'Moins de mouvements à l\'écran : fondus courts, pas d\'effets de caméra.' },
  { id: 'bigText', icon: '🔠', title: 'Texte plus grand', text: 'Agrandit les fiches, les menus et les messages.' },
  { id: 'captions', icon: '💬', title: 'Sous-titres des sons', text: 'Affiche en texte les sons du jeu et l\'ambiance de chaque île.' },
]

export function createSettings() {
  let saved = {}
  try {
    saved = JSON.parse(localStorage.getItem(KEY)) || {}
  } catch {
    saved = {}
  }
  const state = {
    reduceMotion: saved.reduceMotion ?? matchMedia('(prefers-reduced-motion: reduce)').matches,
    bigText: !!saved.bigText,
    captions: !!saved.captions,
  }
  const listeners = []
  const apply = () => {
    document.documentElement.classList.toggle('reduce-motion', state.reduceMotion)
    document.documentElement.classList.toggle('big-text', state.bigText)
    for (const cb of listeners) cb(state)
  }
  apply()

  return {
    state,
    onChange(cb) {
      listeners.push(cb)
    },
    set(id, value) {
      state[id] = value
      try {
        localStorage.setItem(KEY, JSON.stringify(state))
      } catch {
        // Navigation privée.
      }
      apply()
    },
    // Contenu de la fenêtre « Réglages » : interrupteurs et aide des commandes.
    view(controlsHelp) {
      const root = document.createElement('div')
      root.className = 'settings'
      for (const o of OPTIONS) {
        const row = document.createElement('label')
        row.className = 'setting'
        const input = document.createElement('input')
        input.type = 'checkbox'
        input.role = 'switch'
        input.checked = state[o.id]
        input.addEventListener('change', () => this.set(o.id, input.checked))
        const text = document.createElement('span')
        text.innerHTML = `<b>${o.icon} ${o.title}</b><small>${o.text}</small>`
        const knob = document.createElement('i')
        row.append(text, input, knob)
        root.append(row)
      }
      const help = document.createElement('div')
      help.className = 'settings-help'
      help.innerHTML = `<h3>Commandes</h3>${controlsHelp.map(([k, v]) => `<div><kbd>${k}</kbd><span>${v}</span></div>`).join('')}`
      root.append(help)
      return root
    },
  }
}

export const CONTROLS_HELP = [
  ['ZQSD · flèches', 'Marcher (Maj pour courir)'],
  ['Clic sur le sol', 'Aller à cet endroit'],
  ['Espace', 'Sauter'],
  ['E', 'Lire, jouer, monter dans un véhicule'],
  ['M', 'Carte des trois îles'],
  ['Tab · Entrée', 'Parcourir et activer les boutons'],
  ['Échap', 'Fermer, abandonner un mini-jeu'],
  ['Manette', 'Stick : marcher · A : sauter · X ou B : interagir · Y : carte · LB/RB : projet précédent/suivant'],
  ['Téléphone', 'Joystick à gauche · boutons E et saut à droite · toucher la mini-carte'],
]
