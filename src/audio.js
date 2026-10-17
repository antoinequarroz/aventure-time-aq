// Son et musique, générés dans le navigateur (Web Audio) : pas de fichier à charger.
// - Ambiance (toujours là si le son est actif) : vent doux et petits bruits de nature par époque.
// - Musique (désactivée par défaut, bouton 🎵) : nappe très douce et arpège calme, uniquement
//   avec les notes de l'accord en cours, pour qu'aucune note ne sonne faux.
// - Effets : pas, jingle de victoire, fanfare du coffre, petits sons d'interface.
// Les réglages (son coupé, musique) sont mémorisés.

const MUTE_KEY = 'aventure-time-aq:muted'
const MUSIC_KEY = 'aventure-time-aq:music'

const hz = (n) => 440 * 2 ** ((n - 69) / 12)
// Progressions d'accords (notes MIDI) et caractère de chaque époque.
const ERAS = {
  past: { chords: [[50, 57, 62, 65], [46, 53, 58, 62], [41, 48, 53, 57], [48, 55, 60, 64]], beat: 0.6, wave: 'triangle', tone: 1400, nature: 'crickets' },
  present: { chords: [[48, 55, 59, 64], [45, 52, 55, 60], [41, 48, 52, 57], [43, 50, 55, 59]], beat: 0.5, wave: 'sine', tone: 2200, nature: 'birds' },
  future: { chords: [[45, 52, 57, 60], [41, 48, 52, 57], [48, 55, 60, 64], [43, 50, 55, 59]], beat: 0.65, wave: 'sine', tone: 1800, nature: 'space' },
}
// Motif de l'arpège : indices dans l'accord (montée douce, puis redescente), null = silence.
const PATTERN = [0, 1, 2, 3, 2, null, 1, null]
const BAR = 8

function load(key, fallback) {
  try {
    const v = localStorage.getItem(key)
    return v === null ? fallback : v === '1'
  } catch {
    return fallback
  }
}
function save(key, value) {
  try {
    localStorage.setItem(key, value ? '1' : '0')
  } catch {
    // Navigation privée : le réglage n'est pas gardé.
  }
}

