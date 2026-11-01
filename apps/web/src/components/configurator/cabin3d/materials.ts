import { useMemo } from 'react';
import * as THREE from 'three';
import type { CabinLook } from './look';
import { granite, hairlineRoughness, marble, pvc, woodTexture } from './textures';

// Shared by the procedural fallback cabin (UVs 0..1 per face) and the Blender model
// (UVs in meters). `meters` switches texture repeats between the two.

export const steel = new THREE.MeshStandardMaterial({ name: 'steel', color: '#c3c8ce', metalness: 0.95, roughness: 0.32 });
export const darkSteel = new THREE.MeshStandardMaterial({ name: 'dark', color: '#1c1f24', metalness: 0.6, roughness: 0.5 });
export const seamMat = new THREE.MeshStandardMaterial({ name: 'seam', color: '#0d0f12', roughness: 0.9 });

const repeated = (tex: THREE.Texture, x: number, y: number) => {
  const t = tex.clone();
  t.repeat.set(x, y);
  t.needsUpdate = true;
  return t;
};

export function useWallMaterial(look: CabinLook, meters = false) {
  return useMemo(() => {
    switch (look.wall) {
      case 'hairline':
        return new THREE.MeshPhysicalMaterial({
          color: '#c9ced3',
          metalness: 1,
          roughness: 0.32,
          roughnessMap: repeated(hairlineRoughness(), meters ? 4.5 : 2, meters ? 0.45 : 1),
          anisotropy: 0.7,
        });
      case 'gold-mirror':
        return new THREE.MeshStandardMaterial({ color: '#f0cc6a', metalness: 1, roughness: 0.14, envMapIntensity: 1.6 });
      case 'black':
        return new THREE.MeshStandardMaterial({ color: '#2b2c31', metalness: 1, roughness: 0.18 });
      case 'wood':
        return new THREE.MeshStandardMaterial({ map: meters ? repeated(woodTexture(), 2.2, 0.45) : woodTexture(), metalness: 0, roughness: 0.55 });
      case 'custom':
        return new THREE.MeshStandardMaterial({ color: look.wallColor, metalness: 0.6, roughness: 0.3 });
      default:
        return new THREE.MeshStandardMaterial({ color: '#b7bcc2', metalness: 0.95, roughness: 0.42 });
    }
  }, [look.wall, look.wallColor, meters]);
}

export function useFloorMaterial(look: CabinLook, meters = false) {
  return useMemo(() => {
    const src = look.floor === 'marble' ? marble() : look.floor === 'granite' ? granite() : pvc();
    const tile = look.floor === 'marble' ? 1.2 : 0.6;
    const map = meters ? repeated(src, 1 / tile, 1 / tile) : repeated(src, look.width / tile, look.depth / tile);
    const roughness = look.floor === 'marble' ? 0.2 : look.floor === 'granite' ? 0.28 : 0.75;
    // Tint light floors down a little so the ceiling light doesn't wash the pattern out.
    const color = look.floor === 'marble' ? '#cfcac2' : '#ffffff';
    return new THREE.MeshStandardMaterial({ map, color, roughness, metalness: 0, envMapIntensity: 0.6 });
  }, [look.floor, look.width, look.depth, meters]);
}
