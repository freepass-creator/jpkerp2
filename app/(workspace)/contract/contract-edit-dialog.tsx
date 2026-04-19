'use client';

import { useEffect, useState } from 'react';
import { EditDialog } from '@/components/shared/edit-dialog';
import { Field, TextInput, DateInput, NumberInput, PhoneInput, TextArea } from '@/components/form/field';
import { BtnGroup } from '@/components/form/btn-group';
import { CarNumberPicker } from '@/components/form/car-number-picker';
import { EntityPicker } from '@/components/form/entity-picker';

interface PartnerRec extends Record<string, unknown> { _key?: string; partner_code?: string; partner_name?: string }
interface CustomerRec extends Record<string, unknown> { _key?: string; name?: string; phone?: string; license_no?: string }
import { useRecordEdit } from '@/lib/hooks/useRecordEdit';
import type { RtdbContract } from '@/lib/types/rtdb-entities';

interface Props {
  record: RtdbContract | null;
  onClose: () => void;
}

const STATUS_OPTS = ['계약진행', '계약대기', '계약해지', '계약완료'];
const PRODUCT_OPTS = ['장기렌트', '단기렌트', '리스', '월렌트', '기타'];

export function ContractEditDialog({ record, onClose }: Props) {
  const { save, remove, saving, canDelete } = useRecordEdit<RtdbContract>('contracts');
  const [form, setForm] = useState<Partial<RtdbContract>>({});

  useEffect(() => {
    if (record) setForm({ ...record });
  }, [record]);

  if (!record) return null;
  const set = <K extends keyof RtdbContract>(k: K, v: RtdbContract[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  return (
    <EditDialog
      open={!!record}
      title={`계약 편집 — ${record.contract_code ?? record.contractor_name ?? '-'}`}
      subtitle={`차량: ${record.car_number ?? '-'}`}
      onClose={onClose}
      saving={saving}
      onSave={async () => {
        const ok = await save(record, form);
        if (ok) onClose();
      }}
      onDelete={canDelete ? async () => {
        const ok = await remove(record);
        if (ok) onClose();
      } : undefined}
      extraActions={
        record._key ? (
          <button
            type="button"
            className="btn btn-sm btn-outline"
            onClick={() => window.open(`/print/contract/${record._key}`, '_blank', 'width=880,height=1000')}
          >
            <i className="ph ph-printer" />계약서 인쇄
          </button>
        ) : null
      }
      width={680}
    >
      <div className="form-grid">
        <Field label="계약코드">
          <TextInput value={form.contract_code ?? ''} onChange={(e) => set('contract_code', e.target.value)} />
        </Field>
        <Field label="회원사">
          <EntityPicker<PartnerRec>
            collection="partners"
            value={form.partner_code ?? ''}
            onChange={(v) => set('partner_code', v.toUpperCase())}
            primaryField="partner_code"
            secondaryField="partner_name"
            searchFields={['partner_code', 'partner_name']}
            createHref="/input?type=partner"
            createLabel="새 회원사 등록"
          />
        </Field>
        <Field label="차량번호">
          <CarNumberPicker
            value={form.car_number ?? ''}
            onChange={(v, asset) => {
              set('car_number', v);
              if (asset?.partner_code && !form.partner_code) set('partner_code', asset.partner_code);
            }}
          />
        </Field>
        <Field label="계약자" required>
          <EntityPicker<CustomerRec>
            collection="customers"
            value={form.contractor_name ?? ''}
            onChange={(v, rec) => {
              set('contractor_name', v);
              if (rec?.phone && !form.contractor_phone) set('contractor_phone', rec.phone);
            }}
            primaryField="name"
            secondaryField="phone"
            tertiaryField="license_no"
            searchFields={['name', 'phone', 'license_no']}
            required
            createHref="/input?type=customer"
            createLabel="새 고객 등록"
          />
        </Field>
        <Field label="연락처" span={2}>
          <PhoneInput value={form.contractor_phone ?? ''} onChange={(v) => set('contractor_phone', v)} />
        </Field>
        <Field label="상태" span={3}>
          <BtnGroup
            value={form.contract_status ?? ''}
            onChange={(v) => set('contract_status', v)}
            options={STATUS_OPTS}
          />
        </Field>
        <Field label="상품" span={3}>
          <BtnGroup
            value={form.product_type ?? ''}
            onChange={(v) => set('product_type', v)}
            options={PRODUCT_OPTS}
          />
        </Field>
        <Field label="시작일">
          <DateInput value={form.start_date ?? ''} onChange={(e) => set('start_date', e.target.value)} />
        </Field>
        <Field label="종료일">
          <DateInput value={form.end_date ?? ''} onChange={(e) => set('end_date', e.target.value)} />
        </Field>
        <Field label="기간 (개월)">
          <NumberInput
            value={String(form.rent_months ?? '')}
            onChange={(e) => set('rent_months', Number(e.target.value.replace(/,/g, '')) || 0)}
          />
        </Field>
        <Field label="월 대여료">
          <NumberInput
            value={form.rent_amount ? Number(form.rent_amount).toLocaleString() : ''}
            onChange={(e) => set('rent_amount', Number(e.target.value.replace(/,/g, '')) || 0)}
          />
        </Field>
        <Field label="보증금">
          <NumberInput
            value={form.deposit_amount ? Number(form.deposit_amount).toLocaleString() : ''}
            onChange={(e) => set('deposit_amount', Number(e.target.value.replace(/,/g, '')) || 0)}
          />
        </Field>
        <Field label="결제일">
          <TextInput
            value={String(form.auto_debit_day ?? '')}
            onChange={(e) => set('auto_debit_day', e.target.value)}
            placeholder="예: 15"
          />
        </Field>
        <Field label="조치상태" span={2}>
          <TextInput
            value={form.action_status ?? ''}
            onChange={(e) => set('action_status', e.target.value)}
            placeholder="예: 시동제어"
          />
        </Field>
        <Field label="메모" span={3}>
          <TextArea
            value={form.note ?? ''}
            onChange={(e) => set('note', e.target.value)}
            rows={3}
          />
        </Field>
      </div>
    </EditDialog>
  );
}
