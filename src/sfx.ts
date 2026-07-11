// Procedural WAV synthesis — no external deps. Plays via new Audio() which
// works after any user gesture on the page (e.g. clicking NEW GAME).
//
// Softness comes from the envelope, not just the volume: every tone gets a short
// ATTACK ramp (so the onset doesn't click) and a RELEASE fade (so the cutoff
// doesn't click) — instant-onset clicks are what make raw beeps sound harsh. A
// one-pole LOWPASS muffles the brightness, a pitch GLIDE gives soft impacts, and
// `triangle` replaces the buzzy `square`.

import { settings } from './settings.js'

function toneWav({ freq = 440, freqEnd, dur = 0.12, type = 'sine', decay = 8, volume = 0.6,
  attack = 0.006, lowpass = 0, sampleRate = 44100 }: {
  freq?: number; freqEnd?: number; dur?: number; type?: 'sine' | 'triangle' | 'square' | 'noise'
  decay?: number; volume?: number; attack?: number; lowpass?: number; sampleRate?: number
} = {}): string {
  const n   = Math.floor(sampleRate * dur)
  const rel = Math.min(0.02, dur * 0.3)   // release fade length (s)
  const samples = new Int16Array(n)
  let phase = 0, lp = 0
  for (let i = 0; i < n; i++) {
    const t = i / sampleRate
    const f = freqEnd != null ? freq + (freqEnd - freq) * (t / dur) : freq
    phase += (2 * Math.PI * f) / sampleRate   // accumulate so glides stay phase-continuous
    let wave = type === 'noise' ? Math.random() * 2 - 1
      : type === 'square'   ? (Math.sin(phase) >= 0 ? 1 : -1)
      : type === 'triangle' ? (2 / Math.PI) * Math.asin(Math.sin(phase))
      : Math.sin(phase)
    if (lowpass > 0) { lp += (wave - lp) * lowpass; wave = lp }   // one-pole lowpass
    const atk = attack > 0 ? Math.min(1, t / attack) : 1          // attack ramp (no onset click)
    const relEnv = (dur - t) < rel ? (dur - t) / rel : 1          // release fade (no cutoff click)
    const env = Math.exp(-decay * t) * atk * relEnv
    samples[i] = Math.max(-1, Math.min(1, wave * env * volume)) * 32767
  }
  const buf  = new ArrayBuffer(44 + n * 2)
  const view = new DataView(buf)
  const str  = (off: number, s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i)) }
  str(0, 'RIFF'); view.setUint32(4, 36 + n * 2, true); str(8, 'WAVE')
  str(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true)
  view.setUint16(22, 1, true); view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true)
  str(36, 'data'); view.setUint32(40, n * 2, true)
  for (let i = 0; i < n; i++) view.setInt16(44 + i * 2, samples[i], true)
  let bin = ''; const bytes = new Uint8Array(buf)
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return 'data:audio/wav;base64,' + btoa(bin)
}

function mkSnd(params: Parameters<typeof toneWav>[0]): () => void {
  const uri = toneWav(params)
  return () => {
    const a = new Audio(uri)
    a.volume = settings.sfxVolume
    a.play().catch(() => {})
  }
}

export const sfx = {
  // Fires on every card play — kept low and soft so it never grates.
  cardPlay: mkSnd({ type: 'sine',     freq: 230, freqEnd: 185, dur: 0.08, decay: 16, volume: 0.24, attack: 0.004 }),
  // Meld reward — a warm rising perfect fifth (A4 → E5), triangle for mellow body.
  meldBass: mkSnd({ type: 'triangle', freq: 82, freqEnd: 48, dur: 0.24, decay: 7, volume: 0.30, attack: 0.004, lowpass: 0.34 }),
  meld1:    mkSnd({ type: 'triangle', freq: 440, dur: 0.14, decay: 7,   volume: 0.36, attack: 0.008 }),
  meld2:    mkSnd({ type: 'triangle', freq: 660, dur: 0.20, decay: 4.5, volume: 0.38, attack: 0.008 }),
  // Impacts — low muffled thuds with a downward glide, not harsh static.
  hit:      mkSnd({ type: 'triangle', freq: 190, freqEnd: 82, dur: 0.13, decay: 13, volume: 0.34, attack: 0.003, lowpass: 0.4 }),
  enemyHit: mkSnd({ type: 'triangle', freq: 150, freqEnd: 70, dur: 0.11, decay: 16, volume: 0.30, attack: 0.003, lowpass: 0.4 }),
  // Block — a soft woody "tok" (muffled triangle) instead of a buzzy square.
  shield:   mkSnd({ type: 'triangle', freq: 300, dur: 0.12, decay: 10,  volume: 0.28, attack: 0.006, lowpass: 0.5 }),
  // Heal — a gentle warm swell upward.
  heal:     mkSnd({ type: 'sine',     freq: 520, freqEnd: 600, dur: 0.30, decay: 3.5, volume: 0.32, attack: 0.02 }),
  // Victory — pleasant bright rise.
  victory:  mkSnd({ type: 'triangle', freq: 620, freqEnd: 960, dur: 0.50, decay: 2.2, volume: 0.38, attack: 0.01 }),
  // Defeat — a soft descending tone, muffled, not a noise burst.
  defeat:   mkSnd({ type: 'sine',     freq: 240, freqEnd: 80,  dur: 0.60, decay: 2.2, volume: 0.32, attack: 0.02, lowpass: 0.3 }),
  meld() { sfx.meldBass(); sfx.meld1(); setTimeout(() => sfx.meld2(), 110) },
}
