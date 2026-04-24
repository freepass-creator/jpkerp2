'use client';

import { useMemo, useState } from 'react';
import { Workspace } from '@/components/shared/panel';
import { SortableTypesList, type TypeItem } from '@/components/shared/sortable-types-list';
import { DEV_LABELS, DEV_SUBS, DEV_ICONS, type DevKey } from './dev-types';
import { ToolActionsHost, ToolDetailHost } from './tool-actions-context';
import { RtdbStatusTool } from './tools/rtdb-status';
import { CarMasterTool } from './tools/car-master';
import { VehicleMasterMaintTool } from './tools/vehicle-master-maint';
import { BulkDeliveryTool } from './tools/bulk-delivery';
import { OverdueTool } from './tools/overdue-tool';
import { OverdueSyncTool } from './tools/overdue-sync';
import { CutoverTool } from './tools/cutover-tool';
import { MessageTool } from './tools/message-tool';
import { DataPurgeTool } from './tools/data-purge-tool';
import { MobileInboxTool } from './tools/mobile-inbox';

const ITEMS: TypeItem<DevKey>[] = (Object.keys(DEV_LABELS) as DevKey[]).map((k) => ({
  key: k,
  label: DEV_LABELS[k],
  icon: DEV_ICONS[k],
}));

function ToolFor({ k }: { k: DevKey }) {
  switch (k) {
    case 'rtdb': return <RtdbStatusTool />;
    case 'carmaster': return <CarMasterTool />;
    case 'carmaster-maint': return <VehicleMasterMaintTool />;
    case 'bulk-delivery': return <BulkDeliveryTool />;
    case 'overdue': return <OverdueTool />;
    case 'overdue-sync': return <OverdueSyncTool />;
    case 'cutover': return <CutoverTool />;
    case 'alimtalk': return <MessageTool channel="alimtalk" />;
    case 'sms': return <MessageTool channel="sms" />;
    case 'data-purge': return <DataPurgeTool />;
    case 'mobile-inbox': return <MobileInboxTool />;
    default: return null;
  }
}

export default function DevPage() {
  const [selected, setSelected] = useState<DevKey>('rtdb');
  const [actionsHost, setActionsHost] = useState<HTMLDivElement | null>(null);
  const [detailHost, setDetailHost] = useState<HTMLDivElement | null>(null);
  const [takeover, setTakeover] = useState(false);
  const detailCtx = useMemo(() => ({ host: detailHost, setTakeover }), [detailHost]);

  return (
    <Workspace layout="layout-254">
      {/* Panel 1 — 도구 선택 */}
      <section className="panel">
        <div className="panel-head">
          <div>
            <i className="ph ph-code" />
            <span className="panel-title">개발도구</span>
          </div>
        </div>
        <div className="panel-body no-pad" style={{ overflow: 'hidden' }}>
          <SortableTypesList<DevKey>
            items={ITEMS}
            selected={selected}
            onSelect={setSelected}
            storageKey="jpk.dev.order"
          />
        </div>
      </section>

      {/* Panel 2 — 선택된 도구 */}
      <section className="panel">
        <div className="panel-head">
          <div>
            <i
              className={`ph ${DEV_ICONS[selected]} text-text-sub text-[18px]`}
            />
            <span className="panel-title">{DEV_LABELS[selected]}</span>
            <span className="panel-subtitle">{DEV_SUBS[selected]}</span>
          </div>
          <div className="panel-head-actions" ref={setActionsHost} />
        </div>
        <div className="panel-body no-pad" style={{ overflow: 'hidden' }}>
          <ToolActionsHost.Provider value={actionsHost}>
            <ToolDetailHost.Provider value={detailCtx}>
              <ToolFor k={selected} />
            </ToolDetailHost.Provider>
          </ToolActionsHost.Provider>
        </div>
      </section>

      {/* Panel 3 — 설명 / 상세 (도구가 takeover 가능) */}
      <section className="panel">
        <div className="panel-head">
          <div>
            <i className={`ph ${takeover ? 'ph-file-text' : 'ph-info'}`} />
            <span className="panel-title">{takeover ? '상세' : '설명'}</span>
          </div>
        </div>
        <div
          className="panel-body no-pad"
          style={{ overflow: 'hidden', position: 'relative' }}
        >
          {/* 도구 portal 대상 */}
          <div
            ref={setDetailHost}
            style={{ height: '100%', display: takeover ? 'flex' : 'none', flexDirection: 'column' }}
          />
          {/* takeover 안 되면 기본 DevHelp */}
          {!takeover && (
            <div className="text-base text-text-sub" style={{ padding: 16, lineHeight: 1.6, overflow: 'auto', height: '100%' }}>
              <DevHelp k={selected} />
            </div>
          )}
        </div>
      </section>
    </Workspace>
  );
}

