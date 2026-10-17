// Son et musique, entièrement générés dans le navigateur (Web Audio) : pas de fichier à charger.
// Une ambiance par époque (nappe, mélodie et bruits de nature), des pas qui changent selon le sol,
// un jingle de victoire et quelques petits sons d'interface. Le bouton muet est mémorisé.

const MUTE_KEY = 'aventure-time-aq:muted'

// Gammes et accords par époque (fréquences en Hz calculées depuis des notes MIDI).
const hz = (n) => 440 * 2 ** ((n - 69) / 12)
const ERAS = {
  // Passé : nuit médiévale, ré dorien, luth et grillons.
  past: { chords: [[50, 57, 62, 65], [48, 55, 60, 64], [46, 53, 58, 62], [48, 55, 60, 67]], scale: [62, 64, 65, 67, 69, 71, 72, 74, 76], pad: 'triangle', lead: 'triangle', tempo: 0.42, density: 0.45, cutoff: 900, nature: 'crickets' },
  // Présent : fin d'après-midi, do majeur pentatonique, oiseaux.
  present: { chords: [[48, 55, 59, 64], [45, 52, 57, 60], [41, 48, 57, 64], [43, 50, 59, 62]], scale: [67, 69, 72, 74, 76, 79, 81, 84], pad: 'sine', lead: 'sine', tempo: 0.34, density: 0.5, cutoff: 1400, nature: 'birds' },
  // Futur : synthés spatiaux, la mineur, arpèges qui scintillent.
  future: { chords: [[45, 52, 57, 60], [41, 48, 53, 60], [43, 50, 55, 62], [40, 47, 52, 59]], scale: [69, 72, 74, 76, 79, 81, 84, 88], pad: 'sawtooth', lead: 'square', tempo: 0.22, density: 0.55, cutoff: 700, nature: 'beeps' },
}

