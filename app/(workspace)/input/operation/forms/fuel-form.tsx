'use client';

import { useState } from 'react';
import { OpFormBase } from '../op-form-base';
import { Field, TextInput, NumberInput, TextArea } from '@/components/form/field';
import { BtnGroup } from '@/components/form/btn-group';

const FUEL_TYPES = ['휘발유', '경유', 'LPG', '전기', '하이브리드', '기타'];

export function FuelForm() {
  const [fuelType, setFuelType] = useState('휘발유');

  return (
    <OpFormBase
      eventType="fuel"
      buildPayload={(d) => ({
        title: d.title || '주유',
        fuel_type: fuelType,
        vendor: d.vendor,
        fuel_amount: Number(String(d.fuel_amount ?? '').replace(/,/g, '')) || undefined,
        unit_price: Number(String(d.unit_price ?? '').replace(/,/g, '')) || undefined,
        amount: Number(String(d.amount ?? '').replace(/,/g, '')) || 0,
        mileage: Number(String(d.mileage ?? '').replace(/,/g, '')) || undefined,
        memo: d.memo,
      })}
    >
      <div className="form-section-title">
        <i className="ph ph-gas-pump" />주유 · 충전
      </div>
      <div className="form-grid">
        <Field label="연료 구분" required span={2}>
          <BtnGroup value={fuelType} onChange={setFuelType} options={FUEL_TYPES} />
        </Field>
        <Field label="주유소 / 충전소">
          <TextInput name="vendor" />
        </Field>
        <Field label="주행거리 (km)">
          <NumberInput name="mileage" />
        </Field>
        <Field label="리터 / kWh">
          <NumberInput name="fuel_amount" placeholder="예: 40.5" />
        </Field>
        <Field label="단가">
          <NumberInput name="unit_price" placeholder="원/L" />
        </Field>
        <Field label="결제 금액" required>
          <NumberInput name="amount" required placeholder="0" />
        </Field>
        <Field label="메모" span={2}>
          <TextArea name="memo" rows={2} />
        </Field>
      </div>
    </OpFormBase>
  );
}
