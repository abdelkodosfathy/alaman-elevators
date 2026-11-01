'use client';

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment, Lightformer } from '@react-three/drei';
import { Reflector } from 'three-stdlib';
import { Component, Suspense, useEffect, useMemo, useRef, type ReactNode } from 'react';
import * as THREE from 'three';
import type { CabinLook } from './look';
import { darkSteel, seamMat, steel, useFloorMaterial, useWallMaterial } from './materials';
import ModelCabin from './ModelCabin';
import { cityTexture, displayTexture, touchButtonsTexture } from './textures';

// Units are meters. Origin: floor center. Back wall at z = -depth/2, door wall at z = +depth/2.

const T = 0.02; // panel thickness
const GAP = 0.006; // seam between wall panels

export interface Focus {
  yaw: number;
  pitch: number;
  key: number;
}

export default function CabinScene({ look, focus }: { look: CabinLook; focus: Focus | null }) {
  return (
    <Canvas
      frameloop="demand"
      dpr={[1, 2]}
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
      camera={{ fov: 78, near: 0.02, far: 50 }}
      style={{ touchAction: 'none', cursor: 'grab' }}
    >
      {/* shaft darkness: neutral so it reads as shadow wherever it peeks through */}
      <color attach="background" args={['#2a2d31']} />
      <LookControls look={look} focus={focus} />
      <Lights look={look} />
      <Environment resolution={256} frames={1}>
        {/* neutral surroundings so metals don't reflect a black void below the horizon */}
        <color attach="background" args={['#7d838a']} />
        <Lightformer form="rect" intensity={3} position={[0, 4, 0]} rotation-x={Math.PI / 2} scale={[6, 6, 1]} />
        <Lightformer form="rect" intensity={1.2} position={[0, 1.5, -5]} scale={[10, 3, 1]} />
        <Lightformer form="rect" intensity={1.2} position={[0, 1.5, 5]} rotation-y={Math.PI} scale={[10, 3, 1]} />
        <Lightformer form="rect" intensity={0.8} position={[-5, 1.5, 0]} rotation-y={Math.PI / 2} scale={[10, 3, 1]} />
        <Lightformer form="rect" intensity={0.8} position={[5, 1.5, 0]} rotation-y={-Math.PI / 2} scale={[10, 3, 1]} />
      </Environment>
      {/* keyed by size: a missing model for one size must not disable the others */}
      <ModelBoundary key={look.size} fallback={<Cabin look={look} />}>
        {/* The procedural cabin shows instantly and stays as fallback if the model can't load. */}
        <Suspense fallback={<Cabin look={look} />}>
          <ModelCabin look={look} />
          {look.mirror !== 'none' && look.wall !== 'glass' && <Mirror look={look} />}
          {look.wall === 'glass' && <CityView D={look.depth} />}
        </Suspense>
      </ModelBoundary>
    </Canvas>
  );
}

class ModelBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(e: unknown) {
    console.warn('Cabin model unavailable, using procedural cabin', e);
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/* ---------------- camera ---------------- */

/**
 * Drag to look around, wheel to zoom. Cars are small, so the eye slides to the side
 * opposite the view direction: whatever wall you face is seen whole, not from 30 cm away.
 */
function LookControls({ look, focus }: { look: CabinLook; focus: Focus | null }) {
  const { camera, gl, invalidate, size } = useThree();
  const target = useRef({ yaw: 0.25, pitch: 0.02 });
  const current = useRef({ yaw: 0.25, pitch: 0.02 });
  const zoom = useRef(1);

  useEffect(() => {
    camera.rotation.order = 'YXZ';
    invalidate();
  }, [camera, look.width, look.depth, size.width, size.height, invalidate]);

  useEffect(() => {
    if (!focus) return;
    // Take the shortest way round to the requested heading.
    const cur = target.current.yaw;
    let yaw = focus.yaw;
    while (yaw - cur > Math.PI) yaw -= Math.PI * 2;
    while (yaw - cur < -Math.PI) yaw += Math.PI * 2;
    target.current = { yaw, pitch: focus.pitch };
    invalidate();
  }, [focus, invalidate]);

  useEffect(() => {
    const el = gl.domElement;
    let drag: { x: number; y: number; id: number } | null = null;
    const down = (e: PointerEvent) => {
      drag = { x: e.clientX, y: e.clientY, id: e.pointerId };
      el.setPointerCapture(e.pointerId);
      el.style.cursor = 'grabbing';
    };
    const move = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id) return;
      const k = 3.2 / el.clientHeight;
      target.current.yaw += (e.clientX - drag.x) * k;
      target.current.pitch = THREE.MathUtils.clamp(target.current.pitch + (e.clientY - drag.y) * k, -1.25, 1.25);
      drag.x = e.clientX;
      drag.y = e.clientY;
      invalidate();
    };
    const up = (e: PointerEvent) => {
      if (drag?.id === e.pointerId) drag = null;
      el.style.cursor = 'grab';
    };
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      zoom.current = THREE.MathUtils.clamp(zoom.current + e.deltaY * 0.0008, 0.6, 1.1);
      invalidate();
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('wheel', wheel, { passive: false });
    return () => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      el.removeEventListener('wheel', wheel);
    };
  }, [gl, camera, invalidate]);

  useFrame((_, dt) => {
    const c = current.current;
    const t = target.current;
    const k = 1 - Math.exp(-dt * 7);
    c.yaw += (t.yaw - c.yaw) * k;
    c.pitch += (t.pitch - c.pitch) * k;
    camera.rotation.set(c.pitch, c.yaw, 0, 'YXZ');

    // Eye position: back off from the viewed wall, staying ~15 cm inside the car.
    const dx = -Math.sin(c.yaw);
    const dz = -Math.cos(c.yaw);
    camera.position.set(-dx * (look.width / 2 - 0.15) * 0.85, 1.52, -dz * (look.depth / 2 - 0.15) * 0.85);

    // ~100° horizontal field of view whatever the screen shape.
    const cam = camera as THREE.PerspectiveCamera;
    const vfov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(50)) / cam.aspect));
    const fov = THREE.MathUtils.clamp(vfov, 55, 95) * zoom.current;
    if (Math.abs(cam.fov - fov) > 0.01) {
      cam.fov = fov;
      cam.updateProjectionMatrix();
    }
    if (Math.abs(t.yaw - c.yaw) > 1e-4 || Math.abs(t.pitch - c.pitch) > 1e-4) invalidate();
  });

  return null;
}

function Lights({ look }: { look: CabinLook }) {
  const y = look.height - 0.12;
  const warm = look.ceiling === 'crystal' ? '#fff1dc' : '#f4f7ff';
  const xs = look.width > 1.3 ? [-look.width / 4, look.width / 4] : [0];
  const zs = look.depth > 1.8 ? [-look.depth / 4, look.depth / 4] : [0];
  return (
    <>
      <ambientLight intensity={0.35} />
      <hemisphereLight args={['#ffffff', '#3a3530', 0.35]} />
      {xs.flatMap((x) =>
        zs.map((z) => <pointLight key={`${x}${z}`} position={[x, y, z]} intensity={3.2 / (xs.length * zs.length) + 1.2} distance={6} decay={2} color={warm} />),
      )}
    </>
  );
}

/* ---------------- cabin ---------------- */

function Cabin({ look }: { look: CabinLook }) {
  const wallMat = useWallMaterial(look);
  const { width: W, depth: D, height: H } = look;
  const glass = look.wall === 'glass';
  const sideMat = glass ? steel : wallMat;

  return (
    <group>
      <Floor look={look} />
      <Ceiling look={look} />

      {/* back wall */}
      {glass ? (
        <GlassBackWall W={W} D={D} H={H} />
      ) : (
        <PanelWall length={W} height={H} material={wallMat} position={[0, 0, -D / 2]} rotationY={0} />
      )}
      {/* side walls */}
      <PanelWall length={D} height={H} material={sideMat} position={[-W / 2, 0, 0]} rotationY={Math.PI / 2} />
      <PanelWall length={D} height={H} material={sideMat} position={[W / 2, 0, 0]} rotationY={-Math.PI / 2} />

      <DoorWall look={look} material={sideMat} />
      {look.mirror !== 'none' && !glass && <Mirror look={look} />}
      {look.handrail !== 'none' && <Handrails look={look} />}
      <CarPanel look={look} />

      {/* stainless kick plates */}
      <mesh position={[0, 0.05, -D / 2 + 0.011]} material={steel}>
        <boxGeometry args={[W, 0.1, 0.004]} />
      </mesh>
      <mesh position={[-W / 2 + 0.011, 0.05, 0]} rotation-y={Math.PI / 2} material={steel}>
        <boxGeometry args={[D, 0.1, 0.004]} />
      </mesh>
      <mesh position={[W / 2 - 0.011, 0.05, 0]} rotation-y={Math.PI / 2} material={steel}>
        <boxGeometry args={[D, 0.1, 0.004]} />
      </mesh>
    </group>
  );
}

