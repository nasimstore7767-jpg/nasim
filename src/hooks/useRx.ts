import { useEffect, useState } from 'react';
import type { RxQuery } from 'rxdb';

// Subscribe to a RxDB query and return reactive results as plain JSON objects.
export function useRxQuery<T>(
  factory: () => RxQuery<any, any> | null | undefined,
  deps: any[] = [],
): { data: T[]; loading: boolean } {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let sub: { unsubscribe: () => void } | null = null;
    let active = true;
    const q = factory();
    if (!q) { setLoading(false); return; }
    sub = q.$.subscribe((docs: any) => {
      if (!active) return;
      const arr = Array.isArray(docs) ? docs : [docs];
      setData(arr.filter(Boolean).map((d: any) => (d.toJSON ? d.toJSON() : d)) as T[]);
      setLoading(false);
    });
    return () => { active = false; sub?.unsubscribe(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, loading };
}

// Run an async computation, recompute when deps change.
export function useAsync<T>(
  fn: () => Promise<T>,
  deps: any[] = [],
  initial?: T,
): { value: T | undefined; loading: boolean; reload: () => void } {
  const [value, setValue] = useState<T | undefined>(initial);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fn().then((v) => { if (active) { setValue(v); setLoading(false); } })
      .catch(() => { if (active) setLoading(false); });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  return { value, loading, reload: () => setTick((t) => t + 1) };
}
