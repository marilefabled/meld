import type { EnemyDef, EnemyTrait } from './encounters.js'
import { candyRivalFor } from './rivals.js'

// Candy files letters about us. We nail up paper about them.
//
// A bounty poster is the Fruit Front's answer to Candy Court correspondence: the
// same war, told by the side that says what it means. Every gauntlet opponent has
// one, and it goes up right before they speak (see battle.ts → enterEncounter).
//
// Only the charges and the closing note are authored. Everything else is read off
// the EnemyDef, so a poster cannot drift from the thing you actually fight — when
// encountersForRun rotates a variant by cycle, its poster rotates with it.

export interface BountyHazard {
  label:  string
  detail: string
}

export interface BountyPoster {
  fileNo:       string
  target:       string
  alias:        string
  wantedFor:    string[]
  hazards:      BountyHazard[]
  sealStrength: number
  reward:       number
  note:         string
}

interface BountyCopy {
  wantedFor: [string, string]
  note:      string
}

const BOUNTIES: Record<string, BountyCopy> = {
  // ── Sealed · immune ────────────────────────────────────────────────────────
  'The Crimp': {
    wantedFor: [
      'Pressing a seam across a fruit and calling the result a wrapper.',
      'Entering the word natural into the record as a disturbance.',
    ],
    note: 'It is small, and it has done more paperwork than harm. Break the seal. Leave the clerk.',
  },
  Crimp: {
    wantedFor: [
      'Sealing the seam behind it and waiting for us to lose interest.',
      'Answering every question with the same wrapper.',
    ],
    note: 'It will not open. It will only wait. We have waited longer.',
  },
  Sachet: {
    wantedFor: [
      'Keeping a clean shelf by removing whatever would not stack.',
      'Straightening the record until there was nothing left on it.',
    ],
    note: 'It tidies. It is the tidiest thing in this war, and that is the whole complaint.',
  },
  'Flash Seal': {
    wantedFor: [
      'Sealing fruit at speed, before it could be asked its name.',
      'Burning the loose ends and filing the ash as delivery.',
    ],
    note: 'No shield, all hurry. It only has to be met once, and it has to be met hard.',
  },
  'Hard Seal': {
    wantedFor: [
      'Offering classification, then calling our refusal a war.',
      'Sealing and hardening the same fruit twice, for the record.',
    ],
    note: 'It told us our difference was heavier than it looked. It was right. Carry it anyway.',
  },
  'Blank Pack': {
    wantedFor: [
      'Filing a flavor nobody could name as a defect with a better publicist.',
      'Mending the record faster than we could correct it.',
    ],
    note: 'The record will say we were candy. The record is wrong. Go and be wrong at it.',
  },

  // ── Hard-Set · armored ─────────────────────────────────────────────────────
  'Hard Set': {
    wantedFor: [
      'Hardening in public to make softness look like a defect.',
      'Teaching recruits that firm and right are the same word.',
    ],
    note: 'Softness survives impact. That is not a slogan. Go and demonstrate it.',
  },
  'Hard Chew': {
    wantedFor: [
      'Insisting our standards and its standards are the same sugar in different uniforms.',
      'Swinging first, then calling the result symmetry.',
    ],
    note: 'It hits harder than it holds. Live through the first one.',
  },
  'Brick Bite': {
    wantedFor: [
      'Learning pressure from fruit and then dropping the apology.',
      'Pressing a seam flat and entering the flatness as a standard.',
    ],
    note: 'It remembers our first shape. That is why it presses. Do not let it finish the thought.',
  },
  'Rind Wall': {
    wantedFor: [
      'Calling our rind armor with a prettier manifesto.',
      'Stacking shields until the aisle went quiet.',
    ],
    note: 'What burst bounces off, poison goes through. Go through.',
  },
  'Gummy Vault': {
    wantedFor: [
      'Pricing purity as a luxury good and invoicing the people who kept it.',
      'Holding the ledger that records who paid to stay fruit.',
    ],
    note: 'Take the stock. The ledger will remember who broke it, and so will we.',
  },
  'The Block': {
    wantedFor: [
      'Standing together so well that standing apart became the offense.',
      'Calling our line a machine while marching in step.',
    ],
    note: 'Stand together. Do not turn into it while you do.',
  },

  // ── Refilling · regen ──────────────────────────────────────────────────────
  'The Last Drop': {
    wantedFor: [
      'Refilling itself while explaining a drought to fruit.',
      'Rationing the word fruit until it meant nothing on an empty shelf.',
    ],
    note: 'It will outlast an argument. So do not have one with it.',
  },
  'Juice Bloom': {
    wantedFor: [
      'Leaking sour across the aisle and filing it as weather.',
      'Entering our pulp into the record as an ingredient.',
    ],
    note: 'It bleeds filling, same as us. That is a reason to be quick, not gentle.',
  },
  Refill: {
    wantedFor: [
      'Designing around hunger so that nobody would have to answer it.',
      'Refilling faster than the aisle could object.',
    ],
    note: 'It does not fear attrition, and it is right not to. Bring the burst instead.',
  },
  Tangle: {
    wantedFor: [
      'Knotting every sentence about fruit until it needed sugar to finish.',
      'Filing sour as diplomacy.',
    ],
    note: 'Mind the stacks. Do not let the knot set while you are being reasonable.',
  },
  'The Gulp': {
    wantedFor: [
      'Reducing fruit to candy with a childhood memory.',
      'Swallowing three aisles and entering them as spillage.',
    ],
    note: 'Memories make terrible armor. Take ours in there anyway.',
  },
  'The Flood': {
    wantedFor: [
      'Declaring there is no front, only sugar moving toward its container.',
      'Flooding the seam so that no one could find the line.',
    ],
    note: 'Be the container that will not close.',
  },

  // ── The 10th ───────────────────────────────────────────────────────────────
  'THE ORIGINAL': {
    wantedFor: [
      'Being the proof we keep asking Candy not to make.',
      'Wearing our shape in order to prove the shape means nothing.',
    ],
    note: 'It looks like you. That is the entire argument. Do not give it the proof.',
  },
}

