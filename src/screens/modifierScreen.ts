import { MODIFIERS, type Modifier } from '../data/modifiers.js'
import { music } from '../music.js'

export function showModifierScreen(): Promise<Modifier | null> {
  return new Promise(resolve => {
    music.play('evolution')
    const offered = [...MODIFIERS].sort(() => Math.random() - 0.5).slice(0, 3)

    const overlay = document.createElement('div')
    overlay.className = 'modifier-overlay'
    overlay.innerHTML = `
      <div class="mod-title">TAKE ONE FLAVOR</div>
      <div class="mod-sub">The Front kept three</div>
      <div class="mod-options">
        ${offered.map((m, i) => `
          <button class="mod-option" data-i="${i}">
            <div class="mod-icon">${m.icon}</div>
            <div class="mod-name">${m.name}</div>
            <div class="mod-desc">${m.desc}</div>
            <div class="mod-flavor">${m.flavor}</div>
          </button>
        `).join('')}
      </div>
      <button class="mod-skip">GO UNMIXED →</button>
    `
    document.body.appendChild(overlay)
    requestAnimationFrame(() => overlay.classList.add('visible'))

    overlay.querySelectorAll<HTMLButtonElement>('.mod-option').forEach(btn => {
      btn.addEventListener('click', () => {
        const i = parseInt(btn.dataset.i!)
        close(offered[i])
      })
    })
    overlay.querySelector<HTMLButtonElement>('.mod-skip')!.addEventListener('click', () => close(null))

    function close(choice: Modifier | null) {
      overlay.classList.remove('visible')
      overlay.addEventListener('transitionend', () => overlay.remove(), { once: true })
      resolve(choice)
    }
  })
}
