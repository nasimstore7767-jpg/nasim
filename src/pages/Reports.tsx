import { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { useRxQuery } from '../hooks/useRx';
import { PageHeader, SectionCard, EmptyState, KpiCard } from '../components/ui/Page';
import { fmtYER, fmtDateAr, todayISO } from '../lib/format';
import { naturalBalance } from '../services/accounting';
import { printReport, type ReportColumn, type ReportRow } from '../lib/print';
import type { AccountDoc, JournalDoc, SourceType } from '../db/types';

type ReportKey =
  | 'shopExpenses' | 'progRevenue' | 'maintRevenue' | 'cashbook'
  | 'analytical' | 'customer' | 'profit';

const REPORTS: { key: ReportKey; label: string; icon: string }[] = [
  { key: 'shopExpenses', label: 'مصاريف المحل', icon: 'fa-receipt' },
  { key: 'progRevenue', label: 'إيراد البرمجة', icon: 'fa-laptop-code' },
  { key: 'maintRevenue', label: 'إيراد الصيانة', icon: 'fa-screwdriver-wrench' },
  { key: 'cashbook', label: 'كشف حساب الصندوق', icon: 'fa-cash-register' },
  { key: 'analytical', label: 'الكشف التحليلي', icon: 'fa-magnifying-glass-chart' },
  { key: 'customer', label: 'كشف حساب عميل', icon: 'fa-user' },
  { key: 'profit', label: 'تحليل الأرباح', icon: 'fa-chart-line' },
];

const SOURCE_AR: Record<SourceType, string> = {
  payment: 'صرف', receipt: 'قبض', cashReset: 'تصفير', deviceIntake: 'استلام جهاز',
  deviceDelivery: 'تسليم جهاز', advanceRefund: 'استرجاع دفعة', creditProgramming: 'برمجة آجلة',
  posSale: 'بيع إكسسوار', balanceSale: 'بيع رصيد', opening: 'رصيد افتتاحي',
};

interface Row { date: string; voucherNo: string; type: string; description: string; debit: number; credit: number; balance: number; }

export default function Reports() {
  const { db, settings, user } = useApp();
  const { data: journals } = useRxQuery<JournalDoc>(() => db?.journal.find(), [db]);
  const { data: accounts } = useRxQuery<AccountDoc>(() => db?.accounts.find(), [db]);

  const [report, setReport] = useState<ReportKey>('cashbook');
  const firstOfMonth = todayISO().slice(0, 8) + '01';
  const [from, setFrom] = useState(firstOfMonth);
  const [to, setTo] = useState(todayISO());
  const [customerId, setCustomerId] = useState('');

  const customers = useMemo(() => accounts.filter((a) => a.type === 'customer' && a.isLeaf), [accounts]);

  // journals in range, sorted by date/createdAt
  const inRange = useMemo(() => {
    return [...journals]
      .filter((j) => j.date >= from && j.date <= to)
      .sort((a, b) => (a.date === b.date ? (a.createdAt > b.createdAt ? 1 : -1) : (a.date > b.date ? 1 : -1)));
  }, [journals, from, to]);

  // Build account-statement rows for a single accountId (running balance, natural direction)
  function statementFor(accountId: string, type: AccountDoc['type']): Row[] {
    const rows: Row[] = [];
    let running = 0;
    for (const j of inRange) {
      for (const l of j.lines) {
        if (l.accountId !== accountId) continue;
        running += naturalBalance(type, l.debit || 0, l.credit || 0);
        rows.push({
          date: j.date, voucherNo: j.voucherNo, type: SOURCE_AR[j.source],
          description: j.description, debit: l.debit || 0, credit: l.credit || 0, balance: running,
        });
      }
    }
    return rows;
  }

  const result = useMemo(() => {
    const get = (code: string) => accounts.find((a) => a.code === code);
    switch (report) {
      case 'shopExpenses': {
        const accs = accounts.filter((a) => a.group === 'مصاريف المحل');
        const ids = new Set(accs.map((a) => a.id));
        const rows: Row[] = [];
        let running = 0;
        for (const j of inRange) for (const l of j.lines) {
          if (!ids.has(l.accountId)) continue;
          running += (l.debit || 0) - (l.credit || 0);
          rows.push({ date: j.date, voucherNo: j.voucherNo, type: l.accountName, description: j.description, debit: l.debit || 0, credit: l.credit || 0, balance: running });
        }
        return { rows, title: 'مصاريف المحل' };
      }
      case 'progRevenue': {
        const acc = get('REV-PROG');
        return { rows: acc ? statementFor(acc.id, 'revenue') : [], title: 'إيراد البرمجة' };
      }
      case 'maintRevenue': {
        const acc = get('REV-MAINT');
        return { rows: acc ? statementFor(acc.id, 'revenue') : [], title: 'إيراد الصيانة' };
      }
      case 'cashbook': {
        const acc = get('CASH');
        return { rows: acc ? statementFor(acc.id, 'asset') : [], title: 'كشف حساب الصندوق' };
      }
      case 'customer': {
        if (!customerId) return { rows: [], title: 'كشف حساب عميل' };
        const c = accounts.find((a) => a.id === customerId);
        return { rows: c ? statementFor(c.id, 'customer') : [], title: `كشف حساب: ${c?.name || ''}` };
      }
      case 'analytical': {
        // all entries flattened
        const rows: Row[] = [];
        for (const j of inRange) {
          const debit = j.lines.reduce((s, l) => s + (l.debit || 0), 0);
          rows.push({ date: j.date, voucherNo: j.voucherNo, type: SOURCE_AR[j.source], description: j.description, debit, credit: debit, balance: debit });
        }
        return { rows, title: 'الكشف التحليلي لكل العمليات' };
      }
      case 'profit': {
        return { rows: [], title: 'تحليل الأرباح' };
      }
      default:
        return { rows: [], title: '' };
    }
  }, [report, inRange, accounts, customerId]);

  // Profit analysis numbers
  const profit = useMemo(() => {
    const revIds = new Set(accounts.filter((a) => a.type === 'revenue').map((a) => a.id));
    const expIds = new Set(accounts.filter((a) => a.type === 'expense').map((a) => a.id));
    let revenue = 0, expenses = 0;
    const byRev: Record<string, number> = {};
    const byExp: Record<string, number> = {};
    for (const j of inRange) for (const l of j.lines) {
      if (revIds.has(l.accountId)) { const v = (l.credit || 0) - (l.debit || 0); revenue += v; byRev[l.accountName] = (byRev[l.accountName] || 0) + v; }
      if (expIds.has(l.accountId)) { const v = (l.debit || 0) - (l.credit || 0); expenses += v; byExp[l.accountName] = (byExp[l.accountName] || 0) + v; }
    }
    return { revenue, expenses, net: revenue - expenses, byRev, byExp };
  }, [inRange, accounts]);

  const totals = useMemo(() => ({
    debit: result.rows.reduce((s, r) => s + r.debit, 0),
    credit: result.rows.reduce((s, r) => s + r.credit, 0),
  }), [result]);

  function printView() {
    const meta = {
      companyName: settings?.companyName || 'Nasim ERP',
      logo: settings?.logo || undefined,
      title: result.title,
      periodFrom: from,
      periodTo: to,
      username: user?.fullName || user?.username || '—',
    };

    // تحليل الأرباح — جدول إيرادات/مصاريف بدل البطاقات
    if (report === 'profit') {
      const columns: ReportColumn[] = [
        { label: 'البند', key: 'name' },
        { label: 'النوع', key: 'kind' },
        { label: 'المبلغ', key: 'amount', num: true },
      ];
      const rows: ReportRow[] = [
        ...Object.entries(profit.byRev).map(([name, v]) => ({ name, kind: 'إيراد', amount: v })),
        ...Object.entries(profit.byExp).map(([name, v]) => ({ name, kind: 'مصروف', amount: v })),
      ];
      printReport({
        meta: { ...meta, title: 'تحليل الأرباح', subtitle: `إجمالي الإيرادات ${fmtYER(profit.revenue)} — إجمالي المصروفات ${fmtYER(profit.expenses)} — صافي الربح ${fmtYER(profit.net)}` },
        columns,
        rows,
        totals: { amount: profit.net },
        totalsLabel: 'صافي الربح',
      });
      return;
    }

    // باقي التقارير — جدول كشف الحساب القياسي
    const columns: ReportColumn[] = [
      { label: 'التاريخ', key: 'date' },
      { label: 'رقم السند', key: 'voucherNo' },
      { label: 'نوع العملية', key: 'type' },
      { label: 'البيان', key: 'description' },
      { label: 'مدين', key: 'debit', num: true },
      { label: 'دائن', key: 'credit', num: true },
      { label: 'الرصيد', key: 'balance', num: true },
    ];
    const rows: ReportRow[] = result.rows.map((r) => ({
      date: fmtDateAr(r.date),
      voucherNo: r.voucherNo,
      type: r.type,
      description: r.description,
      debit: r.debit,
      credit: r.credit,
      balance: r.balance,
    }));
    printReport({
      meta,
      columns,
      rows,
      totals: { debit: totals.debit, credit: totals.credit },
    });
  }

  return (
    <div>
      <PageHeader title="التقارير" subtitle="تقارير مالية وتحليلية ضمن فترة محددة" icon="fa-chart-pie"
        actions={<button className="btn-secondary" onClick={printView}><i className="fa-solid fa-print"></i> طباعة <kbd className="hidden sm:inline text-[10px]">F8</kbd></button>} />

      <SectionCard className="mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
          <div>
            <label className="field-label">نوع التقرير</label>
            <select className="input" value={report} onChange={(e) => setReport(e.target.value as ReportKey)}>
              {REPORTS.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">من تاريخ</label>
            <input type="date" className="input num" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <label className="field-label">إلى تاريخ</label>
            <input type="date" className="input num" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          {report === 'customer' && (
            <div>
              <label className="field-label">العميل</label>
              <select className="input" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                <option value="">— اختر العميل —</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}
        </div>
      </SectionCard>

      {report === 'profit' ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <KpiCard label="إجمالي الإيرادات" value={fmtYER(profit.revenue)} icon="fa-arrow-trend-up" color="emerald" />
            <KpiCard label="إجمالي المصروفات" value={fmtYER(profit.expenses)} icon="fa-arrow-trend-down" color="red" />
            <KpiCard label="صافي الربح" value={fmtYER(profit.net)} icon="fa-sack-dollar" color={profit.net >= 0 ? 'royal' : 'red'} />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SectionCard title="تفصيل الإيرادات" icon="fa-arrow-trend-up">
              {Object.keys(profit.byRev).length === 0 ? <EmptyState title="لا توجد إيرادات" /> : (
                <div className="space-y-2">
                  {Object.entries(profit.byRev).map(([n, v]) => (
                    <div key={n} className="flex justify-between px-3 py-2 rounded-lg bg-gray-50"><span className="text-sm font-semibold text-ink-700">{n}</span><span className="num font-bold text-emerald-600">{fmtYER(v)}</span></div>
                  ))}
                </div>
              )}
            </SectionCard>
            <SectionCard title="تفصيل المصروفات" icon="fa-arrow-trend-down">
              {Object.keys(profit.byExp).length === 0 ? <EmptyState title="لا توجد مصروفات" /> : (
                <div className="space-y-2">
                  {Object.entries(profit.byExp).map(([n, v]) => (
                    <div key={n} className="flex justify-between px-3 py-2 rounded-lg bg-gray-50"><span className="text-sm font-semibold text-ink-700">{n}</span><span className="num font-bold text-red-600">{fmtYER(v)}</span></div>
                  ))}
                </div>
              )}
            </SectionCard>
          </div>
        </div>
      ) : (
        <SectionCard title={result.title} icon={REPORTS.find((r) => r.key === report)?.icon}>
          {result.rows.length === 0 ? (
            <EmptyState icon="fa-chart-pie" title="لا توجد بيانات ضمن الفترة المحددة"
              hint={report === 'customer' && !customerId ? 'اختر عميلاً لعرض كشف حسابه' : 'جرّب تغيير الفترة الزمنية'} />
          ) : (
            <div className="overflow-x-auto -mx-5">
              <table className="data-table">
                <thead>
                  <tr><th>التاريخ</th><th>رقم السند</th><th>نوع العملية</th><th>البيان</th><th className="text-left">مدين</th><th className="text-left">دائن</th><th className="text-left">الرصيد</th></tr>
                </thead>
                <tbody>
                  {result.rows.map((r, i) => (
                    <tr key={i}>
                      <td className="num text-ink-400">{fmtDateAr(r.date)}</td>
                      <td className="num font-semibold text-royal-600">{r.voucherNo}</td>
                      <td><span className="badge-gray">{r.type}</span></td>
                      <td className="text-ink-600 max-w-xs truncate">{r.description}</td>
                      <td className="num text-left">{r.debit ? fmtYER(r.debit) : '—'}</td>
                      <td className="num text-left">{r.credit ? fmtYER(r.credit) : '—'}</td>
                      <td className="num text-left font-bold">{fmtYER(r.balance)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-ink-50 font-extrabold">
                    <td colSpan={4} className="text-left">الإجمالي</td>
                    <td className="num text-left">{fmtYER(totals.debit)}</td>
                    <td className="num text-left">{fmtYER(totals.credit)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </SectionCard>
      )}
    </div>
  );
}