export function createAudio() {
  let ctx = null
  let master, musicBus, ambBus, sfxBus, delay, noiseBuffer
  let muted = load(MUTE_KEY, false)
  let music = load(MUSIC_KEY, false)
  const listeners = new Set()
  let era = 'past'
  const winds = {}
  let nextBeat = 0
  let beat = 0
  let nextNature = 0
  let stepTimer = 0

  function init() {
    if (ctx) return
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return
    ctx = new AC()
    master = ctx.createGain()
    master.gain.value = muted ? 0 : 0.7
    const comp = ctx.createDynamicsCompressor()
    master.connect(comp).connect(ctx.destination)
    musicBus = ctx.createGain()
    musicBus.gain.value = music ? 0.16 : 0
    ambBus = ctx.createGain()
    ambBus.gain.value = 0.5
    sfxBus = ctx.createGain()
    sfxBus.gain.value = 0.7
    // Filtre doux sur toute la musique : rien d'aigu ni d'agressif.
    const soft = ctx.createBiquadFilter()
    soft.type = 'lowpass'
    soft.frequency.value = 2600
    musicBus.connect(soft).connect(master)
    ambBus.connect(master)
    sfxBus.connect(master)
    // Écho léger qui donne de l'espace à l'arpège.
    delay = ctx.createDelay(1.5)
    delay.delayTime.value = 0.42
    const feedback = ctx.createGain()
    feedback.gain.value = 0.3
    const wet = ctx.createGain()
    wet.gain.value = 0.3
    const tone = ctx.createBiquadFilter()
    tone.type = 'lowpass'
    tone.frequency.value = 1600
    delay.connect(tone).connect(feedback).connect(delay)
    tone.connect(wet).connect(musicBus)
    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
    const data = noiseBuffer.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
    for (const key of Object.keys(ERAS)) winds[key] = makeWind(key)
    winds[era].value = 1
    nextBeat = nextNature = ctx.currentTime + 0.4
  }

  // Vent : bruit filtré qui ondule lentement, différent pour chaque époque.
  function makeWind(key) {
    const gain = ctx.createGain()
    gain.gain.value = 0
    gain.connect(ambBus)
    const src = ctx.createBufferSource()
    src.buffer = noiseBuffer
    src.loop = true
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = key === 'future' ? 260 : 420
    const level = ctx.createGain()
    level.gain.value = key === 'present' ? 0.015 : 0.025
    const lfo = ctx.createOscillator()
    lfo.frequency.value = 0.08
    const depth = ctx.createGain()
    depth.gain.value = 160
    lfo.connect(depth).connect(filter.frequency)
    lfo.start()
    src.connect(filter).connect(level).connect(gain)
    src.start()
    return gain.gain
  }

  // Note douce : attaque progressive, extinction lente.
  function note(freq, when, { type = 'sine', vol = 0.05, attack = 0.01, decay = 1.2, bus = musicBus, echo = false } = {}) {
    const o = ctx.createOscillator()
    o.type = type
    o.frequency.value = freq
    const g = ctx.createGain()
    g.gain.setValueAtTime(0, when)
    g.gain.linearRampToValueAtTime(vol, when + attack)
    g.gain.exponentialRampToValueAtTime(0.0001, when + attack + decay)
    o.connect(g).connect(bus)
    if (echo) g.connect(delay)
    o.start(when)
    o.stop(when + attack + decay + 0.05)
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

  function chirp(when, from, to, dur, vol = 0.01, bus = ambBus) {
    const o = ctx.createOscillator()
    o.type = 'sine'
    o.frequency.setValueAtTime(from, when)
    o.frequency.exponentialRampToValueAtTime(to, when + dur)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0, when)
    g.gain.linearRampToValueAtTime(vol, when + dur * 0.3)
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur)
    o.connect(g).connect(bus)
    o.start(when)
    o.stop(when + dur + 0.02)
  }

  // Petits bruits de nature, discrets et espacés.
  function nature(key, when) {
    if (key === 'past') {
      const f = 3600 + Math.random() * 400
      for (let i = 0; i < 3; i++) chirp(when + i * 0.08, f, f * 0.98, 0.05, 0.004)
      return 3 + Math.random() * 4
    }
    if (key === 'present') {
      const base = 2000 + Math.random() * 800
      for (let i = 0; i < 2 + Math.floor(Math.random() * 2); i++) chirp(when + i * 0.16, base * (1 + Math.random() * 0.25), base * (0.8 + Math.random() * 0.4), 0.12, 0.008)
      return 4 + Math.random() * 6
    }
    chirp(when, 880, 870, 1.2, 0.004)
    return 6 + Math.random() * 6
  }

  // Musique : à chaque temps, une note de l'accord ; à chaque mesure, une nappe douce.
  function scheduleMusic() {
    const cfg = ERAS[era]
    while (nextBeat < ctx.currentTime + 0.25) {
      const bar = Math.floor(beat / BAR)
      const chord = cfg.chords[bar % cfg.chords.length]
      const step = beat % BAR
      if (step === 0) {
        // Nappe : les quatre notes de l'accord, attaque lente sur toute la mesure.
        const len = cfg.beat * BAR
        for (const n of chord) note(hz(n), nextBeat, { type: 'sine', vol: 0.022, attack: len * 0.35, decay: len * 0.9 })
        note(hz(chord[0] - 12), nextBeat, { type: 'sine', vol: 0.03, attack: 0.3, decay: len })
      }
      const idx = PATTERN[step]
      if (idx !== null && !(bar % 4 === 3 && step > 4)) {
        note(hz(chord[idx] + 12), nextBeat, { type: cfg.wave, vol: 0.035, attack: 0.012, decay: 1.4, echo: true })
      }
      nextBeat += cfg.beat
      beat++
    }
  }

  function schedule() {
    if (music) scheduleMusic()
    else nextBeat = ctx.currentTime + 0.1
    while (nextNature < ctx.currentTime + 0.2) nextNature += nature(era, nextNature)
  }

  const emit = () => {
    for (const cb of listeners) cb({ muted, music })
  }

  const api = {
    // À appeler sur un geste de l'utilisateur (clic) : les navigateurs l'exigent.
    start() {
      init()
      ctx?.resume()
    },
    get muted() {
      return muted
    },
    get music() {
      return music
    },
    setMuted(value) {
      muted = value
      save(MUTE_KEY, muted)
      if (ctx) master.gain.setTargetAtTime(muted ? 0 : 0.7, ctx.currentTime, 0.1)
      emit()
    },
    toggle() {
      api.setMuted(!muted)
    },
    setMusic(value) {
      music = value
      save(MUSIC_KEY, music)
      if (music && muted) api.setMuted(false)
      if (ctx) {
        musicBus.gain.setTargetAtTime(music ? 0.16 : 0, ctx.currentTime, 0.6)
        if (music) beat = 0
      }
      emit()
    },
    toggleMusic() {
      api.start()
      api.setMusic(!music)
    },
    onChange(cb) {
      listeners.add(cb)
      cb({ muted, music })
    },
    setEra(next) {
      if (!next || next === era || !ERAS[next]) return
      era = next
      beat = 0
      if (!ctx) return
      for (const [key, gain] of Object.entries(winds)) gain.setTargetAtTime(key === era ? 1 : 0, ctx.currentTime, 1.2)
    },
    // Appelé chaque image avec la vitesse du joueur au sol (0 en l'air) : pas et ordonnancement.
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
      if (surface === 'future') noise(t, { dur: 0.12, freq: 300, q: 2, vol: 0.12, type: 'lowpass' })
      else if (surface === 'present') {
        noise(t, { dur: 0.05, freq: 1800, q: 1.5, vol: 0.08 })
        noise(t, { dur: 0.07, freq: 400, q: 1, vol: 0.08, type: 'lowpass' })
      } else if (surface === 'interior') noise(t, { dur: 0.06, freq: 900, q: 3, vol: 0.12 })
      else noise(t, { dur: 0.11, freq: 1200, q: 0.6, vol: 0.08 })
    },
    // Jingle de victoire : petit arpège montant, son de boîte à musique.
    jingle() {
      if (!ctx) return
      const t = ctx.currentTime + 0.02
      ;[72, 76, 79, 84].forEach((n, i) => note(hz(n), t + i * 0.1, { type: 'triangle', vol: 0.08, decay: 0.6, bus: sfxBus }))
      for (const n of [72, 76, 79, 84]) note(hz(n), t + 0.45, { type: 'sine', vol: 0.05, attack: 0.02, decay: 1.6, bus: sfxBus })
    },
    // Ouverture du coffre : arpège plus long et accord qui scintille.
    fanfare() {
      if (!ctx) return
      const t = ctx.currentTime + 0.02
      ;[67, 72, 76, 79, 84, 88].forEach((n, i) => note(hz(n), t + i * 0.12, { type: 'triangle', vol: 0.07, decay: 0.8, bus: sfxBus }))
      for (const n of [60, 67, 72, 76, 79]) note(hz(n), t + 0.75, { type: 'sine', vol: 0.05, attack: 0.05, decay: 2.5, bus: sfxBus })
    },
    blip(kind = 'open') {
      if (!ctx) return
      const t = ctx.currentTime
      const o = { bus: sfxBus }
      if (kind === 'open') {
        note(hz(79), t, { ...o, vol: 0.05, decay: 0.3 })
        note(hz(84), t + 0.07, { ...o, vol: 0.04, decay: 0.4 })
      } else if (kind === 'coin') {
        note(hz(88), t, { ...o, type: 'triangle', vol: 0.05, decay: 0.15 })
        note(hz(93), t + 0.07, { ...o, type: 'triangle', vol: 0.05, decay: 0.3 })
      } else if (kind === 'door') noise(t, { dur: 0.35, freq: 500, q: 1, vol: 0.08, type: 'lowpass' })
      else if (kind === 'locked') {
        note(hz(62), t, { ...o, type: 'triangle', vol: 0.05, decay: 0.2 })
        note(hz(57), t + 0.12, { ...o, type: 'triangle', vol: 0.05, decay: 0.35 })
      } else if (kind === 'whoosh') noise(t, { dur: 0.5, freq: 900, q: 0.7, vol: 0.06 })
    },
  }
  return api
}
