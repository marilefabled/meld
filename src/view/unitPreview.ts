import * as THREE from 'three'
import type { UnitVisual } from '../data/visuals.js'
import { buildUnit, CORE_Y, setUnitIdentity, updateEye, updateUnitIdentity } from './unit.js'

export interface UnitPreviewHandle {
  setEmphasis: (active: boolean) => void
  dispose: () => void
}

export function createUnitPreview(
  container: HTMLElement,
  options: { visual: UnitVisual; bodyColor: number; accentColor: number; scale?: number },
): UnitPreviewHandle {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' })
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5))
  renderer.setClearColor(0x000000, 0)
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.2
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.domElement.setAttribute('aria-hidden', 'true')
  container.appendChild(renderer.domElement)

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 20)
  camera.position.set(0, 1.25, 4.15)
  camera.lookAt(0, 1.12, 0)

  scene.add(new THREE.HemisphereLight(0xfff2cf, 0x241136, 2.4))
  const key = new THREE.DirectionalLight(0xffffff, 3.6)
  key.position.set(-2.2, 4.5, 4.5)
  scene.add(key)
  const rim = new THREE.PointLight(options.accentColor, 24, 8)
  rim.position.set(2.2, 1.8, 2.2)
  scene.add(rim)

  const unit = buildUnit(options.bodyColor, options.accentColor)
  setUnitIdentity(unit, options.visual)
  unit.group.scale.setScalar(options.scale ?? 1.25)
  unit.group.rotation.y = 0.34
  scene.add(unit.group)

  const floorMat = new THREE.MeshBasicMaterial({ color: options.accentColor, transparent: true, opacity: 0.15, depthWrite: false })
  const floor = new THREE.Mesh(new THREE.CircleGeometry(0.82, 32), floorMat)
  floor.rotation.x = -Math.PI / 2
  floor.position.y = 0.015
  scene.add(floor)

  let emphasis = 0
  let targetEmphasis = 0
  let raf = 0
  let disposed = false
  const started = performance.now()

  const resize = () => {
    const width = Math.max(1, container.clientWidth)
    const height = Math.max(1, container.clientHeight)
    renderer.setSize(width, height, false)
    camera.aspect = width / height
    camera.updateProjectionMatrix()
  }
  const observer = new ResizeObserver(resize)
  observer.observe(container)
  resize()

  const frame = () => {
    if (disposed) return
    raf = requestAnimationFrame(frame)
    const t = (performance.now() - started) / 1000
    emphasis += (targetEmphasis - emphasis) * 0.1
    unit.body.position.y = CORE_Y + Math.sin(t * 1.8 + unit._eyePhase) * 0.025
    unit.group.rotation.y = 0.34 + Math.sin(t * 0.55) * 0.1 + emphasis * 0.12
    const pulse = 1 + emphasis * 0.055
    unit.group.scale.setScalar((options.scale ?? 1.25) * pulse)
    updateUnitIdentity(unit, t)
    updateEye(unit, t)
    floor.rotation.z = t * 0.12
    renderer.render(scene, camera)
  }
  frame()

  return {
    setEmphasis: active => { targetEmphasis = active ? 1 : 0 },
    dispose: () => {
      if (disposed) return
      disposed = true
      cancelAnimationFrame(raf)
      observer.disconnect()
      const geometries = new Set<THREE.BufferGeometry>()
      const materials = new Set<THREE.Material>()
      scene.traverse(node => {
        if (!(node instanceof THREE.Mesh)) return
        geometries.add(node.geometry)
        const meshMaterials = Array.isArray(node.material) ? node.material : [node.material]
        meshMaterials.forEach(material => materials.add(material))
      })
      geometries.forEach(geometry => geometry.dispose())
      materials.forEach(material => material.dispose())
      renderer.dispose()
      renderer.domElement.remove()
    },
  }
}