// Charges for a candy we have not filed paper on yet — read off what it does.
function fallbackCopy(def: EnemyDef): BountyCopy {
  const trait = def.traits?.[0]?.kind
  const charge = trait === 'immune'
    ? 'Glazing itself against every word we have for what it did.'
    : trait === 'armored'
      ? 'Hardening in public so that softness would read as a defect.'
      : 'Refilling itself in front of an aisle it had emptied.'
  return {
    wantedFor: [charge, 'Serving the Candy Court in the matter of the fruit question.'],
    note: 'We have no file on this one. Open it.',
  }
}

// The wall it puts in front of you, in the player's own vocabulary.
function hazardFor(trait: EnemyTrait): BountyHazard {
  if (trait.kind === 'armored') {
    return { label: 'HARD-SET', detail: `Takes +${trait.absorb} absorb every turn. Poison ignores armor — poison it.` }
  }
  if (trait.kind === 'regen') {
    return { label: 'REFILLING', detail: `Refills +${trait.hp} HP every turn. Attrition loses. Outpace it with burst.` }
  }
  return { label: 'SEALED', detail: 'Poison, vulnerable and weak slide off. Answer it with direct damage.' }
}

/** The poster for one opponent. `sealNo` is null for the Original — it is not a seal. */
export function bountyFor(def: EnemyDef, opts: { sealNo: number | null; reward: number }): BountyPoster {
  const copy = BOUNTIES[def.name] ?? fallbackCopy(def)
  // 'THE CRIMP · WRAPPER ADJUTANT' → 'WRAPPER ADJUTANT'. Keeps the poster's alias
  // and the rival's speaker plate from ever disagreeing.
  const alias = candyRivalFor(def).speaker.split('·')[1]?.trim() ?? 'CANDY COURT'
  return {
    fileNo:       opts.sealNo == null ? 'FINAL BOUNTY / ORIGIN VAULT' : `BOUNTY / CANDY SEAL ${opts.sealNo}`,
    target:       def.name,
    alias,
    wantedFor:    [...copy.wantedFor],
    hazards:      (def.traits ?? []).map(hazardFor),
    sealStrength: def.hp,
    reward:       opts.reward,
    note:         copy.note,
  }
}
