import * as THREE from 'three';

export interface MaterialInfo {
  name: string;
  type: string;
  color: string | null;
  meshes: number;
  props: [string, string][];
  maps: string[];
}

export interface ModelInfo {
  meshes: number;
  triangles: number;
  textures: number;
  animations: number;
  materials: MaterialInfo[];
}

const n = (v: number) => (Math.round(v * 100) / 100).toString();

/** Plain-data summary of a loaded scene, for the inspector panel. */
export function inspect(root: THREE.Object3D, animations: number): ModelInfo {
  const mats = new Map<THREE.Material, number>();
  const textures = new Set<THREE.Texture>();
  let meshes = 0;
  let triangles = 0;

  root.traverse((o) => {
    if (!(o as THREE.Mesh).isMesh) return;
    const mesh = o as THREE.Mesh;
    meshes++;
    const g = mesh.geometry;
    triangles += (g.index ? g.index.count : g.attributes.position.count) / 3;
    for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) mats.set(m, (mats.get(m) ?? 0) + 1);
  });

  const materials = [...mats].map(([m, count]): MaterialInfo => {
    const s = m as THREE.MeshPhysicalMaterial;
    const props: [string, string][] = [];
    const maps: string[] = [];
    if (s.isMeshStandardMaterial) {
      props.push(['metalness', n(s.metalness)], ['roughness', n(s.roughness)]);
      if (s.emissive && s.emissive.getHex() !== 0) props.push(['emissive', `#${s.emissive.getHexString()} × ${n(s.emissiveIntensity)}`]);
    }
    if (s.isMeshPhysicalMaterial) {
      if (s.clearcoat) props.push(['clearcoat', `${n(s.clearcoat)} / rough ${n(s.clearcoatRoughness)}`]);
      if (s.transmission) props.push(['transmission', n(s.transmission)], ['thickness', n(s.thickness)]);
      if (s.ior !== 1.5) props.push(['ior', n(s.ior)]);
      if (s.sheen) props.push(['sheen', `${n(s.sheen)} #${s.sheenColor.getHexString()}`]);
      if (s.iridescence) props.push(['iridescence', n(s.iridescence)]);
      if (s.anisotropy) props.push(['anisotropy', n(s.anisotropy)]);
      if (s.dispersion) props.push(['dispersion', n(s.dispersion)]);
      if (s.specularIntensity !== 1) props.push(['specular', n(s.specularIntensity)]);
    }
    if (m.transparent) props.push(['opacity', n(m.opacity)]);
    if (m.alphaTest) props.push(['alphaTest', n(m.alphaTest)]);
    if (m.side === THREE.DoubleSide) props.push(['sides', 'double']);

    for (const [key, value] of Object.entries(m)) {
      if (key.endsWith('Map') && value && (value as THREE.Texture).isTexture) {
        maps.push(key.replace(/Map$/, '') || 'base');
        textures.add(value as THREE.Texture);
      }
    }

    const color = (s as { color?: THREE.Color }).color;
    return { name: m.name || '(unnamed)', type: m.type.replace(/^Mesh|Material$/g, ''), color: color ? `#${color.getHexString()}` : null, meshes: count, props, maps };
  });

  return { meshes, triangles: Math.round(triangles), textures: textures.size, animations, materials };
}
