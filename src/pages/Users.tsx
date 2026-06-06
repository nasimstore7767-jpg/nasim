import { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { useRxQuery } from '../hooks/useRx';
import { PageHeader, SectionCard, EmptyState } from '../components/ui/Page';
import { Modal, ConfirmDialog } from '../components/ui/Modal';
import { emptyPermissions } from '../services/auth';
import { hashPassword } from '../lib/crypto';
import { uid } from '../lib/id';
import type {
  OperationPermission, PermissionMap, ScreenKey, ScreenPermission, UserDoc,
} from '../db/types';

const SCREENS: { key: ScreenKey; label: string }[] = [
  { key: 'dashboard', label: 'لوحة التحكم' },
  { key: 'receipt', label: 'سند قبض' },
  { key: 'payment', label: 'سند صرف' },
  { key: 'cashReset', label: 'تصفير الصندوق' },
  { key: 'deviceIntake', label: 'استلام جهاز' },
  { key: 'deviceDelivery', label: 'تسليم جهاز' },
  { key: 'advanceRefund', label: 'استرجاع دفعة' },
  { key: 'creditProgramming', label: 'برمجة آجلة' },
  { key: 'pos', label: 'بيع الإكسسوارات' },
  { key: 'balanceSales', label: 'بيع الرصيد' },
  { key: 'accounts', label: 'دليل الحسابات' },
  { key: 'accessories', label: 'الإكسسوارات' },
  { key: 'reports', label: 'التقارير' },
  { key: 'serviceSetup', label: 'إعداد الخدمات' },
  { key: 'users', label: 'المستخدمون' },
  { key: 'settings', label: 'إعدادات النظام' },
];
const SCREEN_PERMS: { key: ScreenPermission; label: string }[] = [
  { key: 'view', label: 'عرض' }, { key: 'add', label: 'إضافة' },
  { key: 'edit', label: 'تعديل' }, { key: 'delete', label: 'حذف' },
];
const OPS: { key: OperationPermission; label: string }[] = [
  { key: 'cashPayment', label: 'الصرف النقدي' },
  { key: 'cashReceipt', label: 'القبض النقدي' },
  { key: 'cashReset', label: 'تصفير الصندوق' },
  { key: 'reports', label: 'الاطلاع على التقارير' },
];

interface Form { id?: string; username: string; fullName: string; password: string; role: 'admin' | 'user'; active: boolean; permissions: PermissionMap; }
const emptyForm = (): Form => ({ username: '', fullName: '', password: '', role: 'user', active: true, permissions: emptyPermissions() });

export default function Users() {
  const { db, user: currentUser } = useApp();
  const { push } = useToast();
  const { data: users } = useRxQuery<UserDoc>(() => db?.users.find(), [db]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Form>(emptyForm());
  const [delTarget, setDelTarget] = useState<UserDoc | null>(null);

  const list = useMemo(() => [...users].sort((a, b) => (a.createdAt > b.createdAt ? 1 : -1)), [users]);

  function openAdd() { setForm(emptyForm()); setOpen(true); }
  function openEdit(u: UserDoc) {
    setForm({ id: u.id, username: u.username, fullName: u.fullName, password: '', role: u.role, active: u.active, permissions: JSON.parse(JSON.stringify(u.permissions || emptyPermissions())) });
    setOpen(true);
  }

  function toggleScreen(screen: ScreenKey, perm: ScreenPermission) {
    setForm((f) => {
      const screens = { ...f.permissions.screens };
      const cur = { ...(screens[screen] || {}) };
      cur[perm] = !cur[perm];
      if (perm !== 'view' && cur[perm]) cur.view = true; // implies view
      screens[screen] = cur;
      return { ...f, permissions: { ...f.permissions, screens } };
    });
  }
  function toggleOp(op: OperationPermission) {
    setForm((f) => ({ ...f, permissions: { ...f.permissions, operations: { ...f.permissions.operations, [op]: !f.permissions.operations[op] } } }));
  }

  async function save() {
    if (!db) return;
    if (!form.username.trim()) { push('warning', 'أدخل اسم المستخدم'); return; }
    if (!form.id && !form.password) { push('warning', 'أدخل كلمة المرور'); return; }
    try {
      const now = new Date().toISOString();
      if (form.id) {
        const doc = await db.users.findOne(form.id).exec();
        if (!doc) return;
        const patch: any = {
          username: form.username.trim(), fullName: form.fullName.trim(), role: form.role,
          active: form.active, permissions: form.permissions, updatedAt: now,
        };
        if (form.password) patch.password = await hashPassword(form.password);
        await doc.patch(patch);
        push('success', 'تم تحديث المستخدم');
      } else {
        const exists = await db.users.findOne({ selector: { username: form.username.trim() } }).exec();
        if (exists) { push('error', 'اسم المستخدم موجود مسبقاً'); return; }
        await db.users.insert({
          id: uid('usr'), username: form.username.trim(), fullName: form.fullName.trim(),
          password: await hashPassword(form.password), role: form.role, active: form.active,
          permissions: form.permissions, createdAt: now, updatedAt: now,
        });
        push('success', 'تمت إضافة المستخدم');
      }
      setOpen(false);
    } catch (err: any) {
      push('error', err.message || 'فشل الحفظ');
    }
  }

  async function confirmDelete() {
    if (!db || !delTarget) return;
    const t = delTarget; setDelTarget(null);
    if (t.id === currentUser?.id) { push('error', 'لا يمكنك حذف حسابك الحالي'); return; }
    const doc = await db.users.findOne(t.id).exec();
    await doc?.remove();
    push('success', 'تم حذف المستخدم');
  }

  const isAdmin = form.role === 'admin';

  return (
    <div>
      <PageHeader title="إدارة المستخدمين" subtitle="المستخدمون والصلاحيات لكل شاشة وعملية" icon="fa-users-gear"
        actions={<button className="btn-primary" onClick={openAdd}><i className="fa-solid fa-user-plus"></i> مستخدم جديد</button>} />

      <SectionCard title={`المستخدمون (${list.length})`} icon="fa-users">
        {list.length === 0 ? (
          <EmptyState icon="fa-users" title="لا يوجد مستخدمون" />
        ) : (
          <div className="overflow-x-auto -mx-5">
            <table className="data-table">
              <thead><tr><th>المستخدم</th><th>الاسم</th><th>الدور</th><th>الحالة</th><th></th></tr></thead>
              <tbody>
                {list.map((u) => (
                  <tr key={u.id}>
                    <td className="font-semibold num">{u.username}</td>
                    <td>{u.fullName || '—'}</td>
                    <td><span className={`badge ${u.role === 'admin' ? 'badge-royal' : 'badge-gray'}`}>{u.role === 'admin' ? 'مدير' : 'مستخدم'}</span></td>
                    <td><span className={`badge ${u.active ? 'badge-green' : 'badge-red'}`}>{u.active ? 'نشط' : 'موقوف'}</span></td>
                    <td className="text-left whitespace-nowrap">
                      <button className="btn-ghost btn-icon text-royal-500" onClick={() => openEdit(u)}><i className="fa-solid fa-pen"></i></button>
                      <button className="btn-ghost btn-icon text-red-500" onClick={() => setDelTarget(u)}><i className="fa-solid fa-trash"></i></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <Modal open={open} title={form.id ? 'تعديل مستخدم' : 'مستخدم جديد'} icon="fa-user-gear" size="xl" onClose={() => setOpen(false)}
        footer={<><button className="btn-ghost" onClick={() => setOpen(false)}>إلغاء</button><button className="btn-primary" onClick={save}>حفظ</button></>}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
          <div>
            <label className="field-label">اسم المستخدم</label>
            <input className="input num" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
          </div>
          <div>
            <label className="field-label">الاسم الكامل</label>
            <input className="input" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
          </div>
          <div>
            <label className="field-label">كلمة المرور {form.id && <span className="text-ink-300">(اتركها فارغة للإبقاء)</span>}</label>
            <input type="password" className="input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </div>
          <div>
            <label className="field-label">الدور</label>
            <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as any })}>
              <option value="user">مستخدم</option>
              <option value="admin">مدير (كل الصلاحيات)</option>
            </select>
          </div>
        </div>

        <label className="flex items-center gap-2 mb-5 text-sm font-semibold text-ink-700">
          <input type="checkbox" className="w-4 h-4 accent-royal-600" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> حساب نشط
        </label>

        {isAdmin ? (
          <div className="p-4 rounded-xl bg-royal-50 text-royal-700 text-sm flex items-center gap-2">
            <i className="fa-solid fa-shield-halved"></i> المدير يملك جميع الصلاحيات تلقائياً على كل الشاشات والعمليات.
          </div>
        ) : (
          <>
            <h4 className="font-bold text-ink-700 mb-2 flex items-center gap-2"><i className="fa-solid fa-table-cells text-royal-500"></i> صلاحيات الشاشات</h4>
            <div className="overflow-x-auto border border-ink-100 rounded-xl mb-5">
              <table className="data-table">
                <thead><tr><th>الشاشة</th>{SCREEN_PERMS.map((p) => <th key={p.key} className="text-center">{p.label}</th>)}</tr></thead>
                <tbody>
                  {SCREENS.map((s) => (
                    <tr key={s.key}>
                      <td className="font-semibold text-sm">{s.label}</td>
                      {SCREEN_PERMS.map((p) => (
                        <td key={p.key} className="text-center">
                          <input type="checkbox" className="w-4 h-4 accent-royal-600"
                            checked={!!form.permissions.screens?.[s.key]?.[p.key]}
                            onChange={() => toggleScreen(s.key, p.key)} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h4 className="font-bold text-ink-700 mb-2 flex items-center gap-2"><i className="fa-solid fa-key text-royal-500"></i> صلاحيات العمليات</h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {OPS.map((o) => (
                <label key={o.key} className="flex items-center gap-2 p-3 rounded-xl bg-ink-50 cursor-pointer text-sm font-semibold text-ink-700">
                  <input type="checkbox" className="w-4 h-4 accent-royal-600" checked={!!form.permissions.operations?.[o.key]} onChange={() => toggleOp(o.key)} />
                  {o.label}
                </label>
              ))}
            </div>
          </>
        )}
      </Modal>

      <ConfirmDialog open={!!delTarget} title="حذف المستخدم" danger confirmText="حذف"
        message={delTarget ? `هل تريد حذف المستخدم "${delTarget.username}"؟` : ''}
        onConfirm={confirmDelete} onCancel={() => setDelTarget(null)} />
    </div>
  );
}
