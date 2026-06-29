// Between-opponent story beats — branching dialogue + cutscenes that read and write
// persistent campaign variables. A "beat" is a short conversation played before an
// opponent; choices set flags / mutate vars that later beats branch on.
//
// Wiring: title.ts seeds each beat from campaign.story, plays it via playBeat(), and
// writes the result back (saveCampaign) — so a choice before the Whelp still echoes
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

type BeatSlot = { before?: StoryBeat; after?: StoryBeat }

const inc = (c: StoryCtx, key: string, by = 1) => { c.vars[key] = (c.vars[key] ?? 0) + by }

// ── Example beats (DRAFT prose — the system is the deliverable) ──────────────
// The opponents carry the talking. Each one knew him; each is trying to make him
// remember. On the first time through (ctx.cycles === 0) he never gets there. Once
// the Mirror has been beaten at least once (cycles > 0), the loop starts to stick.

const WHELP_BEFORE: DialogueConversation<StoryCtx> = {
  id: 'beat-whelp', start: 'a',
  nodes: [
    { id: 'a', speaker: 'WHELP',
      text: c => {
        if (c.rings >= 3) return 'You come back heavier every time. Rings stacked like years — trophies of selves you don\'t remember being.'
        if (c.rings >= 1) return c.cycles > 0
          ? 'You came back — ringed now. Marked by wins you can\'t recall winning.'
          : 'You came back wearing a ring that wasn\'t there before. Where did you earn it?'
        return c.cycles > 0
          ? 'You came back. You always come back — but this time there\'s something behind your eyes.'
          : 'You came back. You always come back, and you never once remember why.'
      },
      next: 'b' },
    { id: 'b', speaker: 'WHELP', text: 'Look at me. You know me. Say you know me.',
      choices: [
        { label: 'I don\'t know you.',  setFlag: 'denied_whelp', onSelect: c => inc(c, 'forgotten'), next: 'c' },
        { label: '...should I?',        setFlag: 'doubted_whelp', onSelect: c => inc(c, 'doubt'),    next: 'c' },
      ] },
    { id: 'c', speaker: 'WHELP',
      text: c => c.cycles > 0
        ? 'Closer. You almost had it. Put me down again — maybe it surfaces.'
        : 'No. You don\'t. Not yet. One day the door opens. Not today.',
      next: undefined },
  ],
}

const BRUTE_BEFORE: DialogueConversation<StoryCtx> = {
  id: 'beat-brute', start: 'a',
  nodes: [
    // Branches on what he said to the Whelp — the refusal carries forward.
    { id: 'a', speaker: 'BRUTE',
      text: (c, f) => {
        if (c.rings >= 2) return f.has('denied_whelp')
          ? 'Denied the small one — and still you turn up ringed like a champion. Trophies from fights you don\'t even mourn. Stubborn. You always were.'
          : 'Look at you. Ringed up like a victor, not a memory of the wars that earned them. Heavy, and hollow with it.'
        return f.has('denied_whelp')
          ? 'The small one told me. You denied it to its face. Stubborn — you always were.'
          : 'Still wandering in blind. Still no idea what you\'re clawing your way back toward.'
      },
      next: 'b' },
    { id: 'b', speaker: 'BRUTE',
      text: c => c.cycles > 0
        ? 'But you\'ve walked this before. The shape of you remembers even when the rest won\'t.'
        : 'Hit me hard enough and maybe it shakes something loose. It never has yet.',
      choices: [
        { label: 'There\'s nothing to remember.', setFlag: 'denied_brute', onSelect: c => inc(c, 'forgotten'), next: undefined },
        { label: 'Then knock it loose.',          setFlag: 'reached_brute', onSelect: c => inc(c, 'reaching'), next: undefined },
      ] },
  ],
}

