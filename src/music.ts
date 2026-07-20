// Adaptive soundtrack engine.
//
// Two layers under one user-controlled master:
//   • Beds — a looping track for the current moment. A request resolves to an
//     ordered chain of candidates and the engine plays the first one that exists:
//     an opponent's personal theme → that bag's combat bed → the pad. So a boss
//     with no theme quietly uses its bag's music, and a bag with no music uses
//     the pad. Nothing ever goes silent.
//   • The pad — a procedural A-minor drone (the workbook's MTH-16 ambient bed).
//     The end of every chain. The game ships with zero audio files, so today the
//     pad scores everything; each Suno export dropped into public/audio/ takes
//     over its slot automatically (see audio/soundtrack.ts).
//   • Stingers — one-shot swells (meld, victory, …) layered over the bed. Silent
//     until their file exists.
//
// Autoplay policy: prime() early (no gesture needed), then play(). Audio is
// blocked until the first user gesture resumes the AudioContext; the desired
// chain is remembered and applied the moment it resumes.

import { settings } from './settings.js'
import {
  TRACKS, STINGERS, opponentSlug,
  type MusicContext, type StingerId,
} from './audio/soundtrack.js'

/** Either a plain context, or an opponent theme that falls back to a context. */
export type MusicRequest = MusicContext | { opponent: string; fallback: MusicContext }

const AUDIO_EXT = 'mp3'

// Gain staging. master = musicVolume (0..1). Each layer sits below it through a
// constant trim, then a crossfade "mix" gain (0..1) the engine ramps.
const PAD_TRIM     = 0.14   // procedural pad — quiet ambient bed
const TRACK_TRIM   = 0.32   // mastered tracks are near full-scale; hold headroom
const STINGER_TRIM = 0.5
const XFADE        = 1.4    // seconds, bed crossfades

// A2, C3, E3, A3, C4, E4 — A-natural-minor spread, gently detuned per partial.
const PARTIALS: { freq: number; gain: number; detune: number }[] = [
  { freq: 110.00, gain: 0.30, detune:  0 },
  { freq: 130.81, gain: 0.18, detune:  4 },
  { freq: 164.81, gain: 0.20, detune: -3 },
  { freq: 220.00, gain: 0.16, detune:  2 },
  { freq: 261.63, gain: 0.10, detune: -5 },
  { freq: 329.63, gain: 0.06, detune:  6 },
]

interface BedSpec { key: string; slug: string; gain: number }
interface Bed     { key: string; el: HTMLAudioElement; mix: GainNode }

let _ctx:      AudioContext | null = null
let _master:   GainNode | null = null
let _padMix:   GainNode | null = null   // pad crossfade gain (1 when it is the bed)
let _oscs:     OscillatorNode[] = []
let _lfo:      OscillatorNode | null = null
let _padBuilt = false
let _primed   = false

let _bed:   Bed | null = null    // the audible track, if any
let _chain: BedSpec[] = []       // candidates for where we want to be
let _token  = 0                  // bumped per request; cancels in-flight loads
const _beds    = new Map<string, Bed>()
const _missing = new Set<string>()   // slugs known 404/undecodable this session
const _stinger = new Map<StingerId, AudioBuffer | null>()

function audioUrl(slug: string): string {
  // Resolves against <base>/document location, so it survives base:'./' and any
  // deploy path (the PWA can live at a subpath).
  return new URL(`audio/${slug}.${AUDIO_EXT}`, document.baseURI).href
}

// A request becomes the ordered list of files to try before giving up to the pad.
function specsFor(req: MusicRequest): BedSpec[] {
  if (typeof req === 'string') {
    const t = TRACKS[req]
    return [{ key: req, slug: t.slug, gain: t.gain ?? 1 }]
  }
  const fb = TRACKS[req.fallback]
  return [
    { key: `opponent:${req.opponent}`, slug: opponentSlug(req.opponent), gain: 1 },
    { key: req.fallback, slug: fb.slug, gain: fb.gain ?? 1 },
  ]
}

function ensureCtx(): AudioContext {
  if (_ctx) return _ctx
  const c = new (window.AudioContext ?? (window as any).webkitAudioContext)()
  _ctx = c
  _master = c.createGain()
  _master.gain.value = settings.musicVolume
  _master.connect(c.destination)

  _padMix = c.createGain()
  _padMix.gain.value = 0
  _padMix.connect(_master)
  return c
}

function buildPad(c: AudioContext) {
  if (_padBuilt) return
  _padBuilt = true
  const trim = c.createGain()
  trim.gain.value = PAD_TRIM
  trim.connect(_padMix!)

  _oscs = PARTIALS.map(p => {
    const osc = c.createOscillator()
    const g   = c.createGain()
    osc.type = 'sine'
    osc.frequency.value = p.freq
    osc.detune.value    = p.detune
    g.gain.value        = p.gain
    osc.connect(g); g.connect(trim); osc.start()
    return osc
  })

  // Slow tremolo — subtle breath, ±1.2% over ~14s.
  _lfo = c.createOscillator()
  _lfo.type = 'sine'
  _lfo.frequency.value = 0.07
  const lfoGain = c.createGain()
  lfoGain.gain.value = 0.012
  _lfo.connect(lfoGain); lfoGain.connect(trim.gain)
  _lfo.start()
}

function ramp(g: GainNode, to: number, secs = XFADE) {
  const c = _ctx!
  g.gain.cancelScheduledValues(c.currentTime)
  g.gain.setValueAtTime(g.gain.value, c.currentTime)
  g.gain.linearRampToValueAtTime(to, c.currentTime + secs)
}

