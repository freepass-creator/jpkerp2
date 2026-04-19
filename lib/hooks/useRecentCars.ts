'use client';

import { useCallback, useEffect, useState } from 'react';

const KEY = 'jpk.op.recent_cars';
const MAX = 5;

export function useRecentCars() {
  const [list, setList] = useState<string[]>([]);

  useEffect(() => {
    try {
      setList(JSON.parse(localStorage.getItem(KEY) ?? '[]'));
    } catch {
      setList([]);
    }
  }, []);

  const push = useCallback((car: string) => {
    if (!car) return;
    setList((cur) => {
      const next = [car, ...cur.filter((c) => c !== car)].slice(0, MAX);
      try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  return { list, push };
}
