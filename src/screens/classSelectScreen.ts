import { CLASS_CONFIGS, type PlayerClass } from '../data/classes.js'
import { CARD_DATA } from '../data/cards.js'
import { buildIcon } from '../engine/icons.js'

const CLASS_COLORS: Record<PlayerClass, number> = {
  warrior: 0xef4444,
  mage:    0xf97316,
  rogue:   0xa855f7,
}

export function showClassSelect({ mode = 'returning' }: { mode?: 'first-run' | 'returning' } = {}): Promise<PlayerClass> {
  return new Promise(resolve => {
    const classes = Object.keys(CLASS_CONFIGS) as PlayerClass[]
    const firstRun = mode === 'first-run'

    const overlay = document.createElement('div')
    overlay.className = 'class-select-overlay'
    overlay.innerHTML = `
      <div class="cs-eyebrow">${firstRun ? 'CHOOSE WHAT RETURNS' : 'UNHELD AGAIN'}</div>
      <div class="cs-title">TAKE A FORM</div>
      <div class="cs-body">${firstRun
        ? 'One form. One method. The rest must be earned.'
        : 'The name is gone. The method remains.'}</div>
      <div class="cs-options">
        ${classes.map(cls => {
          const cfg  = CLASS_CONFIGS[cls]
          const sig  = CARD_DATA[cfg.signatureCard]
          return `
            <button class="cs-option" data-cls="${cls}">
              <div class="cs-icon">${buildIcon(sig.shape, CLASS_COLORS[cls])}</div>
              <div class="cs-name">${cfg.displayName.toUpperCase()}</div>
              <div class="cs-role">${cfg.role}</div>
              <div class="cs-stat">${cfg.hp} HP · ${cfg.deck.length} cards</div>
              <div class="cs-preview">${cfg.deckPreview}</div>
              <div class="cs-flavor">${cfg.flavor}</div>
            </button>
          `
        }).join('')}
      </div>
    `
    document.body.appendChild(overlay)
    requestAnimationFrame(() => overlay.classList.add('visible'))

    overlay.querySelectorAll<HTMLButtonElement>('.cs-option').forEach(btn => {
      btn.addEventListener('click', () => {
        const cls = btn.dataset.cls as PlayerClass
        overlay.classList.remove('visible')
        overlay.addEventListener('transitionend', () => overlay.remove(), { once: true })
        resolve(cls)
      })
    })
  })
}
