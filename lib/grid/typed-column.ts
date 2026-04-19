import type { ColDef } from 'ag-grid-community';
import { JpkSetFilter } from './set-filter';

export type ColType = 'select' | 'text' | 'number' | 'date' | 'action';

/**
 * 타입별 기본 필터·정렬·정렬방식을 주입한 ColDef 생성.
 *
 * @example
 *   typedColumn('select', { headerName: '회사코드', field: 'partner_code', width: 85 })
 *   typedColumn('number', { headerName: '연체일', field: 'max_days', width: 75 })
 *   typedColumn('action', { headerName: '#', valueGetter: ... })
 */
export function typedColumn<T>(type: ColType, def: ColDef<T>): ColDef<T> {
  const base = { ...def };

  if (type === 'number') {
    // 숫자: 필터 없음, 정렬(오름/내림)만. 우측 정렬 + tabular-nums
    base.filter = false;
    base.sortable ??= true;
    base.cellClass = [base.cellClass, 'col-right'].filter(Boolean).join(' ');
    base.headerClass = [base.headerClass, 'col-right'].filter(Boolean).join(' ');
    base.cellStyle = { fontVariantNumeric: 'tabular-nums', ...(typeof base.cellStyle === 'object' && base.cellStyle ? base.cellStyle : {}) } as ColDef<T>['cellStyle'];
  } else if (type === 'action') {
    // 행번호·버튼 등: 필터·정렬 모두 꺼짐
    base.filter = false;
    base.sortable = false;
  } else {
    // select / text / date — 모두 엑셀식 체크박스 드롭다운 필터 (JpkSetFilter)
    base.filter = base.filter ?? JpkSetFilter;
    base.sortable ??= true;
  }

  return base;
}
