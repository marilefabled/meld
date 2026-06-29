import { CARD_DATA, TIER_ROMAN, makeCard, type GameCard, type CardBuild } from '../data/cards.js'
import { buildIcon, cardArt } from '../engine/icons.js'

const hex = (n: number) => '#' + n.toString(16).padStart(6, '0')

export type Reward =
  | { type: 'card';    card: GameCard }
  | { type: 'hp';      amount: number }
  | { type: 'variant'; cardId: string; tier: number; variantIdx: number }

function pickRandom<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)] }

export function showRewardScreen(encIdx: number, build: CardBuild): Promise<Reward> {
  return new Promise(resolve => {
    const cardIds = Object.keys(CARD_DATA)

    // Generate 3 distinct reward options
    const addCardId  = pickRandom(cardIds)
    const addDef     = CARD_DATA[addCardId]!
    const hpAmount   = [20, 25][encIdx] ?? 20
    const upCardId   = pickRandom(cardIds)
    const upDef      = CARD_DATA[upCardId]!
    const upTier     = Math.min(encIdx + 2, 3)
    const upVariants = upDef.variants[upTier - 1]
    const curIdx     = build[upCardId]?.[upTier - 1] ?? 0
    const altIdx     = upVariants.length > 1 ? (curIdx === 0 ? 1 : 0) : 0
    const altVariant = upVariants[altIdx]

    const options: { icon: string; art?: string; cc?: string; label: string; sub: string; reward: Reward }[] = [
      {
        icon: addDef.icon, art: cardArt(addDef.shape, addDef.color, addDef.type), cc: hex(addDef.color),
        label: `Add ${addDef.name}`,
        sub: `A T1 ${addDef.name} joins your deck`,
        reward: { type: 'card', card: makeCard(addCardId) },
      },
      {
        icon: buildIcon('hp', 0x22c55e),
        label: `Restore ${hpAmount} HP`,
        sub: `Recover before the next fight`,
        reward: { type: 'hp', amount: hpAmount },
      },
      {
        icon: upDef.icon, art: cardArt(upDef.shape, upDef.color, upDef.type), cc: hex(upDef.color),
        label: `${upDef.name} ${TIER_ROMAN[upTier]}: ${altVariant.name}`,
        sub: altVariant.desc(altVariant.value),
        reward: { type: 'variant', cardId: upCardId, tier: upTier, variantIdx: altIdx },
      },
    ]

    const overlay = document.createElement('div')
    overlay.className = 'reward-overlay'
    overlay.innerHTML = `
      <div class="rw-title">SPLINTER RETURNED</div>
      <div class="rw-sub">Take back a piece of what broke off</div>
      <div class="rw-options">
        ${options.map((o, i) => `
          <button class="rw-option${o.art ? ' rw-card' : ''}" data-i="${i}"${o.cc ? ` style="--cc:${o.cc}"` : ''}>
            ${o.art
              ? `<div class="rw-art">${o.art}<div class="rw-glyph">${o.icon}</div></div>`
              : `<div class="rw-icon">${o.icon}</div>`}
            <div class="rw-label">${o.label}</div>
            <div class="rw-desc">${o.sub}</div>
          </button>
        `).join('')}
      </div>
    `
    document.body.appendChild(overlay)
    requestAnimationFrame(() => overlay.classList.add('visible'))

    overlay.querySelectorAll<HTMLButtonElement>('.rw-option').forEach(btn => {
      btn.addEventListener('click', () => {
        const i = parseInt(btn.dataset.i!)
        overlay.classList.remove('visible')
        overlay.addEventListener('transitionend', () => overlay.remove(), { once: true })
        resolve(options[i].reward)
      })
    })
  })
}
