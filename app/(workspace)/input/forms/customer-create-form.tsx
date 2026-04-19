'use client';

import { useState } from 'react';
import { InputFormShell } from './input-form-shell';
import { Field, TextInput, DateInput, PhoneInput, TextArea } from '@/components/form/field';
import { BtnGroup } from '@/components/form/btn-group';
import { EntityPicker } from '@/components/form/entity-picker';

interface PartnerRec extends Record<string, unknown> { _key?: string; partner_code?: string; partner_name?: string }

export function CustomerCreateForm() {
  const [phone, setPhone] = useState('');
  const [gender, setGender] = useState('');
  const [status, setStatus] = useState('active');
  const [partnerCode, setPartnerCode] = useState('');

  return (
    <InputFormShell
      collection="customers"
      validate={(d) => (!d.name ? '이름을 입력하세요' : null)}
      buildPayload={(d) => ({
        name: d.name,
        phone: phone || undefined,
        birth: d.birth || undefined,
        gender: gender || undefined,
        email: d.email || undefined,
        address: d.address || undefined,
        license_no: d.license_no || undefined,
        license_expiry: d.license_expiry || undefined,
        partner_code: partnerCode || undefined,
        note: d.note || undefined,
        status,
      })}
      onSaved={() => { setPhone(''); setGender(''); setStatus('active'); setPartnerCode(''); }}
    >
      <div className="form-section">
        <div className="form-section-title"><i className="ph ph-user-circle-plus" />고객 기본정보</div>
        <div className="form-grid">
          <Field label="이름" required>
            <TextInput name="name" autoFocus required />
          </Field>
          <Field label="연락처">
            <PhoneInput value={phone} onChange={setPhone} />
          </Field>
          <Field label="생년월일">
            <DateInput name="birth" />
          </Field>
          <Field label="성별" span={3}>
            <BtnGroup value={gender} onChange={setGender} options={['남', '여', '법인']} />
          </Field>
          <Field label="이메일" span={3}>
            <TextInput name="email" type="email" autoComplete="off" />
          </Field>
          <Field label="주소" span={3}>
            <TextInput name="address" />
          </Field>
        </div>
      </div>

      <div className="form-section">
        <div className="form-section-title"><i className="ph ph-identification-badge" />면허 · 소속</div>
        <div className="form-grid">
          <Field label="면허번호">
            <TextInput name="license_no" />
          </Field>
          <Field label="면허 만기일">
            <DateInput name="license_expiry" />
          </Field>
          <Field label="회원사">
            <EntityPicker<PartnerRec>
              collection="partners"
              value={partnerCode}
              onChange={(v) => setPartnerCode(v.toUpperCase())}
              primaryField="partner_code"
              secondaryField="partner_name"
              searchFields={['partner_code', 'partner_name']}
              createHref="/input?type=partner"
              createLabel="새 회원사 등록"
            />
          </Field>
          <Field label="상태" span={3}>
            <BtnGroup value={status} onChange={setStatus} options={['active', 'inactive', 'blocked']} />
          </Field>
          <Field label="메모" span={3}>
            <TextArea name="note" rows={3} placeholder="특이사항" />
          </Field>
        </div>
      </div>
    </InputFormShell>
  );
}
