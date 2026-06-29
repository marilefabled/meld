import * as THREE from 'three'
import type { PlayerClass } from '../data/classes.js'
import type { RingPath } from '../data/progression.js'

// ── The Meld Form — a luminous core with held orbital rings, and an eye ───────
// A form is not a body: it's a glowing core, two orbiting rings (the held aspects
// of identity), a floating micro-orb (presence), and a single expressive EYE that
// gives it a mood — it blinks, drifts, narrows when it strikes, widens when hit.
//
// The SILHOUETTE varies by form kind so each archetype reads at a glance:
//   block    — armoured: squat, banded, heavy        (Bulwark enemies)
//   crystal  — immune:   faceted, sealed, shielded    (Purifier enemies)
//   bloom    — regen:    petalled, organic, opening    (Renewer enemies)
//   warrior  — player:   solid, grounded, guard-ring
//   wisp     — player:   tall, ethereal, trailing      (mage)
//   blade    — player:   sharp, asymmetric, finned      (rogue)
//   meld     — the Mirror finale: an echoed violet self
//   orb      — fallback: the original plain core
//
//   body  — core mesh (the identity; carries bodyMat, squashes/flashes on hit)
//   armL  — ring A pivot (large; fireball/block/heal animations)
//   armR  — ring B pivot (smaller; strike animations)
//   legL/legR — aliases of armL/armR (legacy names battle.ts still uses)
//   head  — micro-orb pivot (idle bob)
//   eye   — eye assembly, parented to body so it moves/squashes with the core

export const CORE_Y = 1.1    // resting Y position of the core
export const GLOW   = 0.12   // resting emissive intensity of the core

export type FormKind =
  | 'orb' | 'block' | 'crystal' | 'bloom'
  | 'warrior' | 'wisp' | 'blade' | 'meld'

export interface Unit {
  group:     THREE.Group
  body:      THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>
  head:      THREE.Group
  armL:      THREE.Group
  armR:      THREE.Group
  legL:      THREE.Group
  legR:      THREE.Group
  bodyMat:   THREE.MeshStandardMaterial
  accentMat: THREE.MeshStandardMaterial
  visorMat:  THREE.MeshStandardMaterial   // = accentMat — kept for enterEncounter compat
  eye:       THREE.Group                  // eye assembly (blink/drift/mood)
  pupil:     THREE.Mesh                   // dark pupil (look direction / dilation)
  eyeMat:    THREE.MeshStandardMaterial
  pupilMat:  THREE.MeshStandardMaterial
  form:      FormKind
  _ringA:    THREE.Mesh                   // ring mesh inside armL (geometry swapped per form)
  _ringB:    THREE.Mesh                   // ring mesh inside armR
  _extra:    THREE.Object3D[]             // form-specific feature meshes (disposed on re-form)
  _eyePhase: number                       // per-unit blink/drift phase
  _bodyScale: THREE.Vector3               // form's resting core scale (so hit-squash restores it)
  _trophyPivot: THREE.Group               // persistent earned trophy rings (slowly revolves)
}

// Player class → form, enemy archetype trait → form. Kept here so callers map cleanly.
export const CLASS_FORM: Record<string, FormKind> = {
  warrior: 'warrior', mage: 'wisp', rogue: 'blade',
}
export const TRAIT_FORM: Record<string, FormKind> = {
  armored: 'block', immune: 'crystal', regen: 'bloom',
}

function disposeExtras(unit: Unit) {
  for (const o of unit._extra) {
    o.parent?.remove(o)
    o.traverse(n => { if ((n as THREE.Mesh).geometry) (n as THREE.Mesh).geometry.dispose() })
  }
  unit._extra = []
}

// A radiating feature pivot: yaw around the core, lean outward, child offset out.
function petal(geo: THREE.BufferGeometry, mat: THREE.Material, angle: number, lean: number, out: number): THREE.Group {
  const pivot = new THREE.Group()
  pivot.rotation.y = angle
  pivot.rotation.z = lean
  const m = new THREE.Mesh(geo, mat)
  m.position.y = out
  pivot.add(m)
  return pivot
}

