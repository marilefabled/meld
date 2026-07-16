// ── Meld Icon Engine ─────────────────────────────────────────────────────────
// Each card icon is an SVG badge: dark radial-gradient background + a symbolic
// geometric mark rendered in the card's color. The glow effect is CSS
// drop-shadow on the SVG element, so no SVG filter IDs are needed (avoiding
// DOM ID conflicts when multiple copies of a card are on screen).
//
// Icon shapes stay deliberately within the game's visual language: spheres,
// rings, orbital arcs. Each card type has a distinct geometric identity.

export type IconShape =
  | 'strike' | 'slash' | 'fireball' | 'overload' | 'counter' | 'fuse' | 'leech' | 'absorb' | 'ward'
  | 'vulnerable' | 'poison' | 'weak' | 'hp' | 'cascade' | 'efficiency'

let _id = 0

function hex(color: number): string {
  return '#' + color.toString(16).padStart(6, '0')
}

// ── Symbols (viewBox 0 0 40 40, center 20 20) ─────────────────────────────────

// 4-pointed elongated star — the "impact burst" of direct force.
// Slightly taller than wide; small white core for the strike point.
function iconStrike(c: string): string {
  return `
    <polygon points="20,3 23,17 32,20 23,23 20,37 17,23 8,20 17,17"
      fill="${c}" opacity="0.95"/>
    <polygon points="20,12 21.2,19.5 20,27 18.8,19.5"
      fill="#fff" opacity="0.55"/>
    <circle cx="20" cy="20" r="2" fill="#fff" opacity="0.95"/>
  `
}

// Thick orbital arc sweeping from lower-left to upper-right via the long path —
// a ring fragment in motion. A small tail-dot anchors the origin.
function iconSlash(c: string): string {
  return `
    <path d="M 9 31 A 15.5 15.5 0 1 0 31 9"
      stroke="${c}" stroke-width="5.5" fill="none" stroke-linecap="round" opacity="0.93"/>
    <circle cx="9"  cy="31" r="2.5" fill="${c}" opacity="0.55"/>
    <circle cx="31" cy="9"  r="2"   fill="${c}"/>
  `
}

// Dense core sphere with 8 radial spokes (alternating long/short for starburst).
// White center dot gives the impression of ignition point.
function iconFireball(c: string): string {
  const spokes = Array.from({ length: 8 }, (_, i) => {
    const a  = (i / 8) * Math.PI * 2 - Math.PI / 2
    const co = Math.cos(a), si = Math.sin(a)
    const r  = i % 2 === 0 ? 14 : 11   // alternate long / short
    const xi = (20 + 7  * co).toFixed(1), yi = (20 + 7  * si).toFixed(1)
    const xo = (20 + r  * co).toFixed(1), yo = (20 + r  * si).toFixed(1)
    const w  = i % 2 === 0 ? '2' : '1.4'
    const op = i % 2 === 0 ? '0.9' : '0.6'
    return `<line x1="${xi}" y1="${yi}" x2="${xo}" y2="${yo}" stroke="${c}" stroke-width="${w}" stroke-linecap="round" opacity="${op}"/>`
  }).join('\n    ')
  return `
    ${spokes}
    <circle cx="20" cy="20" r="6.5" fill="${c}"/>
    <circle cx="20" cy="20" r="2.5" fill="#fff" opacity="0.9"/>
  `
}

// Lightning bolt — the classic form of reckless power.
// A bold Z-path with a bright inner white stroke for the electrical core.
function iconOverload(c: string): string {
  const d = 'M 25 4 L 15 22 L 23 22 L 14 37'
  return `
    <path d="${d}" stroke="${c}" stroke-width="6"
      fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="0.92"/>
    <path d="${d}" stroke="#fff" stroke-width="2"
      fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="0.45"/>
  `
}

// Two opposing arcs meeting at a bright hinge — force caught and turned back.
function iconCounter(c: string): string {
  return `
    <path d="M 7 27 A 14 14 0 0 1 20 7" stroke="${c}" stroke-width="4.5"
      fill="none" stroke-linecap="round" opacity="0.9"/>
    <path d="M 33 27 A 14 14 0 0 0 20 7" stroke="${c}" stroke-width="4.5"
      fill="none" stroke-linecap="round" opacity="0.55"/>
    <path d="M 11 23 L 7 27 L 12 30" stroke="#fff" stroke-width="1.8"
      fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="0.72"/>
    <path d="M 29 23 L 33 27 L 28 30" stroke="#fff" stroke-width="1.8"
      fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="0.45"/>
    <circle cx="20" cy="8" r="3.4" fill="${c}"/>
    <circle cx="20" cy="8" r="1.4" fill="#fff" opacity="0.92"/>
  `
}

