import { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { useRxQuery } from '../hooks/useRx';
import { PageHeader, SectionCard } from '../components/ui/Page';
import { VoucherHistory } from '../components/VoucherHistory';
import { fmtYER, todayISO } from '../lib/format';
import { createPayment, updatePayment } from '../services/operations';
import type { AccountDoc, JournalDoc } from '../db/types';

interface Line { accountId: string; amount: string; note: string; }
const emptyLine = (): Line => ({ accountId: '', amount: '', note: '' });

export default function Payment() {
  const { db, user } = useApp();
  const { push } = useToast();
  const { data: accounts } = useRxQuery<AccountDoc>(() => db?.accounts.find(), [db]);
  const { data: journals } = useRxQuery<JournalDoc>(() => db?.journal.find(), [db]);

  const [date, setDate] = useState(todayISO());
  const [dateEdited, setDateEdited] = useState(false);
  const [lines, setLines] = useState<Line[]>([emptyLine()]);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingNo, setEditingNo] = useState<string>('');

  // Req #1: any leaf account in the chart is a valid payment target (مرن)،
  // عدا الصندوق نفسه لأنه الطرف الدائن دائماً.
  const payableAccounts = useMemo(
    () => accounts.filter((a) => a.isLeaf && a.code !== 'CASH'),
    [accounts],
  );
  const grouped = useMemo(() => {
    const m: Record<string, AccountDoc[]> = {};
    for (const a of payableAccounts) (m[a.group] ||= []).push(a);
    return m;
  }, [payableAccounts]);

  const cashId = accounts.find((a) => a.code === 'CASH')?.id;
  const cashBalance = useMemo(() => {
    let b = 0;
    for (const j of journals) for (const l of j.lines) if (l.accountId === cashId) b += (l.debit || 0) - (l.credit || 0);
    return b;
  }, [journals, cashId]);

  const total = lines.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0);
  // when editing, the edited voucher's own cash usage is added back to the available balance
  const editAmount = useMemo(() => {
    if (!editingId) return 0;
    const j = journals.find((x) => x.id === editingId);
    return j ? j.lines.reduce((s, l) => s + (l.debit || 0), 0) : 0;
  }, [editingId, journals]);
  const available = cashBalance + editAmount;
  const overspend = total > available;

  function updateLine(i: number, patch: Partial<Line>) {
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  function resetForm() {
    setLines([emptyLine()]); setDate(todayISO()); setDateEdited(false);
    setEditingId(null); setEditingNo('');
  }

  function startEdit(j: JournalDoc) {
    // payment voucher: each non-cash, non-dept-revenue debit line is a payment line
    const cashAcc = accounts.find((a) => a.code === 'CASH');
    const editable = j.lines.filter((l) => l.accountId !== cashAcc?.id && (l.debit || 0) > 0)
      .filter((l) => {
        const acc = accounts.find((a) => a.id === l.accountId);
        return acc && acc.type !== 'revenue';
      });
    if (!editable.length) { push('warning', 'هذا السند لا يمكن تعديله من هنا'); return; }
    setLines(editable.map((l) => ({ accountId: l.accountId, amount: String(l.debit || 0), note: '' })));
    setDate(j.date); setDateEdited(false);
    setEditingId(j.id); setEditingNo(j.voucherNo);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function submit() {
    if (!db) return;
    const valid = lines.filter((l) => l.accountId && parseFloat(l.amount) > 0);
    if (!valid.length) { push('warning', 'أضف بنداً واحداً على الأقل بحساب ومبلغ'); return; }
    if (overspend) { push('error', 'الرصيد النقدي غير كافٍ لإتمام عملية الصرف'); return; }
    setSaving(true);
    try {
      const payload = {
        date,
        lines: valid.map((l) => ({
          accountId: l.accountId,
          accountName: accounts.find((a) => a.id === l.accountId)?.name || '',
          amount: parseFloat(l.amount),
          note: l.note,
        })),
        createdBy: user?.username || '',
      };
      if (editingId) {
        const vno = await updatePayment(db, { journalId: editingId, ...payload });
        push('success', `تم تعديل سند الصرف وحفظه برقم ${vno}`);
      } else {
        const vno = await createPayment(db, payload);
        push('success', `تم حفظ سند الصرف ${vno}`);
      }
      resetForm();
    } catch (err: any) {
      push('error', err.message || 'فشل حفظ السند');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader title="سند صرف نقدي" subtitle="صرف نقدي من الصندوق على أي حساب من شجرة الحسابات" icon="fa-hand-holding-dollar"
        actions={
          <div className="badge-emerald px-4 py-2 text-sm">
            <i className="fa-solid fa-wallet"></i> الرصيد: {fmtYER(cashBalance)}
          </div>
        } />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <SectionCard title={editingId ? `تعديل سند الصرف ${editingNo}` : 'بنود الصرف'} icon="fa-list" className="lg:col-span-2">
          {editingId && (
            <div className="mb-4 p-3 rounded-xl bg-amber-50 text-amber-700 text-sm flex items-center justify-between">
              <span><i className="fa-solid fa-pen ml-1"></i> أنت في وضع تعديل السند {editingNo}</span>
              <button className="btn-ghost btn-sm text-amber-700" onClick={resetForm}><i className="fa-solid fa-xmark"></i> إلغاء التعديل</button>
            </div>
          )}
          <div className="space-y-3">
            {lines.map((l, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-end p-3 rounded-xl bg-gray-50">
                <div className="col-span-12 sm:col-span-5">
                  <label className="field-label">الحساب</label>
                  <select className="input" value={l.accountId} onChange={(e) => updateLine(i, { accountId: e.target.value })}>
                    <option value="">— اختر الحساب —</option>
                    {Object.entries(grouped).map(([g, accs]) => (
                      <optgroup key={g} label={g}>
                        {accs.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                      </optgroup>
                    ))}
                  </select>
                </div>
                <div className="col-span-5 sm:col-span-3">
                  <label className="field-label">المبلغ</label>
                  <input type="number" min="0" className="input num" value={l.amount}
                    onChange={(e) => updateLine(i, { amount: e.target.value })} placeholder="0" />
                </div>
                <div className="col-span-5 sm:col-span-3">
                  <label className="field-label">ملاحظة</label>
                  <input className="input" value={l.note} onChange={(e) => updateLine(i, { note: e.target.value })} placeholder="اختياري" />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <button className="btn-ghost btn-icon text-red-500 hover:bg-red-50"
                    onClick={() => setLines((ls) => ls.length > 1 ? ls.filter((_, idx) => idx !== i) : ls)}>
                    <i className="fa-solid fa-trash"></i>
                  </button>
                </div>
              </div>
            ))}
            <button className="btn-secondary btn-sm" onClick={() => setLines((ls) => [...ls, emptyLine()])}>
              <i className="fa-solid fa-plus"></i> إضافة بند
            </button>
          </div>
        </SectionCard>

        <SectionCard title="بيانات السند" icon="fa-file-invoice">
          <div className="space-y-4">
            <div>
              <label className="field-label">التاريخ</label>
              <input type="date" className="input num" value={date}
                onChange={(e) => { setDate(e.target.value); setDateEdited(true); }} />
              {dateEdited && (
                <p className="text-xs text-amber-600 mt-1">
                  <i className="fa-solid fa-triangle-exclamation"></i> تم تعديل التاريخ يدوياً
                </p>
              )}
            </div>
            <div className="p-4 rounded-xl bg-ink-50 space-y-2">
              <div className="flex justify-between text-sm"><span className="text-ink-500">عدد البنود</span><span className="num font-bold">{lines.filter((l) => l.accountId).length}</span></div>
              <div className="flex justify-between text-lg font-extrabold">
                <span>الإجمالي</span>
                <span className={`num ${overspend ? 'text-red-600' : 'text-royal-700'}`}>{fmtYER(total)}</span>
              </div>
            </div>
            {overspend && (
              <div className="p-3 rounded-xl bg-red-50 text-red-700 text-sm flex items-center gap-2">
                <i className="fa-solid fa-circle-exclamation"></i>
                المبلغ يتجاوز الرصيد المتاح في الصندوق
              </div>
            )}
            <button className="btn-danger w-full justify-center py-3" disabled={saving || overspend} onClick={submit}>
              {saving ? <i className="fa-solid fa-spinner fa-spin"></i> : <><i className="fa-solid fa-floppy-disk"></i> {editingId ? 'حفظ التعديل' : 'حفظ سند الصرف'}</>}
            </button>
          </div>
        </SectionCard>
      </div>

      <div className="mt-6">
        <VoucherHistory title="سندات الصرف السابقة" icon="fa-hand-holding-dollar"
          sources={['payment']} screen="payment" onEdit={startEdit} />
      </div>
    </div>
  );
}
