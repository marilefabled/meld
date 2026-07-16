// A volumetric 3D title: extruded glowing letters spelling MELD IN / YOUR HAND,
// flung apart across 3D space and melding together into the title, lit with depth
// and lifted by an UnrealBloom pass. Rendered on a full-screen canvas BEHIND the
// menu (z 1 < the menu's z 200), so the transparent title card shows it through and
// opaque submenus cover it correctly.

import * as THREE from 'three'
import { FontLoader, type Font } from 'three/examples/jsm/loaders/FontLoader.js'
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import gentilisBold from 'three/examples/fonts/gentilis_bold.typeface.json'

const FONT: Font = new FontLoader().parse(gentilisBold as unknown as Parameters<FontLoader['parse']>[0])
const ROWS = ['MELD IN', 'YOUR HAND']

interface Glyph {
  mesh:  THREE.Mesh
  from:  THREE.Vector3
  to:    THREE.Vector3
  qFrom: THREE.Quaternion
  delay: number
}

interface FruitMotif {
  group: THREE.Group
  baseY: number
  phase: number
  spin: number
}

function fruitMaterial(color: number, emissive: number) {
  return new THREE.MeshPhysicalMaterial({
    color,
    emissive,
    emissiveIntensity: 0.5,
    metalness: 0.14,
    roughness: 0.24,
    clearcoat: 0.8,
    clearcoatRoughness: 0.18,
    transparent: true,
    opacity: 0.86,
  })
}

function makeFruitMotifs(scene: THREE.Scene): FruitMotif[] {
  const motifs: FruitMotif[] = []
  const add = (group: THREE.Group, x: number, y: number, z: number, phase: number, spin: number) => {
    group.position.set(x, y, z)
    scene.add(group)
    motifs.push({ group, baseY: y, phase, spin })
  }

  // Cherry Brick: the Front's dense, red standard.
  const brick = new THREE.Group()
  const brickBody = new THREE.Mesh(new THREE.CapsuleGeometry(0.52, 0.92, 5, 12), fruitMaterial(0xfb4867, 0x5f1124))
  brickBody.rotation.z = 0.72
  brick.add(brickBody)
  const brickSeal = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.045, 8, 28), new THREE.MeshBasicMaterial({ color: 0xffc4cf, transparent: true, opacity: 0.72 }))
  brickSeal.rotation.x = Math.PI / 2
  brickSeal.position.z = 0.2
  brick.add(brickSeal)
  add(brick, -7.1, 2.25, -2.3, 0.2, 0.23)

  // Citrus Burst: a split, pressurized candy disk with a hot center.
  const citrus = new THREE.Group()
  const citrusBody = new THREE.Mesh(new THREE.CylinderGeometry(0.82, 0.82, 0.22, 24), fruitMaterial(0xffa424, 0x7c2d12))
  citrusBody.rotation.x = Math.PI / 2.5
  citrus.add(citrusBody)
  const citrusRing = new THREE.Mesh(new THREE.TorusGeometry(0.52, 0.06, 8, 24), new THREE.MeshBasicMaterial({ color: 0xffefaa, transparent: true, opacity: 0.78 }))
  citrusRing.rotation.x = Math.PI / 2
  citrusRing.position.z = 0.2
  citrus.add(citrusRing)
  for (let i = 0; i < 6; i++) {
    const ray = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.46, 0.028), new THREE.MeshBasicMaterial({ color: 0xfff1a8, transparent: true, opacity: 0.55 }))
    ray.rotation.z = i * Math.PI / 3
    ray.position.set(Math.sin(i * Math.PI / 3) * 0.22, Math.cos(i * Math.PI / 3) * 0.22, 0.24)
    citrus.add(ray)
  }
  add(citrus, 7.15, 1.7, -2.8, 1.7, -0.18)

  // Sour Ribbon: a deliberate, sharp seam rather than a generic glowing orb.
  const ribbon = new THREE.Group()
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-1.08, -0.18, 0),
    new THREE.Vector3(-0.48, 0.56, 0.08),
    new THREE.Vector3(0.1, -0.44, -0.05),
    new THREE.Vector3(0.72, 0.34, 0.06),
    new THREE.Vector3(1.12, -0.12, 0),
  ])
  ribbon.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 40, 0.11, 8, false), fruitMaterial(0xb478ff, 0x3b0764)))
  ribbon.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 40, 0.033, 6, false), new THREE.MeshBasicMaterial({ color: 0xf1d2ff, transparent: true, opacity: 0.82 })))
  add(ribbon, -6.8, -2.3, -2.7, 3.4, 0.16)

  return motifs
}