// Three charged nodes wired into one ignition point.
function iconFuse(c: string): string {
  return `
    <path d="M 9 10 L 20 20 L 31 10 M 20 20 L 20 32"
      stroke="${c}" stroke-width="2.5" fill="none" stroke-linecap="round" opacity="0.62"/>
    <circle cx="9" cy="10" r="4" fill="${c}" opacity="0.78"/>
    <circle cx="31" cy="10" r="4" fill="${c}" opacity="0.78"/>
    <circle cx="20" cy="32" r="4" fill="${c}" opacity="0.78"/>
    <circle cx="20" cy="20" r="6" fill="${c}"/>
    <circle cx="20" cy="20" r="2.3" fill="#fff" opacity="0.95"/>
  `
}

// Paired crescents pull toward a central drop — harm drawn inward as life.
function iconLeech(c: string): string {
  return `
    <path d="M 8 10 C 8 24 13 31 20 32 C 15 27 14 19 16 11 Z" fill="${c}" opacity="0.8"/>
    <path d="M 32 10 C 32 24 27 31 20 32 C 25 27 26 19 24 11 Z" fill="${c}" opacity="0.48"/>
    <path d="M 20 10 C 24 16 25 20 20 24 C 15 20 16 16 20 10 Z" fill="#fff" opacity="0.68"/>
    <circle cx="20" cy="31" r="3.2" fill="${c}"/>
  `
}

// Three concentric rings contracting inward — aspects pulling tight around the core.
// Rings brighten toward center, solid filled core. Reads: "protect / armor."
function iconAbsorb(c: string): string {
  return `
    <circle cx="20" cy="20" r="14"  fill="none" stroke="${c}" stroke-width="1.2" opacity="0.35"/>
    <circle cx="20" cy="20" r="9.5" fill="none" stroke="${c}" stroke-width="2.2" opacity="0.72"/>
    <circle cx="20" cy="20" r="5"   fill="${c}"  opacity="0.96"/>
    <circle cx="20" cy="20" r="2"   fill="#fff"  opacity="0.9"/>
  `
}

// Expanding rings — but the outer ones are dashed, dissolving outward.
// Ward's dashed outer rings contrast with Absorb's solid contracting rings:
// same "ring" language, clearly opposite intent (dissipate vs protect).
function iconWard(c: string): string {
  return `
    <circle cx="20" cy="20" r="5"   fill="${c}"  opacity="0.96"/>
    <circle cx="20" cy="20" r="2"   fill="#fff"  opacity="0.9"/>
    <circle cx="20" cy="20" r="9.5" fill="none" stroke="${c}" stroke-width="2"   opacity="0.65"/>
    <circle cx="20" cy="20" r="14"  fill="none" stroke="${c}" stroke-width="1.2"
      stroke-dasharray="4 3" opacity="0.35"/>
    <circle cx="20" cy="20" r="18"  fill="none" stroke="${c}" stroke-width="0.8"
      stroke-dasharray="3 4.5" opacity="0.16"/>
  `
}

// Inverted triangle — pierced/broken defense, takes extra damage.
function iconVulnerable(c: string): string {
  return `
    <polygon points="20,34 6,8 34,8"
      fill="${c}" opacity="0.78"/>
    <line x1="16" y1="14" x2="20" y2="22" stroke="#fff" stroke-width="1.8" stroke-linecap="round" opacity="0.55"/>
    <line x1="20" y1="22" x2="24" y2="18" stroke="#fff" stroke-width="1.8" stroke-linecap="round" opacity="0.4"/>
    <line x1="24" y1="18" x2="20" y2="34" stroke="#fff" stroke-width="1.8" stroke-linecap="round" opacity="0.3"/>
    <circle cx="20" cy="28" r="2.2" fill="#fff" opacity="0.7"/>
  `
}

