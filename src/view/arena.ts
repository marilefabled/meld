import * as THREE from 'three'
import type { EnemyDef } from '../data/encounters.js'

export type ArenaKind = 'wrapper-archive' | 'press-floor' | 'syrup-works' | 'original-shelf'

export interface ArenaProfile {
  kind: ArenaKind
  label: string
  floor: number
  grid: number
  ring: number
  dust: number
  fog: number
  light: number
}

const ARENAS: Record<ArenaKind, Omit<ArenaProfile, 'kind'>> = {
  'wrapper-archive': {
    label: 'WRAPPER ARCHIVE',
    floor: 0x111022,
    grid: 0x4c3b78,
    ring: 0xc4b5fd,
    dust: 0xe9d5ff,
    fog: 0x0c0a1a,
    light: 0x8b5cf6,
  },
  'press-floor': {
    label: 'THE PRESS FLOOR',
    floor: 0x24102f,
    grid: 0x2d91b4,
    ring: 0xffd43b,
    dust: 0xff9fca,
    fog: 0x13091b,
    light: 0xff4f9a,
  },
  'syrup-works': {
    label: 'SYRUP WORKS',
    floor: 0x07152e,
    grid: 0xa83282,
    ring: 0x48e6df,
    dust: 0xffd85c,
    fog: 0x030a18,
    light: 0xff4f9a,
  },
  'original-shelf': {
    label: 'THE ORIGINAL SHELF',
    floor: 0x11091d,
    grid: 0x574078,
    ring: 0xc4b5fd,
    dust: 0xddd6fe,
    fog: 0x0b0613,
    light: 0x8b5cf6,
  },
}

export function arenaForEncounter(def: EnemyDef, isFinale = false): ArenaProfile {
  const primaryTrait = def.traits?.[0]?.kind
  const kind: ArenaKind = isFinale
    ? 'original-shelf'
    : primaryTrait === 'immune'
      ? 'wrapper-archive'
      : primaryTrait === 'armored'
        ? 'press-floor'
        : 'syrup-works'
  return { kind, ...ARENAS[kind] }
}

type Motion = {
  object: THREE.Object3D
  axis: 'x' | 'y' | 'scale-y' | 'rotation-y' | 'rotation-z'
  mode: 'sine' | 'loop' | 'press' | 'drip'
  base: number
  speed: number
  amount: number
  phase: number
}

export interface ArenaDressing {
  set: (profile: ArenaProfile) => void
  update: (time: number) => void
  dispose: () => void
}

