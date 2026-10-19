// Bulle de dialogue des PNJ : nom, portrait, texte qui s'écrit lettre par lettre.
// E (ou clic) : afficher tout le texte, puis passer à la réplique suivante ; Échap : fermer.

export function createDialogue({ sfx } = {}) {
  const box = document.createElement('div')
  box.className = 'dialog-box'
  box.setAttribute('role', 'dialog')
  box.setAttribute('aria-live', 'polite')
  box.innerHTML = `
    <div class="dialog-portrait"></div>
    <div class="dialog-body">
      <strong class="dialog-name"></strong>
      <p class="dialog-text"></p>
      <div class="dialog-foot"><span class="dialog-step"></span><button type="button" class="dialog-next">Suite ▸</button></div>
    </div>`
  document.body.append(box)
  const $ = (s) => box.querySelector(s)
  let current = null
  let index = 0
  let shown = 0
  let full = ''
  let tickT = 0

  function show(i) {
    index = i
    full = current.lines[i]
    shown = 0
    $('.dialog-text').textContent = ''
    $('.dialog-step').textContent = `${i + 1} / ${current.lines.length}`
    $('.dialog-next').textContent = i + 1 < current.lines.length ? 'Suite ▸' : 'Au revoir ✕'
  }

  const api = {
    get active() {
      return !!current
    },
    get talker() {
      return current?.talker ?? null
    },
    open(data, talker) {
      current = { ...data, talker }
      $('.dialog-portrait').textContent = data.icon ?? '💬'
      $('.dialog-name').textContent = data.name
      show(0)
      box.classList.add('visible')
      sfx?.blip?.('open')
    },
    // Passe à la suite (ou termine d'écrire la réplique en cours).
    next() {
      if (!current) return
      if (shown < full.length) {
        shown = full.length
        $('.dialog-text').textContent = full
        return
      }
      if (index + 1 < current.lines.length) {
        sfx?.blip?.('tick')
        show(index + 1)
      } else api.close()
    },
    close() {
      if (!current) return
      current = null
      box.classList.remove('visible')
      sfx?.blip?.('close')
    },
    update(dt) {
      if (!current || shown >= full.length) return
      shown = Math.min(full.length, shown + dt * 55)
      $('.dialog-text').textContent = full.slice(0, Math.floor(shown))
      tickT -= dt
      if (tickT <= 0) {
        tickT = 0.14
        sfx?.blip?.('tick')
      }
    },
  }
  box.addEventListener('click', () => api.next())
  return api
}
