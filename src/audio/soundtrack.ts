// The soundtrack manifest — the bridge between the workbook and the engine.
//
// audio/MELD_suno_soundtrack.xlsx specifies 18 cues (MTH-01…MTH-18), each with a
// paste-ready Suno prompt. This table maps each in-game context to its cue and to
// the file you drop under public/audio/<slug>.<ext>. Nothing here touches the DOM
// or Web Audio, so it stays pure and testable — the engine (music.ts) reads it.
//
// The game ships with ZERO audio files. Until a file is present the procedural pad
// (music.ts) covers that context — it is the workbook's MTH-16 "ambient drone" bed,
// so everything sounds intentional today and gets richer as you export cues from
// Suno. Export MTH-04, save it as public/audio/battle-1.mp3, and Run 1 combat
// scores itself on the next load. No code change.

export type MusicContext =
  | 'title'
  | 'class-select'
  | 'loadout'
  | 'battle-1'
  | 'battle-2'
  | 'battle-3'
  | 'mirror'
  | 'mirror-remembered'
  | 'evolution'
  | 'collection'
  | 'dialogue'
  | 'cutscene'

export type StingerId = 'meld' | 'run-cleared' | 'victory' | 'defeat'

export interface TrackDef {
  /** Workbook cue ID — where its Suno prompt and notes live. */
  cue:  string
  /** File basename under public/audio/. The engine appends the extension. */
  slug: string
  /** Loudness trim, default 1. Lower it for a hot master, raise a quiet one. */
  gain?: number
}

// Looping beds, one per context. cue → public/audio/<slug>.mp3
export const TRACKS: Record<MusicContext, TrackDef> = {
  'title':             { cue: 'MTH-01', slug: 'title' },
  'class-select':      { cue: 'MTH-02', slug: 'class-select' },
  'loadout':           { cue: 'MTH-03', slug: 'loadout' },
  'battle-1':          { cue: 'MTH-04', slug: 'battle-1' },
  'battle-2':          { cue: 'MTH-05', slug: 'battle-2' },
  'battle-3':          { cue: 'MTH-06', slug: 'battle-3' },
  'mirror':            { cue: 'MTH-07', slug: 'mirror' },
  'mirror-remembered': { cue: 'MTH-17', slug: 'mirror-remembered' },
  'evolution':         { cue: 'MTH-10', slug: 'evolution' },
  'collection':        { cue: 'MTH-14', slug: 'collection' },
  'dialogue':          { cue: 'MTH-13', slug: 'dialogue' },
  'cutscene':          { cue: 'MTH-11', slug: 'cutscene' },
}

// One-shots layered over whatever bed is playing. Silent until the file exists.
export const STINGERS: Record<StingerId, TrackDef> = {
  'meld':        { cue: 'MTH-15', slug: 'stinger-meld',        gain: 0.65 },
  'run-cleared': { cue: 'MTH-12', slug: 'stinger-run-cleared' },
  'victory':     { cue: 'MTH-08', slug: 'stinger-victory' },
  'defeat':      { cue: 'MTH-09', slug: 'stinger-defeat' },
}

/** The combat bed for a run (0-indexed). The Mirror is separate — see mirrorContext. */
export function battleContextForRun(runNumber: number): MusicContext {
  const r = Math.min(Math.max(runNumber, 0), 2)
  return (['battle-1', 'battle-2', 'battle-3'] as const)[r]
}

/** The finale bed — the remembered variant (MTH-17) once you've looped the game. */
export function mirrorContext(cycles: number): MusicContext {
  return cycles > 0 ? 'mirror-remembered' : 'mirror'
}
