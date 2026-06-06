import type { BalanceProvider } from '../db/types';
import { fmtMoney } from '../lib/format';

export const PROVIDER_AR: Record<BalanceProvider, string> = {
  YOU: 'YOU',
  Sabafon: 'سبأفون',
  YemenMobile: 'يمن موبايل',
  Internet: 'إنترنت',
};

export function descPayment(accountName: string, amount: number, note?: string): string {
  const base = `صرف نقدي بمبلغ ${fmtMoney(amount)} ر.ي على حساب ${accountName}`;
  return note ? `${base} - ${note}` : base;
}

export function descReceipt(accountName: string, amount: number, note?: string): string {
  const base = `قبض نقدي بمبلغ ${fmtMoney(amount)} ر.ي من حساب ${accountName}`;
  return note ? `${base} - ${note}` : base;
}

export function descCashReset(amount: number): string {
  return `تصفير الصندوق وتحويل كامل الرصيد ${fmtMoney(amount)} ر.ي من الصندوق إلى مسحوبات أشرف`;
}

export function descDeviceIntake(
  type: 'programming' | 'maintenance', customerName: string, issue: string, deviceType: string,
): string {
  const t = type === 'programming' ? 'برمجة' : 'صيانة';
  return `استلام جهاز ${deviceType} من العميل ${customerName} - ${t}: ${issue}`;
}

export function descAdvance(customerName: string, amount: number): string {
  return `دفعة مقدمة بمبلغ ${fmtMoney(amount)} ر.ي من العميل ${customerName}`;
}

export function descDelivery(
  type: 'programming' | 'maintenance', customerName: string, total: number,
): string {
  const t = type === 'programming' ? 'برمجة' : 'صيانة';
  return `تسليم جهاز للعميل ${customerName} وتحصيل إيراد ${t} بمبلغ ${fmtMoney(total)} ر.ي`;
}

export function descRefund(customerName: string, amount: number): string {
  return `استرجاع دفعة مقدمة بمبلغ ${fmtMoney(amount)} ر.ي للعميل ${customerName}`;
}

export function descCreditProgramming(customerName: string, amount: number, issue: string): string {
  return `برمجة آجلة (${issue}) للعميل ${customerName} بمبلغ ${fmtMoney(amount)} ر.ي على الحساب`;
}

export function descPosSale(itemsCount: number, total: number, customerName: string): string {
  return `بيع إكسسوارات (${itemsCount} صنف) بمبلغ ${fmtMoney(total)} ر.ي - ${customerName}`;
}

export function descBalanceSale(provider: BalanceProvider, amount: number): string {
  return `بيع رصيد ${PROVIDER_AR[provider]} بمبلغ ${fmtMoney(amount)} ر.ي`;
}
