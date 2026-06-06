import { useEffect, useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useTheme } from '../context/ThemeContext';
import { useRxQuery } from '../hooks/useRx';
import { NAV } from '../config/nav';
import { canViewScreen } from '../services/auth';
import { fmtYER } from '../lib/format';
import { Logo } from './Logo';
import type { JournalDoc } from '../db/types';

const SIDEBAR_KEY = 'nasim-sidebar-collapsed';

export function Layout({ children }: { children: ReactNode }) {
  const { db, user, logout } = useApp();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  // Sidebar stays open (fixed) by default; collapses only when the user clicks.
  const [collapsed, setCollapsed] = useState<boolean>(() => localStorage.getItem(SIDEBAR_KEY) === '1');
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => { localStorage.setItem(SIDEBAR_KEY, collapsed ? '1' : '0'); }, [collapsed]);

  // Live cash balance via reactive journals
  const { data: journals } = useRxQuery<JournalDoc>(() => db?.journal.find(), [db]);
  const { data: accounts } = useRxQuery<{ id: string; code: string }>(
    () => db?.accounts.find({ selector: { code: 'CASH' } }) as any, [db],
  );
  const cashId = accounts[0]?.id;
  let cash = 0;
  if (cashId) {
    for (const j of journals) for (const l of j.lines) {
      if (l.accountId === cashId) cash += (l.debit || 0) - (l.credit || 0);
    }
  }

  const groups = NAV
    .map((g) => ({ ...g, items: g.items.filter((it) => canViewScreen(user, it.key)) }))
    .filter((g) => g.items.length > 0);

  function doLogout() { logout(); navigate('/login'); }

  return (
    <div className="min-h-screen bg-app flex" dir="rtl">
      {/* Sidebar — solid, fully opaque background (no transparency/blur) */}
      <aside className={`bg-white dark:bg-gray-900 opacity-100 text-ink-700 dark:text-ink-200 flex flex-col transition-[width] duration-300 fixed lg:static z-40 h-screen shadow-elevated border-l border-ink-200 dark:border-white/10
        ${collapsed ? 'w-20' : 'w-64'} ${mobileOpen ? 'right-0' : '-right-72 lg:right-0'}`}>
        <div className={`flex items-center px-4 h-16 border-b border-ink-200 dark:border-white/10 shrink-0 ${collapsed ? 'justify-center' : 'gap-3'}`}>
          <Logo size={36} variant={theme === 'dark' ? 'light' : 'dark'} showText={!collapsed} />
        </div>

        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4 scrollbar-thin">
          {groups.map((g) => (
            <div key={g.title}>
              {!collapsed && (
                <p className="px-3 text-[11px] uppercase tracking-wider text-ink-400 dark:text-ink-500 font-bold mb-1">{g.title}</p>
              )}
              <div className="space-y-0.5">
                {g.items.map((it) => {
                  const active = location.pathname === it.path;
                  return (
                    <Link key={it.key} to={it.path} onClick={() => setMobileOpen(false)} title={collapsed ? it.label : undefined}
                      className={`nav-link group ${active ? 'nav-link-active' : 'nav-link-idle'} ${collapsed ? 'justify-center' : ''}`}>
                      {active && !collapsed && <span className="absolute -right-2 top-1/2 -translate-y-1/2 h-6 w-1.5 rounded-full bg-royal-600"></span>}
                      <i className={`fa-solid ${it.icon} w-5 text-center transition-transform group-hover:scale-110 ${active ? 'text-white' : 'text-ink-400 dark:text-ink-400'}`}></i>
                      {!collapsed && <span className="text-sm">{it.label}</span>}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <button onClick={() => setCollapsed((c) => !c)}
          title={collapsed ? 'توسيع الشريط الجانبي' : 'طي الشريط الجانبي'}
          className="hidden lg:flex items-center justify-center gap-2 h-11 border-t border-ink-200 dark:border-white/10 text-ink-500 dark:text-ink-400 hover:text-royal-600 dark:hover:text-white hover:bg-ink-50 dark:hover:bg-white/5 transition text-sm">
          <i className={`fa-solid ${collapsed ? 'fa-angles-left' : 'fa-angles-right'}`}></i>
          {!collapsed && <span>طي القائمة</span>}
        </button>
      </aside>

      {mobileOpen && <div className="fixed inset-0 bg-black/40 z-30 lg:hidden" onClick={() => setMobileOpen(false)} />}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white dark:bg-gray-900 border-b border-ink-200 dark:border-white/10 flex items-center justify-between px-4 lg:px-6 sticky top-0 z-20 shadow-sm transition-colors duration-300">
          <div className="flex items-center gap-3">
            <button className="lg:hidden btn-ghost px-3" onClick={() => setMobileOpen(true)}>
              <i className="fa-solid fa-bars"></i>
            </button>
            <div className="hidden sm:flex items-center gap-2 bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100 px-4 py-2 rounded-xl dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/20">
              <i className="fa-solid fa-wallet"></i>
              <span className="text-sm font-semibold">رصيد الصندوق:</span>
              <span className="font-extrabold num">{fmtYER(cash)}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button onClick={toggleTheme} className="btn-icon text-ink-500 hover:bg-ink-100 dark:text-amber-300 dark:hover:bg-white/10 transition"
              title={theme === 'dark' ? 'التبديل إلى الوضع النهاري' : 'التبديل إلى الوضع الليلي'}
              aria-label="تبديل الوضع الليلي/النهاري">
              <i className={`fa-solid ${theme === 'dark' ? 'fa-sun' : 'fa-moon'} text-lg`}></i>
            </button>
            <div className="text-left hidden sm:block">
              <p className="text-sm font-bold text-ink-700 dark:text-ink-100">{user?.fullName || user?.username}</p>
              <p className="text-[11px] text-ink-400 dark:text-ink-400">{user?.role === 'admin' ? 'مدير النظام' : 'مستخدم'}</p>
            </div>
            <div className="w-10 h-10 rounded-full brand-gradient text-white flex items-center justify-center font-bold">
              {(user?.fullName || user?.username || '؟').charAt(0)}
            </div>
            <button onClick={doLogout} className="btn-ghost px-3" title="تسجيل الخروج">
              <i className="fa-solid fa-right-from-bracket"></i>
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-6 overflow-x-hidden">
          <div className="mx-auto w-full max-w-7xl animate-fade-in">{children}</div>
        </main>
      </div>
    </div>
  );
}
