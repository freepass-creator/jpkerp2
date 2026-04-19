'use client';

import { useMemo, useState } from 'react';
import { OpFormBase } from '../op-form-base';
import { Field, TextInput, NumberInput, DateInput, TextArea } from '@/components/form/field';
import { BtnGroup } from '@/components/form/btn-group';
import { ItemTable, type ItemRow } from '@/components/form/item-table';

type PcKind = '정비' | '사고수리' | '상품화' | '세차';
type WorkStatus = '접수' | '진행중' | '완료';

const KIND_TYPE: Record<PcKind, string> = {
  '정비': 'maint',
  '사고수리': 'repair',
  '상품화': 'product',
  '세차': 'wash',
};

const PARTS_SUGGESTIONS = ['엔진오일', '미션오일', '브레이크오일', '냉각수', '에어필터', '에어컨필터', '와이퍼', '배터리', '타이어'];
const FIX_SUGGESTIONS = ['엔진 점검', '미션 점검', '브레이크 점검', '전기 계통', '냉각 계통', '연료 계통'];

export function PcForm() {
  const [kind, setKind] = useState<PcKind>('정비');
  const [status, setStatus] = useState<WorkStatus>('접수');

  // 정비 항목
  const [parts, setParts] = useState<ItemRow[]>([]);
  const [fix, setFix] = useState<ItemRow[]>([]);

  // 상품화 항목 5종
  const [prodAccessory, setProdAccessory] = useState<ItemRow[]>([]);
  const [prodWash, setProdWash] = useState<ItemRow[]>([]);
  const [prodBody, setProdBody] = useState<ItemRow[]>([]);
  const [prodParts, setProdParts] = useState<ItemRow[]>([]);
  const [prodFix, setProdFix] = useState<ItemRow[]>([]);

  // 사고수리 버튼
  const [damageArea, setDamageArea] = useState('앞범퍼');
  const [damageFrame, setDamageFrame] = useState('없음');
  const [rentalCar, setRentalCar] = useState('미정');

  // 상품화 차량상태
  const [exterior, setExterior] = useState('양호');
  const [interior, setInterior] = useState('양호');
  const [tireStatus, setTireStatus] = useState('양호');

  // 세차 유형
  const [washType, setWashType] = useState('외부세차');

  const maintTotal = useMemo(
    () => parts.reduce((s, r) => s + (r.amount || 0), 0) + fix.reduce((s, r) => s + (r.amount || 0), 0),
    [parts, fix],
  );
  const productTotal = useMemo(
    () =>
      prodAccessory.reduce((s, r) => s + (r.amount || 0), 0) +
      prodWash.reduce((s, r) => s + (r.amount || 0), 0) +
      prodBody.reduce((s, r) => s + (r.amount || 0), 0) +
      prodParts.reduce((s, r) => s + (r.amount || 0), 0) +
      prodFix.reduce((s, r) => s + (r.amount || 0), 0),
    [prodAccessory, prodWash, prodBody, prodParts, prodFix],
  );

  return (
    <OpFormBase
      eventType={KIND_TYPE[kind]}
      buildPayload={(d) => {
        const base: Record<string, unknown> = {
          type: KIND_TYPE[kind],
          pc_kind: kind,
          work_status: status,
          from_location: d.from_location,
          vendor: d.vendor,
          title: d.title,
          note: d.note,
        };
        if (kind === '정비') {
          return {
            ...base,
            amount: maintTotal,
            parts_items: parts.filter((r) => r.item || r.amount),
            fix_items: fix.filter((r) => r.item || r.amount),
            next_maint_date: d.next_maint_date,
          };
        }
        if (kind === '사고수리') {
          return {
            ...base,
            damage_area: damageArea,
            damage_frame: damageFrame,
            rental_car: rentalCar,
            repair_estimate: Number(String(d.repair_estimate ?? '').replace(/,/g, '')) || 0,
            insurance_amount: Number(String(d.insurance_amount ?? '').replace(/,/g, '')) || 0,
            self_pay: Number(String(d.self_pay ?? '').replace(/,/g, '')) || 0,
            expected_delivery: d.expected_delivery,
          };
        }
        if (kind === '상품화') {
          return {
            ...base,
            amount: productTotal,
            accessory_items: prodAccessory.filter((r) => r.item || r.amount),
            wash_items: prodWash.filter((r) => r.item || r.amount),
            body_items: prodBody.filter((r) => r.item || r.amount),
            parts_items: prodParts.filter((r) => r.item || r.amount),
            fix_items: prodFix.filter((r) => r.item || r.amount),
            exterior,
            interior,
            tire_status: tireStatus,
            expected_delivery: d.expected_delivery,
          };
        }
        return {
          ...base,
          wash_type: washType,
          amount: Number(String(d.amount ?? '').replace(/,/g, '')) || 0,
          expected_delivery: d.expected_delivery,
        };
      }}
    >
      {/* 작업 구분 / 상태 */}
      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: 16 }}>
        <div>
          <label className="form-label" style={{ display: 'block', marginBottom: 6 }}>작업 구분</label>
          <BtnGroup value={kind} onChange={setKind} options={['정비', '사고수리', '상품화', '세차']} />
        </div>
        <div>
          <label className="form-label" style={{ display: 'block', marginBottom: 6 }}>작업 상태</label>
          <BtnGroup value={status} onChange={setStatus} options={['접수', '진행중', '완료']} />
        </div>
      </div>

      {/* 공통 */}
      <div className="form-grid" style={{ marginBottom: 16 }}>
        <Field label="출발지">
          <TextInput name="from_location" placeholder="출발 위치" />
        </Field>
        <Field label="도착지 (입고처)">
          <TextInput name="vendor" placeholder="정비소 · 도색업체 · 세차장" />
        </Field>
      </div>

      {/* 정비 */}
      {kind === '정비' && (
        <>
          <ItemTable
            title="소모품 교체"
            icon="ph-wrench"
            columns={[
              { key: 'item', label: '항목' },
              { key: 'amount', label: '금액', width: 120 },
            ]}
            rows={parts}
            onChange={setParts}
            itemSuggestions={PARTS_SUGGESTIONS}
            favKey="maint_parts"
          />
          <ItemTable
            title="기능수리"
            icon="ph-hammer"
            columns={[
              { key: 'item', label: '수리내용' },
              { key: 'amount', label: '금액', width: 120 },
            ]}
            rows={fix}
            onChange={setFix}
            itemSuggestions={FIX_SUGGESTIONS}
            favKey="maint_fix"
          />
          <div className="form-section">
            <div className="form-section-title"><i className="ph ph-calculator" />합계</div>
            <div className="form-grid">
              <Field label="총 금액">
                <TextInput value={maintTotal ? maintTotal.toLocaleString() : ''} readOnly placeholder="자동 계산" style={{ textAlign: 'right' }} />
              </Field>
              <Field label="다음정비예정">
                <DateInput name="next_maint_date" />
              </Field>
              <Field label="메모" span={3}>
                <TextArea name="note" rows={2} />
              </Field>
            </div>
          </div>
        </>
      )}

      {/* 사고수리 */}
      {kind === '사고수리' && (
        <div className="form-section">
          <div className="form-section-title"><i className="ph ph-hammer" />사고수리 정보</div>
          <div className="form-grid">
            <Field label="사고부위" span={3}>
              <BtnGroup
                value={damageArea}
                onChange={setDamageArea}
                options={['앞범퍼', '뒷범퍼', '앞휀더', '뒷휀더', '도어', '본넷', '트렁크', '사이드미러', '유리', '휠', '기타']}
              />
            </Field>
            <Field label="수리내용">
              <TextInput name="title" placeholder="예: 후방 판금도색" />
            </Field>
            <Field label="골격 손상">
              <BtnGroup value={damageFrame} onChange={setDamageFrame} options={['없음', '경미', '있음']} />
            </Field>
            <Field label="대차">
              <BtnGroup value={rentalCar} onChange={setRentalCar} options={['미정', '대차제공', '대차없음']} />
            </Field>
            <Field label="수리예상금액">
              <NumberInput name="repair_estimate" placeholder="0" />
            </Field>
            <Field label="보험금">
              <NumberInput name="insurance_amount" placeholder="0" />
            </Field>
            <Field label="자기부담금">
              <NumberInput name="self_pay" placeholder="0" />
            </Field>
            <Field label="예상 완료일">
              <DateInput name="expected_delivery" />
            </Field>
            <Field label="메모" span={3}>
              <TextArea name="note" rows={2} />
            </Field>
          </div>
        </div>
      )}

      {/* 상품화 */}
      {kind === '상품화' && (
        <>
          <ItemTable
            title="부속품 설치" icon="ph-puzzle-piece"
            columns={[
              { key: 'item', label: '항목' },
              { key: 'vendor', label: '업체', width: 100 },
              { key: 'amount', label: '금액', width: 120 },
            ]}
            rows={prodAccessory} onChange={setProdAccessory}
            favKey="prod_accessory"
          />
          <ItemTable
            title="세차/광택" icon="ph-drop"
            columns={[
              { key: 'item', label: '항목' },
              { key: 'vendor', label: '업체', width: 100 },
              { key: 'amount', label: '금액', width: 120 },
            ]}
            rows={prodWash} onChange={setProdWash}
            favKey="prod_wash"
          />
          <ItemTable
            title="외판수리" icon="ph-paint-brush"
            columns={[
              { key: 'item', label: '항목' },
              { key: 'vendor', label: '업체', width: 100 },
              { key: 'amount', label: '금액', width: 120 },
            ]}
            rows={prodBody} onChange={setProdBody}
            favKey="prod_body"
          />
          <ItemTable
            title="소모품 교체" icon="ph-wrench"
            columns={[
              { key: 'item', label: '항목' },
              { key: 'vendor', label: '업체', width: 100 },
              { key: 'amount', label: '금액', width: 120 },
            ]}
            rows={prodParts} onChange={setProdParts}
            itemSuggestions={PARTS_SUGGESTIONS}
            favKey="prod_parts"
          />
          <ItemTable
            title="기능수리" icon="ph-hammer"
            columns={[
              { key: 'item', label: '수리내용' },
              { key: 'vendor', label: '업체', width: 100 },
              { key: 'amount', label: '금액', width: 120 },
            ]}
            rows={prodFix} onChange={setProdFix}
            itemSuggestions={FIX_SUGGESTIONS}
            favKey="prod_fix"
          />
          <div className="form-section">
            <div className="form-section-title"><i className="ph ph-gauge" />차량 상태</div>
            <div className="form-grid">
              <Field label="외관">
                <BtnGroup value={exterior} onChange={setExterior} options={['양호', '경미흠집', '손상있음']} />
              </Field>
              <Field label="실내">
                <BtnGroup value={interior} onChange={setInterior} options={['양호', '보통', '청소필요']} />
              </Field>
              <Field label="타이어">
                <BtnGroup value={tireStatus} onChange={setTireStatus} options={['양호', '교체필요', '편마모']} />
              </Field>
            </div>
          </div>
          <div className="form-section">
            <div className="form-grid">
              <Field label="총 비용">
                <TextInput
                  value={productTotal ? productTotal.toLocaleString() : ''}
                  readOnly
                  placeholder="자동 계산"
                  style={{ textAlign: 'right' }}
                />
              </Field>
              <Field label="예상 완료일">
                <DateInput name="expected_delivery" />
              </Field>
              <Field label="메모" span={3}>
                <TextArea name="note" rows={2} />
              </Field>
            </div>
          </div>
        </>
      )}

      {/* 세차 */}
      {kind === '세차' && (
        <div className="form-section">
          <div className="form-section-title"><i className="ph ph-drop" />세차 정보</div>
          <div className="form-grid">
            <Field label="세차유형">
              <BtnGroup
                value={washType}
                onChange={setWashType}
                options={['외부세차', '실내크리닝', '풀세차', '광택']}
              />
            </Field>
            <Field label="작업내용">
              <TextInput name="title" placeholder="예: 외부세차 + 실내크리닝" />
            </Field>
            <Field label="금액">
              <NumberInput name="amount" placeholder="0" />
            </Field>
            <Field label="예상 완료일">
              <DateInput name="expected_delivery" />
            </Field>
            <Field label="메모" span={3}>
              <TextArea name="note" rows={2} />
            </Field>
          </div>
        </div>
      )}
    </OpFormBase>
  );
}
