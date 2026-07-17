import * as THREE from 'three'
import type { UnitVisual } from '../../data/visuals.js'
import type {
  AuthoredUnitRuntime,
  AuthoredUnitTarget,
  PartTransform,
  UnitArtBuildContext,
  UnitArtDefinition,
  UnitPose,
} from './types.js'

const PROOF_VISUALS = ['cherry-brick', 'citrus-burst', 'sour-ribbon', 'crimped-wrapper', 'hard-set', 'last-drop'] as const
type ProofVisual = typeof PROOF_VISUALS[number]

function emptyGeometry() {
  return new THREE.BufferGeometry()
}

function tube(points: [number, number, number][], radius: number, segments = 40) {
  const curve = new THREE.CatmullRomCurve3(
    points.map(point => new THREE.Vector3(...point)),
    false,
    'centripetal',
  )
  return new THREE.TubeGeometry(curve, segments, radius, 8, false)
}

function buildCherryBrick({ target, setBody, addGroup, addMesh, makeMaterial, setEye }: UnitArtBuildContext) {
  setBody(emptyGeometry())
  target.bodyMat.color.setHex(0xf52f57)
  target.bodyMat.emissive.setHex(0xf52f57)
  target.bodyMat.roughness = 0.3
  target.bodyMat.metalness = 0.02
  target.accentMat.color.setHex(0xffd43b)
  target.accentMat.emissive.setHex(0xffd43b)

  const rig = addGroup('rig')
  const left = addGroup('left-lobe', rig)
  const right = addGroup('right-lobe', rig)
  addMesh('left-mass', new THREE.SphereGeometry(0.43, 18, 14), target.bodyMat, [-0.31, -0.03, 0], [0, 0, 0.08], [1.05, 0.9, 0.92], left)
  addMesh('right-mass', new THREE.SphereGeometry(0.43, 18, 14), target.bodyMat, [0.31, -0.03, 0], [0, 0, -0.08], [1.05, 0.9, 0.92], right)
  addMesh('bridge', new THREE.BoxGeometry(0.38, 0.34, 0.48), target.bodyMat, [0, -0.06, -0.02], [0, 0, Math.PI / 4], [1, 1, 0.86], rig)

  const rind = makeMaterial(0x55d94f, { roughness: 0.46, glow: 0.12 })
  const stem = addGroup('stem', rig)
  addMesh('stem-shaft', new THREE.CylinderGeometry(0.045, 0.06, 0.52, 7), rind, [0.04, 0.48, -0.04], [0, 0, -0.26], [1, 1, 1], stem)
  addMesh('leaf', new THREE.SphereGeometry(0.16, 10, 7), rind, [0.22, 0.65, -0.03], [0, 0, -0.6], [1.6, 0.42, 0.28], stem)

  const shine = makeMaterial(0xffd8df, { roughness: 0.22, glow: 0.38 })
  addMesh('left-shine', new THREE.SphereGeometry(0.085, 9, 7), shine, [-0.45, 0.13, 0.34], [0, 0, 0], [0.55, 1.2, 0.22], left)
  addMesh('right-shine', new THREE.SphereGeometry(0.075, 9, 7), shine, [0.18, 0.15, 0.38], [0, 0, 0], [0.5, 1.1, 0.22], right)
  setEye([0.31, -0.02, 0.4], [1.16, 0.86, 0.72], [0.82, 1, 0.75])
}

