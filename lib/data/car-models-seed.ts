/**
 * 한국 시장 차종 마스터 시드 데이터 (스펙 포함).
 * 개발도구/차종 마스터의 "한국 차종 시드" 및 "스펙 보완" 버튼 소스.
 *
 * 스펙 기준 (베이스/최빈 트림):
 *   displacement: cc (EV/수소는 생략)
 *   seats: 승차정원 (일반 5, 트럭 2-3, 카니발·스타리아 9-11)
 *   battery_kwh: EV/하이브리드 배터리 용량
 */
export interface CarModelSeed {
  maker: string;
  model: string;
  sub: string;
  year_start: string;
  year_end: string;
  code?: string;
  category: string;
  fuel_type?: string;
  displacement?: number;
  seats?: number;
  battery_kwh?: number;
}

const DOMESTIC_MAKERS = new Set(['현대', '기아', '제네시스', '르노', 'KGM', '쌍용', '쉐보레']);
export function inferOrigin(maker: string): '국산' | '수입' {
  return DOMESTIC_MAKERS.has(maker.trim()) ? '국산' : '수입';
}
export function inferPowertrain(category: string): '내연' | '하이브리드' | '전기' | '수소' {
  if (/EV/i.test(category)) return '전기';
  if (/수소/.test(category)) return '수소';
  if (/하이브리드/.test(category)) return '하이브리드';
  return '내연';
}
/** "2022" → "22-" · "1999" → "99-" */
export function toYearSuffix(year_start: string | number): string {
  const s = String(year_start);
  const yy = s.length === 4 ? s.slice(2) : s;
  return `${yy}-`;
}

/** 세부모델 + 연식 suffix 결합 ("니로 SG2" + "2022" → "니로 SG2 22-") */
export function subWithYear(sub: string, year_start: string | number): string {
  return `${sub} ${toYearSuffix(year_start)}`;
}

export function inferFuel(category: string): string | undefined {
  if (/EV/i.test(category)) return '전기';
  if (/수소/.test(category)) return '수소';
  if (/하이브리드/.test(category)) return '하이브리드';
  // 내연기관 — 트럭·MPV·대형 SUV는 디젤이 주류, 나머지는 가솔린 기본
  if (/트럭/.test(category)) return '디젤';
  if (/MPV/.test(category)) return '디젤';
  if (/대형 SUV/.test(category)) return '디젤';
  return '가솔린';
}

