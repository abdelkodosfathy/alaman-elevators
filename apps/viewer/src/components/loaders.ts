import * as THREE from 'three';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { EXRLoader } from 'three/examples/jsm/loaders/EXRLoader.js';
import type { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

// Decoders are self-hosted in public/decoders (see scripts/copy-decoders.mjs).
let draco: DRACOLoader | undefined;
let ktx2: KTX2Loader | undefined;

/** Enables every compression scheme glTF files commonly use: Draco, Meshopt and KTX2/Basis textures. */
export function configureGLTF(loader: GLTFLoader, gl: THREE.WebGLRenderer) {
  draco ??= new DRACOLoader().setDecoderPath('/decoders/draco/');
  ktx2 ??= new KTX2Loader().setTranscoderPath('/decoders/basis/').detectSupport(gl);
  loader.setDRACOLoader(draco).setKTX2Loader(ktx2).setMeshoptDecoder(MeshoptDecoder);
}

/** Loads a user-supplied .hdr / .exr as an equirectangular environment map. */
export async function loadHDRI(file: File): Promise<THREE.Texture> {
  const url = URL.createObjectURL(file);
  try {
    const loader = /\.exr$/i.test(file.name) ? new EXRLoader() : new HDRLoader();
    const tex = await loader.loadAsync(url);
    tex.mapping = THREE.EquirectangularReflectionMapping;
    return tex;
  } finally {
    URL.revokeObjectURL(url);
  }
}