function buildCitrusBurst({ target, setBody, addGroup, addMesh, makeMaterial, setEye }: UnitArtBuildContext) {
  setBody(emptyGeometry())
  target.bodyMat.color.setHex(0xff9818)
  target.bodyMat.emissive.setHex(0xff9818)
  target.bodyMat.roughness = 0.25
  target.bodyMat.metalness = 0.01
  target.accentMat.color.setHex(0xffef70)
  target.accentMat.emissive.setHex(0xffef70)

  const rig = addGroup('rig')
  const slice = addGroup('slice', rig)
  const disc = new THREE.CylinderGeometry(0.56, 0.56, 0.28, 16)
  disc.rotateX(Math.PI / 2)
  addMesh('fruit', disc, target.bodyMat, [0, -0.01, 0], [0, 0, 0], [1, 1, 1], slice)

  const rind = makeMaterial(0xffc928, { roughness: 0.34, glow: 0.3 })
  addMesh('rind', new THREE.TorusGeometry(0.535, 0.055, 8, 32), rind, [0, -0.01, 0.17], [0, 0, 0], [1, 1, 0.72], slice)
  const spokeGeo = new THREE.BoxGeometry(0.035, 0.45, 0.035)
  const spokes = addGroup('spokes', slice)
  for (let i = 0; i < 8; i++) {
    addMesh(`spoke-${i}`, spokeGeo.clone(), target.accentMat, [0, -0.01, 0.195], [0, 0, (i / 8) * Math.PI], [1, 1, 0.8], spokes)
  }
  addMesh('pith', new THREE.SphereGeometry(0.09, 10, 8), target.accentMat, [0, -0.01, 0.21], [0, 0, 0], [1, 1, 0.42], spokes)

  const leafMat = makeMaterial(0x4ed84a, { roughness: 0.5, glow: 0.1 })
  const leaf = addGroup('leaf', rig)
  addMesh('leaf-shape', new THREE.SphereGeometry(0.16, 10, 7), leafMat, [0.1, 0.58, -0.05], [0, 0, -0.42], [1.5, 0.38, 0.25], leaf)
  setEye([0.17, -0.08, 0.28], [0.92, 0.82, 0.7], [0.82, 1, 0.78])
}

function buildSourRibbon({ target, setBody, addGroup, addMesh, makeMaterial, setEye }: UnitArtBuildContext) {
  setBody(emptyGeometry())
  target.bodyMat.color.setHex(0xa9ed35)
  target.bodyMat.emissive.setHex(0xa9ed35)
  target.bodyMat.roughness = 0.42
  target.bodyMat.metalness = 0
  target.accentMat.color.setHex(0xff83cb)
  target.accentMat.emissive.setHex(0xff83cb)

  const rig = addGroup('rig')
  const ribbon = addGroup('ribbon', rig)
  const path: [number, number, number][] = [
    [-0.45, 0.57, 0], [-0.16, 0.4, 0.03], [0.22, 0.18, -0.03],
    [0.28, -0.12, 0.02], [-0.08, -0.32, -0.02], [-0.47, -0.55, 0],
  ]
  addMesh('ribbon-mass', tube(path, 0.13, 48), target.bodyMat, [0, 0, 0], [0, 0, 0], [1, 1, 0.58], ribbon)
  const stripePath = path.map(([x, y, z]) => [x + 0.025, y, z + 0.075] as [number, number, number])
  addMesh('sour-stripe', tube(stripePath, 0.025, 48), target.accentMat, [0, 0, 0], [0, 0, 0], [1, 1, 0.6], ribbon)

  const sugar = makeMaterial(0xfffae8, { roughness: 0.58, glow: 0.32 })
  const grains = addGroup('grains', ribbon)
  const grainPoints: [number, number, number][] = [
    [-0.38, 0.48, 0.11], [-0.12, 0.33, 0.11], [0.2, 0.13, 0.1],
    [0.2, -0.13, 0.11], [-0.12, -0.34, 0.1], [-0.39, -0.5, 0.1],
  ]
  for (let i = 0; i < grainPoints.length; i++) {
    addMesh(`grain-${i}`, new THREE.OctahedronGeometry(0.045, 0), sugar, grainPoints[i], [i * 0.7, i * 0.4, i], [1, 0.75, 0.72], grains)
  }
  setEye([-0.39, 0.48, 0.14], [0.82, 0.64, 0.58], [0.74, 1, 0.8])
}

