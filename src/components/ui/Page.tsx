import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  icon?: string;
  actions?: ReactNode;
}

export function PageHeader({ title, subtitle, icon, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
      <div className="flex items-center gap-3.5">
        {icon && (
          <div className="w-12 h-12 rounded-2xl brand-gradient text-white flex items-center justify-center shadow-glow ring-1 ring-white/20">
            <i className={`fa-solid ${icon} text-xl`}></i>
          </div>
        )}
        <div>
          <h1 className="text-2xl font-extrabold text-ink-800 dark:text-ink-50 tracking-tight">{title}</h1>
          {subtitle && <p className="text-sm text-ink-400 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

interface KpiCardProps {
  label: string;
  value: string;
  icon: string;
  color?: 'royal' | 'emerald' | 'amber' | 'red' | 'ink' | 'accent';
  hint?: string;
}

const KPI_COLORS = {
  royal: 'from-royal-500 to-royal-700',
  emerald: 'from-emerald-500 to-emerald-700',
  amber: 'from-amber-400 to-amber-600',
  red: 'from-red-500 to-red-700',
  ink: 'from-ink-600 to-ink-800',
  accent: 'from-accent-400 to-accent-600',
};

const KPI_GLOW = {
  royal: 'shadow-[0_8px_24px_-8px_rgba(37,99,235,0.45)]',
  emerald: 'shadow-[0_8px_24px_-8px_rgba(16,185,129,0.45)]',
  amber: 'shadow-[0_8px_24px_-8px_rgba(245,158,11,0.45)]',
  red: 'shadow-[0_8px_24px_-8px_rgba(239,68,68,0.45)]',
  ink: 'shadow-[0_8px_24px_-8px_rgba(15,23,42,0.4)]',
  accent: 'shadow-[0_8px_24px_-8px_rgba(6,182,212,0.45)]',
};

export function KpiCard({ label, value, icon, color = 'royal', hint }: KpiCardProps) {
  return (
    <div className="card card-hover p-5 relative overflow-hidden">
      <div className={`absolute -left-6 -top-6 w-24 h-24 rounded-full bg-gradient-to-br ${KPI_COLORS[color]} opacity-[0.07] blur-xl`}></div>
      <div className="flex items-start justify-between relative">
        <div>
          <p className="text-sm text-ink-400 font-medium">{label}</p>
          <p className="text-2xl font-extrabold text-ink-800 dark:text-ink-50 mt-1 num">{value}</p>
          {hint && <p className="text-xs text-ink-300 mt-1">{hint}</p>}
        </div>
        <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${KPI_COLORS[color]} ${KPI_GLOW[color]} text-white flex items-center justify-center`}>
          <i className={`fa-solid ${icon} text-lg`}></i>
        </div>
      </div>
    </div>
  );
}

export function SectionCard({ title, icon, actions, children, className = '' }: {
  title?: string; icon?: string; actions?: ReactNode; children: ReactNode; className?: string;
}) {
  return (
    <section className={`card ${className}`}>
      {(title || actions) && (
        <header className="flex items-center justify-between px-5 py-4 border-b border-ink-100 dark:border-white/10">
          <h2 className="font-bold text-ink-700 dark:text-ink-100 flex items-center gap-2.5">
            {icon && (
              <span className="w-8 h-8 rounded-xl bg-royal-50 text-royal-500 dark:bg-royal-500/15 dark:text-royal-300 flex items-center justify-center text-sm">
                <i className={`fa-solid ${icon}`}></i>
              </span>
            )}
            {title}
          </h2>
          {actions}
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

export function EmptyState({ icon = 'fa-inbox', title, hint }: { icon?: string; title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-center">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-ink-50 to-royal-50 text-royal-300 ring-1 ring-ink-100 dark:from-ink-700 dark:to-ink-800 dark:ring-white/10 flex items-center justify-center mb-4">
        <i className={`fa-solid ${icon} text-2xl`}></i>
      </div>
      <p className="text-ink-500 dark:text-ink-300 font-semibold">{title}</p>
      {hint && <p className="text-sm text-ink-300 mt-1">{hint}</p>}
    </div>
  );
}
