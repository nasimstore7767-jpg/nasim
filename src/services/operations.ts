import type { ERPDatabase } from '../db';
import type {
  AccountDoc, BalanceProvider, DepartmentKey, DeviceJobType, JournalLine, PosItem,
} from '../db/types';
import { SYS } from '../db/seed';
import { uid } from '../lib/id';
import { padNo } from '../lib/format';
import {
  cashBalance, getAccountByCode, nextSeq, nextVoucherNo, postJournal,
} from './accounting';
import {
  descBalanceSale, descCashReset, descCreditProgramming,
  descDelivery, descDeviceIntake, descPayment, descPosSale, descReceipt, descRefund,
} from './descriptions';

const REV_BY_TYPE: Record<DeviceJobType, string> = {
  programming: 'REV-PROG',
  maintenance: 'REV-MAINT',
};

// Department accounts → linked revenue account code
const DEPT_REV: Record<DepartmentKey, string> = {
  maintenance: 'REV-MAINT',
  programming: 'REV-PROG',
};

// Fetch a single account document by its id (returns null if not found)
async function getAccountById(db: ERPDatabase, id: string): Promise<AccountDoc | null> {
  const doc = await db.accounts.findOne(id).exec();
  return doc ? (doc.toJSON() as AccountDoc) : null;
}

/**
 * Department-aware posting (Req #3).
 * When a line targets a department expense account (صيانة أحمد / أشرف عبدالرزاق)
 * the operation must ALSO affect the linked revenue account. We model this as a
 * balanced compensating pair so the work is recognised as revenue too:
 *   Debit  Cash     <amount>   (revenue collected for the department's work)
 *   Credit Revenue  <amount>   (Maintenance/Programming revenue recognised)
 * Returns the extra journal lines (empty array if the account is not a dept account).
 */
async function deptRevenueLines(
  db: ERPDatabase, account: AccountDoc, amount: number, cash: AccountDoc,
): Promise<JournalLine[]> {
  if (!account.dept || amount <= 0) return [];
  const rev = await getAccountByCode(db, DEPT_REV[account.dept]);
  return [
    { accountId: cash.id, accountName: cash.name, debit: amount, credit: 0 },
    { accountId: rev.id, accountName: rev.name, debit: 0, credit: amount },
  ];
}

// ---------- Cash Payment ----------
export interface PaymentLineInput { accountId: string; accountName: string; amount: number; note?: string; }
export async function createPayment(
  db: ERPDatabase, p: { date: string; lines: PaymentLineInput[]; createdBy: string },
) {
  const total = p.lines.reduce((s, l) => s + (l.amount || 0), 0);
  if (total <= 0) throw new Error('المبلغ يجب أن يكون أكبر من صفر');
  const cash = await getAccountByCode(db, SYS.CASH);
  const balance = await cashBalance(db);
  if (total > balance) {
    throw new Error(`الرصيد النقدي غير كافٍ. المتاح: ${balance} ر.ي`);
  }
  const voucherNo = await nextVoucherNo(db, 'payment');
  const lines: JournalLine[] = [];
  for (const l of p.lines) {
    // Debit selected account, credit cash (Req #1: any account is allowed)
    lines.push({ accountId: l.accountId, accountName: l.accountName, debit: l.amount, credit: 0 });
    // Req #3: department accounts also recognise revenue for the department
    const acc = await getAccountById(db, l.accountId);
    if (acc) lines.push(...await deptRevenueLines(db, acc, l.amount, cash));
  }
  lines.push({ accountId: cash.id, accountName: cash.name, debit: 0, credit: total });
  const desc = p.lines.length === 1
    ? descPayment(p.lines[0].accountName, p.lines[0].amount, p.lines[0].note)
    : `صرف نقدي متعدد بمبلغ إجمالي ${total} ر.ي`;
  await postJournal(db, {
    voucherNo, date: p.date, source: 'payment', sourceId: voucherNo,
    description: desc, lines, createdBy: p.createdBy,
  });
  return voucherNo;
}

