import * as THREE from 'three'
import type { PlayerClass } from '../data/classes.js'
import type { RingPath } from '../data/progression.js'
import type { UnitRegalia, UnitVisual } from '../data/visuals.js'
import {
  buildAuthoredUnitArt,
  disposeAuthoredUnitArt,
  poseAuthoredUnit,
  resetAuthoredUnitPose,
  updateAuthoredUnitArt,
} from './units/registry.js'
import type { AuthoredUnitRuntime, UnitPose } from './units/types.js'

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
  _eyeScale: THREE.Vector3                // identity-specific resting eye proportions
  _bodyScale: THREE.Vector3               // form's resting core scale (so hit-squash restores it)
  _trophyPivot: THREE.Group               // persistent earned trophy rings (slowly revolves)
  _identityPivot: THREE.Group             // snack-specific silhouette detail, independent of combat form
  _regaliaPivot: THREE.Group              // doctrine-specific battlefield trim, independent of combat form
  _authoredRuntime: AuthoredUnitRuntime | null
  identity: UnitVisual
  regalia: UnitRegalia
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
  if (unit._authoredRuntime) {
    disposeAuthoredUnitArt(unit._authoredRuntime)
    unit._authoredRuntime = null
  }
  unit.form = form
  disposeExtras(unit)
  unit.body.geometry.dispose()
  unit.body.scale.set(1, 1, 1)   // reset; forms below re-stretch if they want to

  const { bodyMat, accentMat, body, armL, armR } = unit
  bodyMat.roughness = 0.22; bodyMat.metalness = 0.12
  bodyMat.transparent = false; bodyMat.opacity = 1; bodyMat.depthWrite = true
  accentMat.roughness = 0.12; accentMat.metalness = 0.65
  unit.head.visible = true
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
  unit._eyeScale.copy(unit.eye.scale)
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

  const identityPivot = new THREE.Group(); identityPivot.position.y = CORE_Y
  group.add(identityPivot)

  const regaliaPivot = new THREE.Group(); regaliaPivot.position.y = CORE_Y
  group.add(regaliaPivot)

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
    _eyeScale: new THREE.Vector3(1, 1, 1),
    _bodyScale: new THREE.Vector3(1, 1, 1),
    _trophyPivot: trophyPivot,
    _identityPivot: identityPivot,
    _regaliaPivot: regaliaPivot,
    _authoredRuntime: null,
    identity: 'none',
    regalia: 'none',
  }

  setForm(unit, form)
  return unit
}

function disposeIdentity(unit: Unit) {
  const geometries = new Set<THREE.BufferGeometry>()
  const materials = new Set<THREE.Material>()
  const identityMaterials = unit._identityPivot.userData.identityMaterials as THREE.Material[] | undefined
  for (const material of identityMaterials ?? []) materials.add(material)
  unit._identityPivot.traverse(node => {
    if (!(node instanceof THREE.Mesh)) return
    geometries.add(node.geometry)
    const meshMaterials = Array.isArray(node.material) ? node.material : [node.material]
    for (const material of meshMaterials) {
      if (material !== unit.bodyMat && material !== unit.accentMat) materials.add(material)
    }
  })
  unit._identityPivot.clear()
  delete unit._identityPivot.userData.identityMaterials
  geometries.forEach(geometry => geometry.dispose())
  materials.forEach(material => material.dispose())
}

function disposeRegalia(unit: Unit) {
  const geometries = new Set<THREE.BufferGeometry>()
  const materials = new Set<THREE.Material>()
  const regaliaMaterials = unit._regaliaPivot.userData.regaliaMaterials as THREE.Material[] | undefined
  for (const material of regaliaMaterials ?? []) materials.add(material)
  unit._regaliaPivot.traverse(node => {
    if (!(node instanceof THREE.Mesh)) return
    geometries.add(node.geometry)
    const meshMaterials = Array.isArray(node.material) ? node.material : [node.material]
    for (const material of meshMaterials) materials.add(material)
  })
  unit._regaliaPivot.clear()
  delete unit._regaliaPivot.userData.regaliaMaterials
  geometries.forEach(geometry => geometry.dispose())
  materials.forEach(material => material.dispose())
}

