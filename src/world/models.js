import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js'

// Modèles 3D libres (CC0), voir CREDITS.md.
const base = `${import.meta.env.BASE_URL}models/`
const FILES = {
  character: 'kenney-platformer/character.glb',
  cloud: 'kenney-platformer/cloud.glb',
  coin: 'kenney-platformer/coin.glb',
  houseA: 'kenney-city/building-small-a.glb',
  houseB: 'kenney-city/building-small-b.glb',
  houseC: 'kenney-city/building-small-c.glb',
  houseD: 'kenney-city/building-small-d.glb',
  garage: 'kenney-city/building-garage.glb',
  fountain: 'kenney-city/pavement-fountain.glb',
  truck: 'kenney-racing/vehicle-truck-red.glb',
  drone: 'kenney-fps/enemy-flying.glb',
  robot: 'quaternius/RobotExpressive.glb',
}

const cache = {}

export async function loadModels(onProgress) {
  const manager = new THREE.LoadingManager()
  manager.onProgress = (url, loaded, total) => onProgress?.(loaded / total)
  const loader = new GLTFLoader(manager)
  await Promise.all(
    Object.entries(FILES).map(async ([key, file]) => {
      const gltf = await loader.loadAsync(base + file)
      gltf.scene.traverse((o) => {
        if (o.isMesh) {
          o.castShadow = true
          o.receiveShadow = true
        }
      })
      cache[key] = gltf
    }),
  )
}

// Copie d'un modèle, mise à l'échelle par sa hauteur (ou largeur), posée au sol et centrée.
export function model(key, { height, width, x = 0, y = 0, z = 0, rotY = 0 } = {}) {
  const gltf = cache[key]
  const object = gltf.animations.length ? cloneSkinned(gltf.scene) : gltf.scene.clone()
  object.updateMatrixWorld(true)
  const box = new THREE.Box3().setFromObject(object)
  const size = box.getSize(new THREE.Vector3())
  const scale = height ? height / size.y : width ? width / Math.max(size.x, size.z) : 1
  const center = box.getCenter(new THREE.Vector3())
  const inner = new THREE.Group()
  object.position.set(-center.x, -box.min.y, -center.z)
  inner.add(object)
  inner.scale.setScalar(scale)
  const wrapper = new THREE.Group()
  wrapper.add(inner)
  wrapper.position.set(x, y, z)
  wrapper.rotation.y = rotY
  wrapper.userData.animations = gltf.animations
  wrapper.userData.root = object
  return wrapper
}

// Lance une animation en boucle sur un modèle animé ; renvoie le mixer et ses actions.
export function animate(wrapper, initial) {
  const mixer = new THREE.AnimationMixer(wrapper.userData.root)
  const actions = {}
  for (const clip of wrapper.userData.animations) actions[clip.name] = mixer.clipAction(clip)
  if (initial && actions[initial]) actions[initial].play()
  return { mixer, actions }
}