export function createArenaDressing(scene: THREE.Scene): ArenaDressing {
  const root = new THREE.Group()
  root.name = 'court-arena-dressing'
  scene.add(root)

  const geometries = new Set<THREE.BufferGeometry>()
  const materials = new Set<THREE.Material>()
  let motions: Motion[] = []

  function material(color: number, options: { metalness?: number; roughness?: number; emissive?: number; opacity?: number } = {}) {
    const mat = new THREE.MeshStandardMaterial({
      color,
      emissive: options.emissive ?? color,
      emissiveIntensity: options.emissive == null ? 0.08 : 0.22,
      metalness: options.metalness ?? 0.18,
      roughness: options.roughness ?? 0.42,
      transparent: options.opacity != null,
      opacity: options.opacity ?? 1,
      depthWrite: options.opacity == null || options.opacity >= 1,
    })
    materials.add(mat)
    return mat
  }

  function basic(color: number, opacity = 1) {
    const mat = new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, depthWrite: opacity >= 1 })
    materials.add(mat)
    return mat
  }

  function mesh(
    geometry: THREE.BufferGeometry,
    mat: THREE.Material,
    position: [number, number, number],
    scale: [number, number, number] = [1, 1, 1],
    rotation: [number, number, number] = [0, 0, 0],
    parent: THREE.Object3D = root,
    name = '',
  ) {
    geometries.add(geometry)
    const object = new THREE.Mesh(geometry, mat)
    object.position.set(...position)
    object.scale.set(...scale)
    object.rotation.set(...rotation)
    object.castShadow = true
    object.receiveShadow = true
    object.name = name
    parent.add(object)
    return object
  }

  function motion(object: THREE.Object3D, axis: Motion['axis'], base: number, speed: number, amount: number, phase = 0, mode: Motion['mode'] = 'sine') {
    motions.push({ object, axis, mode, base, speed, amount, phase })
  }

  function practical(color: number, position: [number, number, number], intensity = 1.2, distance = 6) {
    const light = new THREE.PointLight(color, intensity, distance)
    light.position.set(...position)
    root.add(light)
  }

  function clear() {
    root.clear()
    geometries.forEach(geometry => geometry.dispose())
    materials.forEach(mat => mat.dispose())
    geometries.clear()
    materials.clear()
    motions = []
  }

  function buildWrapperArchive(profile: ArenaProfile) {
    const wrapper = material(0x513c82, { metalness: 0.58, roughness: 0.26, emissive: 0x513c82 })
    const foil = material(profile.ring, { metalness: 0.92, roughness: 0.14, emissive: profile.ring })
    const seal = material(0x201632, { metalness: 0.4, roughness: 0.35 })
    const packageGeo = new THREE.BoxGeometry(0.92, 0.38, 0.22)
    const crimpGeo = new THREE.ConeGeometry(0.12, 0.26, 4)
    practical(profile.light, [-4.2, 2.0, -3.0], 1.45, 5.5)
    practical(profile.ring, [4.2, 2.0, -3.0], 1.45, 5.5)

    for (const side of [-1, 1]) {
      for (let row = 0; row < 3; row++) {
        const y = 0.36 + row * 0.46
        const pack = mesh(packageGeo, wrapper, [side * (4.3 - row * 0.18), y, -3.65 - row * 0.2], [1, 1, 1], [0, side * 0.22, 0])
        motion(pack, 'rotation-z', 0, 0.7 + row * 0.12, 0.035, row + side)
        for (const edge of [-1, 1]) {
          mesh(crimpGeo, foil, [side * (4.3 - row * 0.18) + edge * 0.55, y, -3.65 - row * 0.2], [0.72, 0.7, 0.32], [0, 0, edge * Math.PI / 2])
        }
      }
    }

    const rail = mesh(new THREE.BoxGeometry(8.8, 0.1, 0.1), basic(profile.ring, 0.9), [0, 2.35, -4.15])
    motion(rail, 'y', 2.35, 0.7, 0.045)
    for (const x of [-3.2, -1.1, 1.1, 3.2]) {
      mesh(new THREE.BoxGeometry(0.06, 1.9, 0.06), seal, [x, 1.2, -4.1])
    }
  }

  function buildPressFloor(profile: ArenaProfile) {
    const frame = material(0xeb3e8f, { metalness: 0.34, roughness: 0.28, emissive: 0x7a173f })
    const steel = material(0x64d7ec, { metalness: 0.72, roughness: 0.2, emissive: 0x164e63 })
    const platenMat = material(profile.ring, { metalness: 0.48, roughness: 0.24, emissive: profile.ring })
    const belt = material(0x19122b, { metalness: 0.2, roughness: 0.7 })
    const berry = material(0xff587c, { roughness: 0.34, emissive: 0x7f163b })
    const citrus = material(0xffad32, { roughness: 0.32, emissive: 0x7c3a08 })
    const warning = basic(0xfff0a0, 0.92)

    practical(profile.light, [-4.2, 2.0, -2.7], 1.9, 7)
    practical(0x55d9f3, [4.1, 1.4, -2.6], 1.55, 6)
    practical(profile.ring, [0, 2.6, -3.6], 1.35, 5.5)

    // A bright stamping line across the back wall. The slats loop continuously,
    // so the room has industrial direction instead of decorative oscillation.
    mesh(new THREE.BoxGeometry(9.2, 0.16, 1.22), belt, [0, 0.12, -3.05])
    mesh(new THREE.BoxGeometry(9.35, 0.12, 0.1), steel, [0, 0.24, -2.48])
    mesh(new THREE.BoxGeometry(9.35, 0.12, 0.1), steel, [0, 0.24, -3.62])
    for (let i = 0; i < 12; i++) {
      const slat = mesh(
        new THREE.BoxGeometry(0.48, 0.08, 0.96),
        i % 3 === 0 ? warning : steel,
        [0, 0.24, -3.05],
        [1, 1, 1],
        [0, 0, 0],
        root,
        i === 0 ? 'court-conveyor-slat' : '',
      )
      motion(slat, 'x', 0, 0.105, 8.5, i / 12, 'loop')
    }

    // Product moves through the line as very simple, toy-bright candy blocks.
    for (let i = 0; i < 5; i++) {
      const block = mesh(new THREE.BoxGeometry(0.72, 0.42, 0.68), i % 2 ? citrus : berry, [0, 0.49, -3.05], [1, 1, 1], [0, 0, i % 2 ? 0.08 : -0.06])
      motion(block, 'x', 0, 0.055, 8.2, i / 5 + 0.08, 'loop')
    }

    // The central press is the room's silhouette. It drops quickly, holds, then
    // releases slowly: a machine cycle rather than another sine wave.
    for (const side of [-1, 1]) {
      mesh(new THREE.BoxGeometry(0.5, 3.3, 0.52), frame, [side * 3.15, 1.72, -4.02])
      mesh(new THREE.CylinderGeometry(0.2, 0.2, 1.55, 12), steel, [side * 1.42, 2.47, -3.82])
      mesh(new THREE.SphereGeometry(0.13, 10, 8), platenMat, [side * 3.15, 3.43, -3.72])
    }
    mesh(new THREE.BoxGeometry(6.8, 0.5, 0.62), frame, [0, 3.32, -4.02])
    const platen = mesh(
      new THREE.BoxGeometry(3.75, 0.34, 1.02),
      platenMat,
      [0, 2.35, -3.78],
      [1, 1, 1],
      [0, 0, 0],
      root,
      'court-press-platen',
    )
    motion(platen, 'y', 2.35, 0.24, 1.35, 0, 'press')

    // Flattened offcuts make the childish material explicit without softening
    // the composition: this is still a factory floor preparing for combat.
    for (const side of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        const chip = mesh(
          new THREE.BoxGeometry(0.72 - i * 0.08, 0.12, 0.48),
          i % 2 ? berry : citrus,
          [side * (4.05 + i * 0.18), 0.16 + i * 0.1, -1.75 - i * 0.28],
          [1, 1, 1],
          [0.05 * i, side * 0.16, side * (0.08 + i * 0.05)],
        )
        motion(chip, 'rotation-z', chip.rotation.z, 0.55, 0.018, side + i)
      }
    }
  }

  function buildSyrupWorks(profile: ArenaProfile) {
    const frame = material(0x244d86, { metalness: 0.62, roughness: 0.24, emissive: 0x102b52 })
    const glass = material(0x6cf6ef, { metalness: 0.18, roughness: 0.12, emissive: 0x1b7d82, opacity: 0.34 })
    const syrupPink = material(0xff4f9f, { metalness: 0.04, roughness: 0.2, emissive: 0xff4f9f, opacity: 0.82 })
    const syrupGold = material(0xffd43b, { metalness: 0.05, roughness: 0.22, emissive: 0xffa51f, opacity: 0.86 })
    const tube = material(profile.ring, { metalness: 0.74, roughness: 0.16, emissive: profile.ring })

    practical(profile.light, [-4.1, 2.0, -2.7], 1.8, 7)
    practical(profile.ring, [4.1, 2.0, -2.7], 1.65, 7)
    practical(0xffd43b, [0, 2.75, -3.5], 1.2, 5)

    // Twin reserves flank the battlefield. Their liquid levels breathe while
    // bubbles rise continuously through the transparent candy-glass shells.
    for (const side of [-1, 1]) {
      const x = side * 4.1
      mesh(new THREE.CylinderGeometry(0.92, 0.98, 2.35, 18, 1, true), glass, [x, 1.35, -3.62])
      mesh(new THREE.CylinderGeometry(1.03, 1.03, 0.18, 18), frame, [x, 0.18, -3.62])
      mesh(new THREE.CylinderGeometry(1.03, 1.03, 0.18, 18), frame, [x, 2.52, -3.62])
      const level = mesh(
        new THREE.CylinderGeometry(0.78, 0.84, 1.45, 18),
        side < 0 ? syrupPink : syrupGold,
        [x, 0.95, -3.62],
        [1, 1, 1],
        [0, 0, 0],
        root,
        side < 0 ? 'court-syrup-level' : '',
      )
      motion(level, 'scale-y', 1, 0.58, 0.055, side)
      mesh(new THREE.TorusGeometry(0.94, 0.055, 8, 30), tube, [x, 1.34, -3.62], [1, 1, 1], [Math.PI / 2, 0, 0])

      for (let i = 0; i < 4; i++) {
        const bubble = mesh(new THREE.SphereGeometry(0.075 + i * 0.012, 10, 8), side < 0 ? syrupGold : syrupPink, [x + (i - 1.5) * 0.24, 1.25, -3.1])
        motion(bubble, 'y', 1.3, 0.18 + i * 0.018, 1.65, i / 4 + (side < 0 ? 0 : 0.12), 'loop')
      }
    }

    // A single overhead manifold joins both reserves. The deliberately simple
    // shapes read like a toy refinery; the severe framing makes it military.
    const pipeCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-4.1, 2.56, -3.62),
      new THREE.Vector3(-2.25, 3.18, -3.92),
      new THREE.Vector3(0, 3.22, -4.0),
      new THREE.Vector3(2.25, 3.18, -3.92),
      new THREE.Vector3(4.1, 2.56, -3.62),
    ])
    mesh(new THREE.TubeGeometry(pipeCurve, 52, 0.095, 9, false), tube, [0, 0, 0])
    mesh(new THREE.BoxGeometry(3.9, 0.26, 0.5), frame, [0, 2.67, -3.82])

    for (const side of [-1, 1]) {
      mesh(new THREE.CylinderGeometry(0.16, 0.16, 1.2, 12), tube, [side * 1.25, 2.05, -3.68])
      const pump = mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.42, 12), side < 0 ? syrupPink : syrupGold, [side * 1.25, 1.5, -3.68])
      motion(pump, 'y', 1.5, 1.35, 0.16, side)
    }

    // Metered drips fall from the center into luminous floor catchments.
    for (let i = 0; i < 3; i++) {
      const x = (i - 1) * 0.48
      const drop = mesh(
        new THREE.SphereGeometry(0.09 + i * 0.012, 10, 8),
        i === 1 ? syrupGold : syrupPink,
        [x, 2.4, -3.48],
        [0.78, 1.55, 0.78],
        [0, 0, 0],
        root,
        i === 0 ? 'court-syrup-drop' : '',
      )
      motion(drop, 'y', 2.4, 0.34, 2.05, i / 3, 'drip')
      const catchment = mesh(new THREE.TorusGeometry(0.32 + i * 0.06, 0.028, 7, 24), i === 1 ? syrupGold : syrupPink, [x, 0.035, -3.48], [1, 0.72, 1], [Math.PI / 2, 0, 0])
      motion(catchment, 'rotation-y', 0, 0.55, 0.24, i)
    }

    // Side channels bring the liquid language forward without crossing the
    // card area or the two combat silhouettes.
    for (const side of [-1, 1]) {
      const channel = new THREE.CatmullRomCurve3([
        new THREE.Vector3(side * 4.2, 0.04, -2.8),
        new THREE.Vector3(side * 4.5, 0.04, -1.8),
        new THREE.Vector3(side * 4.1, 0.04, -0.75),
      ])
      mesh(new THREE.TubeGeometry(channel, 24, 0.045, 7, false), side < 0 ? syrupPink : syrupGold, [0, 0, 0])
    }
  }

  function buildOriginalShelf(profile: ArenaProfile) {
    const frame = material(0x2e1d48, { metalness: 0.78, roughness: 0.2 })
    const glass = material(profile.ring, { metalness: 0.86, roughness: 0.1, emissive: profile.ring, opacity: 0.42 })
    practical(profile.light, [0, 2.4, -3.3], 1.75, 7)
    for (const x of [-2.4, 0, 2.4]) {
      const slab = mesh(new THREE.BoxGeometry(0.9, 3.1, 0.08), glass, [x, 1.8, -4.0], [1, 1, 1], [0, x * 0.12, 0])
      mesh(new THREE.BoxGeometry(1.1, 0.1, 0.16), frame, [x, 3.35, -4.0])
      mesh(new THREE.BoxGeometry(1.1, 0.1, 0.16), frame, [x, 0.25, -4.0])
      motion(slab, 'rotation-y', x * 0.12, 0.45, 0.12, x)
    }
  }

  function set(profile: ArenaProfile) {
    clear()
    if (profile.kind === 'wrapper-archive') buildWrapperArchive(profile)
    else if (profile.kind === 'press-floor') buildPressFloor(profile)
    else if (profile.kind === 'syrup-works') buildSyrupWorks(profile)
    else buildOriginalShelf(profile)
  }

  function update(time: number) {
    for (const item of motions) {
      const cycle = ((time * item.speed + item.phase) % 1 + 1) % 1
      let value = item.base + Math.sin(time * item.speed + item.phase) * item.amount
      if (item.mode === 'loop') value = item.base + (cycle - 0.5) * item.amount
      else if (item.mode === 'drip') value = item.base - cycle * item.amount
      else if (item.mode === 'press') {
        const smooth = (p: number) => p * p * (3 - 2 * p)
        const compression = cycle < 0.12
          ? smooth(cycle / 0.12)
          : cycle < 0.48
            ? 1
            : cycle < 0.78
              ? 1 - smooth((cycle - 0.48) / 0.3)
              : 0
        value = item.base - compression * item.amount
      }
      if (item.axis === 'x') item.object.position.x = value
      else if (item.axis === 'y') item.object.position.y = value
      else if (item.axis === 'scale-y') item.object.scale.y = value
      else if (item.axis === 'rotation-y') item.object.rotation.y = value
      else item.object.rotation.z = value
    }
  }

  function dispose() {
    clear()
    root.removeFromParent()
  }

  return { set, update, dispose }
}
