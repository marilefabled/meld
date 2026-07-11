// Between-opponent story beats — branching dialogue + cutscenes that read and write
// persistent campaign variables. A "beat" is a short conversation played before an
// opponent; choices set flags / mutate vars that later beats branch on.
//
// Wiring: title.ts seeds each beat from campaign.story, plays it via playBeat(), and
// writes the result back (saveCampaign) — so a choice before the first mark still echoes
// before the Mirror, across reloads. battle.ts just awaits the hook; it owns no story.

import { createDialogueRunner, type DialogueConversation, type DialogueSnapshot } from './engine/branchDialogue.js'
import { createDialogueBox } from './engine/dialogueBox.js'
import type { PlayerClass } from './data/classes.js'

// Context handed to every node — read campaign facts, mutate vars in onSelect/onEnter.
export interface StoryCtx {
  vars:      Record<string, number>
  runNumber: number
  baseClass: PlayerClass
  cycles:    number   // full games completed before this one. 0 = first time through —
                      // he does NOT remember. >0 = the loop is starting to stick.
  rings:     number   // how decorated the form is — campaign rings + earned trophies.
                      // 0 = formless newcomer; higher = a self that's accreted weight.
  foe:       string   // name of the opponent in the current encounter (for the defeat
                      // ceremony, where the fallen form addresses the one who beat it).
}

export interface StoryBeat {
  conv:      DialogueConversation<StoryCtx>
  cutscene?: boolean   // true → letterboxed, centered, cinematic framing
}

const inc = (c: StoryCtx, key: string, by = 1) => { c.vars[key] = (c.vars[key] ?? 0) + by }

// ── First-slice beats ────────────────────────────────────────────────────────
// Every opponent is something the player cut away. Most get one line: identity,
// threat, and mechanical pressure in the same breath. Choices remain only where
// their flags echo later.

const WHELP_BEFORE: DialogueConversation<StoryCtx> = {
  id: 'beat-first-scar', start: 'a',
  nodes: [
    { id: 'a', speaker: 'FIRST SCAR',
      text: c => {
        if (c.rings >= 3) return 'All those rings. Still the first cut opens.'
        if (c.cycles > 0) return 'Back. Your hand arrived first.'
        return 'You cut me out first. Do it again.'
      },
      choices: [
        { label: 'Stay cut.',        setFlag: 'denied_whelp',  onSelect: c => inc(c, 'forgotten'), next: undefined },
        { label: 'Come back wrong.', setFlag: 'doubted_whelp', onSelect: c => inc(c, 'doubt'),     next: undefined },
      ] },
  ],
}

const BRUTE_BEFORE: DialogueConversation<StoryCtx> = {
  id: 'beat-brute', start: 'a',
  nodes: [
    { id: 'a', speaker: 'IRON KNUCKLE',
      text: (c, f) => {
        if (f.has('denied_whelp')) return 'You kept the scar out. Try that with a fist.'
        if (c.rings >= 2) return 'Rings outside. Soft underneath.'
        if (c.cycles > 0) return 'Your wrist remembers the weak plate.'
        return 'You threw away strength. It learned armor.'
      },
      choices: [
        { label: 'Find the seam.',   setFlag: 'reached_brute', onSelect: c => inc(c, 'reaching'),  next: undefined },
        { label: 'Break the plate.', setFlag: 'denied_brute',  onSelect: c => inc(c, 'forgotten'), next: undefined },
      ] },
  ],
}

const MIRROR_BEFORE: DialogueConversation<StoryCtx> = {
  id: 'beat-mirror', start: 'a',
  nodes: [
    { id: 'a', speaker: 'YOUR ECHO',
      text: c => c.cycles > 0
        ? 'You know this face now. That makes it worse.'
        : 'I wore every mark you returned. You wore me.',
      choices: [
        { label: 'I am not you.',      setFlag: 'denied_self', onSelect: c => inc(c, 'denial'), next: 'c' },
        { label: 'Then come back in.', setFlag: 'asked_self',  next: 'c' },
      ] },
    { id: 'c', speaker: 'YOUR ECHO',
      text: c => c.cycles > 0
        ? 'Again, then. Hold more this time.'
        : 'Win. The Meld will erase the difference.',
      next: undefined },
  ],
}

