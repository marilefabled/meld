import { DEFAULT_BUILD } from '../data/cards.js'
import { CLASS_CONFIGS, type PlayerClass } from '../data/classes.js'
import { replaceTechniquePair } from '../data/campaign.js'
import { mulberry32, runSim, type Strategy } from './battleSim.js'
import { meldEagerStrategy, techniqueStrategy } from './strategies.js'

const TRIALS = 15_000
const WIN_BAND = 7
const TURN_BAND = 3
const CLASSES: PlayerClass[] = ['warrior', 'mage', 'rogue']
const POLICIES: { name: string; strategy: Strategy }[] = [
  { name: 'meld-eager', strategy: meldEagerStrategy },
  { name: 'technique', strategy: techniqueStrategy },
]

interface Result {
  winPct: number
  avgTurnsWin: number
  avgHpWin: number
  avgMelds: number
}

function simulate(cls: PlayerClass, strategy: Strategy, deck: string[], seedSalt: number): Result {
  let wins = 0
  let turns = 0
  let hp = 0
  let melds = 0

  for (let i = 0; i < TRIALS; i++) {
    const result = runSim(cls, 0, strategy, mulberry32(i * 131 + seedSalt), DEFAULT_BUILD, deck)
    melds += result.meldCount
    if (result.won) {
      wins++
      turns += result.turns
      hp += result.finalHp
    }
  }

  return {
    winPct: wins / TRIALS * 100,
    avgTurnsWin: wins > 0 ? turns / wins : 0,
    avgHpWin: wins > 0 ? hp / wins : 0,
    avgMelds: melds / TRIALS,
  }
}

const pct = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(1)}`
const fixed = (value: number) => value.toFixed(1)
const width = [13, 12, 11, 11, 9, 10, 10, 9]
const row = (...cells: string[]) => cells.map((cell, idx) => cell.padEnd(width[idx])).join('  ')
const header = row('form', 'policy', 'rupture win', 'tech win', 'delta', 'turn delta', 'hp delta', 'melds')
const divider = '-'.repeat(header.length)

console.log(`\nMeld In Your Hand Technique Pair Sim  |  ${TRIALS.toLocaleString()} paired trials per deck`)
console.log(divider)
console.log(header)
console.log(divider)

let outsideBand = false
for (const [classIdx, cls] of CLASSES.entries()) {
  const cfg = CLASS_CONFIGS[cls]
  const techniqueDeck = replaceTechniquePair(
    cfg.deck.map(cardId => ({ cardId, tier: 1 })),
    'overload',
    cfg.techniqueCard,
  ).map(card => card.cardId)

  for (const [policyIdx, policy] of POLICIES.entries()) {
    const salt = classIdx * 10_003 + policyIdx * 997
    const rupture = simulate(cls, policy.strategy, cfg.deck, salt)
    const technique = simulate(cls, policy.strategy, techniqueDeck, salt)
    const winDelta = technique.winPct - rupture.winPct
    const turnDelta = technique.avgTurnsWin - rupture.avgTurnsWin
    const hpDelta = technique.avgHpWin - rupture.avgHpWin

    if (policy.name === 'technique' && (Math.abs(winDelta) > WIN_BAND || Math.abs(turnDelta) > TURN_BAND)) outsideBand = true

    console.log(row(
      cfg.displayName,
      policy.name,
      `${fixed(rupture.winPct)}%`,
      `${fixed(technique.winPct)}%`,
      `${pct(winDelta)} pp`,
      pct(turnDelta),
      pct(hpDelta),
      fixed(technique.avgMelds),
    ))
  }
}

console.log(divider)
console.log(outsideBand
  ? `BALANCE BAND: REVIEW (technique policy target is +/-${WIN_BAND} win points and +/-${TURN_BAND} winning turns)`
  : `BALANCE BAND: PASS (technique policy is within +/-${WIN_BAND} win points and +/-${TURN_BAND} winning turns)`)
console.log()

if (outsideBand) process.exitCode = 1