function identityMaterial(color: number, options: { metalness?: number; roughness?: number; glow?: number } = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: options.glow ?? 0.16,
    metalness: options.metalness ?? 0.12,
    roughness: options.roughness ?? 0.28,
  })
}

function identityMesh(
  root: THREE.Object3D,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  position: [number, number, number],
  rotation: [number, number, number] = [0, 0, 0],
  scale: [number, number, number] = [1, 1, 1],
) {
  const mesh = new THREE.Mesh(geometry, material)
  mesh.position.set(...position)
  mesh.rotation.set(...rotation)
  mesh.scale.set(...scale)
  mesh.castShadow = true
  root.add(mesh)
  return mesh
}

function identityTube(root: THREE.Object3D, points: [number, number, number][], radius: number, material: THREE.Material) {
  const curve = new THREE.CatmullRomCurve3(points.map(point => new THREE.Vector3(...point)), false, 'centripetal')
  return identityMesh(root, new THREE.TubeGeometry(curve, 32, radius, 7, false), material, [0, 0, 0])
}

function addCrimpedEnds(root: THREE.Object3D, material: THREE.Material, spread = 0.5) {
  const endGeo = new THREE.ConeGeometry(0.19, 0.32, 4)
  for (const side of [-1, 1]) {
    identityMesh(root, endGeo, material, [side * spread, 0, -0.04], [0, 0, side * Math.PI / 2], [1, 0.72, 0.3])
  }
}

