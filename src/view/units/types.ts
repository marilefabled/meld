import * as THREE from 'three'
import type { UnitVisual } from '../../data/visuals.js'

export type AuthoredMotion = 'cherry-heavy' | 'citrus-pressure' | 'sour-ribbon' | 'crimp-wrapper' | 'hard-set-press' | 'last-drop-refill'
export type UnitPose = 'windup' | 'attack' | 'cast' | 'block' | 'heal' | 'hit' | 'recover'

export interface AuthoredUnitTarget {
  body: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>
  bodyMat: THREE.MeshStandardMaterial
  accentMat: THREE.MeshStandardMaterial
  head: THREE.Group
  eye: THREE.Group
  pupil: THREE.Mesh
  _ringA: THREE.Mesh
  _ringB: THREE.Mesh
}

export interface PartTransform {
  position: THREE.Vector3
  rotation: THREE.Euler
  scale: THREE.Vector3
}

export interface AuthoredUnitRuntime {
  id: UnitVisual
  faction: 'fruit' | 'candy'
  motion: AuthoredMotion
  target: AuthoredUnitTarget
  nodes: THREE.Object3D[]
  geometries: Set<THREE.BufferGeometry>
  materials: Set<THREE.Material>
  parts: Record<string, THREE.Object3D>
  baseParts: Map<THREE.Object3D, PartTransform>
  baseBodyScale: THREE.Vector3
  baseBodyRotation: THREE.Euler
}

export interface UnitArtDefinition {
  id: UnitVisual
  faction: AuthoredUnitRuntime['faction']
  motion: AuthoredMotion
  build: (context: UnitArtBuildContext) => void
}

export interface UnitArtBuildContext {
  target: AuthoredUnitTarget
  runtime: AuthoredUnitRuntime
  setBody: (geometry: THREE.BufferGeometry, scale?: [number, number, number]) => void
  addMesh: (
    name: string,
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    position: [number, number, number],
    rotation?: [number, number, number],
    scale?: [number, number, number],
    parent?: THREE.Object3D,
  ) => THREE.Mesh
  addGroup: (name: string, parent?: THREE.Object3D) => THREE.Group
  makeMaterial: (
    color: number,
    options?: { metalness?: number; roughness?: number; glow?: number; opacity?: number },
  ) => THREE.MeshStandardMaterial
  setEye: (position: [number, number, number], scale: [number, number, number], pupilScale?: [number, number, number]) => void
}
