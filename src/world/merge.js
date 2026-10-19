import * as THREE from 'three'

// Fusion du décor fixe.
// Chaque objet dessiné coûte un « appel de dessin » (et un de plus pour les ombres).
// Les îles comptent des milliers de petits objets immobiles : on les regroupe, île par
// île, en quelques gros maillages, un par type de matière. La couleur de chaque objet
// passe dans les sommets, le rendu reste identique.

const baseCompile = THREE.Material.prototype.onBeforeCompile
const MAPS = ['normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap', 'alphaMap', 'lightMap', 'bumpMap', 'displacementMap', 'envMap', 'specularMap']
const TYPES = new Set(['MeshStandardMaterial', 'MeshBasicMaterial', 'MeshLambertMaterial', 'MeshPhongMaterial'])

function mergeable(o, noMaps) {
  if (!o.isMesh || o.isSkinnedMesh || o.isInstancedMesh || o.children.length || o.userData.dynamic) return false
  const m = o.material
  if (!m || Array.isArray(m) || !TYPES.has(m.type)) return false
  if (m.transparent || m.opacity < 1 || m.vertexColors || m.onBeforeCompile !== baseCompile || m.wireframe) return false
  if (MAPS.some((k) => m[k]) || (noMaps && m.map)) return false
  const g = o.geometry
  if (!g?.attributes.position || Object.keys(g.morphAttributes).length) return false
  if (g.drawRange.start !== 0 || g.drawRange.count !== Infinity) return false
  return o.renderOrder === 0
}

function materialKey(o) {
  const m = o.material
  return [
    m.type, m.side, m.flatShading, m.roughness, m.metalness, m.emissive?.getHex(), m.emissiveIntensity,
    m.map?.uuid ?? '', m.fog, m.toneMapped, m.depthWrite, m.depthTest, m.alphaTest, m.shininess, m.specular?.getHex(),
    o.castShadow, o.receiveShadow,
  ].join('|')
}

// Empreinte de ce qui peut bouger ou changer : sert à repérer ce que les animations modifient.
function stateOf(o, root) {
  let visible = true
  for (let p = o; p && p !== root; p = p.parent) visible &&= p.visible
  const m = o.material
  return o.matrixWorld.elements.map((v) => v.toFixed(4)).join(',') + `|${visible}|${m.uuid}|${m.color?.getHex()}|${m.emissive?.getHex()}|${m.emissiveIntensity}|${m.opacity}|${m.map?.uuid}|${o.geometry.uuid}`
}

const SIM = [[0.016, 0.4], [0.25, 1.3], [0.5, 2.9], [0.9, 4.7], [1.3, 7.3], [0.7, 9.1]]