// Reshape an existing unit to a new form: swaps body geometry, ring geometry/tilt,
// feature meshes, and eye placement. Materials are preserved (so recolouring an
// enemy via bodyMat/accentMat still works across a form change).
export function setForm(unit: Unit, form: FormKind) {
  unit.form = form
  disposeExtras(unit)
  unit.body.geometry.dispose()
  unit.body.scale.set(1, 1, 1)   // reset; forms below re-stretch if they want to

  const { bodyMat, accentMat, body, armL, armR } = unit
  let eyeZ = 0.4      // where the eye sits on the core front (local +Z)
  let eyeScale = 1

  const add = (o: THREE.Object3D) => { body.add(o); unit._extra.push(o) }

  switch (form) {
    case 'block': {                                  // armoured — squat, banded, heavy
      body.geometry = new THREE.BoxGeometry(0.66, 0.58, 0.62)
      ;(body.geometry as THREE.BufferGeometry).computeVertexNormals?.()
      unit._ringA.geometry.dispose(); unit._ringA.geometry = new THREE.TorusGeometry(0.58, 0.07, 8, 28)
      unit._ringB.geometry.dispose(); unit._ringB.geometry = new THREE.TorusGeometry(0.5, 0.055, 8, 24)
      armL.rotation.x = 1.45; armR.rotation.x = 1.5; armR.rotation.y = 0.4
      // riveted shoulder studs
      const stud = new THREE.SphereGeometry(0.1, 8, 8)
      for (const sx of [-1, 1]) {
        const s = new THREE.Mesh(stud, accentMat); s.position.set(sx * 0.34, 0.16, 0); add(s)
      }
      eyeZ = 0.34; eyeScale = 1.15
      break
    }
    case 'crystal': {                                // immune — faceted, sealed, shielded
      body.geometry = new THREE.OctahedronGeometry(0.5, 0)
      unit._ringA.geometry.dispose(); unit._ringA.geometry = new THREE.TorusGeometry(0.66, 0.03, 6, 36, Math.PI * 1.2)
      unit._ringB.geometry.dispose(); unit._ringB.geometry = new THREE.TorusGeometry(0.46, 0.022, 5, 28)
      armL.rotation.x = 0.5; armR.rotation.x = 1.3; armR.rotation.y = 0.9
      // a standing shield arc in front
      const arc = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.05, 6, 18, Math.PI), accentMat)
      arc.rotation.z = -Math.PI / 2; arc.position.z = 0.28; add(arc)
      eyeZ = 0.36; eyeScale = 0.85
      break
    }
    case 'bloom': {                                  // regen — petalled, organic, opening
      body.geometry = new THREE.SphereGeometry(0.26, 18, 14)
      unit._ringA.geometry.dispose(); unit._ringA.geometry = new THREE.TorusGeometry(0.6, 0.018, 5, 36)
      unit._ringB.geometry.dispose(); unit._ringB.geometry = new THREE.TorusGeometry(0.44, 0.014, 5, 28)
      armL.rotation.x = 0.7; armR.rotation.x = 1.1; armR.rotation.y = 1.0
      const petalGeo = new THREE.SphereGeometry(0.14, 10, 8)
      const tipGeo   = new THREE.SphereGeometry(0.055, 8, 6)
      for (let i = 0; i < 6; i++) {
        const pivot = new THREE.Group()
        pivot.rotation.y = (i / 6) * Math.PI * 2
        pivot.rotation.z = 0.78                         // splay open like a flower
        const petalMesh = new THREE.Mesh(petalGeo, bodyMat)
        petalMesh.position.y = 0.36; petalMesh.scale.set(0.62, 2.4, 0.62)
        const tip = new THREE.Mesh(tipGeo, accentMat)
        tip.position.y = 0.66                           // glowing accent at the petal's edge
        pivot.add(petalMesh); pivot.add(tip); add(pivot)
      }
      eyeZ = 0.24; eyeScale = 0.95
      break
    }
    case 'warrior': {                                // player — solid, grounded, guard-ring
      body.geometry = new THREE.IcosahedronGeometry(0.46, 0)
      unit._ringA.geometry.dispose(); unit._ringA.geometry = new THREE.TorusGeometry(0.62, 0.05, 8, 30)
      unit._ringB.geometry.dispose(); unit._ringB.geometry = new THREE.TorusGeometry(0.5, 0.03, 6, 24)
      armL.rotation.x = 1.3; armR.rotation.x = 0.7; armR.rotation.y = 0.6
      eyeZ = 0.4; eyeScale = 1.1
      break
    }
    case 'wisp': {                                   // player mage — tall, ethereal, trailing
      body.geometry = new THREE.SphereGeometry(0.4, 18, 16)
      body.scale.set(0.8, 1.45, 0.8)
      unit._ringA.geometry.dispose(); unit._ringA.geometry = new THREE.TorusGeometry(0.5, 0.022, 5, 32)
      unit._ringB.geometry.dispose(); unit._ringB.geometry = new THREE.TorusGeometry(0.4, 0.018, 5, 28)
      armL.rotation.x = 0.15; armR.rotation.x = 0.2; armR.rotation.y = 1.1
      // (the trailing sparks are now an absorbed-mage MARK, not part of the base form)
      eyeZ = 0.34; eyeScale = 1.05
      break
    }
    case 'blade': {                                  // player rogue — sharp, asymmetric, finned
      body.geometry = new THREE.OctahedronGeometry(0.46, 0)
      body.scale.set(0.85, 1.2, 0.7)
      unit._ringA.geometry.dispose(); unit._ringA.geometry = new THREE.TorusGeometry(0.58, 0.02, 4, 24)
      unit._ringB.geometry.dispose(); unit._ringB.geometry = new THREE.TorusGeometry(0.42, 0.016, 4, 20)
      armL.rotation.x = 0.9; armR.rotation.x = 1.4; armR.rotation.y = 0.5
      // (the blade fins are now an absorbed-rogue MARK, not part of the base form)
      eyeZ = 0.32; eyeScale = 0.8
      break
    }
    case 'meld': {                                   // mirror finale — echoed violet self
      body.geometry = new THREE.OctahedronGeometry(0.46, 0)
      unit._ringA.geometry.dispose(); unit._ringA.geometry = new THREE.TorusGeometry(0.64, 0.025, 6, 36)
      unit._ringB.geometry.dispose(); unit._ringB.geometry = new THREE.TorusGeometry(0.5, 0.025, 6, 30)
      armL.rotation.x = 0.6; armR.rotation.x = 1.2; armR.rotation.y = 1.05
      // a faint echo of the core, offset back
      const echo = new THREE.Mesh(new THREE.OctahedronGeometry(0.5, 0), accentMat)
      echo.position.set(0, 0, -0.18); echo.scale.setScalar(1.05); add(echo)
      eyeZ = 0.4; eyeScale = 1
      break
    }
    default: {                                       // 'orb' — original plain core
      body.geometry = new THREE.SphereGeometry(0.42, 22, 16)
      unit._ringA.geometry.dispose(); unit._ringA.geometry = new THREE.TorusGeometry(0.62, 0.032, 6, 40)
      unit._ringB.geometry.dispose(); unit._ringB.geometry = new THREE.TorusGeometry(0.5, 0.022, 5, 32)
      armL.rotation.x = 0.6; armR.rotation.x = 1.2; armR.rotation.y = 1.05
      eyeZ = 0.4; eyeScale = 1
    }
  }

  unit.eye.position.set(0, 0.04, eyeZ)
  unit.eye.scale.setScalar(eyeScale)
  unit._bodyScale.copy(unit.body.scale)   // remember resting stretch for hit-squash restore
  unit._ringA.visible = true              // rings shown by default (enemies); the player
  unit._ringB.visible = true              // gates these by run progress in setPlayerForm
}