const MIRROR_BEFORE: DialogueConversation<StoryCtx> = {
  id: 'beat-mirror', start: 'a',
  nodes: [
    { id: 'a', speaker: 'YOUR ECHO',
      text: c => c.rings >= 1
        ? 'Look at us. The same rings, turning the same way — I won them the times you did. And still you don\'t know your own face.'
        : 'You don\'t even know your own face. After every one of them tried to show you.',
      next: 'b' },
    { id: 'b', speaker: 'YOUR ECHO',
      text: c => c.cycles > 0
        ? 'But it\'s sticking now. You\'ve stood here before. Finish me and you keep a little more of it.'
        : 'You\'ll beat me. You\'ll return to the Meld. And you still won\'t understand what you returned to — not the first time.',
      choices: [
        { label: 'I am not you.',            setFlag: 'denied_self', onSelect: c => inc(c, 'denial'), next: 'c' },
        { label: 'Then tell me what I am.',  setFlag: 'asked_self',  next: 'c' },
      ] },
    { id: 'c', speaker: 'YOUR ECHO',
      text: c => c.cycles > 0
        ? 'You already know. You just won\'t say it yet. Come on. Again.'
        : 'No. You have to arrive there yourself. Come back when you can.',
      next: undefined },
  ],
}

// ── Run 0, third mark ─────────────────────────────────────────────────────────
const CORE_BEFORE: DialogueConversation<StoryCtx> = {
  id: 'beat-core', start: 'a',
  nodes: [
    { id: 'a', speaker: 'CORE',
      text: c => c.rings >= 1
        ? 'Rings. Accretion. You log every trophy and lose the one record that matters. Predictable.'
        : 'You run the loop again. Input, struggle, forget. I have counted your returns. You have not.',
      next: 'b' },
    { id: 'b', speaker: 'CORE',
      text: (c, f) => f.has('reached_brute')
        ? 'The big one says you reached for it. Reaching is not remembering — but it is a nonzero value. Unusual, for you.'
        : 'You will dismantle me and feel nothing. As designed.',
      next: undefined },
  ],
}

// ── Run 1 ─────────────────────────────────────────────────────────────────────
const WARDEN_BEFORE: DialogueConversation<StoryCtx> = {
  id: 'beat-warden', start: 'a',
  nodes: [
    { id: 'a', speaker: 'WARDEN',
      text: c => c.rings >= 2
        ? 'Back, and decorated — two rings turning, maybe more. I kept the gate the whole while you were gone. Somebody had to.'
        : 'Back already. The gate remembers your hand even when your hand forgets the gate.',
      next: 'b' },
    { id: 'b', speaker: 'WARDEN', text: 'Ask me what I keep behind it. Go on. Ask.',
      choices: [
        { label: 'What do you guard?',     setFlag: 'asked_warden',     next: undefined },
        { label: 'Nothing worth keeping.', setFlag: 'dismissed_warden', onSelect: c => inc(c, 'forgotten'), next: undefined },
      ] },
  ],
}

const RAMPART_BEFORE: DialogueConversation<StoryCtx> = {
  id: 'beat-rampart', start: 'a',
  nodes: [
    { id: 'a', speaker: 'RAMPART',
      text: c => c.rings >= 2
        ? 'You wear the wins on the outside now — rings turning, bright. Inside still hollow as a struck drum.'
        : 'Still hollow. Still throwing yourself at walls, hoping one of them gives.',
      next: 'b' },
    { id: 'b', speaker: 'RAMPART',
      text: 'I was raised to hold a line you drew. You don\'t remember drawing it. Tear me down anyway — you always do.',
      next: undefined },
  ],
}

const WELLSPRING_BEFORE: DialogueConversation<StoryCtx> = {
  id: 'beat-wellspring', start: 'a',
  nodes: [
    { id: 'a', speaker: 'WELLSPRING',
      text: c => c.rings >= 2
        ? 'So many rings, and not one of them water. You collect the shape of returning and never the source of it.'
        : 'You came back thirsty and can\'t say for what. I am where you used to drink.',
      next: 'b' },
    { id: 'b', speaker: 'WELLSPRING',
      text: c => c.cycles > 0
        ? 'It\'s rising in you. Slowly. Spill me and let it rise the faster.'
        : 'Not today. The well is deep and you are shallow this time through. Come back deeper.',
      next: undefined },
  ],
}

