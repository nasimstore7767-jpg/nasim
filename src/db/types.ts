export type ID = string;
export type ISODate = string;
export type ISODateTime = string;

export type ScreenKey =
  | 'dashboard' | 'users' | 'settings' | 'accounts' | 'payment' | 'receipt'
  | 'cashReset' | 'deviceIntake' | 'deviceDelivery' | 'advanceRefund'
  | 'creditProgramming' | 'pos' | 'balanceSales' | 'serviceSetup'
  | 'accessories' | 'reports';

export type ScreenPermission = 'view' | 'add' | 'edit' | 'delete';
export type OperationPermission = 'cashPayment' | 'cashReceipt' | 'cashReset' | 'reports';

export interface PermissionMap {
  screens: Partial<Record<ScreenKey, Partial<Record<ScreenPermission, boolean>>>>;
  operations: Partial<Record<OperationPermission, boolean>>;
}

export interface UserDoc {
  id: ID; username: string; fullName: string; password: string;
  role: 'admin' | 'user'; active: boolean; permissions: PermissionMap;
  createdAt: ISODateTime; updatedAt: ISODateTime;
}

export interface SettingsDoc {
  id: ID; companyName: string; logo: string; currency: string;
  allowSellZeroStock: boolean; updatedAt: ISODateTime;
}

export type AccountType = 'asset' | 'equity' | 'expense' | 'revenue' | 'customer';
// Department accounts cause a posting to ALSO affect a linked revenue account.
// 'maintenance' => REV-MAINT, 'programming' => REV-PROG
export type DepartmentKey = 'maintenance' | 'programming';
export interface AccountDoc {
  id: ID; code: string; name: string; type: AccountType;
  parentId: ID | null; group: string; isLeaf: boolean; system: boolean;
  dept?: DepartmentKey; customerPhone?: string;
  createdAt: ISODateTime; updatedAt: ISODateTime;
}

export type SourceType =
  | 'payment' | 'receipt' | 'cashReset' | 'deviceIntake' | 'deviceDelivery'
  | 'advanceRefund' | 'creditProgramming' | 'posSale' | 'balanceSale' | 'opening';

export interface JournalLine { accountId: ID; accountName: string; debit: number; credit: number; }
export interface JournalDoc {
  id: ID; voucherNo: string; date: ISODate; source: SourceType; sourceId: ID;
  description: string; lines: JournalLine[]; createdBy: string; createdAt: ISODateTime;
}

export interface SequenceDoc { id: ID; value: number; updatedAt: ISODateTime; }

export interface IssueDoc {
  id: ID; name: string; category: 'programming' | 'maintenance'; createdAt: ISODateTime;
}

export interface DeviceTypeDoc {
  id: ID; name: string; sort: number; createdAt: ISODateTime;
}

export interface AccessoryDoc {
  id: ID; itemNo: number; name: string; quantity: number;
  purchasePrice: number; sellPrice: number; createdAt: ISODateTime; updatedAt: ISODateTime;
}

export type DeviceJobType = 'programming' | 'maintenance';
export type DeviceJobStatus = 'open' | 'delivered' | 'refunded';
export interface DeviceJobDoc {
  id: ID; receiptNo: string; type: DeviceJobType; date: ISODate; time: string;
  customerId: ID; customerName: string; receiver: string; deviceType: string;
  issue: string; model: string; serial: string; agreedPrice: number;
  advance: number; remaining: number; status: DeviceJobStatus;
  deliveredAt?: ISODateTime; createdBy: string; createdAt: ISODateTime; updatedAt: ISODateTime;
}

export interface PosItem { accessoryId: ID; name: string; qty: number; price: number; total: number; }
export interface PosSaleDoc {
  id: ID; invoiceNo: string; date: ISODate; customerId: ID | null; customerName: string;
  items: PosItem[]; total: number; createdBy: string; createdAt: ISODateTime;
}

export type BalanceProvider = 'YOU' | 'Sabafon' | 'YemenMobile' | 'Internet';
export interface BalanceSaleDoc {
  id: ID; voucherNo: string; date: ISODate; customerId: ID | null; customerName: string;
  provider: BalanceProvider; amount: number; createdBy: string; createdAt: ISODateTime;
}
