// Manette (API Gamepad) : stick ou croix pour marcher, boutons pour agir.
// A : sauter · X ou B : interagir · Y : carte · Start : fermer · LB/RB : précédent/suivant.

const DEAD = 0.18

export function createGamepad({ player, onInteract, onMap, onClose, onPrev, onNext, onConnect }) {
  const prev = []
  let usingStick = false
  window.addEventListener('gamepadconnected', (e) => onConnect?.(e.gamepad.id))

  const pressed = (pad, i) => {
    const now = !!pad.buttons[i]?.pressed
    const was = prev[i]
    prev[i] = now
    return now && !was
  }

  return {
    update(active) {
      const pad = navigator.getGamepads?.().find((p) => p && p.connected)
      if (!pad) return
      let x = pad.axes[0] ?? 0
      let y = pad.axes[1] ?? 0
      if (pad.buttons[14]?.pressed) x = -1
      if (pad.buttons[15]?.pressed) x = 1
      if (pad.buttons[12]?.pressed) y = -1
      if (pad.buttons[13]?.pressed) y = 1
      const m = Math.hypot(x, y)
      if (active && m > DEAD) {
        player.setStick(Math.max(-1, Math.min(1, x)), Math.max(-1, Math.min(1, y)))
        usingStick = true
      } else if (usingStick) {
        player.setStick(0, 0)
        usingStick = false
      }
      if (pressed(pad, 0) && active) player.jump()
      if (pressed(pad, 2) || pressed(pad, 1)) onInteract?.()
      if (pressed(pad, 3)) onMap?.()
      if (pressed(pad, 9)) onClose?.()
      if (pressed(pad, 4)) onPrev?.()
      if (pressed(pad, 5)) onNext?.()
    },
  }
}
