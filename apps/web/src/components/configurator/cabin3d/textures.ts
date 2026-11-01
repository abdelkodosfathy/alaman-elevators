import * as THREE from 'three';

// Procedural textures drawn on canvas: no image assets to download or license.
// Cached per key so switching finishes back and forth doesn't regenerate them.

const cache = new Map<string, THREE.CanvasTexture>();

function make(key: string, w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void, color = true) {
  const hit = cache.get(key);
  if (hit) return hit;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  draw(canvas.getContext('2d')!);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  if (color) tex.colorSpace = THREE.SRGBColorSpace;
  cache.set(key, tex);
  return tex;
}

/** Seeded PRNG so textures look the same on every load. */
function rng(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

/** Vertical brushed lines used as roughness map for hairline stainless. */
export const hairlineRoughness = () =>
  make(
    'hairline',
    512,
    512,
    (ctx) => {
      const r = rng(7);
      ctx.fillStyle = '#5a5a5a';
      ctx.fillRect(0, 0, 512, 512);
      for (let i = 0; i < 2200; i++) {
        const x = r() * 512;
        const v = 60 + r() * 90;
        ctx.strokeStyle = `rgba(${v},${v},${v},${0.25 + r() * 0.4})`;
        ctx.lineWidth = 0.6 + r() * 1.2;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x + (r() - 0.5) * 2, 512);
        ctx.stroke();
      }
    },
    false,
  );

export const woodTexture = () =>
  make('wood', 512, 1024, (ctx) => {
    const r = rng(11);
    const g = ctx.createLinearGradient(0, 0, 512, 0);
    g.addColorStop(0, '#7a5636');
    g.addColorStop(0.5, '#8d6642');
    g.addColorStop(1, '#73502f');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 512, 1024);
    for (let i = 0; i < 140; i++) {
      const x = r() * 512;
      const amp = 4 + r() * 14;
      const freq = 0.004 + r() * 0.01;
      ctx.strokeStyle = `rgba(${50 + r() * 30},${30 + r() * 20},${15},${0.15 + r() * 0.3})`;
      ctx.lineWidth = 0.8 + r() * 2.5;
      ctx.beginPath();
      for (let y = 0; y <= 1024; y += 8) {
        const px = x + Math.sin(y * freq + i) * amp;
        if (y === 0) ctx.moveTo(px, y);
        else ctx.lineTo(px, y);
      }
      ctx.stroke();
    }
  });

