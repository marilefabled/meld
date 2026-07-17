import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import type { UnitVisual } from '../../data/visuals.js'
import { buildUnit, isAuthoredUnit, poseUnit, resetUnitPose, setUnitIdentity, updateEye } from '../unit.js'
import { AUTHORED_UNIT_IDS } from './registry.js'

function rigSize(visual: UnitVisual) {
  const unit = buildUnit(0x888888, 0xffffff)
  setUnitIdentity(unit, visual)
  const runtime = unit._authoredRuntime
  expect(runtime).not.toBeNull()
  const size = new THREE.Vector3()
  new THREE.Box3().setFromObject(runtime!.parts.rig).getSize(size)
  return { unit, size }
}

describe('authored unit rigs', () => {
  it('registers the Fruit Front and authored Candy proof units', () => {
    expect(AUTHORED_UNIT_IDS).toEqual([
      'cherry-brick',
      'citrus-burst',
      'sour-ribbon',
      'crimped-wrapper',
      'hard-set',
      'last-drop',
    ])
  })

  it.each(AUTHORED_UNIT_IDS)('%s owns its silhouette under the combat body pivot', visual => {
    const { unit } = rigSize(visual)
    expect(isAuthoredUnit(unit)).toBe(true)
    expect(unit.head.visible).toBe(false)
    expect(unit._ringA.visible).toBe(false)
    expect(unit._ringB.visible).toBe(false)

    for (const node of unit._authoredRuntime!.nodes) {
      let parent: THREE.Object3D | null = node
      while (parent && parent !== unit.body) parent = parent.parent
      expect(parent).toBe(unit.body)
    }
  })

  it('gives the proof units deliberately different proportions', () => {
    const cherry = rigSize('cherry-brick').size
    const citrus = rigSize('citrus-burst').size
    const ribbon = rigSize('sour-ribbon').size
    const crimp = rigSize('crimped-wrapper').size
    const hardSet = rigSize('hard-set').size
    const lastDrop = rigSize('last-drop').size

    expect(cherry.x).toBeGreaterThan(1.3)
    expect(Math.abs(citrus.x - citrus.y)).toBeLessThan(0.3)
    expect(ribbon.y).toBeGreaterThan(ribbon.x)
    expect(crimp.x).toBeGreaterThan(crimp.y * 2)
    expect(hardSet.x).toBeGreaterThan(hardSet.y * 1.2)
    expect(lastDrop.y).toBeGreaterThan(lastDrop.x * 1.4)
  })

  it('restores the legacy generator when an authored unit changes identity', () => {
    const unit = buildUnit(0x8844aa, 0xffdd66)
    setUnitIdentity(unit, 'last-drop')
    expect(unit.bodyMat.transparent).toBe(true)
    setUnitIdentity(unit, 'violet-crinkle')

    expect(isAuthoredUnit(unit)).toBe(false)
    expect(unit.bodyMat.transparent).toBe(false)
    expect(unit.bodyMat.opacity).toBe(1)
    expect(unit.head.visible).toBe(true)
    expect(unit._ringA.visible).toBe(true)
    expect(unit._identityPivot.children.length).toBeGreaterThan(0)
  })

  it('preserves authored eye proportions through blinking and action recovery', () => {
    const unit = buildUnit(0xee4d9b, 0xffdc45)
    setUnitIdentity(unit, 'crimped-wrapper')
    const baseEye = unit._eyeScale.clone()
    const wrapper = unit._authoredRuntime!.parts.wrapper
    const baseWrapperRotation = wrapper.rotation.clone()

    updateEye(unit, 0)
    expect(unit.eye.scale.y).toBeCloseTo(baseEye.y)
    expect(unit.eye.scale.y).toBeLessThan(unit.eye.scale.x)

    poseUnit(unit, 'attack', 0.5, 1)
    expect(wrapper.rotation.equals(baseWrapperRotation)).toBe(false)
    resetUnitPose(unit)
    expect(wrapper.rotation.equals(baseWrapperRotation)).toBe(true)
  })

  it('raises The Last Drop liquid during its refill pose', () => {
    const unit = buildUnit(0x42d6e8, 0xff59ae)
    setUnitIdentity(unit, 'last-drop')
    const liquid = unit._authoredRuntime!.parts.liquid
    const baseScale = liquid.scale.y

    poseUnit(unit, 'heal', 0.5)
    expect(liquid.scale.y).toBeGreaterThan(baseScale)
    resetUnitPose(unit)
    expect(liquid.scale.y).toBeCloseTo(baseScale)
  })
})
