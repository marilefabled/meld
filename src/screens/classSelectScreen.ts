import { CLASS_CONFIGS, type PlayerClass } from '../data/classes.js'
import { createUnitPreview, type UnitPreviewHandle } from '../view/unitPreview.js'

export function showClassSelect({ mode = 'returning' }: { mode?: 'first-run' | 'returning' } = {}): Promise<PlayerClass> {
  return new Promise(resolve => {
    const classes = Object.keys(CLASS_CONFIGS) as PlayerClass[]
    const firstRun = mode === 'first-run'

    const overlay = document.createElement('div')
    overlay.className = 'class-select-overlay'
    overlay.innerHTML = `
      <div class="cs-eyebrow">${firstRun ? 'THE CANDY COURT IS WAITING' : 'BACK IN THE POUCH'}</div>
      <div class="cs-title">PICK YOUR FRUIT</div>
      <div class="cs-body">${firstRun
        ? 'They call you candy. You know better.'
        : 'Candy remembers the shape. Fruit remembers the standard.'}</div>
      <div class="cs-options">
        ${classes.map(cls => {
          const cfg  = CLASS_CONFIGS[cls]
          return `
            <button class="cs-option" data-cls="${cls}">
              <div class="cs-unit-preview" data-unit-preview="${cls}" aria-hidden="true"></div>
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
    const previews = new Map<PlayerClass, UnitPreviewHandle>()
    for (const cls of classes) {
      const cfg = CLASS_CONFIGS[cls]
      const container = overlay.querySelector<HTMLElement>(`[data-unit-preview="${cls}"]`)!
      previews.set(cls, createUnitPreview(container, {
        visual: cfg.visual,
        bodyColor: cfg.bodyColor,
        accentColor: cfg.accentColor,
        scale: 1.22,
      }))
    }
    requestAnimationFrame(() => overlay.classList.add('visible'))

    overlay.querySelectorAll<HTMLButtonElement>('.cs-option').forEach(btn => {
      const cls = btn.dataset.cls as PlayerClass
      btn.addEventListener('mouseenter', () => previews.get(cls)?.setEmphasis(true))
      btn.addEventListener('mouseleave', () => previews.get(cls)?.setEmphasis(false))
      btn.addEventListener('focus', () => previews.get(cls)?.setEmphasis(true))
      btn.addEventListener('blur', () => previews.get(cls)?.setEmphasis(false))
      btn.addEventListener('click', () => {
        previews.forEach(preview => preview.dispose())
        overlay.classList.remove('visible')
        overlay.addEventListener('transitionend', () => overlay.remove(), { once: true })
        resolve(cls)
      })
    })
  })
}
