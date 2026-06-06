import { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { useRxQuery } from '../hooks/useRx';
import { useShortcuts } from '../hooks/useShortcuts';
import { canScreen } from '../services/auth';
import { PageHeader, SectionCard, EmptyState } from '../components/ui/Page';
import { Modal, ConfirmDialog } from '../components/ui/Modal';
import { fmtYER } from '../lib/format';
import { nextItemNo } from '../services/operations';
import { uid } from '../lib/id';
import type { AccessoryDoc } from '../db/types';

interface FormState { id?: string; name: string; quantity: string; purchasePrice: string; sellPrice: string; }
const emptyForm = (): FormState => ({ name: '', quantity: '', purchasePrice: '', sellPrice: '' });

export default function Accessories() {
  const { db, user } = useApp();
  const { push } = useToast();
  const { data: accessories } = useRxQuery<AccessoryDoc>(() => db?.accessories.find(), [db]);
  const [term, setTerm] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [delTarget, setDelTarget] = useState<AccessoryDoc | null>(null);

  const canAdd = canScreen(user, 'accessories', 'add');
  const canEdit = canScreen(user, 'accessories', 'edit');
  const canDelete = canScreen(user, 'accessories', 'delete');

  const filtered = useMemo(() => {
    const t = term.trim().toLowerCase();
    const list = [...accessories].sort((a, b) => a.itemNo - b.itemNo);
    if (!t) return list;
    return list.filter((a) => a.name.toLowerCase().includes(t) || String(a.itemNo).includes(t));
  }, [accessories, term]);

  function openAdd() { if (!canAdd) return; setForm(emptyForm()); setOpen(true); }
  function openEdit(a: AccessoryDoc) {
    if (!canEdit) return;
    setForm({ id: a.id, name: a.name, quantity: String(a.quantity), purchasePrice: String(a.purchasePrice), sellPrice: String(a.sellPrice) });
    setOpen(true);
  }

  useShortcuts({ onAdd: openAdd }, true);

  async function save() {
    if (!db) return;
    if (!form.name.trim()) { push('warning', 'أدخل اسم الصنف'); return; }
    const now = new Date().toISOString();
    const payload = {
      name: form.name.trim(),
      quantity: parseFloat(form.quantity) || 0,
      purchasePrice: parseFloat(form.purchasePrice) || 0,
      sellPrice: parseFloat(form.sellPrice) || 0,
      updatedAt: now,
    };
    try {
      if (form.id) {
        const doc = await db.accessories.findOne(form.id).exec();
        await doc?.patch(payload);
        push('success', 'تم تحديث الصنف');
      } else {
        const itemNo = await nextItemNo(db);
        await db.accessories.insert({ id: uid('acy'), itemNo, ...payload, createdAt: now });
        push('success', 'تمت إضافة الصنف');
      }
      setOpen(false); setForm(emptyForm());
    } catch (err: any) {
      push('error', err.message || 'فشل الحفظ');
    }
  }

  async function confirmDelete() {
    if (!db || !delTarget) return;
    const t = delTarget; setDelTarget(null);
    const doc = await db.accessories.findOne(t.id).exec();
    await doc?.remove();
    push('success', 'تم حذف الصنف');
  }

  return (
    <div>
      <PageHeader title="الإكسسوارات" subtitle="إدارة مخزون الإكسسوارات (غير مرتبط بالقيود المحاسبية)" icon="fa-boxes-stacked"
        actions={canAdd && (
          <button className="btn-primary" onClick={openAdd}>
            <i className="fa-solid fa-plus"></i> إضافة صنف <kbd className="hidden sm:inline text-[10px] mr-1">F2</kbd>
          </button>
        )} />

      <SectionCard title={`الأصناف (${filtered.length})`} icon="fa-list"
        actions={
          <div className="relative w-56">
            <i className="fa-solid fa-magnifying-glass absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 text-sm"></i>
            <input className="input pr-9 btn-sm" placeholder="بحث..." value={term} onChange={(e) => setTerm(e.target.value)} />
          </div>
        }>
        {filtered.length === 0 ? (
          <EmptyState icon="fa-boxes-stacked" title="لا توجد أصناف" hint="اضغط F2 لإضافة صنف جديد" />
        ) : (
          <div className="overflow-x-auto -mx-5">
            <table className="data-table">
              <thead><tr><th>#</th><th>الصنف</th><th className="text-left">الكمية</th><th className="text-left">سعر الشراء</th><th className="text-left">سعر البيع</th><th></th></tr></thead>
              <tbody>
                {filtered.map((a) => (
                  <tr key={a.id}>
                    <td className="num text-ink-400">{a.itemNo}</td>
                    <td className="font-semibold">{a.name}</td>
                    <td className="text-left"><span className={`badge ${a.quantity > 0 ? 'badge-green' : 'badge-red'}`}>{a.quantity}</span></td>
                    <td className="num text-left text-ink-500">{fmtYER(a.purchasePrice)}</td>
                    <td className="num text-left font-bold text-royal-700">{fmtYER(a.sellPrice)}</td>
                    <td className="text-left whitespace-nowrap">
                      {canEdit && <button className="btn-ghost btn-icon text-royal-500" onClick={() => openEdit(a)}><i className="fa-solid fa-pen"></i></button>}
                      {canDelete && <button className="btn-ghost btn-icon text-red-500" onClick={() => setDelTarget(a)}><i className="fa-solid fa-trash"></i></button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <Modal open={open} title={form.id ? 'تعديل صنف' : 'إضافة صنف'} icon="fa-box" onClose={() => setOpen(false)}
        footer={<><button className="btn-ghost" onClick={() => setOpen(false)}>إلغاء</button><button className="btn-primary" onClick={save}>حفظ</button></>}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="field-label">اسم الصنف</label>
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />
          </div>
          <div>
            <label className="field-label">الكمية</label>
            <input type="number" className="input num" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
          </div>
          <div>
            <label className="field-label">سعر الشراء</label>
            <input type="number" className="input num" value={form.purchasePrice} onChange={(e) => setForm({ ...form, purchasePrice: e.target.value })} />
          </div>
          <div>
            <label className="field-label">سعر البيع</label>
            <input type="number" className="input num" value={form.sellPrice} onChange={(e) => setForm({ ...form, sellPrice: e.target.value })} />
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={!!delTarget} title="حذف الصنف" danger confirmText="حذف"
        message={delTarget ? `هل تريد حذف الصنف "${delTarget.name}"؟` : ''}
        onConfirm={confirmDelete} onCancel={() => setDelTarget(null)} />
    </div>
  );
}
