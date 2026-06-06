import { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { useRxQuery } from '../hooks/useRx';
import { PageHeader, SectionCard } from '../components/ui/Page';
import { ConfirmDialog } from '../components/ui/Modal';
import { VoucherHistory } from '../components/VoucherHistory';
import { fmtYER, todayISO } from '../lib/format';
import { cashReset } from '../services/operations';
import type { AccountDoc, JournalDoc } from '../db/types';

export default function CashReset() {
  const { db, user } = useApp();
  const { push } = useToast();
  const { data: accounts } = useRxQuery<AccountDoc>(() => db?.accounts.find(), [db]);
  const { data: journals } = useRxQuery<JournalDoc>(() => db?.journal.find(), [db]);
  const [date, setDate] = useState(todayISO());
  const [confirm, setConfirm] = useState(false);
  const [saving, setSaving] = useState(false);

  // تصفير الصندوق: المبلغ = كامل رصيد الصندوق الحالي (مدين - دائن لحساب الصندوق).
  // لا تُعرض في هذه الشاشة أي معلومات عن مسحوبات أشرف.
  const cashId = accounts.find((a) => a.code === 'CASH')?.id;
  const cashBalance = useMemo(() => {
    let b = 0;
    for (const j of journals) for (const l of j.lines) if (l.accountId === cashId) b += (l.debit || 0) - (l.credit || 0);
    return b;
  }, [journals, cashId]);

  async function doReset() {
    if (!db) return;
    setConfirm(false);
    setSaving(true);
    try {
      const r = await cashReset(db, { date, createdBy: user?.username || '' });
      push('success', `تم تصفير الصندوق وتحويل ${fmtYER(r.amount)} إلى مسحوبات أشرف — ${r.voucherNo}`);
    } catch (err: any) {
      push('error', err.message || 'فشل التصفير');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader title="تصفير الصندوق" subtitle="تحويل كامل رصيد الصندوق إلى مسحوبات أشرف (مدين المسحوبات / دائن الصندوق)" icon="fa-cash-register" />

      <div className="grid grid-cols-1 gap-6">
        <SectionCard title="تصفير الصندوق" icon="fa-cash-register">
          <div className="text-center py-4">
            <p className="text-ink-400 text-sm mb-1">رصيد الصندوق الحالي</p>
            <p className="text-4xl font-extrabold text-royal-700 num mb-6">{fmtYER(cashBalance)}</p>
            <div className="max-w-xs mx-auto mb-5">
              <label className="field-label text-right">تاريخ التصفير</label>
              <input type="date" className="input num" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <button className="btn-warning w-full max-w-xs mx-auto justify-center py-3"
              disabled={saving || cashBalance <= 0} onClick={() => setConfirm(true)}>
              {saving ? <i className="fa-solid fa-spinner fa-spin"></i> : <><i className="fa-solid fa-rotate"></i> تصفير الصندوق الآن</>}
            </button>
            {cashBalance <= 0 && <p className="text-xs text-ink-300 mt-3">لا يوجد رصيد في الصندوق لتصفيره</p>}
          </div>
        </SectionCard>
      </div>

      <div className="mt-6">
        <VoucherHistory title="عمليات التصفير السابقة" icon="fa-clock-rotate-left"
          sources={['cashReset']} screen="cashReset" />
      </div>

      <ConfirmDialog open={confirm} title="تأكيد تصفير الصندوق" danger confirmText="نعم، صفّر الصندوق"
        message={`سيتم تصفير الصندوق وتحويل كامل الرصيد ${fmtYER(cashBalance)} إلى حساب مسحوبات أشرف. هل أنت متأكد؟`}
        onConfirm={doReset} onCancel={() => setConfirm(false)} />
    </div>
  );
}
