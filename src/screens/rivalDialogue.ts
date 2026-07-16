import { createDialogueBox } from '../engine/dialogueBox.js'
import { createDialogueRunner } from '../engine/branchDialogue.js'
import type { CandyRival } from '../data/rivals.js'

const STYLE_ID = 'rival-dialogue-styles'

function injectStyles() {
  if (document.getElementById(STYLE_ID)) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = `
    .rival-dialogue { padding: 24px; align-items: flex-end; }
    .rival-dialogue .db-box {
      max-width: 680px;
      background: linear-gradient(112deg, rgba(31,10,23,0.96), rgba(15,12,34,0.98));
      border-color: rgba(251,113,133,0.34);
      box-shadow: 0 18px 64px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.1);
    }
    .rival-dialogue .db-header { padding: 14px 18px 0; }
    .rival-dialogue .db-speaker {
      color: #fda4af;
      font: 800 10px/1.2 'Segoe UI', sans-serif;
      letter-spacing: .18em;
    }
    .rival-dialogue .db-text {
      padding: 10px 18px 14px;
      color: #fff1f2;
      font: 600 17px/1.48 'Segoe UI', sans-serif;
      letter-spacing: 0;
    }
    .rival-dialogue .db-prompt {
      color: rgba(254,205,211,0.54);
      font: 700 10px/1 'Segoe UI', sans-serif;
      letter-spacing: .14em;
    }
    @media (max-width: 640px) {
      .rival-dialogue { padding: 14px; }
      .rival-dialogue .db-text { font-size: 15px; }
    }
  `
  document.head.appendChild(style)
}

export function showRivalOpening(rival: CandyRival): Promise<void> {
  return new Promise(resolve => {
    injectStyles()
    const runner = createDialogueRunner<undefined>()
    const box = createDialogueBox(runner, {
      typewriterSpeed: 0,
      position: 'bottom',
      width: 'min(92vw, 680px)',
      className: 'rival-dialogue',
    })
    box.on('close', () => {
      box.dispose()
      resolve()
    })
    runner.start({
      id: `court-${rival.speaker}`,
      start: 'claim',
      nodes: [{ id: 'claim', speaker: rival.speaker, text: rival.opening }],
    }, undefined)
  })
}