function buildCrimp({ target, setBody, addGroup, addMesh, makeMaterial, setEye }: UnitArtBuildContext) {
  setBody(emptyGeometry())
  target.bodyMat.color.setHex(0xee4d9b)
  target.bodyMat.emissive.setHex(0xee4d9b)
  target.bodyMat.roughness = 0.3
  target.bodyMat.metalness = 0.05
  target.accentMat.color.setHex(0xffdc45)
  target.accentMat.emissive.setHex(0xffdc45)

  const rig = addGroup('rig')
  const wrapper = addGroup('wrapper', rig)
  addMesh('packet', new THREE.BoxGeometry(0.98, 0.44, 0.3), target.bodyMat, [0, 0, 0], [0, 0, 0], [1, 1, 1], wrapper)

  const foil = makeMaterial(0xfff4b8, { metalness: 0.56, roughness: 0.2, glow: 0.3 })
  for (const side of [-1, 1]) {
    const end = addGroup(side < 0 ? 'left-crimp' : 'right-crimp', wrapper)
    end.position.x = side * 0.67
    addMesh(`end-${side}`, new THREE.BoxGeometry(0.38, 0.48, 0.2), target.bodyMat, [side * 0.06, 0, -0.02], [0, 0, 0], [1, 1, 1], end)
    for (let i = -2; i <= 2; i++) {
      addMesh(`pleat-${side}-${i}`, new THREE.BoxGeometry(0.025, 0.38, 0.24), foil, [side * 0.08, i * 0.065, 0.01], [0, 0, side * i * 0.055], [1, 1, 1], end)
    }
  }

  addMesh('label', new THREE.BoxGeometry(0.52, 0.24, 0.035), target.accentMat, [0, 0, 0.17], [0, 0, 0], [1, 1, 1], wrapper)
  addMesh('seal-line', new THREE.BoxGeometry(0.62, 0.032, 0.026), foil, [0, -0.18, 0.195], [0, 0, 0], [1, 1, 1], wrapper)
  setEye([0.06, 0.02, 0.235], [1.12, 0.52, 0.64], [0.74, 1.18, 0.82])
}

function buildHardSet({ target, setBody, addGroup, addMesh, makeMaterial, setEye }: UnitArtBuildContext) {
  setBody(emptyGeometry())
  target.bodyMat.color.setHex(0xe63857)
  target.bodyMat.emissive.setHex(0xe63857)
  target.bodyMat.roughness = 0.38
  target.bodyMat.metalness = 0.02
  target.accentMat.color.setHex(0xffcf38)
  target.accentMat.emissive.setHex(0xffcf38)
  target.accentMat.roughness = 0.24
  target.accentMat.metalness = 0.38

  const rig = addGroup('rig')
  const stack = addGroup('stack', rig)
  const seam = makeMaterial(0x711631, { roughness: 0.46, glow: 0.1 })
  const glaze = makeMaterial(0xff8a98, { roughness: 0.24, glow: 0.24 })
  const slabGeo = new THREE.BoxGeometry(1.18, 0.25, 0.5)
  const layerSpecs: Array<{ name: string; y: number; x: number; rotation: number }> = [
    { name: 'layer-bottom', y: -0.29, x: -0.03, rotation: -0.025 },
    { name: 'layer-mid', y: 0, x: 0.04, rotation: 0.018 },
    { name: 'layer-top', y: 0.29, x: -0.02, rotation: -0.015 },
  ]
  for (const layer of layerSpecs) {
    const group = addGroup(layer.name, stack)
    addMesh(`${layer.name}-mass`, slabGeo.clone(), target.bodyMat, [layer.x, layer.y, 0], [0, 0, layer.rotation], [1, 1, 1], group)
    addMesh(`${layer.name}-seam`, new THREE.BoxGeometry(1.08, 0.035, 0.035), seam, [layer.x, layer.y - 0.105, 0.27], [0, 0, layer.rotation], [1, 1, 1], group)
    addMesh(`${layer.name}-shine`, new THREE.BoxGeometry(0.34, 0.035, 0.025), glaze, [layer.x - 0.27, layer.y + 0.075, 0.275], [0, 0, layer.rotation], [1, 1, 1], group)
  }

  const bands = addGroup('bands', rig)
  for (const x of [-0.4, 0.4]) {
    addMesh(`band-${x}`, new THREE.BoxGeometry(0.12, 1.02, 0.58), target.accentMat, [x, 0, -0.015], [0, 0, 0], [1, 1, 1], bands)
    addMesh(`stamp-${x}`, new THREE.CylinderGeometry(0.075, 0.075, 0.04, 12), seam, [x, 0.4, 0.305], [Math.PI / 2, 0, 0], [1, 1, 1], bands)
  }
  addMesh('press-cap', new THREE.BoxGeometry(0.78, 0.08, 0.6), target.accentMat, [0, 0.48, -0.02], [0, 0, 0], [1, 1, 1], rig)
  addMesh('set-foot', new THREE.BoxGeometry(1.36, 0.09, 0.58), seam, [0, -0.48, -0.02], [0, 0, 0], [1, 1, 1], rig)
  setEye([0.08, 0.02, 0.315], [1.08, 0.46, 0.62], [0.72, 1.2, 0.82])
}