// ── Run 0, third mark ─────────────────────────────────────────────────────────
const COUNTING_HEART_BEFORE: DialogueConversation<StoryCtx> = {
  id: 'beat-counting-heart', start: 'a',
  nodes: [
    { id: 'a', speaker: 'COUNTING HEART',
      text: (c, f) => {
        if (f.has('reached_brute')) return 'Good seam. Now outrun the pulse.'
        if (c.rings >= 1) return 'More rings. Same missing number.'
        return 'I count every return. You call each one first.'
      },
      next: undefined },
  ],
}

// ── Run 1 ─────────────────────────────────────────────────────────────────────
const WARDEN_BEFORE: DialogueConversation<StoryCtx> = {
  id: 'beat-warden', start: 'a',
  nodes: [
    { id: 'a', speaker: 'WARDEN',
      text: c => c.rings >= 2
        ? 'The lock knows you under the rings.'
        : 'You built me. You hid the key in your hand.',
      choices: [
        { label: 'What did I seal?', setFlag: 'asked_warden',     next: undefined },
        { label: 'Open.',            setFlag: 'dismissed_warden', onSelect: c => inc(c, 'forgotten'), next: undefined },
      ] },
  ],
}

const RAMPART_BEFORE: DialogueConversation<StoryCtx> = {
  id: 'beat-rampart', start: 'a',
  nodes: [
    { id: 'a', speaker: 'RAMPART',
      text: c => c.rings >= 2
        ? 'Trophies knock. The wall stays shut.'
        : 'I am the line you drew and fled.',
      next: undefined },
  ],
}

const WELLSPRING_BEFORE: DialogueConversation<StoryCtx> = {
  id: 'beat-wellspring', start: 'a',
  nodes: [
    { id: 'a', speaker: 'WELLSPRING',
      text: c => c.cycles > 0
        ? 'You remember the thirst. I remember the flood.'
        : 'You called it thirst. It was hunger.',
      next: undefined },
  ],
}

// ── Run 2 — the deep marks, the ones that knew you best ──────────────────────────
const SENTINEL_BEFORE: DialogueConversation<StoryCtx> = {
  id: 'beat-sentinel', start: 'a',
  nodes: [
    { id: 'a', speaker: 'SENTINEL',
      text: (_c, f) => f.has('asked_warden')
        ? 'You asked what was sealed. Stand still.'
        : 'Last gate. First name behind it.',
      next: undefined },
  ],
}

const BASTION_BEFORE: DialogueConversation<StoryCtx> = {
  id: 'beat-bastion', start: 'a',
  nodes: [
    { id: 'a', speaker: 'BASTION',
      text: c => c.rings >= 3
        ? 'A monument cannot remember the war.'
        : 'Past me: your posture without your mercy.',
      next: undefined },
  ],
}

const MAW_BEFORE: DialogueConversation<StoryCtx> = {
  id: 'beat-maw', start: 'a',
  nodes: [
    { id: 'a', speaker: 'MAW',
      text: c => c.cycles > 0
        ? 'I still taste the name. Open me.'
        : 'I ate what you forgot. Open me.',
      choices: [
        { label: 'Give it back.', setFlag: 'fed_maw',    onSelect: c => inc(c, 'reaching'),  next: undefined },
        { label: 'Keep choking.', setFlag: 'denied_maw', onSelect: c => inc(c, 'forgotten'), next: undefined },
      ] },
  ],
}

// ── Alternate variants — met on later cycles (cycles > 0), so the loop is already
// sticking. Same archetype slots as the defaults; they chain their own flags since
// an alt playthrough faces all alts. ───────────────────────────────────────────

// Run 0
const WISP_BEFORE: DialogueConversation<StoryCtx> = {
  id: 'beat-wisp', start: 'a',
  nodes: [
    { id: 'a', speaker: 'WISP',
      text: c => c.rings >= 1
        ? 'Heavy with rings. Still coming apart.'
        : 'We are what the Meld failed to hold.',
      choices: [
        { label: 'Nothing there.',   setFlag: 'denied_wisp',  onSelect: c => inc(c, 'forgotten'), next: undefined },
        { label: 'I feel the edge.', setFlag: 'reached_wisp', onSelect: c => inc(c, 'reaching'),  next: undefined },
      ] },
  ],
}

