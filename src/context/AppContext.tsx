import {
  createContext, useContext, useEffect, useState, type ReactNode,
} from 'react';
import { getDB, type ERPDatabase } from '../db';
import type { SettingsDoc, UserDoc } from '../db/types';
import { loadSessionUser, login as doLogin, logout as doLogout } from '../services/auth';

interface AppCtx {
  db: ERPDatabase | null;
  ready: boolean;
  user: UserDoc | null;
  settings: SettingsDoc | null;
  login: (u: string, p: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  refreshSettings: () => Promise<void>;
}

const Ctx = createContext<AppCtx>(null as any);

export function AppProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<ERPDatabase | null>(null);
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<UserDoc | null>(null);
  const [settings, setSettings] = useState<SettingsDoc | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const database = await getDB();
      if (!active) return;
      setDb(database);
      const sessionUser = await loadSessionUser(database);
      const s = await database.settings.findOne('settings').exec();
      if (!active) return;
      setUser(sessionUser);
      setSettings(s ? (s.toJSON() as SettingsDoc) : null);

      // Live settings subscription
      const sub = database.settings.findOne('settings').$.subscribe((doc: any) => {
        if (active && doc) setSettings(doc.toJSON() as SettingsDoc);
      });
      setReady(true);
      return () => sub.unsubscribe();
    })();
    return () => { active = false; };
  }, []);

  const login = async (u: string, p: string) => {
    if (!db) throw new Error('قاعدة البيانات غير جاهزة');
    const usr = await doLogin(db, u, p);
    setUser(usr);
  };

  const logout = () => { doLogout(); setUser(null); };

  const refreshUser = async () => {
    if (!db) return;
    const usr = await loadSessionUser(db);
    setUser(usr);
  };

  const refreshSettings = async () => {
    if (!db) return;
    const s = await db.settings.findOne('settings').exec();
    setSettings(s ? (s.toJSON() as SettingsDoc) : null);
  };

  return (
    <Ctx.Provider value={{ db, ready, user, settings, login, logout, refreshUser, refreshSettings }}>
      {children}
    </Ctx.Provider>
  );
}

export function useApp() { return useContext(Ctx); }