export function mergeStatic(group, animated = [], { exclude = [], noMaps = false } = {}) {
  const skip = new Set()
  for (const e of exclude) e.traverse((o) => skip.add(o))
  group.updateMatrixWorld(true)
  const candidates = []
  group.traverseVisible((o) => {
    if (o !== group && !skip.has(o) && mergeable(o, noMaps)) candidates.push(o)
  })
  const before = candidates.map((o) => stateOf(o, group))
  const moving = new Set()
  // On joue quelques instants d'animation : tout ce qui bouge ou change reste à part.
  for (const [dt, t] of SIM) {
    for (const fn of animated) fn(dt, t)
    group.updateMatrixWorld(true)
    candidates.forEach((o, i) => {
      if (!moving.has(o) && stateOf(o, group) !== before[i]) moving.add(o)
    })
  }

  const buckets = new Map()
  for (const o of candidates) {
    if (moving.has(o)) continue
    const key = materialKey(o)
    if (!buckets.has(key)) buckets.set(key, [])
    buckets.get(key).push(o)
  }

  const inv = new THREE.Matrix4().copy(group.matrixWorld).invert()
  const m4 = new THREE.Matrix4()
  const nm = new THREE.Matrix3()
  const v = new THREE.Vector3()
  let merged = 0
  let removed = 0
  for (const list of buckets.values()) {
    if (list.length < 2) continue
    const first = list[0].material
    const needNormal = !first.flatShading && first.type !== 'MeshBasicMaterial'
    const needUv = !!first.map
    let total = 0
    for (const o of list) total += o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count
    const P = new Float32Array(total * 3)
    const C = new Float32Array(total * 3)
    const N = needNormal ? new Float32Array(total * 3) : null
    const U = needUv ? new Float32Array(total * 2) : null
    let k = 0
    for (const o of list) {
      const g = o.geometry
      if (needNormal && !g.attributes.normal) g.computeVertexNormals()
      if (needUv && !g.attributes.uv) continue
      m4.multiplyMatrices(inv, o.matrixWorld)
      nm.getNormalMatrix(m4)
      const flip = m4.determinant() < 0
      const pos = g.attributes.position
      const nor = g.attributes.normal
      const uv = g.attributes.uv
      const idx = g.index
      const count = idx ? idx.count : pos.count
      const c = o.material.color ?? new THREE.Color(1, 1, 1)
      for (let i = 0; i < count; i++) {
        // Matrice miroir : on inverse l'ordre des sommets pour garder les faces dans le bon sens.
        const src = flip ? i - (i % 3) + [0, 2, 1][i % 3] : i
        const j = idx ? idx.getX(src) : src
        v.fromBufferAttribute(pos, j).applyMatrix4(m4)
        P[k * 3] = v.x
        P[k * 3 + 1] = v.y
        P[k * 3 + 2] = v.z
        C[k * 3] = c.r
        C[k * 3 + 1] = c.g
        C[k * 3 + 2] = c.b
        if (N) {
          v.fromBufferAttribute(nor, j).applyMatrix3(nm).normalize()
          N[k * 3] = v.x
          N[k * 3 + 1] = v.y
          N[k * 3 + 2] = v.z
        }
        if (U) {
          U[k * 2] = uv.getX(j)
          U[k * 2 + 1] = uv.getY(j)
        }
        k++
      }
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(P.subarray(0, k * 3), 3))
    geo.setAttribute('color', new THREE.BufferAttribute(C.subarray(0, k * 3), 3))
    if (N) geo.setAttribute('normal', new THREE.BufferAttribute(N.subarray(0, k * 3), 3))
    if (U) geo.setAttribute('uv', new THREE.BufferAttribute(U.subarray(0, k * 2), 2))
    geo.computeBoundingSphere()
    geo.computeBoundingBox()
    const material = first.clone()
    material.vertexColors = true
    material.color?.set(0xffffff)
    const out = new THREE.Mesh(geo, material)
    out.castShadow = list[0].castShadow
    out.receiveShadow = list[0].receiveShadow
    out.userData.merged = list.length
    out.userData.terrain = true
    group.add(out)
    merged++
    for (const o of list) {
      if (needUv && !o.geometry.attributes.uv) continue
      let p = o.parent
      o.removeFromParent()
      removed++
      // Groupes devenus vides : retirés aussi.
      while (p && p !== group && !p.children.length && !p.isMesh && !p.isLight) {
        const up = p.parent
        p.removeFromParent()
        p = up
      }
    }
  }
  return { merged, removed }
}

// Personnage animé figé (statue) : on applique la pose aux sommets une fois pour toutes
// et on remplace les maillages animés par des maillages fixes, qu'on peut ensuite fusionner.
export function bakeSkinned(root) {
  root.updateMatrixWorld(true)
  const skinned = []
  root.traverse((o) => {
    if (o.isSkinnedMesh) skinned.push(o)
  })
  const v = new THREE.Vector3()
  for (const s of skinned) {
    let visible = true
    for (let p = s; p && p !== root.parent; p = p.parent) visible &&= p.visible
    if (!visible) {
      s.removeFromParent()
      continue
    }
    const src = s.geometry
    const pos = src.attributes.position
    const P = new Float32Array(pos.count * 3)
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i)
      s.applyBoneTransform(i, v)
      P.set([v.x, v.y, v.z], i * 3)
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(P, 3))
    if (src.attributes.uv) geo.setAttribute('uv', src.attributes.uv)
    if (src.index) geo.setIndex(src.index)
    geo.computeVertexNormals()
    const m = new THREE.Mesh(geo, s.material)
    m.position.copy(s.position)
    m.quaternion.copy(s.quaternion)
    m.scale.copy(s.scale)
    m.castShadow = s.castShadow
    m.receiveShadow = s.receiveShadow
    m.name = s.name
    s.parent.add(m)
    s.removeFromParent()
  }
}
