import { CARD_DATA, TIER_ROMAN, type CardDef } from '../data/cards.js'
import { cardArt } from '../engine/icons.js'
import { progression } from '../data/progression.js'
import { bigCardHTML, showCardPreview, hideCardPreview } from '../view/cardPreview.js'

const hex = (n: number) => '#' + n.toString(16).padStart(6, '0')

interface ShopItem {
  variantId: string
  cardId:    string
  def:       CardDef
  tier:      number
  variantName: string
  desc:      string
  cost:      number
}

function buildItems(): ShopItem[] {
  const items: ShopItem[] = []
  for (const [cardId, def] of Object.entries(CARD_DATA)) {
    const t2alt = def.variants[1][1]
    if (t2alt) items.push({
      variantId: t2alt.id, cardId, def, tier: 2, variantName: t2alt.name,
      desc: t2alt.desc(t2alt.value), cost: 80,
    })
    const t3alt = def.variants[2][1]
    if (t3alt) items.push({
      variantId: t3alt.id, cardId, def, tier: 3, variantName: t3alt.name,
      desc: t3alt.desc(t3alt.value), cost: 150,
    })
  }
  return items
}

export function showShop(): Promise<void> {
  return new Promise(resolve => {
    const items = buildItems()
    const overlay = document.createElement('div')
    overlay.className = 'shop-overlay'

    function render() {
      const ownedCount = items.filter(it => progression.isUnlocked(it.variantId)).length
      overlay.innerHTML = `
        <div class="sh-header">
          <span class="sh-title">COLLECTION</span>
          <div class="sh-meta">
            <span class="sh-count">${ownedCount}/${items.length} unlocked</span>
            <span class="sh-frags">⬡ ${progression.state.fragments}</span>
          </div>
        </div>
        <div class="sh-grid">
          ${items.map(item => {
            const owned      = progression.isUnlocked(item.variantId)
            const canAfford  = progression.state.fragments >= item.cost
            const cc         = hex(item.def.color)
            return `
              <div class="sh-card${owned ? ' owned' : ''}${!owned && !canAfford ? ' locked' : ''}"
                   style="--cc:${cc}" data-id="${item.variantId}">
                <div class="sh-card-art">${cardArt(item.def.shape, item.def.color, item.def.type)}
                  <div class="sh-card-glyph">${item.def.icon}</div>
                  <span class="sh-card-tier">${TIER_ROMAN[item.tier]}</span>
                  ${owned ? `<span class="sh-card-seal">✓</span>` : ''}
                </div>
                <div class="sh-card-name">${item.variantName}</div>
                <div class="sh-card-sub">${item.def.name} · ${item.desc}</div>
                ${owned
                  ? `<div class="sh-badge">UNLOCKED</div>`
                  : `<button class="sh-buy" data-id="${item.variantId}" data-cost="${item.cost}"
                       ${canAfford ? '' : 'disabled'}>⬡ ${item.cost}</button>`}
              </div>
            `
          }).join('')}
        </div>
        <button class="sh-back">← BACK</button>
      `

      // Big illustrated preview on hover
      overlay.querySelectorAll<HTMLElement>('.sh-card').forEach(cardEl => {
        const item = items.find(it => it.variantId === cardEl.dataset.id)!
        cardEl.addEventListener('mouseenter', () => {
          showCardPreview(
            bigCardHTML(item.def, item.variantName, item.desc, TIER_ROMAN[item.tier]),
            cardEl.getBoundingClientRect(),
          )
        })
        cardEl.addEventListener('mouseleave', hideCardPreview)
      })

      overlay.querySelectorAll<HTMLButtonElement>('.sh-buy').forEach(btn => {
        btn.addEventListener('click', e => {
          e.stopPropagation()
          if (progression.spendFragments(parseInt(btn.dataset.cost!))) {
            progression.unlock(btn.dataset.id!)
            hideCardPreview()
            render()
          }
        })
      })
      overlay.querySelector<HTMLButtonElement>('.sh-back')!.addEventListener('click', () => {
        hideCardPreview()
        overlay.classList.remove('visible')
        overlay.addEventListener('transitionend', () => overlay.remove(), { once: true })
        resolve()
      })
    }

    render()
    document.body.appendChild(overlay)
    requestAnimationFrame(() => overlay.classList.add('visible'))
  })
}