function speckle(key: string, base: string, colors: string[], count: number, size: [number, number], seed: number) {
  return make(key, 512, 512, (ctx) => {
    const r = rng(seed);
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < count; i++) {
      ctx.fillStyle = colors[Math.floor(r() * colors.length)];
      ctx.globalAlpha = 0.35 + r() * 0.65;
      const s = size[0] + r() * (size[1] - size[0]);
      ctx.beginPath();
      ctx.ellipse(r() * 512, r() * 512, s, s * (0.5 + r() * 0.6), r() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  });
}

export const granite = () => speckle('granite', '#5d5a57', ['#2b2a29', '#8c8782', '#c9c3bc', '#3d3936', '#a39a90'], 9000, [0.8, 3.2], 3);
export const pvc = () => speckle('pvc', '#3b3f45', ['#2f3237', '#4a4f56', '#565b62'], 5000, [0.5, 1.6], 5);

export const marble = () =>
  make('marble', 1024, 1024, (ctx) => {
    const r = rng(19);
    ctx.fillStyle = '#ece8e1';
    ctx.fillRect(0, 0, 1024, 1024);
    const veins = (alpha: number, width: number, n: number) => {
      for (let i = 0; i < n; i++) {
        let x = r() * 1024;
        let y = r() * 1024;
        const angle = -0.6 + r() * 0.5;
        ctx.strokeStyle = `rgba(95,88,80,${alpha * (0.4 + r() * 0.6)})`;
        ctx.lineWidth = width * (0.4 + r());
        ctx.beginPath();
        ctx.moveTo(x, y);
        for (let s = 0; s < 60; s++) {
          x += Math.cos(angle) * 18 + (r() - 0.5) * 22;
          y += Math.sin(angle) * 18 + (r() - 0.5) * 22;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    };
    veins(0.25, 7, 12);
    veins(0.6, 2, 30);
    veins(0.85, 0.8, 36);
  });

/** Floor indicator for the car panel: floor number and direction arrow. */
export const displayTexture = (style: 'lcd' | 'tft' | 'touch', floor: number) =>
  make(`display-${style}-${floor}`, 256, 256, (ctx) => {
    const bg = style === 'lcd' ? '#06142b' : style === 'tft' ? '#0b1f3d' : '#0a0f18';
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 256, 256);
    if (style === 'tft') {
      const g = ctx.createLinearGradient(0, 0, 0, 256);
      g.addColorStop(0, '#1b4f9c');
      g.addColorStop(1, '#0b1f3d');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 256, 256);
    }
    const fg = style === 'lcd' ? '#4fb3ff' : '#ffffff';
    ctx.fillStyle = fg;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 120px Arial';
    ctx.fillText(String(floor), 150, 135);
    ctx.beginPath();
    ctx.moveTo(60, 95);
    ctx.lineTo(90, 135);
    ctx.lineTo(30, 135);
    ctx.closePath();
    ctx.fill();
    if (style !== 'lcd') {
      ctx.font = '22px Arial';
      ctx.fillStyle = 'rgba(255,255,255,.75)';
      ctx.fillText('ALAMAN', 128, 225);
    }
  });

/** Touch panel: grid of floor buttons drawn as one glowing texture. */
export const touchButtonsTexture = (stops: number) =>
  make(`touch-${stops}`, 256, 512, (ctx) => {
    ctx.fillStyle = '#0a0f18';
    ctx.fillRect(0, 0, 256, 512);
    const cols = 3;
    const rows = Math.ceil(stops / cols);
    const cell = Math.min(80, 480 / rows);
    for (let i = 0; i < stops; i++) {
      const col = i % cols;
      const row = rows - 1 - Math.floor(i / cols);
      const cx = 48 + col * 80;
      const cy = 20 + row * cell + cell / 2;
      ctx.strokeStyle = 'rgba(120,190,255,.9)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(cx, cy, Math.min(28, cell / 2 - 6), 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#cfe8ff';
      ctx.font = `bold ${Math.min(26, cell / 2.4)}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(i === 0 ? 'G' : String(i), cx, cy + 1);
    }
  });

/** Night city seen through a panoramic glass wall. */
export const cityTexture = () =>
  make('city', 1024, 512, (ctx) => {
    const r = rng(23);
    const sky = ctx.createLinearGradient(0, 0, 0, 512);
    sky.addColorStop(0, '#0b1a33');
    sky.addColorStop(0.6, '#24406b');
    sky.addColorStop(1, '#e09a5b');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, 1024, 512);
    for (let layer = 0; layer < 3; layer++) {
      let x = 0;
      while (x < 1024) {
        const w = 30 + r() * 70;
        const h = 80 + r() * (200 + layer * 60);
        const shade = 12 + layer * 10;
        ctx.fillStyle = `rgb(${shade},${shade + 6},${shade + 18})`;
        ctx.fillRect(x, 512 - h, w, h);
        for (let wy = 512 - h + 8; wy < 500; wy += 12) {
          for (let wx = x + 5; wx < x + w - 6; wx += 10) {
            if (r() < 0.38) {
              ctx.fillStyle = `rgba(255,${200 + r() * 50},${120 + r() * 60},${0.5 + r() * 0.5})`;
              ctx.fillRect(wx, wy, 4, 6);
            }
          }
        }
        x += w + r() * 6;
      }
    }
  });
