import { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { useRxQuery } from '../hooks/useRx';
import { PageHeader, SectionCard, EmptyState } from '../components/ui/Page';
import { ConfirmDialog } from '../components/ui/Modal';
import { fmtYER, fmtDateAr, todayISO } from '../lib/format';
import { deliverDevice } from '../services/operations';
import type { DeviceJobDoc } from '../db/types';

export default function DeviceDelivery() {
  const { db, user } = useApp();
  const { push } = useToast();
  const { data: jobs } = useRxQuery<DeviceJobDoc>(
    () => db?.deviceJobs.find({ selector: { status: 'open' } }), [db],
  );
  const [term, setTerm] = useState('');
  const [target, setTarget] = useState<DeviceJobDoc | null>(null);
  const [date, setDate] = useState(todayISO());
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    const t = term.trim().toLowerCase();
    const list = [...jobs].sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));
    if (!t) return list;
    return list.filter((j) =>
      j.customerName.toLowerCase().includes(t) || j.receiptNo.toLowerCase().includes(t) ||
      j.deviceType.toLowerCase().includes(t));
  }, [jobs, term]);

  async function confirmDeliver() {
    if (!db || !target) return;
    const job = target; setTarget(null); setSaving(true);
    try {
      const r = await deliverDevice(db, { jobId: job.id, date, createdBy: user?.username || '' });
      push('success', `تم تسليم الجهاز وتحصيل الإيراد — ${r.voucherNo}`);
    } catch (err: any) {
      push('error', err.message || 'فشل التسليم');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader title="تسليم جهاز" subtitle="تسليم الأجهزة المنجزة وتحصيل المبلغ المتبقي" icon="fa-arrow-up-from-bracket" />

      <SectionCard title="الأجهزة قيد العمل" icon="fa-list"
        actions={
          <div className="relative w-64">
            <i className="fa-solid fa-magnifying-glass absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 text-sm"></i>
            <input className="input pr-9 btn-sm" placeholder="بحث بالعميل أو الرقم..." value={term} onChange={(e) => setTerm(e.target.value)} />
          </div>
        }>
        {filtered.length === 0 ? (
          <EmptyState icon="fa-mobile-screen" title="لا توجد أجهزة قيد العمل" />
        ) : (
          <div className="overflow-x-auto -mx-5">
            <table className="data-table">
              <thead><tr><th>الرقم</th><th>العميل</th><th>الجهاز</th><th>الخدمة</th><th>النوع</th><th className="text-left">السعر</th><th className="text-left">المتبقي</th><th></th></tr></thead>
              <tbody>
                {filtered.map((j) => (
                  <tr key={j.id}>
                    <td className="num font-semibold text-royal-600">{j.receiptNo}</td>
                    <td>{j.customerName}</td>
                    <td>{j.deviceType}</td>
                    <td className="text-ink-500">{j.issue}</td>
                    <td><span className={`badge ${j.type === 'programming' ? 'badge-royal' : 'badge-amber'}`}>{j.type === 'programming' ? 'برمجة' : 'صيانة'}</span></td>
                    <td className="num text-left">{fmtYER(j.agreedPrice)}</td>
                    <td className="num text-left font-bold text-royal-700">{fmtYER(j.remaining)}</td>
                    <td className="text-left">
                      <button className="btn-success btn-sm" onClick={() => { setTarget(j); setDate(todayISO()); }}>
                        <i className="fa-solid fa-check"></i> تسليم
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <ConfirmDialog open={!!target} title="تأكيد تسليم الجهاز" confirmText="تأكيد التسليم والتحصيل"
        message={target
          ? `سيتم تسليم جهاز "${target.deviceType}" للعميل ${target.customerName} وتحصيل المتبقي ${fmtYER(target.remaining)} نقداً وإثبات إيراد ${target.type === 'programming' ? 'البرمجة' : 'الصيانة'} بقيمة ${fmtYER(target.agreedPrice)}.`
          : ''}
        onConfirm={confirmDeliver} onCancel={() => setTarget(null)} />

      {saving && <div className="fixed bottom-5 right-5 badge-blue px-4 py-2"><i className="fa-solid fa-spinner fa-spin"></i> جارٍ التسليم...</div>}
    </div>
  );
}
