'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ref, get } from 'firebase/database';
import { getRtdb } from '@/lib/firebase/rtdb';
import type { RtdbContract, RtdbAsset } from '@/lib/types/rtdb-entities';
import { fmt, fmtDate } from '@/lib/utils';
import { computeContractEnd, normalizeDate } from '@/lib/date-utils';

async function fetchContractWithAsset(key: string): Promise<{ contract: RtdbContract | null; asset: RtdbAsset | null }> {
  const snap = await get(ref(getRtdb(), `contracts/${key}`));
  if (!snap.exists()) return { contract: null, asset: null };
  const contract = snap.val() as RtdbContract;
  if (!contract.car_number) return { contract, asset: null };
  const allAssets = await get(ref(getRtdb(), 'assets'));
  const aMap = allAssets.val() as Record<string, RtdbAsset> | null;
  const asset = aMap ? Object.values(aMap).find((x) => x.car_number === contract.car_number) ?? null : null;
  return { contract, asset };
}

export default function ContractPrintPage() {
  const params = useParams<{ key: string }>();
  const key = params.key;
  const { data, isLoading } = useQuery({
    queryKey: ['print-contract', key],
    queryFn: () => fetchContractWithAsset(key),
    enabled: !!key,
  });
  const contract = data?.contract ?? null;
  const asset = data?.asset ?? null;

  if (isLoading) return <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>불러오는 중...</div>;
  if (!contract) return <div style={{ padding: 40, textAlign: 'center', color: '#c00' }}>계약을 찾을 수 없습니다</div>;

  const end = computeContractEnd(contract);

  return (
    <div>
      {/* 툴바 (인쇄 시 숨김) */}
      <div className="print-toolbar">
        <button type="button" className="btn btn-outline btn-sm" onClick={() => window.close()}>
          <i className="ph ph-x" />닫기
        </button>
        <span className="spacer" />
        <button type="button" className="btn btn-primary btn-sm" onClick={() => window.print()}>
          <i className="ph ph-printer" />인쇄
        </button>
      </div>

      <div className="print-doc-title">자동차 대여 계약서</div>
      <div className="print-doc-subtitle">
        계약코드: {contract.contract_code ?? '-'} · 발행일: {new Date().toISOString().slice(0, 10)}
      </div>

      <div className="print-section-title">계약 당사자</div>
      <table className="print-kv">
        <tbody>
          <tr><th>임대인 (회원사)</th><td>{contract.partner_code ?? '-'}</td></tr>
          <tr><th>임차인 (계약자)</th><td>{contract.contractor_name ?? '-'}</td></tr>
          <tr><th>임차인 연락처</th><td>{contract.contractor_phone ?? '-'}</td></tr>
        </tbody>
      </table>

      <div className="print-section-title">대여 차량</div>
      <table className="print-kv">
        <tbody>
          <tr><th>차량번호</th><td>{contract.car_number ?? '-'}</td></tr>
          <tr><th>제조사 · 모델</th><td>{asset ? `${asset.manufacturer ?? ''} ${asset.car_model ?? ''} ${asset.car_year ?? ''}` : '-'}</td></tr>
          <tr><th>세부모델</th><td>{asset?.detail_model ?? '-'}</td></tr>
          <tr><th>차대번호 (VIN)</th><td>{asset?.vin ?? '-'}</td></tr>
          <tr><th>연료 · 색상</th><td>{[asset?.fuel_type, asset?.ext_color].filter(Boolean).join(' · ') || '-'}</td></tr>
        </tbody>
      </table>

      <div className="print-section-title">계약 조건</div>
      <table className="print-kv">
        <tbody>
          <tr><th>상품 구분</th><td>{contract.product_type ?? '-'}</td></tr>
          <tr><th>계약 기간</th><td>{fmtDate(normalizeDate(contract.start_date))} ~ {fmtDate(end)} ({contract.rent_months ?? '-'}개월)</td></tr>
          <tr><th>월 대여료</th><td>{contract.rent_amount ? `${fmt(Number(contract.rent_amount))}원` : '-'}</td></tr>
          <tr><th>보증금</th><td>{contract.deposit_amount ? `${fmt(Number(contract.deposit_amount))}원` : '-'}</td></tr>
          <tr><th>결제일</th><td>{contract.auto_debit_day ? `매월 ${contract.auto_debit_day}일` : '-'}</td></tr>
          <tr><th>계약 상태</th><td>{contract.contract_status ?? '-'}</td></tr>
        </tbody>
      </table>

      <div className="print-section-title">특약사항</div>
      <div
        style={{
          border: '1px solid var(--c-border)',
          padding: '12px 14px',
          minHeight: 80,
          fontSize: 12,
          whiteSpace: 'pre-wrap',
        }}
      >
        {contract.note ?? ''}
      </div>

      {/* 서명 영역 */}
      <div className="print-sign-area">
        <div className="print-sign-box">
          <div className="print-sign-label">임대인 서명 · 인</div>
        </div>
        <div className="print-sign-box">
          <div className="print-sign-label">임차인 서명 · 인</div>
        </div>
      </div>

      <div style={{ marginTop: 24, textAlign: 'center', fontSize: 11, color: '#888' }}>
        본 계약서는 자동차 대여 계약의 증빙으로서 양 당사자가 서명·날인하여 2부 작성 후 각 1부씩 보관합니다.
      </div>
    </div>
  );
}
