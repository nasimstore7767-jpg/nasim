import { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { useRxQuery } from '../hooks/useRx';
import { PageHeader, SectionCard, EmptyState } from '../components/ui/Page';
import { Modal, ConfirmDialog } from '../components/ui/Modal';
import { fmtYER } from '../lib/format';
import { naturalBalance } from '../services/accounting';
import {
  createAccount, updateAccount, deleteAccount,
  createCustomer, accountHasMovement,
} from '../services/operations';
import { canAddScreen, canEditScreen, canDeleteScreen } from '../services/auth';
import type { AccountDoc, AccountType, JournalDoc } from '../db/types';

const TYPE_LABEL: Record<string, string> = {
  asset: 'أصل', equity: 'حقوق ملكية', expense: 'مصروف', revenue: 'إيراد', customer: 'عميل',
};

// account types the user can create from the UI (Req #3)
const NEW_TYPES: { id: AccountType; label: string; defaultGroup: string }[] = [
  { id: 'expense', label: 'مصروف', defaultGroup: 'المصروفات' },
  { id: 'revenue', label: 'إيراد', defaultGroup: 'الإيرادات' },
  { id: 'asset', label: 'أصل', defaultGroup: 'الأصول' },
  { id: 'equity', label: 'حقوق ملكية', defaultGroup: 'حقوق الملكية' },
];

export default function Accounts() {
  const { db, user } = useApp();
  const { push } = useToast();
  const { data: accounts } = useRxQuery<AccountDoc>(() => db?.accounts.find(), [db]);
  const { data: journals } = useRxQuery<JournalDoc>(() => db?.journal.find(), [db]);
  const [term, setTerm] = useState('');

  const canAdd = canAddScreen(user, 'accounts');
  const canEdit = canEditScreen(user, 'accounts');
  const canDelete = canDeleteScreen(user, 'accounts');

  // ----- add-account modal (Req #3) -----
  const [addOpen, setAddOpen] = useState(false);
  const [accName, setAccName] = useState('');
  const [accType, setAccType] = useState<AccountType>('expense');
  const [accGroup, setAccGroup] = useState('المصروفات');
  const [savingAcc, setSavingAcc] = useState(false);

  // ----- add/edit customer modal (Req #4) -----
  const [custOpen, setCustOpen] = useState(false);
  const [custEditId, setCustEditId] = useState<string | null>(null);
  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [savingCust, setSavingCust] = useState(false);

  // ----- delete customer -----
  const [delTarget, setDelTarget] = useState<AccountDoc | null>(null);
  const [delMessage, setDelMessage] = useState('');

  // compute balances per account
  const balances = useMemo(() => {
    const map: Record<string, { debit: number; credit: number }> = {};
    for (const j of journals) for (const l of j.lines) {
      (map[l.accountId] ||= { debit: 0, credit: 0 });
      map[l.accountId].debit += l.debit || 0;
      map[l.accountId].credit += l.credit || 0;
    }
    return map;
  }, [journals]);

  function balOf(a: AccountDoc) {
    const b = balances[a.id] || { debit: 0, credit: 0 };
    return naturalBalance(a.type, b.debit, b.credit);
  }

  // movement set: account ids that appear in at least one journal line
  const movedIds = useMemo(() => {
    const s = new Set<string>();
    for (const j of journals) for (const l of j.lines) s.add(l.accountId);
    return s;
  }, [journals]);

  const chartGroups = useMemo(() => {
    const m: Record<string, AccountDoc[]> = {};
    for (const a of accounts) {
      if (a.type === 'customer' && a.isLeaf) continue; // customers shown separately
      if (a.code === 'CUSTOMERS') continue;
      (m[a.group] ||= []).push(a);
    }
    return m;
  }, [accounts]);

  const customers = useMemo(() => {
    const t = term.trim().toLowerCase();
    const list = accounts.filter((a) => a.type === 'customer' && a.isLeaf);
    if (!t) return list;
    return list.filter((c) => c.name.toLowerCase().includes(t) || (c.customerPhone || '').includes(t));
  }, [accounts, term]);

  // ---- add account ----
  function openAddAccount() {
    setAccName(''); setAccType('expense'); setAccGroup('المصروفات'); setAddOpen(true);
  }
  function onTypeChange(t: AccountType) {
    setAccType(t);
    const def = NEW_TYPES.find((x) => x.id === t)?.defaultGroup;
    if (def) setAccGroup(def);
  }
  async function saveAccount() {
    if (!db) return;
    setSavingAcc(true);
    try {
      await createAccount(db, { name: accName, type: accType, group: accGroup });
      push('success', `تمت إضافة الحساب "${accName.trim()}"`);
      setAddOpen(false);
    } catch (err: any) {
      push('error', err.message || 'تعذّر إضافة الحساب');
    } finally {
      setSavingAcc(false);
    }
  }

  // ---- add / edit customer ----
  function openAddCustomer() {
    setCustEditId(null); setCustName(''); setCustPhone(''); setCustOpen(true);
  }
  function openEditCustomer(c: AccountDoc) {
    setCustEditId(c.id); setCustName(c.name); setCustPhone(c.customerPhone || ''); setCustOpen(true);
  }
  async function saveCustomer() {
    if (!db) return;
    if (!custName.trim()) { push('warning', 'أدخل اسم العميل'); return; }
    setSavingCust(true);
    try {
      if (custEditId) {
        await updateAccount(db, custEditId, { name: custName, phone: custPhone });
        push('success', 'تم تعديل بيانات العميل');
      } else {
        await createCustomer(db, { name: custName.trim(), phone: custPhone.trim() });
        push('success', `تمت إضافة العميل "${custName.trim()}"`);
      }
      setCustOpen(false);
    } catch (err: any) {
      push('error', err.message || 'تعذّر حفظ بيانات العميل');
    } finally {
      setSavingCust(false);
    }
  }

  // ---- delete customer (only if no movement) ----
  async function askDeleteCustomer(c: AccountDoc) {
    if (!db) return;
    const hasMove = await accountHasMovement(db, c.id);
    if (hasMove) {
      push('error', `لا يمكن حذف العميل "${c.name}" لوجود حركة على حسابه`);
      return;
    }
    setDelTarget(c);
    setDelMessage(`سيتم حذف حساب العميل "${c.name}" نهائياً. لا توجد أي حركة على حسابه. هل أنت متأكد؟`);
  }
  async function confirmDeleteCustomer() {
    if (!db || !delTarget) return;
    const t = delTarget; setDelTarget(null);
    try {
      await deleteAccount(db, t.id);
      push('success', `تم حذف العميل "${t.name}"`);
    } catch (err: any) {
      push('error', err.message || 'تعذّر حذف العميل');
    }
  }

  return (
    <div>
      <PageHeader title="دليل الحسابات" subtitle="شجرة الحسابات وأرصدة العملاء — إضافة وتعديل وحذف" icon="fa-sitemap"
        actions={canAdd ? (
          <button className="btn-primary btn-sm" onClick={openAddAccount}>
            <i className="fa-solid fa-plus"></i> إضافة حساب
          </button>
        ) : undefined} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionCard title="شجرة الحسابات" icon="fa-folder-tree"
          actions={canAdd ? (
            <button className="btn-secondary btn-sm" onClick={openAddAccount}>
              <i className="fa-solid fa-plus"></i> مصروف / حساب
            </button>
          ) : undefined}>
          <div className="space-y-4">
            {Object.entries(chartGroups).map(([group, accs]) => (
              <div key={group}>
                <p className="text-xs font-extrabold text-ink-400 uppercase tracking-wide mb-2 flex items-center gap-2">
                  <i className="fa-solid fa-folder text-royal-400"></i> {group}
                </p>
                <div className="space-y-1">
                  {accs.map((a) => {
                    const canDel = canDelete && !a.system && !movedIds.has(a.id);
                    return (
                      <div key={a.id} className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-gray-50 group">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-ink-700">{a.name}</span>
                          <span className="badge-gray text-[10px]">{TYPE_LABEL[a.type]}</span>
                          {a.system && <span className="badge-blue text-[10px]">نظامي</span>}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="num text-sm font-bold text-ink-600">{fmtYER(balOf(a))}</span>
                          {canDel && (
                            <button className="btn-ghost btn-icon text-ink-300 hover:text-red-600 opacity-0 group-hover:opacity-100 transition"
                              title="حذف الحساب (بدون حركة)"
                              onClick={() => { setDelTarget(a); setDelMessage(`سيتم حذف الحساب "${a.name}" نهائياً. لا توجد أي حركة عليه. هل أنت متأكد؟`); }}>
                              <i className="fa-solid fa-trash text-xs"></i>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="حسابات العملاء" icon="fa-users"
          actions={
            <div className="flex items-center gap-2">
              <div className="relative w-44">
                <i className="fa-solid fa-magnifying-glass absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 text-sm"></i>
                <input className="input pr-9 btn-sm" placeholder="بحث..." value={term} onChange={(e) => setTerm(e.target.value)} />
              </div>
              {canAdd && (
                <button className="btn-primary btn-sm whitespace-nowrap" onClick={openAddCustomer}>
                  <i className="fa-solid fa-user-plus"></i> عميل
                </button>
              )}
            </div>
          }>
          {customers.length === 0 ? (
            <EmptyState icon="fa-users" title="لا يوجد عملاء" hint="أضف عميلاً جديداً أو سيُضاف تلقائياً عند الاستلام أو البيع" />
          ) : (
            <div className="overflow-x-auto -mx-5 max-h-[28rem] overflow-y-auto">
              <table className="data-table">
                <thead><tr><th>العميل</th><th>الجوال</th><th className="text-left">الرصيد</th><th className="text-left w-px">إجراءات</th></tr></thead>
                <tbody>
                  {customers.map((c) => {
                    const bal = balOf(c);
                    const moved = movedIds.has(c.id);
                    return (
                      <tr key={c.id}>
                        <td className="font-semibold">{c.name}</td>
                        <td className="num text-ink-400">{c.customerPhone || '—'}</td>
                        <td className={`num text-left font-bold ${bal > 0 ? 'text-red-600' : bal < 0 ? 'text-emerald-600' : 'text-ink-400'}`}>
                          {fmtYER(Math.abs(bal))} {bal > 0 ? '(مدين)' : bal < 0 ? '(دائن)' : ''}
                        </td>
                        <td className="text-left whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1">
                            {canEdit && (
                              <button className="btn-ghost btn-icon text-ink-500 hover:text-amber-600" title="تعديل الاسم"
                                onClick={() => openEditCustomer(c)}>
                                <i className="fa-solid fa-pen"></i>
                              </button>
                            )}
                            {canDelete && (
                              <button
                                className={`btn-ghost btn-icon ${moved ? 'text-ink-200 cursor-not-allowed' : 'text-ink-500 hover:text-red-600'}`}
                                title={moved ? 'لا يمكن الحذف — يوجد حركة على الحساب' : 'حذف الحساب'}
                                disabled={moved}
                                onClick={() => askDeleteCustomer(c)}>
                                <i className="fa-solid fa-trash"></i>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      </div>

      {/* Add account modal (Req #3) */}
      <Modal open={addOpen} title="إضافة حساب جديد" icon="fa-folder-plus" onClose={() => setAddOpen(false)}
        footer={
          <>
            <button className="btn-ghost" onClick={() => setAddOpen(false)}>إلغاء</button>
            <button className="btn-primary" disabled={savingAcc || !accName.trim()} onClick={saveAccount}>
              {savingAcc ? <i className="fa-solid fa-spinner fa-spin"></i> : <><i className="fa-solid fa-check"></i> حفظ الحساب</>}
            </button>
          </>
        }>
        <div className="space-y-4">
          <div>
            <label className="field-label">اسم الحساب</label>
            <input className="input" value={accName} onChange={(e) => setAccName(e.target.value)} placeholder="مثال: إيجار المحل، كهرباء، مصروف نقل..." autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label">نوع الحساب</label>
              <select className="input" value={accType} onChange={(e) => onTypeChange(e.target.value as AccountType)}>
                {NEW_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="field-label">المجموعة</label>
              <input className="input" value={accGroup} onChange={(e) => setAccGroup(e.target.value)} placeholder="المجموعة" />
            </div>
          </div>
          <p className="text-xs text-ink-400">
            <i className="fa-solid fa-circle-info"></i> يمكنك إضافة حسابات مصروفات أو أي حساب آخر؛ سيظهر مباشرة في سندات الصرف والقبض.
          </p>
        </div>
      </Modal>

      {/* Add / edit customer modal (Req #4) */}
      <Modal open={custOpen} title={custEditId ? 'تعديل بيانات العميل' : 'إضافة عميل جديد'} icon="fa-user-plus" onClose={() => setCustOpen(false)}
        footer={
          <>
            <button className="btn-ghost" onClick={() => setCustOpen(false)}>إلغاء</button>
            <button className="btn-primary" disabled={savingCust || !custName.trim()} onClick={saveCustomer}>
              {savingCust ? <i className="fa-solid fa-spinner fa-spin"></i> : <><i className="fa-solid fa-check"></i> حفظ</>}
            </button>
          </>
        }>
        <div className="space-y-4">
          <div>
            <label className="field-label">اسم العميل</label>
            <input className="input" value={custName} onChange={(e) => setCustName(e.target.value)} placeholder="اسم العميل" autoFocus />
          </div>
          <div>
            <label className="field-label">رقم الجوال (اختياري)</label>
            <input className="input num" value={custPhone} onChange={(e) => setCustPhone(e.target.value)} placeholder="7xxxxxxxx" />
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={!!delTarget} title="حذف الحساب" danger confirmText="نعم، احذف الحساب"
        message={delMessage}
        onConfirm={confirmDeleteCustomer} onCancel={() => setDelTarget(null)} />
    </div>
  );
}
