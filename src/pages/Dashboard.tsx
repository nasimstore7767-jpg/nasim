import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useRxQuery } from '../hooks/useRx';
import { PageHeader, KpiCard, SectionCard, EmptyState } from '../components/ui/Page';
import { fmtYER, fmtDateAr, todayISO } from '../lib/format';
import type { AccountDoc, DeviceJobDoc, JournalDoc } from '../db/types';

const QUICK = [
  { to: '/receipt', label: 'سند قبض', icon: 'fa-money-bill-wave', color: 'bg-emerald-500' },
  { to: '/payment', label: 'سند صرف', icon: 'fa-hand-holding-dollar', color: 'bg-red-500' },
  { to: '/intake', label: 'استلام جهاز', icon: 'fa-arrow-down-to-bracket', color: 'bg-royal-500' },
  { to: '/delivery', label: 'تسليم جهاز', icon: 'fa-arrow-up-from-bracket', color: 'bg-amber-500' },
  { to: '/pos', label: 'بيع إكسسوار', icon: 'fa-cart-shopping', color: 'bg-violet-500' },
  { to: '/balance', label: 'بيع رصيد', icon: 'fa-sim-card', color: 'bg-cyan-500' },
];

export default function Dashboard() {
  const { db } = useApp();
  const { data: journals } = useRxQuery<JournalDoc>(() => db?.journal.find(), [db]);
  const { data: accounts } = useRxQuery<AccountDoc>(() => db?.accounts.find(), [db]);
  const { data: jobs } = useRxQuery<DeviceJobDoc>(
    () => db?.deviceJobs.find({ selector: { status: 'open' } }), [db],
  );

  const cashId = accounts.find((a) => a.code === 'CASH')?.id;
  const today = todayISO();

  const stats = useMemo(() => {
    let cash = 0, todayIn = 0, todayOut = 0, revenue = 0;
    const revIds = new Set(accounts.filter((a) => a.type === 'revenue').map((a) => a.id));
    for (const j of journals) {
      for (const l of j.lines) {
        if (l.accountId === cashId) {
          cash += (l.debit || 0) - (l.credit || 0);
          if (j.date === today) { todayIn += l.debit || 0; todayOut += l.credit || 0; }
        }
        if (revIds.has(l.accountId)) revenue += (l.credit || 0) - (l.debit || 0);
      }
    }
    return { cash, todayIn, todayOut, revenue };
  }, [journals, accounts, cashId, today]);

  // customer receivables (debit balances)
  const receivables = useMemo(() => {
    const custIds = new Set(accounts.filter((a) => a.type === 'customer' && a.isLeaf).map((a) => a.id));
    const bal: Record<string, number> = {};
    for (const j of journals) for (const l of j.lines) {
      if (custIds.has(l.accountId)) bal[l.accountId] = (bal[l.accountId] || 0) + (l.debit || 0) - (l.credit || 0);
    }
    return Object.values(bal).filter((v) => v > 0).reduce((s, v) => s + v, 0);
  }, [journals, accounts]);

  const recent = [...journals].sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1)).slice(0, 8);

  return (
    <div>
      <PageHeader title="لوحة التحكم" subtitle="نظرة عامة على الوضع المالي والتشغيلي" icon="fa-gauge-high" />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard label="رصيد الصندوق" value={fmtYER(stats.cash)} icon="fa-wallet" color="emerald" />
        <KpiCard label="مقبوضات اليوم" value={fmtYER(stats.todayIn)} icon="fa-arrow-down" color="royal" />
        <KpiCard label="مصروفات اليوم" value={fmtYER(stats.todayOut)} icon="fa-arrow-up" color="red" />
        <KpiCard label="أرصدة العملاء (مدينة)" value={fmtYER(receivables)} icon="fa-users" color="amber"
          hint={`أوامر عمل مفتوحة: ${jobs.length}`} />
      </div>

      <SectionCard title="إجراءات سريعة" icon="fa-bolt" className="mb-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {QUICK.map((q) => (
            <Link key={q.to} to={q.to}
              className="flex flex-col items-center gap-2 p-4 rounded-xl border border-gray-100 hover:shadow-card hover:-translate-y-0.5 transition-all">
              <div className={`w-12 h-12 rounded-xl ${q.color} text-white flex items-center justify-center`}>
                <i className={`fa-solid ${q.icon} text-lg`}></i>
              </div>
              <span className="text-sm font-semibold text-ink-600 text-center">{q.label}</span>
            </Link>
          ))}
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <SectionCard title="أحدث القيود" icon="fa-receipt" className="lg:col-span-2">
          {recent.length === 0 ? (
            <EmptyState icon="fa-receipt" title="لا توجد قيود بعد" hint="ابدأ بتسجيل عملية مالية" />
          ) : (
            <div className="overflow-x-auto -mx-5">
              <table className="data-table">
                <thead>
                  <tr><th>السند</th><th>التاريخ</th><th>البيان</th><th className="text-left">المبلغ</th></tr>
                </thead>
                <tbody>
                  {recent.map((j) => {
                    const amount = j.lines.reduce((s, l) => s + (l.debit || 0), 0);
                    return (
                      <tr key={j.id}>
                        <td className="num font-semibold text-royal-600">{j.voucherNo}</td>
                        <td className="num text-ink-400">{fmtDateAr(j.date)}</td>
                        <td className="text-ink-600 max-w-xs truncate">{j.description}</td>
                        <td className="num text-left font-bold">{fmtYER(amount)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>

        <SectionCard title="أجهزة قيد العمل" icon="fa-mobile-screen-button">
          {jobs.length === 0 ? (
            <EmptyState icon="fa-mobile-screen" title="لا توجد أجهزة مفتوحة" />
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {jobs.slice(0, 12).map((j) => (
                <div key={j.id} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition">
                  <div>
                    <p className="font-semibold text-ink-700 text-sm">{j.customerName}</p>
                    <p className="text-xs text-ink-400">{j.deviceType} — {j.issue}</p>
                  </div>
                  <span className={`badge ${j.type === 'programming' ? 'badge-royal' : 'badge-amber'}`}>
                    {j.type === 'programming' ? 'برمجة' : 'صيانة'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
