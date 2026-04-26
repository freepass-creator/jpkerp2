'use client';

import { EntityPicker } from '@/components/form/entity-picker';
import { DateInput, Field, NumberInput, TextArea, TextInput } from '@/components/form/field';
import { useRtdbCollection } from '@/lib/collections/rtdb';
import { downloadContractPdf } from '@/lib/contract-pdf';
import { isActiveContractStatus } from '@/lib/data/contract-status';
import { shortDate } from '@/lib/date-utils';
import { deriveBillingsFromContract } from '@/lib/derive/billings';
import { getRtdb } from '@/lib/firebase/rtdb';
import type { RtdbAsset, RtdbContract } from '@/lib/types/rtdb-entities';
import { ref as rtdbRef, serverTimestamp, update } from 'firebase/database';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { InputFormShell } from './input-form-shell';

function genContractCode(base?: string): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  const ts = `${String(d.getFullYear()).slice(2)}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
  return base ? `${base}-EXT-${ts}` : `CN-${ts}-EXT`;
}

function dayBefore(ymd: string): string {
  if (!ymd) return '';
  const d = new Date(ymd);
  d.setDate(d.getDate() - 1);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function ContractExtensionForm() {
  const params = useSearchParams();
  const contractParam = params.get('contract') ?? '';
  const [baseCode, setBaseCode] = useState(contractParam);
  const contracts = useRtdbCollection<RtdbContract>('contracts');
  const assets = useRtdbCollection<RtdbAsset>('assets');

  // ?contract= 변경 시 prefill (대시보드/만기도래 탭에서 진입)
  // baseCode 변경은 사용자 액션 — params만 추적
  // biome-ignore lint/correctness/useExhaustiveDependencies: contractParam 변경만 추적
  useEffect(() => {
    if (contractParam && contractParam !== baseCode) setBaseCode(contractParam);
  }, [contractParam]);

  const baseContract = useMemo(
    () => contracts.data.find((c) => c.contract_code === baseCode) ?? null,
    [contracts.data, baseCode],
  );

  const newCode = useMemo(() => genContractCode(baseCode), [baseCode]);
  const defaultStart = baseContract?.end_date ? '' : '';
  // 기존 end_date 다음날을 힌트로 (입력 필드는 빈값 시작 — 사용자가 직접 채움)
  const suggestStart = baseContract?.end_date
    ? (() => {
        const d = new Date(baseContract.end_date);
        d.setDate(d.getDate() + 1);
        const p = (n: number) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
      })()
    : '';

  return (
    <InputFormShell
      collection="contracts"
      validate={() => {
        if (!baseContract) return '연장할 원본 계약을 선택하세요';
        if (!baseContract._key) return '원본 계약 키 오류';
        return null;
      }}
      buildPayload={(d) => ({
        contract_code: d.contract_code || newCode,
        contractor_name: baseContract?.contractor_name,
        contractor_phone: baseContract?.contractor_phone || undefined,
        car_number: baseContract?.car_number,
        partner_code: baseContract?.partner_code || undefined,
        product_type: baseContract?.product_type || undefined,
        contract_status: '계약진행',
        is_extension: true,
        original_contract_id: baseContract?._key,
        start_date: d.start_date || suggestStart || undefined,
        rent_months: d.rent_months ? Number(d.rent_months) : undefined,
        rent_amount: d.rent_amount
          ? Number(String(d.rent_amount).replace(/,/g, ''))
          : baseContract?.rent_amount,
        auto_debit_day: d.auto_debit_day || baseContract?.auto_debit_day || undefined,
        note: d.note || undefined,
      })}
      afterSave={async (key, payload) => {
        // 1. 새 계약 billings 자동 생성
        try {
          const contract = { ...payload, _key: key } as RtdbContract;
          const r = await deriveBillingsFromContract(contract);
          if (r.created > 0) toast.success(`연장 수납스케줄 ${r.created}회차 생성`);
          else if (r.reason) toast.info(`수납스케줄 생략: ${r.reason}`);
        } catch (err) {
          toast.error(`수납스케줄 생성 실패: ${(err as Error).message}`);
        }

        // 2. 원본 계약 '계약완료' 처리 — end_date는 연장 start_date 전일
        if (baseContract?._key) {
          const extStart = (payload.start_date as string | undefined) || suggestStart;
          const closeEnd = extStart ? dayBefore(extStart) : baseContract.end_date;
          try {
            await update(rtdbRef(getRtdb(), `contracts/${baseContract._key}`), {
              contract_status: '계약완료',
              end_date: closeEnd,
              extended_to_contract_id: key,
              updated_at: serverTimestamp(),
            });
            toast.info('원본 계약 → 계약완료');
          } catch (err) {
            toast.error(`원본 계약 종료 실패: ${(err as Error).message}`);
          }
        }

        // 3. 연장 계약서 PDF 다운로드 안내
        const car = String(payload.car_number ?? '');
        const asset = car ? assets.data.find((a) => a.car_number === car) : undefined;
        toast.success('연장 계약 등록 완료', {
          description: '연장 계약서 PDF를 다운로드할까요?',
          action: {
            label: '연장 계약서 PDF',
            onClick: () => {
              downloadContractPdf({
                contract_code: payload.contract_code as string | undefined,
                contractor_name: payload.contractor_name as string | undefined,
                contractor_phone: payload.contractor_phone as string | undefined,
                car_number: car,
                manufacturer: asset?.manufacturer,
                car_model: asset?.car_model,
                detail_model: asset?.detail_model,
                vin: asset?.vin,
                car_year: asset?.car_year,
                start_date: payload.start_date as string | undefined,
                end_date: payload.end_date as string | undefined,
                rent_months: payload.rent_months as number | undefined,
                rent_amount: payload.rent_amount as number | undefined,
                auto_debit_day: payload.auto_debit_day as string | number | undefined,
                product_type: payload.product_type as string | undefined,
                is_extension: true,
                note: payload.note as string | undefined,
              });
            },
          },
          duration: 8000,
        });
      }}
      onSaved={() => setBaseCode('')}
    >
      <div className="form-section">
        <div className="form-section-title">
          <i className="ph ph-arrow-clockwise" />
          원본 계약 선택
          <span className="text-text-muted text-2xs" style={{ fontWeight: 400, marginLeft: 8 }}>
            · 진행 중인 계약만 선택 가능
          </span>
        </div>
        <div className="form-grid">
          <Field label="계약코드" required span={3}>
            <EntityPicker<RtdbContract & { _key?: string }>
              collection="contracts"
              value={baseCode}
              onChange={(v) => setBaseCode(v)}
              primaryField="contract_code"
              secondaryField="contractor_name"
              tertiaryField="car_number"
              searchFields={['contract_code', 'contractor_name', 'car_number']}
              placeholder="계약코드·계약자·차량번호 검색"
              filter={(c) => isActiveContractStatus(c.contract_status)}
              required
              autoFocus
            />
          </Field>
        </div>

        {baseContract && (
          <div
            className="text-base"
            style={{
              marginTop: 10,
              padding: 10,
              borderRadius: 2,
              background: 'var(--c-bg-sub)',
              border: '1px solid var(--c-border)',
              lineHeight: 1.6,
            }}
          >
            <div>
              <b>{baseContract.contractor_name ?? '—'}</b>
              <span className="text-text-muted" style={{ marginLeft: 6 }}>
                · {baseContract.car_number ?? '—'} · {baseContract.product_type ?? '—'}
              </span>
            </div>
            <div className="text-text-sub" style={{ marginTop: 2 }}>
              기존 기간: {shortDate(baseContract.start_date)} ~ {shortDate(baseContract.end_date)}
              {baseContract.rent_months ? ` · ${baseContract.rent_months}개월` : ''}
              {baseContract.rent_amount
                ? ` · 월 ${baseContract.rent_amount.toLocaleString()}원`
                : ''}
              {baseContract.auto_debit_day ? ` · 매월 ${baseContract.auto_debit_day}일` : ''}
            </div>
            {suggestStart && (
              <div className="text-primary text-xs" style={{ marginTop: 4 }}>
                연장 시작 제안: {suggestStart} (기존 종료일 +1)
              </div>
            )}
          </div>
        )}
      </div>

      <div className="form-section">
        <div className="form-section-title">
          <i className="ph ph-calendar-plus" />
          연장 조건
        </div>
        <div className="form-grid">
          <Field label="연장 계약코드">
            <TextInput name="contract_code" defaultValue={newCode} placeholder={newCode} />
          </Field>
          <Field label="연장 시작일" required>
            <DateInput name="start_date" defaultValue={suggestStart} />
          </Field>
          <Field label="연장 개월수" required>
            <NumberInput name="rent_months" placeholder={String(baseContract?.rent_months ?? 12)} />
          </Field>
          <Field label="월 대여료">
            <NumberInput name="rent_amount" placeholder={String(baseContract?.rent_amount ?? 0)} />
          </Field>
          <Field label="결제일">
            <TextInput
              name="auto_debit_day"
              defaultValue={baseContract?.auto_debit_day ? String(baseContract.auto_debit_day) : ''}
              placeholder="예: 25"
            />
          </Field>
          <Field label="메모" span={3}>
            <TextArea name="note" rows={2} placeholder="연장 사유·변경사항" />
          </Field>
        </div>
      </div>

      <div
        className="text-xs text-text-muted"
        style={{ padding: 12, background: 'var(--c-bg-sub)', borderRadius: 2, marginTop: 12 }}
      >
        💡 연장 등록 시: 새 계약(<b>is_extension</b>)으로 저장 + 수납스케줄 자동 생성, 원본 계약은{' '}
        <b>계약완료</b>로 전환됩니다.
      </div>
    </InputFormShell>
  );
}