// ── Run 2 — the deep marks, the ones that knew you best ──────────────────────────
const SENTINEL_BEFORE: DialogueConversation<StoryCtx> = {
  id: 'beat-sentinel', start: 'a',
  nodes: [
    { id: 'a', speaker: 'SENTINEL',
      text: c => c.rings >= 3
        ? 'Three rings. Four. A whole reliquary orbiting a thing that cannot name itself. I have stood here every time you arrived wearing them.'
        : 'You reach the deep ones now. The marks that knew you best. We are harder to forget — and you will manage it anyway.',
      next: 'b' },
    { id: 'b', speaker: 'SENTINEL',
      text: (c, f) => f.has('asked_warden')
        ? 'The Warden said you asked what it guards. It guards this: the road back to yourself. I am the last gate on that road.'
        : 'I will not tell you what I keep. You have to want it first. You never have.',
      next: undefined },
  ],
}

const BASTION_BEFORE: DialogueConversation<StoryCtx> = {
  id: 'beat-bastion', start: 'a',
  nodes: [
    { id: 'a', speaker: 'BASTION',
      text: c => c.rings >= 3
        ? 'Ringed like a monument to wars no one attended but us. A heavy crown on a light head.'
        : 'Almost to the mirror now. You can feel it — the shape at the end of the road, wearing your walk.',
      next: 'b' },
    { id: 'b', speaker: 'BASTION',
      text: 'Break me and there is one wall left standing. It looks exactly like you. It always has.',
      next: undefined },
  ],
}