/** A wall made of vertical panels with dark seams, the way real cars are built. */
function PanelWall({
  length,
  height,
  material,
  position,
  rotationY,
}: {
  length: number;
  height: number;
  material: THREE.Material;
  position: [number, number, number];
  rotationY: number;
}) {
  const n = Math.max(2, Math.round(length / 0.42));
  const pw = (length - GAP * (n + 1)) / n;
  return (
    <group position={position} rotation-y={rotationY}>
      <mesh position={[0, height / 2, -0.004]} material={seamMat}>
        <planeGeometry args={[length, height]} />
      </mesh>
      {Array.from({ length: n }).map((_, i) => (
        <mesh key={i} position={[-length / 2 + GAP + pw / 2 + i * (pw + GAP), height / 2, T / 2]} material={material}>
          <boxGeometry args={[pw, height - 0.004, T]} />
        </mesh>
      ))}
    </group>
  );
}

/** Night city seen through a panoramic back wall. */
function CityView({ D }: { D: number }) {
  const city = useMemo(() => cityTexture(), []);
  return (
    <mesh position={[0, 1.2, -D / 2 - 3]}>
      <planeGeometry args={[14, 7]} />
      <meshBasicMaterial map={city} toneMapped={false} />
    </mesh>
  );
}

function GlassBackWall({ W, D, H }: { W: number; D: number; H: number }) {
  return (
    <group>
      <CityView D={D} />
      <mesh position={[0, H / 2, -D / 2 + 0.01]}>
        <boxGeometry args={[W - 0.06, H - 0.06, 0.012]} />
        <meshPhysicalMaterial color="#d9eef5" transmission={1} roughness={0.03} thickness={0.012} ior={1.5} metalness={0} />
      </mesh>
      {/* frame */}
      {[
        [0, H - 0.03, W, 0.06],
        [0, 0.03, W, 0.06],
        [-W / 2 + 0.03, H / 2, 0.06, H],
        [W / 2 - 0.03, H / 2, 0.06, H],
        [0, H / 2, 0.04, H],
      ].map(([x, y, w, h], i) => (
        <mesh key={i} position={[x, y, -D / 2 + 0.02]} material={steel}>
          <boxGeometry args={[w, h, 0.04]} />
        </mesh>
      ))}
    </group>
  );
}

function Floor({ look }: { look: CabinLook }) {
  const mat = useFloorMaterial(look);
  return (
    <mesh rotation-x={-Math.PI / 2} material={mat}>
      <planeGeometry args={[look.width, look.depth]} />
    </mesh>
  );
}