// Teardrop (round top, pointed bottom) — dripping toxin.
function iconPoison(c: string): string {
  return `
    <path d="M 20 7 C 28 7 32 17 32 23 C 32 31 26.6 35 20 35 C 13.4 35 8 31 8 23 C 8 17 12 7 20 7 Z"
      fill="${c}" opacity="0.78"/>
    <circle cx="20" cy="20" r="5.5" fill="#fff" opacity="0.18"/>
    <circle cx="17" cy="17" r="2.5" fill="#fff" opacity="0.4"/>
  `
}

// Downward arrow — power going down, reduced damage output.
function iconWeak(c: string): string {
  return `
    <path d="M 20 5 L 20 27" stroke="${c}" stroke-width="5" stroke-linecap="round" opacity="0.9"/>
    <path d="M 9 18 L 20 32 L 31 18" stroke="${c}" stroke-width="5" fill="none"
      stroke-linecap="round" stroke-linejoin="round" opacity="0.9"/>
  `
}

// Plus in a ring — healing and HP restoration.
function iconHp(c: string): string {
  return `
    <circle cx="20" cy="20" r="14" fill="none" stroke="${c}" stroke-width="1.5" opacity="0.4"/>
    <line x1="20" y1="9" x2="20" y2="31" stroke="${c}" stroke-width="4.5" stroke-linecap="round" opacity="0.92"/>
    <line x1="9"  y1="20" x2="31" y2="20" stroke="${c}" stroke-width="4.5" stroke-linecap="round" opacity="0.92"/>
  `
}

// Source sphere with three cascading arcs — chain effect, each meld opens the next.
function iconCascade(c: string): string {
  return `
    <circle cx="20" cy="6" r="4.5" fill="${c}" opacity="0.92"/>
    <path d="M 13 16 A 7 7 0 0 1 27 16"
      fill="none" stroke="${c}" stroke-width="2.5" stroke-linecap="round" opacity="0.85"/>
    <path d="M 7 26 A 13 13 0 0 1 33 26"
      fill="none" stroke="${c}" stroke-width="2"   stroke-linecap="round" opacity="0.6"/>
    <path d="M 2 36 A 18 18 0 0 1 38 36"
      fill="none" stroke="${c}" stroke-width="1.5" stroke-linecap="round" opacity="0.35"/>
  `
}

// Double right chevron — streamlined, no waste, fast.
function iconEfficiency(c: string): string {
  return `
    <path d="M 8 10 L 20 20 L 8 30"
      stroke="${c}" stroke-width="4.5" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="0.9"/>
    <path d="M 19 10 L 31 20 L 19 30"
      stroke="${c}" stroke-width="4.5" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="0.52"/>
  `
}

// ── Map ───────────────────────────────────────────────────────────────────────

const SYMBOLS: Record<IconShape, (c: string) => string> = {
  strike:      iconStrike,
  slash:       iconSlash,
  fireball:    iconFireball,
  overload:    iconOverload,
  counter:     iconCounter,
  fuse:        iconFuse,
  leech:       iconLeech,
  absorb:      iconAbsorb,
  ward:        iconWard,
  vulnerable:  iconVulnerable,
  poison:      iconPoison,
  weak:        iconWeak,
  hp:          iconHp,
  cascade:     iconCascade,
  efficiency:  iconEfficiency,
}

// ── Public API ────────────────────────────────────────────────────────────────

// Bare symbol SVG — no badge background, no glow. For inline use within
// styled containers (status pills, text runs) where the context provides color.
export function buildStatusIcon(shape: IconShape, color: number, size = 14): string {
  const c = hex(color)
  return `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg"
    style="display:inline-block;width:${size}px;height:${size}px;vertical-align:-2px;flex-shrink:0">${SYMBOLS[shape](c)}</svg>`
}

// Returns a self-contained SVG string ready to be dropped into innerHTML.
// CSS drop-shadow on the SVG element provides the glow — no SVG filter IDs
// needed, which avoids conflicts when multiple copies of a card are on screen.
// The radialGradient background does need a unique ID, generated here.
export function buildIcon(shape: IconShape, color: number): string {
  const c  = hex(color)
  const bg = `ic${_id++}-bg`

  return `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg"
    style="display:block;width:100%;height:100%;filter:drop-shadow(0 0 4px ${c}88)">
  <defs>
    <radialGradient id="${bg}" cx="50%" cy="50%" r="50%">
      <stop offset="0%"   stop-color="${c}" stop-opacity="0.22"/>
      <stop offset="100%" stop-color="${c}" stop-opacity="0.04"/>
    </radialGradient>
  </defs>
  <circle cx="20" cy="20" r="19"   fill="url(#${bg})"/>
  <circle cx="20" cy="20" r="18.5" fill="none" stroke="${c}" stroke-width="0.8" opacity="0.3"/>
  ${SYMBOLS[shape](c)}
</svg>`
}

