// A volumetric 3D title: extruded glowing letters spelling MELD / TO / ALL / HELD,
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
const ROWS = ['MELD', 'TO', 'ALL', 'HELD']

interface Glyph {
  mesh:  THREE.Mesh
  from:  THREE.Vector3
  to:    THREE.Vector3
  qFrom: THREE.Quaternion
  delay: number
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
  const fill = new THREE.PointLight(0x4f46e5, 140, 90); fill.position.set(-10, -6, 9); scene.add(fill)

  const mat = new THREE.MeshStandardMaterial({
    color: 0x4338ca, emissive: 0x6d6cff, emissiveIntensity: 0.75,
    metalness: 0.45, roughness: 0.28,
  })

  // ── Letters laid out as the title grid, each centred on its own origin ───────
  const group = new THREE.Group()
  group.position.y = 2.2            // lift the title above the menu buttons
  scene.add(group)

  const SIZE = 1.05, DEPTH = 0.4, LINE = 1.55, GAP = 0.32
  const glyphs: Glyph[] = []
  const rnd = (m: number) => (Math.random() * 2 - 1) * m

  ROWS.forEach((word, r) => {
    const metas = [...word].map(ch => {
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
      const mesh = new THREE.Mesh(m.geo, mat)
      const to   = new THREE.Vector3(x + m.w / 2, y, 0)
      const from = new THREE.Vector3(rnd(24), rnd(15), rnd(18) - 5)
      const qFrom = new THREE.Quaternion().setFromEuler(new THREE.Euler(rnd(Math.PI), rnd(Math.PI), rnd(Math.PI)))
      mesh.position.copy(from)
      mesh.quaternion.copy(qFrom)
      group.add(mesh)
      glyphs.push({ mesh, from, to, qFrom, delay: Math.random() * 0.7 + r * 0.12 })
      x += m.w + GAP
    }
  })

  // ── Bloom ────────────────────────────────────────────────────────────────────
  const composer = new EffectComposer(renderer)
  composer.addPass(new RenderPass(scene, camera))
  const bloom = new UnrealBloomPass(new THREE.Vector2(vw(), vh()), 0.7, 0.6, 0.12)
  composer.addPass(bloom)
  composer.addPass(new OutputPass())

  const Q_TO = new THREE.Quaternion()        // identity
  const DUR  = 2.7
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
    composer.render()
  }
  raf = requestAnimationFrame(frame)

  function onResize() {
    camera.aspect = vw() / vh()
    camera.updateProjectionMatrix()
    renderer.setSize(vw(), vh())
    composer.setSize(vw(), vh())
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