// ---------- Cash Receipt ----------
export interface ReceiptLineInput { accountId: string; accountName: string; amount: number; note?: string; }
export async function createReceipt(
  db: ERPDatabase, p: { date: string; lines: ReceiptLineInput[]; createdBy: string },
) {
  const total = p.lines.reduce((s, l) => s + (l.amount || 0), 0);
  if (total <= 0) throw new Error('المبلغ يجب أن يكون أكبر من صفر');
  const cash = await getAccountByCode(db, SYS.CASH);
  const voucherNo = await nextVoucherNo(db, 'receipt');
  const lines: JournalLine[] = [
    { accountId: cash.id, accountName: cash.name, debit: total, credit: 0 },
  ];
  for (const l of p.lines) {
    // Credit selected account, debit cash (Req #2: any account is allowed)
    lines.push({ accountId: l.accountId, accountName: l.accountName, debit: 0, credit: l.amount });
    // Req #3: department accounts also recognise revenue for the department
    const acc = await getAccountById(db, l.accountId);
    if (acc) lines.push(...await deptRevenueLines(db, acc, l.amount, cash));
  }
  const desc = p.lines.length === 1
    ? descReceipt(p.lines[0].accountName, p.lines[0].amount, p.lines[0].note)
    : `قبض نقدي متعدد بمبلغ إجمالي ${total} ر.ي`;
  await postJournal(db, {
    voucherNo, date: p.date, source: 'receipt', sourceId: voucherNo,
    description: desc, lines, createdBy: p.createdBy,
  });
  return voucherNo;
}

// ---------- Cash Box Clearing / Reconciliation (Req #4) ----------
// Reset (empty) the cash box: transfer the FULL current cash balance to the
// Ashraf Withdrawals account, so the cash box ends at zero.
//   Debit:  Ashraf Withdrawals Account   (مدين مسحوبات أشرف — تزيد)
//   Credit: Cash Account                 (دائن الصندوق — يُصفَّر بالكامل)
export async function cashReset(db: ERPDatabase, p: { date: string; createdBy: string }) {
  const cash = await getAccountByCode(db, SYS.CASH);
  const draw = await getAccountByCode(db, SYS.DRAW);
  // Amount to transfer = FULL current cash box balance (تصفير الصندوق بالكامل)
  const amount = await cashBalance(db);
  if (amount <= 0) throw new Error('لا يوجد رصيد في الصندوق لتصفيره');
  const voucherNo = await nextVoucherNo(db, 'cashReset');
  const lines: JournalLine[] = [
    { accountId: draw.id, accountName: draw.name, debit: amount, credit: 0 },
    { accountId: cash.id, accountName: cash.name, debit: 0, credit: amount },
  ];
  await postJournal(db, {
    voucherNo, date: p.date, source: 'cashReset', sourceId: voucherNo,
    description: descCashReset(amount), lines, createdBy: p.createdBy,
  });
  return { voucherNo, amount };
}

// Balance of the Ashraf Withdrawals (equity) account = credit - debit
export async function drawBalance(db: ERPDatabase): Promise<number> {
  const draw = await getAccountByCode(db, SYS.DRAW);
  const journals = await db.journal.find().exec();
  let debit = 0, credit = 0;
  for (const j of journals) for (const l of j.lines) {
    if (l.accountId === draw.id) { debit += l.debit || 0; credit += l.credit || 0; }
  }
  return credit - debit; // equity natural balance
}

// ---------- Customers ----------
export async function createCustomer(
  db: ERPDatabase, p: { name: string; phone?: string },
): Promise<AccountDoc> {
  const n = await nextSeq(db, 'customer');
  const now = new Date().toISOString();
  const doc = await db.accounts.insert({
    id: uid('acc'),
    code: `CUST-${padNo(n)}`,
    name: p.name,
    type: 'customer',
    parentId: null,
    group: 'العملاء',
    isLeaf: true,
    system: false,
    customerPhone: p.phone || '',
    createdAt: now,
    updatedAt: now,
  });
  return doc.toJSON() as AccountDoc;
}

