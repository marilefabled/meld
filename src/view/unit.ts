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

  const bodyGeo = new THREE.BoxGeometry(0.75, 1.0, 0.52)
  const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.3 })
  const body = new THREE.Mesh(bodyGeo, bodyMat)
  body.position.y = 1.05
  body.castShadow = true
  group.add(body)

  const headGeo = new THREE.BoxGeometry(0.55, 0.5, 0.5)
  const headMat = new THREE.MeshStandardMaterial({ color: accent, roughness: 0.3, metalness: 0.4 })
  const head = new THREE.Mesh(headGeo, headMat)
  head.position.y = 1.87
  head.castShadow = true
  group.add(head)

  const eyeGeo = new THREE.BoxGeometry(0.1, 0.1, 0.06)
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1.8 })
  const eyeL = new THREE.Mesh(eyeGeo, eyeMat)
  eyeL.position.set(-0.13, 1.91, 0.26)
  group.add(eyeL)
  const eyeR = eyeL.clone()
  eyeR.position.x = 0.13
  group.add(eyeR)

  const armGeo  = new THREE.BoxGeometry(0.22, 0.62, 0.26)
  const fistGeo = new THREE.BoxGeometry(0.28, 0.22, 0.3)

  const armL = new THREE.Group()
  armL.position.set(-0.52, 1.52, 0)
  const armLMesh = new THREE.Mesh(armGeo, bodyMat)
  armLMesh.position.y = -0.33; armLMesh.castShadow = true
  armL.add(armLMesh)
  const fistLMesh = new THREE.Mesh(fistGeo, bodyMat)
  fistLMesh.position.y = -0.68
  armL.add(fistLMesh)
  group.add(armL)

  const armR = new THREE.Group()
  armR.position.set(0.52, 1.52, 0)
  const armRMesh = new THREE.Mesh(armGeo, bodyMat)
  armRMesh.position.y = -0.33; armRMesh.castShadow = true
  armR.add(armRMesh)
  const fistRMesh = new THREE.Mesh(fistGeo, bodyMat)
  fistRMesh.position.y = -0.68
  armR.add(fistRMesh)
  group.add(armR)

  const legGeo = new THREE.BoxGeometry(0.27, 0.56, 0.3)
  const legMat = new THREE.MeshStandardMaterial({ color: 0x1a1a2e, roughness: 0.7 })

  const legL = new THREE.Group()
  legL.position.set(-0.18, 0.55, 0)
  const legLMesh = new THREE.Mesh(legGeo, legMat)
  legLMesh.position.y = -0.28; legLMesh.castShadow = true
  legL.add(legLMesh)
  group.add(legL)

  const legR = new THREE.Group()
  legR.position.set(0.18, 0.55, 0)
  const legRMesh = legLMesh.clone()
  legRMesh.position.y = -0.28
  legR.add(legRMesh)
  group.add(legR)

  return { group, body, head, armL, armR, legL, legR }
}
