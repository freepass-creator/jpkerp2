'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { ref as rtdbRef, update, serverTimestamp } from 'firebase/database';
import { getRtdb } from '@/lib/firebase/rtdb';
import { OpFormBase } from '../op-form-base';
import { Field, TextInput, NumberInput, TextArea, PhoneInput, DateInput } from '@/components/form/field';
import { BtnGroup } from '@/components/form/btn-group';
import { useOpContext } from '../op-context-store';
import { deactivateProductByCarNumber } from '@/lib/firebase/freepass';
import { useAssetByCar, useContractByCar } from '@/lib/hooks/useLookups';

const KINDS = ['매각', '폐차', '반환', '전손', '기타'];
const REASONS = ['노후', '사고전손', '수익성', '계약만료반환', '고객요청', '기타'];

const KIND_MAP: Record<string, string> = {
  매각: 'sale',
  폐차: 'scrap',
  반환: 'return_lease',
  전손: 'total_loss',
  기타: 'other',
};

export function DisposalForm() {
  const [kind, setKind] = useState('매각');
  const [reason, setReason] = useState('노후');
  const [counterpartyPhone, setCounterpartyPhone] = useState('');

  const { carNumber } = useOpContext();
  const asset = useAssetByCar(carNumber);
  const activeContract = useContractByCar(carNumber, { activeOnly: true });

  const counterpartyLabel =
    kind === '매각' ? '인수자'
    : kind === '폐차' ? '폐차장'
    : kind === '반환' ? '리스/렌트사'
    : kind === '전손' ? '보험사'
    : '처분처';

  const amountLabel =
    kind === '매각' ? '매각 금액'
    : kind === '전손' ? '보험금 수령액'
    : kind === '반환' ? '잔존가 정산액'
    : '정산 금액';

  return (
    <OpFormBase
      eventType="disposal"
      uploaderLabel="처분 증빙 (매각계약서·폐차증명서·보험 정산서 등)"
      buildPayload={(d) => ({
        title: `${kind} · ${d.counterparty || '처분처 미입력'}`,
        disposal_kind: kind,
        disposal_kind_code: KIND_MAP[kind] ?? 'other',
        disposal_reason: reason,
        counterparty: d.counterparty,
        counterparty_phone: counterpartyPhone || undefined,
        disposal_amount: Number(String(d.disposal_amount ?? '').replace(/,/g, '')) || 0,
        settlement_date: d.settlement_date,
        memo: d.memo,
      })}
      afterSave={async () => {
        if (!carNumber) return;

        // 1. assets 레코드 비활성화 (히스토리 유지 — 삭제 아님)
        if (asset?._key) {
          try {
            await update(rtdbRef(getRtdb(), `assets/${asset._key}`), {
              status: 'disposed',
              asset_status: kind,
              disposal_kind: kind,
              disposal_reason: reason,
              disposed_at: serverTimestamp(),
              updated_at: serverTimestamp(),
            });
          } catch (err) {
            toast.error(`자산 상태 업데이트 실패: ${(err as Error).message}`);
          }
        }

        // 2. freepasserp3 상품 비활성화
        try {
          const ok = await deactivateProductByCarNumber(carNumber);
          if (ok) toast.info('freepass 상품 비활성화 완료');
        } catch (err) {
          toast.error(`freepass 비활성화 실패: ${(err as Error).message}`);
        }
      }}
    >
      <div className="form-section-title">
        <i className="ph ph-archive-box" />자산 처분 (생애 종료)
      </div>

      {activeContract && (
        <div
          style={{
            padding: 10,
            borderRadius: 2,
            background: 'var(--c-danger-bg, #fdf0ee)',
            color: 'var(--c-danger)',
            fontSize: 12,
            fontWeight: 500,
            marginBottom: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <i className="ph ph-warning-circle" />
          진행 중 계약이 있습니다 — {activeContract.contractor_name ?? '계약자 미상'} · {activeContract.contract_status ?? '계약진행'}.
          처분 전 계약 해지/완료 처리를 확인하세요.
        </div>
      )}

      <div className="form-grid">
        <Field label="처분 유형" required span={3}>
          <BtnGroup value={kind} onChange={setKind} options={KINDS} />
        </Field>
        <Field label="처분 사유" span={3}>
          <BtnGroup value={reason} onChange={setReason} options={REASONS} />
        </Field>

        <Field label={counterpartyLabel} span={2}>
          <TextInput name="counterparty" placeholder={`${counterpartyLabel} 상호/이름`} />
        </Field>
        <Field label="연락처">
          <PhoneInput value={counterpartyPhone} onChange={setCounterpartyPhone} />
        </Field>

        <Field label={amountLabel}>
          <NumberInput name="disposal_amount" placeholder="0" />
        </Field>
        <Field label="정산일">
          <DateInput name="settlement_date" />
        </Field>

        <Field label="메모" span={3}>
          <TextArea
            name="memo"
            rows={3}
            placeholder="처분 경위 · 특이사항 · 정산 조건"
          />
        </Field>
      </div>

      <div
        className="text-xs text-text-muted"
        style={{ padding: 12, background: 'var(--c-bg-sub)', borderRadius: 2, marginTop: 12 }}
      >
        💡 처분 등록 시 자산 상태가 <b>disposed</b>로 변경되고, freepasserp3 상품 목록에서 비활성화됩니다.
      </div>
    </OpFormBase>
  );
}