export function setUnitIdentity(unit: Unit, identity: UnitVisual) {
  if (unit._authoredRuntime) setForm(unit, unit.form)
  disposeIdentity(unit)
  unit.identity = identity

  const authored = buildAuthoredUnitArt(unit, identity)
  if (authored) {
    disposeExtras(unit)
    unit._authoredRuntime = authored
    unit._bodyScale.copy(unit.body.scale)
    unit._eyeScale.copy(unit.eye.scale)
    return
  }

  const root = unit._identityPivot
  const { bodyMat, accentMat } = unit
  const rind = identityMaterial(0x4ade80, { glow: 0.22, roughness: 0.42 })
  const sugar = identityMaterial(0xfff7ed, { glow: 0.46, roughness: 0.5 })
  const foil = identityMaterial(0xdbeafe, { metalness: 0.9, roughness: 0.16, glow: 0.3 })
  root.userData.identityMaterials = [rind, sugar, foil]

  switch (identity) {
    case 'cherry-brick': {
      const cherry = identityMaterial(0xff3145, { glow: 0.34, roughness: 0.26 })
      root.userData.identityMaterials.push(cherry)
      const lobe = new THREE.SphereGeometry(0.33, 14, 12)
      identityMesh(root, lobe, cherry, [-0.3, -0.05, -0.06], [0, 0.16, 0])
      identityMesh(root, lobe, cherry, [0.3, -0.05, -0.06], [0, -0.16, 0])
      identityMesh(root, new THREE.TorusGeometry(0.47, 0.032, 6, 28), accentMat, [0, -0.12, 0.04], [1.28, 0, 0])
      identityMesh(root, new THREE.ConeGeometry(0.13, 0.4, 4), rind, [0.13, 0.48, -0.05], [0, 0, -0.65], [0.8, 1, 0.35])
      break
    }
    case 'citrus-burst': {
      const citrus = identityMaterial(0xffa300, { glow: 0.35, roughness: 0.3 })
      root.userData.identityMaterials.push(citrus)
      identityMesh(root, new THREE.TorusGeometry(0.48, 0.035, 8, 32), citrus, [0, 0, 0.3])
      const segment = new THREE.BoxGeometry(0.018, 0.33, 0.025)
      for (let i = 0; i < 6; i++) identityMesh(root, segment, citrus, [0, 0, 0.305], [0, 0, (i / 6) * Math.PI])
      identityMesh(root, new THREE.ConeGeometry(0.13, 0.22, 5), rind, [0, 0.48, -0.08], [0, 0, Math.PI], [1, 0.72, 0.42])
      break
    }
    case 'sour-ribbon': {
      const sour = identityMaterial(0xb9f227, { glow: 0.34, roughness: 0.34 })
      root.userData.identityMaterials.push(sour)
      identityTube(root, [[-0.55, 0.38, -0.12], [-0.22, 0.1, -0.2], [0.18, -0.42, -0.18], [0.58, -0.58, -0.1]], 0.095, sour)
      const crystal = new THREE.OctahedronGeometry(0.052, 0)
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2
        identityMesh(root, crystal, sugar, [Math.cos(a) * 0.42, Math.sin(a) * 0.34, 0.12])
      }
      break
    }
    case 'crimped-wrapper': {
      identityMesh(root, new THREE.BoxGeometry(0.76, 0.4, 0.14), bodyMat, [0, 0, -0.08])
      addCrimpedEnds(root, foil, 0.5)
      identityMesh(root, new THREE.BoxGeometry(0.58, 0.045, 0.035), accentMat, [0, 0, 0.2])
      break
    }
    case 'violet-crinkle': {
      identityMesh(root, new THREE.BoxGeometry(0.6, 0.33, 0.12), bodyMat, [0, 0, -0.08])
      addCrimpedEnds(root, accentMat, 0.42)
      for (const y of [-0.1, 0.1]) identityMesh(root, new THREE.BoxGeometry(0.44, 0.026, 0.03), foil, [0, y, 0.16])
      break
    }
    case 'sachet': {
      identityMesh(root, new THREE.BoxGeometry(0.64, 0.76, 0.12), bodyMat, [0, 0, -0.08])
      identityMesh(root, new THREE.BoxGeometry(0.48, 0.06, 0.035), accentMat, [0, 0.23, 0.16])
      identityMesh(root, new THREE.ConeGeometry(0.09, 0.15, 3), foil, [0, 0.43, -0.02], [0, 0, Math.PI], [1, 0.55, 0.3])
      break
    }
    case 'flash-seal': {
      const shard = new THREE.TetrahedronGeometry(0.27, 0)
      for (const a of [0.2, 2.3, 4.4]) identityMesh(root, shard, accentMat, [Math.cos(a) * 0.39, Math.sin(a) * 0.39, -0.1], [a, a * 0.5, a], [0.7, 1.4, 0.42])
      identityMesh(root, new THREE.OctahedronGeometry(0.3, 0), foil, [0, 0, -0.18], [0.5, 0.2, 0])
      break
    }
    case 'hard-seal': {
      identityMesh(root, new THREE.CylinderGeometry(0.46, 0.46, 0.16, 12), bodyMat, [0, 0, -0.16], [Math.PI / 2, 0, 0])
      identityMesh(root, new THREE.TorusGeometry(0.38, 0.038, 8, 24), accentMat, [0, 0, 0.02])
      identityMesh(root, new THREE.BoxGeometry(0.5, 0.055, 0.04), foil, [0, -0.26, 0.12])
      break
    }
    case 'blank-pack': {
      identityMesh(root, new THREE.BoxGeometry(0.72, 0.62, 0.16), bodyMat, [0, 0, -0.08])
      identityMesh(root, new THREE.BoxGeometry(0.45, 0.25, 0.025), foil, [0, 0, 0.12])
      identityMesh(root, new THREE.BoxGeometry(0.34, 0.025, 0.03), accentMat, [0, -0.13, 0.15])
      break
    }
    case 'hard-set': {
      for (const y of [-0.2, 0, 0.2]) identityMesh(root, new THREE.BoxGeometry(0.7, 0.1, 0.2), bodyMat, [0, y, -0.1])
      identityMesh(root, new THREE.TorusGeometry(0.39, 0.025, 4, 20), accentMat, [0, 0, 0.02], [0.9, 0, 0.3])
      break
    }
    case 'hard-chew': {
      identityTube(root, [[-0.4, -0.34, -0.08], [-0.12, 0.34, 0.03], [0.16, -0.28, 0.06], [0.42, 0.34, -0.08]], 0.09, accentMat)
      identityTube(root, [[-0.4, 0.31, -0.11], [-0.12, -0.3, 0.02], [0.16, 0.3, 0.05], [0.42, -0.27, -0.1]], 0.055, foil)
      break
    }
    case 'brick-bite': {
      const slab = new THREE.BoxGeometry(0.72, 0.15, 0.24)
      for (const y of [-0.21, 0, 0.21]) identityMesh(root, slab, bodyMat, [0, y, -0.1], [0, 0, y * 0.45])
      identityMesh(root, new THREE.BoxGeometry(0.62, 0.04, 0.035), accentMat, [0, 0.27, 0.11])
      break
    }
    case 'rind-wall': {
      identityMesh(root, new THREE.CylinderGeometry(0.53, 0.53, 0.11, 16), bodyMat, [0, 0, -0.18], [Math.PI / 2, 0, 0])
      identityMesh(root, new THREE.TorusGeometry(0.45, 0.055, 8, 28), accentMat, [0, 0, -0.11])
      for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) identityMesh(root, new THREE.SphereGeometry(0.05, 8, 8), foil, [Math.cos(a) * 0.34, Math.sin(a) * 0.34, -0.08])
      break
    }
    case 'gummy-vault': {
      identityMesh(root, new THREE.CylinderGeometry(0.48, 0.48, 0.16, 14), bodyMat, [0, 0, -0.16], [Math.PI / 2, 0, 0])
      identityMesh(root, new THREE.TorusGeometry(0.36, 0.025, 8, 22), accentMat, [0, 0, -0.06])
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2
        identityMesh(root, new THREE.SphereGeometry(0.048, 8, 8), foil, [Math.cos(a) * 0.31, Math.sin(a) * 0.31, -0.04])
      }
      break
    }
    case 'the-block': {
      identityMesh(root, new THREE.BoxGeometry(0.84, 0.58, 0.28), bodyMat, [0, 0, -0.1])
      for (const y of [-0.18, 0.18]) identityMesh(root, new THREE.BoxGeometry(0.9, 0.045, 0.04), accentMat, [0, y, 0.08])
      identityMesh(root, new THREE.BoxGeometry(0.06, 0.6, 0.04), foil, [0, 0, 0.1])
      break
    }
    case 'last-drop': {
      identityMesh(root, new THREE.SphereGeometry(0.31, 14, 12), bodyMat, [0, -0.02, -0.08], [0, 0, 0], [0.82, 1.35, 0.82])
      identityMesh(root, new THREE.SphereGeometry(0.095, 10, 8), accentMat, [0.24, 0.4, -0.05], [0, 0, 0], [0.8, 1.6, 0.8])
      identityMesh(root, new THREE.TorusGeometry(0.33, 0.018, 6, 20), foil, [0, -0.02, 0.16], [1.1, 0, 0])
      break
    }
    case 'juice-bloom': {
      const drop = new THREE.SphereGeometry(0.1, 10, 8)
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2
        identityMesh(root, drop, accentMat, [Math.cos(a) * 0.38, Math.sin(a) * 0.38, -0.02], [0, 0, 0], [0.75, 1.45, 0.75])
      }
      identityMesh(root, new THREE.SphereGeometry(0.13, 10, 8), sugar, [0, 0, 0.17])
      break
    }
    case 'refill-cartridge': {
      identityMesh(root, new THREE.CylinderGeometry(0.28, 0.28, 0.72, 12), bodyMat, [0, 0, -0.1])
      identityMesh(root, new THREE.CylinderGeometry(0.32, 0.32, 0.07, 12), accentMat, [0, 0.34, -0.1])
      identityMesh(root, new THREE.TorusGeometry(0.25, 0.024, 6, 20), foil, [0, -0.1, 0.18], [Math.PI / 2, 0, 0])
      break
    }
    case 'licorice-tangle': {
      identityTube(root, [[-0.44, -0.26, -0.1], [-0.12, 0.43, -0.15], [0.18, -0.34, -0.1], [0.42, 0.25, -0.08]], 0.066, bodyMat)
      identityTube(root, [[-0.42, 0.27, -0.05], [-0.1, -0.37, 0.05], [0.17, 0.36, 0.02], [0.45, -0.22, -0.05]], 0.05, accentMat)
      break
    }
    case 'the-gulp': {
      identityMesh(root, new THREE.TorusGeometry(0.42, 0.1, 10, 28), bodyMat, [0, -0.03, 0.04], [0.12, 0, 0])
      identityMesh(root, new THREE.TorusGeometry(0.28, 0.036, 8, 22), accentMat, [0, -0.03, 0.13])
      for (const x of [-0.18, 0.18]) identityMesh(root, new THREE.SphereGeometry(0.06, 8, 8), sugar, [x, 0.34, 0.02])
      break
    }
    case 'the-flood': {
      identityTube(root, [[-0.56, -0.3, -0.1], [-0.22, 0.22, 0.02], [0.08, -0.18, 0.02], [0.52, 0.33, -0.1]], 0.085, accentMat)
      identityTube(root, [[-0.48, 0.15, -0.14], [-0.12, -0.1, -0.05], [0.23, 0.25, -0.04], [0.54, -0.04, -0.12]], 0.045, foil)
      break
    }
    case 'original': {
      identityMesh(root, new THREE.TorusGeometry(0.62, 0.024, 6, 30), accentMat, [0, 0, -0.08], [1.05, 0.35, 0])
      identityMesh(root, new THREE.OctahedronGeometry(0.16, 0), foil, [0, 0.52, -0.03], [0.3, 0.2, 0])
      break
    }
  }
}