// ---------- Device Intake ----------
export interface DeviceIntakeInput {
  type: DeviceJobType; date: string; time: string;
  customerId: string; customerName: string; receiver: string;
  deviceType: string; issue: string; model: string; serial: string;
  agreedPrice: number; advance: number; createdBy: string;
}
export async function createDeviceIntake(db: ERPDatabase, p: DeviceIntakeInput) {
  const receiptNo = await nextVoucherNo(db, 'deviceIntake');
  const now = new Date().toISOString();
  const price = p.agreedPrice || 0;
  const advance = Math.max(0, Math.min(p.advance || 0, price > 0 ? price : (p.advance || 0)));
  const remaining = Math.max(0, price - advance);
  // customerName is reference/tracking only — accounting uses the "Cash Customers" account
  const job = await db.deviceJobs.insert({
    id: uid('job'),
    receiptNo, type: p.type, date: p.date, time: p.time,
    customerId: p.customerId, customerName: p.customerName, receiver: p.receiver,
    deviceType: p.deviceType, issue: p.issue, model: p.model, serial: p.serial,
    agreedPrice: price, advance, remaining,
    status: 'open', createdBy: p.createdBy, createdAt: now, updatedAt: now,
  });

  // Req #5: recognise full revenue on reception.
  //   Debit:  Cash Account            <advance>     (collected now)
  //   Debit:  Cash Customers Account  <remaining>   (temporary, cleared on delivery)
  //   Credit: Maintenance OR Programming Revenue <agreedPrice>
  if (price > 0) {
    const cash = await getAccountByCode(db, SYS.CASH);
    const cashCust = await getAccountByCode(db, SYS.CASHCUST);
    const rev = await getAccountByCode(db, REV_BY_TYPE[p.type]);
    const lines: JournalLine[] = [];
    if (advance > 0) lines.push({ accountId: cash.id, accountName: cash.name, debit: advance, credit: 0 });
    if (remaining > 0) lines.push({ accountId: cashCust.id, accountName: cashCust.name, debit: remaining, credit: 0 });
    lines.push({ accountId: rev.id, accountName: rev.name, debit: 0, credit: price });
    await postJournal(db, {
      voucherNo: receiptNo, date: p.date, source: 'deviceIntake', sourceId: job.id,
      description: descDeviceIntake(p.type, p.customerName, p.issue, p.deviceType),
      lines, createdBy: p.createdBy,
    });
  }
  return { receiptNo, jobId: job.id };
}

// ---------- Device Delivery ----------
export async function deliverDevice(
  db: ERPDatabase, p: { jobId: string; date: string; createdBy: string },
) {
  const job = await db.deviceJobs.findOne(p.jobId).exec();
  if (!job) throw new Error('أمر العمل غير موجود');
  if (job.status !== 'open') throw new Error('تم تسليم هذا الجهاز مسبقاً أو تمت معالجته');

  const cash = await getAccountByCode(db, SYS.CASH);
  const cashCust = await getAccountByCode(db, SYS.CASHCUST);
  const voucherNo = await nextVoucherNo(db, 'deviceDelivery');
  const total = job.agreedPrice || 0;
  const advance = job.advance || 0;
  const remaining = Math.max(0, total - advance);

  // Req #6: Account settlement on delivery. Collect the remaining amount in cash and
  // clear the temporary "Cash Customers" balance created at intake so it always
  // reconciles back to zero.
  //   Debit:  Cash Account            <remaining>
  //   Credit: Cash Customers Account  <remaining>
  if (remaining > 0) {
    const lines: JournalLine[] = [
      { accountId: cash.id, accountName: cash.name, debit: remaining, credit: 0 },
      { accountId: cashCust.id, accountName: cashCust.name, debit: 0, credit: remaining },
    ];
    await postJournal(db, {
      voucherNo, date: p.date, source: 'deviceDelivery', sourceId: job.id,
      description: descDelivery(job.type, job.customerName, total), lines, createdBy: p.createdBy,
    });
  }
  await job.patch({
    status: 'delivered', remaining: 0,
    deliveredAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  });
  return { voucherNo };
}

