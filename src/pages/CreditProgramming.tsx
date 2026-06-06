import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { useRxQuery } from '../hooks/useRx';
import { PageHeader, SectionCard } from '../components/ui/Page';
import { CustomerPicker } from '../components/CustomerPicker';
import { VoucherHistory } from '../components/VoucherHistory';
import { fmtYER, todayISO } from '../lib/format';
import { createCreditProgramming } from '../services/operations';
import type { IssueDoc } from '../db/types';

export default function CreditProgramming() {
  const { db, user } = useApp();
  const { push } = useToast();
  const { data: issues } = useRxQuery<IssueDoc>(
    () => db?.issues.find({ selector: { category: 'programming' } }), [db],
  );
  const [date, setDate] = useState(todayISO());
  const [dateEdited, setDateEdited] = useState(false);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [issue, setIssue] = useState('');
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!db) return;
    if (!customerId) { push('warning', 'اختر العميل'); return; }
    if (!issue) { push('warning', 'اختر نوع البرمجة'); return; }
    const amt = parseFloat(amount) || 0;
    if (amt <= 0) { push('warning', 'أدخل مبلغاً صحيحاً'); return; }
    setSaving(true);
    try {
      const r = await createCreditProgramming(db, { date, customerId, customerName, issue, amount: amt, createdBy: user?.username || '' });
      push('success', `تم تسجيل برمجة آجلة على حساب العميل — ${r.voucherNo}`);
      setCustomerId(null); setCustomerName(''); setIssue(''); setAmount('');
      setDate(todayISO()); setDateEdited(false);
    } catch (err: any) {
      push('error', err.message || 'فشل التسجيل');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader title="برمجة آجلة" subtitle="تسجيل خدمة برمجة على حساب العميل (دين) دون تحصيل نقدي" icon="fa-laptop-code" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <SectionCard title="بيانات البرمجة الآجلة" icon="fa-clipboard-list" className="lg:col-span-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <CustomerPicker value={customerId} onChange={(id, name) => { setCustomerId(id); setCustomerName(name); }} />
            </div>
            <div>
              <label className="field-label">نوع البرمجة</label>
              <select className="input" value={issue} onChange={(e) => setIssue(e.target.value)}>
                <option value="">— اختر —</option>
                {issues.map((i) => <option key={i.id} value={i.name}>{i.name}</option>)}
              </select>
            </div>
            <div>
              <label className="field-label">المبلغ</label>
              <input type="number" min="0" className="input num" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
            </div>
          </div>
        </SectionCard>

        <SectionCard title="الملخص" icon="fa-receipt">
          <div className="space-y-4">
            <div>
              <label className="field-label">التاريخ</label>
              <input type="date" className="input num" value={date} onChange={(e) => { setDate(e.target.value); setDateEdited(true); }} />
              {dateEdited && <p className="text-xs text-amber-600 mt-1"><i className="fa-solid fa-triangle-exclamation"></i> تم تعديل التاريخ يدوياً</p>}
            </div>
            <div className="p-4 rounded-xl bg-ink-50">
              <div className="flex justify-between text-lg font-extrabold"><span>المبلغ الآجل</span><span className="num text-amber-600">{fmtYER(parseFloat(amount) || 0)}</span></div>
              <p className="text-xs text-ink-400 mt-2">سيُضاف على حساب العميل كدين</p>
            </div>
            <button className="btn-primary w-full justify-center py-3" disabled={saving} onClick={submit}>
              {saving ? <i className="fa-solid fa-spinner fa-spin"></i> : <><i className="fa-solid fa-floppy-disk"></i> تسجيل البرمجة الآجلة</>}
            </button>
          </div>
        </SectionCard>
      </div>

      <div className="mt-6">
        <VoucherHistory title="العمليات الآجلة السابقة" icon="fa-laptop-code"
          sources={['creditProgramming']} screen="creditProgramming" />
      </div>
    </div>
  );
}
