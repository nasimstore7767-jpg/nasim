import { createRxDatabase, addRxPlugin, type RxDatabase, type RxCollection } from 'rxdb';
import { RxDBDevModePlugin } from 'rxdb/plugins/dev-mode';
import { RxDBUpdatePlugin } from 'rxdb/plugins/update';
import { RxDBQueryBuilderPlugin } from 'rxdb/plugins/query-builder';
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie';

import {
  userSchema, settingsSchema, accountSchema, journalSchema, sequenceSchema,
  issueSchema, accessorySchema, deviceJobSchema, posSaleSchema, balanceSaleSchema,
  deviceTypeSchema,
} from './schemas';
import type {
  UserDoc, SettingsDoc, AccountDoc, JournalDoc, SequenceDoc,
  IssueDoc, AccessoryDoc, DeviceJobDoc, PosSaleDoc, BalanceSaleDoc, DeviceTypeDoc,
} from './types';
import { defaultAdmin, defaultSettings, seedAccounts, seedIssues, seedDeviceTypes } from './seed';

let devAdded = false;
function registerPlugins() {
  if (devAdded) return;
  if (import.meta.env.DEV) addRxPlugin(RxDBDevModePlugin);
  addRxPlugin(RxDBUpdatePlugin);
  addRxPlugin(RxDBQueryBuilderPlugin);
  devAdded = true;
}

export type Collections = {
  users: RxCollection<UserDoc>;
  settings: RxCollection<SettingsDoc>;
  accounts: RxCollection<AccountDoc>;
  journal: RxCollection<JournalDoc>;
  sequences: RxCollection<SequenceDoc>;
  issues: RxCollection<IssueDoc>;
  accessories: RxCollection<AccessoryDoc>;
  deviceJobs: RxCollection<DeviceJobDoc>;
  posSales: RxCollection<PosSaleDoc>;
  balanceSales: RxCollection<BalanceSaleDoc>;
  deviceTypes: RxCollection<DeviceTypeDoc>;
};

export type ERPDatabase = RxDatabase<Collections>;

let dbPromise: Promise<ERPDatabase> | null = null;

const SEQUENCE_IDS = [
  'payment', 'receipt', 'cashReset', 'deviceIntake', 'deviceDelivery',
  'advanceRefund', 'creditProgramming', 'invoice', 'balance', 'customer', 'accessory',
];

async function buildDB(): Promise<ERPDatabase> {
  registerPlugins();
  const db = await createRxDatabase<Collections>({
    name: 'erp_offline_v1',
    storage: getRxStorageDexie(),
    multiInstance: true,
    eventReduce: true,
    ignoreDuplicate: true,
  });

  await db.addCollections({
    users: { schema: userSchema },
    settings: { schema: settingsSchema },
    accounts: { schema: accountSchema },
    journal: { schema: journalSchema },
    sequences: { schema: sequenceSchema },
    issues: { schema: issueSchema },
    accessories: { schema: accessorySchema },
    deviceJobs: { schema: deviceJobSchema },
    posSales: { schema: posSaleSchema },
    balanceSales: { schema: balanceSaleSchema },
    deviceTypes: { schema: deviceTypeSchema },
  });

  await runSeed(db);
  return db;
}

async function runSeed(db: ERPDatabase) {
  const now = new Date().toISOString();

  // Sequences
  const seqCount = await db.sequences.count().exec();
  if (seqCount === 0) {
    await db.sequences.bulkInsert(
      SEQUENCE_IDS.map((id) => ({ id, value: 0, updatedAt: now })),
    );
  }

  // Settings
  const settings = await db.settings.findOne('settings').exec();
  if (!settings) await db.settings.insert(defaultSettings(now));

  // Admin user
  const userCount = await db.users.count().exec();
  if (userCount === 0) await db.users.insert(await defaultAdmin(now));

  // Accounts
  const accCount = await db.accounts.count().exec();
  if (accCount === 0) await db.accounts.bulkInsert(seedAccounts(now));

  // Issues
  const issCount = await db.issues.count().exec();
  if (issCount === 0) await db.issues.bulkInsert(seedIssues(now));

  // Device types (master data)
  const dvtCount = await db.deviceTypes.count().exec();
  if (dvtCount === 0) await db.deviceTypes.bulkInsert(seedDeviceTypes(now));
}

export function getDB(): Promise<ERPDatabase> {
  if (!dbPromise) dbPromise = buildDB();
  return dbPromise;
}
