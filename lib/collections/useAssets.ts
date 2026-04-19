'use client';

import { useQuery } from '@tanstack/react-query';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  type QueryConstraint,
} from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { getDb } from '@/lib/firebase/client';
import { AssetSchema, type Asset, type LifecycleStage } from '@/lib/types/asset';

interface UseAssetsOptions {
  partner_code?: string;
  lifecycle_stage?: LifecycleStage;
  enabled?: boolean;
}

/**
 * 차량 컬렉션 구독 훅.
 * 실시간 반영 — onSnapshot + TanStack Query 캐시 조합.
 */
export function useAssets(opts: UseAssetsOptions = {}) {
  const { partner_code, lifecycle_stage, enabled = true } = opts;
  const [data, setData] = useState<Asset[]>([]);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!enabled) return;

    const constraints: QueryConstraint[] = [where('status', '==', 'active')];
    if (partner_code) constraints.push(where('partner_code', '==', partner_code));
    if (lifecycle_stage)
      constraints.push(where('lifecycle_stage', '==', lifecycle_stage));
    constraints.push(orderBy('updated_at', 'desc'));

    try {
      const q = query(collection(getDb(), 'assets'), ...constraints);
      const unsub = onSnapshot(
        q,
        (snap) => {
          const items: Asset[] = [];
          for (const doc of snap.docs) {
            const parsed = AssetSchema.safeParse({ ...doc.data(), asset_id: doc.id });
            if (parsed.success) items.push(parsed.data);
            else console.warn('Asset parse failed', doc.id, parsed.error);
          }
          setData(items);
          setLoading(false);
        },
        (err) => {
          setError(err);
          setLoading(false);
        },
      );
      return unsub;
    } catch (err) {
      setError(err as Error);
      setLoading(false);
    }
  }, [partner_code, lifecycle_stage, enabled]);

  return { data, loading, error };
}
