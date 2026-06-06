import { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { useRxQuery } from '../hooks/useRx';
import { PageHeader, SectionCard, EmptyState } from '../components/ui/Page';
import { ConfirmDialog } from '../components/ui/Modal';
import { fmtYER, todayISO } from '../lib/format';
import { refundAdvance } from '../services/operations';
import type { DeviceJobDoc } from '../db/types';

export default function AdvanceRefund() {
  const { db, user } = useApp();
  const { push } = useToast();
  const { data: jobs } = useRxQuery<DeviceJobDoc>(
    () => db?.deviceJobs.find({ selector: { status: 'open' } }), [db],
  );
  const [target, setTarget] = useState<DeviceJobDoc | null>(null);
  const [date, setDate] = useState(todayISO());

  // Only open jobs that have an advance > 0 can be refunded
  const refundable = useMemo(
    () => jobs.filter((j) => (j.advance || 0) > 0).sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1)),
    [jobs],
  );

  async function confirmRefund() {
    if (!db || !target) return;
    const job = target; setTarget(null);
    try {
      const r = await refundAdvance(db, { jobId: job.id, date, createdBy: user?.username || '' });
      push('success', `تم استرجاع الدفعة المقدمة — ${r.voucherNo}`);
    } catch (err: any) {
      push('error', err.message || 'فشل الاسترجاع');
    }
  }

  return (
    <div>
      <PageHeader title="استرجاع دفعة مقدمة" subtitle="إلغاء أمر العمل واسترجاع الدفعة المقدمة للعميل" icon="fa-rotate-left" />

      <SectionCard title="أوامر العمل القابلة للاسترجاع" icon="fa-list">
        {refundable.length === 0 ? (
          <EmptyState icon="fa-rotate-left" title="لا توجد دفعات مقدمة قابلة للاسترجاع" />
        ) : (
          <div className="overflow-x-auto -mx-5">
            <table className="data-table">
              <thead><tr><th>الرقم</th><th>العميل</th><th>الجهاز</th><th>الخدمة</th><th className="text-left">المقدم</th><th></th></tr></thead>
              <tbody>
                {refundable.map((j) => (
                  <tr key={j.id}>
                    <td className="num font-semibold text-royal-600">{j.receiptNo}</td>
                    <td>{j.customerName}</td>
                    <td>{j.deviceType}</td>
                    <td className="text-ink-500">{j.issue}</td>
                    <td className="num text-left font-bold text-emerald-600">{fmtYER(j.advance)}</td>
                    <td className="text-left">
                      <button className="btn-danger btn-sm" onClick={() => { setTarget(j); setDate(todayISO()); }}>
                        <i className="fa-solid fa-rotate-left"></i> استرجاع
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <ConfirmDialog open={!!target} title="تأكيد استرجاع الدفعة" danger confirmText="نعم، استرجع الدفعة"
        message={target
          ? `سيتم استرجاع الدفعة المقدمة ${fmtYER(target.advance)} للعميل ${target.customerName} نقداً من الصندوق، وإلغاء أمر العمل "${target.deviceType}".`
          : ''}
        onConfirm={confirmRefund} onCancel={() => setTarget(null)} />
    </div>
  );
}
