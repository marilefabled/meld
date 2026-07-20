# Soundtrack drop-in

The game scores itself from files in this folder. **It ships with none** — until a
file is here, that moment plays the procedural A-minor pad (the fallback bed), so
everything already sounds intentional. Drop a file in, reload, and that context
scores itself. No code change.

## How to add a track

1. Open `audio/MELD_suno_soundtrack.xlsx`. Find the cue (e.g. **MTH-04**).
2. Paste its **Suno Style Prompt** cell straight into Suno's Style box. Follow the
   sheet's loop/stinger notes (trim loops to a clean 30–90s section; cut stingers
   to the single swell).
3. Export as **`.mp3`** and save it here under the **file name** below.
4. Reload the game. Done.

Everything stays in A minor around the shared "MELD motif" (see the workbook's
Sound Direction sheet) so the crossfades between contexts blend.

## Beds — looping, one per context

| File | Cue | When it plays |
| --- | --- | --- |
| `title.mp3` | MTH-01 | Title screen / main menu |
| `class-select.mp3` | MTH-02 | Pick-your-fruit screen |
| `loadout.mp3` | MTH-03 | Pack-the-pouch loadout |
| `battle-1.mp3` | MTH-04 | Bag 1 combat |
| `battle-2.mp3` | MTH-05 | Bag 2 combat |
| `battle-3.mp3` | MTH-06 | Bag 3 combat |
| `mirror.mp3` | MTH-07 | The Original (finale) |
| `mirror-remembered.mp3` | MTH-17 | The Original on a later cycle (NG+) |
| `evolution.mp3` | MTH-10 | Between-bag evolution + modifier |
| `collection.mp3` | MTH-14 | Collection / fragment shop |
| `dialogue.mp3` | MTH-13 | (reserved — herald / dialogue bed) |
| `cutscene.mp3` | MTH-11 | (reserved — memory cutscenes) |

## Opponent themes — optional, one per boss

Any of the 18 gauntlet opponents can have its own theme. Drop the file in and that
fight scores itself. **A theme also covers its bag-mates:** a fight whose own theme
you haven't made yet borrows another finished theme from the same bag (then the bag
bed above, then the pad). So one song per bag already gives every fight in that bag
real battle music — do one, some, or all eighteen. No cue in the workbook; write
your own prompt (keep it in A minor so it blends with the rest).

| Bag | Sealed 🔒 | Hard-Set 🧱 | Refilling 💧 |
| --- | --- | --- | --- |
| 1 | `boss-the-crimp.mp3`<br>`boss-crimp.mp3` | `boss-hard-set.mp3`<br>`boss-hard-chew.mp3` | `boss-the-last-drop.mp3`<br>`boss-juice-bloom.mp3` |
| 2 | `boss-sachet.mp3`<br>`boss-flash-seal.mp3` | `boss-brick-bite.mp3`<br>`boss-rind-wall.mp3` | `boss-refill.mp3`<br>`boss-tangle.mp3` |
| 3 | `boss-hard-seal.mp3`<br>`boss-blank-pack.mp3` | `boss-gummy-vault.mp3`<br>`boss-the-block.mp3` | `boss-the-gulp.mp3`<br>`boss-the-flood.mp3` |

First name in each cell is the default (met on a first run); the second is the alt
variant that rotates in on later cycles. The Original uses `mirror.mp3` above, not a
`boss-` file.

## Stingers — one-shots layered over the bed

| File | Cue | Fires on |
| --- | --- | --- |
| `stinger-meld.mp3` | MTH-15 | A successful card meld |
| `stinger-run-cleared.mp3` | MTH-12 | Breaking a bag's third seal |
| `stinger-victory.mp3` | MTH-08 | Beating The Original (ending) |
| `stinger-defeat.mp3` | MTH-09 | Form lost |

## Notes

- **Format:** `.mp3` (broadest browser support). The engine picks files up by the
  exact names above; extra files here are ignored.
- **Loudness:** tracks crossfade against the pad at a fixed trim. If one lands hot
  or quiet, set its `gain` in `src/audio/soundtrack.ts` (e.g. `{ …, gain: 0.8 }`)
  rather than re-exporting.
- **Loading:** files are fetched at runtime, not precached, so they don't bloat the
  PWA install. They stream over the network on first play (the pad covers the gap).
- The pad itself is the workbook's **MTH-16** ambient drone — synthesized in
  `src/music.ts`, no file needed. **MTH-18** archetype motif layers are not wired
  yet.
