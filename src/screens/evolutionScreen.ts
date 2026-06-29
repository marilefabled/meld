import { getEvolutionOptions, type CampaignState, type EvolutionKind, TOTAL_RUNS } from '../data/campaign.js'

export function showEvolutionScreen(state: CampaignState): Promise<EvolutionKind> {
  return new Promise(resolve => {
    const options = getEvolutionOptions(state)
    const runsLeft = TOTAL_RUNS - state.runNumber

    const overlay = document.createElement('div')
    overlay.className = 'evolution-overlay'
    overlay.innerHTML = `
      <div class="evo-eyebrow">RUN ${state.runNumber} COMPLETE · ${runsLeft} RUN${runsLeft !== 1 ? 'S' : ''} REMAIN</div>
      <div class="evo-title">YOUR FORM EVOLVES</div>
      <div class="evo-body">The hunt continues. Choose how you approach what's left.</div>
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