// ---------- Advance Refund ----------
export async function refundAdvance(
  db: ERPDatabase, p: { jobId: string; date: string; createdBy: string },
) {
  const job = await db.deviceJobs.findOne(p.jobId).exec();
  if (!job) throw new Error('أمر العمل غير موجود');
  if (job.status !== 'open') throw new Error('لا يمكن استرجاع الدفعة لهذا الأمر');
  const advance = job.advance || 0;
  if (advance <= 0) throw new Error('لا توجد دفعة مقدمة لاسترجاعها');

  const balance = await cashBalance(db);
  if (advance > balance) throw new Error(`الرصيد النقدي غير كافٍ للاسترجاع. المتاح: ${balance} ر.ي`);

  const cash = await getAccountByCode(db, SYS.CASH);
  const voucherNo = await nextVoucherNo(db, 'advanceRefund');
  // Reverse advance: customer debit (clears credit), cash credit (money out)
  const lines: JournalLine[] = [
    { accountId: job.customerId, accountName: job.customerName, debit: advance, credit: 0 },
    { accountId: cash.id, accountName: cash.name, debit: 0, credit: advance },
  ];
  await postJournal(db, {
    voucherNo, date: p.date, source: 'advanceRefund', sourceId: job.id,
    description: descRefund(job.customerName, advance), lines, createdBy: p.createdBy,
  });
  await job.patch({ status: 'refunded', updatedAt: new Date().toISOString() });
  return { voucherNo };
}

// ---------- Credit Programming (on account, no cash) ----------
export async function createCreditProgramming(
  db: ERPDatabase,
  p: { date: string; customerId: string; customerName: string; issue: string; amount: number; createdBy: string },
) {
  if (p.amount <= 0) throw new Error('المبلغ يجب أن يكون أكبر من صفر');
  const rev = await getAccountByCode(db, 'REV-PROG');
  const voucherNo = await nextVoucherNo(db, 'creditProgramming');
  const lines: JournalLine[] = [
    { accountId: p.customerId, accountName: p.customerName, debit: p.amount, credit: 0 },
    { accountId: rev.id, accountName: rev.name, debit: 0, credit: p.amount },
  ];
  await postJournal(db, {
    voucherNo, date: p.date, source: 'creditProgramming', sourceId: voucherNo,
    description: descCreditProgramming(p.customerName, p.amount, p.issue), lines, createdBy: p.createdBy,
  });
  return { voucherNo };
}

// ---------- POS Sale (accessories) ----------
export async function createPosSale(
  db: ERPDatabase,
  p: { date: string; customerId: string | null; customerName: string; items: PosItem[]; createdBy: string },
) {
  if (!p.items.length) throw new Error('السلة فارغة');
  const total = p.items.reduce((s, it) => s + it.total, 0);
  if (total <= 0) throw new Error('إجمالي الفاتورة يجب أن يكون أكبر من صفر');

  // Decrement inventory
  for (const it of p.items) {
    const acc = await db.accessories.findOne(it.accessoryId).exec();
    if (acc) {
      const q = Math.max(0, (acc.quantity || 0) - it.qty);
      await acc.patch({ quantity: q, updatedAt: new Date().toISOString() });
    }
  }

  const invoiceNo = await nextVoucherNo(db, 'posSale');
  const now = new Date().toISOString();
  const sale = await db.posSales.insert({
    id: uid('pos'), invoiceNo, date: p.date,
    customerId: p.customerId, customerName: p.customerName || 'نقدي',
    items: p.items, total, createdBy: p.createdBy, createdAt: now,
  });

  // Accounting: cash debit, accessories revenue credit
  const cash = await getAccountByCode(db, SYS.CASH);
  const rev = await getAccountByCode(db, 'REV-ACC');
  const lines: JournalLine[] = [
    { accountId: cash.id, accountName: cash.name, debit: total, credit: 0 },
    { accountId: rev.id, accountName: rev.name, debit: 0, credit: total },
  ];
  await postJournal(db, {
    voucherNo: invoiceNo, date: p.date, source: 'posSale', sourceId: sale.id,
    description: descPosSale(p.items.length, total, p.customerName || 'نقدي'),
    lines, createdBy: p.createdBy,
  });
  return { invoiceNo };
}

