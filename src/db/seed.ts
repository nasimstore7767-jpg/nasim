import type { AccountDoc, DeviceTypeDoc, IssueDoc, SettingsDoc, UserDoc } from './types';
import { uid } from '../lib/id';
import { hashPassword } from '../lib/crypto';

// System account codes referenced across the app
export const SYS = {
  CASH: 'CASH',
  DRAW: 'DRAW',
  CUSTOMERS: 'CUSTOMERS',
  CASHCUST: 'CASHCUST', // عملاء نقدي — حساب وسيط يُصفّى عند التسليم
} as const;

// Default device types master list (manageable from master data section)
export const DEFAULT_DEVICE_TYPES = [
  'Samsung', 'iPhone', 'Huawei', 'Redmi', 'Motorola',
  'LG', 'Vivo', 'LT', 'ZTE', 'HTC', 'Other',
] as const;

export const defaultSettings = (now: string): SettingsDoc => ({
  id: 'settings',
  companyName: 'محل عالم البرمجة للصيانة والبرمجة',
  logo: '',
  currency: 'YER',
  allowSellZeroStock: true,
  updatedAt: now,
});

export async function defaultAdmin(now: string): Promise<UserDoc> {
  return {
    id: uid('usr'),
    username: 'nasim',
    fullName: 'المدير العام',
    password: await hashPassword('n123'),
    role: 'admin',
    active: true,
    permissions: { screens: {}, operations: {} },
    createdAt: now,
    updatedAt: now,
  };
}

function acc(
  code: string, name: string, type: AccountDoc['type'],
  group: string, opts: Partial<AccountDoc> = {}, now = '',
): AccountDoc {
  return {
    id: uid('acc'),
    code,
    name,
    type,
    parentId: null,
    group,
    isLeaf: opts.isLeaf ?? true,
    system: opts.system ?? false,
    dept: opts.dept,
    customerPhone: opts.customerPhone,
    createdAt: now,
    updatedAt: now,
  };
}

// EXACT chart of accounts requested by the user — do not add extra accounts
export function seedAccounts(now: string): AccountDoc[] {
  return [
    // Assets
    acc('CASH', 'الصندوق', 'asset', 'الأصول', { system: true }, now),
    // Equity / Drawings
    acc('DRAW', 'مسحوبات أشرف', 'equity', 'حقوق الملكية', { system: true }, now),
    // Customers (parent group, children added dynamically)
    acc('CUSTOMERS', 'العملاء', 'customer', 'العملاء', { isLeaf: false, system: true }, now),
    // Cash Customers — temporary clearing account (debited on intake, credited on delivery)
    acc('CASHCUST', 'عملاء نقدي', 'customer', 'العملاء', { system: true }, now),

    // Shop expenses
    acc('EXP-ELEC', 'الكهرباء', 'expense', 'مصاريف المحل', {}, now),
    acc('EXP-WATER', 'الماء والثلج', 'expense', 'مصاريف المحل', {}, now),
    acc('EXP-DINNER', 'العشاء', 'expense', 'مصاريف المحل', {}, now),
    acc('EXP-FUEL', 'الوقود', 'expense', 'مصاريف المحل', {}, now),
    acc('EXP-NET', 'الإنترنت', 'expense', 'مصاريف المحل', {}, now),
    acc('EXP-OTHER', 'أخرى', 'expense', 'مصاريف المحل', {}, now),

    // Maintenance expenses — صيانة أحمد قسم يؤثر على إيراد الصيانة أيضاً
    acc('MEXP-AHMED', 'صيانة أحمد', 'expense', 'مصاريف الصيانة', { dept: 'maintenance' }, now),
    acc('MEXP-PARTS', 'قطع الغيار', 'expense', 'مصاريف الصيانة', {}, now),
    acc('MEXP-TRANS', 'مواصلات الصيانة', 'expense', 'مصاريف الصيانة', {}, now),

    // Programming expenses — أشرف عبدالرزاق قسم يؤثر على إيراد البرمجة أيضاً
    acc('PEXP-ASHRAF', 'أشرف عبدالرزاق', 'expense', 'مصاريف البرمجة', { dept: 'programming' }, now),
    acc('PEXP-PC', 'صيانة الكمبيوتر', 'expense', 'مصاريف البرمجة', {}, now),
    acc('PEXP-BOX', 'اشتراكات البوكسات', 'expense', 'مصاريف البرمجة', {}, now),
    acc('PEXP-CREDIT', 'نقاط الكريديت', 'expense', 'مصاريف البرمجة', {}, now),

    // Revenues
    acc('REV-PROG', 'إيراد البرمجة', 'revenue', 'الإيرادات', { system: true }, now),
    acc('REV-MAINT', 'إيراد الصيانة', 'revenue', 'الإيرادات', { system: true }, now),
    acc('REV-ACC', 'إيراد الإكسسوارات', 'revenue', 'الإيرادات', { system: true }, now),
    acc('REV-BAL', 'إيراد مبيعات الرصيد', 'revenue', 'الإيرادات', { system: true }, now),
  ];
}

export function seedIssues(now: string): IssueDoc[] {
  const mk = (name: string, category: IssueDoc['category']): IssueDoc => ({
    id: uid('iss'), name, category, createdAt: now,
  });
  return [
    mk('توطين', 'programming'),
    mk('فك شفرة', 'programming'),
    mk('تثبيت برامج', 'programming'),
    mk('تفعيل 4G', 'programming'),
    mk('تغيير شاشة', 'maintenance'),
    mk('تغيير منفذ الشحن', 'maintenance'),
  ];
}

export function seedDeviceTypes(now: string): DeviceTypeDoc[] {
  return DEFAULT_DEVICE_TYPES.map((name, i) => ({
    id: uid('dvt'), name, sort: i, createdAt: now,
  }));
}
