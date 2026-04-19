/**
 * RTDB 공용 lookup hooks.
 * assets.data.find((a) => a.car_number === X) 같은 반복 패턴 추출.
 *
 * 전 컬렉션에서 `status === 'deleted'` 는 기본 제외.
 */
import { useMemo } from 'react';
import { useRtdbCollection } from '@/lib/collections/rtdb';
import { isActiveContractStatus } from '@/lib/data/contract-status';
import type { RtdbAsset, RtdbContract } from '@/lib/types/rtdb-entities';

/** 차량번호로 단일 자산 조회. deleted 자동 제외. */
export function useAssetByCar(carNumber: string | null | undefined): RtdbAsset | null {
  const { data } = useRtdbCollection<RtdbAsset>('assets');
  return useMemo(() => {
    if (!carNumber) return null;
    return data.find((a) => a.car_number === carNumber && a.status !== 'deleted') ?? null;
  }, [data, carNumber]);
}

export interface ContractLookupOptions {
  /** 활성 계약만 (계약완료/해지 제외). 기본 false. */
  activeOnly?: boolean;
  /** 계약자 이름 있는 계약만. 기본 false. */
  requireContractor?: boolean;
}

/** 차량번호로 단일 계약 조회. deleted 자동 제외. */
export function useContractByCar(
  carNumber: string | null | undefined,
  opts: ContractLookupOptions = {},
): RtdbContract | null {
  const { data } = useRtdbCollection<RtdbContract>('contracts');
  const { activeOnly = false, requireContractor = false } = opts;
  return useMemo(() => {
    if (!carNumber) return null;
    return (
      data.find(
        (c) =>
          c.car_number === carNumber &&
          c.status !== 'deleted' &&
          (!activeOnly || isActiveContractStatus(c.contract_status)) &&
          (!requireContractor || !!c.contractor_name?.trim()),
      ) ?? null
    );
  }, [data, carNumber, activeOnly, requireContractor]);
}

/** 계약코드로 단일 계약 조회. deleted 자동 제외. */
export function useContractByCode(contractCode: string | null | undefined): RtdbContract | null {
  const { data } = useRtdbCollection<RtdbContract>('contracts');
  return useMemo(() => {
    if (!contractCode) return null;
    return data.find((c) => c.contract_code === contractCode && c.status !== 'deleted') ?? null;
  }, [data, contractCode]);
}
