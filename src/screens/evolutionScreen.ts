import { getEvolutionOptions, type CampaignState, type EvolutionKind, TOTAL_RUNS } from '../data/campaign.js'
import { CLASS_CONFIGS } from '../data/classes.js'

export function showEvolutionScreen(state: CampaignState): Promise<EvolutionKind> {
  return new Promise(resolve => {
    const options = getEvolutionOptions(state)
    const runsLeft = TOTAL_RUNS - state.runNumber
    const formName = CLASS_CONFIGS[state.baseClass].displayName.toUpperCase()
    const carriedForms = state.classesIn.filter(cls => cls !== state.baseClass).map(cls => CLASS_CONFIGS[cls].displayName)
    const heldForms = carriedForms.length ? carriedForms.join(' / ') : 'PURE FLAVOR'

    const overlay = document.createElement('div')
    overlay.className = 'evolution-overlay'
    overlay.innerHTML = `
      <div class="evo-eyebrow">BAG ${state.runNumber} OPENED · ${runsLeft} RUN${runsLeft !== 1 ? 'S' : ''} REMAIN</div>
      <div class="evo-title">CHOOSE WHAT STAYS</div>
      <div class="evo-body">Three Candy seals broken. Press this fruit deeper or mix in another.</div>
      <div class="evo-state">
        <span>BASE ${formName}</span>
        <span>${heldForms}</span>
        <span>POWER ${state.powerLevel.toFixed(2)}</span>
      </div>
      <div class="evo-options">
        ${options.map((opt, i) => `
          <button class="evo-option" data-i="${i}">
            <div class="evo-icon">${opt.icon}</div>
            <div class="evo-label">${opt.label}</div>
            <div class="evo-desc">${opt.desc}</div>
            <div class="evo-flavor">${opt.flavor}</div>
          </button>
        `).join('')}
      </div>
    `
    document.body.appendChild(overlay)
    requestAnimationFrame(() => overlay.classList.add('visible'))

    overlay.querySelectorAll<HTMLButtonElement>('.evo-option').forEach(btn => {
      btn.addEventListener('click', () => {
        const i = parseInt(btn.dataset.i!)
        overlay.classList.remove('visible')
        overlay.addEventListener('transitionend', () => overlay.remove(), { once: true })
        resolve(options[i].kind)
      })
    })
  })
}
