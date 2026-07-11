import { runSim, mulberry32, findPairs, type Strategy, type SimCtx } from './battleSim.js'
import { CARD_DATA, DEFAULT_BUILD, getVariant } from '../data/cards.js'
import { ENCOUNTERS } from '../data/encounters.js'
import type { PlayerClass } from '../data/classes.js'

function cardHasWeakStatus(cardId: string, tier: number): boolean {
  const def = CARD_DATA[cardId]
  if (!def) return false
  const v = getVariant(def, tier, DEFAULT_BUILD, cardId)
  return v.status?.kind === 'weak' && v.status?.target === 'enemy'
}

function enemyIsImmuneToWeak(ctx: SimCtx): boolean {
  return ctx.enemyTraits.some(t => t.kind === 'immune' && t.statuses.includes('weak' as never))
}

// ── Strategies ────────────────────────────────────────────────────────────────

function greedyFn(ctx: SimCtx): ReturnType<Strategy> {
  const attacks = ctx.hand
    .filter(c => CARD_DATA[c.cardId]?.type === 'attack' && (CARD_DATA[c.cardId]?.cost ?? 1) <= ctx.energy)
    .sort((a, b) => {
      const da = CARD_DATA[a.cardId]; const db = CARD_DATA[b.cardId]
      const va = da ? getVariant(da, a.tier, DEFAULT_BUILD, a.cardId).value : 0
      const vb = db ? getVariant(db, b.tier, DEFAULT_BUILD, b.cardId).value : 0
      return vb - va
    })
  if (attacks.length > 0) return { type: 'play', card: attacks[0] }

  const defends = ctx.hand
    .filter(c => CARD_DATA[c.cardId]?.type === 'defend' && (CARD_DATA[c.cardId]?.cost ?? 1) <= ctx.energy)
    .sort((a, b) => b.tier - a.tier)
  if (defends.length > 0) return { type: 'play', card: defends[0] }

  return { type: 'end' }
}

function meldEagerFn(ctx: SimCtx): ReturnType<Strategy> {
  const pairs = findPairs(ctx.hand)
  for (const [a, b] of pairs) {
    const cost = Math.min((CARD_DATA[a.cardId]?.cost ?? 1) * 2, 3)
    if (ctx.energy >= cost) return { type: 'meld', a, b }
  }
  return greedyFn(ctx)
}

function balancedFn(ctx: SimCtx): ReturnType<Strategy> {
  if (ctx.playerHp > ctx.playerMaxHp * 0.7) {
    const pairs = findPairs(ctx.hand)
    for (const [a, b] of pairs) {
      const cost = Math.min((CARD_DATA[a.cardId]?.cost ?? 1) * 2, 3)
      if (ctx.energy >= cost) return { type: 'meld', a, b }
    }
  }

  const lowHp        = ctx.playerHp < ctx.playerMaxHp * 0.4
  const immuneToWeak = enemyIsImmuneToWeak(ctx)
  const defends = ctx.hand
    .filter(c => {
      const def = CARD_DATA[c.cardId]
      if (!def || def.type !== 'defend' || (def.cost ?? 1) > ctx.energy) return false
      // Skip Hush against immune enemies — the Weak effect is blocked (hold for meld instead)
      if (immuneToWeak && cardHasWeakStatus(c.cardId, c.tier)) return false
      return true
    })
    .sort((a, b) => b.tier - a.tier)
  const attacks = ctx.hand
    .filter(c => CARD_DATA[c.cardId]?.type === 'attack' && (CARD_DATA[c.cardId]?.cost ?? 1) <= ctx.energy)
    .sort((a, b) => {
      const da = CARD_DATA[a.cardId]; const db = CARD_DATA[b.cardId]
      const va = da ? getVariant(da, a.tier, DEFAULT_BUILD, a.cardId).value : 0
      const vb = db ? getVariant(db, b.tier, DEFAULT_BUILD, b.cardId).value : 0
      return vb - va
    })

  if (lowHp && defends.length > 0) return { type: 'play', card: defends[0] }
  if (attacks.length > 0) return { type: 'play', card: attacks[0] }
  if (defends.length > 0) return { type: 'play', card: defends[0] }
  return { type: 'end' }
}

// ── Runner ────────────────────────────────────────────────────────────────────
const TRIALS = 20_000
const CLASSES: PlayerClass[] = ['warrior', 'mage', 'rogue']
const STRATEGIES: { name: string; fn: Strategy }[] = [
  { name: 'greedy',     fn: greedyFn },
  { name: 'meld-eager', fn: meldEagerFn },
  { name: 'balanced',   fn: balancedFn },
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

console.log(`\nMELD Balance Sim  ·  ${TRIALS.toLocaleString()} trials per configuration`)
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