export const KOREAN_CAR_MODELS: CarModelSeed[] = [
  // 기아
  { maker: '기아', model: '니로', sub: '니로 SG2', year_start: '2022', year_end: '현재', code: 'SG2', category: '소형 SUV', displacement: 1580, seats: 5, battery_kwh: 1.32 },
  { maker: '기아', model: '니로', sub: '니로 EV SG2', year_start: '2022', year_end: '현재', code: 'SG2', category: '소형 EV', seats: 5, battery_kwh: 64.8 },
  { maker: '기아', model: '레이', sub: '레이 TAM', year_start: '2011', year_end: '2017', code: 'TAM', category: '경차', displacement: 998, seats: 5 },
  { maker: '기아', model: '레이', sub: '더 뉴 레이 TAM (페리)', year_start: '2017', year_end: '2022', code: 'TAM', category: '경차', displacement: 999, seats: 5 },
  { maker: '기아', model: '레이', sub: '더 뉴 기아 레이 TAM (페리2)', year_start: '2022', year_end: '현재', code: 'TAM', category: '경차', displacement: 999, seats: 5 },
  { maker: '기아', model: '모닝', sub: '모닝 JA', year_start: '2017', year_end: '2020', code: 'JA', category: '경차', displacement: 999, seats: 5 },
  { maker: '기아', model: '모닝', sub: '더 뉴 모닝 JA (페리)', year_start: '2020', year_end: '2023', code: 'JA', category: '경차', displacement: 999, seats: 5 },
  { maker: '기아', model: '모닝', sub: '더 뉴 기아 모닝 JA (페리2)', year_start: '2023', year_end: '현재', code: 'JA', category: '경차', displacement: 999, seats: 5 },
  { maker: '기아', model: '셀토스', sub: '셀토스 SP2', year_start: '2019', year_end: '2022', code: 'SP2', category: '소형 SUV', displacement: 1598, seats: 5 },
  { maker: '기아', model: '셀토스', sub: '더 뉴 셀토스 SP2 (페리)', year_start: '2022', year_end: '현재', code: 'SP2', category: '소형 SUV', displacement: 1598, seats: 5 },
  { maker: '기아', model: '쏘렌토', sub: '쏘렌토 MQ4', year_start: '2020', year_end: '2023', code: 'MQ4', category: '중형 SUV', displacement: 2199, seats: 7 },
  { maker: '기아', model: '쏘렌토', sub: '더 뉴 쏘렌토 MQ4 (페리)', year_start: '2023', year_end: '현재', code: 'MQ4', category: '중형 SUV', displacement: 2199, seats: 7 },
  { maker: '기아', model: '쏘렌토', sub: '쏘렌토 UM', year_start: '2014', year_end: '2017', code: 'UM', category: '중형 SUV', displacement: 2199, seats: 7 },
  { maker: '기아', model: '쏘렌토', sub: '더 뉴 쏘렌토 UM (페리)', year_start: '2017', year_end: '2020', code: 'UM', category: '중형 SUV', displacement: 2199, seats: 7 },
  { maker: '기아', model: '스포티지', sub: '스포티지 NQ5', year_start: '2021', year_end: '2024', code: 'NQ5', category: '준중형 SUV', displacement: 1598, seats: 5 },
  { maker: '기아', model: '스포티지', sub: '더 뉴 스포티지 NQ5 (페리)', year_start: '2024', year_end: '현재', code: 'NQ5', category: '준중형 SUV', displacement: 1598, seats: 5 },
  { maker: '기아', model: '스포티지', sub: '스포티지 QL', year_start: '2015', year_end: '2018', code: 'QL', category: '준중형 SUV', displacement: 1591, seats: 5 },
  { maker: '기아', model: '스포티지', sub: '스포티지 더 볼드 QL (페리)', year_start: '2018', year_end: '2021', code: 'QL', category: '준중형 SUV', displacement: 1591, seats: 5 },
  { maker: '기아', model: '스팅어', sub: '스팅어 CK', year_start: '2017', year_end: '2020', code: 'CK', category: '스포츠 세단', displacement: 1998, seats: 5 },
  { maker: '기아', model: '스팅어', sub: '스팅어 마이스터 CK (페리)', year_start: '2020', year_end: '2023', code: 'CK', category: '스포츠 세단', displacement: 2497, seats: 5 },
  { maker: '기아', model: '카니발', sub: '카니발 KA4', year_start: '2020', year_end: '2023', code: 'KA4', category: '대형 MPV', displacement: 2151, seats: 9 },
  { maker: '기아', model: '카니발', sub: '더 뉴 카니발 KA4 (페리)', year_start: '2023', year_end: '현재', code: 'KA4', category: '대형 MPV', displacement: 2151, seats: 9 },
  { maker: '기아', model: '카니발', sub: '카니발 YP', year_start: '2014', year_end: '2018', code: 'YP', category: '대형 MPV', displacement: 2199, seats: 9 },
  { maker: '기아', model: '카니발', sub: '더 뉴 카니발 YP (페리)', year_start: '2018', year_end: '2020', code: 'YP', category: '대형 MPV', displacement: 2199, seats: 9 },
  { maker: '기아', model: 'K3', sub: 'K3 BD', year_start: '2018', year_end: '2021', code: 'BD', category: '준중형 세단', displacement: 1591, seats: 5 },
  { maker: '기아', model: 'K3', sub: '더 뉴 K3 BD (페리)', year_start: '2021', year_end: '2024', code: 'BD', category: '준중형 세단', displacement: 1591, seats: 5 },
  { maker: '기아', model: 'K5', sub: 'K5 DL3', year_start: '2019', year_end: '2023', code: 'DL3', category: '중형 세단', displacement: 1999, seats: 5 },
  { maker: '기아', model: 'K5', sub: '더 뉴 K5 DL3 (페리)', year_start: '2023', year_end: '현재', code: 'DL3', category: '중형 세단', displacement: 1999, seats: 5 },
  { maker: '기아', model: 'K5', sub: 'K5 JF', year_start: '2015', year_end: '2018', code: 'JF', category: '중형 세단', displacement: 1999, seats: 5 },
  { maker: '기아', model: 'K5', sub: '더 뉴 K5 JF (페리)', year_start: '2018', year_end: '2019', code: 'JF', category: '중형 세단', displacement: 1999, seats: 5 },
  { maker: '기아', model: 'K8', sub: 'K8 GL3', year_start: '2021', year_end: '2024', code: 'GL3', category: '준대형 세단', displacement: 2497, seats: 5 },
  { maker: '기아', model: 'K8', sub: '더 뉴 K8 GL3 (페리)', year_start: '2024', year_end: '현재', code: 'GL3', category: '준대형 세단', displacement: 2497, seats: 5 },
  { maker: '기아', model: 'K9', sub: 'K9 RJ', year_start: '2018', year_end: '2021', code: 'RJ', category: '대형 세단', displacement: 3342, seats: 5 },
  { maker: '기아', model: 'K9', sub: '더 뉴 K9 RJ (페리)', year_start: '2021', year_end: '현재', code: 'RJ', category: '대형 세단', displacement: 3470, seats: 5 },
  { maker: '기아', model: 'EV3', sub: 'EV3 SV1', year_start: '2024', year_end: '현재', code: 'SV1', category: '소형 EV SUV', seats: 5, battery_kwh: 81.4 },
  { maker: '기아', model: 'EV6', sub: 'EV6 CV', year_start: '2021', year_end: '2024', code: 'CV', category: '준중형 EV', seats: 5, battery_kwh: 77.4 },
  { maker: '기아', model: 'EV6', sub: '더 뉴 EV6 CV (페리)', year_start: '2024', year_end: '현재', code: 'CV', category: '준중형 EV', seats: 5, battery_kwh: 84 },
  { maker: '기아', model: 'EV9', sub: 'EV9 MV', year_start: '2023', year_end: '현재', code: 'MV', category: '대형 EV SUV', seats: 7, battery_kwh: 99.8 },
  { maker: '기아', model: '봉고3', sub: '봉고3 PU', year_start: '2004', year_end: '현재', code: 'PU', category: '소형 트럭', displacement: 2497, seats: 3 },
  { maker: '기아', model: '봉고3', sub: '봉고3 EV PU EV', year_start: '2020', year_end: '현재', code: 'PU', category: '소형 EV 트럭', seats: 3, battery_kwh: 58.8 },
  { maker: '기아', model: '타스만', sub: '타스만 TK', year_start: '2025', year_end: '현재', code: 'TK', category: '픽업트럭', displacement: 2497, seats: 5 },

  // 르노
  { maker: '르노', model: '아르카나', sub: '아르카나 LJB', year_start: '2024', year_end: '현재', code: 'LJB', category: '소형 SUV', displacement: 1598, seats: 5 },
  { maker: '르노', model: '콜레오스', sub: '그랑 콜레오스 OV6', year_start: '2024', year_end: '현재', code: 'OV6', category: '중형 SUV', displacement: 1998, seats: 5 },
  { maker: '르노', model: 'QM6', sub: 'QM6 HZG', year_start: '2016', year_end: '현재', code: 'HZG', category: '중형 SUV', displacement: 1998, seats: 5 },
  { maker: '르노', model: 'SM6', sub: 'SM6 LFD', year_start: '2016', year_end: '현재', code: 'LFD', category: '중형 세단', displacement: 1998, seats: 5 },
  { maker: '르노', model: 'XM3', sub: 'XM3 LJB', year_start: '2020', year_end: '2024', code: 'LJB', category: '소형 SUV', displacement: 1598, seats: 5 },

  // 제네시스
  { maker: '제네시스', model: 'G70', sub: 'G70 IK', year_start: '2017', year_end: '2020', code: 'IK', category: '중형 세단', displacement: 1998, seats: 5 },
  { maker: '제네시스', model: 'G70', sub: '더 뉴 G70 IK (페리)', year_start: '2020', year_end: '현재', code: 'IK', category: '중형 세단', displacement: 2497, seats: 5 },
  { maker: '제네시스', model: 'G80', sub: 'G80 DH 페리', year_start: '2016', year_end: '2020', code: 'DH', category: '준대형 세단', displacement: 3342, seats: 5 },
  { maker: '제네시스', model: 'G80', sub: 'G80 RG3', year_start: '2020', year_end: '2023', code: 'RG3', category: '준대형 세단', displacement: 2497, seats: 5 },
  { maker: '제네시스', model: 'G80', sub: '더 뉴 G80 RG3 (페리)', year_start: '2023', year_end: '현재', code: 'RG3', category: '준대형 세단', displacement: 2497, seats: 5 },
  { maker: '제네시스', model: 'G90', sub: 'G90 HI', year_start: '2015', year_end: '2018', code: 'HI', category: '대형 세단', displacement: 3342, seats: 5 },
  { maker: '제네시스', model: 'G90', sub: '더 뉴 G90 HI (페리)', year_start: '2018', year_end: '2021', code: 'HI', category: '대형 세단', displacement: 3342, seats: 5 },
  { maker: '제네시스', model: 'G90', sub: 'G90 RS4', year_start: '2021', year_end: '현재', code: 'RS4', category: '대형 세단', displacement: 3470, seats: 5 },
  { maker: '제네시스', model: 'GV60', sub: 'GV60 JW1', year_start: '2021', year_end: '현재', code: 'JW1', category: '준중형 EV SUV', seats: 5, battery_kwh: 77.4 },
  { maker: '제네시스', model: 'GV70', sub: 'GV70 JK1', year_start: '2020', year_end: '2024', code: 'JK1', category: '중형 SUV', displacement: 2497, seats: 5 },
  { maker: '제네시스', model: 'GV70', sub: '더 뉴 GV70 JK1 (페리)', year_start: '2024', year_end: '현재', code: 'JK1', category: '중형 SUV', displacement: 2497, seats: 5 },
  { maker: '제네시스', model: 'GV80', sub: 'GV80 JX1', year_start: '2020', year_end: '2023', code: 'JX1', category: '준대형 SUV', displacement: 2497, seats: 5 },
  { maker: '제네시스', model: 'GV80', sub: '더 뉴 GV80 JX1 (페리)', year_start: '2023', year_end: '현재', code: 'JX1', category: '준대형 SUV', displacement: 3470, seats: 5 },

  // 현대
  { maker: '현대', model: '그랜저', sub: '그랜저 GN7', year_start: '2022', year_end: '현재', code: 'GN7', category: '준대형 세단', displacement: 2497, seats: 5 },
  { maker: '현대', model: '그랜저', sub: '그랜저 IG', year_start: '2016', year_end: '2019', code: 'IG', category: '준대형 세단', displacement: 2497, seats: 5 },
  { maker: '현대', model: '그랜저', sub: '더 뉴 그랜저 IG (페리)', year_start: '2019', year_end: '2022', code: 'IG', category: '준대형 세단', displacement: 2497, seats: 5 },
  { maker: '현대', model: '넥쏘', sub: '넥쏘 FE', year_start: '2018', year_end: '현재', code: 'FE', category: '수소 SUV', seats: 5 },
  { maker: '현대', model: '싼타페', sub: '싼타페 MX5', year_start: '2023', year_end: '현재', code: 'MX5', category: '중형 SUV', displacement: 2497, seats: 7 },
  { maker: '현대', model: '싼타페', sub: '싼타페 TM', year_start: '2018', year_end: '2020', code: 'TM', category: '중형 SUV', displacement: 2199, seats: 7 },
  { maker: '현대', model: '싼타페', sub: '더 뉴 싼타페 TM (페리)', year_start: '2020', year_end: '2023', code: 'TM', category: '중형 SUV', displacement: 2199, seats: 7 },
  { maker: '현대', model: '쏘나타', sub: '쏘나타 DN8', year_start: '2019', year_end: '2023', code: 'DN8', category: '중형 세단', displacement: 1999, seats: 5 },
  { maker: '현대', model: '쏘나타', sub: '쏘나타 디 엣지 DN8 (페리)', year_start: '2023', year_end: '현재', code: 'DN8', category: '중형 세단', displacement: 1999, seats: 5 },
  { maker: '현대', model: '쏘나타', sub: '쏘나타 뉴 라이즈 LF (페리)', year_start: '2017', year_end: '2019', code: 'LF', category: '중형 세단', displacement: 1999, seats: 5 },
  { maker: '현대', model: '아반떼', sub: '아반떼 AD', year_start: '2015', year_end: '2018', code: 'AD', category: '준중형 세단', displacement: 1591, seats: 5 },
  { maker: '현대', model: '아반떼', sub: '더 뉴 아반떼 AD (페리)', year_start: '2018', year_end: '2020', code: 'AD', category: '준중형 세단', displacement: 1591, seats: 5 },
  { maker: '현대', model: '아반떼', sub: '아반떼 CN7', year_start: '2020', year_end: '2023', code: 'CN7', category: '준중형 세단', displacement: 1598, seats: 5 },
  { maker: '현대', model: '아반떼', sub: '더 뉴 아반떼 CN7 (페리)', year_start: '2023', year_end: '현재', code: 'CN7', category: '준중형 세단', displacement: 1598, seats: 5 },
  { maker: '현대', model: '아이오닉5', sub: '아이오닉5 NE', year_start: '2021', year_end: '2024', code: 'NE', category: '준중형 EV', seats: 5, battery_kwh: 77.4 },
  { maker: '현대', model: '아이오닉5', sub: '더 뉴 아이오닉5 NE (페리)', year_start: '2024', year_end: '현재', code: 'NE', category: '준중형 EV', seats: 5, battery_kwh: 84 },
  { maker: '현대', model: '아이오닉6', sub: '아이오닉6 CE', year_start: '2022', year_end: '현재', code: 'CE', category: '중형 EV 세단', seats: 5, battery_kwh: 77.4 },
  { maker: '현대', model: '코나', sub: '코나 OS', year_start: '2017', year_end: '2020', code: 'OS', category: '소형 SUV', displacement: 1591, seats: 5 },
  { maker: '현대', model: '코나', sub: '더 뉴 코나 OS (페리)', year_start: '2020', year_end: '2023', code: 'OS', category: '소형 SUV', displacement: 1591, seats: 5 },
  { maker: '현대', model: '코나', sub: '코나 SX2', year_start: '2023', year_end: '현재', code: 'SX2', category: '소형 SUV', displacement: 1598, seats: 5 },
  { maker: '현대', model: '투싼', sub: '투싼 NX4', year_start: '2020', year_end: '2023', code: 'NX4', category: '준중형 SUV', displacement: 1598, seats: 5 },
  { maker: '현대', model: '투싼', sub: '더 뉴 투싼 NX4 (페리)', year_start: '2023', year_end: '현재', code: 'NX4', category: '준중형 SUV', displacement: 1598, seats: 5 },
  { maker: '현대', model: '투싼', sub: '투싼 TL (페리)', year_start: '2018', year_end: '2020', code: 'TL', category: '준중형 SUV', displacement: 1999, seats: 5 },
  { maker: '현대', model: '팰리세이드', sub: '팰리세이드 LX2', year_start: '2018', year_end: '2022', code: 'LX2', category: '대형 SUV', displacement: 2199, seats: 7 },
  { maker: '현대', model: '팰리세이드', sub: '더 뉴 팰리세이드 LX2 (페리)', year_start: '2022', year_end: '2024', code: 'LX2', category: '대형 SUV', displacement: 2199, seats: 7 },
  { maker: '현대', model: '팰리세이드', sub: '팰리세이드 LX3', year_start: '2025', year_end: '현재', code: 'LX3', category: '대형 SUV', displacement: 2497, seats: 7 },
  { maker: '현대', model: '캐스퍼', sub: '캐스퍼 AX1', year_start: '2021', year_end: '현재', code: 'AX1', category: '경형 SUV', displacement: 999, seats: 5 },
  { maker: '현대', model: '캐스퍼', sub: '캐스퍼 일렉트릭 AX1 EV', year_start: '2024', year_end: '현재', code: 'AX1', category: '경형 EV', seats: 5, battery_kwh: 42 },
  { maker: '현대', model: '스타리아', sub: '스타리아 US4', year_start: '2021', year_end: '2024', code: 'US4', category: '대형 MPV', displacement: 2151, seats: 11 },
  { maker: '현대', model: '스타리아', sub: '더 뉴 스타리아 US4 (페리)', year_start: '2024', year_end: '현재', code: 'US4', category: '대형 MPV', displacement: 2151, seats: 11 },
  { maker: '현대', model: '포터2', sub: '포터2 HR', year_start: '2004', year_end: '현재', code: 'HR', category: '소형 트럭', displacement: 2497, seats: 3 },
  { maker: '현대', model: '포터2', sub: '포터2 일렉트릭 HR EV', year_start: '2019', year_end: '현재', code: 'HR', category: '소형 EV 트럭', seats: 3, battery_kwh: 58.8 },
  { maker: '현대', model: '베뉴', sub: '베뉴 QX', year_start: '2019', year_end: '현재', code: 'QX', category: '소형 SUV', displacement: 1598, seats: 5 },
  { maker: '현대', model: '아이오닉9', sub: '아이오닉9', year_start: '2024', year_end: '현재', category: '대형 EV SUV', seats: 7, battery_kwh: 110.3 },

  // KGM
  { maker: 'KGM', model: '렉스턴', sub: '렉스턴 Y400', year_start: '2017', year_end: '2020', code: 'Y400', category: '대형 SUV', displacement: 2157, seats: 5 },
  { maker: 'KGM', model: '렉스턴', sub: '올뉴 렉스턴 Y450', year_start: '2020', year_end: '2023', code: 'Y450', category: '대형 SUV', displacement: 2157, seats: 7 },
  { maker: 'KGM', model: '렉스턴', sub: '렉스턴 뉴아레나 Y450 (페리)', year_start: '2023', year_end: '현재', code: 'Y450', category: '대형 SUV', displacement: 2157, seats: 7 },
  { maker: 'KGM', model: '렉스턴 스포츠', sub: '렉스턴 스포츠 Q200', year_start: '2018', year_end: '2021', code: 'Q200', category: '픽업트럭', displacement: 2157, seats: 5 },
  { maker: 'KGM', model: '렉스턴 스포츠', sub: '렉스턴 스포츠 Q200 (페리)', year_start: '2021', year_end: '현재', code: 'Q200', category: '픽업트럭', displacement: 2157, seats: 5 },
  { maker: 'KGM', model: '코란도', sub: '뷰티풀 코란도 C300', year_start: '2019', year_end: '현재', code: 'C300', category: '준중형 SUV', displacement: 1497, seats: 5 },
  { maker: 'KGM', model: '티볼리', sub: '티볼리 X100', year_start: '2015', year_end: '2019', code: 'X100', category: '소형 SUV', displacement: 1597, seats: 5 },
  { maker: 'KGM', model: '티볼리', sub: '베리 뉴 티볼리 X150 (페리)', year_start: '2019', year_end: '2023', code: 'X150', category: '소형 SUV', displacement: 1497, seats: 5 },
  { maker: 'KGM', model: '티볼리', sub: '더 뉴 티볼리 X150 (페리2)', year_start: '2023', year_end: '현재', code: 'X150', category: '소형 SUV', displacement: 1497, seats: 5 },
  { maker: 'KGM', model: '토레스', sub: '토레스 J100', year_start: '2022', year_end: '현재', code: 'J100', category: '중형 SUV', displacement: 1497, seats: 5 },
  { maker: 'KGM', model: '토레스', sub: '토레스 EVX U100', year_start: '2023', year_end: '현재', code: 'U100', category: '중형 EV SUV', seats: 5, battery_kwh: 73.4 },
  { maker: 'KGM', model: '액티언', sub: '더 뉴 액티언 J120', year_start: '2024', year_end: '현재', code: 'J120', category: '중형 SUV', displacement: 1497, seats: 5 },

  // 쉐보레
  { maker: '쉐보레', model: '트랙스', sub: '트랙스 9BQC', year_start: '2023', year_end: '현재', code: '9BQC', category: '소형 SUV', displacement: 1349, seats: 5 },
  { maker: '쉐보레', model: '트레일블레이저', sub: '트레일블레이저 9BYC', year_start: '2020', year_end: '2023', code: '9BYC', category: '소형 SUV', displacement: 1349, seats: 5 },
  { maker: '쉐보레', model: '트레일블레이저', sub: '더 뉴 트레일블레이저 9BYC (페리)', year_start: '2023', year_end: '현재', code: '9BYC', category: '소형 SUV', displacement: 1349, seats: 5 },

  // BMW
  { maker: 'BMW', model: '3시리즈', sub: '3시리즈 F30', year_start: '2012', year_end: '2019', code: 'F30', category: '준중형 세단', displacement: 1998, seats: 5 },
  { maker: 'BMW', model: '3시리즈', sub: '3시리즈 G20', year_start: '2019', year_end: '2022', code: 'G20', category: '준중형 세단', displacement: 1998, seats: 5 },
  { maker: 'BMW', model: '3시리즈', sub: '3시리즈 G20 페리 (LCI)', year_start: '2022', year_end: '현재', code: 'G20', category: '준중형 세단', displacement: 1998, seats: 5 },
  { maker: 'BMW', model: '5시리즈', sub: '5시리즈 G30', year_start: '2017', year_end: '2020', code: 'G30', category: '중형 세단', displacement: 1998, seats: 5 },
  { maker: 'BMW', model: '5시리즈', sub: '5시리즈 G30 페리 (LCI)', year_start: '2020', year_end: '2023', code: 'G30', category: '중형 세단', displacement: 1998, seats: 5 },
  { maker: 'BMW', model: '5시리즈', sub: '5시리즈 G60', year_start: '2023', year_end: '현재', code: 'G60', category: '중형 세단', displacement: 1998, seats: 5 },
  { maker: 'BMW', model: 'X3', sub: 'X3 G01', year_start: '2017', year_end: '2021', code: 'G01', category: '중형 SUV', displacement: 1998, seats: 5 },
  { maker: 'BMW', model: 'X3', sub: 'X3 G01 페리 (LCI)', year_start: '2021', year_end: '2024', code: 'G01', category: '중형 SUV', displacement: 1998, seats: 5 },
  { maker: 'BMW', model: 'X5', sub: 'X5 G05', year_start: '2019', year_end: '2023', code: 'G05', category: '준대형 SUV', displacement: 2993, seats: 5 },
  { maker: 'BMW', model: 'X5', sub: 'X5 G05 페리 (LCI)', year_start: '2023', year_end: '현재', code: 'G05', category: '준대형 SUV', displacement: 2993, seats: 7 },

  // 벤츠
  { maker: '벤츠', model: 'C-클래스', sub: 'C-클래스 W205', year_start: '2014', year_end: '2021', code: 'W205', category: '준중형 세단', displacement: 1991, seats: 5 },
  { maker: '벤츠', model: 'C-클래스', sub: 'C-클래스 W206', year_start: '2021', year_end: '현재', code: 'W206', category: '준중형 세단', displacement: 1999, seats: 5 },
  { maker: '벤츠', model: 'E-클래스', sub: 'E-클래스 W213', year_start: '2016', year_end: '2020', code: 'W213', category: '중형 세단', displacement: 1991, seats: 5 },
  { maker: '벤츠', model: 'E-클래스', sub: '더 뉴 E-클래스 W213 (페리)', year_start: '2020', year_end: '2024', code: 'W213', category: '중형 세단', displacement: 1991, seats: 5 },
  { maker: '벤츠', model: 'E-클래스', sub: 'E-클래스 W214', year_start: '2024', year_end: '현재', code: 'W214', category: '중형 세단', displacement: 1999, seats: 5 },
  { maker: '벤츠', model: 'GLC', sub: 'GLC X253 페리 (페리)', year_start: '2019', year_end: '2023', code: 'X253', category: '중형 SUV', displacement: 1991, seats: 5 },
  { maker: '벤츠', model: 'GLC', sub: 'GLC X254', year_start: '2023', year_end: '현재', code: 'X254', category: '중형 SUV', displacement: 1999, seats: 5 },
  { maker: '벤츠', model: 'GLE', sub: 'GLE V167', year_start: '2019', year_end: '2023', code: 'V167', category: '준대형 SUV', displacement: 2999, seats: 5 },
  { maker: '벤츠', model: 'GLE', sub: 'GLE V167 페리 (페리)', year_start: '2023', year_end: '현재', code: 'V167', category: '준대형 SUV', displacement: 2999, seats: 5 },

  // 아우디
  { maker: '아우디', model: 'A6', sub: 'A6 C7 (페리)', year_start: '2015', year_end: '2019', code: 'C7', category: '중형 세단', displacement: 1984, seats: 5 },
  { maker: '아우디', model: 'A6', sub: 'A6 C8', year_start: '2019', year_end: '2023', code: 'C8', category: '중형 세단', displacement: 1984, seats: 5 },
  { maker: '아우디', model: 'A6', sub: 'A6 C8 (페리)', year_start: '2023', year_end: '현재', code: 'C8', category: '중형 세단', displacement: 1984, seats: 5 },

  // 테슬라
  { maker: '테슬라', model: '모델 3', sub: '모델 3', year_start: '2019', year_end: '2023', category: '중형 EV 세단', seats: 5, battery_kwh: 75 },
  { maker: '테슬라', model: '모델 3', sub: '모델 3 하이랜드 (페리)', year_start: '2024', year_end: '현재', category: '중형 EV 세단', seats: 5, battery_kwh: 79 },
  { maker: '테슬라', model: '모델 Y', sub: '모델 Y', year_start: '2021', year_end: '2024', category: '중형 EV SUV', seats: 5, battery_kwh: 75 },
  { maker: '테슬라', model: '모델 Y', sub: '모델 Y 주니퍼 (페리)', year_start: '2025', year_end: '현재', category: '중형 EV SUV', seats: 5, battery_kwh: 78.4 },
];