export function buildUnit(color: number, accent: number, form: FormKind = 'orb'): Unit {
  const group = new THREE.Group()

  const bodyMat = new THREE.MeshStandardMaterial({
    color, roughness: 0.22, metalness: 0.12,
    emissive: color, emissiveIntensity: GLOW,
  })
  const accentMat = new THREE.MeshStandardMaterial({
    color: accent, roughness: 0.12, metalness: 0.65,
    emissive: accent, emissiveIntensity: 0.45,
  })

  // ── Core mesh (geometry set by setForm) ────────────────────────────────────
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.42, 22, 16), bodyMat) as Unit['body']
  body.position.y = CORE_Y
  body.castShadow = true
  group.add(body)

  // ── Secondary micro-orb (presence) ─────────────────────────────────────────
  const head = new THREE.Group()
  head.position.y = 1.62
  head.add(new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), bodyMat))
  group.add(head)

  // ── Ring pivots (geometry set by setForm) ──────────────────────────────────
  const armL = new THREE.Group(); armL.position.y = CORE_Y
  const ringA = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.032, 6, 40), accentMat)
  armL.add(ringA); group.add(armL)

  const armR = new THREE.Group(); armR.position.y = CORE_Y
  const ringB = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.022, 5, 32), accentMat)
  armR.add(ringB); group.add(armR)

  // Persistent earned trophy rings live in their own slowly-revolving pivot
  const trophyPivot = new THREE.Group(); trophyPivot.position.y = CORE_Y
  group.add(trophyPivot)

  // ── Eye (parented to body so it moves & squashes with the core) ────────────
  const eye = new THREE.Group()
  const eyeMat = new THREE.MeshStandardMaterial({
    color: 0xf4f6ff, roughness: 0.3, metalness: 0,
    emissive: 0xdfe6ff, emissiveIntensity: 0.55,
  })
  const pupilMat = new THREE.MeshStandardMaterial({
    color: 0x0a0a14, roughness: 0.5, metalness: 0,
    emissive: 0x000000, emissiveIntensity: 0,
  })
  const white = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 12), eyeMat)
  white.scale.set(1, 1, 0.55)
  const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.062, 12, 10), pupilMat)
  pupil.position.z = 0.06
  eye.add(white); eye.add(pupil)
  body.add(eye)

  const unit: Unit = {
    group, body, head, armL, armR, legL: armL, legR: armR,
    bodyMat, accentMat, visorMat: accentMat,
    eye, pupil, eyeMat, pupilMat, form,
    _ringA: ringA, _ringB: ringB, _extra: [], _eyePhase: 0,
    _bodyScale: new THREE.Vector3(1, 1, 1),
    _trophyPivot: trophyPivot,
  }

  setForm(unit, form)
  return unit
}

