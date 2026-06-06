interface LogoProps {
  /** size in px for the mark */
  size?: number;
  /** show the wordmark text next to the mark */
  showText?: boolean;
  /** color theme of the text (for dark vs light backgrounds) */
  variant?: 'light' | 'dark';
  className?: string;
}

/**
 * Nasim ERP brand mark — a rounded-square monogram "N" with a flowing
 * breeze motif (نسيم) in a sky→indigo gradient. Pure SVG, crisp at any size.
 */
export function Logo({ size = 40, showText = true, variant = 'dark', className = '' }: LogoProps) {
  const gid = 'nasimGrad';
  const textMain = variant === 'light' ? 'text-white' : 'text-ink-800';
  const textSub = variant === 'light' ? 'text-white/55' : 'text-ink-400';
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <svg width={size} height={size} viewBox="0 0 64 64" className="shrink-0 drop-shadow-sm" aria-hidden="true">
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#0ea5e9" />
            <stop offset="0.5" stopColor="#2563eb" />
            <stop offset="1" stopColor="#4f46e5" />
          </linearGradient>
        </defs>
        <rect x="2" y="2" width="60" height="60" rx="16" fill={`url(#${gid})`} />
        <path d="M14 26c6-6 12 6 18 0s12-6 18 0" fill="none" stroke="#ffffff" strokeWidth="3.4" strokeLinecap="round" opacity="0.55" />
        <path d="M14 44c6-6 12 6 18 0s12-6 18 0" fill="none" stroke="#ffffff" strokeWidth="3.4" strokeLinecap="round" opacity="0.55" />
        <path d="M22 44V22l20 20V20" fill="none" stroke="#ffffff" strokeWidth="5.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {showText && (
        <div className="leading-tight">
          <p className={`font-extrabold tracking-tight ${textMain}`} style={{ fontSize: size * 0.5 }}>
            Nasim <span className="text-sky-500">ERP</span>
          </p>
          <p className={`text-[11px] ${textSub}`}>عالم البرمجة للصيانة والبرمجة</p>
        </div>
      )}
    </div>
  );
}
