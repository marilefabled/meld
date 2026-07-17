import { describe, expect, it } from 'vitest'
import { ENCOUNTERS, makeMirror } from '../data/encounters.js'
import * as THREE from 'three'
import { arenaForEncounter, createArenaDressing } from './arena.js'

describe('arenaForEncounter', () => {
  it('maps the three encounter doctrines to distinct Court locations', () => {
    expect(arenaForEncounter(ENCOUNTERS[0]).kind).toBe('wrapper-archive')
    expect(arenaForEncounter(ENCOUNTERS[1]).kind).toBe('press-floor')
    expect(arenaForEncounter(ENCOUNTERS[2]).kind).toBe('syrup-works')
  })

  it('keeps the Mirror on its own shelf', () => {
    expect(arenaForEncounter(makeMirror('warrior', 1), true).kind).toBe('original-shelf')
  })

  it('builds the Press Floor with mechanical press and conveyor motion', () => {
    const scene = new THREE.Scene()
    const dressing = createArenaDressing(scene)
    dressing.set(arenaForEncounter(ENCOUNTERS[1]))
    const platen = scene.getObjectByName('court-press-platen')
    const slat = scene.getObjectByName('court-conveyor-slat')

    expect(platen).toBeDefined()
    expect(slat).toBeDefined()
    dressing.update(0)
    const openY = platen!.position.y
    const firstX = slat!.position.x
    dressing.update(0.4)
    expect(platen!.position.y).toBeLessThan(openY)
    expect(slat!.position.x).not.toBe(firstX)
    dressing.dispose()
  })

  it('builds Syrup Works with changing reserves and metered drips', () => {
    const scene = new THREE.Scene()
    const dressing = createArenaDressing(scene)
    dressing.set(arenaForEncounter(ENCOUNTERS[2]))
    const level = scene.getObjectByName('court-syrup-level')
    const drop = scene.getObjectByName('court-syrup-drop')

    expect(level).toBeDefined()
    expect(drop).toBeDefined()
    dressing.update(0)
    const firstLevel = level!.scale.y
    const firstDrop = drop!.position.y
    dressing.update(1)
    expect(level!.scale.y).not.toBe(firstLevel)
    expect(drop!.position.y).toBeLessThan(firstDrop)
    dressing.dispose()
  })
})