function buildLastDrop({ target, setBody, addGroup, addMesh, makeMaterial, setEye }: UnitArtBuildContext) {
  setBody(emptyGeometry())
  target.bodyMat.color.setHex(0x42d6e8)
  target.bodyMat.emissive.setHex(0x42d6e8)
  target.bodyMat.roughness = 0.22
  target.bodyMat.metalness = 0.02
  target.bodyMat.transparent = true
  target.bodyMat.opacity = 0.88
  target.accentMat.color.setHex(0xff59ae)
  target.accentMat.emissive.setHex(0xff59ae)
  target.accentMat.roughness = 0.2
  target.accentMat.metalness = 0.18

  const rig = addGroup('rig')
  const reservoir = addGroup('reservoir', rig)
  addMesh('reservoir-shell', new THREE.SphereGeometry(0.5, 20, 16), target.bodyMat, [0, 0.08, 0], [0, 0, 0], [1.05, 1.35, 0.88], reservoir)
  addMesh('reservoir-crown', new THREE.ConeGeometry(0.27, 0.48, 12), target.bodyMat, [0, 0.75, -0.02], [0, 0, 0], [1, 1, 0.84], reservoir)

  const liquidMat = makeMaterial(0xff4f9d, { roughness: 0.24, glow: 0.42, opacity: 0.82 })
  const liquid = addGroup('liquid', reservoir)
  addMesh('liquid-core', new THREE.SphereGeometry(0.39, 18, 14), liquidMat, [0, -0.08, 0.035], [0, 0, 0], [1.02, 0.9, 0.78], liquid)
  addMesh('level-line', new THREE.BoxGeometry(0.63, 0.045, 0.035), target.accentMat, [0, -0.12, 0.45], [0, 0, 0], [1, 1, 1], liquid)

  const capMat = makeMaterial(0xffe15d, { metalness: 0.42, roughness: 0.24, glow: 0.28 })
  addMesh('crown-cap', new THREE.CylinderGeometry(0.18, 0.18, 0.12, 12), capMat, [0, 0.99, -0.02], [0, 0, 0], [1, 1, 0.84], reservoir)

  const refillLine = addGroup('refill-line', rig)
  addMesh(
    'refill-tube',
    tube([[-0.34, 0.56, -0.12], [-0.69, 0.7, -0.08], [-0.76, 0.25, -0.02], [-0.6, -0.04, 0.02]], 0.055, 28),
    target.accentMat,
    [0, 0, 0],
    [0, 0, 0],
    [1, 1, 1],
    refillLine,
  )
  addMesh('line-port', new THREE.TorusGeometry(0.12, 0.035, 7, 18), capMat, [-0.57, -0.09, 0.03], [Math.PI / 2, 0, 0], [1, 1, 1], refillLine)

  const valve = addGroup('valve', rig)
  addMesh('valve-neck', new THREE.CylinderGeometry(0.13, 0.18, 0.24, 12), capMat, [0, -0.65, 0], [0, 0, 0], [1, 1, 0.88], valve)
  addMesh('valve-ring', new THREE.TorusGeometry(0.18, 0.04, 7, 20), target.accentMat, [0, -0.78, 0], [Math.PI / 2, 0, 0], [1, 1, 1], valve)
  const hangingDrop = addGroup('hanging-drop', valve)
  addMesh('last-drop-mass', new THREE.SphereGeometry(0.12, 12, 9), liquidMat, [0, -1.03, 0.02], [0, 0, 0], [0.82, 1.45, 0.75], hangingDrop)

  setEye([0.14, 0.2, 0.47], [1.02, 0.7, 0.64], [0.78, 1.08, 0.82])
}