// End of every chain: dissolve whatever is playing into the ambient pad.
function fadeToPad() {
  buildPad(_ctx!)
  ramp(_padMix!, 1)
  if (_bed) {
    const leaving = _bed
    ramp(leaving.mix, 0)
    setTimeout(() => { try { leaving.el.pause() } catch {} }, XFADE * 1000 + 60)
    _bed = null
  }
}

function bedFor(spec: BedSpec): Bed {
  let bed = _beds.get(spec.key)
  if (bed) return bed
  const c = _ctx!
  const el = new Audio()
  el.src = audioUrl(spec.slug)
  el.loop = true
  el.preload = 'auto'
  const src = c.createMediaElementSource(el)
  const mix = c.createGain()
  mix.gain.value = 0
  // Bake the per-track trim into a fixed node; `mix` stays a clean 0..1 crossfade.
  const trim = c.createGain()
  trim.gain.value = TRACK_TRIM * spec.gain
  src.connect(trim); trim.connect(mix); mix.connect(_master!)
  bed = { key: spec.key, el, mix }
  _beds.set(spec.key, bed)
  return bed
}

// Walk the chain from `i`, playing the first candidate whose file loads.
function applyChain(i: number, token: number) {
  if (token !== _token || !_ctx || _ctx.state !== 'running') return
  const spec = _chain[i]
  if (!spec) { fadeToPad(); return }                       // exhausted → pad
  if (_bed?.key === spec.key) return                       // already on it
  if (_missing.has(spec.slug)) { applyChain(i + 1, token); return }

  const bed = bedFor(spec)
  const el  = bed.el
  let settled = false
  let failTimer = 0
  const listeners: [string, () => void][] = []

  const cleanup = () => {
    if (failTimer) { clearTimeout(failTimer); failTimer = 0 }
    for (const [ev, fn] of listeners) el.removeEventListener(ev, fn)
    listeners.length = 0
  }

  const activate = () => {
    if (settled) return
    settled = true
    cleanup()
    if (token !== _token) return                           // superseded while loading
    const outgoing = _bed
    el.play().then(() => {
      ramp(bed.mix, 1)
      ramp(_padMix!, 0)
      if (outgoing && outgoing !== bed) {
        ramp(outgoing.mix, 0)
        setTimeout(() => { try { outgoing.el.pause() } catch {} }, XFADE * 1000 + 60)
      }
      _bed = bed
    }).catch(() => { if (token === _token) applyChain(i + 1, token) })
  }

  const onFail = () => {
    if (settled) return
    settled = true
    cleanup()
    _missing.add(spec.slug)        // remember the miss; skip it instantly next time
    if (token === _token) applyChain(i + 1, token)
  }

  if (el.readyState >= 3 /* HAVE_FUTURE_DATA */) { activate(); return }

  const on = (ev: string, fn: () => void) => { listeners.push([ev, fn]); el.addEventListener(ev, fn, { once: true }) }
  on('canplaythrough', activate)
  on('canplay', activate)
  on('error', onFail)
  on('stalled', onFail)
  // A missing file can hang rather than fire 'error' on some browsers — bound it.
  failTimer = window.setTimeout(onFail, 6000)
  try { el.load() } catch {}   // kick the load in case the element was reused
}

export const music = {
  /** Set up the audio graph early. No gesture required yet. */
  prime() {
    if (_primed) return
    _primed = true
    const c = ensureCtx()
    const resume = () => {
      if (c.state !== 'suspended') { applyChain(0, _token); return }
      c.resume().then(() => applyChain(0, _token)).catch(() => {})
    }
    // Retry on each of the first few gestures until the browser lets audio run.
    document.addEventListener('pointerdown', resume, { passive: true })
    document.addEventListener('keydown', resume, { passive: true })
  },

  /**
   * Score a moment. Pass a context, or an opponent + the context to fall back to:
   *   music.play('title')
   *   music.play({ opponent: 'The Crimp', fallback: 'battle-1' })
   */
  play(req: MusicRequest) {
    _primed || music.prime()
    _chain = specsFor(req)
    const token = ++_token
    if (_ctx?.state === 'running') applyChain(0, token)
    else _ctx?.resume().then(() => applyChain(0, token)).catch(() => {})
  },

  /** Layer a one-shot over the bed. No-op until its file exists. */
  sting(id: StingerId) {
    const c = _ctx
    if (!c || c.state !== 'running') return
    const cached = _stinger.get(id)
    if (cached === null) return                 // known-missing
    const fire = (buf: AudioBuffer) => {
      const src = c.createBufferSource()
      const g   = c.createGain()
      g.gain.value = STINGER_TRIM * (STINGERS[id].gain ?? 1)
      src.buffer = buf; src.connect(g); g.connect(_master!); src.start()
    }
    if (cached) { fire(cached); return }
    fetch(audioUrl(STINGERS[id].slug))
      .then(r => r.ok ? r.arrayBuffer() : Promise.reject())
      .then(a => c.decodeAudioData(a))
      .then(buf => { _stinger.set(id, buf); fire(buf) })
      .catch(() => { _stinger.set(id, null) })   // remember the miss; never retry
  },

  setVolume(v: number) {
    if (_master && _ctx) _master.gain.setTargetAtTime(v, _ctx.currentTime, 0.06)
  },

  stop() {
    if (!_ctx) return
    ramp(_master!, 0, 1.2)
    const c = _ctx
    setTimeout(() => {
      try { c.close() } catch {}
      if (_ctx === c) {
        _ctx = _master = _padMix = _lfo = null
        _oscs = []; _bed = null; _chain = []
        _beds.clear(); _stinger.clear(); _missing.clear()
        _padBuilt = _primed = false
      }
    }, 1400)
  },
}