// Generative art field for a card's art window — a bespoke energy motif per card
// shape, in the card's colour. The card's glyph is layered OVER this via CSS (not
// embedded here), so there's no nested SVG.
export function cardArt(shape: IconShape, color: number, type: 'attack' | 'defend'): string {
  const c   = hex(color)
  const gid = 'ca' + (_id++)
  const cx  = 50, cy = 33
  const P   = (a: number, r: number) => `${(cx + Math.cos(a) * r).toFixed(1)},${(cy + Math.sin(a) * r).toFixed(1)}`
  const TAU = Math.PI * 2

  let motif: string
  switch (shape) {
    case 'strike':   // sharp shards bursting outward
      motif = Array.from({ length: 9 }, (_, i) => {
        const a = (i / 9) * TAU + 0.2, r2 = 30 + ((i * 5) % 14), sp = 0.085
        return `<polygon points="${P(a - sp, 15)} ${P(a, r2)} ${P(a + sp, 15)}" fill="${c}" opacity="${(0.08 + ((i * 3) % 4) * 0.045).toFixed(3)}"/>`
      }).join('')
      break
    case 'slash':    // sweeping arc trails of motion
      motif = Array.from({ length: 4 }, (_, i) => {
        const r = 14 + i * 7, a0 = 2.0 - i * 0.18, a1 = a0 + 2.5
        return `<path d="M ${P(a0, r)} A ${r} ${r} 0 0 1 ${P(a1, r)}" stroke="${c}" stroke-width="${(2.6 - i * 0.45).toFixed(1)}" fill="none" stroke-linecap="round" opacity="${(0.32 - i * 0.05).toFixed(2)}"/>`
      }).join('')
      break
    case 'fireball': // rising flame tongues + embers
      motif = Array.from({ length: 7 }, (_, i) => {
        const x = 22 + i * 9, h = 11 + ((i * 7) % 15), w = 4, by = cy + 17
        return `<path d="M ${x} ${by} Q ${(x - w).toFixed(1)} ${(by - h * 0.55).toFixed(1)} ${x} ${(by - h).toFixed(1)} Q ${(x + w).toFixed(1)} ${(by - h * 0.55).toFixed(1)} ${x} ${by} Z" fill="${c}" opacity="${(0.10 + ((i * 3) % 4) * 0.045).toFixed(3)}"/>`
      }).join('') + Array.from({ length: 5 }, (_, i) =>
        `<circle cx="${24 + ((i * 23) % 54)}" cy="${10 + ((i * 13) % 14)}" r="${(0.8 + (i % 2) * 0.6).toFixed(1)}" fill="${c}" opacity="${(0.25 + (i % 3) * 0.1).toFixed(2)}"/>`).join('')
      break
    case 'overload': // jagged lightning cracks radiating
      motif = Array.from({ length: 6 }, (_, i) => {
        const a = (i / 6) * TAU + 0.4
        return `<polyline points="${P(a, 13)} ${P(a + 0.2, 24)} ${P(a - 0.05, 34)}" stroke="${c}" stroke-width="1.3" fill="none" stroke-linejoin="round" stroke-linecap="round" opacity="${(0.16 + ((i * 2) % 3) * 0.06).toFixed(2)}"/>`
      }).join('')
      break
    case 'counter':  // paired parabolic shields redirecting into a hinge
      motif = Array.from({ length: 4 }, (_, i) => {
        const inset = i * 5
        return `<path d="M ${10 + inset} ${54 - inset * 0.35} Q 50 ${5 + inset * 0.45} ${90 - inset} ${54 - inset * 0.35}" fill="none" stroke="${c}" stroke-width="${(2.2 - i * 0.32).toFixed(1)}" opacity="${(0.3 - i * 0.045).toFixed(2)}"/>`
      }).join('') + `<circle cx="50" cy="16" r="4.5" fill="${c}" opacity="0.35"/><circle cx="50" cy="16" r="1.8" fill="#fff" opacity="0.7"/>`
      break
    case 'fuse':     // charged nodes and leads collapsing into one detonation
      motif = Array.from({ length: 6 }, (_, i) => {
        const a = (i / 6) * TAU - Math.PI / 2
        const outer = P(a, 34), inner = P(a + 0.13, 9)
        return `<line x1="${outer.split(',')[0]}" y1="${outer.split(',')[1]}" x2="${inner.split(',')[0]}" y2="${inner.split(',')[1]}" stroke="${c}" stroke-width="1.4" opacity="0.22"/><circle cx="${outer.split(',')[0]}" cy="${outer.split(',')[1]}" r="3.1" fill="${c}" opacity="0.24"/>`
      }).join('') + `<circle cx="${cx}" cy="${cy}" r="10" fill="none" stroke="${c}" stroke-width="2" opacity="0.36"/><circle cx="${cx}" cy="${cy}" r="4" fill="#fff" opacity="0.36"/>`
      break
    case 'leech':    // two currents spiral inward around a suspended drop
      motif = Array.from({ length: 4 }, (_, i) => {
        const r = 14 + i * 5
        return `<path d="M ${P(2.7 + i * 0.08, r)} Q ${35 - i * 2} ${8 + i * 2} ${P(5.7 - i * 0.08, r)}" fill="none" stroke="${c}" stroke-width="${(2.4 - i * 0.35).toFixed(1)}" stroke-linecap="round" opacity="${(0.3 - i * 0.045).toFixed(2)}"/>`
      }).join('') + `<path d="M 50 16 C 57 26 58 34 50 41 C 42 34 43 26 50 16 Z" fill="${c}" opacity="0.2"/>`
      break
    case 'absorb':   // concentric protective rings drawn inward
      motif = Array.from({ length: 5 }, (_, i) =>
        `<circle cx="${cx}" cy="${cy}" r="${(11 + i * 6.5).toFixed(1)}" fill="none" stroke="${c}" stroke-width="1.1" opacity="${(0.32 - i * 0.055).toFixed(2)}"/>`).join('')
      break
    case 'ward':     // nested hexagonal barriers
      motif = Array.from({ length: 3 }, (_, i) => {
        const r = 13 + i * 8
        const pts = Array.from({ length: 6 }, (_, k) => P((k / 6) * TAU - Math.PI / 2, r)).join(' ')
        return `<polygon points="${pts}" fill="none" stroke="${c}" stroke-width="1.3" opacity="${(0.3 - i * 0.07).toFixed(2)}"/>`
      }).join('')
      break
    default:
      motif = type === 'defend'
        ? Array.from({ length: 5 }, (_, i) => `<circle cx="${cx}" cy="${cy}" r="${(11 + i * 6.5).toFixed(1)}" fill="none" stroke="${c}" stroke-width="1.1" opacity="${(0.3 - i * 0.05).toFixed(2)}"/>`).join('')
        : Array.from({ length: 9 }, (_, i) => { const a = (i / 9) * TAU; return `<polygon points="${P(a - 0.1, 15)} ${P(a, 30)} ${P(a + 0.1, 15)}" fill="${c}" opacity="0.12"/>` }).join('')
  }

  const motes = Array.from({ length: 5 }, (_, i) => {
    const x = 13 + ((i * 41) % 74), y = 7 + ((i * 23) % 50), r = 0.6 + (i % 2) * 0.6
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}" opacity="${(0.16 + (i % 3) * 0.09).toFixed(2)}"/>`
  }).join('')

  return `<svg viewBox="0 0 100 66" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg"
    style="display:block;width:100%;height:100%">
  <defs><radialGradient id="${gid}" cx="50%" cy="48%" r="65%">
    <stop offset="0%"   stop-color="${c}" stop-opacity="0.34"/>
    <stop offset="52%"  stop-color="${c}" stop-opacity="0.09"/>
    <stop offset="100%" stop-color="#05050d" stop-opacity="0"/>
  </radialGradient></defs>
  <rect width="100" height="66" fill="#070711"/>
  <rect width="100" height="66" fill="url(#${gid})"/>
  <g class="ca-motif ca-${shape}">${motif}</g>
  <g class="ca-motes">${motes}</g>
</svg>`
}
