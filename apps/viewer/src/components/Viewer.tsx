'use client';

import { useProgress } from '@react-three/drei';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import type * as THREE from 'three';
import type { ModelInfo } from './inspect';
import { loadHDRI } from './loaders';
import type { EnvKind, ToneKind, ViewSettings } from './Scene';

const Scene = dynamic(() => import('./Scene'), { ssr: false });

interface ModelEntry {
  name: string;
  url: string;
}

const DEFAULTS: ViewSettings = {
  env: 'studio',
  envIntensity: 1,
  envRotation: 0,
  background: false,
  blur: 0.4,
  tone: 'agx',
  exposure: 1,
  shadows: true,
  autoRotate: false,
};

export default function Viewer({ models: initial }: { models: ModelEntry[] }) {
  const [models, setModels] = useState(initial);
  // open the material showcase first when it's there: it exercises every PBR extension
  const [url, setUrl] = useState((initial.find((m) => m.url.includes('material-showcase')) ?? initial[0])?.url ?? '');
  const [settings, setSettings] = useState(DEFAULTS);
  const [hdri, setHdri] = useState<THREE.Texture | null>(null);
  const [hdriName, setHdriName] = useState('');
  const [info, setInfo] = useState<ModelInfo | null>(null);
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const set = <K extends keyof ViewSettings>(k: K, v: ViewSettings[K]) => setSettings((s) => ({ ...s, [k]: v }));

  const select = (next: string) => {
    setError('');
    setInfo(null);
    setUrl(next);
  };

  const openFiles = useCallback(async (files: FileList | File[]) => {
    for (const file of Array.from(files)) {
      if (/\.glb$/i.test(file.name)) {
        const blob = URL.createObjectURL(file);
        setModels((m) => [...m, { name: `${file.name.replace(/\.glb$/i, '')} (local)`, url: blob }]);
        setError('');
        setInfo(null);
        setUrl(blob);
      } else if (/\.(hdr|exr)$/i.test(file.name)) {
        try {
          const tex = await loadHDRI(file);
          setHdri((old) => (old?.dispose(), tex));
          setHdriName(file.name);
          setSettings((s) => ({ ...s, env: 'custom' }));
        } catch (e) {
          setError(`Could not read ${file.name}: ${e instanceof Error ? e.message : e}`);
        }
      } else {
        setError(`${file.name}: drop a .glb model or an .hdr / .exr environment`);
      }
    }
  }, []);

  useEffect(() => {
    const over = (e: DragEvent) => {
      e.preventDefault();
      setDragging(true);
    };
    const leave = (e: DragEvent) => e.relatedTarget === null && setDragging(false);
    const drop = (e: DragEvent) => {
      e.preventDefault();
      setDragging(false);
      if (e.dataTransfer?.files.length) openFiles(e.dataTransfer.files);
    };
    window.addEventListener('dragover', over);
    window.addEventListener('dragleave', leave);
    window.addEventListener('drop', drop);
    return () => {
      window.removeEventListener('dragover', over);
      window.removeEventListener('dragleave', leave);
      window.removeEventListener('drop', drop);
    };
  }, [openFiles]);

  return (
    <div className="flex h-dvh flex-col lg:flex-row">
      <aside className="flex shrink-0 flex-col gap-5 overflow-y-auto border-line bg-panel p-4 lg:w-72 lg:border-r">
        <header>
          <h1 className="text-base font-semibold">GLB Viewer</h1>
          <p className="text-xs text-muted">Physically based rendering with image-based lighting</p>
        </header>

        <Section title="Models">
          <ul className="flex flex-col gap-1">
            {models.map((m) => (
              <li key={m.url}>
                <button
                  onClick={() => select(m.url)}
                  className={`w-full truncate rounded px-2 py-1.5 text-left text-sm capitalize ${m.url === url ? 'bg-accent/15 text-accent' : 'hover:bg-white/5'}`}
                >
                  {m.name}
                </button>
              </li>
            ))}
          </ul>
          <button onClick={() => fileInput.current?.click()} className="mt-2 w-full rounded border border-dashed border-line px-2 py-2 text-xs text-muted hover:border-accent hover:text-accent">
            Open .glb / .hdr / .exr… or drop anywhere
          </button>
          <input ref={fileInput} type="file" accept=".glb,.hdr,.exr" multiple hidden onChange={(e) => e.target.files && openFiles(e.target.files)} />
        </Section>

        <Section title="Environment">
          <Segmented<EnvKind>
            value={settings.env}
            onChange={(v) => set('env', v)}
            options={[
              ['studio', 'Studio'],
              ['softbox', 'Softbox'],
              ...(hdri ? ([['custom', 'HDRI']] as [EnvKind, string][]) : []),
            ]}
          />
          {settings.env === 'custom' && <p className="truncate text-xs text-muted">{hdriName}</p>}
          <Slider label="Intensity" value={settings.envIntensity} min={0} max={3} step={0.05} onChange={(v) => set('envIntensity', v)} />
          <Slider label="Rotation" value={settings.envRotation} min={0} max={360} step={1} unit="°" onChange={(v) => set('envRotation', v)} />
          <Toggle label="Show as background" checked={settings.background} onChange={(v) => set('background', v)} />
          {settings.background && <Slider label="Background blur" value={settings.blur} min={0} max={1} step={0.01} onChange={(v) => set('blur', v)} />}
        </Section>

        <Section title="Camera">
          <Segmented<ToneKind>
            value={settings.tone}
            onChange={(v) => set('tone', v)}
            options={[
              ['agx', 'AgX'],
              ['aces', 'ACES'],
              ['neutral', 'Neutral'],
            ]}
          />
          <Slider label="Exposure" value={settings.exposure} min={0.1} max={3} step={0.05} onChange={(v) => set('exposure', v)} />
          <Toggle label="Ground shadow" checked={settings.shadows} onChange={(v) => set('shadows', v)} />
          <Toggle label="Auto-rotate" checked={settings.autoRotate} onChange={(v) => set('autoRotate', v)} />
        </Section>
      </aside>

      <main className="relative min-h-[50vh] flex-1">
        {url ? (
          <Scene url={url} settings={settings} hdri={hdri} onLoaded={setInfo} onError={setError} />
        ) : (
          <Empty>Add .glb files to public/models, or drop one here.</Empty>
        )}
        <Progress />
        {error && <div className="absolute inset-x-4 top-4 rounded bg-red-500/90 px-3 py-2 text-sm text-white">{error}</div>}
        {dragging && <Empty overlay>Drop to open</Empty>}
      </main>

      <MaterialPanel info={info} />
    </div>
  );
}

