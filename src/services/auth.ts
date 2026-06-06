import type { ERPDatabase } from '../db';
import type {
  OperationPermission, PermissionMap, ScreenKey, ScreenPermission, UserDoc,
} from '../db/types';
import { verifyPassword } from '../lib/crypto';

const SESSION_KEY = 'erp_session_user';

export function emptyPermissions(): PermissionMap {
  return { screens: {}, operations: {} };
}

export async function login(
  db: ERPDatabase, username: string, password: string,
): Promise<UserDoc> {
  const doc = await db.users.findOne({ selector: { username: username.trim() } }).exec();
  if (!doc) throw new Error('اسم المستخدم أو كلمة المرور غير صحيحة');
  const user = doc.toJSON() as UserDoc;
  if (!user.active) throw new Error('هذا الحساب موقوف، يرجى مراجعة المدير');
  const ok = await verifyPassword(password, user.password);
  if (!ok) throw new Error('اسم المستخدم أو كلمة المرور غير صحيحة');
  localStorage.setItem(SESSION_KEY, user.id);
  return user;
}

export function logout() {
  localStorage.removeItem(SESSION_KEY);
}

export async function loadSessionUser(db: ERPDatabase): Promise<UserDoc | null> {
  const id = localStorage.getItem(SESSION_KEY);
  if (!id) return null;
  const doc = await db.users.findOne(id).exec();
  if (!doc) { logout(); return null; }
  const user = doc.toJSON() as UserDoc;
  if (!user.active) { logout(); return null; }
  return user;
}

export function canScreen(user: UserDoc | null, screen: ScreenKey, perm: ScreenPermission): boolean {
  if (!user) return false;
  if (user.role === 'admin') return true;
  return !!user.permissions?.screens?.[screen]?.[perm];
}

export function canViewScreen(user: UserDoc | null, screen: ScreenKey): boolean {
  return canScreen(user, screen, 'view');
}

export function canAddScreen(user: UserDoc | null, screen?: ScreenKey): boolean {
  if (!user) return false;
  if (user.role === 'admin') return true;
  if (!screen) return false;
  return canScreen(user, screen, 'add');
}

export function canEditScreen(user: UserDoc | null, screen?: ScreenKey): boolean {
  if (!user) return false;
  if (user.role === 'admin') return true;
  if (!screen) return false;
  return canScreen(user, screen, 'edit');
}

export function canDeleteScreen(user: UserDoc | null, screen?: ScreenKey): boolean {
  if (!user) return false;
  if (user.role === 'admin') return true;
  if (!screen) return false;
  return canScreen(user, screen, 'delete');
}

export function canOp(user: UserDoc | null, op: OperationPermission): boolean {
  if (!user) return false;
  if (user.role === 'admin') return true;
  return !!user.permissions?.operations?.[op];
}
