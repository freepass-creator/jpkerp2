'use client';

import { ref, onValue, off, update, serverTimestamp } from 'firebase/database';
import { useEffect, useState } from 'react';
import { getRtdb } from '@/lib/firebase/rtdb';

interface RtdbAsset {
  _key: string;
  car_number?: string;
  vin?: string;
  manufacturer?: string;
  car_model?: string;
  detail_model?: string;
  trim?: string;
  car_year?: number | string;
  fuel_type?: string;
  ext_color?: string;
  int_color?: string;
  partner_code?: string;
  current_mileage?: number | string;
  last_maint_date?: string;
  first_registration_date?: string;
  acquisition_cost?: number | string;
  status?: string;
}

/**
 * 차량번호로 자산 1건 실시간 구독.
 * RTDB `/assets/{auto-key}` 구조에서 car_number가 일치하는 것 찾음.
 */
export function useAssetByCarNumber(carNumber: string | undefined) {
  const [asset, setAsset] = useState<RtdbAsset | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!carNumber) return;
    const r = ref(getRtdb(), 'assets');
    const handler = onValue(
      r,
      (snap) => {
        const val = snap.val() || {};
        const entries = Object.entries(val) as [string, RtdbAsset][];
        const found = entries.find(
          ([, v]) =>
            String(v.car_number).trim() === carNumber &&
            v.status !== 'deleted',
        );
        if (found) {
          setAsset({ ...found[1], _key: found[0] });
        } else {
          setAsset(null);
        }
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      },
    );
    return () => off(r, 'value', handler);
  }, [carNumber]);

  return { asset, loading, error };
}

/** 자산 필드 1개 즉시 업데이트 (인라인 편집용) */
export async function updateAssetField(
  assetKey: string,
  field: string,
  value: unknown,
) {
  await update(ref(getRtdb(), `assets/${assetKey}`), {
    [field]: value,
    updated_at: serverTimestamp(),
  });
}