// ── Marks — what the player becomes is written on the body ────────────────────
// The player starts plain: just their base class's silhouette. Each absorbed
// essence grafts a visible MARK (mage → trailing sparks, rogue → blade fins,
// warrior → shoulder pauldrons). Deepening (powerLevel) doesn't add shape — it
// intensifies: brighter rings and faint halo rings. So you can read a player's
// whole journey off their form.

function markWarrior(accent: THREE.Material): THREE.Object3D[] {
  // angular shoulder pauldrons
  const geo = new THREE.BoxGeometry(0.2, 0.1, 0.24)
  return [-1, 1].map(sx => {
    const m = new THREE.Mesh(geo, accent)
    m.position.set(sx * 0.36, 0.15, 0.02)
    m.rotation.z = sx * -0.3
    return m
  })
}
function markMage(accent: THREE.Material): THREE.Object3D[] {
  // trailing spark orbs that drift below the core
  const geo = new THREE.SphereGeometry(0.07, 8, 8)
  return [0, 1, 2].map(i => {
    const s = new THREE.Mesh(geo, accent)
    s.position.set((i - 1) * 0.16, -0.52 - i * 0.13, 0.02)
    return s
  })
}
function markRogue(accent: THREE.Material): THREE.Object3D[] {
  // sharp blade fins jutting up and out
  const geo = new THREE.TetrahedronGeometry(0.2, 0)
  return [0.7, 2.4].map(a => {
    const f = petal(geo, accent, a, 1.0, 0.36)
    ;(f.children[0] as THREE.Mesh).scale.set(0.5, 1.6, 0.3)
    return f
  })
}

