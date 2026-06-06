import type { RxJsonSchema } from 'rxdb';
import type {
  UserDoc, SettingsDoc, AccountDoc, JournalDoc, SequenceDoc,
  IssueDoc, AccessoryDoc, DeviceJobDoc, PosSaleDoc, BalanceSaleDoc, DeviceTypeDoc,
} from './types';

export const userSchema: RxJsonSchema<UserDoc> = {
  title: 'users', version: 0, primaryKey: 'id', type: 'object',
  properties: {
    id: { type: 'string', maxLength: 64 },
    username: { type: 'string' },
    fullName: { type: 'string' },
    password: { type: 'string' },
    role: { type: 'string' },
    active: { type: 'boolean' },
    permissions: { type: 'object' },
    createdAt: { type: 'string' },
    updatedAt: { type: 'string' },
  },
  required: ['id', 'username', 'password', 'role'],
};

export const settingsSchema: RxJsonSchema<SettingsDoc> = {
  title: 'settings', version: 0, primaryKey: 'id', type: 'object',
  properties: {
    id: { type: 'string', maxLength: 64 },
    companyName: { type: 'string' },
    logo: { type: 'string' },
    currency: { type: 'string' },
    allowSellZeroStock: { type: 'boolean' },
    updatedAt: { type: 'string' },
  },
  required: ['id'],
};

export const accountSchema: RxJsonSchema<AccountDoc> = {
  title: 'accounts', version: 0, primaryKey: 'id', type: 'object',
  properties: {
    id: { type: 'string', maxLength: 64 },
    code: { type: 'string', maxLength: 64 },
    name: { type: 'string' },
    type: { type: 'string' },
    parentId: { type: ['string', 'null'] },
    group: { type: 'string' },
    isLeaf: { type: 'boolean' },
    system: { type: 'boolean' },
    dept: { type: 'string' },
    customerPhone: { type: 'string' },
    createdAt: { type: 'string' },
    updatedAt: { type: 'string' },
  },
  required: ['id', 'code', 'name', 'type'],
  indexes: ['code'],
};

export const journalSchema: RxJsonSchema<JournalDoc> = {
  title: 'journal', version: 0, primaryKey: 'id', type: 'object',
  properties: {
    id: { type: 'string', maxLength: 64 },
    voucherNo: { type: 'string', maxLength: 32 },
    date: { type: 'string', maxLength: 16 },
    source: { type: 'string', maxLength: 32 },
    sourceId: { type: 'string' },
    description: { type: 'string' },
    lines: { type: 'array' },
    createdBy: { type: 'string' },
    createdAt: { type: 'string', maxLength: 32 },
  },
  required: ['id', 'voucherNo', 'date', 'source'],
  indexes: ['date', 'source', 'createdAt'],
};

export const sequenceSchema: RxJsonSchema<SequenceDoc> = {
  title: 'sequences', version: 0, primaryKey: 'id', type: 'object',
  properties: {
    id: { type: 'string', maxLength: 64 },
    value: { type: 'number' },
    updatedAt: { type: 'string' },
  },
  required: ['id', 'value'],
};

export const issueSchema: RxJsonSchema<IssueDoc> = {
  title: 'issues', version: 0, primaryKey: 'id', type: 'object',
  properties: {
    id: { type: 'string', maxLength: 64 },
    name: { type: 'string' },
    category: { type: 'string', maxLength: 32 },
    createdAt: { type: 'string' },
  },
  required: ['id', 'name', 'category'],
  indexes: ['category'],
};

export const deviceTypeSchema: RxJsonSchema<DeviceTypeDoc> = {
  title: 'deviceTypes', version: 0, primaryKey: 'id', type: 'object',
  properties: {
    id: { type: 'string', maxLength: 64 },
    name: { type: 'string' },
    sort: { type: 'number' },
    createdAt: { type: 'string' },
  },
  required: ['id', 'name'],
};

export const accessorySchema: RxJsonSchema<AccessoryDoc> = {
  title: 'accessories', version: 0, primaryKey: 'id', type: 'object',
  properties: {
    id: { type: 'string', maxLength: 64 },
    itemNo: { type: 'number' },
    name: { type: 'string' },
    quantity: { type: 'number' },
    purchasePrice: { type: 'number' },
    sellPrice: { type: 'number' },
    createdAt: { type: 'string' },
    updatedAt: { type: 'string' },
  },
  required: ['id', 'name'],
};

export const deviceJobSchema: RxJsonSchema<DeviceJobDoc> = {
  title: 'deviceJobs', version: 0, primaryKey: 'id', type: 'object',
  properties: {
    id: { type: 'string', maxLength: 64 },
    receiptNo: { type: 'string', maxLength: 32 },
    type: { type: 'string', maxLength: 32 },
    date: { type: 'string', maxLength: 16 },
    time: { type: 'string' },
    customerId: { type: 'string' },
    customerName: { type: 'string' },
    receiver: { type: 'string' },
    deviceType: { type: 'string' },
    issue: { type: 'string' },
    model: { type: 'string' },
    serial: { type: 'string' },
    agreedPrice: { type: 'number' },
    advance: { type: 'number' },
    remaining: { type: 'number' },
    status: { type: 'string', maxLength: 16 },
    deliveredAt: { type: 'string' },
    createdBy: { type: 'string' },
    createdAt: { type: 'string' },
    updatedAt: { type: 'string' },
  },
  required: ['id', 'receiptNo', 'type', 'status'],
  indexes: ['status', 'type', 'date'],
};

export const posSaleSchema: RxJsonSchema<PosSaleDoc> = {
  title: 'posSales', version: 0, primaryKey: 'id', type: 'object',
  properties: {
    id: { type: 'string', maxLength: 64 },
    invoiceNo: { type: 'string', maxLength: 32 },
    date: { type: 'string', maxLength: 16 },
    customerId: { type: ['string', 'null'] },
    customerName: { type: 'string' },
    items: { type: 'array' },
    total: { type: 'number' },
    createdBy: { type: 'string' },
    createdAt: { type: 'string' },
  },
  required: ['id', 'invoiceNo', 'date'],
  indexes: ['date'],
};

export const balanceSaleSchema: RxJsonSchema<BalanceSaleDoc> = {
  title: 'balanceSales', version: 0, primaryKey: 'id', type: 'object',
  properties: {
    id: { type: 'string', maxLength: 64 },
    voucherNo: { type: 'string', maxLength: 32 },
    date: { type: 'string', maxLength: 16 },
    customerId: { type: ['string', 'null'] },
    customerName: { type: 'string' },
    provider: { type: 'string', maxLength: 32 },
    amount: { type: 'number' },
    createdBy: { type: 'string' },
    createdAt: { type: 'string' },
  },
  required: ['id', 'voucherNo', 'date', 'provider'],
  indexes: ['date'],
};
