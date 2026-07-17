import * as THREE from 'three'
import { CLASS_CONFIGS } from '../data/classes.js'
import { buildUnit, setUnitIdentity, updateEye, updateUnitIdentity, type Unit } from './unit.js'

type LabMode = 'color' | 'grayscale' | 'silhouette'

const LAB_UNITS = [
  { name: 'CHERRY BRICK', visual: 'cherry-brick' as const, body: CLASS_CONFIGS.warrior.bodyColor, accent: CLASS_CONFIGS.warrior.accentColor },
  { name: 'CITRUS BURST', visual: 'citrus-burst' as const, body: CLASS_CONFIGS.mage.bodyColor, accent: CLASS_CONFIGS.mage.accentColor },
  { name: 'SOUR RIBBON', visual: 'sour-ribbon' as const, body: CLASS_CONFIGS.rogue.bodyColor, accent: CLASS_CONFIGS.rogue.accentColor },
  { name: 'THE CRIMP', visual: 'crimped-wrapper' as const, body: 0xee4d9b, accent: 0xffdc45 },
  { name: 'HARD SET', visual: 'hard-set' as const, body: 0xe63857, accent: 0xffcf38 },
  { name: 'THE LAST DROP', visual: 'last-drop' as const, body: 0x42d6e8, accent: 0xff59ae },
]

