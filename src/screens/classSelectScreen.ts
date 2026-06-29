import { CLASS_CONFIGS, type PlayerClass } from '../data/classes.js'
import { buildIcon } from '../engine/icons.js'

const META: Record<PlayerClass, { icon: string; role: string; flavor: string }> = {
  warrior: { icon: buildIcon('strike',   0xef4444), role: 'STRIKER',  flavor: 'Direct. Controlled. You find what you\'re hunting and bring it back clean.' },
  mage:    { icon: buildIcon('fireball', 0xf97316), role: 'CASTER',   flavor: 'Volatile. Brilliant. Some marks don\'t come quietly. This form doesn\'t ask them to.' },
  rogue:   { icon: buildIcon('slash',    0xa855f7), role: 'BLEEDER',  flavor: 'Patient. Persistent. Some marks take time. This form was built for the long hunt.' },
}

export function showClassSelect(): Promise<PlayerClass> {
  return new Promise(resolve => {
    const classes = Object.keys(CLASS_CONFIGS) as PlayerClass[]

    const overlay = document.createElement('div')
    overlay.className = 'class-select-overlay'
    overlay.innerHTML = `
      <div class="cs-eyebrow">YOU HAVE BEEN UNMERGED</div>
      <div class="cs-title">CHOOSE YOUR FORM</div>
      <div class="cs-body">You've been brought back with a purpose. The form is your tool — not your identity.</div>
      <div class="cs-options">
        ${classes.map(cls => {
          const meta = META[cls]
          const cfg  = CLASS_CONFIGS[cls]
          return `
            <button class="cs-option" data-cls="${cls}">
              <div class="cs-icon">${meta.icon}</div>
              <div class="cs-name">${cls.toUpperCase()}</div>
              <div class="cs-role">${meta.role}</div>
              <div class="cs-stat">${cfg.hp} HP · ${cfg.deck.length} cards</div>
              <div class="cs-flavor">${meta.flavor}</div>
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
