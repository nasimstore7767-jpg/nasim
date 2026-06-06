import { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { useRxQuery } from '../hooks/useRx';
import { SectionCard, EmptyState } from './ui/Page';
import { ConfirmDialog } from './ui/Modal';
import { fmtYER, fmtDateAr } from '../lib/format';
import { printVoucher } from '../lib/print';
import { deleteVoucher } from '../services/operations';
import { canDeleteScreen } from '../services/auth';
import type { JournalDoc, ScreenKey, SourceType } from '../db/types';

type SortKey = 'date' | 'voucherNo' | 'amount';
type SortDir = 'asc' | 'desc';

interface Props {
  title?: string;
  icon?: string;
  /** which journal source types to show */
  sources: SourceType[];
  /** screen key used for permission checks (delete) */
  screen?: ScreenKey;
  /** show a search box */
  searchable?: boolean;
  /** optional edit handler — when provided an edit button appears */
  onEdit?: (j: JournalDoc) => void;
  /** allow deletion (default true) */
  deletable?: boolean;
  /** max height for the scroll area */
  maxHeightClass?: string;
}

export function VoucherHistory({
  title = 'السجلات السابقة', icon = 'fa-clock-rotate-left', sources, screen,
  searchable = true, onEdit, deletable = true, maxHeightClass = 'max-h-[30rem]',
}: Props) {
  const { db, user, settings } = useApp();
  const { push } = useToast();
  const { data: journals } = useRxQuery<JournalDoc>(() => db?.journal.find(), [db]);

  const [term, setTerm] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [delTarget, setDelTarget] = useState<JournalDoc | null>(null);

  const srcSet = useMemo(() => new Set(sources), [sources]);
  const canDelete = deletable && canDeleteScreen(user, screen);

  const rows = useMemo(() => {
    const t = term.trim().toLowerCase();
    let list = journals.filter((j) => srcSet.has(j.source));
    if (t) {
      list = list.filter((j) =>
        j.voucherNo.toLowerCase().includes(t) ||
        j.description.toLowerCase().includes(t) ||
        j.lines.some((l) => l.accountName.toLowerCase().includes(t)));
    }
    const amountOf = (j: JournalDoc) => j.lines.reduce((s, l) => s + (l.debit || 0), 0);
    const sorted = [...list].sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'amount') cmp = amountOf(a) - amountOf(b);
      else if (sortKey === 'voucherNo') cmp = a.voucherNo.localeCompare(b.voucherNo, 'en', { numeric: true });
      else cmp = a.date === b.date ? a.createdAt.localeCompare(b.createdAt) : a.date.localeCompare(b.date);
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [journals, srcSet, term, sortKey, sortDir]);

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(k); setSortDir(k === 'voucherNo' ? 'asc' : 'desc'); }
  }

  function sortIcon(k: SortKey) {
    if (sortKey !== k) return 'fa-sort text-ink-300';
    return sortDir === 'asc' ? 'fa-sort-up text-royal-500' : 'fa-sort-down text-royal-500';
  }

  async function confirmDelete() {
    if (!db || !delTarget) return;
    const t = delTarget; setDelTarget(null);
    try {
      await deleteVoucher(db, t.id);
      push('success', `تم حذف السند ${t.voucherNo}`);
    } catch (err: any) {
      push('error', err.message || 'تعذّر حذف السند');
    }
  }

  return (
    <SectionCard title={title} icon={icon}
      actions={searchable ? (
        <div className="relative w-56">
          <i className="fa-solid fa-magnifying-glass absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 text-sm"></i>
          <input className="input pr-9 btn-sm" placeholder="بحث برقم السند أو البيان..." value={term} onChange={(e) => setTerm(e.target.value)} />
        </div>
      ) : undefined}>
      {rows.length === 0 ? (
        <EmptyState icon={icon} title="لا توجد سجلات" hint="ستظهر هنا العمليات بعد حفظها" />
      ) : (
        <div className={`overflow-x-auto overflow-y-auto -mx-5 ${maxHeightClass}`}>
          <table className="data-table">
            <thead>
              <tr>
                <th className="cursor-pointer select-none" onClick={() => toggleSort('date')}>
                  التاريخ <i className={`fa-solid ${sortIcon('date')} text-xs`}></i>
                </th>
                <th className="cursor-pointer select-none" onClick={() => toggleSort('voucherNo')}>
                  رقم السند <i className={`fa-solid ${sortIcon('voucherNo')} text-xs`}></i>
                </th>
                <th>البيان</th>
                <th className="text-left cursor-pointer select-none" onClick={() => toggleSort('amount')}>
                  المبلغ <i className={`fa-solid ${sortIcon('amount')} text-xs`}></i>
                </th>
                <th className="text-left w-px">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((j) => {
                const amount = j.lines.reduce((s, l) => s + (l.debit || 0), 0);
                return (
                  <tr key={j.id}>
                    <td className="num text-ink-400 whitespace-nowrap">{fmtDateAr(j.date)}</td>
                    <td className="num font-semibold text-royal-600 whitespace-nowrap">{j.voucherNo}</td>
                    <td className="text-ink-600 max-w-sm truncate" title={j.description}>{j.description}</td>
                    <td className="num text-left font-bold whitespace-nowrap">{fmtYER(amount)}</td>
                    <td className="text-left whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        <button className="btn-ghost btn-icon text-ink-500 hover:text-royal-600" title="طباعة"
                          onClick={() => printVoucher(j, settings?.companyName, user?.fullName || user?.username)}>
                          <i className="fa-solid fa-print"></i>
                        </button>
                        {onEdit && (
                          <button className="btn-ghost btn-icon text-ink-500 hover:text-amber-600" title="تعديل"
                            onClick={() => onEdit(j)}>
                            <i className="fa-solid fa-pen"></i>
                          </button>
                        )}
                        {canDelete && (
                          <button className="btn-ghost btn-icon text-ink-500 hover:text-red-600" title="حذف"
                            onClick={() => setDelTarget(j)}>
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

      <ConfirmDialog open={!!delTarget} title="حذف السند" danger confirmText="نعم، احذف السند"
        message={delTarget
          ? `سيتم حذف السند ${delTarget.voucherNo} وعكس أثره المحاسبي بالكامل${
              delTarget.source === 'posSale' ? ' (مع إرجاع الكميات للمخزون)' :
              delTarget.source === 'deviceDelivery' ? ' (وإعادة فتح أمر العمل)' : ''}. هل أنت متأكد؟`
          : ''}
        onConfirm={confirmDelete} onCancel={() => setDelTarget(null)} />
    </SectionCard>
  );
}
