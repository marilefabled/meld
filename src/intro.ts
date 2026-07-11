import type { DialogueConversation } from './engine/branchDialogue.js'

export type IntroCtx = { class: 'warrior' | 'mage' | 'rogue' }

export const INTRO: DialogueConversation<IntroCtx> = {
  id: 'meld-intro',
  start: 'greet',
  nodes: [
    {
      id: 'greet',
      speaker: 'HERALD',
      text: 'Wake. The Meld kept your hands. It took the name.',
      next: 'form',
    },
    {
      id: 'form',
      speaker: 'HERALD',
      text: 'Choose a form. Pair like cards meld. Held cards survive the turn.',
      next: undefined,
    },
  ],
}
