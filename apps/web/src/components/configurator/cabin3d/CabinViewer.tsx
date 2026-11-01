'use client';

import dynamic from 'next/dynamic';
import { Component, useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { CabinLook } from './look';
import type { Focus } from './CabinScene';

// three.js is only downloaded when a 3D view is actually shown.
const CabinScene = dynamic(() => import('./CabinScene'), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center text-sm text-silver">جاري تحميل العرض ثلاثي الأبعاد...</div>,
});

const VIEWS: { label: string; yaw: number; pitch: number }[] = [
  { label: 'الحائط الخلفي', yaw: 0, pitch: 0 },
  { label: 'السقف', yaw: 0, pitch: 1.05 },
  { label: 'الأرضية', yaw: 0, pitch: -1.0 },
  { label: 'الباب', yaw: Math.PI, pitch: -0.05 },
  { label: 'لوحة التشغيل', yaw: Math.PI - 0.55, pitch: 0 },
];

class WebGLBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export function CabinViewer({
  look,
  focus,
  fallback,
  className = '',
  open,
  onOpenChange,
}: {
  look: CabinLook;
  focus: Focus | null;
  fallback: ReactNode;
  className?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [view, setView] = useState<Focus | null>(null);
  const active = view && (!focus || view.key > focus.key) ? view : focus;
  const pick = (v: (typeof VIEWS)[number]) => setView({ yaw: v.yaw, pitch: v.pitch, key: Date.now() });

  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onOpenChange(false);
    document.addEventListener('keydown', esc);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', esc);
      document.body.style.overflow = '';
    };
  }, [open, onOpenChange]);

  const scene = (
    <WebGLBoundary fallback={fallback}>
      <CabinScene look={look} focus={active} />
    </WebGLBoundary>
  );

  return (
    <>
      <div className={`relative ${className}`}>
        {!open && scene}
        <span className="pointer-events-none absolute bottom-2 right-2 rounded-full bg-black/45 px-2.5 py-1 text-[11px] text-white">اسحب للنظر حولك</span>
        <button
          type="button"
          onClick={() => onOpenChange(true)}
          className="absolute left-2 top-2 rounded-lg bg-black/45 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-black/60"
        >
          ⛶ عرض كامل
        </button>
      </div>

      {open &&
        // Portal: the inline viewer may sit inside a container hidden on small screens.
        createPortal(
          <div role="dialog" aria-modal="true" aria-label="معاينة الكابينة ثلاثية الأبعاد" className="fixed inset-0 z-50 flex flex-col bg-navy">
            <div className="flex items-center justify-between gap-3 px-4 py-3 text-white">
              <b>معاينة الكابينة من الداخل</b>
              <button type="button" onClick={() => onOpenChange(false)} className="rounded-lg border border-white/25 px-3 py-1.5 text-sm hover:bg-white/10">
                إغلاق ✕
              </button>
            </div>
            <div className="relative min-h-0 flex-1">{scene}</div>
            <div className="flex gap-2 overflow-x-auto px-4 py-3">
              {VIEWS.map((v) => (
                <button
                  key={v.label}
                  type="button"
                  onClick={() => pick(v)}
                  className="shrink-0 rounded-full border border-white/25 px-3.5 py-1.5 text-sm text-white hover:bg-white/10"
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
