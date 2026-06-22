import { createMenuSystem } from './engine/menu.js'
import { createSceneTransition } from './engine/sceneTransition.js'
import { createDialogueRunner } from './engine/branchDialogue.js'
import { createDialogueBox } from './engine/dialogueBox.js'
import { createPortraitStore } from './engine/portraitStore.js'
import { INTRO, type IntroCtx } from './intro.js'
import type { MenuDef } from './engine/menu.js'

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
      const { startBattle } = await battleModule
      trans.go(() => {
        document.body.classList.add('game-active')
        startBattle({ playerClass: ctx.class })
      })
    })

    runner.start(INTRO, ctx)
  }
}