const MAW_BEFORE: DialogueConversation<StoryCtx> = {
  id: 'beat-maw', start: 'a',
  nodes: [
    { id: 'a', speaker: 'MAW',
      text: c => c.rings >= 3
        ? 'Come closer, ringed one. All those trophies, and still the hungriest thing in the room is the hole where your name should sit.'
        : 'You always taste the same. Empty. I could swallow you whole and learn nothing you don\'t already refuse to know.',
      next: 'b' },
    { id: 'b', speaker: 'MAW',
      text: c => c.cycles > 0
        ? 'But it has almost surfaced. One more swallow. Put me down and step into your own reflection.'
        : 'Feed me. Maybe what you give up, I hand back.',
      choices: [
        { label: 'Take it, then.',       setFlag: 'fed_maw',    onSelect: c => inc(c, 'reaching'),  next: undefined },
        { label: 'I keep what is mine.', setFlag: 'denied_maw', onSelect: c => inc(c, 'forgotten'), next: undefined },
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
        ? 'You flicker into view ringed and weighted, and I am the one called insubstantial. I remember you when you were lighter than me.'
        : 'You came back thinner than a thought. So did I. We were always the parts of each other that wouldn\'t hold.',
      next: 'b' },
    { id: 'b', speaker: 'WISP', text: 'You\'ve walked further than this before. Say you feel it. Lie if you have to.',
      choices: [
        { label: 'I feel nothing.',   setFlag: 'denied_wisp',  onSelect: c => inc(c, 'forgotten'), next: undefined },
        { label: 'I feel the edges.', setFlag: 'reached_wisp',  onSelect: c => inc(c, 'reaching'),  next: undefined },
      ] },
  ],
}

const HUSK_BEFORE: DialogueConversation<StoryCtx> = {
  id: 'beat-husk', start: 'a',
  nodes: [
    { id: 'a', speaker: 'HUSK',
      text: (c, f) => f.has('denied_wisp')
        ? 'The wisp said you felt nothing. Of course. We match — two shells knocking, neither one home.'
        : 'Hollow meets hollow. At least I know what I am: the part of you that stayed empty on purpose.',
      next: 'b' },
    { id: 'b', speaker: 'HUSK',
      text: c => c.rings >= 2
        ? 'All those rings, ringing on the outside of a shell. Crack me open and listen — same silence in us both.'
        : 'Break me. There\'s nothing in here to spill. There never was. You made sure.',
      next: undefined },
  ],
}

const BLOOM_BEFORE: DialogueConversation<StoryCtx> = {
  id: 'beat-bloom', start: 'a',
  nodes: [
    { id: 'a', speaker: 'BLOOM',
      text: c => c.rings >= 1
        ? 'You come back ringed and grim while I come back flowering. I grew from the parts of you that wanted to stay.'
        : 'Every loop I open a little wider; every loop you close. We are the same root, choosing differently.',
      next: 'b' },
    { id: 'b', speaker: 'BLOOM',
      text: (c, f) => f.has('reached_wisp')
        ? 'The wisp said you reached. Good. Cut me down and let what blooms in me settle back into you.'
        : 'Wilt me, then. I\'ll only grow back. So will you. That was always the trouble.',
      next: undefined },
  ],
}

// Run 1
const ZEALOT_BEFORE: DialogueConversation<StoryCtx> = {
  id: 'beat-zealot', start: 'a',
  nodes: [
    { id: 'a', speaker: 'ZEALOT',
      text: c => c.rings >= 2
        ? 'You wear your wins like relics and believe in none of them. I carry no shield because I believe in everything. Pity we can\'t trade.'
        : 'You came back doubting, as you do. I never doubt. That is the only difference between us — and it is the whole world.',
      next: 'b' },
    { id: 'b', speaker: 'ZEALOT', text: 'Strike me down. I\'ll go gladly. Conviction doesn\'t need to survive to be right.', next: undefined },
  ],
}

const PHALANX_BEFORE: DialogueConversation<StoryCtx> = {
  id: 'beat-phalanx', start: 'a',
  nodes: [
    { id: 'a', speaker: 'PHALANX',
      text: c => c.rings >= 2
        ? 'One ringed figure against a wall of us. You were a line in this formation once — before you broke ranks to go forgetting.'
        : 'We hold together because we remember why we stand. You stand alone because you can\'t. Come. Test the wall.',
      next: 'b' },
    { id: 'b', speaker: 'PHALANX',
      text: c => c.cycles > 0
        ? 'You\'ve cracked us before. The shape of the gap you leave is starting to look like a name.'
        : 'Push through if you can. There is only more of you on the other side.',
      next: undefined },
  ],
}

const THICKET_BEFORE: DialogueConversation<StoryCtx> = {
  id: 'beat-thicket', start: 'a',
  nodes: [
    { id: 'a', speaker: 'THICKET',
      text: c => c.rings >= 2
        ? 'Rings turning above the bramble. You tended your trophies and let the rest of yourself grow over, wild and nameless.'
        : 'Every return you neglect a little more, and I fill the space. I am everything about you left untended.',
      next: 'b' },
    { id: 'b', speaker: 'THICKET', text: 'Burn me back. Clear the path. You won\'t like how short it is to the center.', next: undefined },
  ],
}

// Run 2 — the deep alternates
const NULLITY_BEFORE: DialogueConversation<StoryCtx> = {
  id: 'beat-nullity', start: 'a',
  nodes: [
    { id: 'a', speaker: 'NULLITY',
      text: c => c.rings >= 3
        ? 'Rings, marks, trophies — and underneath, me. I am the erasing you do between every loop. I keep what you throw away. It is mostly you.'
        : 'You unmake yourself each time the door shuts. I am made of the unmade. Hello again. You won\'t remember saying it.',
      next: 'b' },
    { id: 'b', speaker: 'NULLITY',
      text: (c, f) => f.has('reached_wisp')
        ? 'You reached, early on. Reach again now, while I take this from you, and maybe the subtraction comes out positive.'
        : 'Undo me and you only undo a little less of yourself. Best offer you\'ve had in a hundred returns.',
      next: undefined },
  ],
}

const COLOSSUS_BEFORE: DialogueConversation<StoryCtx> = {
  id: 'beat-colossus', start: 'a',
  nodes: [
    { id: 'a', speaker: 'COLOSSUS',
      text: c => c.rings >= 3
        ? 'All your little rings, turning. I am the size of everything you\'ve forgotten. Set your trophies against that and see what they weigh.'
        : 'You are so small against what you don\'t remember. And still you come. I\'ll grant you that — you always come.',
      next: 'b' },
    { id: 'b', speaker: 'COLOSSUS',
      text: c => c.cycles > 0
        ? 'You\'ve toppled me before. Each time you stand on the rubble a little taller. Climb. The mirror is just past my shoulder.'
        : 'Move me if you can. There is a road behind me you carved yourself.',
      next: undefined },
  ],
}

const LEVIATHAN_BEFORE: DialogueConversation<StoryCtx> = {
  id: 'beat-leviathan', start: 'a',
  nodes: [
    { id: 'a', speaker: 'LEVIATHAN',
      text: c => c.rings >= 3
        ? 'Ringed and crowned, and still you sink the same. I am every depth you went down into and came back up forgetting.'
        : 'You drown here every loop. You surface every loop. You never once bring anything back from the bottom. I am the bottom.',
      next: 'b' },
    { id: 'b', speaker: 'LEVIATHAN',
      text: c => c.cycles > 0
        ? 'But you hold your breath longer now. Put me under. What waits past me is wearing your face.'
        : 'Go down swinging if you must. The thing after me will look like you and know you better than this water does.',
      choices: [
        { label: 'Then let me drown.',           setFlag: 'sank_leviathan', onSelect: c => inc(c, 'reaching'), next: undefined },
        { label: 'I\'ve held my breath before.', setFlag: 'held_leviathan', next: undefined },
      ] },
  ],
}

// ── Outros — the fallen opponent's parting words, played on the non-final fights
// of a run (immune + armored), just before the reward. Terse by design; the regen
// run-enders and the Mirror close on their own screens instead. ─────────────────

// Default lineup
const WHELP_AFTER: DialogueConversation<StoryCtx> = { id: 'beat-whelp-after', start: 'a',
  nodes: [{ id: 'a', speaker: 'WHELP', next: undefined,
    text: c => c.cycles > 0
      ? 'Down again — but you almost held my face that time. Almost. Next door. Go.'
      : 'Down again. You\'ll forget me before the next door. One of these times you won\'t. I\'ll wait.' }] }

const BRUTE_AFTER: DialogueConversation<StoryCtx> = { id: 'beat-brute-after', start: 'a',
  nodes: [{ id: 'a', speaker: 'BRUTE', next: undefined,
    text: (c, f) => f.has('reached_brute')
      ? 'You reached, and got a fistful of nothing. Still more than you came with. Move.'
      : 'Knocked loose — nothing. Figures. The next one knew you better than I did anyway.' }] }

const WARDEN_AFTER: DialogueConversation<StoryCtx> = { id: 'beat-warden-after', start: 'a',
  nodes: [{ id: 'a', speaker: 'WARDEN', next: undefined,
    text: 'The gate opens. It always opens for you, and you always walk through it empty-handed. Go on.' }] }

const RAMPART_AFTER: DialogueConversation<StoryCtx> = { id: 'beat-rampart-after', start: 'a',
  nodes: [{ id: 'a', speaker: 'RAMPART', next: undefined,
    text: 'A wall comes down and for half a breath you feel the wind behind it. Did you? ...No. Onward.' }] }

const SENTINEL_AFTER: DialogueConversation<StoryCtx> = { id: 'beat-sentinel-after', start: 'a',
  nodes: [{ id: 'a', speaker: 'SENTINEL', next: undefined,
    text: c => c.cycles > 0
      ? 'The last gate gives. The road to your own face is open — and this time you are looking at it.'
      : 'The last gate gives. What waits ahead wears your shape. Try not to flinch from it.' }] }

const BASTION_AFTER: DialogueConversation<StoryCtx> = { id: 'beat-bastion-after', start: 'a',
  nodes: [{ id: 'a', speaker: 'BASTION', next: undefined,
    text: 'One wall left, and it is you. I held as long as stone can. I am sorry it has to be a mirror.' }] }

// Alternate lineup
const WISP_AFTER: DialogueConversation<StoryCtx> = { id: 'beat-wisp-after', start: 'a',
  nodes: [{ id: 'a', speaker: 'WISP', next: undefined,
    text: 'I scatter so easily — so do you. Carry a piece of me down with you. Maybe it sticks this time.' }] }

const HUSK_AFTER: DialogueConversation<StoryCtx> = { id: 'beat-husk-after', start: 'a',
  nodes: [{ id: 'a', speaker: 'HUSK', next: undefined,
    text: 'Cracked open, and nothing rattles out. Told you. Go be hollow nearer the center.' }] }

const ZEALOT_AFTER: DialogueConversation<StoryCtx> = { id: 'beat-zealot-after', start: 'a',
  nodes: [{ id: 'a', speaker: 'ZEALOT', next: undefined,
    text: 'I die certain; you live doubting. Tell me who got the better end of it. ...You can\'t. Go.' }] }

const PHALANX_AFTER: DialogueConversation<StoryCtx> = { id: 'beat-phalanx-after', start: 'a',
  nodes: [{ id: 'a', speaker: 'PHALANX', next: undefined,
    text: 'Ranks broken. The gap I leave still has your shape in it. Fill it someday. You, maybe.' }] }

const NULLITY_AFTER: DialogueConversation<StoryCtx> = { id: 'beat-nullity-after', start: 'a',
  nodes: [{ id: 'a', speaker: 'NULLITY', next: undefined,
    text: 'You unmade the unmaker. Less of you to lose now. Spend what is left carefully past here.' }] }

const COLOSSUS_AFTER: DialogueConversation<StoryCtx> = { id: 'beat-colossus-after', start: 'a',
  nodes: [{ id: 'a', speaker: 'COLOSSUS', next: undefined,
    text: c => c.cycles > 0
      ? 'Moved, at last. Stand on the rubble — higher — yes. Now you can see who waits. You know him.'
      : 'Something my size, and you moved it. Stand tall on what is left. You can almost see who is waiting.' }] }

// Keyed by enemy name (unique across all opponents). before = intro beat; after = outro.
const BEATS: Record<string, BeatSlot> = {
  // Default lineup (cycle 0, 2, 4 …)
  Whelp:        { before: { conv: WHELP_BEFORE,      cutscene: true }, after: { conv: WHELP_AFTER } },
  Brute:        { before: { conv: BRUTE_BEFORE },                      after: { conv: BRUTE_AFTER } },
  CORE:         { before: { conv: CORE_BEFORE } },
  Warden:       { before: { conv: WARDEN_BEFORE },                     after: { conv: WARDEN_AFTER } },
  Rampart:      { before: { conv: RAMPART_BEFORE },                    after: { conv: RAMPART_AFTER } },
  Wellspring:   { before: { conv: WELLSPRING_BEFORE } },
  Sentinel:     { before: { conv: SENTINEL_BEFORE },                   after: { conv: SENTINEL_AFTER } },
  Bastion:      { before: { conv: BASTION_BEFORE },                    after: { conv: BASTION_AFTER } },
  Maw:          { before: { conv: MAW_BEFORE,        cutscene: true } },
  // Alternate lineup (cycle 1, 3, 5 …)
  Wisp:         { before: { conv: WISP_BEFORE,       cutscene: true }, after: { conv: WISP_AFTER } },
  Husk:         { before: { conv: HUSK_BEFORE },                       after: { conv: HUSK_AFTER } },
  Bloom:        { before: { conv: BLOOM_BEFORE } },
  Zealot:       { before: { conv: ZEALOT_BEFORE },                     after: { conv: ZEALOT_AFTER } },
  Phalanx:      { before: { conv: PHALANX_BEFORE },                    after: { conv: PHALANX_AFTER } },
  Thicket:      { before: { conv: THICKET_BEFORE } },
  Nullity:      { before: { conv: NULLITY_BEFORE },                    after: { conv: NULLITY_AFTER } },
  Colossus:     { before: { conv: COLOSSUS_BEFORE },                   after: { conv: COLOSSUS_AFTER } },
  Leviathan:    { before: { conv: LEVIATHAN_BEFORE, cutscene: true } },
  // The 10th — the Mirror (both lineups)
  'YOUR ECHO':  { before: { conv: MIRROR_BEFORE,     cutscene: true } },
}

export function getBeat(enemyName: string, when: 'before' | 'after'): StoryBeat | undefined {
  return BEATS[enemyName]?.[when]
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
        ? 'So I lose to myself. Of course. The shape gives out — and you, of all things, know exactly what I am beneath it.'
        : (c.cycles > 0
            ? `Down again, ${c.foe}. You always could put me down. It changes nothing about what comes next.`
            : `So that is it, ${c.foe}. The form gives out. I thought it would hold longer than this.`),
      next: 'b' },
    { id: 'b', speaker: '',
      text: c => {
        const tail = c.rings >= 2 ? ' Rings and all — it comes to the same return.' : ''
        return c.cycles > 0
          ? `But this is not the end of it. It never is. I come back. And if not this shape, then something near enough to me you will not tell us apart — and it will walk the same road to your door.${tail}`
          : `It does not end here. I cannot say how I know that. I come back — or something like me does, wearing my hunger, and it finds the same way to you.${tail}`
      },
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
      typewriterSpeed: 42,
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
