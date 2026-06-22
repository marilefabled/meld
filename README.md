# MELD

A merging card battle game built in Three.js. Fight three increasingly powerful foes while melding identical cards into higher-tier versions for greater power.

**[Play now →](https://marilefabled.github.io/meld/)**

## How to play

- Play cards to **attack**, **defend**, or **heal**. Each card costs 1–2 AP; you get 3 AP per turn.
- **MELD** two identical cards in hand to combine them into a Tier II (2.2× power). Meld two Tier IIs to reach Tier III (4.5×!).
- Melded cards enter the discard and cycle back — find the pair again and meld once more to keep climbing.
- Leftover AP at end of turn converts to bonus draws next turn.

## Encounters

**Whelp** → **Brute** → **CORE**

Clearing an encounter restores some HP. The CORE hits hard — you'll want Tier IIs before you face it.

## Tech

Three.js + TypeScript + Vite. No framework. Runs in the browser, no install.

```bash
npm install
npm run dev        # localhost:3000
npm run typecheck  # tsc --noEmit
npm run build      # production build → dist/
```
