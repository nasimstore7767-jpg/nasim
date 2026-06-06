import type { ERPDatabase } from '../db';
import type { AccountDoc, AccountType, JournalLine, SourceType } from '../db/types';
import { uid } from '../lib/id';

export async function nextSeq(db: ERPDatabase, id: string): Promise<number> {
  const doc = await db.sequences.findOne(id).exec();
  if (!doc) {
    await db.sequences.insert({ id, value: 1, updatedAt: new Date().toISOString() });
    return 1;
  }
  const next = (doc.value || 0) + 1;
  await doc.patch({ value: next, updatedAt: new Date().toISOString() });
  return next;
}

// Unified, simple ascending voucher/invoice numbering starting from 1.
// No prefixes (no RV/PV/INV...) and no zero-padding — just 1, 2, 3, ...
// A single shared sequence keeps numbers unique across all document types.
export async function nextVoucherNo(db: ERPDatabase, _source: SourceType): Promise<string> {
  const n = await nextSeq(db, 'voucher');
  return String(n);
}

export async function getAccountByCode(db: ERPDatabase, code: string): Promise<AccountDoc> {
  const doc = await db.accounts.findOne({ selector: { code } }).exec();
  if (!doc) throw new Error(`الحساب غير موجود: ${code}`);
  return doc.toJSON() as AccountDoc;
}

export interface PostJournalInput {
  voucherNo: string;
  date: string;
  source: SourceType;
  sourceId: string;
  description: string;
  lines: JournalLine[];
  createdBy: string;
}

export async function postJournal(db: ERPDatabase, input: PostJournalInput) {
  const debit = input.lines.reduce((s, l) => s + (l.debit || 0), 0);
  const credit = input.lines.reduce((s, l) => s + (l.credit || 0), 0);
  if (Math.round((debit - credit) * 100) !== 0) {
    throw new Error('القيد غير متوازن: مجموع المدين لا يساوي مجموع الدائن');
  }
  const doc = await db.journal.insert({
    id: uid('jr'),
    voucherNo: input.voucherNo,
    date: input.date,
    source: input.source,
    sourceId: input.sourceId,
    description: input.description,
    lines: input.lines,
    createdBy: input.createdBy,
    createdAt: new Date().toISOString(),
  });
  return doc;
}

// natural balance direction by account type
export function naturalBalance(type: AccountType, debit: number, credit: number): number {
  switch (type) {
    case 'asset':
    case 'expense':
    case 'customer':
      return debit - credit;
    case 'revenue':
    case 'equity':
      return credit - debit;
    default:
      return debit - credit;
  }
}

export interface BalanceAccumulator {
  debit: number;
  credit: number;
}

// Compute debit/credit totals per accountId across all journal entries (optionally filtered)
export function computeBalances(
  journals: { lines: JournalLine[]; date: string }[],
  opts: { from?: string; to?: string } = {},
): Record<string, BalanceAccumulator> {
  const map: Record<string, BalanceAccumulator> = {};
  for (const j of journals) {
    if (opts.from && j.date < opts.from) continue;
    if (opts.to && j.date > opts.to) continue;
    for (const l of j.lines) {
      if (!map[l.accountId]) map[l.accountId] = { debit: 0, credit: 0 };
      map[l.accountId].debit += l.debit || 0;
      map[l.accountId].credit += l.credit || 0;
    }
  }
  return map;
}

export async function cashBalance(db: ERPDatabase): Promise<number> {
  const cash = await getAccountByCode(db, 'CASH');
  const journals = await db.journal.find().exec();
  let debit = 0, credit = 0;
  for (const j of journals) {
    for (const l of j.lines) {
      if (l.accountId === cash.id) { debit += l.debit || 0; credit += l.credit || 0; }
    }
  }
  return debit - credit; // asset
}

export async function accountBalance(db: ERPDatabase, accountId: string, type: AccountType): Promise<number> {
  const journals = await db.journal.find().exec();
  let debit = 0, credit = 0;
  for (const j of journals) {
    for (const l of j.lines) {
      if (l.accountId === accountId) { debit += l.debit || 0; credit += l.credit || 0; }
    }
  }
  return naturalBalance(type, debit, credit);
}
