import { useMemo, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { useRxQuery } from '../hooks/useRx';
import type { AccountDoc } from '../db/types';
import { createCustomer } from '../services/operations';
import { Modal } from './ui/Modal';

interface Props {
  value: string | null;           // selected customer account id
  onChange: (id: string | null, name: string) => void;
  allowCash?: boolean;            // allow "نقدي" (null customer)
  label?: string;
}

export function CustomerPicker({ value, onChange, allowCash = false, label = 'العميل' }: Props) {
  const { db } = useApp();
  const { push } = useToast();
  const [term, setTerm] = useState('');
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const boxRef = useRef<HTMLDivElement>(null);

  const { data: customers } = useRxQuery<AccountDoc>(
    () => db?.accounts.find({ selector: { type: 'customer', isLeaf: true } }),
    [db],
  );

  const selected = useMemo(
    () => customers.find((c) => c.id === value),
    [customers, value],
  );

  const filtered = useMemo(() => {
    const t = term.trim().toLowerCase();
    if (!t) return customers.slice(0, 30);
    return customers.filter(
      (c) => c.name.toLowerCase().includes(t) || (c.customerPhone || '').includes(t),
    ).slice(0, 30);
  }, [customers, term]);

  const displayValue = open
    ? term
    : (selected ? selected.name : (value === null && allowCash ? 'نقدي' : ''));

  async function handleAdd() {
    if (!db || !newName.trim()) { push('warning', 'أدخل اسم العميل'); return; }
    const acc = await createCustomer(db, { name: newName.trim(), phone: newPhone.trim() });
    onChange(acc.id, acc.name);
    setAdding(false); setNewName(''); setNewPhone(''); setOpen(false);
    push('success', `تمت إضافة العميل: ${acc.name}`);
  }

  return (
    <div className="relative" ref={boxRef}>
      <label className="block text-sm font-semibold text-ink-600 mb-1.5">{label}</label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <i className="fa-solid fa-magnifying-glass absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 text-sm"></i>
          <input
            className="input pr-9"
            placeholder="ابحث بالاسم أو الجوال..."
            value={displayValue}
            onFocus={() => { setOpen(true); setTerm(''); }}
            onChange={(e) => { setTerm(e.target.value); setOpen(true); }}
            onBlur={() => setTimeout(() => setOpen(false), 180)}
          />
          {open && (
            <div className="absolute z-30 mt-1 w-full bg-white rounded-xl shadow-elevated border border-gray-100 max-h-64 overflow-y-auto">
              {allowCash && (
                <button type="button"
                  className="w-full text-right px-4 py-2.5 hover:bg-royal-50 text-ink-700 flex items-center gap-2 border-b border-gray-50"
                  onMouseDown={() => { onChange(null, 'نقدي'); setOpen(false); }}>
                  <i className="fa-solid fa-money-bill text-emerald-500"></i> نقدي (بدون عميل)
                </button>
              )}
              {filtered.map((c) => (
                <button key={c.id} type="button"
                  className="w-full text-right px-4 py-2.5 hover:bg-royal-50 text-ink-700 flex items-center justify-between"
                  onMouseDown={() => { onChange(c.id, c.name); setOpen(false); }}>
                  <span>{c.name}</span>
                  {c.customerPhone && <span className="text-xs text-ink-300 num">{c.customerPhone}</span>}
                </button>
              ))}
              {filtered.length === 0 && (
                <div className="px-4 py-3 text-sm text-ink-300 text-center">لا يوجد عملاء مطابقون</div>
              )}
            </div>
          )}
        </div>
        <button type="button" className="btn-ghost px-3" title="إضافة عميل جديد"
          onClick={() => { setNewName(term); setAdding(true); }}>
          <i className="fa-solid fa-user-plus"></i>
        </button>
      </div>

      <Modal open={adding} title="إضافة عميل جديد" icon="fa-user-plus" onClose={() => setAdding(false)} size="sm"
        footer={
          <>
            <button className="btn-ghost" onClick={() => setAdding(false)}>إلغاء</button>
            <button className="btn-primary" onClick={handleAdd}>حفظ</button>
          </>
        }>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-semibold text-ink-600 mb-1.5">اسم العميل</label>
            <input className="input" value={newName} onChange={(e) => setNewName(e.target.value)} autoFocus />
          </div>
          <div>
            <label className="block text-sm font-semibold text-ink-600 mb-1.5">رقم الجوال (اختياري)</label>
            <input className="input num" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} />
          </div>
        </div>
      </Modal>
    </div>
  );
}