// ---------- Balance Sale ----------
export async function createBalanceSale(
  db: ERPDatabase,
  p: { date: string; provider: BalanceProvider; amount: number; customerId: string | null; customerName: string; createdBy: string },
) {
  if (p.amount <= 0) throw new Error('المبلغ يجب أن يكون أكبر من صفر');
  const voucherNo = await nextVoucherNo(db, 'balanceSale');
  const now = new Date().toISOString();
  const sale = await db.balanceSales.insert({
    id: uid('bal'), voucherNo, date: p.date,
    customerId: p.customerId, customerName: p.customerName || 'نقدي',
    provider: p.provider, amount: p.amount, createdBy: p.createdBy, createdAt: now,
  });

  const cash = await getAccountByCode(db, SYS.CASH);
  const rev = await getAccountByCode(db, 'REV-BAL');
  const lines: JournalLine[] = [
    { accountId: cash.id, accountName: cash.name, debit: p.amount, credit: 0 },
    { accountId: rev.id, accountName: rev.name, debit: 0, credit: p.amount },
  ];
  await postJournal(db, {
    voucherNo, date: p.date, source: 'balanceSale', sourceId: sale.id,
    description: descBalanceSale(p.provider, p.amount), lines, createdBy: p.createdBy,
  });
  return { voucherNo };
}

export async function nextItemNo(db: ERPDatabase): Promise<number> {
  return nextSeq(db, 'accessory');
}

// ============================================================================
//  Voucher / Journal management — delete & edit (with side-effect reversal)
// ============================================================================

// Does an account have any movement in the journal? (used to guard deletion)
export async function accountHasMovement(db: ERPDatabase, accountId: string): Promise<boolean> {
  const journals = await db.journal.find().exec();
  for (const j of journals) for (const l of j.lines) {
    if (l.accountId === accountId) return true;
  }
  return false;
}

/**
 * Delete a voucher (journal entry) and reverse all its side effects.
 * Because every balance in the system is derived purely from journal lines,
 * removing the journal document fully reverses its accounting impact. We also
 * undo any related documents (device jobs, POS/balance sale records, inventory).
 */
export async function deleteVoucher(db: ERPDatabase, journalId: string): Promise<void> {
  const jr = await db.journal.findOne(journalId).exec();
  if (!jr) throw new Error('السند غير موجود');
  const source = jr.source;
  const sourceId = jr.sourceId;

  if (source === 'deviceIntake') {
    const job = await db.deviceJobs.findOne(sourceId).exec();
    if (job) {
      if (job.status === 'delivered' || job.status === 'refunded') {
        throw new Error('لا يمكن حذف سند الاستلام بعد تسليم/استرجاع الجهاز. احذف سند التسليم أولاً');
      }
      await job.remove();
    }
  } else if (source === 'deviceDelivery') {
    const job = await db.deviceJobs.findOne(sourceId).exec();
    if (job) {
      const remaining = Math.max(0, (job.agreedPrice || 0) - (job.advance || 0));
      await job.patch({ status: 'open', remaining, deliveredAt: undefined, updatedAt: new Date().toISOString() });
    }
  } else if (source === 'advanceRefund') {
    const job = await db.deviceJobs.findOne(sourceId).exec();
    if (job) await job.patch({ status: 'open', updatedAt: new Date().toISOString() });
  } else if (source === 'posSale') {
    const sale = await db.posSales.findOne(sourceId).exec();
    if (sale) {
      for (const it of sale.items || []) {
        const acc = await db.accessories.findOne(it.accessoryId).exec();
        if (acc) await acc.patch({ quantity: (acc.quantity || 0) + (it.qty || 0), updatedAt: new Date().toISOString() });
      }
      await sale.remove();
    }
  } else if (source === 'balanceSale') {
    const sale = await db.balanceSales.findOne(sourceId).exec();
    if (sale) await sale.remove();
  }

  await jr.remove();
}

