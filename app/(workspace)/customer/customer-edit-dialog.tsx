'use client';

import { useEffect, useState } from 'react';
import { EditDialog } from '@/components/shared/edit-dialog';
import { Field, TextInput, DateInput, PhoneInput, TextArea } from '@/components/form/field';
import { BtnGroup } from '@/components/form/btn-group';
import { EntityPicker } from '@/components/form/entity-picker';
import { useRecordEdit } from '@/lib/hooks/useRecordEdit';
import { CustomerDocuments } from './customer-documents';

interface PartnerRec extends Record<string, unknown> { _key?: string; partner_code?: string; partner_name?: string }
import type { RtdbCustomer } from './customer-client';

interface Props {
  record: RtdbCustomer | null;
  onClose: () => void;
}

export function CustomerEditDialog({ record, onClose }: Props) {
  const { save, remove, saving, canDelete } = useRecordEdit<RtdbCustomer>('customers');
  const [form, setForm] = useState<Partial<RtdbCustomer>>({});

  useEffect(() => {
    if (record) setForm({ ...record });
  }, [record]);

  if (!record) return null;
  const set = <K extends keyof RtdbCustomer>(k: K, v: RtdbCustomer[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  return (
    <EditDialog
      open={!!record}
      title={`고객 편집 — ${record.name ?? '-'}`}
      subtitle={`ID: ${record.customer_id ?? record._key}`}
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
      width={600}
    >
      <div className="form-grid">
        <Field label="이름" required>
          <TextInput value={form.name ?? ''} onChange={(e) => set('name', e.target.value)} required />
        </Field>
        <Field label="연락처">
          <PhoneInput value={form.phone ?? ''} onChange={(v) => set('phone', v)} />
        </Field>
        <Field label="생년월일">
          <DateInput value={form.birth ?? ''} onChange={(e) => set('birth', e.target.value)} />
        </Field>
        <Field label="성별" span={3}>
          <BtnGroup
            value={form.gender ?? ''}
            onChange={(v) => set('gender', v)}
            options={['남', '여', '법인']}
          />
        </Field>
        <Field label="이메일" span={3}>
          <TextInput
            type="email"
            value={form.email ?? ''}
            onChange={(e) => set('email', e.target.value)}
            autoComplete="off"
          />
        </Field>
        <Field label="주소" span={3}>
          <TextInput value={form.address ?? ''} onChange={(e) => set('address', e.target.value)} />
        </Field>
        <Field label="면허번호">
          <TextInput value={form.license_no ?? ''} onChange={(e) => set('license_no', e.target.value)} />
        </Field>
        <Field label="면허만기일">
          <DateInput
            value={form.license_expiry ?? ''}
            onChange={(e) => set('license_expiry', e.target.value)}
          />
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
        <Field label="상태" span={3}>
          <BtnGroup
            value={form.status ?? ''}
            onChange={(v) => set('status', v)}
            options={['active', 'inactive', 'blocked']}
          />
        </Field>
        <Field label="메모" span={3}>
          <TextArea
            value={form.note ?? ''}
            onChange={(e) => set('note', e.target.value)}
            rows={3}
            placeholder="특이사항"
          />
        </Field>
      </div>

      <CustomerDocuments customer={record} />
    </EditDialog>
  );
}
