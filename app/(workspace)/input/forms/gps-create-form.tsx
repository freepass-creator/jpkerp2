'use client';

import { useState } from 'react';
import { InputFormShell } from './input-form-shell';
import { Field, TextInput, DateInput, TextArea } from '@/components/form/field';
import { BtnGroup } from '@/components/form/btn-group';
import { EntityPicker } from '@/components/form/entity-picker';
import { CarNumberPicker } from '@/components/form/car-number-picker';
import { sanitizeCarNumber } from '@/lib/format-input';

const STATUS = ['장착', '해제', '고장', '점검중'];
const COMPANIES = ['지니', '마이크로닉스', 'KT링커스', 'SKT', '기타'];

interface PartnerRec extends Record<string, unknown> { _key?: string; partner_code?: string; partner_name?: string }

export function GpsCreateForm() {
  const [status, setStatus] = useState('장착');
  const [company, setCompany] = useState('지니');
  const [carNumber, setCarNumber] = useState('');
  const [partnerCode, setPartnerCode] = useState('');

  return (
    <InputFormShell
      collection="gps_devices"
      validate={(d) => {
        if (!carNumber) return '차량번호를 입력하세요';
        if (!d.gps_serial) return 'GPS 시리얼 번호를 입력하세요';
        return null;
      }}
      buildPayload={(d) => ({
        car_number: sanitizeCarNumber(carNumber),
        partner_code: partnerCode || undefined,
        gps_status: status,
        gps_company: company,
        gps_serial: d.gps_serial,
        gps_install_date: d.gps_install_date || undefined,
        gps_uninstall_date: d.gps_uninstall_date || undefined,
        gps_location: d.gps_location || undefined,
        gps_note: d.gps_note || undefined,
      })}
      onSaved={() => { setCarNumber(''); setPartnerCode(''); }}
    >
      <div className="form-section">
        <div className="form-section-title"><i className="ph ph-navigation-arrow" />GPS 장착 정보</div>
        <div className="form-grid">
          <Field label="차량번호" required>
            <CarNumberPicker
              value={carNumber}
              onChange={(v, asset) => {
                setCarNumber(v);
                if (asset?.partner_code && !partnerCode) setPartnerCode(asset.partner_code);
              }}
              required
              autoFocus
            />
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
            <BtnGroup value={status} onChange={setStatus} options={STATUS} />
          </Field>
          <Field label="제조사·서비스사" span={3}>
            <BtnGroup value={company} onChange={setCompany} options={COMPANIES} />
          </Field>
          <Field label="시리얼 번호" required span={2}>
            <TextInput name="gps_serial" required placeholder="단말기 SN" />
          </Field>
          <Field label="장착 위치">
            <TextInput name="gps_location" placeholder="OBD/대시보드 밑 등" />
          </Field>
          <Field label="장착일">
            <DateInput name="gps_install_date" />
          </Field>
          <Field label="해제일">
            <DateInput name="gps_uninstall_date" />
          </Field>
          <Field label="비고" span={3}>
            <TextArea name="gps_note" rows={3} placeholder="특이사항" />
          </Field>
        </div>
      </div>
    </InputFormShell>
  );
}
