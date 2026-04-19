'use client';

import { useState } from 'react';
import { InputFormShell } from './input-form-shell';
import { Field, TextInput, NumberInput, DateInput, TextArea } from '@/components/form/field';
import { BtnGroup } from '@/components/form/btn-group';
import { EntityPicker } from '@/components/form/entity-picker';
import { CarNumberPicker } from '@/components/form/car-number-picker';
import { sanitizeCarNumber } from '@/lib/format-input';
import {
  FUEL_TYPES, DRIVE_TYPES, TRANSMISSIONS, EXT_COLORS, INT_COLORS,
  BODY_SHAPES, USAGE_TYPES, ASSET_STATUS_OPTS,
} from '@/lib/data/vehicle-constants';

interface PartnerRec extends Record<string, unknown> { _key?: string; partner_code?: string; partner_name?: string }

interface CarModelRec extends Record<string, unknown> {
  _key?: string;
  maker?: string;
  model?: string;
  sub?: string;
  category?: string;
  origin?: string;
  powertrain?: string;
  fuel_type?: string;
  year_start?: string | number;
  year_end?: string | number;
  transmission?: string;
  seats?: number;
  displacement?: number;
  battery_kwh?: number;
  code?: string;
}

export function AssetCreateForm() {
  const [carNumber, setCarNumber] = useState('');
  const [partnerCode, setPartnerCode] = useState('');
  const [manufacturer, setManufacturer] = useState('');
  const [carModel, setCarModel] = useState('');
  const [detailModel, setDetailModel] = useState('');
  const [carYear, setCarYear] = useState('');
  const [fuelType, setFuelType] = useState('가솔린');
  const [driveType, setDriveType] = useState('');
  const [transmission, setTransmission] = useState('');
  const [extColor, setExtColor] = useState('');
  const [intColor, setIntColor] = useState('');
  const [bodyShape, setBodyShape] = useState('');
  const [usageType, setUsageType] = useState('렌터카');
  const [status, setStatus] = useState('active');
  const [masterKey, setMasterKey] = useState('');
  const [masterSpec, setMasterSpec] = useState<CarModelRec | null>(null);

  const applyMaster = (rec: CarModelRec | null) => {
    if (!rec) return;
    if (rec.maker) setManufacturer(rec.maker);
    if (rec.model) setCarModel(rec.model);
    if (rec.sub) setDetailModel(rec.sub);
    if (rec.year_start) setCarYear(String(rec.year_start));
    if (rec.fuel_type && FUEL_TYPES.includes(rec.fuel_type)) setFuelType(rec.fuel_type);
    setMasterKey(`${rec.maker ?? ''} ${rec.model ?? ''} ${rec.sub ?? ''}`.trim());
    setMasterSpec(rec);
  };

  return (
    <InputFormShell
      collection="assets"
      validate={(d) => {
        if (!d.car_number) return '차량번호를 입력하세요';
        if (!manufacturer || !carModel || !detailModel) return '차종 마스터에서 선택하세요';
        return null;
      }}
      buildPayload={(d) => ({
        car_number: sanitizeCarNumber(d.car_number),
        vin: d.vin || undefined,
        partner_code: partnerCode || undefined,
        manufacturer: manufacturer || undefined,
        car_model: carModel || undefined,
        detail_model: detailModel || undefined,
        trim: d.trim || undefined,
        car_year: carYear ? Number(carYear) : undefined,
        fuel_type: fuelType,
        drive_type: driveType || undefined,
        transmission: transmission || undefined,
        ext_color: extColor || undefined,
        int_color: intColor || undefined,
        category: masterSpec?.category,
        origin: masterSpec?.origin,
        powertrain: masterSpec?.powertrain,
        displacement: masterSpec?.displacement,
        seats: masterSpec?.seats,
        battery_kwh: masterSpec?.battery_kwh,
        model_code: masterSpec?.code,
        // 자동차등록증 기재사항 (개별 차량 고유)
        type_number: d.type_number || undefined,
        engine_type: d.engine_type || undefined,
        body_shape: bodyShape || undefined,
        curb_weight_kg: d.curb_weight_kg ? Number(String(d.curb_weight_kg).replace(/,/g, '')) : undefined,
        gross_weight_kg: d.gross_weight_kg ? Number(String(d.gross_weight_kg).replace(/,/g, '')) : undefined,
        usage_type: usageType || undefined,
        inspection_valid_until: d.inspection_valid_until || undefined,
        certification_number: d.certification_number || undefined,
        current_mileage: d.current_mileage ? Number(String(d.current_mileage).replace(/,/g, '')) : undefined,
        first_registration_date: d.first_registration_date || undefined,
        acquisition_cost: d.acquisition_cost ? Number(String(d.acquisition_cost).replace(/,/g, '')) : undefined,
        acquisition_date: d.acquisition_date || undefined,
        key_count: d.key_count ? Number(d.key_count) : 2,
        note: d.note || undefined,
        status,
      })}
      onSaved={() => {
        setCarNumber('');
        setManufacturer('');
        setCarModel('');
        setDetailModel('');
        setCarYear('');
        setDriveType('');
        setTransmission('');
        setExtColor('');
        setIntColor('');
        setBodyShape('');
        setUsageType('렌터카');
        setMasterKey('');
        setMasterSpec(null);
      }}
    >
      {/* ① 차종 선택 — 등록의 핵심 시작점 */}
      <div className="form-section">
        <div className="form-section-title">
          <i className="ph ph-list-magnifying-glass" />차종 선택
          <span className="text-text-muted" style={{ fontSize: 10, fontWeight: 400, marginLeft: 8 }}>
            · 차종 마스터에서 선택 → 제조사·모델·분류·스펙 자동 채움
          </span>
        </div>
        <div className="form-grid">
          <Field label="차종 마스터" required span={3}>
            <EntityPicker<CarModelRec>
              collection="vehicle_master"
              value={masterKey}
              onChange={(v, rec) => {
                setMasterKey(v);
                if (rec) {
                  applyMaster(rec);
                } else {
                  setManufacturer('');
                  setCarModel('');
                  setDetailModel('');
                  setMasterSpec(null);
                }
              }}
              primaryField="maker"
              secondaryField="model"
              tertiaryField="sub"
              searchFields={['maker', 'model', 'sub', 'category']}
              placeholder="제조사 · 모델 · 세부모델 검색 (예: 현대 아반떼)"
              createHref="/dev"
              createLabel="차종 마스터에서 먼저 등록"
              required
            />
          </Field>
        </div>

        {masterSpec && (
          <div
            style={{
              marginTop: 10,
              padding: 10,
              background: 'var(--c-bg-sub)',
              border: '1px solid var(--c-border)',
              borderRadius: 2,
              fontSize: 11,
            }}
          >
            <div style={{ color: 'var(--c-text-muted)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
              <i className="ph ph-lock-simple" />
              마스터 자동 지정 (등록 시점 스냅샷)
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '4px 12px', color: 'var(--c-text)' }}>
              <SpecItem k="제조사" v={manufacturer} />
              <SpecItem k="모델" v={carModel} />
              <SpecItem k="세부모델" v={detailModel} />
              {masterSpec.category && <SpecItem k="분류" v={masterSpec.category} />}
              {masterSpec.origin && <SpecItem k="구분" v={masterSpec.origin} />}
              {masterSpec.powertrain && <SpecItem k="동력" v={masterSpec.powertrain} />}
              {masterSpec.seats && <SpecItem k="승차" v={`${masterSpec.seats}인승`} />}
              {masterSpec.displacement && <SpecItem k="배기량" v={`${masterSpec.displacement.toLocaleString()}cc`} />}
              {masterSpec.battery_kwh && <SpecItem k="배터리" v={`${masterSpec.battery_kwh}kWh`} />}
              {masterSpec.code && <SpecItem k="코드" v={String(masterSpec.code)} />}
            </div>
          </div>
        )}
      </div>

      {/* ② 차량 식별 */}
      <div className="form-section">
        <div className="form-section-title"><i className="ph ph-identification-card" />차량 식별</div>
        <div className="form-grid">
          <Field label="차량번호" required>
            <CarNumberPicker
              name="car_number"
              value={carNumber}
              onChange={(v) => setCarNumber(v)}
              autoFocus
              required
              showCreate={false}
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
              placeholder="예: JPK"
              createHref="/input?type=partner"
              createLabel="새 회원사 등록"
            />
          </Field>
          <Field label="차대번호 (VIN)">
            <TextInput name="vin" placeholder="17자리" />
          </Field>
        </div>
      </div>

      {/* ③ 차량 스펙 (개별) */}
      <div className="form-section">
        <div className="form-section-title"><i className="ph ph-gear" />개별 스펙</div>
        <div className="form-grid">
          <Field label="연식">
            <NumberInput value={carYear} onChange={(e) => setCarYear(e.target.value)} placeholder="2024" />
          </Field>
          <Field label="트림"><TextInput name="trim" placeholder="예: 프리미엄" /></Field>
          <Field label="연료">
            <BtnGroup value={fuelType} onChange={setFuelType} options={FUEL_TYPES} />
          </Field>
          <Field label="변속기" span={3}>
            <BtnGroup value={transmission} onChange={setTransmission} options={TRANSMISSIONS} />
          </Field>
          <Field label="구동방식" span={3}>
            <BtnGroup value={driveType} onChange={setDriveType} options={DRIVE_TYPES} />
          </Field>
          <Field label="외장색" span={3}>
            <BtnGroup value={extColor} onChange={setExtColor} options={EXT_COLORS} />
          </Field>
          <Field label="내장색" span={3}>
            <BtnGroup value={intColor} onChange={setIntColor} options={INT_COLORS} />
          </Field>
        </div>
      </div>

      {/* ④ 자동차등록증 기재사항 — 개별 차량 고유 (등록증 수령 시 입력) */}
      <div className="form-section">
        <div className="form-section-title">
          <i className="ph ph-file-text" />자동차등록증 기재사항
          <span className="text-text-muted" style={{ fontSize: 10, fontWeight: 400, marginLeft: 8 }}>
            · 등록증 수령 후 전사 입력 (선택)
          </span>
        </div>
        <div className="form-grid">
          <Field label="형식번호">
            <TextInput name="type_number" placeholder="예: CN7 PE" />
          </Field>
          <Field label="원동기형식">
            <TextInput name="engine_type" placeholder="예: G4FM" />
          </Field>
          <Field label="자기인증관리번호">
            <TextInput name="certification_number" />
          </Field>
          <Field label="차체형상" span={3}>
            <BtnGroup value={bodyShape} onChange={setBodyShape} options={BODY_SHAPES} />
          </Field>
          <Field label="차량자중 (kg)">
            <NumberInput name="curb_weight_kg" placeholder="1300" />
          </Field>
          <Field label="총중량 (kg)">
            <NumberInput name="gross_weight_kg" placeholder="1800" />
          </Field>
          <Field label="용도" span={3}>
            <BtnGroup value={usageType} onChange={setUsageType} options={USAGE_TYPES} />
          </Field>
          <Field label="검사유효기간">
            <DateInput name="inspection_valid_until" />
          </Field>
        </div>
      </div>

      {/* ⑤ 이력 · 취득 · 상태 */}
      <div className="form-section">
        <div className="form-section-title"><i className="ph ph-clock-counter-clockwise" />이력 · 취득 · 상태</div>
        <div className="form-grid">
          <Field label="최초등록일">
            <DateInput name="first_registration_date" />
          </Field>
          <Field label="취득일">
            <DateInput name="acquisition_date" />
          </Field>
          <Field label="취득가 (원)">
            <NumberInput name="acquisition_cost" placeholder="0" />
          </Field>
          <Field label="현재 주행거리 (km)">
            <NumberInput name="current_mileage" placeholder="0" />
          </Field>
          <Field label="키 개수">
            <NumberInput name="key_count" placeholder="2" />
          </Field>
          <Field label="상태" span={2}>
            <BtnGroup
              value={status}
              onChange={setStatus}
              options={ASSET_STATUS_OPTS}
            />
          </Field>
          <Field label="메모" span={3}>
            <TextArea name="note" rows={2} placeholder="특이사항·옵션·사고이력 등" />
          </Field>
        </div>
      </div>
    </InputFormShell>
  );
}

function SpecItem({ k, v }: { k: string; v: string }) {
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'baseline' }}>
      <span style={{ color: 'var(--c-text-muted)', minWidth: 48 }}>{k}</span>
      <b style={{ color: 'var(--c-text)' }}>{v}</b>
    </div>
  );
}
