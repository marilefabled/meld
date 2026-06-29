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

**There is no dedicated heal card.**
HP restoration comes from: Tier II+ Absorb and Ward (on meld), between-encounter rests, and tier bonuses on specific cards. Survival is a skill, not a resource.

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
| **Overload** | 1 | 8 dmg · 2 self | 11 dmg · 3 self | 30 dmg · 5 self |
| **Absorb** | 1 | +2 absorb | +4 absorb · +4 HP | +9 absorb · +9 HP |
| **Ward** | 1 | weak 1 | weak 2 · +4 HP | weak 3 · +8 HP |

Overload's self-damage bypasses absorb — you can't shield against yourself. The "safe" variants (Burst/Overcharge) are unlockable alts.
Ward applies Weak to the enemy: they deal ×0.75 damage for N turns. Blocked by Immune enemies.
Absorb clears at the start of your turn; enemy absorb persists until damaged through.

---

## Classes

Chosen during the intro. Sets starting HP and deck composition.

| Class | HP | Identity |
|-------|----|----------|
| **Warrior** | 70 | Strike-heavy, reliable damage engine, extra absorb pairs |
| **Mage** | 55 | Fireball flood, glass cannon, Tier III ignite is the win condition |
| **Rogue** | 60 | Slash-focused, bleeds the enemy into vulnerable stacks |

---

## Progression — between runs

A full game is **10 opponents: 3 runs of 3 marks, then a 10th — the Mirror finale.** That whole arc is one "run" of the game; it's a small, tight game by design. After each of the first three runs, your form evolves down one of two axes:

- **DEEPEN** (same class) — `powerLevel += 0.35`. Every card's damage, heal, and absorb scales by the multiplier. Your identity, amplified. **Depth.** Picking your own class again never changes *what* cards do, only *how hard* they hit — it never touches tiers, so it can't short-circuit the in-battle meld ladder.
- **ABSORB** (another class) — gain a few **adapted "borrowed" cards**: cheaper, weaker off-class tools, not raw copies of that class's deck. **Breadth.** They dilute your focused draw but hand you the answer to your anti-matchup (see Damage & resistance).

The two axes deliberately don't compete on the same metric — DEEPEN wins on power, ABSORB wins on flexibility — so neither is a strict trap. The borrowed kits:

| Absorb | Grants | Answers |
|--------|--------|---------|
| **Warrior** | Borrowed Edge — cheap direct damage | Immune walls |
| **Mage** | Borrowed Spark — cheap burst (cost 1) | Regen walls |
| **Rogue** | Borrowed Thorn — cheap poison | Armored walls (poison ignores armor) |

Borrowed cards are still meldable up the tier ladder, so a second absorb of the same class deepens the kit.

---

## Encounters — the 10 opponents (locked scope)

The gauntlet is **3 runs × 3 marks + the Mirror = 10 opponents total.** The trait triangle (see Damage & resistance) escalates across the runs. Each enemy carries one or more **passive traits** that tax a class.

**Enemies are a system: `archetype × tier × variant` — the mirror of cards** (`src/data/encounters.ts`). A card is *type → tier → variant* (Strike → T1/T2/T3 → Jab/Puncture). An enemy is *archetype → tier → variant*:

- **archetype** ≈ card type — the 3 walls of the triangle (`ARCHETYPES`): Purifier (immune), Bulwark (armored), Renewer (regen)
- **tier** ≈ card tier — escalating threat, one per run (T1=run 1 … T3=run 3)
- **variant** ≈ card variant — same role, different feel (Whelp vs Wisp)

The 9 gauntlet opponents **are** the 3×3 grid; `makeMirror` is the 10th.

Every cell ships **two stable variants** (`default / alternate`), so the whole grid branches:

|  | T1 (run 1) | T2 (run 2) | T3 (run 3, apex — layers a 2nd trait) |
|---|---|---|---|
| **Purifier** (immune) | Whelp / Wisp | Warden / Zealot | Sentinel *(+armored)* / Nullity *(+regen)* |
| **Bulwark** (armored) | Brute / Husk | Rampart / Phalanx | Bastion *(+regen)* / Colossus *(+immune)* |
| **Renewer** (regen) | CORE / Bloom | Wellspring / Thicket | Maw / Leviathan *(+armored)* |

A run is the tier-r form of every archetype (`RUNS` is derived: `tier → archetypes.map(a => a.tiers[tier])`), so each run is one immune, one armored, one regen — **columns stay archetypes, rows escalate.** `encountersForRun(run, cycle)` picks each cell's variant, rotating by `cycle`: **cycle 0 is the tuned default gauntlet, cycle 1 is the all-alternate gauntlet** (Wisp/Husk/Bloom → Zealot/Phalanx/Thicket → Nullity/Colossus/Leviathan), then it loops. Within a role the variants differ in *feel* — Wisp turtles, Zealot is a glass cannon, Phalanx walls up; and each apex pairs its archetype with a different second trait. Add a 3rd variant to any cell to deepen a given loop — it's one appended `EnemyDef`.

