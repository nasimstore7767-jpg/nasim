import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

type ToastType = 'success' | 'error' | 'info' | 'warning';
interface Toast { id: number; type: ToastType; msg: string; }

interface ToastCtx { push: (type: ToastType, msg: string) => void; }
const Ctx = createContext<ToastCtx>({ push: () => {} });

const STYLES: Record<ToastType, { bg: string; icon: string }> = {
  success: { bg: 'bg-emerald-600', icon: 'fa-circle-check' },
  error: { bg: 'bg-red-600', icon: 'fa-circle-xmark' },
  info: { bg: 'bg-royal-600', icon: 'fa-circle-info' },
  warning: { bg: 'bg-amber-500', icon: 'fa-triangle-exclamation' },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((type: ToastType, msg: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, type, msg }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3800);
  }, []);

  return (
    <Ctx.Provider value={{ push }}>
      {children}
      <div className="fixed bottom-5 left-5 z-[200] flex flex-col gap-2 max-w-sm">
        {toasts.map((t) => {
          const s = STYLES[t.type];
          return (
            <div key={t.id}
              className={`${s.bg} text-white px-4 py-3 rounded-xl shadow-elevated flex items-center gap-3 animate-slide-in`}>
              <i className={`fa-solid ${s.icon} text-lg`}></i>
              <span className="text-sm font-medium">{t.msg}</span>
            </div>
          );
        })}
      </div>
    </Ctx.Provider>
  );
}

export function useToast() { return useContext(Ctx); }
