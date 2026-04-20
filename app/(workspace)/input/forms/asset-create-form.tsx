'use client';

import { useState, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { InputFormShell } from './input-form-shell';
import { Field, TextInput, NumberInput, DateInput, TextArea } from '@/components/form/field';
import { BtnGroup } from '@/components/form/btn-group';
import { EntityPicker } from '@/components/form/entity-picker';
import { CarNumberPicker } from '@/components/form/car-number-picker';
import { sanitizeCarNumber } from '@/lib/format-input';
import { ocrFile } from '@/lib/ocr';
import { parseVehicleReg, detectVehicleReg } from '@/lib/parsers/vehicle-reg';
import { useRtdbCollection } from '@/lib/collections/rtdb';
import {
  FUEL_TYPES, DRIVE_TYPES, EXT_COLORS, INT_COLORS,
  USAGE_TYPES, ASSET_STATUS_OPTS, type FuelType,
} from '@/lib/data/vehicle-constants';

interface PartnerRec extends Record<string, unknown> { _key?: string; partner_code?: string; partner_name?: string }

interface CarModelRec extends Record<string, unknown> {
  _key?: string;
  maker?: string; model?: string; sub?: string;
  category?: string; origin?: string; powertrain?: string;
  fuel_type?: string; seats?: number; displacement?: number;
  battery_kwh?: number; code?: string; transmission?: string;
  year_start?: string | number; year_end?: string | number;
}

export function AssetCreateForm() {
  // 차량번호
  const [carNumber, setCarNumber] = useState('');
  const [partnerCode, setPartnerCode] = useState('');

  // 제조사 스펙 (차종마스터 단계별 선택)
  const vehicleMasters = useRtdbCollection<CarModelRec>('vehicle_master');
  const [manufacturer, setManufacturer] = useState('');
  const [carModel, setCarModel] = useState('');
  const [detailModel, setDetailModel] = useState('');
  const [extColor, setExtColor] = useState('');
  const [intColor, setIntColor] = useState('');
  const [driveType, setDriveType] = useState('');

  // 단계별 옵션 목록
  const makers = useMemo(() => {
    const set = new Set<string>();
    for (const m of vehicleMasters.data) if (m.maker) set.add(m.maker);
    return [...set].sort((a, b) => a.localeCompare(b, 'ko'));
  }, [vehicleMasters.data]);

  const models = useMemo(() => {
    if (!manufacturer) return [];
    const set = new Set<string>();
    for (const m of vehicleMasters.data) if (m.maker === manufacturer && m.model) set.add(m.model);
    return [...set].sort((a, b) => a.localeCompare(b, 'ko'));
  }, [vehicleMasters.data, manufacturer]);

  const subs = useMemo(() => {
    if (!manufacturer || !carModel) return [];
    return vehicleMasters.data
      .filter((m) => m.maker === manufacturer && m.model === carModel && m.sub)
      .map((m) => m.sub!)
      .sort((a, b) => a.localeCompare(b, 'ko'));
  }, [vehicleMasters.data, manufacturer, carModel]);

  const masterSpec = useMemo(() => {
    if (!manufacturer || !carModel || !detailModel) return null;
    return vehicleMasters.data.find(
      (m) => m.maker === manufacturer && m.model === carModel && m.sub === detailModel,
    ) ?? null;
  }, [vehicleMasters.data, manufacturer, carModel, detailModel]);

  // 등록증 스펙
  const [vin, setVin] = useState('');
  const [carYear, setCarYear] = useState('');
  const [fuelType, setFuelType] = useState<string>('가솔린');
  const [displacement, setDisplacement] = useState('');
  const [seats, setSeats] = useState('');
  const [usageType, setUsageType] = useState('렌터카');
  const [firstRegDate, setFirstRegDate] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [typeNumber, setTypeNumber] = useState('');
  const [engineType, setEngineType] = useState('');
  const [status, setStatus] = useState('active');

  // OCR 상태
  const [ocrBusy, setOcrBusy] = useState(false);

  // 세부모델 선택 시 스펙 자동 채움
  const applySpec = useCallback((spec: CarModelRec | null) => {
    if (!spec) return;
    if (spec.fuel_type && FUEL_TYPES.includes(spec.fuel_type as FuelType)) setFuelType(spec.fuel_type);
    if (spec.displacement) setDisplacement(String(spec.displacement));
    if (spec.seats) setSeats(String(spec.seats));
  }, []);

  // 등록증 OCR
  const handleRegUpload = useCallback(async (file: File) => {
    setOcrBusy(true);
    try {
      const { text, lines } = await ocrFile(file);
      if (!detectVehicleReg(text)) {
        toast.error('자동차등록증이 아닌 것 같습니다');
        return;
      }
      const parsed = parseVehicleReg(text, lines);
      // 자동 채움
      if (parsed.car_number) setCarNumber(parsed.car_number);
      if (parsed.vin) setVin(parsed.vin);
      if (parsed.car_year) setCarYear(String(parsed.car_year));
      if (parsed.fuel_type) setFuelType(parsed.fuel_type);
      if (parsed.displacement) setDisplacement(String(parsed.displacement));
      if (parsed.seats) setSeats(String(parsed.seats));
      if (parsed.usage_type) setUsageType(parsed.usage_type);
      if (parsed.first_registration_date) setFirstRegDate(parsed.first_registration_date);
      if (parsed.owner_name) setOwnerName(parsed.owner_name);
      if (parsed.type_number) setTypeNumber(parsed.type_number);
      if (parsed.engine_type) setEngineType(parsed.engine_type);

      const filled = [
        parsed.car_number && '차량번호',
        parsed.vin && '차대번호',
        parsed.displacement && '배기량',
        parsed.fuel_type && '연료',
        parsed.seats && '승차정원',
      ].filter(Boolean);
      toast.success(`등록증 OCR 완료 · ${filled.join(', ')} 자동 채움`);
    } catch (err) {
      toast.error(`OCR 실패: ${(err as Error).message}`);
    } finally {
      setOcrBusy(false);
    }
  }, []);

  return (
    <InputFormShell
      collection="assets"
      validate={() => {
        if (!partnerCode) return '회사코드를 입력하세요';
        if (!carNumber) return '차량번호를 입력하세요';
        return null;
      }}
      buildPayload={() => ({
        car_number: sanitizeCarNumber(carNumber),
        partner_code: partnerCode || undefined,
        manufacturer: manufacturer || undefined,
        car_model: carModel || undefined,
        detail_model: detailModel || undefined,
        trim: undefined,
        car_year: carYear ? Number(carYear) : undefined,
        fuel_type: fuelType,
        drive_type: driveType || undefined,
        ext_color: extColor || undefined,
        int_color: intColor || undefined,
        category: masterSpec?.category,
        origin: masterSpec?.origin,
        powertrain: masterSpec?.powertrain,
        displacement: displacement ? Number(displacement) : masterSpec?.displacement,
        seats: seats ? Number(seats) : masterSpec?.seats,
        battery_kwh: masterSpec?.battery_kwh,
        model_code: masterSpec?.code,
        vin: vin || undefined,
        type_number: typeNumber || undefined,
        engine_type: engineType || undefined,
        usage_type: usageType || undefined,
        first_registration_date: firstRegDate || undefined,
        owner_name: ownerName || undefined,
        key_count: 2,
        status,
      })}
      onSaved={() => {
        setCarNumber(''); setVin(''); setManufacturer(''); setCarModel('');
        setDetailModel(''); setCarYear(''); setDisplacement(''); setSeats('');
        setDriveType(''); setExtColor(''); setIntColor(''); setUsageType('렌터카');
        setFirstRegDate(''); setOwnerName(''); setTypeNumber(''); setEngineType('');
      }}
    >
      {/* ── ① 차량번호 ── */}
      <div className="form-section-title">
        <i className="ph ph-car" />차량 식별
      </div>
      <div className="form-row">
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
      </div>

      {/* ── ② 제조사 스펙 ── */}
      <div className="form-section">
        <div className="form-section-title">
          <i className="ph ph-factory" />제조사 스펙
        </div>

        {/* 제조사 → 모델 → 세부모델 단계별 선택 */}
        <div className="form-row">
          <Field label="제조사">
            <select
              className="input"
              value={manufacturer}
              onChange={(e) => { setManufacturer(e.target.value); setCarModel(''); setDetailModel(''); }}
            >
              <option value="">선택</option>
              {makers.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </Field>
          <Field label="모델">
            <select
              className="input"
              value={carModel}
              onChange={(e) => { setCarModel(e.target.value); setDetailModel(''); }}
              disabled={!manufacturer}
            >
              <option value="">선택</option>
              {models.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </Field>
          <Field label="세부모델">
            <select
              className="input"
              value={detailModel}
              onChange={(e) => {
                setDetailModel(e.target.value);
                const spec = vehicleMasters.data.find(
                  (m) => m.maker === manufacturer && m.model === carModel && m.sub === e.target.value,
                );
                applySpec(spec ?? null);
              }}
              disabled={!carModel}
            >
              <option value="">선택</option>
              {subs.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
        </div>

        {masterSpec && (
          <div className="text-xs" style={{ marginTop: 8, padding: 8, background: 'var(--c-bg-sub)', borderRadius: 2, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {masterSpec.category && <SpecItem k="분류" v={masterSpec.category} />}
            {masterSpec.origin && <SpecItem k="구분" v={String(masterSpec.origin)} />}
            {masterSpec.powertrain && <SpecItem k="동력" v={String(masterSpec.powertrain)} />}
            {masterSpec.displacement && <SpecItem k="배기량" v={`${masterSpec.displacement.toLocaleString()}cc`} />}
            {masterSpec.seats && <SpecItem k="승차" v={`${masterSpec.seats}인승`} />}
            {masterSpec.battery_kwh && <SpecItem k="배터리" v={`${masterSpec.battery_kwh}kWh`} />}
          </div>
        )}

        <div className="form-row" style={{ marginTop: 12 }}>
          <Field label="세부트림">
            <TextInput name="trim" placeholder="예: 프리미엄" />
          </Field>
          <Field label="선택옵션">
            <TextInput name="options" placeholder="예: 선루프, HUD" />
          </Field>
        </div>
        <div className="form-row" style={{ marginTop: 12 }}>
          <Field label="외장색">
            <BtnGroup value={extColor} onChange={setExtColor} options={[...EXT_COLORS]} />
          </Field>
          <Field label="내장색">
            <BtnGroup value={intColor} onChange={setIntColor} options={[...INT_COLORS]} />
          </Field>
        </div>
        <div style={{ marginTop: 12 }}>
          <Field label="구동방식">
            <BtnGroup value={driveType} onChange={setDriveType} options={[...DRIVE_TYPES]} />
          </Field>
        </div>
      </div>

      {/* ── ③ 등록증 스펙 (OCR) ── */}
      <div className="form-section">
        <div className="form-section-title">
          <i className="ph ph-file-text" />등록증 스펙
          <span className="text-text-muted text-2xs" style={{ fontWeight: 400, marginLeft: 8 }}>
            등록증 업로드 시 자동 채움
          </span>
        </div>

        {/* 등록증 업로드 */}
        <label
          className="jpk-uploader-drop"
          style={{ marginBottom: 12, padding: 12 }}
        >
          <input
            type="file"
            accept="application/pdf,image/*"
            hidden
            onChange={(e) => { if (e.target.files?.[0]) handleRegUpload(e.target.files[0]); e.target.value = ''; }}
          />
          <i className="ph ph-file-arrow-up" style={{ fontSize: 18 }} />
          <div>
            <div className="text-base" style={{ fontWeight: 600 }}>
              {ocrBusy ? 'OCR 처리 중...' : '자동차등록증 업로드'}
            </div>
            <div className="text-2xs text-text-muted">PDF · 이미지 · 클릭 또는 드래그</div>
          </div>
        </label>

        <div className="form-row">
          <Field label="차대번호 (VIN)">
            <TextInput value={vin} onChange={(e) => setVin(e.target.value)} placeholder="17자리" />
          </Field>
          <Field label="연식">
            <NumberInput value={carYear} onChange={(e) => setCarYear(e.target.value)} placeholder="2024" />
          </Field>
        </div>
        <div className="form-row" style={{ marginTop: 12 }}>
          <Field label="배기량 (cc)">
            <NumberInput value={displacement} onChange={(e) => setDisplacement(e.target.value)} placeholder="2199" />
          </Field>
          <Field label="승차정원">
            <NumberInput value={seats} onChange={(e) => setSeats(e.target.value)} placeholder="5" />
          </Field>
        </div>
        <div style={{ marginTop: 12 }}>
          <Field label="연료">
            <BtnGroup value={fuelType} onChange={setFuelType} options={[...FUEL_TYPES]} />
          </Field>
        </div>
        <div className="form-row" style={{ marginTop: 12 }}>
          <Field label="형식번호">
            <TextInput value={typeNumber} onChange={(e) => setTypeNumber(e.target.value)} placeholder="NKC90D" />
          </Field>
          <Field label="원동기형식">
            <TextInput value={engineType} onChange={(e) => setEngineType(e.target.value)} placeholder="D4HB" />
          </Field>
        </div>
        <div className="form-row" style={{ marginTop: 12 }}>
          <Field label="최초등록일">
            <DateInput value={firstRegDate} onChange={(e) => setFirstRegDate(e.target.value)} />
          </Field>
          <Field label="용도">
            <BtnGroup value={usageType} onChange={setUsageType} options={[...USAGE_TYPES]} />
          </Field>
        </div>
        <div style={{ marginTop: 12 }}>
          <Field label="소유자">
            <TextInput value={ownerName} onChange={(e) => setOwnerName(e.target.value)} placeholder="법인명 또는 개인명" />
          </Field>
        </div>
      </div>

      {/* ── ④ 상태 ── */}
      <div className="form-section">
        <div className="form-section-title"><i className="ph ph-check-circle" />상태</div>
        <Field label="자산 상태">
          <BtnGroup value={status} onChange={setStatus} options={ASSET_STATUS_OPTS} />
        </Field>
      </div>
    </InputFormShell>
  );
}

function SpecItem({ k, v }: { k: string; v: string }) {
  return (
    <span>
      <span className="text-text-muted">{k}</span> <b className="text-text">{v}</b>
    </span>
  );
}