const MARK_BUILDERS: Record<PlayerClass, (m: THREE.Material) => THREE.Object3D[]> = {
  warrior: markWarrior, mage: markMage, rogue: markRogue,
}

// Graft absorbed-class marks + deepening intensity onto a unit whose base form is
// already set. Marks live in an undistorted holder at core height (so a stretched
// base like the wisp doesn't warp them), tracked in _extra so the next setForm
// disposes them.
export function applyMarks(unit: Unit, absorbed: PlayerClass[], depth: number) {
  if (!absorbed.length && depth <= 0) { unit.accentMat.emissiveIntensity = 0.45; return }

  const holder = new THREE.Group()
  holder.position.y = CORE_Y
  unit.group.add(holder)
  unit._extra.push(holder)

  for (const cls of absorbed) {
    const build = MARK_BUILDERS[cls]
    if (build) for (const o of build(unit.accentMat)) holder.add(o)
  }

  // Deepening reads as intensity, not clutter: the held aspects glow a little
  // brighter, and each level adds a TIGHT inner orbital tucked at the core's waist
  // — smaller than the base rings, so it never outlines the silhouette or competes
  // with the absorbed marks (which carry the story of what you've become).
  const d = Math.max(0, depth)
  unit.accentMat.emissiveIntensity = 0.45 + d * 0.16
  for (let i = 0; i < Math.min(d, 2); i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.4 + i * 0.06, 0.01, 4, 36), unit.accentMat)
    ring.rotation.x = 1.25 + i * 0.35   // near-horizontal — sits at the waist, not around the whole body
    ring.rotation.y = i * 0.9
    ring.position.y = -0.05 - i * 0.07
    holder.add(ring)
  }
}

// ── Rings as earned regalia ───────────────────────────────────────────────────
// The orbital rings are no longer free scenery. The two animated base rings are
// gated by run progress (ringCount: 0 on the first run, growing as runs clear).
// Trophy rings — earned by winning full campaigns — are persistent and coloured
// by the class you won as, shaped by the path you took (absorb vs deepen).

const CLASS_RING_COLOR: Record<PlayerClass, number> = {
  warrior: 0xf87171,   // crimson — the striker
  mage:    0xfbbf24,   // amber — the caster
  rogue:   0x34d399,   // green — the bleeder
}

function clearTrophies(unit: Unit) {
  for (const o of unit._trophyPivot.children.slice()) {
    unit._trophyPivot.remove(o)
    o.traverse(n => { if ((n as THREE.Mesh).geometry) (n as THREE.Mesh).geometry.dispose() })
  }
}

// A trophy ring: 'deepen' → one thick bright band; 'absorb' → a thinner ring strung
// with small beads (the essences you took in). Tilted by index so they layer.
function buildTrophyRing(cls: PlayerClass, path: RingPath, index: number): THREE.Group {
  const color = CLASS_RING_COLOR[cls] ?? 0xffffff
  const mat = new THREE.MeshStandardMaterial({
    color, emissive: color, emissiveIntensity: 0.7, roughness: 0.25, metalness: 0.6,
  })
  const pivot = new THREE.Group()
  pivot.rotation.x = 0.55 + index * 0.6
  pivot.rotation.z = index * 0.5

  if (path === 'deepen') {
    pivot.add(new THREE.Mesh(new THREE.TorusGeometry(0.68, 0.05, 8, 40), mat))
  } else {
    const r = 0.7
    pivot.add(new THREE.Mesh(new THREE.TorusGeometry(r, 0.02, 6, 40), mat))
    const beadGeo = new THREE.SphereGeometry(0.06, 8, 8)
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2
      const bead = new THREE.Mesh(beadGeo, mat)
      bead.position.set(Math.cos(a) * r, Math.sin(a) * r, 0)
      pivot.add(bead)
    }
  }
  return pivot
}