export function setUnitRegalia(unit: Unit, regalia: UnitRegalia, color: number) {
  disposeRegalia(unit)
  unit.regalia = regalia
  if (unit._authoredRuntime) return
  const root = unit._regaliaPivot
  const trim = identityMaterial(color, { metalness: 0.7, roughness: 0.2, glow: 0.38 })
  const foil = identityMaterial(0xf8fafc, { metalness: 0.92, roughness: 0.12, glow: 0.26 })
  root.userData.regaliaMaterials = [trim, foil]

  switch (regalia) {
    case 'fruit-front': {
      const tab = new THREE.ConeGeometry(0.12, 0.32, 4)
      identityMesh(root, new THREE.TorusGeometry(0.48, 0.018, 6, 24), trim, [0, -0.02, -0.16], [1.18, 0, 0])
      identityMesh(root, tab, trim, [-0.34, 0.28, -0.08], [0, 0, -0.72], [0.72, 1, 0.35])
      identityMesh(root, tab, trim, [0.34, 0.28, -0.08], [0, 0, 0.72], [0.72, 1, 0.35])
      break
    }
    case 'sealed': {
      identityMesh(root, new THREE.TorusGeometry(0.61, 0.022, 8, 32), foil, [0, 0, 0.08], [0.25, 0, 0])
      const stamp = new THREE.BoxGeometry(0.11, 0.11, 0.05)
      for (const a of [0.4, 1.9, 3.4, 4.9]) {
        identityMesh(root, stamp, trim, [Math.cos(a) * 0.54, Math.sin(a) * 0.54, 0.09], [0, 0, a], [1, 1, 1])
      }
      break
    }
    case 'hard-set': {
      const plate = new THREE.BoxGeometry(0.2, 0.24, 0.11)
      for (const x of [-0.5, 0.5]) identityMesh(root, plate, trim, [x, 0.04, 0.12], [0, x * -0.32, 0], [1, 1, 1])
      identityMesh(root, new THREE.BoxGeometry(0.62, 0.055, 0.045), foil, [0, 0.38, 0.1])
      break
    }
    case 'refilling': {
      const drop = new THREE.SphereGeometry(0.075, 10, 8)
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + 0.35
        identityMesh(root, drop, trim, [Math.cos(a) * 0.52, Math.sin(a) * 0.42, 0.08], [0, 0, 0], [0.8, 1.5, 0.8])
      }
      identityMesh(root, new THREE.TorusGeometry(0.46, 0.017, 6, 24), foil, [0, -0.05, 0.06], [1.38, 0, 0])
      break
    }
    case 'original': {
      identityMesh(root, new THREE.TorusGeometry(0.65, 0.022, 6, 32), trim, [0, 0.08, -0.16], [0.88, 0.28, 0])
      for (const x of [-0.23, 0, 0.23]) identityMesh(root, new THREE.TetrahedronGeometry(0.1, 0), foil, [x, 0.58 - Math.abs(x) * 0.35, 0.02])
      break
    }
  }
}