const HUSK_BEFORE: DialogueConversation<StoryCtx> = {
  id: 'beat-husk', start: 'a',
  nodes: [
    { id: 'a', speaker: 'HUSK',
      text: (c, f) => f.has('denied_wisp')
        ? 'No feeling? Knock. Hear yourself.'
        : c.rings >= 2 ? 'Rings on a sealed room. Knock.' : 'Break the shell. Keep the echo.',
      next: undefined },
  ],
}

const BLOOM_BEFORE: DialogueConversation<StoryCtx> = {
  id: 'beat-bloom', start: 'a',
  nodes: [
    { id: 'a', speaker: 'BLOOM',
      text: (c, f) => f.has('reached_wisp')
        ? 'You felt the edge. I grew over it.'
        : c.rings >= 1 ? 'You grew rings. I grew roots.' : 'You cut yourself back. I kept growing.',
      next: undefined },
  ],
}

// Run 1
const ZEALOT_BEFORE: DialogueConversation<StoryCtx> = {
  id: 'beat-zealot', start: 'a',
  nodes: [
    { id: 'a', speaker: 'ZEALOT',
      text: c => c.rings >= 2
        ? 'You wear relics. I need no proof.'
        : 'You doubt. I burn. Only one of us needs armor.',
      next: undefined },
  ],
}

const PHALANX_BEFORE: DialogueConversation<StoryCtx> = {
  id: 'beat-phalanx', start: 'a',
  nodes: [
    { id: 'a', speaker: 'PHALANX',
      text: c => c.cycles > 0
        ? 'The gap knows your shape.'
        : 'We remember the order. You remember standing alone.',
      next: undefined },
  ],
}

const THICKET_BEFORE: DialogueConversation<StoryCtx> = {
  id: 'beat-thicket', start: 'a',
  nodes: [
    { id: 'a', speaker: 'THICKET',
      text: c => c.rings >= 2
        ? 'You tended trophies. I took the garden.'
        : 'Every return leaves something untended. I flower there.',
      next: undefined },
  ],
}

// Run 2 — the deep alternates
const NULLITY_BEFORE: DialogueConversation<StoryCtx> = {
  id: 'beat-nullity', start: 'a',
  nodes: [
    { id: 'a', speaker: 'NULLITY',
      text: (_c, f) => f.has('reached_wisp')
        ? 'You reached once. I am what slipped away.'
        : 'I keep everything you erase. Mostly you.',
      next: undefined },
  ],
}

const COLOSSUS_BEFORE: DialogueConversation<StoryCtx> = {
  id: 'beat-colossus', start: 'a',
  nodes: [
    { id: 'a', speaker: 'COLOSSUS',
      text: c => c.rings >= 3
        ? 'Your rings turn. I do not.'
        : 'Move me. You put me here.',
      next: undefined },
  ],
}

const LEVIATHAN_BEFORE: DialogueConversation<StoryCtx> = {
  id: 'beat-leviathan', start: 'a',
  nodes: [
    { id: 'a', speaker: 'LEVIATHAN',
      text: c => c.cycles > 0
        ? 'You hold your breath longer. The bottom still knows you.'
        : 'You surface empty. I keep the bottom.',
      choices: [
        { label: 'Take me under.',    setFlag: 'sank_leviathan', onSelect: c => inc(c, 'reaching'), next: undefined },
        { label: 'I know this depth.', setFlag: 'held_leviathan', next: undefined },
      ] },
  ],
}
// Keyed by enemy name. There are no post-fight dialogue stops: defeat flows
// straight into the reward or evolution decision.
const BEATS: Record<string, StoryBeat> = {
  // Default lineup (cycle 0, 2, 4 …)
  'First Scar':     { conv: WHELP_BEFORE, cutscene: true },
  'Iron Knuckle':   { conv: BRUTE_BEFORE },
  'Counting Heart': { conv: COUNTING_HEART_BEFORE },
  Warden:           { conv: WARDEN_BEFORE },
  Rampart:          { conv: RAMPART_BEFORE },
  Wellspring:       { conv: WELLSPRING_BEFORE },
  Sentinel:         { conv: SENTINEL_BEFORE },
  Bastion:          { conv: BASTION_BEFORE },
  Maw:              { conv: MAW_BEFORE, cutscene: true },
  // Alternate lineup (cycle 1, 3, 5 …)
  Wisp:             { conv: WISP_BEFORE, cutscene: true },
  Husk:             { conv: HUSK_BEFORE },
  Bloom:            { conv: BLOOM_BEFORE },
  Zealot:           { conv: ZEALOT_BEFORE },
  Phalanx:          { conv: PHALANX_BEFORE },
  Thicket:          { conv: THICKET_BEFORE },
  Nullity:          { conv: NULLITY_BEFORE },
  Colossus:         { conv: COLOSSUS_BEFORE },
  Leviathan:        { conv: LEVIATHAN_BEFORE, cutscene: true },
  // The 10th — the Mirror (both lineups)
  'YOUR ECHO':      { conv: MIRROR_BEFORE, cutscene: true },
}

