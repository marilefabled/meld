import type { DialogueConversation } from './engine/branchDialogue.js'

export const INTRO: DialogueConversation = {
  id: 'meld-intro',
  start: 'greet',
  nodes: [
    {
      id: 'greet',
      speaker: 'HERALD',
      text: 'Welcome, Resonant. The Arena has been watching you.',
      next: 'power',
    },
    {
      id: 'power',
      speaker: 'HERALD',
      text: 'Your gift is rare. You can MELD cards — fuse two into one, drawing power greater than either alone.',
      next: 'tiers',
    },
    {
      id: 'tiers',
      speaker: 'HERALD',
      text: 'Tier I... Tier II... Tier III. Each meld sharpens the edge. The merged card returns through your discard — find it again and meld once more.',
      next: 'trials',
    },
    {
      id: 'trials',
      speaker: 'HERALD',
      text: 'Three trials await. The Whelp is first. Do not underestimate it.',
      choices: [
        { label: 'I\'m ready. Begin.', next: undefined },
        { label: 'Tell me more about melding.', next: 'meld-detail' },
      ],
    },
    {
      id: 'meld-detail',
      speaker: 'HERALD',
      text: 'Two identical cards in hand — the MELD button appears. Use it: the merged Tier II card enters your discard. Cycle it back and meld two Tier IIs for Tier III. Near unstoppable.',
      next: undefined,
    },
  ],
}
