import * as THREE from 'three'

export interface Unit {
  group: THREE.Group
  body:  THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>
  head:  THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>
  armL:  THREE.Group; armR: THREE.Group
  legL:  THREE.Group; legR: THREE.Group
}

export function buildUnit(color: number, accent: number): Unit {
  const group = new THREE.Group()

  const bodyMat     = new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.3 })
  const accentMat   = new THREE.MeshStandardMaterial({ color: accent, roughness: 0.25, metalness: 0.55 })
  const legMat      = new THREE.MeshStandardMaterial({ color: 0x111120, roughness: 0.75 })
  const footMat     = new THREE.MeshStandardMaterial({ color: 0x0e0e1e, roughness: 0.85 })

  // ── Body ─────────────────────────────────────────────────────────────────
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.75, 1.0, 0.52), bodyMat)
  body.position.y = 1.05
  body.castShadow = true
  group.add(body)

  // chest plate
  const chest = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.24, 0.06), accentMat)
  chest.position.set(0, 1.10, 0.28)
  group.add(chest)

  // belt
  const belt = new THREE.Mesh(new THREE.BoxGeometry(0.77, 0.07, 0.54), accentMat)
  belt.position.y = 0.57
  group.add(belt)

  // ── Neck ─────────────────────────────────────────────────────────────────
  const neck = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 0.20), bodyMat)
  neck.position.y = 1.63
  group.add(neck)

  // ── Head ─────────────────────────────────────────────────────────────────
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.50, 0.50), bodyMat)
  head.position.y = 1.87
  head.castShadow = true
  group.add(head)

  // visor (replaces eyes — single glowing bar)
  const visorMat = new THREE.MeshStandardMaterial({ color: accent, emissive: accent, emissiveIntensity: 2.5 })
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.07, 0.05), visorMat)
  visor.position.set(0, 1.905, 0.265)
  group.add(visor)

  // ── Arms ─────────────────────────────────────────────────────────────────
  const armGeo  = new THREE.BoxGeometry(0.22, 0.62, 0.26)
  const fistGeo = new THREE.BoxGeometry(0.28, 0.22, 0.3)
  const shoulderGeo = new THREE.BoxGeometry(0.36, 0.10, 0.33)

  const armL = new THREE.Group()
  armL.position.set(-0.52, 1.52, 0)
  const armLMesh = new THREE.Mesh(armGeo, bodyMat)
  armLMesh.position.y = -0.33; armLMesh.castShadow = true
  armL.add(armLMesh)
  const fistL = new THREE.Mesh(fistGeo, bodyMat)
  fistL.position.y = -0.68
  armL.add(fistL)
  const shoulderL = new THREE.Mesh(shoulderGeo, accentMat)
  shoulderL.position.y = 0.08
  armL.add(shoulderL)
  group.add(armL)

  const armR = new THREE.Group()
  armR.position.set(0.52, 1.52, 0)
  const armRMesh = new THREE.Mesh(armGeo, bodyMat)
  armRMesh.position.y = -0.33; armRMesh.castShadow = true
  armR.add(armRMesh)
  const fistR = new THREE.Mesh(fistGeo, bodyMat)
  fistR.position.y = -0.68
  armR.add(fistR)
  const shoulderR = new THREE.Mesh(shoulderGeo, accentMat)
  shoulderR.position.y = 0.08
  armR.add(shoulderR)
  group.add(armR)

  // ── Legs ─────────────────────────────────────────────────────────────────
  const legGeo  = new THREE.BoxGeometry(0.27, 0.56, 0.30)
  const footGeo = new THREE.BoxGeometry(0.30, 0.10, 0.42)

  const legL = new THREE.Group()
  legL.position.set(-0.18, 0.55, 0)
  const legLMesh = new THREE.Mesh(legGeo, legMat)
  legLMesh.position.y = -0.28; legLMesh.castShadow = true
  legL.add(legLMesh)
  const footL = new THREE.Mesh(footGeo, footMat)
  footL.position.set(0, -0.60, 0.07)
  legL.add(footL)
  group.add(legL)

  const legR = new THREE.Group()
  legR.position.set(0.18, 0.55, 0)
  const legRMesh = new THREE.Mesh(legGeo, legMat)
  legRMesh.position.y = -0.28; legRMesh.castShadow = true
  legR.add(legRMesh)
  const footR = new THREE.Mesh(footGeo, footMat)
  footR.position.set(0, -0.60, 0.07)
  legR.add(footR)
  group.add(legR)

  return { group, body, head, armL, armR, legL, legR }
}