export function startTitleScene(): { dispose: () => void } {
  // Some embeddings report window.innerWidth as 0 — fall back to the layout
  // viewport, then the screen, so the canvas is always sized correctly.
  const vw = () => window.innerWidth || document.documentElement.clientWidth || screen.width  || 1280
  const vh = () => window.innerHeight || document.documentElement.clientHeight || screen.height || 720

  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true })
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
  renderer.setSize(vw(), vh())
  renderer.setClearColor(0x000000, 0)
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.15
  const canvas = renderer.domElement
  Object.assign(canvas.style, { position: 'fixed', inset: '0', zIndex: '1', pointerEvents: 'none', transition: 'opacity 0.35s ease' })
  document.body.appendChild(canvas)

  // Recede behind submenus: the scene is only meant to back the root title card,
  // so fade out the moment a submenu replaces it. Event-driven (not tied to the
  // render loop) so it works even when rAF is throttled.
  const updateFade = () => { canvas.style.opacity = document.querySelector('.ms-card.meld-title') ? '1' : '0' }
  const fadeObserver = new MutationObserver(updateFade)
  fadeObserver.observe(document.body, { childList: true, subtree: true })
  updateFade()

  const scene  = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(42, vw() / vh(), 0.1, 100)
  camera.position.set(0, 0, 17)

  scene.add(new THREE.AmbientLight(0x3a4070, 1.1))
  const key  = new THREE.PointLight(0xb3bcff, 260, 90); key.position.set(8, 10, 16);  scene.add(key)
  const fill = new THREE.PointLight(0xff5e7a, 105, 72); fill.position.set(-10, -5, 9); scene.add(fill)
  const fruitLight = new THREE.PointLight(0xffa424, 92, 66); fruitLight.position.set(7, -2, 8); scene.add(fruitLight)
  const fruitMotifs = makeFruitMotifs(scene)

  const mat = new THREE.MeshStandardMaterial({
    color: 0x4338ca, emissive: 0x6d6cff, emissiveIntensity: 0.75,
    metalness: 0.45, roughness: 0.28,
  })

  // ── Letters laid out as the title grid, each centred on its own origin ───────
  const group = new THREE.Group()
  group.position.y = 2.2            // lift the title above the menu buttons
  scene.add(group)

  const fitTitle = () => {
    const compact = Math.min(1, Math.max(0.46, (vw() / vh()) / 1.45))
    group.scale.setScalar(compact)
    for (const motif of fruitMotifs) motif.group.visible = compact > 0.62
  }

  const SIZE = 1.05, DEPTH = 0.4, LINE = 1.55, GAP = 0.32
  const glyphs: Glyph[] = []
  const rnd = (m: number) => (Math.random() * 2 - 1) * m

  ROWS.forEach((word, r) => {
    const metas = [...word].map(ch => {
      if (ch === ' ') return { geo: null, w: SIZE * 0.48 }
      const geo = new TextGeometry(ch, {
        font: FONT, size: SIZE, depth: DEPTH, curveSegments: 5,
        bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.035, bevelSegments: 2,
      })
      geo.computeBoundingBox()
      const bb = geo.boundingBox!
      const w  = bb.max.x - bb.min.x
      geo.translate(-(bb.max.x + bb.min.x) / 2, -(bb.max.y + bb.min.y) / 2, -(bb.max.z + bb.min.z) / 2)
      return { geo, w }
    })
    const totalW = metas.reduce((s, m) => s + m.w, 0) + GAP * (metas.length - 1)
    let x = -totalW / 2
    const y = (1.5 - r) * LINE
    for (const m of metas) {
      if (!m.geo) {
        x += m.w + GAP
        continue
      }
      const mesh = new THREE.Mesh(m.geo, mat)
      const to   = new THREE.Vector3(x + m.w / 2, y, 0)
      // Keep the title entrance inside its own stage; a longer four-line name
      // should arrive with force, not sweep through the root-menu controls.
      const from = new THREE.Vector3(to.x + rnd(5), to.y + rnd(2.3), rnd(10) - 3)
      const qFrom = new THREE.Quaternion().setFromEuler(new THREE.Euler(rnd(Math.PI), rnd(Math.PI), rnd(Math.PI)))
      mesh.position.copy(from)
      mesh.quaternion.copy(qFrom)
      group.add(mesh)
      glyphs.push({ mesh, from, to, qFrom, delay: Math.random() * 0.22 + r * 0.05 })
      x += m.w + GAP
    }
  })
  fitTitle()

  // ── Bloom ────────────────────────────────────────────────────────────────────
  const composer = new EffectComposer(renderer)
  composer.addPass(new RenderPass(scene, camera))
  const bloom = new UnrealBloomPass(new THREE.Vector2(vw(), vh()), 0.7, 0.6, 0.12)
  composer.addPass(bloom)
  composer.addPass(new OutputPass())

  const Q_TO = new THREE.Quaternion()        // identity
  const DUR  = 1.15
  const ease = (t: number) => 1 - Math.pow(1 - t, 3)   // easeOutCubic
  const t0   = performance.now()
  let raf = 0

  function frame() {
    raf = requestAnimationFrame(frame)
    const t = (performance.now() - t0) / 1000
    for (const g of glyphs) {
      const p = Math.min(1, Math.max(0, (t - g.delay) / DUR))
      const e = ease(p)
      g.mesh.position.lerpVectors(g.from, g.to, e)
      g.mesh.quaternion.slerpQuaternions(g.qFrom, Q_TO, e)
      if (p >= 1) {
        // settled → gentle idle drift (eased in so there's no pop)
        const it  = t - g.delay - DUR
        const amp = Math.min(1, it * 0.5)
        g.mesh.position.z = Math.sin(it * 0.7 + g.to.x) * 0.22 * amp
        g.mesh.rotation.x = Math.sin(it * 0.4 + g.to.y) * 0.05 * amp
        g.mesh.rotation.y = Math.sin(it * 0.5 + g.to.x) * 0.07 * amp
      }
    }
    group.rotation.y = Math.sin(t * 0.22) * 0.07     // slow whole-title sway
    for (const motif of fruitMotifs) {
      motif.group.rotation.z = Math.sin(t * 0.45 + motif.phase) * 0.12
      motif.group.rotation.y += 0.0018 * motif.spin
      motif.group.position.y = motif.baseY + Math.sin(t * 0.7 + motif.phase) * 0.09
    }
    composer.render()
  }
  raf = requestAnimationFrame(frame)

  function onResize() {
    camera.aspect = vw() / vh()
    camera.updateProjectionMatrix()
    renderer.setSize(vw(), vh())
    composer.setSize(vw(), vh())
    fitTitle()
  }
  addEventListener('resize', onResize)

  return {
    dispose() {
      cancelAnimationFrame(raf)
      fadeObserver.disconnect()
      removeEventListener('resize', onResize)
      for (const g of glyphs) g.mesh.geometry.dispose()
      mat.dispose()
      composer.dispose()
      renderer.dispose()
      canvas.remove()
    },
  }
}
