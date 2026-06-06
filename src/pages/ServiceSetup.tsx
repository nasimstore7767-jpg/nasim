import { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { useRxQuery } from '../hooks/useRx';
import { PageHeader, SectionCard, EmptyState } from '../components/ui/Page';
import { ConfirmDialog } from '../components/ui/Modal';
import { uid } from '../lib/id';
import type { DeviceTypeDoc, IssueDoc } from '../db/types';

function IssueColumn({ category, title, icon, color }: {
  category: 'programming' | 'maintenance'; title: string; icon: string; color: string;
}) {
  const { db } = useApp();
  const { push } = useToast();
  const { data: issues } = useRxQuery<IssueDoc>(
    () => db?.issues.find({ selector: { category } }), [db, category],
  );
  const [name, setName] = useState('');
  const [delTarget, setDelTarget] = useState<IssueDoc | null>(null);

  const list = useMemo(() => [...issues].sort((a, b) => (a.createdAt > b.createdAt ? 1 : -1)), [issues]);

  async function add() {
    if (!db || !name.trim()) { push('warning', 'أدخل اسم العطل/الخدمة'); return; }
    await db.issues.insert({ id: uid('iss'), name: name.trim(), category, createdAt: new Date().toISOString() });
    setName(''); push('success', 'تمت الإضافة');
  }

  async function confirmDelete() {
    if (!db || !delTarget) return;
    const t = delTarget; setDelTarget(null);
    const doc = await db.issues.findOne(t.id).exec();
    await doc?.remove();
    push('success', 'تم الحذف');
  }

  return (
    <SectionCard title={title} icon={icon}>
      <div className="flex gap-2 mb-4">
        <input className="input" placeholder="أضف عطلاً / خدمة جديدة..." value={name}
          onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
        <button className={`btn ${color} text-white px-4`} onClick={add}><i className="fa-solid fa-plus"></i></button>
      </div>
      {list.length === 0 ? (
        <EmptyState icon={icon} title="لا توجد عناصر" />
      ) : (
        <div className="space-y-2">
          {list.map((i) => (
            <div key={i.id} className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-gray-50 hover:bg-gray-100">
              <span className="font-semibold text-ink-700 text-sm">{i.name}</span>
              <button className="text-red-400 hover:text-red-600" onClick={() => setDelTarget(i)}><i className="fa-solid fa-trash"></i></button>
            </div>
          ))}
        </div>
      )}
      <ConfirmDialog open={!!delTarget} title="حذف العنصر" danger confirmText="حذف"
        message={delTarget ? `هل تريد حذف "${delTarget.name}"؟` : ''}
        onConfirm={confirmDelete} onCancel={() => setDelTarget(null)} />
    </SectionCard>
  );
}

function DeviceTypeColumn() {
  const { db } = useApp();
  const { push } = useToast();
  const { data: types } = useRxQuery<DeviceTypeDoc>(() => db?.deviceTypes.find(), [db]);
  const [name, setName] = useState('');
  const [delTarget, setDelTarget] = useState<DeviceTypeDoc | null>(null);

  const list = useMemo(
    () => [...types].sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0) || (a.createdAt > b.createdAt ? 1 : -1)),
    [types],
  );

  async function add() {
    if (!db || !name.trim()) { push('warning', 'أدخل اسم نوع الجهاز'); return; }
    const exists = types.some((t) => t.name.trim().toLowerCase() === name.trim().toLowerCase());
    if (exists) { push('warning', 'هذا النوع موجود مسبقاً'); return; }
    const maxSort = types.reduce((m, t) => Math.max(m, t.sort ?? 0), -1);
    await db.deviceTypes.insert({ id: uid('dvt'), name: name.trim(), sort: maxSort + 1, createdAt: new Date().toISOString() });
    setName(''); push('success', 'تمت الإضافة');
  }

  async function confirmDelete() {
    if (!db || !delTarget) return;
    const t = delTarget; setDelTarget(null);
    const doc = await db.deviceTypes.findOne(t.id).exec();
    await doc?.remove();
    push('success', 'تم الحذف');
  }

  return (
    <SectionCard title="أنواع الأجهزة" icon="fa-mobile-screen-button">
      <div className="flex gap-2 mb-4">
        <input className="input" placeholder="أضف نوع جهاز جديد..." value={name}
          onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
        <button className="btn bg-emerald-600 hover:bg-emerald-700 text-white px-4" onClick={add}><i className="fa-solid fa-plus"></i></button>
      </div>
      {list.length === 0 ? (
        <EmptyState icon="fa-mobile-screen-button" title="لا توجد أنواع" />
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {list.map((t) => (
            <div key={t.id} className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-gray-50 hover:bg-gray-100">
              <span className="font-semibold text-ink-700 text-sm">{t.name}</span>
              <button className="text-red-400 hover:text-red-600" onClick={() => setDelTarget(t)}><i className="fa-solid fa-trash"></i></button>
            </div>
          ))}
        </div>
      )}
      <ConfirmDialog open={!!delTarget} title="حذف نوع الجهاز" danger confirmText="حذف"
        message={delTarget ? `هل تريد حذف "${delTarget.name}"؟` : ''}
        onConfirm={confirmDelete} onCancel={() => setDelTarget(null)} />
    </SectionCard>
  );
}

export default function ServiceSetup() {
  return (
    <div>
      <PageHeader title="إعداد الخدمات والبيانات الأساسية" subtitle="تعريف أعطال البرمجة والصيانة وأنواع الأجهزة المتاحة عند الاستلام" icon="fa-screwdriver-wrench" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <IssueColumn category="programming" title="أعطال / خدمات البرمجة" icon="fa-laptop-code" color="bg-royal-600 hover:bg-royal-700" />
        <IssueColumn category="maintenance" title="أعطال / خدمات الصيانة" icon="fa-screwdriver-wrench" color="bg-amber-500 hover:bg-amber-600" />
        <div className="lg:col-span-2">
          <DeviceTypeColumn />
        </div>
      </div>
    </div>
  );
}