function DevHelp({ k }: { k: DevKey }) {
  const texts: Record<DevKey, string[]> = {
    rtdb: [
      '각 RTDB 컬렉션별 레코드 수·삭제건·예상 용량을 표시.',
      '새로고침으로 즉시 재조회.',
    ],
    carmaster: [
      'car_models 마스터 CRUD — 제조사·모델·세부·연식범위·차종·연료.',
      '행 클릭으로 수정 모드, 우측 휴지통으로 삭제. 중복 등록 방지.',
      '보유 컬럼은 assets 매칭 실시간 카운트.',
    ],
    'carmaster-maint': [
      '엔카 크롤러에 빠진 차종(화물차) 수동 보완.',
      '15년 이상 단종된 엔트리를 일괄 아카이브(soft delete).',
      'CSV 업로드 "스킵" 문제 해결 시 여기서 처리.',
    ],
    'bulk-delivery': [
      '활성 계약 중 출고 이벤트 미입력 + 시작일 도래한 차량 목록.',
      '체크박스 선택 → "선택 N건 출고 처리" 버튼으로 일괄 delivery 이벤트 생성.',
    ],
    overdue: [
      '납부일 경과 + 수납액 < 청구액인 billing 건.',
      '상단 수기 미수 등록 폼 — 자동 파생 외 예외 billing 수기 생성.',
      '연체일 30일 이상 적색, 7일 이상 황색.',
    ],
    'overdue-sync': [
      '계약 업로드 시 같이 들어온 current_overdue 값을 기준으로 billings 초기 정산.',
      '경과 회차 중 최근 N회차 → 미납, 이전 회차 → 완납으로 일괄 세팅.',
      '미래 회차(결제대기)는 건드리지 않음.',
      '최초 1회만 실행. sync 후에는 initial_overdue_synced=true 로 마킹되어 재실행 안 됨.',
      'admin 이상 권한 필요.',
    ],
    cutover: [
      '계약별 billing 수납 합계 vs 통장·카드 이벤트 합계 매칭.',
      '차이 100원 이내면 일치로 판정.',
    ],
    alimtalk: [
      '현재는 contact 이벤트 중 channel에 "알림톡/kakao" 포함된 것만 표시.',
      'Aligo 대행 API 연동 후 별도 로그 컬렉션 예정.',
    ],
    sms: [
      'contact 이벤트 중 channel이 "SMS/문자"인 항목 집계.',
      '실발송 구현 전 placeholder.',
    ],
    'data-purge': [
      '마스터 데이터(자산·계약·고객·보험 등)와 운영 이벤트(과태료·정비·출고 등)를 선택적으로 삭제.',
      '소프트 삭제: status=deleted 처리, 조회에서 제외되지만 복구 가능.',
      '완전 삭제: DB에서 영구 제거, 복구 불가. 2단계 확인 필요.',
      'admin 이상 권한 필요.',
    ],
    'mobile-inbox': [
      '모바일 /m/upload 에서 현장 직원이 올린 사진·PDF 검토함.',
      '차량번호·문서유형·업로더·메모 및 썸네일로 내용 확인.',
      '반영/반려 상태 관리. 반영 처리한 건은 일괄 불러오기 또는 개별 입력으로 수동 DB 생성 필요 (자동 OCR 반영은 추후).',
    ],
  };
  return (
    <ul style={{ paddingLeft: 18, margin: 0 }}>
      {texts[k].map((t, i) => (
        <li key={i} style={{ marginBottom: 6 }}>{t}</li>
      ))}
    </ul>
  );
}
