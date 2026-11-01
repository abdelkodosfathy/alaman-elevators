'use client';

import { useGLTF, useTexture } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { useLayoutEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { CabinLook } from './look';
import { darkSteel, seamMat, steel, useFloorMaterial, useWallMaterial } from './materials';
import { displayTexture, touchButtonsTexture } from './textures';

// Renders the Blender-built car (blender/build_cabin.py). The GLB carries geometry, a
// second UV set and an ambient-occlusion atlas; finishes are applied here by material
// name and options are shown/hidden by node name, so one file per car size covers
// every configuration.

const url = (size: string, kind: 'cabin' | 'ao') => `/models/cabin/${kind}-${size}.${kind === 'cabin' ? 'glb' : 'jpg'}`;

const CEILING_NODE: Record<CabinLook['ceiling'], string> = {
  'led-panel': 'ceil_led',
  'mirror-led': 'ceil_spots',
  backlit: 'ceil_backlit',
  crystal: 'ceil_crystal',
};

/** Which variant nodes are visible for a look. Nodes not listed here are always shown. */
function visibility(look: CabinLook): Record<string, boolean> {
  const glass = look.wall === 'glass';
  const v: Record<string, boolean> = {
    back_panels: !glass,
    glass_back: glass,
    door_center: look.door === 'center',
    door_side: look.door === 'side',
    handrail_back: look.handrail !== 'none' && !glass,
    handrail_sides: look.handrail !== 'none',
    cop_buttons: look.cop !== 'touch',
    cop_touch: look.cop === 'touch',
    cop_display_lcd: look.cop === 'lcd',
    cop_display_tft: look.cop === 'tft',
  };
  for (const node of Object.values(CEILING_NODE)) v[node] = CEILING_NODE[look.ceiling] === node;
  for (let i = 0; i < 20; i++) v[`btn_${String(i).padStart(2, '0')}`] = i < look.stops;
  for (const extra of ['fan', 'ac', 'camera', 'voice', 'intercom', 'card', 'light-curtain']) v[`extra_${extra}`] = look.extras.has(extra);
  return v;
}

/** Canvas textures are drawn top-down; glTF UVs expect flipY = false. */
const forGltf = (tex: THREE.Texture) => {
  const t = tex.clone();
  t.flipY = false;
  t.needsUpdate = true;
  return t;
};

export default function ModelCabin({ look }: { look: CabinLook }) {
  const { scene } = useGLTF(url(look.size, 'cabin'));
  const ao = useTexture(url(look.size, 'ao'));
  const invalidate = useThree((s) => s.invalidate);
  const model = useMemo(() => scene.clone(true), [scene]);

  useMemo(() => {
    ao.flipY = false;
    ao.channel = 1; // baked into the second UV set
    ao.colorSpace = THREE.NoColorSpace;
    ao.needsUpdate = true;
  }, [ao]);

  const wall = useWallMaterial(look, true);
  const floor = useFloorMaterial(look, true);

  const materials = useMemo(() => {
    const withAo = <M extends THREE.MeshStandardMaterial>(m: M) => {
      const c = m.clone() as M;
      c.aoMap = ao;
      c.aoMapIntensity = 1;
      return c;
    };
    const lightColor = look.ceiling === 'crystal' ? '#ffe9c7' : look.ceiling === 'mirror-led' ? '#fff6e8' : '#f3f7ff';
    const lightIntensity = { 'led-panel': 1.1, 'mirror-led': 3, backlit: 1.25, crystal: 0.45 }[look.ceiling];
    const ceiling =
      look.ceiling === 'mirror-led'
        ? new THREE.MeshStandardMaterial({ color: '#e6e9ec', metalness: 1, roughness: 0.04 })
        : new THREE.MeshStandardMaterial({ color: '#aeb3b8', metalness: 0.9, roughness: 0.35 });
    const displayFloor = Math.min(look.stops - 1, 3);

    return {
      wall: withAo(wall),
      floor: withAo(floor),
      ceiling: withAo(ceiling),
      steel: withAo(steel),
      door: withAo(steel),
      handrail: withAo(
        look.handrail === 'gold'
          ? new THREE.MeshStandardMaterial({ color: '#d4af37', metalness: 1, roughness: 0.15 })
          : new THREE.MeshStandardMaterial({ color: '#dde1e5', metalness: 1, roughness: 0.18 }),
      ),
      dark: withAo(darkSteel),
      seam: withAo(seamMat),
      light: new THREE.MeshStandardMaterial({ color: lightColor, emissive: lightColor, emissiveIntensity: lightIntensity, toneMapped: false }),
      glass: new THREE.MeshPhysicalMaterial({ color: '#d9eef5', transmission: 1, roughness: 0.03, thickness: 0.012, ior: 1.5, metalness: 0 }),
      crystal: new THREE.MeshStandardMaterial({ color: '#ffffff', metalness: 1, roughness: 0.02, emissive: '#fff3dc', emissiveIntensity: 0.25, flatShading: true }),
      display: new THREE.MeshBasicMaterial({ map: forGltf(displayTexture(look.cop, displayFloor)), toneMapped: false }),
      touch: new THREE.MeshBasicMaterial({ map: forGltf(touchButtonsTexture(look.stops)), toneMapped: false }),
      btn_ring: new THREE.MeshBasicMaterial({ color: '#5fb4ff', toneMapped: false }),
    } satisfies Record<string, THREE.Material>;
  }, [ao, wall, floor, look.ceiling, look.cop, look.stops, look.handrail]);

  // Walls on the panoramic car are glass + stainless frame; side walls stay in the chosen finish
  // except glass, which has no panel equivalent.
  const sideWall = look.wall === 'glass' ? materials.steel : materials.wall;

  useLayoutEffect(() => {
    const vis = visibility(look);
    model.traverse((obj) => {
      if (obj.name in vis) obj.visible = vis[obj.name];
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      // Remember the Blender material name before we replace it.
      const key = (mesh.userData.mat ??= (mesh.material as THREE.Material).name) as keyof typeof materials;
      const m = key === 'wall' ? sideWall : materials[key];
      if (m) mesh.material = m;
    });
    invalidate();
  }, [model, materials, sideWall, look, invalidate]);

  return <primitive object={model} />;
}
