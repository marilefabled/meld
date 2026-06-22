// Procedural WAV synthesis — no external deps. Plays via new Audio() which
// works after any user gesture on the page (e.g. clicking NEW GAME).

function toneWav({ freq = 440, dur = 0.12, type = 'sine', decay = 8, volume = 0.6, sampleRate = 44100 }: {
  freq?: number; dur?: number; type?: 'sine' | 'square' | 'noise'
  decay?: number; volume?: number; sampleRate?: number
} = {}): string {
  const n = Math.floor(sampleRate * dur)
  const samples = new Int16Array(n)
  for (let i = 0; i < n; i++) {
    const t = i / sampleRate
    const wave = type === 'noise' ? Math.random() * 2 - 1
      : type === 'square' ? (Math.sin(2 * Math.PI * freq * t) >= 0 ? 1 : -1)
      : Math.sin(2 * Math.PI * freq * t)
    const env = Math.exp(-decay * t)
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
  return () => { new Audio(uri).play().catch(() => {}) }
}

export const sfx = {
  cardPlay: mkSnd({ freq: 330,  dur: 0.07,  decay: 14,  volume: 0.4  }),
  meld1:    mkSnd({ freq: 440,  dur: 0.12,  decay: 8,   volume: 0.55 }),  // A4
  meld2:    mkSnd({ freq: 660,  dur: 0.18,  decay: 5,   volume: 0.6  }),  // E5 — rising perfect fifth
  hit:      mkSnd({ type: 'noise',  freq: 200, dur: 0.09, decay: 35, volume: 0.5  }),
  enemyHit: mkSnd({ type: 'noise',  freq: 140, dur: 0.12, decay: 28, volume: 0.45 }),
  shield:   mkSnd({ type: 'square', freq: 280, dur: 0.10, decay: 12, volume: 0.4  }),
  heal:     mkSnd({ freq: 528,  dur: 0.22,  decay: 5,   volume: 0.45 }),
  victory:  mkSnd({ freq: 880,  dur: 0.45,  decay: 2.5, volume: 0.55 }),
  defeat:   mkSnd({ type: 'noise',  freq: 60,  dur: 0.6,  decay: 3,  volume: 0.4  }),
  meld() { sfx.meld1(); setTimeout(() => sfx.meld2(), 110) },
}