export function showUnitLab() {
  document.body.classList.remove('game-active')
  const root = document.createElement('main')
  root.id = 'unit-lab'
  root.setAttribute('aria-label', 'Unit silhouette lab')
  root.innerHTML = `
    <header class="unit-lab-head">
      <div>
        <p>FIELD IDENTIFICATION / RIG PROOF 01</p>
        <h1>FRUIT FRONT / CANDY</h1>
      </div>
      <a href="./" aria-label="Return to title">EXIT</a>
    </header>
    <div class="unit-lab-labels">
      ${LAB_UNITS.map((unit, index) => `<div><span>0${index + 1}</span>${unit.name}</div>`).join('')}
    </div>
    <div class="unit-lab-controls" role="group" aria-label="Rendering mode">
      <button type="button" data-mode="color" aria-pressed="true">COLOR</button>
      <button type="button" data-mode="grayscale" aria-pressed="false">GRAYSCALE</button>
      <button type="button" data-mode="silhouette" aria-pressed="false">SILHOUETTE</button>
    </div>
  `
  document.body.appendChild(root)

  const style = document.createElement('style')
  style.dataset.unitLab = 'true'
  style.textContent = `
    #unit-lab { position: fixed; inset: 0; z-index: 300; color: #fff; font-family: Inter, ui-sans-serif, system-ui, sans-serif; pointer-events: none; }
    #unit-lab canvas { position: absolute; inset: 0; width: 100%; height: 100%; z-index: -1; transition: filter .2s ease; }
    .unit-lab-head { position: absolute; inset: max(24px, var(--safe-top)) 28px auto; display: flex; align-items: flex-start; justify-content: space-between; gap: 24px; pointer-events: auto; }
    .unit-lab-head p { color: #bca9d5; font: 700 10px/1.2 ui-monospace, monospace; letter-spacing: .18em; }
    .unit-lab-head h1 { margin-top: 7px; font-size: clamp(19px, 2vw, 28px); line-height: 1; letter-spacing: 0; }
    .unit-lab-head a { color: #fff; border: 1px solid rgba(255,255,255,.35); padding: 8px 12px; font: 800 10px/1 ui-monospace, monospace; text-decoration: none; background: rgba(15,8,25,.66); }
    .unit-lab-labels { position: absolute; left: 2vw; right: 2vw; bottom: max(90px, calc(76px + var(--safe-bottom))); display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 8px; text-align: center; }
    .unit-lab-labels div { font-size: clamp(10px, 1.1vw, 13px); font-weight: 900; letter-spacing: .12em; text-shadow: 0 2px 10px #14041f; }
    .unit-lab-labels span { display: block; margin-bottom: 6px; color: #bca9d5; font: 700 9px/1 ui-monospace, monospace; letter-spacing: .12em; }
    .unit-lab-controls { position: absolute; left: 50%; bottom: max(24px, var(--safe-bottom)); transform: translateX(-50%); display: flex; border: 1px solid rgba(255,255,255,.25); background: rgba(14,7,25,.82); pointer-events: auto; }
    .unit-lab-controls button { min-width: 104px; min-height: 38px; border: 0; border-right: 1px solid rgba(255,255,255,.18); padding: 0 15px; color: #c9bdd8; background: transparent; font: 800 10px/1 ui-monospace, monospace; letter-spacing: .08em; cursor: pointer; }
    .unit-lab-controls button:last-child { border-right: 0; }
    .unit-lab-controls button[aria-pressed="true"] { color: #1a0b24; background: #ffe15a; }
    #unit-lab[data-view="silhouette"] .unit-lab-head,
    #unit-lab[data-view="silhouette"] .unit-lab-head p,
    #unit-lab[data-view="silhouette"] .unit-lab-labels,
    #unit-lab[data-view="silhouette"] .unit-lab-labels span { color: #17131c; text-shadow: none; }
    #unit-lab[data-view="silhouette"] .unit-lab-head a { color: #17131c; border-color: rgba(23,19,28,.38); background: rgba(242,238,228,.72); }
    @media (max-width: 700px) {
      .unit-lab-head { left: 16px; right: 16px; }
      .unit-lab-labels { left: 2vw; right: 2vw; gap: 4px; }
      .unit-lab-labels div { letter-spacing: 0; }
      .unit-lab-controls { width: calc(100% - 24px); }
      .unit-lab-controls button { flex: 1; min-width: 0; padding: 0 8px; }
    }
  `
  document.head.appendChild(style)

  const renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
  renderer.setSize(innerWidth, innerHeight)
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.25
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  root.prepend(renderer.domElement)

  const scene = new THREE.Scene()
  const background = new THREE.Color(0x170a28)
  scene.background = background
  scene.fog = new THREE.Fog(0x170a28, 8, 18)
  const camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.1, 50)
  camera.position.set(0, 1.35, 9.8)
  camera.lookAt(0, 1.15, 0)

  scene.add(new THREE.HemisphereLight(0xfff2c2, 0x2a0e3f, 2.2))
  const key = new THREE.DirectionalLight(0xffffff, 3.5)
  key.position.set(-2, 6, 6); key.castShadow = true; scene.add(key)
  const fruitRim = new THREE.PointLight(0xff496c, 55, 14); fruitRim.position.set(-4, 2, 2); scene.add(fruitRim)
  const candyRim = new THREE.PointLight(0x7ee7ff, 48, 14); candyRim.position.set(4, 2, 2); scene.add(candyRim)

  const floorMat = new THREE.MeshStandardMaterial({ color: 0x3b1457, roughness: 0.68, metalness: 0.08 })
  const floor = new THREE.Mesh(new THREE.CircleGeometry(9, 64), floorMat)
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor)
  const stripeMat = new THREE.MeshBasicMaterial({ color: 0xffd94c, transparent: true, opacity: 0.2 })
  const floorStripes: THREE.Mesh[] = []
  for (let i = -4; i <= 4; i++) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.006, 10), stripeMat)
    stripe.position.set(i * 1.05, 0.008, 0); scene.add(stripe); floorStripes.push(stripe)
  }

  const units: Unit[] = []
  const spread = Math.min(1.58, Math.max(1.15, innerWidth / innerHeight * 0.9))
  LAB_UNITS.forEach((spec, index) => {
    const unit = buildUnit(spec.body, spec.accent)
    setUnitIdentity(unit, spec.visual)
    unit.group.position.set((index - (LAB_UNITS.length - 1) / 2) * spread, 0.04, 0)
    unit.group.scale.setScalar(1)
    unit._eyePhase = 0.17 + index * 0.21
    scene.add(unit.group)
    units.push(unit)
  })

  const silhouetteMat = new THREE.MeshBasicMaterial({ color: 0x08080a })
  let mode: LabMode = 'color'
  root.dataset.view = mode
  const buttons = [...root.querySelectorAll<HTMLButtonElement>('[data-mode]')]
  const applyMode = (next: LabMode) => {
    mode = next
    root.dataset.view = mode
    renderer.domElement.style.filter = mode === 'grayscale' ? 'grayscale(1)' : 'none'
    scene.overrideMaterial = mode === 'silhouette' ? silhouetteMat : null
    background.setHex(mode === 'silhouette' ? 0xf2eee4 : 0x170a28)
    ;(scene.fog as THREE.Fog).color.setHex(mode === 'silhouette' ? 0xf2eee4 : 0x170a28)
    floor.visible = mode !== 'silhouette'
    floorStripes.forEach(stripe => { stripe.visible = mode !== 'silhouette' })
    buttons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.mode === mode)))
  }
  buttons.forEach(button => button.addEventListener('click', () => applyMode(button.dataset.mode as LabMode)))

  const clock = new THREE.Clock()
  let raf = 0
  const frame = () => {
    raf = requestAnimationFrame(frame)
    const t = clock.getElapsedTime()
    units.forEach((unit, index) => {
      unit.body.position.y = 1.1 + Math.sin(t * 1.7 + index * 0.8) * 0.025
      updateUnitIdentity(unit, t)
      updateEye(unit, t)
    })
    renderer.render(scene, camera)
  }
  frame()

  const resize = () => {
    renderer.setSize(innerWidth, innerHeight)
    camera.aspect = innerWidth / innerHeight
    camera.updateProjectionMatrix()
  }
  window.addEventListener('resize', resize)

  return {
    dispose: () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      renderer.dispose()
      silhouetteMat.dispose()
      root.remove()
      style.remove()
    },
  }
}