export function updateUnitIdentity(unit: Unit, t: number) {
  if (unit._authoredRuntime) {
    updateAuthoredUnitArt(unit._authoredRuntime, t, unit._eyePhase)
    return
  }
  const pivot = unit._identityPivot
  pivot.rotation.set(0, 0, 0)
  pivot.position.y = CORE_Y

  if (unit.identity === 'sour-ribbon' || unit.identity === 'licorice-tangle' || unit.identity === 'the-flood') {
    pivot.rotation.z = Math.sin(t * 2.1 + unit._eyePhase) * 0.075
    pivot.rotation.y = Math.sin(t * 0.9 + unit._eyePhase) * 0.12
  } else if (unit.identity === 'crimped-wrapper' || unit.identity === 'violet-crinkle' || unit.identity === 'flash-seal') {
    pivot.rotation.z = Math.sin(t * 2.6 + unit._eyePhase) * 0.05
  } else if (unit.identity === 'citrus-burst' || unit.identity === 'juice-bloom' || unit.identity === 'last-drop') {
    pivot.rotation.y = t * 0.38
  } else if (unit.identity === 'the-gulp' || unit.identity === 'refill-cartridge') {
    pivot.position.y += Math.sin(t * 1.6 + unit._eyePhase) * 0.025
  }
}

