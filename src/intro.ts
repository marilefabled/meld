import type { DialogueConversation } from './engine/branchDialogue.js'

export type IntroCtx = { class: 'warrior' | 'mage' | 'rogue' }

export const INTRO: DialogueConversation<IntroCtx> = {
  id: 'meld-intro',
  start: 'greet',
  nodes: [
    {
      id: 'greet',
      speaker: 'HERALD',
      text: 'Welcome, Resonant. The Arena has been watching you.',
      next: 'origin',
    },
    {
      id: 'origin',
      speaker: 'HERALD',
      text: 'Before the trials begin — where does your power come from?',
      choices: [
        { label: 'Lifetimes of training. My body is a weapon.', setFlag: 'bg-warrior', next: 'response' },
        { label: 'Desperation. Magic saved me when nothing else would.', setFlag: 'bg-mage', next: 'response' },
        { label: 'Self-taught, in shadows, from stolen tomes.', setFlag: 'bg-rogue', next: 'response' },
      ],
    },
    {
      id: 'response',
      speaker: 'HERALD',
      text: (_, f) => f.has('bg-warrior')
        ? 'Discipline forged in repetition. The Arena will test whether that holds under real pressure.'
        : f.has('bg-mage')
        ? 'Necessity sharpens the gift. Your fire burns bright — but will it last three trials?'
        : 'Knowledge stolen in darkness often cuts the deepest. Prove it.',
      next: 'meld-explain',
    },
    {
      id: 'meld-explain',
      speaker: 'HERALD',
      text: 'Your gift is MELDING. Two identical cards in hand — MELD them into a Tier II. Two Tier IIs into a Tier III. The merged card cycles through your discard. Find it again.',
      choices: [
        { label: 'Understood. Show me the paths.', next: 'class-pick' },
        { label: 'What does melding cost?', next: 'meld-cost' },
      ],
    },
    {
      id: 'meld-cost',
      speaker: 'HERALD',
      text: 'AP equal to both cards combined — capped at your full 3 AP. You spend a tempo to climb. Worth it: a Tier III card is nearly unstoppable.',
      next: 'class-pick',
    },
    {
      id: 'class-pick',
      speaker: 'HERALD',
      text: 'Three paths of power. Choose the one that matches your nature.',
      choices: [
        { label: '⚔  WARRIOR  — 70 HP · Strike focus · outlast anything', next: 'take-warrior' },
        { label: '🔥  MAGE     — 50 HP · Fireball focus · highest ceiling', next: 'take-mage' },
        { label: '🗡  ROGUE    — 60 HP · Slash & bleed · status mastery', next: 'take-rogue' },
      ],
    },
    {
      id: 'take-warrior',
      speaker: 'HERALD',
      text: (_, f) => f.has('bg-mage')
        ? 'The fighter\'s resolve, chosen by one who ran. Let that hunger be your armor.'
        : f.has('bg-rogue')
        ? 'Shadow to iron. The discipline will serve you in the deep trials.'
        : 'Iron and endurance. The Arena chose wisely.',
      onEnter: (ctx) => { ctx.class = 'warrior' },
      next: undefined,
    },
    {
      id: 'take-mage',
      speaker: 'HERALD',
      text: (_, f) => f.has('bg-warrior')
        ? 'The trained body chooses fire. Rare combination. Don\'t waste it.'
        : f.has('bg-rogue')
        ? 'Stolen knowledge of flame. You already know how to burn without being seen.'
        : 'Fire and fury. Don\'t let them close the distance.',
      onEnter: (ctx) => { ctx.class = 'mage' },
      next: undefined,
    },
    {
      id: 'take-rogue',
      speaker: 'HERALD',
      text: (_, f) => f.has('bg-warrior')
        ? 'The trained body learning subtlety. A dangerous combination. Make them bleed slowly.'
        : f.has('bg-mage')
        ? 'Desperation taught you to hide. Now let it teach you when to strike.'
        : 'Of course. Patient. Precise. Accumulated cuts.',
      onEnter: (ctx) => { ctx.class = 'rogue' },
      next: undefined,
    },
  ],
}
