# MELD

A card battle game built in Three.js where the core skill is knowing when and how to meld.

**[Play now →](https://marilefabled.github.io/meld/)**

---

## Design direction

This is the foundation. Everything built on top of it should respect these pillars:

**Tiers are transformations, not just numbers.**
Melding doesn't only scale damage — it changes what a card *does*. Absorb unlocks healing at Tier II. Overload removes its own backlash at Tier III. Slash and Fireball gain status effects at Tier III. New cards should have qualitative shifts between tiers, not just bigger values.

**Melding is immediately rewarded.**
Every meld draws a card on the spot. The merged card goes to discard and cycles back later — that's the delayed reward. The draw is the instant one. Both matter.

**There is no heal card.**
HP restoration comes from: Tier II+ absorb cards, between-encounter rests, and tier bonuses on specific cards. Survival is a skill, not a resource.

**Meld opportunities are strategic, not lucky.**
You can hold up to 2 cards between turns. The deck is small (13 cards). These two facts together mean you can reliably plan a meld over 2–3 turns — it's not a coin flip.

**Unused AP isn't wasted.**
Every leftover AP at end of turn converts 1:1 to bonus draws next turn. Passing isn't dead — sometimes you're setting up.

---

## How to play

**Each turn:** draw up to 4 cards → play cards → end turn → enemy acts → repeat.

- Cards cost **1–2 AP**. You start each turn with **3 AP**.
- **MELD** two identical cards in hand to fuse them (costs 2–3 AP depending on card). The merged card enters the discard at the higher tier and draws you 1 card immediately.
- **HOLD** up to 2 cards to keep them in hand next turn — use this to set up melds deliberately.
- Leftover AP at end of turn becomes bonus draws next turn (uncapped).

**Tier scaling:**
| Tier | Multiplier | Example (Strike base 6) |
|------|-----------|------------------------|
| I    | ×1.0      | 6 dmg                  |
| II   | ×2.2      | 13 dmg                 |
| III  | ×4.5      | 27 dmg                 |

---

## Cards

| Card | Cost | Tier I | Tier II | Tier III |
|------|------|--------|---------|----------|
| **Strike** | 1 | 6 dmg | 13 dmg | 27 dmg |
| **Slash** | 1 | 4 dmg | 9 dmg | 18 dmg + bleed 2 (vulnerable) |
| **Fireball** | 2 | 9 dmg | 20 dmg | 40 dmg + ignite 3 (poison) |
| **Overload** | 1 | 5 dmg | 11 dmg · 3 self | 23 dmg |
| **Absorb** | 1 | +2 absorb | +4 absorb · +4 HP | +9 absorb · +9 HP |
| **Shell** | 2 | +4 absorb | +9 absorb · +9 HP | +18 absorb · +18 HP |

Overload's Tier II self-damage bypasses absorb — you can't shield against yourself.
Absorb clears at the start of your turn; enemy absorb persists until damaged through.

---

## Classes

Chosen during the intro. Sets starting HP and deck composition.

| Class | HP | Identity |
|-------|----|----------|
| **Warrior** | 70 | Strike-heavy, reliable damage engine, extra absorb pairs |
| **Mage** | 50 | Fireball flood, glass cannon, Tier III ignite is the win condition |
| **Rogue** | 60 | Slash-focused, bleeds the enemy into vulnerable stacks |

---

## Encounters

Three enemies, chosen before the fight. Picking a later enemy skips to that point in the gauntlet.

| Enemy | HP | Moves | Threat |
|-------|----|-------|--------|
| **Whelp** | 35 | Scratch (4), Claw (6) | Fast — full gauntlet warm-up |
| **Brute** | 70 | Slam (8), Bite (11), Guard (+3 absorb) | Absorb blocks your damage |
| **CORE** | 120 | Crush (10), Surge (15 + poison 2), Fortify (+5 absorb), Recharge (+8 HP) | Everything — need Tier IIs |

Clearing an encounter restores HP (25 after Whelp, 15 after Brute).

---

## Status effects

| Effect | What it does | Ticks |
|--------|-------------|-------|
| **Vulnerable** | Target takes ×1.5 damage | −1 stack at start of player turn |
| **Poison** | Deal poison stacks as damage | −1 stack at start of player turn |
| **Weak** | Actor deals ×0.75 damage | −1 stack at start of player turn |

---

## Tech

Three.js + TypeScript + Vite. No framework.

```bash
npm install
npm run dev              # browser dev server → localhost:3000
npm run electron:dev     # desktop app (Electron wrapping the dev server)
npm test                 # vitest unit tests
npm run typecheck        # tsc --noEmit
npm run build            # production build → dist/
npm run electron:build   # package desktop app → release/
```
