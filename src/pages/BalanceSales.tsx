import { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { useRxQuery } from '../hooks/useRx';
import { PageHeader, SectionCard } from '../components/ui/Page';
import { CustomerPicker } from '../components/CustomerPicker';
import { VoucherHistory } from '../components/VoucherHistory';
import { PROVIDER_AR } from '../services/descriptions';
import { fmtYER, todayISO } from '../lib/format';
import { createBalanceSale, updateBalanceSale } from '../services/operations';
import type { BalanceProvider, BalanceSaleDoc, JournalDoc } from '../db/types';

const PROVIDERS: { id: BalanceProvider; icon: string; color: string }[] = [
  { id: 'YOU', icon: 'fa-y', color: 'bg-rose-500' },
  { id: 'Sabafon', icon: 'fa-signal', color: 'bg-blue-500' },
  { id: 'YemenMobile', icon: 'fa-tower-cell', color: 'bg-emerald-500' },
  { id: 'Internet', icon: 'fa-wifi', color: 'bg-violet-500' },
];

export default function BalanceSales() {
  const { db, user } = useApp();
  const { push } = useToast();
  const { data: sales } = useRxQuery<BalanceSaleDoc>(() => db?.balanceSales.find(), [db]);

  const [provider, setProvider] = useState<BalanceProvider>('YOU');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayISO());
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState('نقدي');
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingNo, setEditingNo] = useState<string>('');

  function resetForm() {
    setAmount(''); setProvider('YOU'); setDate(todayISO());
    setCustomerId(null); setCustomerName('نقدي');
    setEditingId(null); setEditingNo('');
  }

  function startEdit(j: JournalDoc) {
    const sale = sales.find((s) => s.id === j.sourceId);
    if (!sale) { push('warning', 'تعذّر فتح بيانات هذا السند للتعديل'); return; }
    setProvider(sale.provider);
    setAmount(String(sale.amount));
    setDate(sale.date);
    setCustomerId(sale.customerId);
    setCustomerName(sale.customerName);
    setEditingId(j.id); setEditingNo(j.voucherNo);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function submit() {
    if (!db) return;
    const amt = parseFloat(amount) || 0;
    if (amt <= 0) { push('warning', 'أدخل مبلغاً صحيحاً'); return; }
    setSaving(true);
    try {
      if (editingId) {
        const r = await updateBalanceSale(db, { journalId: editingId, date, provider, amount: amt, customerId, customerName, createdBy: user?.username || '' });
        push('success', `تم تعديل بيع الرصيد وحفظه برقم ${r.voucherNo}`);
      } else {
        const r = await createBalanceSale(db, { date, provider, amount: amt, customerId, customerName, createdBy: user?.username || '' });
        push('success', `تم بيع رصيد ${PROVIDER_AR[provider]} — ${r.voucherNo}`);
      }
      resetForm();
    } catch (err: any) {
      push('error', err.message || 'فشل البيع');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader title="بيع الرصيد" subtitle="بيع أرصدة شبكات الاتصال والإنترنت" icon="fa-sim-card" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <SectionCard title={editingId ? `تعديل بيع الرصيد ${editingNo}` : 'عملية بيع رصيد'} icon="fa-sim-card" className="lg:col-span-2">
          {editingId && (
            <div className="mb-4 p-3 rounded-xl bg-amber-50 text-amber-700 text-sm flex items-center justify-between">
              <span><i className="fa-solid fa-pen ml-1"></i> أنت في وضع تعديل السند {editingNo}</span>
              <button className="btn-ghost btn-sm text-amber-700" onClick={resetForm}><i className="fa-solid fa-xmark"></i> إلغاء التعديل</button>
            </div>
          )}
          <label className="field-label mb-2">الشبكة</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            {PROVIDERS.map((p) => (
              <button key={p.id} onClick={() => setProvider(p.id)}
                className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${
                  provider === p.id ? 'border-royal-500 bg-royal-50' : 'border-gray-100 hover:bg-gray-50'}`}>
                <div className={`w-11 h-11 rounded-xl ${p.color} text-white flex items-center justify-center`}><i className={`fa-solid ${p.icon} text-lg`}></i></div>
                <span className="text-sm font-bold text-ink-700">{PROVIDER_AR[p.id]}</span>
              </button>
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="field-label">المبلغ</label>
              <input type="number" min="0" className="input num input-lg" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" autoFocus />
            </div>
            <div>
              <CustomerPicker value={customerId} allowCash onChange={(id, name) => { setCustomerId(id); setCustomerName(name); }} />
            </div>
          </div>
        </SectionCard>

        <SectionCard title="الملخص" icon="fa-receipt">
          <div className="space-y-4">
            <div>
              <label className="field-label">التاريخ</label>
              <input type="date" className="input num" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="p-4 rounded-xl bg-ink-50">
              <p className="text-sm text-ink-500">{PROVIDER_AR[provider]}</p>
              <div className="flex justify-between text-2xl font-extrabold mt-1"><span className="num text-royal-700">{fmtYER(parseFloat(amount) || 0)}</span></div>
            </div>
            <button className="btn-success w-full justify-center py-3" disabled={saving} onClick={submit}>
              {saving ? <i className="fa-solid fa-spinner fa-spin"></i> : <><i className="fa-solid fa-check"></i> {editingId ? 'حفظ التعديل' : 'بيع الرصيد'}</>}
            </button>
          </div>
        </SectionCard>
      </div>

      <div className="mt-6">
        <VoucherHistory title="مبيعات الرصيد السابقة" icon="fa-sim-card"
          sources={['balanceSale']} screen="balanceSales" onEdit={startEdit} />
      </div>
    </div>
  );
}