const DEFINITIONS: Record<ProofVisual, UnitArtDefinition> = {
  'cherry-brick': { id: 'cherry-brick', faction: 'fruit', motion: 'cherry-heavy', build: buildCherryBrick },
  'citrus-burst': { id: 'citrus-burst', faction: 'fruit', motion: 'citrus-pressure', build: buildCitrusBurst },
  'sour-ribbon': { id: 'sour-ribbon', faction: 'fruit', motion: 'sour-ribbon', build: buildSourRibbon },
  'crimped-wrapper': { id: 'crimped-wrapper', faction: 'candy', motion: 'crimp-wrapper', build: buildCrimp },
  'hard-set': { id: 'hard-set', faction: 'candy', motion: 'hard-set-press', build: buildHardSet },
  'last-drop': { id: 'last-drop', faction: 'candy', motion: 'last-drop-refill', build: buildLastDrop },
}

export function isAuthoredUnitVisual(visual: UnitVisual): visual is ProofVisual {
  return (PROOF_VISUALS as readonly UnitVisual[]).includes(visual)
}

function rememberParts(runtime: AuthoredUnitRuntime) {
  for (const part of Object.values(runtime.parts)) {
    runtime.baseParts.set(part, {
      position: part.position.clone(),
      rotation: part.rotation.clone(),
      scale: part.scale.clone(),
    })
  }
}

function restorePart(part: THREE.Object3D, base: PartTransform) {
  part.position.copy(base.position)
  part.rotation.copy(base.rotation)
  part.scale.copy(base.scale)
}

function restoreParts(runtime: AuthoredUnitRuntime) {
  runtime.baseParts.forEach((base, part) => restorePart(part, base))
}

export function buildAuthoredUnitArt(target: AuthoredUnitTarget, visual: UnitVisual): AuthoredUnitRuntime | null {
  if (!isAuthoredUnitVisual(visual)) return null
  const definition = DEFINITIONS[visual]
  const runtime: AuthoredUnitRuntime = {
    id: visual,
    faction: definition.faction,
    motion: definition.motion,
    target,
    nodes: [],
    geometries: new Set(),
    materials: new Set(),
    parts: {},
    baseParts: new Map(),
    baseBodyScale: target.body.scale.clone(),
    baseBodyRotation: target.body.rotation.clone(),
  }

  const track = <T extends THREE.Object3D>(name: string, object: T) => {
    runtime.nodes.push(object)
    runtime.parts[name] = object
    return object
  }
  const context: UnitArtBuildContext = {
    target,
    runtime,
    setBody: (geometry, scale = [1, 1, 1]) => {
      target.body.geometry.dispose()
      target.body.geometry = geometry
      target.body.scale.set(...scale)
      runtime.geometries.add(geometry)
    },
    addMesh: (name, geometry, material, position, rotation = [0, 0, 0], scale = [1, 1, 1], parent = target.body) => {
      const mesh = track(name, new THREE.Mesh(geometry, material))
      mesh.position.set(...position)
      mesh.rotation.set(...rotation)
      mesh.scale.set(...scale)
      mesh.castShadow = true
      parent.add(mesh)
      runtime.geometries.add(geometry)
      return mesh
    },
    addGroup: (name, parent = target.body) => {
      const group = track(name, new THREE.Group())
      parent.add(group)
      return group
    },
    makeMaterial: (color, options = {}) => {
      const material = new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: options.glow ?? 0.16,
        metalness: options.metalness ?? 0.04,
        roughness: options.roughness ?? 0.32,
        transparent: options.opacity !== undefined && options.opacity < 1,
        opacity: options.opacity ?? 1,
      })
      runtime.materials.add(material)
      return material
    },
    setEye: (position, scale, pupilScale = [1, 1, 1]) => {
      target.eye.position.set(...position)
      target.eye.scale.set(...scale)
      target.pupil.scale.set(...pupilScale)
    },
  }

  definition.build(context)
  target.head.visible = false
  target._ringA.visible = false
  target._ringB.visible = false
  runtime.baseBodyScale.copy(target.body.scale)
  runtime.baseBodyRotation.copy(target.body.rotation)
  rememberParts(runtime)
  return runtime
}