**Run 1 · The Proving** — each wall introduced solo, low stakes:

| Mark | HP | Trait | Tax |
|------|----|-------|-----|
| **Whelp** | 35 | Immune (all status) | Guts Rogue · learn it cheap |
| **Brute** | 70 | Armored +3/turn | Bounces Mage burst |
| **CORE** | 120 | Regen +6/turn | Outpaces attrition |

**Run 2 · The Deepening** *(draft)* — the walls return sharper: **Warden** (immune, 60), **Rampart** (armored +4, 100), **Wellspring** (regen +9, 160).

**Run 3 · The Reckoning** *(draft)* — combined traits: **Bastion** (armored + regen, 140), **Sentinel** (immune + armored, 170), **Maw** (regen + heavy poison, 200).

**The 10th · Mirror finale** — *"basically your character."* `makeMirror` reflects your class's signature kit, scaled to your accumulated `powerLevel`. Not a wall to route around — the test of the build you became. Win it → **MELD TO ALL HELD**.

> Run 1 is tuned. Runs 2–3 are **drafts** following the escalation framework — the architecture (per-run pools + mirror) is locked; the specific stats/names are open to redesign.

---

## Story & cutscenes

Each opponent can carry a **story beat** — a short branching conversation played *before* the fight (`src/story.ts`, keyed by enemy name). Beats run on the existing `branchDialogue` + `dialogueBox` engine.

**The thread: the opponents do the talking.** Each one knew him; each is trying to make him *remember* — and on the first time through, he can't. Beats branch on `ctx.cycles` (full games completed, in the progression store): `cycles === 0` → he never reaches it; `cycles > 0` → the loop starts to stick. The Mirror win calls `progression.recordCycle()`, so the memory deepens across playthroughs even though `clearCampaign` wipes the run.

- **Cutscene framing.** A beat with `cutscene: true` dims the scene (scrim) and drops in **letterbox bars**, centering the dialogue for a filmic moment. Plain beats use the bottom box.
- **Branching.** Choices set flags and mutate named variables via `onSelect`. Later beats branch with `(ctx, flags) => …` — reading both `flags.has('measured')` and `ctx.vars.resolve`.
- **Variable saving.** Flags, once-choices, and numeric vars live in `campaign.story` (`StoryState`) and are **saved after every beat** — so a choice before the Whelp still echoes before the Mirror, *across reloads* between runs.

Flow: `title.ts` seeds each beat from the save (`makeStoryHook`), plays it, writes the result back. `battle.ts` just `await`s the hook before each encounter and owns no story state. To add a beat: drop a `DialogueConversation<StoryCtx>` into `BEATS[enemyName].before`.

> Beat *content* (Whelp / Brute / Mirror) is placeholder prose — the system is the deliverable. Write the real script straight into `src/story.ts`.

---

## Status effects

| Effect | What it does | Ticks |
|--------|-------------|-------|
| **Vulnerable** | Target takes ×1.5 damage | −1 stack at start of player turn |
| **Poison** | Deal poison stacks as damage — **ignores armor** | −1 stack at start of player turn |
| **Weak** | Actor deals ×0.75 damage | −1 stack at start of player turn |

---

## Damage & resistance

There are **no damage types** (no physical/magical split). Damage is one currency; cards are balanced individually. "Resistance" is expressed through **enemy mechanics**, not type multipliers — this stays legible at a small card count and, crucially, doesn't backfire on absorbed off-class cards (a "resist magical" enemy would eat the very Fireball you absorbed to beat it).

The three classes are defined by **how they win**, and each enemy trait taxes one of them. Every wall has a natural answer, forming a soft triangle:

| Class | Wins by | Walled by | Answers |
|-------|---------|-----------|---------|
| **Warrior** | attrition — direct damage + self-armor | Regen (out-heals the grind) | Immune walls (needs no status) |
| **Mage** | burst — high single hits, fragile | Armored (burst bounces off shields) | Regen walls (overwhelms the heal) |
| **Rogue** | ramp — status compounding over time | Immune (status does nothing) | Armored walls (**poison ignores armor**) |

**The load-bearing rule: poison bypasses absorb.** That's what makes Rogue the answer to the Armored Bulwark, and what closes the triangle. (Precedent: Overload's self-damage already bypasses absorb.)

A mono-class run clears most marks but hits its anti-matchup and *wants* an off-class tool — which is exactly what **ABSORB** provides between runs (see Progression). The pull to diversify is created by enemy design, not forced by a stat wall.

### Enemy traits

- **Armored** — gains absorb at the start of each of its turns. Chip and burst waste themselves on the shield; poison (and any future armor-piercing) goes straight through.
- **Regen** — heals at the start of each of its turns. Slow attrition loses the race; you need a burst window or a big meld to break the heal.
- **Immune** — ignores listed player-applied statuses (shows `IMMUNE`). Negates a status build outright; win with raw damage instead.

Traits live in `EnemyDef.traits` (`src/data/encounters.ts`) as a list, so future enemies can stack more than one.

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
