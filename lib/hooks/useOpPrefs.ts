'use client';

import { useCallback, useEffect, useState } from 'react';

const LOC_KEY = 'jpk.op.locations';
const FAV_KEY = 'jpk.op.favorites';
const TITLE_KEY = 'jpk.op.titles';
const INS_KEY = 'jpk.op.insurance_co';
const LAST_FROM_KEY = 'jpk.op.last_from';

const DEFAULT_INS_CO = [
  '삼성화재', '현대해상', 'DB손해보험', 'KB손해보험', '메리츠화재',
  '한화손해보험', '롯데손해보험', '흥국화재', 'MG손해보험', 'AXA손해보험',
  '캐롯손해보험', '하나손해보험',
];

function read<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T) {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

/** 자주 쓰는 장소 (최대 20개, LRU) */
export function useLocations() {
  const [list, setList] = useState<string[]>([]);
  useEffect(() => setList(read(LOC_KEY, [])), []);
  const add = useCallback((place: string) => {
    if (!place?.trim()) return;
    const cleaned = place.trim();
    setList((cur) => {
      const next = [cleaned, ...cur.filter((p) => p !== cleaned)].slice(0, 20);
      write(LOC_KEY, next);
      return next;
    });
  }, []);
  const remove = useCallback((place: string) => {
    setList((cur) => {
      const next = cur.filter((p) => p !== place);
      write(LOC_KEY, next);
      return next;
    });
  }, []);
  return { list, add, remove };
}

/** 즐겨찾기 장소 (별 토글, 최대 10개) */
export function useFavorites() {
  const [list, setList] = useState<string[]>([]);
  useEffect(() => setList(read(FAV_KEY, [])), []);
  const toggle = useCallback((place: string) => {
    if (!place?.trim()) return;
    const cleaned = place.trim();
    setList((cur) => {
      const isFav = cur.includes(cleaned);
      const next = isFav ? cur.filter((p) => p !== cleaned) : [cleaned, ...cur].slice(0, 10);
      write(FAV_KEY, next);
      return next;
    });
  }, []);
  const isFav = useCallback((place: string) => list.includes(place), [list]);
  return { list, toggle, isFav };
}

/** 유형별 자주 쓰는 제목 (type별 최대 10개) */
export function useTitles(type: string) {
  const [list, setList] = useState<string[]>([]);
  useEffect(() => {
    const all = read<Record<string, string[]>>(TITLE_KEY, {});
    setList(all[type] ?? []);
  }, [type]);
  const add = useCallback((title: string) => {
    if (!title?.trim()) return;
    const cleaned = title.trim();
    const all = read<Record<string, string[]>>(TITLE_KEY, {});
    const next = [cleaned, ...(all[type] ?? []).filter((t) => t !== cleaned)].slice(0, 10);
    all[type] = next;
    write(TITLE_KEY, all);
    setList(next);
  }, [type]);
  return { list, add };
}

/** 보험사 — 사용자 저장 + 기본 목록 병합 */
export function useInsuranceCompanies() {
  const [list, setList] = useState<string[]>(DEFAULT_INS_CO);
  useEffect(() => {
    const saved = read<string[]>(INS_KEY, []);
    const merged = [...saved, ...DEFAULT_INS_CO.filter((x) => !saved.includes(x))];
    setList(merged);
  }, []);
  const use = useCallback((name: string) => {
    if (!name?.trim()) return;
    const cleaned = name.trim();
    const saved = read<string[]>(INS_KEY, []);
    const next = [cleaned, ...saved.filter((x) => x !== cleaned)].slice(0, 20);
    write(INS_KEY, next);
    setList([...next, ...DEFAULT_INS_CO.filter((x) => !next.includes(x))]);
  }, []);
  const remove = useCallback((name: string) => {
    const saved = read<string[]>(INS_KEY, []).filter((x) => x !== name);
    write(INS_KEY, saved);
    setList([...saved, ...DEFAULT_INS_CO.filter((x) => !saved.includes(x))]);
  }, []);
  return { list, use, remove };
}

/** 항목 즐겨찾기 — 정비/상품화 등 ItemTable용 (key별 localStorage) */
const ITEM_FAV_KEY = 'jpk.op.item_favs';
export function useItemFavs(key: string) {
  const [list, setList] = useState<string[]>([]);
  useEffect(() => {
    const all = read<Record<string, string[]>>(ITEM_FAV_KEY, {});
    setList(all[key] ?? []);
  }, [key]);
  const add = useCallback((name: string) => {
    if (!name?.trim()) return;
    const cleaned = name.trim();
    const all = read<Record<string, string[]>>(ITEM_FAV_KEY, {});
    const cur = all[key] ?? [];
    if (cur.includes(cleaned)) return;
    const next = [cleaned, ...cur].slice(0, 20);
    all[key] = next;
    write(ITEM_FAV_KEY, all);
    setList(next);
  }, [key]);
  const remove = useCallback((name: string) => {
    const all = read<Record<string, string[]>>(ITEM_FAV_KEY, {});
    const next = (all[key] ?? []).filter((x) => x !== name);
    all[key] = next;
    write(ITEM_FAV_KEY, all);
    setList(next);
  }, [key]);
  return { list, add, remove };
}

/** 마지막 출발지 기억 (입출고) */
export function useLastFrom(): [string, (v: string) => void] {
  const [value, setValue] = useState('');
  useEffect(() => {
    if (typeof window === 'undefined') return;
    setValue(localStorage.getItem(LAST_FROM_KEY) ?? '');
  }, []);
  const save = useCallback((v: string) => {
    setValue(v);
    try { localStorage.setItem(LAST_FROM_KEY, v); } catch {}
  }, []);
  return [value, save];
}