function MaterialPanel({ info }: { info: ModelInfo | null }) {
  return (
    <aside className="shrink-0 overflow-y-auto border-line bg-panel p-4 lg:w-80 lg:border-l">
      <h2 className="mb-3 text-xs font-semibold tracking-wider text-muted uppercase">Inspector</h2>
      {!info ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : (
        <>
          <dl className="mb-4 grid grid-cols-2 gap-2 text-sm">
            {(
              [
                ['Meshes', info.meshes],
                ['Triangles', info.triangles.toLocaleString()],
                ['Textures', info.textures],
                ['Animations', info.animations],
              ] as const
            ).map(([k, v]) => (
              <div key={k} className="rounded bg-white/5 px-2 py-1.5">
                <dt className="text-xs text-muted">{k}</dt>
                <dd className="font-medium tabular-nums">{v}</dd>
              </div>
            ))}
          </dl>
          <h3 className="mb-2 text-xs font-semibold tracking-wider text-muted uppercase">Materials ({info.materials.length})</h3>
          <ul className="flex flex-col gap-2">
            {info.materials.map((m, i) => (
              <li key={i} className="rounded border border-line p-2 text-xs">
                <div className="mb-1 flex items-center gap-2">
                  {m.color && <span className="size-4 shrink-0 rounded-sm border border-white/20" style={{ background: m.color }} />}
                  <span className="truncate text-sm font-medium">{m.name}</span>
                  <span className="ml-auto shrink-0 text-muted">{m.type}</span>
                </div>
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 text-muted">
                  {m.props.map(([k, v]) => (
                    <div key={k} className="contents">
                      <dt>{k}</dt>
                      <dd className="text-right text-ink tabular-nums">{v}</dd>
                    </div>
                  ))}
                </dl>
                {m.maps.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {m.maps.map((t) => (
                      <span key={t} className="rounded bg-accent/15 px-1.5 py-0.5 text-[10px] text-accent">
                        {t}
                      </span>
                    ))}
                  </div>
                )}
                <p className="mt-1 text-[10px] text-muted">
                  {m.meshes} mesh{m.meshes === 1 ? '' : 'es'}
                </p>
              </li>
            ))}
          </ul>
        </>
      )}
    </aside>
  );
}

function Progress() {
  const { active, progress } = useProgress();
  if (!active) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1 bg-white/5">
      <div className="h-full bg-accent transition-[width]" style={{ width: `${progress}%` }} />
    </div>
  );
}

function Empty({ children, overlay }: { children: ReactNode; overlay?: boolean }) {
  return (
    <div className={`absolute inset-0 grid place-items-center text-sm text-muted ${overlay ? 'border-2 border-dashed border-accent bg-bg/80 text-accent' : ''}`}>
      {children}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5">
      <h2 className="text-xs font-semibold tracking-wider text-muted uppercase">{title}</h2>
      {children}
    </section>
  );
}

function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: [T, string][] }) {
  return (
    <div className="flex rounded bg-white/5 p-0.5">
      {options.map(([v, label]) => (
        <button key={v} onClick={() => onChange(v)} className={`flex-1 rounded px-2 py-1 text-xs ${v === value ? 'bg-accent text-bg font-medium' : 'text-muted hover:text-ink'}`}>
          {label}
        </button>
      ))}
    </div>
  );
}

function Slider({ label, value, min, max, step, unit = '', onChange }: { label: string; value: number; min: number; max: number; step: number; unit?: string; onChange: (v: number) => void }) {
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="flex justify-between text-muted">
        {label}
        <span className="text-ink tabular-nums">
          {value}
          {unit}
        </span>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between text-xs text-muted">
      {label}
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="accent-accent" />
    </label>
  );
}
