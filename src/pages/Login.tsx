import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { Logo } from '../components/Logo';

export default function Login() {
  const { login, settings } = useApp();
  const { push } = useToast();
  const [username, setUsername] = useState('nasim');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [show, setShow] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await login(username, password);
      push('success', 'تم تسجيل الدخول بنجاح');
    } catch (err: any) {
      push('error', err.message || 'فشل تسجيل الدخول');
    } finally {
      setLoading(false);
    }
  }

  const features = [
    { icon: 'fa-chart-line', text: 'محاسبة مزدوجة القيد دقيقة' },
    { icon: 'fa-mobile-screen-button', text: 'إدارة استلام وتسليم الأجهزة' },
    { icon: 'fa-cart-shopping', text: 'نقطة بيع وبيع الرصيد' },
    { icon: 'fa-cloud-arrow-down', text: 'يعمل دون اتصال بالإنترنت' },
  ];

  return (
    <div className="min-h-screen flex" dir="rtl">
      {/* Brand panel */}
      <aside className="hidden lg:flex flex-col justify-between sidebar-gradient text-white w-[42%] xl:w-[38%] p-10 relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.07]"
          style={{ backgroundImage: 'radial-gradient(circle at 20% 30%, white 1px, transparent 1px)', backgroundSize: '38px 38px' }} />
        <div className="absolute -bottom-24 -left-24 w-72 h-72 rounded-full bg-accent-400/20 blur-3xl" />
        <div className="relative">
          <Logo size={52} variant="light" />
        </div>
        <div className="relative space-y-6">
          <h2 className="text-3xl xl:text-4xl font-extrabold leading-snug">
            نظام إدارة متكامل<br />للصيانة والبرمجة
          </h2>
          <ul className="space-y-3">
            {features.map((f) => (
              <li key={f.text} className="flex items-center gap-3 text-white/85">
                <span className="w-9 h-9 rounded-xl bg-white/10 ring-1 ring-white/15 flex items-center justify-center shrink-0">
                  <i className={`fa-solid ${f.icon} text-accent-200`}></i>
                </span>
                <span className="text-sm">{f.text}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-white/40">© {new Date().getFullYear()} عالم البرمجة للصيانة والبرمجة — جميع الحقوق محفوظة</p>
      </aside>

      {/* Form panel */}
      <main className="flex-1 flex items-center justify-center bg-mesh p-6">
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-8 flex justify-center"><Logo size={48} variant="dark" /></div>

          <form onSubmit={submit} className="card p-8 space-y-5 animate-fade-in">
            <div className="text-center mb-2">
              <h1 className="text-2xl font-extrabold text-ink-800">مرحباً بعودتك 👋</h1>
              <p className="text-sm text-ink-400 mt-1">{settings?.companyName || 'محل عالم البرمجة للصيانة والبرمجة'}</p>
            </div>

            <div>
              <label className="field-label">اسم المستخدم</label>
              <div className="relative">
                <i className="fa-solid fa-user absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-300"></i>
                <input className="input pr-10" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoFocus />
              </div>
            </div>

            <div>
              <label className="field-label">كلمة المرور</label>
              <div className="relative">
                <i className="fa-solid fa-lock absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-300"></i>
                <input className="input pr-10 pl-10" type={show ? 'text' : 'password'}
                  value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
                <button type="button" onClick={() => setShow((s) => !s)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-300 hover:text-ink-500">
                  <i className={`fa-solid ${show ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading}
              className="btn-primary w-full justify-center py-3 text-base disabled:opacity-60">
              {loading ? <i className="fa-solid fa-spinner fa-spin"></i> : <><i className="fa-solid fa-right-to-bracket"></i> دخول</>}
            </button>

            <p className="text-center text-xs text-ink-300">المستخدم الافتراضي: nasim / n123</p>
          </form>
        </div>
      </main>
    </div>
  );
}
