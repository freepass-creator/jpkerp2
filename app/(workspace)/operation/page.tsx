'use client';

/**
 * 업무관리 (v3) — 12 탭 wizard 모음.
 *
 * 디자인은 jpkerp-v3/prototype.html `data-page="journal"` 기준이며,
 * 본 페이지는 디자인 mock + option-row 토글 동작만 구현한다.
 * 실제 저장 로직은 Phase 7 이후에 붙는다.
 */

import { type ReactNode, useState } from 'react';

type SubpageId =
  | 'journal-upload'
  | 'journal-eungdae'
  | 'journal-suseon'
  | 'journal-sago'
  | 'journal-chulgo'
  | 'journal-banab'
  | 'journal-sidong'
  | 'journal-iyong'
  | 'journal-memo'
  | 'journal-yocheong'
  | 'journal-received'
  | 'journal-sent';

interface TabSpec {
  id: SubpageId;
  label: string;
  icon?: string;
  primaryAction?: string;
}

const TABS: TabSpec[] = [
  {
    id: 'journal-upload',
    label: '업로드',
    icon: 'ph-upload-simple',
    primaryAction: '+ 업로드 + 분석',
  },
  { id: 'journal-eungdae', label: '고객응대', primaryAction: '+ 응대 등록' },
  { id: 'journal-suseon', label: '차량수선', primaryAction: '+ 수선 등록' },
  { id: 'journal-sago', label: '사고접수', primaryAction: '+ 사고접수' },
  { id: 'journal-chulgo', label: '출고', primaryAction: '+ 출고 등록' },
  { id: 'journal-banab', label: '반납', primaryAction: '+ 반납 등록' },
  { id: 'journal-sidong', label: '시동제어', primaryAction: '+ 제어 실행' },
  { id: 'journal-iyong', label: '기타이용', primaryAction: '+ 이용 등록' },
  { id: 'journal-memo', label: '메모', primaryAction: '+ 메모' },
  { id: 'journal-yocheong', label: '요청등록', primaryAction: '+ 요청 발송' },
  { id: 'journal-received', label: '받은요청' },
  { id: 'journal-sent', label: '시킨요청' },
];

const TAB_CRUMB: Record<SubpageId, string> = {
  'journal-upload': '업로드',
  'journal-eungdae': '고객응대',
  'journal-suseon': '차량수선',
  'journal-sago': '사고접수',
  'journal-chulgo': '출고',
  'journal-banab': '반납',
  'journal-sidong': '시동제어',
  'journal-iyong': '기타이용',
  'journal-memo': '메모',
  'journal-yocheong': '요청등록',
  'journal-received': '받은요청',
  'journal-sent': '시킨요청',
};

export default function OperationPage() {
  const [active, setActive] = useState<SubpageId>('journal-upload');
  const activeTab = TABS.find((t) => t.id === active) ?? TABS[0];

  return (
    <>
      <div className="page-head">
        <i className="ph ph-notebook" />
        <div className="title">업무관리</div>
        <div className="crumbs">› {TAB_CRUMB[active]}</div>
      </div>

      <div className="v3-tabs">
        <div className="v3-tab-list" style={{ overflowX: 'auto', flex: 1, minWidth: 0 }}>
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`v3-tab ${active === t.id ? 'is-active' : ''}`}
              onClick={() => setActive(t.id)}
            >
              {t.icon ? <i className={`ph ${t.icon}`} /> : null}
              {t.label}
            </button>
          ))}
        </div>
        {activeTab.primaryAction && (
          <div className="action">
            <button type="button" disabled>
              {activeTab.primaryAction}
            </button>
          </div>
        )}
      </div>

      {active === 'journal-upload' && <UploadWizard />}
      {active === 'journal-eungdae' && <EungdaeWizard />}
      {active === 'journal-suseon' && <SuseonWizard />}
      {active === 'journal-sago' && <SagoWizard />}
      {active === 'journal-chulgo' && <ChulgoWizard />}
      {active === 'journal-banab' && <BanabWizard />}
      {active === 'journal-sidong' && <SidongWizard />}
      {active === 'journal-iyong' && <IyongWizard />}
      {active === 'journal-memo' && <MemoWizard />}
      {active === 'journal-yocheong' && <YocheongWizard />}
      {active === 'journal-received' && <ReceivedList />}
      {active === 'journal-sent' && <SentList />}
    </>
  );
}