function Ceiling({ look }: { look: CabinLook }) {
  const { width: W, depth: D, height: H } = look;
  const glow = (intensity: number, color = '#ffffff') => (
    <meshStandardMaterial color={color} emissive={color} emissiveIntensity={intensity} toneMapped={false} />
  );
  const crystals = useMemo(() => {
    const r = (s: number) => ((Math.sin(s * 91.7) * 43758.5453) % 1 + 1) % 1;
    return Array.from({ length: 110 }, (_, i) => ({
      x: (r(i) - 0.5) * (W - 0.5),
      z: (r(i + 100) - 0.5) * (D - 0.5),
      drop: 0.04 + r(i + 200) * 0.16,
      s: 0.018 + r(i + 300) * 0.02,
    }));
  }, [W, D]);

  return (
    <group position={[0, H, 0]}>
      <mesh rotation-x={Math.PI / 2}>
        <planeGeometry args={[W, D]} />
        {look.ceiling === 'mirror-led' ? (
          <meshStandardMaterial color="#e6e9ec" metalness={1} roughness={0.04} />
        ) : (
          <meshStandardMaterial color="#aeb3b8" metalness={0.9} roughness={0.35} />
        )}
      </mesh>

      {look.ceiling === 'led-panel' && (
        <>
          <mesh position={[0, -0.012, 0]} rotation-x={Math.PI / 2}>
            <planeGeometry args={[W - 0.38, D - 0.38]} />
            {glow(1.1)}
          </mesh>
        </>
      )}

      {look.ceiling === 'mirror-led' &&
        spotGrid(W, D).map(([x, z], i) => (
          <group key={i} position={[x, -0.004, z]}>
            <mesh rotation-x={Math.PI / 2}>
              <circleGeometry args={[0.035, 24]} />
              {glow(3, '#fff6e8')}
            </mesh>
            <mesh rotation-x={Math.PI / 2} position={[0, 0.001, 0]} material={steel}>
              <ringGeometry args={[0.035, 0.05, 24]} />
            </mesh>
          </group>
        ))}

      {look.ceiling === 'backlit' && (
        <>
          <mesh position={[0, -0.03, 0]} rotation-x={Math.PI / 2}>
            <planeGeometry args={[W - 0.12, D - 0.12]} />
            {glow(1.25, '#f3f7ff')}
          </mesh>
          {/* frame and dividers */}
          {Array.from({ length: Math.max(1, Math.round(D / 0.5)) - 1 }).map((_, i, arr) => (
            <mesh key={i} position={[0, -0.035, -D / 2 + 0.06 + ((i + 1) * (D - 0.12)) / (arr.length + 1)]} material={steel}>
              <boxGeometry args={[W - 0.12, 0.012, 0.025]} />
            </mesh>
          ))}
          <mesh position={[0, -0.035, 0]} material={steel}>
            <boxGeometry args={[0.025, 0.012, D - 0.12]} />
          </mesh>
        </>
      )}

      {look.ceiling === 'crystal' && (
        <>
          <mesh position={[0, -0.012, 0]} rotation-x={Math.PI / 2}>
            <planeGeometry args={[W - 0.3, D - 0.3]} />
            {glow(0.45, '#ffe9c7')}
          </mesh>
          {crystals.map((c, i) => (
            <group key={i} position={[c.x, -c.drop, c.z]}>
              <mesh position={[0, c.drop / 2, 0]} material={steel}>
                <cylinderGeometry args={[0.0015, 0.0015, c.drop, 4]} />
              </mesh>
              <mesh rotation={[0.4, i, 0.2]}>
                <octahedronGeometry args={[c.s, 0]} />
                <meshStandardMaterial color="#ffffff" metalness={1} roughness={0.02} emissive="#fff3dc" emissiveIntensity={0.25} />
              </mesh>
            </group>
          ))}
        </>
      )}

      {/* ventilation grille near the door */}
      {(look.extras.has('fan') || look.extras.has('ac')) && (
        <mesh position={[0, -0.006, D / 2 - 0.12]} material={darkSteel}>
          <boxGeometry args={[Math.min(0.6, W - 0.3), 0.01, look.extras.has('ac') ? 0.12 : 0.06]} />
        </mesh>
      )}
      {look.extras.has('camera') && (
        <mesh position={[W / 2 - 0.12, -0.03, -D / 2 + 0.12]}>
          <sphereGeometry args={[0.045, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color="#111" metalness={0.3} roughness={0.15} side={THREE.DoubleSide} />
        </mesh>
      )}
      {look.extras.has('voice') && (
        <mesh position={[-W / 2 + 0.15, -0.004, -D / 2 + 0.15]} rotation-x={Math.PI / 2} material={darkSteel}>
          <circleGeometry args={[0.04, 24]} />
        </mesh>
      )}
    </group>
  );
}

function spotGrid(W: number, D: number): [number, number][] {
  const cols = Math.max(2, Math.round(W / 0.4));
  const rows = Math.max(2, Math.round(D / 0.4));
  const pts: [number, number][] = [];
  for (let i = 0; i < cols; i++)
    for (let j = 0; j < rows; j++) pts.push([-W / 2 + ((i + 0.5) * W) / cols, -D / 2 + ((j + 0.5) * D) / rows]);
  return pts;
}

/** Real-time mirror: reflects the cabin itself, not just the environment. */
function Mirror({ look }: { look: CabinLook }) {
  const { width: W, depth: D } = look;
  const [y0, y1] = look.mirror === 'full' ? [0.12, 2.12] : [0.95, 2.05];
  const w = W - 0.16;
  const dpr = useThree((s) => s.viewport.dpr);
  // Planar Reflector rather than drei's MeshReflectorMaterial: the latter is tuned for
  // floors and drops the lower half of the image on a wall-mounted mirror.
  const reflector = useMemo(() => {
    const px = Math.min(2048, Math.round(1024 * dpr));
    return new Reflector(new THREE.PlaneGeometry(w, y1 - y0), {
      textureWidth: px,
      textureHeight: Math.round((px * (y1 - y0)) / w),
      color: 0xb9bdc2,
      clipBias: 0.003,
      multisample: 4,
    });
  }, [w, y0, y1, dpr]);
  useEffect(() => () => reflector.dispose(), [reflector]);
  return (
    // Mirror face sits 12 mm proud of the wall; the frame's front face stays 4 mm behind it
    // so the two surfaces never share a depth and z-fight.
    <group position={[0, (y0 + y1) / 2, -D / 2 + T + 0.012]}>
      <primitive object={reflector} />
      {/* frame */}
      <mesh position={[0, 0, -0.007]} material={steel}>
        <boxGeometry args={[w + 0.03, y1 - y0 + 0.03, 0.006]} />
      </mesh>
    </group>
  );
}

function Handrails({ look }: { look: CabinLook }) {
  const { width: W, depth: D } = look;
  const mat = useMemo(
    () =>
      look.handrail === 'gold'
        ? new THREE.MeshStandardMaterial({ color: '#d4af37', metalness: 1, roughness: 0.15 })
        : new THREE.MeshStandardMaterial({ color: '#dde1e5', metalness: 1, roughness: 0.18 }),
    [look.handrail],
  );
  const y = 0.9;
  const off = 0.055;
  const rail = (len: number, pos: [number, number, number], rotY: number, key: string) => (
    <group key={key} position={pos} rotation-y={rotY}>
      <mesh rotation-z={Math.PI / 2} material={mat}>
        <cylinderGeometry args={[0.019, 0.019, len, 20]} />
      </mesh>
      {[-len / 2 + 0.08, len / 2 - 0.08].map((x) => (
        <mesh key={x} position={[x, 0, -off / 2]} rotation-x={Math.PI / 2} material={mat}>
          <cylinderGeometry args={[0.01, 0.01, off, 10]} />
        </mesh>
      ))}
    </group>
  );
  const rails = [];
  if (look.wall !== 'glass') rails.push(rail(W - 0.3, [0, y, -D / 2 + T + off], 0, 'back'));
  rails.push(rail(D - 0.5, [-W / 2 + T + off, y, -0.1], Math.PI / 2, 'left'));
  rails.push(rail(D - 0.5, [W / 2 - T - off, y, -0.1], -Math.PI / 2, 'right'));
  return <>{rails}</>;
}

function DoorWall({ look, material }: { look: CabinLook; material: THREE.Material }) {
  const { width: W, depth: D, height: H } = look;
  const open = Math.min(W - 0.2, look.width >= 1.4 ? 1.1 : look.width >= 1.1 ? 0.9 : 0.8);
  const dh = 2.1;
  const side = (W - open) / 2;
  const z = D / 2;
  const doorMat = steel;

  return (
    <group position={[0, 0, z]} rotation-y={Math.PI}>
      {/* returns either side of the opening */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (open / 2 + side / 2), H / 2, T / 2]} material={material}>
          <boxGeometry args={[side, H, T]} />
        </mesh>
      ))}
      {/* header above the door */}
      <mesh position={[0, dh + (H - dh) / 2, T / 2]} material={material}>
        <boxGeometry args={[open, H - dh, T]} />
      </mesh>
      {/* frame */}
      {[-1, 1].map((s) => (
        <mesh key={`f${s}`} position={[s * (open / 2 + 0.012), dh / 2, T + 0.006]} material={steel}>
          <boxGeometry args={[0.024, dh, 0.012]} />
        </mesh>
      ))}
      <mesh position={[0, dh + 0.012, T + 0.006]} material={steel}>
        <boxGeometry args={[open + 0.048, 0.024, 0.012]} />
      </mesh>
      {/* door leaves (set back from the face) */}
      {look.door === 'center' ? (
        [-1, 1].map((s) => (
          <mesh key={`d${s}`} position={[s * (open / 4 + 0.002), dh / 2, -0.03]} material={doorMat}>
            <boxGeometry args={[open / 2 - 0.004, dh, 0.03]} />
          </mesh>
        ))
      ) : (
        <>
          <mesh position={[-open / 6, dh / 2, -0.03]} material={doorMat}>
            <boxGeometry args={[(open * 2) / 3, dh, 0.03]} />
          </mesh>
          <mesh position={[open / 3, dh / 2, -0.06]} material={doorMat}>
            <boxGeometry args={[open / 3 + 0.02, dh, 0.03]} />
          </mesh>
        </>
      )}
      {/* sill */}
      <mesh position={[0, 0.003, -0.02]} material={steel}>
        <boxGeometry args={[open + 0.1, 0.006, 0.09]} />
      </mesh>
      {/* light curtain strips */}
      {look.extras.has('light-curtain') &&
        [-1, 1].map((s) => (
          <mesh key={`lc${s}`} position={[s * (open / 2 - 0.01), 1.0, 0.0]} material={darkSteel}>
            <boxGeometry args={[0.012, 1.8, 0.012]} />
          </mesh>
        ))}
    </group>
  );
}

