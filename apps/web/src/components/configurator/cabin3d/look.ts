import type { Configurator, Selections } from '@/lib/types';

// Turns configurator selections into what the 3D cabin should look like.
// Keyed by the last segment of option codes (elv.walls.glass -> "glass"); unknown
// options fall back to their swatch color so finishes added from the admin still render.

export type WallFinish = 'satin' | 'hairline' | 'gold-mirror' | 'black' | 'wood' | 'glass' | 'custom';
export type CeilingStyle = 'led-panel' | 'mirror-led' | 'backlit' | 'crystal';
export type FloorStyle = 'pvc' | 'granite' | 'marble';
export type DisplayStyle = 'lcd' | 'tft' | 'touch';

export interface CabinLook {
  /** Rated load key; picks the Blender model (public/models/cabin/cabin-<size>.glb). */
  size: string;
  width: number;
  depth: number;
  height: number;
  wall: WallFinish;
  wallColor: string;
  ceiling: CeilingStyle;
  floor: FloorStyle;
  handrail: 'none' | 'ss' | 'gold';
  mirror: 'none' | 'half' | 'full';
  door: 'center' | 'side';
  cop: DisplayStyle;
  stops: number;
  extras: Set<string>;
}

/** Inner car dimensions (m) per rated load, close to EN 81-20 sizes. Keep in sync with blender/build_cabin.py. */
const SIZES: Record<string, [number, number]> = {
  '320': [1.0, 1.1],
  '450': [1.0, 1.25],
  '630': [1.1, 1.4],
  '800': [1.35, 1.4],
  '1000': [1.6, 1.4],
  '1600': [1.4, 2.4],
};

const WALLS: Record<string, WallFinish> = {
  'ss-std': 'satin',
  'ss-hairline': 'hairline',
  'ss-mirror-gold': 'gold-mirror',
  'ss-black': 'black',
  wood: 'wood',
  glass: 'glass',
};

const tail = (v: Selections[string] | undefined) => String(v ?? '').split('.').pop() ?? '';

export function cabinLook(config: Configurator, sel: Selections): CabinLook {
  const wallOpt = config.steps.flatMap((s) => s.attributes).find((a) => a.key === 'walls')?.options.find((o) => o.code === sel.walls);
  const size = tail(sel.capacity) in SIZES ? tail(sel.capacity) : '630';
  const [width, depth] = SIZES[size];
  const pick = <T extends string>(v: string, allowed: readonly T[], fallback: T): T => ((allowed as readonly string[]).includes(v) ? (v as T) : fallback);
  const extras = new Set(((sel.extras as string[]) ?? []).map((c) => c.split('.').pop()!));

  return {
    size,
    width,
    depth,
    height: 2.25,
    wall: WALLS[tail(sel.walls)] ?? 'custom',
    wallColor: wallOpt?.swatch ?? '#a7adb3',
    ceiling: pick(tail(sel.ceiling), ['led-panel', 'mirror-led', 'backlit', 'crystal'] as const, 'led-panel'),
    floor: pick(tail(sel.floor), ['pvc', 'granite', 'marble'] as const, 'pvc'),
    handrail: pick(tail(sel.handrail), ['none', 'ss', 'gold'] as const, 'ss'),
    mirror: pick(tail(sel.mirror), ['none', 'half', 'full'] as const, 'half'),
    door: tail(sel['door-type']) === 'auto-center' ? 'center' : 'side',
    cop: pick(tail(sel.cop), ['lcd', 'tft', 'touch'] as const, 'lcd'),
    stops: Math.max(2, Math.min(20, Number(sel.stops) || 5)),
    extras,
  };
}

/** Where the camera should turn when a given attribute changes. Yaw 0 faces the back wall. */
export const FOCUS: Record<string, { yaw: number; pitch: number }> = {
  walls: { yaw: 0, pitch: 0 },
  mirror: { yaw: 0, pitch: 0 },
  handrail: { yaw: 0.5, pitch: -0.25 },
  ceiling: { yaw: 0, pitch: 1.05 },
  floor: { yaw: 0, pitch: -1.0 },
  'door-type': { yaw: Math.PI, pitch: -0.05 },
  cop: { yaw: Math.PI - 0.55, pitch: 0 },
  capacity: { yaw: 0.35, pitch: 0.05 },
  extras: { yaw: 0, pitch: 0.75 },
};
