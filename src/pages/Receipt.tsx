import { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { useRxQuery } from '../hooks/useRx';
import { PageHeader, SectionCard } from '../components/ui/Page';
import { VoucherHistory } from '../components/VoucherHistory';
import { fmtYER, todayISO } from '../lib/format';
import { createReceipt, updateReceipt } from '../services/operations';
import type { AccountDoc, JournalDoc } from '../db/types';

interface Line { accountId: string; amount: string; note: string; }
const emptyLine = (): Line => ({ accountId: '', amount: '', note: '' });

export default function Receipt() {
  const { db, user } = useApp();
  const { push } = useToast();
  const { data: accounts } = useRxQuery<AccountDoc>(() => db?.accounts.find(), [db]);

  const [date, setDate] = useState(todayISO());
  const [dateEdited, setDateEdited] = useState(false);
  const [lines, setLines] = useState<Line[]>([emptyLine()]);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingNo, setEditingNo] = useState<string>('');

  // Req #2: any leaf account in the chart can be a receipt source (مرن)،
  // عدا الصندوق نفسه لأنه الطرف المدين دائماً.
  const sources = useMemo(
    () => accounts.filter((a) => a.isLeaf && a.code !== 'CASH'),
    [accounts],
  );
  const grouped = useMemo(() => {
    const m: Record<string, AccountDoc[]> = {};
    for (const a of sources) (m[a.group] ||= []).push(a);
    return m;
  }, [sources]);

  const total = lines.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0);

  function updateLine(i: number, patch: Partial<Line>) {
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  function resetForm() {
    setLines([emptyLine()]); setDate(todayISO()); setDateEdited(false);
    setEditingId(null); setEditingNo('');
  }

  function startEdit(j: JournalDoc) {
    // receipt voucher: each non-cash credit line is a receipt source line
    const cashAcc = accounts.find((a) => a.code === 'CASH');
    const editable = j.lines.filter((l) => l.accountId !== cashAcc?.id && (l.credit || 0) > 0);
    if (!editable.length) { push('warning', 'هذا السند لا يمكن تعديله من هنا'); return; }
    setLines(editable.map((l) => ({ accountId: l.accountId, amount: String(l.credit || 0), note: '' })));
    setDate(j.date); setDateEdited(false);
    setEditingId(j.id); setEditingNo(j.voucherNo);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function submit() {
    if (!db) return;
    const valid = lines.filter((l) => l.accountId && parseFloat(l.amount) > 0);
    if (!valid.length) { push('warning', 'أضف بنداً واحداً على الأقل بحساب ومبلغ'); return; }
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
        const vno = await updateReceipt(db, { journalId: editingId, ...payload });
        push('success', `تم تعديل سند القبض وحفظه برقم ${vno}`);
      } else {
        const vno = await createReceipt(db, payload);
        push('success', `تم حفظ سند القبض ${vno}`);
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
      <PageHeader title="سند قبض نقدي" subtitle="قبض نقدي إلى الصندوق من أي حساب من شجرة الحسابات" icon="fa-money-bill-wave" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <SectionCard title={editingId ? `تعديل سند القبض ${editingNo}` : 'بنود القبض'} icon="fa-list" className="lg:col-span-2">
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
                <span className="num text-emerald-600">{fmtYER(total)}</span>
              </div>
            </div>
            <button className="btn-success w-full justify-center py-3" disabled={saving} onClick={submit}>
              {saving ? <i className="fa-solid fa-spinner fa-spin"></i> : <><i className="fa-solid fa-floppy-disk"></i> {editingId ? 'حفظ التعديل' : 'حفظ سند القبض'}</>}
            </button>
          </div>
        </SectionCard>
      </div>

      <div className="mt-6">
        <VoucherHistory title="سندات القبض السابقة" icon="fa-money-bill-wave"
          sources={['receipt']} screen="receipt" onEdit={startEdit} />
      </div>
    </div>
  );
}
