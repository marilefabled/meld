import { createMenuSystem } from './engine/menu.js'
import { createSceneTransition } from './engine/sceneTransition.js'
import { createDialogueRunner } from './engine/branchDialogue.js'
import { createDialogueBox } from './engine/dialogueBox.js'
import { createPortraitStore } from './engine/portraitStore.js'
import { INTRO, type IntroCtx } from './intro.js'
import { ENCOUNTERS } from './data/encounters.js'
import type { MenuDef } from './engine/menu.js'

const ENEMY_FLAVOR = [
  { diff: '★☆☆', desc: 'Fast and ferocious. Don\'t underestimate the claws.' },
  { diff: '★★☆', desc: 'Hits hard and guards when you\'d least expect it.' },
  { diff: '★★★', desc: 'Ancient. Poisonous. Relentless. Your Tier IIIs must shine.' },
]

function showEnemySelect(): Promise<number> {
  return new Promise(resolve => {
    const overlay = document.createElement('div')
    overlay.className = 'enemy-select'
    overlay.innerHTML = `
      <div class="es-title">CHOOSE YOUR OPPONENT</div>
      <div class="es-grid">
        ${ENCOUNTERS.map((e, i) => `
          <button class="es-card" data-idx="${i}" style="--ec: #${e.bodyColor.toString(16).padStart(6, '0')}">
            <div class="es-swatch"></div>
            <div class="es-name">${e.name}</div>
            <div class="es-hp">${e.hp} HP</div>
            <div class="es-diff">${ENEMY_FLAVOR[i].diff}</div>
            <div class="es-desc">${ENEMY_FLAVOR[i].desc}</div>
          </button>
        `).join('')}
      </div>
    `
    document.body.appendChild(overlay)
    requestAnimationFrame(() => overlay.classList.add('visible'))

    overlay.querySelectorAll<HTMLButtonElement>('.es-card').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.idx!)
        overlay.classList.remove('visible')
        overlay.addEventListener('transitionend', () => overlay.remove(), { once: true })
        resolve(idx)
      })
    })
  })
}

export function showTitle() {
  // Pre-load battle module while title screen is visible
  const battleModule = import('./battle.js')

  const menus = createMenuSystem()
  const trans = createSceneTransition({ duration: 0.6 })

  const howToPlay: MenuDef = {
    title: 'HOW TO PLAY',
    className: 'meld-how-to',
    items: [
      { type: 'header', label: '— CARDS —' },
      { type: 'header', label: 'Play cards to attack, defend, or heal.' },
      { type: 'header', label: 'Cards cost 1–2 AP. You get 3 AP per turn.' },
      { type: 'header', label: 'Spare AP converts to bonus draws next turn.' },
      { type: 'separator' },
      { type: 'header', label: '— MELDING —' },
      { type: 'header', label: 'Two identical cards → MELD → Tier II (2.2×)' },
      { type: 'header', label: 'Two Tier IIs → MELD → Tier III (4.5×!)' },
      { type: 'header', label: 'Merged cards discard and cycle back to hand.' },
      { type: 'separator' },
      { type: 'header', label: '— ENCOUNTERS —' },
      { type: 'header', label: 'Defeat 3 foes: Whelp → Brute → CORE' },
      { type: 'header', label: 'Clear an encounter to restore some HP.' },
      { type: 'separator' },
      { type: 'back' },
    ],
  }

  menus.push({
    title: 'MELD',
    backdrop: 'none',
    closeable: false,
    className: 'meld-title',
    items: [
      { type: 'header', label: 'A MERGING CARD BATTLE' },
      { type: 'separator' },
      { type: 'button', label: 'NEW GAME', action: () => beginGame() },
      { type: 'button', label: 'HOW TO PLAY', action: () => menus.push(howToPlay) },
    ],
  })

  async function beginGame() {
    menus.close()

    const portraits = createPortraitStore()
    portraits.autoCanvas('HERALD', '#4338ca', 'H')

    const runner = createDialogueRunner()
    const box = createDialogueBox(runner, { position: 'bottom', portraits })

    const ctx: IntroCtx = { class: 'warrior' }

    runner.on('end', async () => {
      box.dispose()
      const idx = await showEnemySelect()
      const { startBattle } = await battleModule
      trans.go(() => {
        document.body.classList.add('game-active')
        startBattle({ playerClass: ctx.class, startFrom: idx })
      })
    })

    runner.start(INTRO, ctx)
  }
}
