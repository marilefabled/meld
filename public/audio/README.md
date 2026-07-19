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