export function disposeAuthoredUnitArt(runtime: AuthoredUnitRuntime) {
  const nodeSet = new Set(runtime.nodes)
  for (const node of runtime.nodes) {
    if (!node.parent || nodeSet.has(node.parent)) continue
    node.parent.remove(node)
  }
  runtime.geometries.forEach(geometry => geometry.dispose())
  runtime.materials.forEach(material => material.dispose())
  runtime.target.head.visible = true
  runtime.target._ringA.visible = true
  runtime.target._ringB.visible = true
  runtime.target.pupil.scale.set(1, 1, 1)
}

export function updateAuthoredUnitArt(runtime: AuthoredUnitRuntime, t: number, phase: number) {
  restoreParts(runtime)
  const wave = Math.sin(t * 2 + phase)
  const parts = runtime.parts

  switch (runtime.motion) {
    case 'cherry-heavy':
      parts['left-lobe'].scale.set(1 + wave * 0.025, 1 - wave * 0.018, 1)
      parts['right-lobe'].scale.set(1 - wave * 0.025, 1 + wave * 0.018, 1)
      parts.stem.rotation.z += Math.sin(t * 1.45 + phase) * 0.07
      break
    case 'citrus-pressure': {
      const pulse = 1 + Math.max(0, wave) * 0.035
      parts.slice.scale.set(pulse, pulse, 1)
      parts.spokes.rotation.z = Math.sin(t * 0.72 + phase) * 0.06
      parts.leaf.rotation.z += Math.sin(t * 1.8 + phase) * 0.08
      break
    }
    case 'sour-ribbon':
      parts.ribbon.rotation.z = Math.sin(t * 1.55 + phase) * 0.065
      parts.ribbon.rotation.y = Math.sin(t * 0.8 + phase) * 0.12
      parts.grains.position.y = Math.sin(t * 2.3 + phase) * 0.012
      break
    case 'crimp-wrapper':
      parts.wrapper.rotation.z = Math.sin(t * 1.9 + phase) * 0.025
      parts['left-crimp'].rotation.y = Math.sin(t * 3.3 + phase) * 0.08
      parts['right-crimp'].rotation.y = -Math.sin(t * 3.1 + phase) * 0.08
      break
    case 'hard-set-press': {
      const pressure = Math.max(0, Math.sin(t * 1.3 + phase))
      parts.stack.scale.set(1 + pressure * 0.012, 1 - pressure * 0.018, 1)
      parts['layer-top'].position.y -= pressure * 0.012
      parts['layer-bottom'].position.y += pressure * 0.008
      parts.bands.scale.y = 1 - pressure * 0.008
      break
    }
    case 'last-drop-refill': {
      const fill = (Math.sin(t * 1.15 + phase) + 1) * 0.5
      parts.reservoir.scale.set(1 + fill * 0.012, 1 - fill * 0.01, 1)
      parts.liquid.position.y = -0.025 + fill * 0.055
      parts.liquid.scale.y = 0.94 + fill * 0.07
      parts['hanging-drop'].position.y = -0.025 - fill * 0.07
      parts['hanging-drop'].scale.set(0.94 + fill * 0.08, 1.05 - fill * 0.06, 0.94 + fill * 0.08)
      parts['refill-line'].rotation.z = Math.sin(t * 0.78 + phase) * 0.035
      break
    }
  }
}

