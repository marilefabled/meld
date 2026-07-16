import { runSim, mulberry32, type Strategy } from './battleSim.js'
import { DEFAULT_BUILD } from '../data/cards.js'
import { ENCOUNTERS } from '../data/encounters.js'
import type { PlayerClass } from '../data/classes.js'
import { balancedStrategy, greedyStrategy, meldEagerStrategy } from './strategies.js'

// ── Strategies ────────────────────────────────────────────────────────────────

// ── Runner ────────────────────────────────────────────────────────────────────
const TRIALS = 20_000
const CLASSES: PlayerClass[] = ['warrior', 'mage', 'rogue']
const STRATEGIES: { name: string; fn: Strategy }[] = [
  { name: 'greedy',     fn: greedyStrategy },
  { name: 'meld-eager', fn: meldEagerStrategy },
  { name: 'balanced',   fn: balancedStrategy },
]

const ENC_NAMES = ENCOUNTERS.map(e => e.name ?? `enc${ENCOUNTERS.indexOf(e)}`)

interface Row {
  cls:         PlayerClass
  strategy:    string
  winPct:      number
  avgTurnsWin: number   // turns on winning runs only
  avgTurnsAll: number   // turns averaged over all trials
  avgHpWin:    number
  avgMelds:    number
  deathAt:     number[]
}

const rows: Row[] = []

for (const cls of CLASSES) {
  for (const strat of STRATEGIES) {
    let wins = 0, totalTurnsAll = 0, totalTurnsWin = 0, totalHpWin = 0, totalMelds = 0
    const deathAt = [0, 0, 0]

    for (let i = 0; i < TRIALS; i++) {
      const rand = mulberry32(i * 131 + CLASSES.indexOf(cls) * 97 + STRATEGIES.indexOf(strat) * 53)
      const r = runSim(cls, 0, strat.fn, rand, DEFAULT_BUILD)
      totalTurnsAll += r.turns
      totalMelds    += r.meldCount
      if (r.won) { wins++; totalHpWin += r.finalHp; totalTurnsWin += r.turns }
      else if (r.deathEnc >= 0 && r.deathEnc < 3) deathAt[r.deathEnc]++
    }

    rows.push({
      cls,
      strategy:    strat.name,
      winPct:      (wins / TRIALS) * 100,
      avgTurnsWin: wins > 0 ? totalTurnsWin / wins : 0,
      avgTurnsAll: totalTurnsAll / TRIALS,
      avgHpWin:    wins > 0 ? totalHpWin / wins : 0,
      avgMelds:    totalMelds / TRIALS,
      deathAt,
    })
  }
}

// ── Output ────────────────────────────────────────────────────────────────────
const pct = (n: number) => `${n.toFixed(1)}%`
const fix = (n: number, d = 1) => n.toFixed(d)

const COL_W = [10, 12, 7, 8, 8, 8, 6, ...ENC_NAMES.map(() => 9)]
function row(...cells: string[]) {
  return cells.map((c, i) => c.padEnd(COL_W[i] ?? 9)).join('  ')
}
const HEADER = row('class', 'strategy', 'win%', 'trn(w)', 'trn(a)', 'hp(win)', 'melds',
  ...ENC_NAMES.map(n => `die@${n.slice(0, 5)}`))
const SEP = '─'.repeat(HEADER.length)

console.log(`\nMeld In Your Hand Balance Sim  ·  ${TRIALS.toLocaleString()} trials per configuration`)
console.log(SEP)
console.log(HEADER)
console.log(SEP)

let lastCls = ''
for (const r of rows) {
  if (r.cls !== lastCls && lastCls !== '') console.log()
  lastCls = r.cls
  console.log(row(
    r.cls,
    r.strategy,
    pct(r.winPct),
    fix(r.avgTurnsWin),
    fix(r.avgTurnsAll),
    fix(r.avgHpWin),
    fix(r.avgMelds),
    ...r.deathAt.map(d => pct((d / TRIALS) * 100)),
  ))
}
console.log(SEP)
console.log()
