'use client';

import { ContactShadows, Environment, Lightformer, OrbitControls, useAnimations } from '@react-three/drei';
import { Canvas, useLoader, useThree } from '@react-three/fiber';
import { Component, Suspense, useEffect, useLayoutEffect, useMemo, useState, type ReactNode } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { OrbitControls as OrbitControlsImpl } from 'three/examples/jsm/controls/OrbitControls.js';
import { inspect, type ModelInfo } from './inspect';
import { configureGLTF } from './loaders';

export type EnvKind = 'studio' | 'softbox' | 'custom';
export type ToneKind = 'agx' | 'aces' | 'neutral';

export interface ViewSettings {
  env: EnvKind;
  envIntensity: number;
  envRotation: number; // degrees
  background: boolean;
  blur: number;
  tone: ToneKind;
  exposure: number;
  shadows: boolean;
  autoRotate: boolean;
}

const TONE: Record<ToneKind, THREE.ToneMapping> = {
  agx: THREE.AgXToneMapping,
  aces: THREE.ACESFilmicToneMapping,
  neutral: THREE.NeutralToneMapping,
};

interface Props {
  url: string;
  settings: ViewSettings;
  hdri: THREE.Texture | null;
  onLoaded: (info: ModelInfo) => void;
  onError: (message: string) => void;
}

export default function Scene({ url, settings, hdri, onLoaded, onError }: Props) {
  return (
    <Canvas
      dpr={[1, 2]}
      gl={{ antialias: true, preserveDrawingBuffer: true }}
      camera={{ fov: 40, position: [3, 2, 4] }}
      style={{ touchAction: 'none' }}
    >
      <color attach="background" args={['#1a1d22']} />
      <Renderer settings={settings} />
      <Lighting settings={settings} hdri={hdri} />
      <OrbitControls makeDefault enableDamping autoRotate={settings.autoRotate} autoRotateSpeed={0.8} />
      <ErrorBoundary key={url} onError={onError}>
        <Suspense fallback={null}>
          <Model url={url} shadows={settings.shadows} onLoaded={onLoaded} />
        </Suspense>
      </ErrorBoundary>
    </Canvas>
  );
}

/** Tone mapping and exposure live on the renderer; three recompiles affected programs on change. */
function Renderer({ settings }: { settings: ViewSettings }) {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    gl.toneMapping = TONE[settings.tone];
    gl.toneMappingExposure = settings.exposure;
  }, [gl, settings.tone, settings.exposure]);
  return null;
}

/**
 * Image-based lighting is what makes PBR materials read as real: metals and clearcoat
 * need something to reflect, and transmission needs something to refract.
 */
function Lighting({ settings, hdri }: { settings: ViewSettings; hdri: THREE.Texture | null }) {
  const gl = useThree((s) => s.gl);
  const room = useMemo(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const tex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    return tex;
  }, [gl]);
  useEffect(() => () => room.dispose(), [room]);

  const rot = THREE.MathUtils.degToRad(settings.envRotation);
  const common = {
    background: settings.background,
    backgroundBlurriness: settings.blur,
    environmentIntensity: settings.envIntensity,
    backgroundIntensity: settings.envIntensity,
    environmentRotation: [0, rot, 0] as [number, number, number],
    backgroundRotation: [0, rot, 0] as [number, number, number],
  };

  if (settings.env === 'custom' && hdri) return <Environment key={hdri.uuid} map={hdri} {...common} />;
  if (settings.env === 'softbox')
    return (
      <Environment resolution={512} {...common}>
        <color attach="background" args={['#202226']} />
        <Lightformer form="rect" intensity={4} position={[0, 5, 0]} rotation-x={Math.PI / 2} scale={[8, 8, 1]} />
        <Lightformer form="rect" intensity={2.5} position={[-5, 1.5, 2]} rotation-y={Math.PI / 2.5} scale={[3, 6, 1]} />
        <Lightformer form="rect" intensity={1.5} position={[5, 1.5, 2]} rotation-y={-Math.PI / 2.5} scale={[3, 6, 1]} />
        <Lightformer form="ring" intensity={2} color="#ffe2c4" position={[0, 2, -6]} scale={3} />
      </Environment>
    );
  return <Environment map={room} {...common} />;
}

function Model({ url, shadows, onLoaded }: { url: string; shadows: boolean; onLoaded: (info: ModelInfo) => void }) {
  const gl = useThree((s) => s.gl);
  const gltf = useLoader(GLTFLoader, url, (loader) => configureGLTF(loader, gl));
  const { scene, animations } = gltf;
  const camera = useThree((s) => s.camera as THREE.PerspectiveCamera);
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null;
  const [size, setSize] = useState(1);
  const { actions } = useAnimations(animations, scene);

  // Stand the model on the ground at the origin and frame it.
  useLayoutEffect(() => {
    scene.position.set(0, 0, 0);
    scene.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(scene);
    const center = box.getCenter(new THREE.Vector3());
    scene.position.set(-center.x, -box.min.y, -center.z);

    const dims = box.getSize(new THREE.Vector3());
    const radius = Math.max(dims.length() / 2, 1e-3);
    // fit the bounding sphere inside whichever field of view is narrower (tall canvases on phones)
    const vHalf = THREE.MathUtils.degToRad(camera.fov / 2);
    const hHalf = Math.atan(Math.tan(vHalf) * camera.aspect);
    const dist = (radius / Math.sin(Math.min(vHalf, hHalf))) * 1.05;
    const target = new THREE.Vector3(0, dims.y / 2, 0);
    camera.position.copy(target).add(new THREE.Vector3(0.6, 0.35, 0.75).normalize().multiplyScalar(dist));
    camera.near = dist / 100;
    camera.far = dist * 100;
    camera.updateProjectionMatrix();
    if (controls) {
      controls.target.copy(target);
      controls.maxDistance = dist * 10;
      controls.update();
    }
    setSize(Math.max(dims.x, dims.z));

    scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        const tex = m as THREE.MeshStandardMaterial;
        // sharper textures at grazing angles
        for (const t of [tex.map, tex.normalMap, tex.roughnessMap, tex.metalnessMap]) if (t) t.anisotropy = gl.capabilities.getMaxAnisotropy();
      }
    });
    onLoaded(inspect(scene, animations.length));
  }, [scene, animations, camera, controls, gl, onLoaded]);

  useEffect(() => {
    const first = Object.values(actions)[0];
    first?.reset().play();
    return () => void first?.stop();
  }, [actions]);

  return (
    <>
      <primitive object={scene} />
      {shadows && <ContactShadows key={url} position={[0, -0.001, 0]} scale={size * 3} far={size * 2} blur={2.5} opacity={0.6} resolution={1024} />}
    </>
  );
}

class ErrorBoundary extends Component<{ onError: (m: string) => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(e: unknown) {
    this.props.onError(e instanceof Error ? e.message : String(e));
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}