export function poseAuthoredUnit(runtime: AuthoredUnitRuntime, pose: UnitPose, progress: number, direction = 1) {
  restoreParts(runtime)
  const p = THREE.MathUtils.clamp(progress, 0, 1)
  const parts = runtime.parts

  if (runtime.motion === 'cherry-heavy') {
    const lean = pose === 'attack' ? direction * 0.14 * p : pose === 'windup' ? -direction * 0.08 * p : 0
    parts.rig.rotation.z = lean
    const squash = pose === 'block' ? 0.14 * p : pose === 'hit' ? 0.2 * (1 - p) : 0
    parts['left-lobe'].scale.y *= 1 - squash
    parts['right-lobe'].scale.y *= 1 - squash
    parts['left-lobe'].scale.x *= 1 + squash * 0.7
    parts['right-lobe'].scale.x *= 1 + squash * 0.7
  } else if (runtime.motion === 'citrus-pressure') {
    const pressure = pose === 'cast' ? Math.sin(p * Math.PI) * 0.16 : pose === 'hit' ? (1 - p) * 0.12 : 0
    parts.slice.scale.set(1 + pressure, 1 + pressure, 1 - pressure * 0.6)
    parts.spokes.rotation.z = p * (pose === 'cast' ? 0.7 : 0.18) * direction
  } else if (runtime.motion === 'sour-ribbon') {
    const snap = pose === 'attack' ? Math.sin(p * Math.PI) * 0.26 * direction : 0
    parts.ribbon.rotation.z = snap
    parts.ribbon.scale.x = 1 + (pose === 'attack' ? Math.sin(p * Math.PI) * 0.18 : 0)
    if (pose === 'block') parts.ribbon.scale.set(0.82, 0.9, 1)
  } else if (runtime.motion === 'crimp-wrapper') {
    const snap = Math.sin(p * Math.PI)
    if (pose === 'attack' || pose === 'cast') parts.wrapper.rotation.z = direction * snap * 0.12
    if (pose === 'block') parts.wrapper.scale.set(1 + p * 0.12, 1 - p * 0.12, 1.08)
    parts['left-crimp'].rotation.y = snap * 0.24
    parts['right-crimp'].rotation.y = -snap * 0.24
  } else if (runtime.motion === 'hard-set-press') {
    const impact = Math.sin(p * Math.PI)
    if (pose === 'windup') {
      parts.stack.rotation.z = -direction * p * 0.08
      parts['layer-top'].position.x -= direction * p * 0.09
    } else if (pose === 'attack' || pose === 'cast') {
      parts.stack.rotation.z = direction * impact * 0.13
      parts['layer-top'].position.x += direction * impact * 0.16
      parts['layer-bottom'].position.x -= direction * impact * 0.08
    } else if (pose === 'block') {
      parts.stack.scale.set(1 + p * 0.13, 1 - p * 0.18, 1.08)
      parts['layer-top'].position.y -= p * 0.08
      parts['layer-bottom'].position.y += p * 0.08
      parts.bands.scale.y = 1 - p * 0.12
    } else if (pose === 'hit') {
      const recoil = (1 - p) * 0.12
      parts['layer-top'].position.x += recoil
      parts['layer-mid'].position.x -= recoil * 0.7
      parts['layer-bottom'].position.x += recoil * 0.35
    }
  } else if (runtime.motion === 'last-drop-refill') {
    const pulse = Math.sin(p * Math.PI)
    if (pose === 'attack' || pose === 'cast') {
      parts.reservoir.rotation.z = direction * pulse * 0.12
      parts.valve.rotation.z = -direction * pulse * 0.18
      parts['hanging-drop'].position.x += direction * pulse * 0.16
    } else if (pose === 'heal') {
      parts.liquid.position.y += pulse * 0.15
      parts.liquid.scale.y *= 1 + pulse * 0.24
      parts.reservoir.scale.set(1 + pulse * 0.08, 1 + pulse * 0.05, 1 + pulse * 0.04)
      parts['refill-line'].scale.set(1 + pulse * 0.05, 1 + pulse * 0.08, 1)
    } else if (pose === 'block') {
      parts.reservoir.scale.set(1.08, 0.88, 1.08)
      parts.valve.position.y += p * 0.08
    } else if (pose === 'hit') {
      const slosh = (1 - p) * direction
      parts.liquid.rotation.z = slosh * 0.24
      parts.liquid.position.x += slosh * 0.12
      parts['hanging-drop'].position.x -= slosh * 0.2
      parts['refill-line'].rotation.z = -slosh * 0.16
    }
  }

  if (pose === 'heal') parts.rig.scale.setScalar(1 + Math.sin(p * Math.PI) * 0.08)
  if (pose === 'recover') restoreParts(runtime)
}

export function resetAuthoredUnitPose(runtime: AuthoredUnitRuntime) {
  restoreParts(runtime)
}

export const AUTHORED_UNIT_IDS: readonly UnitVisual[] = PROOF_VISUALS