export type Trophy = { cls: PlayerClass; path: RingPath }

// Replace a unit's trophy rings (used by the player, and by the Mirror finale so
// your reflection wears the rings you won).
export function applyTrophies(unit: Unit, trophies: Trophy[]) {
  clearTrophies(unit)
  trophies.forEach((t, i) => unit._trophyPivot.add(buildTrophyRing(t.cls, t.path, i)))
}

// Parse persisted `${class}-${path}` ids into trophies (silently skips malformed).
export function parseTrophies(ids: string[]): Trophy[] {
  const out: Trophy[] = []
  for (const id of ids) {
    const [cls, path] = id.split('-')
    if ((cls === 'warrior' || cls === 'mage' || cls === 'rogue') && (path === 'absorb' || path === 'deepen')) {
      out.push({ cls, path })
    }
  }
  return out
}

// Build the player's full form: plain base silhouette + absorbed marks + deepening
// intensity + earned rings. ringCount gates the two animated base rings (0 = the
// plain first-run form); trophies add persistent earned rings in their own pivot.
export function setPlayerForm(
  unit: Unit, baseClass: PlayerClass,
  absorbed: PlayerClass[] = [], depth = 0,
  ringCount = 0, trophies: Trophy[] = [],
) {
  setForm(unit, CLASS_FORM[baseClass] ?? 'orb')
  applyMarks(unit, absorbed, depth)

  // Campaign rings earned this run (the original Saturn rings, now gated)
  unit._ringA.visible = ringCount >= 1
  unit._ringB.visible = ringCount >= 2

  // Persistent trophy rings from past full victories
  applyTrophies(unit, trophies)
}

// Idle eye life — blink, slow drift, mood tint. Call each frame when not in an
// action animation. `mood` lightly colours/poses the eye for status states.
export function updateEye(unit: Unit, t: number, mood: 'none' | 'poison' | 'vulnerable' | 'weak' = 'none') {
  const ph = unit._eyePhase
  // Blink: a quick lid close every ~3.4s, staggered per unit.
  const cycle = (t * 0.29 + ph) % 1
  const lid = cycle > 0.965 ? Math.max(0.08, 1 - (cycle - 0.965) / 0.0175 * 2) : 1
  // Slow look-drift.
  const dx = Math.sin(t * 0.7 + ph * 6.28) * 0.018
  const dy = Math.sin(t * 0.53 + ph * 3.1) * 0.012

  let baseY = lid
  unit.pupil.position.x = dx
  unit.pupil.position.y = dy

  if (mood === 'poison') { baseY = lid * 0.85; unit.eyeMat.emissive.setHex(0xc4b5fd) }
  else if (mood === 'vulnerable') { baseY = lid * 0.8; unit.eyeMat.emissive.setHex(0xfca5a5) }
  else if (mood === 'weak') { baseY = lid * 0.78; unit.eyeMat.emissive.setHex(0xfde68a) }
  else unit.eyeMat.emissive.setHex(0xdfe6ff)

  unit.eye.scale.y = (unit.eye.scale.x) * baseY   // keep aspect from form's eyeScale (x)
}

// Momentary eye poses for action beats.
export function eyeNarrow(unit: Unit) { unit.eye.scale.y = unit.eye.scale.x * 0.4 }
export function eyeWiden(unit: Unit)  { unit.eye.scale.y = unit.eye.scale.x * 1.35 }
