import * as THREE from 'three'

const color = (value) => new THREE.Color(value)

export class ChapterLoader {
  constructor(scene) {
    this.scene = scene
    this.group = new THREE.Group()
    this.scene.add(this.group)
    this.objects = {}
  }

  clear() {
    this.group.clear()
    this.objects = {}
  }

  load(chapter) {
    this.clear()
    const base = color(chapter.palette.open)
    this.scene.background = base.clone().multiplyScalar(0.36)
    this.scene.fog = new THREE.Fog(base.clone(), 10, 52)
    const ambient = new THREE.HemisphereLight(chapter.palette.close, chapter.palette.open, 2.4)
    const sun = new THREE.DirectionalLight(chapter.palette.open, 3.8)
    sun.position.set(-10, 14, 7)
    this.group.add(ambient, sun)

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 44), new THREE.MeshStandardMaterial({ color: '#4b4b4b', roughness: 1 }))
    floor.rotation.x = -Math.PI / 2
    this.group.add(floor)
    for (const [x, z, height] of [[-8, -4, 2], [0, 0, 4], [9, -5, 7]]) {
      const stone = new THREE.Mesh(new THREE.CylinderGeometry(2.8, 3.8, height, 6), new THREE.MeshStandardMaterial({ color: '#76716a', roughness: .92 }))
      stone.position.set(x, height / 2, z)
      this.group.add(stone)
    }

    const lens = new THREE.Mesh(new THREE.TorusGeometry(1.05, .2, 12, 32), new THREE.MeshStandardMaterial({ color: chapter.id === 'helios' ? '#f5b45d' : '#c8f3ff', emissive: base, emissiveIntensity: 1.7, roughness: .25 }))
    lens.position.set(-8, 3.7, -4)
    lens.rotation.x = Math.PI / 2
    this.group.add(lens)
    this.objects.lens = lens

    const gate = new THREE.Mesh(new THREE.BoxGeometry(4.8, 6.2, .7), new THREE.MeshStandardMaterial({ color: chapter.id === 'helios' ? '#70421f' : '#36536d', emissive: base, emissiveIntensity: .14, roughness: .8 }))
    gate.position.set(4.8, 3.1, -4.8)
    this.group.add(gate)
    this.objects.gate = gate

    const summit = new THREE.Mesh(new THREE.ConeGeometry(3.8, 8, 6), new THREE.MeshStandardMaterial({ color: '#716d69', roughness: 1 }))
    summit.position.set(12, 4, -8)
    this.group.add(summit)
    this.objects.summit = summit

    if (chapter.id === 'selene') {
      const bridge = new THREE.Mesh(new THREE.BoxGeometry(9, .35, 2.2), new THREE.MeshStandardMaterial({ color: '#b7edfb', transparent: true, opacity: .18, emissive: '#9ce6f7', emissiveIntensity: 1 }))
      bridge.position.set(7.8, 4.2, -6.2)
      this.group.add(bridge)
      this.objects.bridge = bridge
    }
    return this.objects
  }
}