/* ════════════════════════════════════════════════
   공용 토글 — option-btn group (single or multi)
   ════════════════════════════════════════════════ */

function OptionGroup({
  options,
  defaultSelected,
  multi = false,
}: {
  options: readonly string[];
  defaultSelected?: readonly string[];
  multi?: boolean;
}) {
  const [selected, setSelected] = useState<readonly string[]>(defaultSelected ?? []);
  const toggle = (opt: string) => {
    if (multi) {
      setSelected((prev) => (prev.includes(opt) ? prev.filter((x) => x !== opt) : [...prev, opt]));
    } else {
      setSelected([opt]);
    }
  };
  return (
    <div className="option-row">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          className={`option-btn ${selected.includes(opt) ? 'is-selected' : ''}`}
          onClick={() => toggle(opt)}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

/* form-row 헬퍼 */
function FormRow({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="v3-form-row">
      <div className={`label ${required ? 'required' : ''}`}>{label}</div>
      <div className="field">{children}</div>
    </div>
  );
}

/* wizard 셸 */
function WizardShell({
  icon,
  iconClass,
  title,
  desc,
  body,
  footDesc,
  footPrimary,
  footPrimaryDanger = false,
}: {
  icon: string;
  iconClass?: string;
  title: string;
  desc: string;
  body: ReactNode;
  footDesc?: ReactNode;
  footPrimary: string;
  footPrimaryDanger?: boolean;
}) {
  return (
    <div className="v3-wizard">
      <div className="v3-wizard-head">
        <i className={`ph ${icon} ico ${iconClass ?? ''}`} />
        <span className="title">{title}</span>
        <span className="desc">· {desc}</span>
      </div>
      <div className="v3-wizard-body">{body}</div>
      <div className="v3-wizard-foot">
        {footDesc && (
          <span className={`desc ${footPrimaryDanger ? 't-danger' : ''}`}>{footDesc}</span>
        )}
        <div className="actions">
          <button type="button">취소</button>
          <button type="button" className="primary">
            {footPrimary}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════
   1. 업로드 — 스마트 업로드 + 대상 + 종류 + 메모
   ════════════════════════════════════════════════ */
function UploadWizard() {
  return (
    <WizardShell
      icon="ph-upload-simple"
      title="업로드"
      desc="사진 OCR · PDF 추출 · 구글시트 임포트 · 다중 첨부"
      footDesc="업로드 후 OCR 결과를 검토 → 저장하면 해당 위저드로 자동 이동"
      footPrimary="업로드 + 분석"
      body={
        <>
          <FormRow label="입력 방식">
            <div className="smart-upload">
              <button type="button" className="upload-btn">
                <i className="ph ph-camera" />
                <span className="nm">사진</span>
                <span className="sub">OCR 자동</span>
              </button>
              <button type="button" className="upload-btn">
                <i className="ph ph-file-pdf" />
                <span className="nm">PDF/문서</span>
                <span className="sub">텍스트 추출</span>
              </button>
              <button type="button" className="upload-btn">
                <i className="ph ph-table" />
                <span className="nm">구글시트</span>
                <span className="sub">URL 임포트</span>
              </button>
              <button type="button" className="upload-btn">
                <i className="ph ph-images" />
                <span className="nm">갤러리</span>
                <span className="sub">다중 첨부</span>
              </button>
            </div>
            <div className="smart-hint">
              <i className="ph ph-magic-wand" />
              AI가 업로드 내용을 인식 → 자동 분류 (차량등록증·보험증권·과태료·견적서 등) → 해당
              위저드로 자동 라우팅
            </div>
          </FormRow>
          <FormRow label="대상 (선택)">
            <div className="picker-row">
              <input type="text" placeholder="차량·계약 (없으면 자동 매칭 시도)" />
              <button type="button" className="pick-btn">
                선택
              </button>
            </div>
          </FormRow>
          <FormRow label="업로드 종류">
            <OptionGroup
              options={[
                '자동 분류',
                '차량등록증',
                '보험증권',
                '할부스케줄',
                '과태료',
                '견적서·청구서',
                '계약서',
                '사고 사진',
                '반납 사진',
                '기타',
              ]}
              defaultSelected={['자동 분류']}
            />
          </FormRow>
          <FormRow label="메모">
            <textarea placeholder="업로드 관련 메모 (선택)" />
          </FormRow>
        </>
      }
    />
  );
}

/* ════════════════════════════════════════════════
   2. 고객응대
   ════════════════════════════════════════════════ */
function EungdaeWizard() {
  return (
    <WizardShell
      icon="ph-phone"
      title="고객응대"
      desc="통화·방문·민원·문의"
      footDesc="필수 3종 입력 완료 · 평균 30초 소요"
      footPrimary="저장"
      body={
        <>
          <FormRow label="응대 방식" required>
            <OptionGroup
              options={['전화', '방문', '문자', '이메일', '대면', '기타']}
              defaultSelected={['전화']}
            />
          </FormRow>
          <FormRow label="대상" required>
            <div className="picker-row">
              <input type="text" placeholder="계약자·차량번호·계약코드 검색" />
              <button type="button" className="pick-btn">
                선택
              </button>
            </div>
            <div className="hint">예: J0012 홍길동 / 12가 3456</div>
          </FormRow>
          <FormRow label="주제" required>
            <OptionGroup
              options={['미납독촉', '갱신문의', '사고문의', '서류요청', '신규문의', '민원', '기타']}
              defaultSelected={['미납독촉']}
            />
          </FormRow>
          <FormRow label="조치">
            <OptionGroup
              options={['안내완료', '재연락약속', '입금약속', '담당자전달', '서류발송']}
              defaultSelected={['재연락약속', '입금약속']}
              multi
            />
          </FormRow>
          <FormRow label="메모">
            <textarea
              placeholder="결과·다음 액션 메모 (선택)"
              defaultValue="4-30 입금 약속, 미입금시 시동제어 예정"
            />
          </FormRow>
        </>
      }
    />
  );
}

/* ════════════════════════════════════════════════
   3. 차량수선
   ════════════════════════════════════════════════ */
function SuseonWizard() {
  return (
    <WizardShell
      icon="ph-wrench"
      title="차량수선"
      desc="정비·수리·상품화·외관관리"
      footDesc="사진 첨부 권장"
      footPrimary="저장"
      body={
        <>
          <FormRow label="수선 종류" required>
            <OptionGroup
              options={['정기정비', '고장수리', '사고수리', '외관관리', '상품화', '점검만', '기타']}
              defaultSelected={['정기정비']}
            />
          </FormRow>
          <FormRow label="차량" required>
            <div className="picker-row">
              <input type="text" placeholder="차량번호 검색" defaultValue="34나 5678" />
              <button type="button" className="pick-btn">
                선택
              </button>
            </div>
          </FormRow>
          <FormRow label="정비소">
            <OptionGroup
              options={['한국정비', '강남자동차정비', '토탈오토케어', '+ 신규']}
              defaultSelected={['한국정비']}
            />
          </FormRow>
          <FormRow label="내역">
            <input type="text" defaultValue="엔진오일 교체" placeholder="작업 내역" />
          </FormRow>
          <FormRow label="비용">
            <input type="text" defaultValue="80,000" placeholder="원" />
          </FormRow>
          <FormRow label="결과">
            <OptionGroup
              options={['완료', '진행중', '미수리 복귀', '견적 대기']}
              defaultSelected={['완료']}
            />
          </FormRow>
          <FormRow label="사진·메모">
            <textarea placeholder="작업 사진 첨부 또는 추가 메모" />
          </FormRow>
        </>
      }
    />
  );
}

/* ════════════════════════════════════════════════
   4. 사고접수
   ════════════════════════════════════════════════ */
function SagoWizard() {
  return (
    <WizardShell
      icon="ph-warning"
      iconClass="danger"
      title="사고접수"
      desc="사건 발생 + 보험접수"
      footDesc="사진 첨부 필수 — 보험금 청구 근거"
      footPrimary="저장"
      body={
        <>
          <FormRow label="차량/계약" required>
            <div className="picker-row">
              <input type="text" placeholder="차량번호·계약코드" />
              <button type="button" className="pick-btn">
                선택
              </button>
            </div>
          </FormRow>
          <FormRow label="발생일시" required>
            <input type="datetime-local" defaultValue="2026-04-25T11:00" />
          </FormRow>
          <FormRow label="사고 장소">
            <input type="text" placeholder="주소 또는 위치" />
          </FormRow>
          <FormRow label="사고 종류" required>
            <OptionGroup
              options={['단독', '쌍방', '주차사고', '추돌', '도난', '침수', '기타']}
              defaultSelected={['쌍방']}
            />
          </FormRow>
          <FormRow label="상대 정보">
            <input type="text" placeholder="상대 차량번호·연락처·과실비율" />
          </FormRow>
          <FormRow label="보험 처리" required>
            <OptionGroup options={['자차', '대물', '자손', '미신청']} defaultSelected={['자차']} />
          </FormRow>
          <FormRow label="접수번호">
            <input type="text" placeholder="보험사 접수번호" />
          </FormRow>
          <FormRow label="사진·메모">
            <textarea placeholder="사고 사진 첨부 + 경위 메모" />
          </FormRow>
        </>
      }
    />
  );
}

/* ════════════════════════════════════════════════
   5. 출고
   ════════════════════════════════════════════════ */
function ChulgoWizard() {
  return (
    <WizardShell
      icon="ph-paper-plane-tilt"
      title="출고"
      desc="인도 체크리스트 (계약 시작)"
      footDesc="사진은 반납 정산 기준이 됩니다"
      footPrimary="출고 완료"
      body={
        <>
          <FormRow label="계약" required>
            <div className="picker-row">
              <input type="text" placeholder="계약 검색" />
              <button type="button" className="pick-btn">
                선택
              </button>
            </div>
          </FormRow>
          <FormRow label="출고일자" required>
            <input type="date" defaultValue="2026-04-25" />
          </FormRow>
          <FormRow label="출고지 → 인도지">
            <div className="picker-row">
              <input type="text" placeholder="차고지 A" defaultValue="차고지 A" />
              <input type="text" placeholder="고객 인도지" />
            </div>
          </FormRow>
          <FormRow label="주행거리" required>
            <input type="text" placeholder="km" />
          </FormRow>
          <FormRow label="연료 상태">
            <OptionGroup
              options={['가득', '3/4', '1/2', '1/4', '부족']}
              defaultSelected={['가득']}
            />
          </FormRow>
          <FormRow label="체크리스트">
            <OptionGroup
              options={['키 2개', '매뉴얼', '블랙박스 정상', '외관 양호', '손상 (사진)']}
              defaultSelected={['키 2개', '매뉴얼', '블랙박스 정상', '외관 양호']}
              multi
            />
          </FormRow>
          <FormRow label="인도 사진">
            <textarea placeholder="외관·내부·주행거리 사진 (3~5장)" />
          </FormRow>
        </>
      }
    />
  );
}

/* ════════════════════════════════════════════════
   6. 반납
   ════════════════════════════════════════════════ */
function BanabWizard() {
  return (
    <WizardShell
      icon="ph-tray-arrow-down"
      title="반납"
      desc="정산 + 사유 4종"
      footDesc="정산서 PDF 자동 생성"
      footPrimary="반납 완료 + 정산서"
      body={
        <>
          <FormRow label="계약" required>
            <div className="picker-row">
              <input type="text" placeholder="계약 검색" />
              <button type="button" className="pick-btn">
                선택
              </button>
            </div>
          </FormRow>
          <FormRow label="반납 사유" required>
            <OptionGroup
              options={['정산반납 (만기)', '해지반납 (중도)', '강제회수 (잠수)', '기타회수']}
              defaultSelected={['정산반납 (만기)']}
            />
          </FormRow>
          <FormRow label="반납일자" required>
            <input type="date" defaultValue="2026-04-25" />
          </FormRow>
          <FormRow label="반납 주행" required>
            <input type="text" placeholder="km" />
          </FormRow>
          <FormRow label="연료 상태">
            <OptionGroup
              options={['가득', '3/4', '1/2', '1/4', '부족']}
              defaultSelected={['1/2']}
            />
          </FormRow>
          <FormRow label="손상 내역">
            <textarea placeholder="외관 흠집·내부 오염·파손 부위 (사진 첨부)" />
          </FormRow>
          <FormRow label="추가 청구">
            <OptionGroup options={['과주행료', '연료 부족', '손상 청구', '청소비']} multi />
            <div className="hint">선택 시 정산서에 자동 반영</div>
          </FormRow>
          <FormRow label="보증금">
            <input type="text" defaultValue="1,000,000 → 920,000 환급" placeholder="환급액" />
          </FormRow>
        </>
      }
    />
  );
}

/* ════════════════════════════════════════════════
   7. 시동제어
   ════════════════════════════════════════════════ */
function SidongWizard() {
  return (
    <WizardShell
      icon="ph-lock"
      iconClass="danger"
      title="시동제어"
      desc="미납 차량 원격 제어/해제"
      footDesc="⚠ GPS 장비로 즉시 실행됩니다"
      footPrimaryDanger
      footPrimary="실행"
      body={
        <>
          <FormRow label="대상" required>
            <div className="picker-row">
              <input type="text" placeholder="차량번호·계약자" />
              <button type="button" className="pick-btn">
                선택
              </button>
            </div>
          </FormRow>
          <FormRow label="동작" required>
            <OptionGroup options={['시동 제어', '제어 해제']} defaultSelected={['시동 제어']} />
          </FormRow>
          <FormRow label="사유" required>
            <OptionGroup
              options={['미납 60일+', '무단 운행', '납부 완료', '계약 해지']}
              defaultSelected={['미납 60일+']}
            />
          </FormRow>
          <FormRow label="메모">
            <textarea placeholder="고객 통보 여부·기타 메모" />
          </FormRow>
        </>
      }
    />
  );
}

/* ════════════════════════════════════════════════
   8. 기타이용
   ════════════════════════════════════════════════ */
function IyongWizard() {
  return (
    <WizardShell
      icon="ph-van"
      title="기타이용"
      desc="시승·세차·재배치·점검"
      footPrimary="저장"
      body={
        <>
          <FormRow label="이용 종류" required>
            <OptionGroup
              options={['시승', '세차', '주유', '차고지 재배치', '직원 출장', '기타']}
              defaultSelected={['시승']}
            />
          </FormRow>
          <FormRow label="차량" required>
            <div className="picker-row">
              <input type="text" placeholder="차량번호 검색" />
              <button type="button" className="pick-btn">
                선택
              </button>
            </div>
          </FormRow>
          <FormRow label="출발 → 도착">
            <div className="picker-row">
              <input type="text" placeholder="출발지" defaultValue="차고지 A" />
              <input type="text" placeholder="도착지" />
            </div>
          </FormRow>
          <FormRow label="메모">
            <textarea placeholder="이유·결과 메모" />
          </FormRow>
        </>
      }
    />
  );
}

/* ════════════════════════════════════════════════
   9. 메모
   ════════════════════════════════════════════════ */
function MemoWizard() {
  return (
    <WizardShell
      icon="ph-clipboard-text"
      title="메모"
      desc="자유 메모 + 첨부"
      footPrimary="저장"
      body={
        <>
          <FormRow label="대상 (선택)">
            <div className="picker-row">
              <input type="text" placeholder="차량·계약 (없어도 됨)" />
              <button type="button" className="pick-btn">
                선택
              </button>
            </div>
          </FormRow>
          <FormRow label="제목" required>
            <input type="text" placeholder="메모 제목" />
          </FormRow>
          <FormRow label="내용">
            <textarea placeholder="자유롭게" style={{ height: 120 }} />
          </FormRow>
          <FormRow label="첨부">
            <OptionGroup options={['파일 선택', '사진 촬영']} multi />
          </FormRow>
        </>
      }
    />
  );
}

/* ════════════════════════════════════════════════
   10. 요청등록
   ════════════════════════════════════════════════ */
function YocheongWizard() {
  return (
    <WizardShell
      icon="ph-envelope"
      title="요청 등록"
      desc="직원에게 업무 지시 / 협조 요청"
      footDesc="받는 사람 일지에 자동 표시"
      footPrimary="요청 발송"
      body={
        <>
          <FormRow label="받는 사람" required>
            <OptionGroup
              options={['박과장 (정비)', '이대리 (회계)', '최주임 (영업)', '정상무 (관리)']}
              defaultSelected={['이대리 (회계)']}
            />
          </FormRow>
          <FormRow label="요청 내용" required>
            <input
              type="text"
              placeholder="간단한 요청 제목"
              defaultValue="4월 미납 회원사별 정리"
            />
          </FormRow>
          <FormRow label="관련 대상">
            <div className="picker-row">
              <input type="text" placeholder="차량·계약 (선택)" />
              <button type="button" className="pick-btn">
                선택
              </button>
            </div>
          </FormRow>
          <FormRow label="마감" required>
            <input type="date" defaultValue="2026-04-28" />
          </FormRow>
          <FormRow label="우선순위">
            <OptionGroup options={['낮음', '보통', '높음', '긴급']} defaultSelected={['보통']} />
          </FormRow>
          <FormRow label="상세">
            <textarea placeholder="상세 내용·기준·참고사항" />
          </FormRow>
        </>
      }
    />
  );
}

/* ════════════════════════════════════════════════
   11. 받은요청 — list
   ════════════════════════════════════════════════ */
interface ReqRow {
  date: string;
  who: string;
  text: string;
  rel: string;
  relMuted?: boolean;
  due: string;
  dueClass?: 't-danger' | 't-warn' | 't-muted';
  status: '진행중' | '완료' | '지연';
}

const RECEIVED_ROWS: ReqRow[] = [
  {
    date: '2026-04-22',
    who: '사장',
    text: '매각건 알아보기 — 수익성 분석 후 보고',
    rel: '78라 9012',
    due: 'D-1',
    dueClass: 't-danger',
    status: '진행중',
  },
  {
    date: '2026-04-21',
    who: '전무',
    text: 'J01 회원사 4월 결산 보고서',
    rel: 'J01 전체',
    relMuted: true,
    due: 'D-3',
    dueClass: 't-warn',
    status: '진행중',
  },
  {
    date: '2026-04-19',
    who: '김상무',
    text: '홍길동 미납건 추심 진행',
    rel: '12가 3456',
    due: 'D-7',
    status: '진행중',
  },
  {
    date: '2026-04-15',
    who: '사장',
    text: '3월 자금 결산 보고',
    rel: '전체',
    relMuted: true,
    due: '완료',
    dueClass: 't-muted',
    status: '완료',
  },
  {
    date: '2026-04-12',
    who: '전무',
    text: 'J03 신규 거래 제안서',
    rel: 'J03',
    relMuted: true,
    due: '완료',
    dueClass: 't-muted',
    status: '완료',
  },
];

function ReceivedList() {
  return (
    <div className="v3-subpage is-active">
      <div className="v3-alerts">
        <div className="v3-alerts-head">
          <span className="dot" />
          <span className="title">받은 요청</span>
          <span className="count">· 진행 3건 · 완료 12건</span>
        </div>
      </div>

      <div className="v3-filter-bar">
        <select defaultValue="">
          <option value="">상태 전체</option>
          <option>진행중</option>
          <option>완료</option>
          <option>취소</option>
        </select>
        <select defaultValue="">
          <option value="">요청자 전체</option>
          <option>사장</option>
          <option>전무</option>
          <option>김상무</option>
        </select>
        <select defaultValue="30">
          <option value="30">기간 30일</option>
          <option value="90">90일</option>
          <option value="all">전체</option>
        </select>
        <div className="v3-search">
          <input type="text" placeholder="내용 검색" />
        </div>
      </div>

      <div className="v3-table-wrap">
        <table className="v3-table">
          <thead>
            <tr>
              <th className="center" style={{ width: 32 }}>
                #
              </th>
              <th style={{ width: 96 }}>접수일</th>
              <th style={{ width: 80 }}>요청자</th>
              <th>요청 내용</th>
              <th style={{ width: 110 }}>관련 대상</th>
              <th style={{ width: 80 }}>마감</th>
              <th style={{ width: 80 }}>상태</th>
            </tr>
          </thead>
          <tbody>
            {RECEIVED_ROWS.map((r, i) => (
              <tr key={`${r.date}-${r.who}-${r.text}`}>
                <td className="center t-muted">{i + 1}</td>
                <td className="num">{r.date}</td>
                <td>{r.who}</td>
                <td>{r.text}</td>
                <td className={r.relMuted ? 't-muted' : 'car-num'}>{r.rel}</td>
                <td className={`num ${r.dueClass ?? ''}`}>{r.due}</td>
                <td>
                  <span
                    className={`tag ${r.status === '완료' ? 'active' : r.status === '지연' ? 'sale' : 'repair'}`}
                  >
                    {r.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="v3-table-foot">
        <div>최근 30일 15건 · 진행중 3 · 완료 12 · 평균 처리 4.2일</div>
        <div style={{ color: 'var(--c-text-muted)' }}>(mock 데이터)</div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════
   12. 시킨요청 — list
   ════════════════════════════════════════════════ */
const SENT_ROWS: ReqRow[] = [
  {
    date: '2026-04-24',
    who: '박과장',
    text: '외관사진 다시 촬영 (조명 문제)',
    rel: '90마 3456',
    due: 'D-1',
    dueClass: 't-danger',
    status: '진행중',
  },
  {
    date: '2026-04-23',
    who: '이대리',
    text: '4월 미납 회원사별 정리',
    rel: '전체',
    relMuted: true,
    due: 'D-3',
    dueClass: 't-warn',
    status: '진행중',
  },
  {
    date: '2026-04-22',
    who: '최주임',
    text: 'J0033 사고 보험금 청구 진행',
    rel: 'J0033',
    due: 'D-7',
    status: '진행중',
  },
  {
    date: '2026-04-20',
    who: '박과장',
    text: '78라9012 정비 견적 받기',
    rel: '78라 9012',
    due: 'D+2 지연',
    dueClass: 't-danger',
    status: '지연',
  },
  {
    date: '2026-04-18',
    who: '이대리',
    text: '3월 카드매출 정산 대조',
    rel: '—',
    relMuted: true,
    due: '완료',
    dueClass: 't-muted',
    status: '완료',
  },
];

function SentList() {
  return (
    <div className="v3-subpage is-active">
      <div className="v3-alerts">
        <div className="v3-alerts-head">
          <span className="dot" />
          <span className="title">내가 시킨 요청</span>
          <span className="count">· 진행 5건 · 완료 23건</span>
        </div>
      </div>

      <div className="v3-filter-bar">
        <select defaultValue="">
          <option value="">상태 전체</option>
          <option>진행중</option>
          <option>완료</option>
          <option>지연</option>
        </select>
        <select defaultValue="">
          <option value="">받는사람 전체</option>
          <option>박과장</option>
          <option>이대리</option>
          <option>최주임</option>
        </select>
        <select defaultValue="30">
          <option value="30">기간 30일</option>
          <option value="90">90일</option>
        </select>
        <div className="v3-search">
          <input type="text" placeholder="내용 검색" />
        </div>
      </div>

      <div className="v3-table-wrap">
        <table className="v3-table">
          <thead>
            <tr>
              <th className="center" style={{ width: 32 }}>
                #
              </th>
              <th style={{ width: 96 }}>지시일</th>
              <th style={{ width: 80 }}>받는사람</th>
              <th>지시 내용</th>
              <th style={{ width: 110 }}>관련 대상</th>
              <th style={{ width: 80 }}>마감</th>
              <th style={{ width: 80 }}>상태</th>
            </tr>
          </thead>
          <tbody>
            {SENT_ROWS.map((r, i) => (
              <tr key={`${r.date}-${r.who}-${r.text}`}>
                <td className="center t-muted">{i + 1}</td>
                <td className="num">{r.date}</td>
                <td>{r.who}</td>
                <td>{r.text}</td>
                <td className={r.relMuted ? 't-muted' : 'car-num'}>{r.rel}</td>
                <td className={`num ${r.dueClass ?? ''}`}>{r.due}</td>
                <td>
                  <span
                    className={`tag ${r.status === '완료' ? 'active' : r.status === '지연' ? 'sale' : 'repair'}`}
                  >
                    {r.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="v3-table-foot">
        <div>최근 30일 28건 · 진행중 5 · 완료 23 · 지연 1 · 평균 처리 3.1일</div>
        <div style={{ color: 'var(--c-text-muted)' }}>(mock 데이터)</div>
      </div>
    </div>
  );
}
