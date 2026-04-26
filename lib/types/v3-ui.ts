/**
 * v3 UI 공용 타입 — alert / table 헬퍼 패턴을 한 곳에서 정의해
 * page.tsx 마다 같은 type/interface 반복하지 않도록 함.
 */

export type AlertSeverity = 'danger' | 'warn' | 'info';

export interface AlertItem {
  key: string;
  severity: AlertSeverity;
  icon: string;
  head: string;
  desc: string;
  /** 우측 액션 버튼 라벨 */
  actionLabel: string;
  /** 패널 head의 합계 카운트 derive 용도 */
  count: number;
}