export function getBeat(enemyName: string): StoryBeat | undefined {
  return BEATS[enemyName]
}

// ── The death ceremony — played when the player's form is lost ──────────────────
// The fallen self addresses the opponent who beat it: this isn't over. It comes
// back — and if not this shape, then something like it, wearing the same hunger.
// Spoken with no name: the form is gone; what promises return has none.
const DEFEAT_BEAT: DialogueConversation<StoryCtx> = {
  id: 'beat-defeat', start: 'a',
  nodes: [
    { id: 'a', speaker: '',
      text: c => c.foe === 'YOUR ECHO'
        ? 'The form breaks. The echo keeps breathing.'
        : (c.cycles > 0
            ? `Down again, ${c.foe}. Not gone. Unheld.`
            : `The form breaks against ${c.foe}. Something underneath returns.`),
      next: undefined },
  ],
}

export function getDefeatBeat(): StoryBeat { return { conv: DEFEAT_BEAT, cutscene: true } }

// ── Cinematic framing — scrim (always) + letterbox bars (cutscene beats) ─────
const STYLE_ID = 'meld-story-styles'
function injectStoryStyles() {
  if (document.getElementById(STYLE_ID)) return
  const s = document.createElement('style')
  s.id = STYLE_ID
  s.textContent = `
    .story-scrim { position: fixed; inset: 0; background: rgba(2,1,8,0.55); z-index: 8800;
      opacity: 0; transition: opacity 0.3s ease; pointer-events: none; }
    .story-scrim.on { opacity: 1; }
    .story-bars { position: fixed; inset: 0; z-index: 8850; pointer-events: none; }
    .story-bar { position: absolute; left: 0; right: 0; height: 12vh; background: #000;
      transform: scaleY(0); transition: transform 0.35s cubic-bezier(.2,.7,.2,1); }
    .story-bar.top { top: 0; transform-origin: top; }
    .story-bar.bottom { bottom: 0; transform-origin: bottom; }
    .story-bars.on .story-bar { transform: scaleY(1); }
  `
  document.head.appendChild(s)
}

function cinematicFrame(cutscene: boolean): () => void {
  injectStoryStyles()
  const scrim = document.createElement('div')
  scrim.className = 'story-scrim'
  document.body.appendChild(scrim)
  let bars: HTMLDivElement | null = null
  if (cutscene) {
    bars = document.createElement('div')
    bars.className = 'story-bars'
    bars.innerHTML = '<div class="story-bar top"></div><div class="story-bar bottom"></div>'
    document.body.appendChild(bars)
  }
  requestAnimationFrame(() => { scrim.classList.add('on'); bars?.classList.add('on') })
  return () => {
    scrim.classList.remove('on')
    scrim.addEventListener('transitionend', () => scrim.remove(), { once: true })
    if (bars) {
      bars.classList.remove('on')
      setTimeout(() => bars?.remove(), 400)
    }
  }
}

/**
 * Play a beat to completion. Seeds the dialogue runner from `snap`, mutates `ctx.vars`
 * in place, and resolves with the post-beat snapshot (flags + once-choices) to persist.
 */
export function playBeat(beat: StoryBeat, ctx: StoryCtx, snap: DialogueSnapshot): Promise<DialogueSnapshot> {
  return new Promise(resolve => {
    const closeFrame = cinematicFrame(!!beat.cutscene)
    const runner = createDialogueRunner<StoryCtx>()
    runner.restore(snap)
    const box = createDialogueBox(runner, {
      typewriterSpeed: 58,
      position: beat.cutscene ? 'center' : 'bottom',
    })
    runner.on('end', () => {
      const out = runner.snapshot()
      box.dispose()
      closeFrame()
      resolve(out)
    })
    runner.start(beat.conv, ctx)
  })
}