export function createAudio() {
  let ctx = null
  let master, musicBus, sfxBus, delay, noiseBuffer
  let muted = (() => {
    try {
      return localStorage.getItem(MUTE_KEY) === '1'
    } catch {
      return false
    }
  })()
  const listeners = new Set()
  let era = 'past'
  const layers = {}
  let nextNote = 0
  let nextNature = 0
  let chordIndex = 0
  let nextChord = 0
  let stepTimer = 0

  function init() {
    if (ctx) return
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return
    ctx = new AC()
    master = ctx.createGain()
    master.gain.value = muted ? 0 : 0.8
    const comp = ctx.createDynamicsCompressor()
    master.connect(comp).connect(ctx.destination)
    musicBus = ctx.createGain()
    musicBus.gain.value = 0.5
    sfxBus = ctx.createGain()
    sfxBus.gain.value = 0.9
    musicBus.connect(master)
    sfxBus.connect(master)
    // Écho doux partagé : donne de l'espace aux mélodies.
    delay = ctx.createDelay(1)
    delay.delayTime.value = 0.36
    const feedback = ctx.createGain()
    feedback.gain.value = 0.38
    const wet = ctx.createGain()
    wet.gain.value = 0.35
    const tone = ctx.createBiquadFilter()
    tone.type = 'lowpass'
    tone.frequency.value = 2400
    delay.connect(tone).connect(feedback).connect(delay)
    tone.connect(wet).connect(musicBus)
    // Bruit blanc réutilisé pour le vent, les pas et les effets.
    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
    const data = noiseBuffer.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
    for (const key of Object.keys(ERAS)) layers[key] = makeLayer(key)
    layers[era].gain.gain.value = 1
    nextNote = nextNature = nextChord = ctx.currentTime + 0.3
  }

  // Une couche d'ambiance par époque : nappe d'accords et souffle de vent, en fondu enchaîné.
  function makeLayer(key) {
    const cfg = ERAS[key]
    const gain = ctx.createGain()
    gain.gain.value = 0
    gain.connect(musicBus)
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = cfg.cutoff
    filter.Q.value = 0.7
    const padGain = ctx.createGain()
    padGain.gain.value = key === 'future' ? 0.035 : 0.07
    filter.connect(padGain).connect(gain)
    const voices = cfg.chords[0].map((note, i) => {
      const o = ctx.createOscillator()
      o.type = cfg.pad
      o.frequency.value = hz(note)
      o.detune.value = (i % 2 ? 6 : -6)
      o.connect(filter)
      o.start()
      return o
    })
    // Lente respiration du filtre.
    const lfo = ctx.createOscillator()
    lfo.frequency.value = 0.07
    const lfoGain = ctx.createGain()
    lfoGain.gain.value = cfg.cutoff * 0.35
    lfo.connect(lfoGain).connect(filter.frequency)
    lfo.start()
    // Vent : bruit filtré qui ondule.
    const wind = ctx.createBufferSource()
    wind.buffer = noiseBuffer
    wind.loop = true
    const windFilter = ctx.createBiquadFilter()
    windFilter.type = 'bandpass'
    windFilter.frequency.value = key === 'future' ? 220 : 480
    windFilter.Q.value = 0.8
    const windGain = ctx.createGain()
    windGain.gain.value = key === 'present' ? 0.012 : 0.022
    const windLfo = ctx.createOscillator()
    windLfo.frequency.value = 0.11
    const windLfoGain = ctx.createGain()
    windLfoGain.gain.value = 260
    windLfo.connect(windLfoGain).connect(windFilter.frequency)
    windLfo.start()
    wind.connect(windFilter).connect(windGain).connect(gain)
    wind.start()
    return { gain, voices, cfg }
  }

  // Note pincée (luth, harpe, synthé) envoyée dans l'écho.
  function pluck(freq, when, { type = 'triangle', vol = 0.08, decay = 0.9, bus = musicBus, echo = true } = {}) {
    const o = ctx.createOscillator()
    o.type = type
    o.frequency.value = freq
    const g = ctx.createGain()
    g.gain.setValueAtTime(0, when)
    g.gain.linearRampToValueAtTime(vol, when + 0.008)
    g.gain.exponentialRampToValueAtTime(0.0001, when + decay)
    const f = ctx.createBiquadFilter()
    f.type = 'lowpass'
    f.frequency.value = type === 'square' ? 1800 : 4000
    o.connect(f).connect(g).connect(bus)
    if (echo) g.connect(delay)
    o.start(when)
    o.stop(when + decay + 0.05)
  }

  function noise(when, { dur = 0.08, freq = 800, q = 1, vol = 0.1, type = 'bandpass', bus = sfxBus } = {}) {
    const src = ctx.createBufferSource()
    src.buffer = noiseBuffer
    src.playbackRate.value = 0.8 + Math.random() * 0.4
    const f = ctx.createBiquadFilter()
    f.type = type
    f.frequency.value = freq
    f.Q.value = q
    const g = ctx.createGain()
    g.gain.setValueAtTime(vol, when)
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur)
    src.connect(f).connect(g).connect(bus)
    src.start(when, Math.random() * 1.5)
    src.stop(when + dur + 0.02)
  }

  function chirp(when, from, to, dur, vol = 0.03, type = 'sine') {
    const o = ctx.createOscillator()
    o.type = type
    o.frequency.setValueAtTime(from, when)
    o.frequency.exponentialRampToValueAtTime(to, when + dur)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0, when)
    g.gain.linearRampToValueAtTime(vol, when + dur * 0.2)
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur)
    o.connect(g).connect(musicBus)
    o.start(when)
    o.stop(when + dur + 0.02)
  }

  // Bruits de nature propres à chaque époque.
  function nature(key, when) {
    if (key === 'past') {
      // Grillons : trilles rapides et aiguës.
      const f = 4200 + Math.random() * 600
      for (let i = 0; i < 3 + Math.floor(Math.random() * 3); i++) chirp(when + i * 0.07, f, f * 0.97, 0.05, 0.012)
      return 1.2 + Math.random() * 2.5
    }
    if (key === 'present') {
      // Oiseaux : deux ou trois glissandos.
      const base = 2200 + Math.random() * 1200
      for (let i = 0; i < 2 + Math.floor(Math.random() * 3); i++) chirp(when + i * 0.13, base * (1 + Math.random() * 0.4), base * (0.7 + Math.random() * 0.6), 0.1, 0.02)
      return 2 + Math.random() * 4
    }
    // Futur : bips de radio et sonar lointain.
    if (Math.random() < 0.5) chirp(when, 1200, 1180, 0.6, 0.012, 'sine')
    else for (let i = 0; i < 3; i++) chirp(when + i * 0.09, 1800 + i * 300, 1800 + i * 300, 0.05, 0.008, 'square')
    return 3 + Math.random() * 4
  }

  // Ordonnanceur appelé à chaque image : mélodie aléatoire mais dans la gamme, accords qui tournent.
  function schedule() {
    const now = ctx.currentTime
    const cfg = ERAS[era]
    while (nextNote < now + 0.2) {
      if (Math.random() < cfg.density) {
        const note = cfg.scale[Math.floor(Math.random() * cfg.scale.length)]
        pluck(hz(note), nextNote, { type: cfg.lead, vol: era === 'future' ? 0.025 : 0.05, decay: era === 'future' ? 0.35 : 1.1 })
      }
      nextNote += cfg.tempo * (Math.random() < 0.2 ? 2 : 1)
    }
    while (nextNature < now + 0.2) nextNature += nature(era, nextNature)
    if (nextChord < now) {
      chordIndex = (chordIndex + 1) % 4
      for (const layer of Object.values(layers)) {
        layer.cfg.chords[chordIndex].forEach((note, i) => layer.voices[i].frequency.setTargetAtTime(hz(note), now, 0.8))
      }
      nextChord = now + 8
    }
  }

  const api = {
    // À appeler sur un geste de l'utilisateur (clic sur « Commencer ») : les navigateurs l'exigent.
    start() {
      init()
      ctx?.resume()
    },
    get muted() {
      return muted
    },
    setMuted(value) {
      muted = value
      try {
        localStorage.setItem(MUTE_KEY, muted ? '1' : '0')
      } catch {
        // Navigation privée : le réglage n'est pas gardé.
      }
      if (ctx) master.gain.setTargetAtTime(muted ? 0 : 0.8, ctx.currentTime, 0.1)
      for (const cb of listeners) cb(muted)
    },
    toggle() {
      api.setMuted(!muted)
    },
    onChange(cb) {
      listeners.add(cb)
      cb(muted)
    },
    setEra(next) {
      if (!next || next === era || !ERAS[next]) return
      era = next
      if (!ctx) return
      for (const [key, layer] of Object.entries(layers)) layer.gain.gain.setTargetAtTime(key === era ? 1 : 0, ctx.currentTime, 1.2)
    },
    // Pas : appelé chaque image avec la vitesse du joueur au sol (0 si en l'air).
    update(dt, speed, surface) {
      if (!ctx || ctx.state !== 'running') return
      schedule()
      if (speed < 0.6) {
        stepTimer = Math.min(stepTimer, 0.05)
        return
      }
      stepTimer -= dt
      if (stepTimer > 0) return
      stepTimer = speed > 7.5 ? 0.27 : 0.4
      api.step(surface)
    },
    step(surface = era) {
      if (!ctx || muted) return
      const t = ctx.currentTime
      if (surface === 'future') {
        noise(t, { dur: 0.12, freq: 300, q: 2, vol: 0.18, type: 'lowpass' })
        chirp(t, 140, 90, 0.1, 0.03)
      } else if (surface === 'present') {
        noise(t, { dur: 0.05, freq: 2200, q: 1.5, vol: 0.16 })
        noise(t, { dur: 0.07, freq: 400, q: 1, vol: 0.12, type: 'lowpass' })
      } else if (surface === 'interior') {
        noise(t, { dur: 0.06, freq: 900, q: 3, vol: 0.2 })
      } else {
        // Herbe et terre : froissement doux.
        noise(t, { dur: 0.11, freq: 1400, q: 0.6, vol: 0.13 })
      }
    },
    // Jingle de victoire : arpège montant et accord final.
    jingle() {
      if (!ctx) return
      const t = ctx.currentTime + 0.02
      const notes = [72, 76, 79, 84, 79, 84, 88]
      notes.forEach((n, i) => pluck(hz(n), t + i * 0.09, { type: 'square', vol: 0.06, decay: 0.35, bus: sfxBus }))
      for (const n of [72, 76, 79, 84]) pluck(hz(n), t + notes.length * 0.09, { type: 'triangle', vol: 0.07, decay: 1.6, bus: sfxBus })
    },
    // Grande fanfare du coffre final.
    fanfare() {
      if (!ctx) return
      const t = ctx.currentTime + 0.02
      const seq = [[67, 0], [67, 0.12], [67, 0.24], [72, 0.4], [76, 0.75], [79, 0.95], [84, 1.3]]
      for (const [n, d] of seq) pluck(hz(n), t + d, { type: 'sawtooth', vol: 0.05, decay: 0.5, bus: sfxBus })
      for (const n of [60, 64, 67, 72, 76]) pluck(hz(n), t + 1.3, { type: 'triangle', vol: 0.07, decay: 2.5, bus: sfxBus })
      noise(t + 1.3, { dur: 1.2, freq: 6000, q: 0.5, vol: 0.05, type: 'highpass' })
    },
    // Petits sons d'interface.
    blip(kind = 'open') {
      if (!ctx) return
      const t = ctx.currentTime
      if (kind === 'open') {
        pluck(hz(79), t, { type: 'sine', vol: 0.07, decay: 0.25, bus: sfxBus, echo: false })
        pluck(hz(86), t + 0.06, { type: 'sine', vol: 0.06, decay: 0.3, bus: sfxBus, echo: false })
      } else if (kind === 'coin') {
        pluck(hz(88), t, { type: 'square', vol: 0.04, decay: 0.12, bus: sfxBus, echo: false })
        pluck(hz(93), t + 0.07, { type: 'square', vol: 0.04, decay: 0.25, bus: sfxBus, echo: false })
      } else if (kind === 'door') {
        noise(t, { dur: 0.35, freq: 500, q: 1, vol: 0.12, type: 'lowpass' })
      } else if (kind === 'locked') {
        pluck(hz(55), t, { type: 'square', vol: 0.05, decay: 0.15, bus: sfxBus, echo: false })
        pluck(hz(52), t + 0.12, { type: 'square', vol: 0.05, decay: 0.25, bus: sfxBus, echo: false })
      } else if (kind === 'whoosh') {
        noise(t, { dur: 0.5, freq: 1200, q: 0.7, vol: 0.12 })
      } else if (kind === 'jump') {
        chirp(t, 300, 520, 0.12, 0.03, 'triangle')
      }
    },
  }
  return api
}