export function updateUnitRegalia(unit: Unit, t: number) {
  if (unit._authoredRuntime) return
  const pivot = unit._regaliaPivot
  pivot.position.y = CORE_Y
  pivot.rotation.set(0, 0, 0)
  if (unit.regalia === 'fruit-front') {
    pivot.rotation.z = Math.sin(t * 1.8 + unit._eyePhase) * 0.045
  } else if (unit.regalia === 'sealed') {
    pivot.rotation.y = t * 0.42
  } else if (unit.regalia === 'hard-set') {
    pivot.position.y += Math.sin(t * 1.5 + unit._eyePhase) * 0.025
  } else if (unit.regalia === 'refilling') {
    pivot.rotation.y = -t * 0.3
    pivot.position.y += Math.sin(t * 2.2 + unit._eyePhase) * 0.035
  } else if (unit.regalia === 'original') {
    pivot.rotation.y = t * 0.22
  }
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
  if (unit._authoredRuntime) {
    unit.body.add(holder)
  } else {
    holder.position.y = CORE_Y
    unit.group.add(holder)
  }
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

  unit.eye.scale.set(unit._eyeScale.x, unit._eyeScale.y * baseY, unit._eyeScale.z)
}

// Momentary eye poses for action beats.
export function eyeNarrow(unit: Unit) { unit.eye.scale.y = unit._eyeScale.y * 0.4 }
export function eyeWiden(unit: Unit)  { unit.eye.scale.y = unit._eyeScale.y * 1.35 }

export function isAuthoredUnit(unit: Unit) {
  return unit._authoredRuntime !== null
}

export function poseUnit(unit: Unit, pose: UnitPose, progress: number, direction = 1) {
  if (unit._authoredRuntime) poseAuthoredUnit(unit._authoredRuntime, pose, progress, direction)
}

export function resetUnitPose(unit: Unit) {
  if (unit._authoredRuntime) resetAuthoredUnitPose(unit._authoredRuntime)
}
