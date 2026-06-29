// Ambient background music — procedural Web Audio API pad.
// Call music.prime() early (before user gesture) to set up the context.
// The context auto-resumes on first user interaction; music fades in over 2s.

import { settings } from './settings.js'

// A natural minor chord spread across two octaves: A2, C3, E3, A3, C4
// Slight detune per partial gives a warm, slightly detuned pad character.
const PARTIALS: { freq: number; gain: number; detune: number }[] = [
  { freq: 110.00, gain: 0.30, detune:  0  },  // A2 — bass root
  { freq: 130.81, gain: 0.18, detune:  4  },  // C3 — minor third
  { freq: 164.81, gain: 0.20, detune: -3  },  // E3 — fifth
  { freq: 220.00, gain: 0.16, detune:  2  },  // A3 — octave
  { freq: 261.63, gain: 0.10, detune: -5  },  // C4 — high minor third
  { freq: 329.63, gain: 0.06, detune:  6  },  // E4 — sparkle
]

// Total partial gain ≈ 1.0. masterGain × partialMix = final volume.
// At musicVolume=0.45 (default) and MASTER=0.12: output ≈ 0.054 — quiet ambient.
const MASTER = 0.14

let _ctx:        AudioContext | null = null
let _masterGain: GainNode    | null = null
let _oscs:       OscillatorNode[]   = []
let _lfo:        OscillatorNode | null = null
let _started = false
let _primed  = false

function _ensureCtx(): AudioContext {
  if (_ctx) return _ctx
  _ctx = new AudioContext()
  _masterGain = _ctx.createGain()
  _masterGain.gain.value = 0
  _masterGain.connect(_ctx.destination)

  // Slow tremolo LFO (0.07 Hz ≈ 14s period, ±1.2% gain variation) — gives the
  // pad subtle breath without being distracting.
  _lfo = _ctx.createOscillator()
  _lfo.type = 'sine'
  _lfo.frequency.value = 0.07
  const lfoGain = _ctx.createGain()
  lfoGain.gain.value = 0.012
  _lfo.connect(lfoGain)
  lfoGain.connect(_masterGain.gain)
  _lfo.start()

  return _ctx
}

function _buildOscillators(c: AudioContext) {
  _oscs = PARTIALS.map(p => {
    const osc = c.createOscillator()
    const g   = c.createGain()
    osc.type           = 'sine'
    osc.frequency.value = p.freq
    osc.detune.value    = p.detune
    g.gain.value        = p.gain
    osc.connect(g)
    g.connect(_masterGain!)
    osc.start()
    return osc
  })
}

export const music = {
  /** Call as early as possible (no user gesture needed yet). */
  prime() {
    if (_primed) return
    _primed = true
    _ensureCtx()
    // Auto-resume when the browser allows it (after first user gesture).
    document.addEventListener('click', () => {
      if (_ctx?.state === 'suspended') _ctx.resume()
    }, { passive: true })
  },

  /** Start music after the first user gesture. Safe to call multiple times. */
  start() {
    if (_started) return
    _started = true
    const c = _ensureCtx()

    const doStart = () => {
      _buildOscillators(c)
      // Fade in over 2 seconds
      const target = settings.musicVolume * MASTER
      _masterGain!.gain.linearRampToValueAtTime(target, c.currentTime + 2)
    }

    if (c.state === 'running') {
      doStart()
    } else {
      c.resume().then(doStart)
    }
  },

  stop() {
    if (!_started || !_ctx || !_masterGain) return
    const fadeEnd = _ctx.currentTime + 1.2
    _masterGain.gain.linearRampToValueAtTime(0, fadeEnd)
    _oscs.forEach(o => o.stop(fadeEnd + 0.05))
    _lfo?.stop(fadeEnd + 0.05)
    _oscs = []
    _lfo  = null
    _started = false
    _primed  = false
    const c = _ctx
    setTimeout(() => { c.close(); if (_ctx === c) { _ctx = null; _masterGain = null } }, 1800)
  },

  setVolume(v: number) {
    if (_masterGain && _ctx) {
      _masterGain.gain.setTargetAtTime(v * MASTER, _ctx.currentTime, 0.06)
    }
  },
}
