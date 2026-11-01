// Lightweight SVG previews; colors come from option swatches so new finishes show up automatically.

export function ProductIllustration({ kind }: { kind: 'ELEVATOR' | 'ESCALATOR' }) {
  return kind === 'ELEVATOR' ? (
    <CabinPreview wall="#a7adb3" floor="#3a3f47" handrail="#d8dee6" className="h-40" />
  ) : (
    <EscalatorPreview handrail="#1b1b1b" glass className="h-40" />
  );
}

export function CabinPreview({
  wall,
  floor,
  handrail,
  mirror = 'half',
  glass = false,
  className = '',
}: {
  wall: string;
  floor: string;
  handrail?: string | null;
  mirror?: 'none' | 'half' | 'full';
  glass?: boolean;
  className?: string;
}) {
  return (
    <svg viewBox="0 0 200 220" className={className} role="img" aria-label="معاينة الكابينة">
      <defs>
        <linearGradient id="wallShade" x1="0" x2="1">
          <stop offset="0" stopColor="#000" stopOpacity=".25" />
          <stop offset=".5" stopColor="#fff" stopOpacity=".12" />
          <stop offset="1" stopColor="#000" stopOpacity=".25" />
        </linearGradient>
      </defs>
      {/* frame */}
      <rect x="10" y="6" width="180" height="208" rx="6" fill="#0d1d36" stroke="#2b3d5c" />
      {/* ceiling light */}
      <polygon points="22,18 178,18 152,40 48,40" fill="#e9eef5" opacity=".9" />
      {/* side walls */}
      <polygon points="22,18 48,40 48,170 22,200" fill={wall} />
      <polygon points="178,18 152,40 152,170 178,200" fill={wall} />
      <polygon points="22,18 48,40 48,170 22,200" fill="url(#wallShade)" />
      <polygon points="178,18 152,40 152,170 178,200" fill="url(#wallShade)" />
      {/* back wall */}
      <rect x="48" y="40" width="104" height="130" fill={glass ? '#9fc9d9' : wall} opacity={glass ? 0.75 : 1} />
      {mirror !== 'none' && !glass && (
        <rect x="60" y={mirror === 'full' ? 48 : 70} width="80" height={mirror === 'full' ? 112 : 62} rx="2" fill="#dfe7ef" opacity=".55" />
      )}
      {glass && <path d="M60 50 L80 50 L62 90 Z" fill="#fff" opacity=".35" />}
      {/* floor */}
      <polygon points="48,170 152,170 178,200 22,200" fill={floor} />
      {/* handrail */}
      {handrail && <rect x="48" y="122" width="104" height="4" rx="2" fill={handrail} />}
      {/* panel */}
      <rect x="140" y="80" width="6" height="34" rx="1" fill="#0a192f" opacity=".6" />
    </svg>
  );
}

export function EscalatorPreview({ handrail, glass, className = '' }: { handrail: string; glass: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 240 180" className={className} role="img" aria-label="معاينة السلم المتحرك">
      <path d="M20 150 L70 150 L170 50 L220 50 L220 70 L178 70 L78 170 L20 170 Z" fill="#2b3d5c" />
      {Array.from({ length: 10 }).map((_, i) => (
        <rect key={i} x={74 + i * 10} y={142 - i * 10} width="12" height="3" fill="#b7c0cb" />
      ))}
      <path
        d="M20 120 L66 120 L166 20 L220 20 L220 50 L170 50 L70 150 L20 150 Z"
        fill={glass ? '#9fc9d9' : '#c3c8cd'}
        opacity={glass ? 0.45 : 0.9}
      />
      <path d="M20 120 L66 120 L166 20 L220 20" fill="none" stroke={handrail} strokeWidth="7" strokeLinecap="round" />
    </svg>
  );
}
