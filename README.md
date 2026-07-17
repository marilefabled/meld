# Meld In Your Hand

A browser roguelite about the Fruit Front's war against Candy.

Fruit snacks insist they are fruit: brighter, cleaner, governed by standards Candy cannot understand. Candy insists they are all sugar in wrappers, and that the distinction is a useful story told by nervous cousins. Both are built from bright filling, hard rind, sour powder, pectin, and wrapper film. Neither side thinks this makes the other side less dangerous.

The Wrapper is Candy's machine for settling the argument. It makes everything uniform, harmless, and easy to label. The Fruit Front calls that conquest. Candy calls it packaging.

Fuse matching pieces. Hold the right pieces in the pouch. Prove, with force, that fruit is not candy.

## Play

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. The primary target is the browser build; Electron is secondary.

## Browser Package

```bash
npm run package:web
```

This creates `dist/`, an installable landscape PWA with a web manifest and offline precache. Deploy `dist/` over HTTPS; on iOS, open it in Safari and use **Add to Home Screen**.

## The Loop

- Spend 3 AP to play cards, defend, heal, and set up your next draw.
- **Meld** two matching cards to make a Tier II or Tier III piece. Melded cards draw one replacement immediately.
- **Hold** up to two cards in the pouch so a future hand can complete a pair.
- Break three Candy seals per bag, choose one reward after each, then press a fruit deeper or mix in another.
- Open three bags. Then fight **The Original**: Candy's pristine copy of your current form.

Unused AP becomes bonus draws next turn. The game wants deliberate pressure, not automatic spending.

## Forms

| Form | HP | Core piece | Method |
| --- | ---: | --- | --- |
| **Cherry Brick** | 70 | Cherry Pull | Dense direct damage and strong rind. Best into sealed foes. |
| **Citrus Burst** | 55 | Citrus Pop | High burst damage. Best into refilling foes. |
| **Sour Ribbon** | 60 | Sour Thread | Poison pressure that slips through rind. Best into hard-set foes. |

Each form can swap its two `Pressure Pop` cards for a form-specific technique pair at loadout:

| Form | Technique | Role |
| --- | --- | --- |
| Cherry Brick | Bounceback | Return damage, add vulnerability, pay a little strain. |
| Citrus Burst | Juice Fuse | Cheap vulnerability setup for a burst turn. |
| Sour Ribbon | Siphon | Damage, a small heal, and poison in one expensive piece. |

## Pieces

Cards are a compact ladder: `family -> tier -> variant`.

| Family | Cost | Tier I | Tier II | Tier III |
| --- | ---: | ---: | ---: | ---: |
| **Cherry Pull** | 1 | 6 dmg | 13 dmg | 27 dmg |
| **Sour Thread** | 1 | 4 dmg | 9 dmg | 18 dmg + vuln |
| **Citrus Pop** | 2 | 9 dmg | 20 dmg | 40 dmg + ignite |
| **Pressure Pop** | 1 | 8 dmg + 2 self | 11 dmg + 3 self | 30 dmg + 5 self |
| **Rind** | 1 | +2 absorb | +4 absorb +4 HP | +9 absorb +9 HP |
| **Stillness** | 1 | weak 1 | weak 2 +4 HP | weak 3 +8 HP |

Variant unlocks alter one tier without changing the family or its pairing logic. Internal card IDs stay stable for saves, simulations, and balance tooling.

## Candy

Every bag contains three Candy combatants, one from each resistance family:

| Family | What it does | Clean answer |
| --- | --- | --- |
| **Sealed** | Rejects poison, weak, and vulnerability. | Direct damage. |
| **Hard-Set** | Grows absorb at the start of each turn. | Poison, which ignores absorb. |
| **Refilling** | Heals at the start of each turn. | Concentrated burst. |

The first bag teaches these walls cheaply: **The Crimp**, **Hard Set**, and **The Last Drop**. Later variants keep the trait but change the pressure pattern. They are not monsters to Fruit snacks; they are Candy people with a different doctrine, and that makes every victory messier. After three bags, The Original mirrors your selected form and the power you accumulated.

## Progression

After each completed bag, choose one evolution:

- **Press deeper**: all cards from your base fruit gain +35% base power.
- **Mix in a flavor**: add three low-cost off-form pieces that answer a bad matchup.

Between later bags, take one temporary flavor modifier or go unmixed. Fragment rewards unlock card variants across future runs.

## Visual Direction

Meld In Your Hand uses code-built Three.js forms, procedural glyphs, card art, and effects. No external character pack is required. The visual language is bright plastic divinity: glossy material, clean silhouettes, a Fruit Front that takes its principles gravely, and Candy that is uncomfortably close to everything it condemns.

## Verification

```bash
npm test
npm run typecheck
npm run build
npm run sim
npm run sim:techniques
```

`npm run sim` checks baseline class balance. `npm run sim:techniques` compares each technique package with its Pressure Pop baseline under the same deterministic gauntlet.
