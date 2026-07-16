import { CARD_DATA, TIER_ROMAN, makeCard, type GameCard, type CardBuild } from '../data/cards.js'
import { CLASS_CONFIGS, type PlayerClass } from '../data/classes.js'
import type { EnemyTrait } from '../data/encounters.js'
import { buildIcon, cardArt } from '../engine/icons.js'

const hex = (n: number) => '#' + n.toString(16).padStart(6, '0')

export type Reward =
  | { type: 'card';    card: GameCard }
  | { type: 'hp';      amount: number }
  | { type: 'variant'; cardId: string; tier: number; variantIdx: number }

export interface RewardContext {
  encIdx: number
  build: CardBuild
  playerClass: PlayerClass
  enemyTraits: EnemyTrait[]
  enemyName?: string
  rivalLine?: string
}

interface RewardOption {
  kind: 'card' | 'hp' | 'variant'
  icon: string
  art?: string
  cc?: string
  label: string
  sub: string
  compare?: string
  reward: Reward
}

const TRAIT_LESSON: Record<EnemyTrait['kind'], string> = {
  immune:  'strike',
  armored: 'slash',
  regen:   'fireball',
}

function firstTrait(ctx: RewardContext): EnemyTrait['kind'] | null {
  return ctx.enemyTraits[0]?.kind ?? null
}

function classCardForLesson(ctx: RewardContext): string {
  const cfg = CLASS_CONFIGS[ctx.playerClass]
  const lesson = firstTrait(ctx)
  const lessonCard = lesson ? TRAIT_LESSON[lesson] : cfg.signatureCard
  return cfg.deck.includes(lessonCard) ? lessonCard : cfg.signatureCard
}

function variantCardForLesson(ctx: RewardContext): string {
  const lesson = firstTrait(ctx)
  if (lesson) return TRAIT_LESSON[lesson]
  return CLASS_CONFIGS[ctx.playerClass].signatureCard
}

export function buildRewardOptions(ctx: RewardContext): RewardOption[] {
  const addCardId = classCardForLesson(ctx)
  const addDef = CARD_DATA[addCardId]!
  const hpAmount = [18, 22][ctx.encIdx] ?? 20
  const upCardId = variantCardForLesson(ctx)
  const upDef = CARD_DATA[upCardId]!
  const upTier = Math.min(ctx.encIdx + 2, 3)
  const upVariants = upDef.variants[upTier - 1]
  const curIdx = ctx.build[upCardId]?.[upTier - 1] ?? 0
  const altIdx = upVariants.length > 1 ? (curIdx === 0 ? 1 : 0) : 0
  const curVariant = upVariants[curIdx] ?? upVariants[0]
  const altVariant = upVariants[altIdx] ?? upVariants[0]
  const lesson = firstTrait(ctx)

  return [
    {
      kind: 'card',
      icon: addDef.icon, art: cardArt(addDef.shape, addDef.color, addDef.type), cc: hex(addDef.color),
      label: `Keep ${addDef.name}`,
      sub: lesson ? `Built to answer ${lesson} foes` : `Add one Tier I ${addDef.name}`,
      reward: { type: 'card', card: makeCard(addCardId) },
    },
    {
      kind: 'hp',
      icon: buildIcon('hp', 0x22c55e),
      label: `Restore ${hpAmount} HP`,
      sub: 'Mend before the next mark',
      reward: { type: 'hp', amount: hpAmount },
    },
    {
      kind: 'variant',
      icon: upDef.icon, art: cardArt(upDef.shape, upDef.color, upDef.type), cc: hex(upDef.color),
      label: `${upDef.name} ${TIER_ROMAN[upTier]}: ${altVariant.name}`,
      sub: altVariant.desc(altVariant.value),
      compare: `${curVariant.name}: ${curVariant.desc(curVariant.value)}  →  ${altVariant.name}: ${altVariant.desc(altVariant.value)}`,
      reward: { type: 'variant', cardId: upCardId, tier: upTier, variantIdx: altIdx },
    },
  ]
}

export function showRewardScreen(ctx: RewardContext): Promise<Reward> {
  return new Promise(resolve => {
    const options = buildRewardOptions(ctx)

    const overlay = document.createElement('div')
    overlay.className = 'reward-overlay'
    const enemyName = ctx.enemyName ?? 'THE SEAL'
    overlay.innerHTML = `
      <div class="rw-eyebrow">${enemyName.toUpperCase()} BROKE OPEN</div>
      <div class="rw-title">TAKE ONE</div>
      <div class="rw-sub">Candy left three pieces behind</div>
      ${ctx.rivalLine ? `<div class="rw-rival">“${ctx.rivalLine}”</div>` : ''}
      <div class="rw-options">
        ${options.map((o, i) => `
          <button class="rw-option rw-${o.kind}${o.art ? ' rw-card' : ''}" data-i="${i}"${o.cc ? ` style="--cc:${o.cc}"` : ''}>
            ${o.art
              ? `<div class="rw-art">${o.art}<div class="rw-glyph">${o.icon}</div></div>`
              : `<div class="rw-icon">${o.icon}</div>`}
            <div class="rw-kind">${o.kind === 'card' ? 'FRUIT FRONT' : o.kind === 'hp' ? 'RECOVER' : 'CANDY TECH'}</div>
            <div class="rw-label">${o.label}</div>
            <div class="rw-desc">${o.sub}</div>
            ${o.compare ? `<div class="rw-compare">${o.compare}</div>` : ''}
          </button>
        `).join('')}
      </div>
    `
    document.body.appendChild(overlay)
    requestAnimationFrame(() => overlay.classList.add('visible'))

    overlay.querySelectorAll<HTMLButtonElement>('.rw-option').forEach(btn => {
      btn.addEventListener('click', () => {
        const i = parseInt(btn.dataset.i!)
        overlay.classList.remove('visible')
        overlay.addEventListener('transitionend', () => overlay.remove(), { once: true })
        resolve(options[i].reward)
      })
    })
  })
}