/**
 * Edit a simple payment voucher (delete + recreate to keep all accounting
 * rules — incl. dept revenue — consistent). Returns the new voucher number.
 */
export async function updatePayment(
  db: ERPDatabase,
  p: { journalId: string; date: string; lines: PaymentLineInput[]; createdBy: string },
) {
  await deleteVoucher(db, p.journalId);
  return createPayment(db, { date: p.date, lines: p.lines, createdBy: p.createdBy });
}

export async function updateReceipt(
  db: ERPDatabase,
  p: { journalId: string; date: string; lines: ReceiptLineInput[]; createdBy: string },
) {
  await deleteVoucher(db, p.journalId);
  return createReceipt(db, { date: p.date, lines: p.lines, createdBy: p.createdBy });
}

export async function updateBalanceSale(
  db: ERPDatabase,
  p: { journalId: string; date: string; provider: BalanceProvider; amount: number; customerId: string | null; customerName: string; createdBy: string },
) {
  await deleteVoucher(db, p.journalId);
  return createBalanceSale(db, {
    date: p.date, provider: p.provider, amount: p.amount,
    customerId: p.customerId, customerName: p.customerName, createdBy: p.createdBy,
  });
}

// ============================================================================
//  Chart of accounts management (Req: add/edit/delete accounts & customers)
// ============================================================================

export interface NewAccountInput {
  name: string; type: AccountDoc['type']; group: string;
  dept?: AccountDoc['dept'];
}

// Generate a unique code for a manually-added account from its type
async function genAccountCode(db: ERPDatabase, type: AccountDoc['type']): Promise<string> {
  const prefixMap: Record<string, string> = {
    expense: 'EXP', revenue: 'REV', asset: 'AST', equity: 'EQT', customer: 'CUST',
  };
  const prefix = prefixMap[type] || 'ACC';
  const all = await db.accounts.find().exec();
  let max = 0;
  for (const a of all) {
    const m = a.code.match(new RegExp(`^${prefix}-U(\\d+)$`));
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `${prefix}-U${padNo(max + 1, 4)}`;
}

export async function createAccount(db: ERPDatabase, p: NewAccountInput): Promise<AccountDoc> {
  const name = p.name.trim();
  if (!name) throw new Error('أدخل اسم الحساب');
  if (!p.group.trim()) throw new Error('أدخل مجموعة الحساب');
  const code = await genAccountCode(db, p.type);
  const now = new Date().toISOString();
  const doc = await db.accounts.insert({
    id: uid('acc'), code, name, type: p.type, parentId: null,
    group: p.group.trim(), isLeaf: true, system: false,
    dept: p.dept, customerPhone: undefined, createdAt: now, updatedAt: now,
  });
  return doc.toJSON() as AccountDoc;
}

export async function updateAccount(
  db: ERPDatabase, accountId: string, patch: { name?: string; phone?: string; group?: string },
): Promise<void> {
  const doc = await db.accounts.findOne(accountId).exec();
  if (!doc) throw new Error('الحساب غير موجود');
  const update: any = { updatedAt: new Date().toISOString() };
  if (patch.name !== undefined) {
    if (!patch.name.trim()) throw new Error('الاسم لا يمكن أن يكون فارغاً');
    update.name = patch.name.trim();
  }
  if (patch.phone !== undefined) update.customerPhone = patch.phone.trim();
  if (patch.group !== undefined && patch.group.trim()) update.group = patch.group.trim();
  await doc.patch(update);
}

export async function deleteAccount(db: ERPDatabase, accountId: string): Promise<void> {
  const doc = await db.accounts.findOne(accountId).exec();
  if (!doc) throw new Error('الحساب غير موجود');
  if (doc.system) throw new Error('لا يمكن حذف حساب نظامي');
  if (await accountHasMovement(db, accountId)) {
    throw new Error('لا يمكن حذف حساب عليه حركة. يمكنك الحذف فقط إذا لم تكن عليه أي قيود');
  }
  await doc.remove();
}