/** Car operating panel on the side wall next to the door. */
function CarPanel({ look }: { look: CabinLook }) {
  const { width: W, depth: D } = look;
  const h = look.cop === 'touch' ? 0.75 : 1.05;
  const w = look.cop === 'tft' ? 0.24 : 0.2;
  const y = look.cop === 'touch' ? 1.25 : 1.15;
  const display = useMemo(() => displayTexture(look.cop, Math.min(look.stops - 1, 3)), [look.cop, look.stops]);
  const touch = useMemo(() => (look.cop === 'touch' ? touchButtonsTexture(look.stops) : null), [look.cop, look.stops]);
  const buttons = Math.min(look.stops, 20);
  const rows = Math.ceil(buttons / 2);

  return (
    <group position={[-W / 2 + T + 0.004, y, D / 2 - 0.26]} rotation-y={Math.PI / 2}>
      <mesh position={[0, 0, 0.004]} material={look.cop === 'touch' ? darkSteel : steel}>
        <boxGeometry args={[w, h, 0.008]} />
      </mesh>
      {/* display */}
      <mesh position={[0, h / 2 - (look.cop === 'tft' ? 0.13 : 0.08), 0.0085]}>
        <planeGeometry args={look.cop === 'tft' ? [w - 0.04, (w - 0.04) * 0.75] : [w - 0.08, 0.08]} />
        <meshBasicMaterial map={display} toneMapped={false} />
      </mesh>
      {touch ? (
        <mesh position={[0, -0.08, 0.0086]}>
          <planeGeometry args={[w - 0.04, h - 0.32]} />
          <meshBasicMaterial map={touch} toneMapped={false} />
        </mesh>
      ) : (
        Array.from({ length: buttons }).map((_, i) => {
          const col = i % 2;
          const row = Math.floor(i / 2);
          const top = h / 2 - (look.cop === 'tft' ? 0.27 : 0.18);
          const step = Math.min(0.055, (h - 0.35) / rows);
          return (
            <group key={i} position={[(col - 0.5) * 0.07, top - row * step, 0.01]}>
              <mesh rotation-x={Math.PI / 2} material={steel}>
                <cylinderGeometry args={[0.016, 0.016, 0.006, 20]} />
              </mesh>
              <mesh position={[0, 0, 0.0032]}>
                <ringGeometry args={[0.011, 0.014, 20]} />
                <meshBasicMaterial color={i === 2 ? '#ff9b3d' : '#5fb4ff'} toneMapped={false} />
              </mesh>
            </group>
          );
        })
      )}
      {/* intercom grille and card reader */}
      {look.extras.has('intercom') && (
        <mesh position={[0, -h / 2 + 0.07, 0.009]} material={darkSteel}>
          <circleGeometry args={[0.025, 24]} />
        </mesh>
      )}
      {look.extras.has('card') && (
        <mesh position={[0, -h / 2 - 0.1, 0.01]} material={darkSteel}>
          <boxGeometry args={[0.09, 0.12, 0.02]} />
        </mesh>
      )}
    </group>
  );
}
