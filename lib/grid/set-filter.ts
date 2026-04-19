/**
 * JpkSetFilter — AG Grid Community용 커스텀 선택필터
 * freepasserp `pls-filter-dd` 스타일 참조.
 *
 * 구조:
 *   [정렬 버튼 행 — 오름차순 | 내림차순]
 *   [검색 input]
 *   [체크박스 리스트 — 빈도 내림차순]
 *   [전체해제 | 초기화]
 *
 * 정렬도 여기서 토글 가능 (컬럼 헤더 클릭 없이).
 */

import type {
  IFilterComp,
  IFilterParams,
  IDoesFilterPassParams,
} from 'ag-grid-community';

export class JpkSetFilter implements IFilterComp {
  private params!: IFilterParams;
  private selected: Set<string> | null = null;
  private search = '';
  private values: Array<[string, number]> = [];
  private eGui!: HTMLDivElement;
  private eSearch!: HTMLInputElement;
  private eList!: HTMLDivElement;
  private eSortAsc!: HTMLButtonElement;
  private eSortDesc!: HTMLButtonElement;
  private eMatchCount!: HTMLSpanElement;

  init(params: IFilterParams): void {
    this.params = params;
    this.eGui = document.createElement('div');
    this.eGui.className = 'jpk-set-filter';
    this.eGui.innerHTML = `
      <div class="jpk-set-sort-row">
        <button type="button" class="jpk-set-sort-btn" data-dir="asc">
          <span>오름차순</span>
        </button>
        <button type="button" class="jpk-set-sort-btn" data-dir="desc">
          <span>내림차순</span>
        </button>
      </div>
      <div class="jpk-set-search">
        <input type="text" placeholder="검색" />
        <span class="jpk-set-match-count"></span>
      </div>
      <div class="jpk-set-list"></div>
      <div class="jpk-set-actions">
        <button type="button" class="jpk-set-clear">전체 해제</button>
        <button type="button" class="jpk-set-reset">초기화</button>
      </div>
    `;
    this.eSearch = this.eGui.querySelector('input[type="text"]') as HTMLInputElement;
    this.eList = this.eGui.querySelector('.jpk-set-list') as HTMLDivElement;
    this.eSortAsc = this.eGui.querySelector('[data-dir="asc"]') as HTMLButtonElement;
    this.eSortDesc = this.eGui.querySelector('[data-dir="desc"]') as HTMLButtonElement;
    this.eMatchCount = this.eGui.querySelector('.jpk-set-match-count') as HTMLSpanElement;
    const eClear = this.eGui.querySelector('.jpk-set-clear') as HTMLButtonElement;
    const eReset = this.eGui.querySelector('.jpk-set-reset') as HTMLButtonElement;

    // 검색
    this.eSearch.addEventListener('input', () => {
      this.search = this.eSearch.value.trim().toLowerCase();
      this.renderList();
    });

    // 정렬 버튼
    this.eSortAsc.addEventListener('click', () => this.applySort('asc'));
    this.eSortDesc.addEventListener('click', () => this.applySort('desc'));

    // 전체 해제 (빈 Set — 아무것도 안 보임)
    eClear.addEventListener('click', () => {
      this.selected = new Set();
      this.renderList();
      this.params.filterChangedCallback();
    });

    // 초기화 (null — 필터 OFF, 전체 보임)
    eReset.addEventListener('click', () => {
      this.selected = null;
      this.eSearch.value = '';
      this.search = '';
      this.renderList();
      this.params.filterChangedCallback();
    });

    this.computeValues();
    this.renderSortState();
    this.renderList();
  }

  private applySort(dir: 'asc' | 'desc'): void {
    const colId = this.params.colDef.field;
    if (!colId) return;
    const api = this.params.api;
    const currentState = api.getColumnState();
    const existing = currentState.find((c) => c.colId === colId);
    const newSort = existing?.sort === dir ? null : dir;
    api.applyColumnState({
      state: [{ colId, sort: newSort }],
      defaultState: { sort: null },
    });
    this.renderSortState();
  }

  private renderSortState(): void {
    const colId = this.params.colDef.field;
    if (!colId) return;
    const state = this.params.api.getColumnState().find((c) => c.colId === colId);
    this.eSortAsc.classList.toggle('is-active', state?.sort === 'asc');
    this.eSortDesc.classList.toggle('is-active', state?.sort === 'desc');
  }

  private computeValues(): void {
    const counts = new Map<string, number>();
    const field = this.params.colDef.field;
    this.params.api.forEachNode((node) => {
      let v: unknown;
      if (field && node.data) {
        v = (node.data as Record<string, unknown>)[field];
      }
      const key = v === null || v === undefined || v === '' ? '(빈 값)' : String(v);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    this.values = [...counts.entries()].sort(
      (a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ko'),
    );
  }

  private renderList(): void {
    const filtered = this.search
      ? this.values.filter(([v]) => v.toLowerCase().includes(this.search))
      : this.values;

    // 검색 결과 카운트
    if (this.search) {
      this.eMatchCount.textContent = `${filtered.length}개`;
    } else {
      this.eMatchCount.textContent = '';
    }

    const sel = this.selected;
    this.eList.innerHTML = filtered
      .map(([v, n]) => {
        const checked = sel === null || sel.has(v);
        return `<label class="jpk-set-item${checked ? ' is-checked' : ''}">
          <input type="checkbox" data-v="${encodeURIComponent(v)}" ${checked ? 'checked' : ''} />
          <span class="jpk-set-label">${escapeHtml(v)}</span>
          <span class="jpk-set-count">${n}</span>
        </label>`;
      })
      .join('');
    this.eList.querySelectorAll<HTMLInputElement>('input[type="checkbox"]').forEach((cb) => {
      cb.addEventListener('change', () => this.onToggle(cb));
    });
  }

  private onToggle(cb: HTMLInputElement): void {
    const v = decodeURIComponent(cb.dataset.v ?? '');
    if (this.selected === null) {
      this.selected = new Set(this.values.map(([x]) => x));
    }
    if (cb.checked) this.selected.add(v);
    else this.selected.delete(v);
    this.params.filterChangedCallback();
    // 즉시 리렌더로 is-checked 상태 반영
    this.renderList();
  }

  isFilterActive(): boolean {
    return this.selected !== null && this.selected.size < this.values.length;
  }

  doesFilterPass(params: IDoesFilterPassParams): boolean {
    if (!this.isFilterActive()) return true;
    const field = this.params.colDef.field;
    let v: unknown;
    if (field && params.data) {
      v = (params.data as Record<string, unknown>)[field];
    }
    const key = v === null || v === undefined || v === '' ? '(빈 값)' : String(v);
    return this.selected?.has(key) ?? false;
  }

  getModel() {
    if (!this.isFilterActive()) return null;
    return { values: [...(this.selected ?? [])], count: this.selected?.size ?? 0 };
  }

  setModel(model: { values: string[] } | null): void {
    if (!model || !Array.isArray(model.values)) {
      this.selected = null;
    } else {
      this.selected = new Set(model.values);
    }
    this.renderList();
  }

  getGui(): HTMLElement {
    return this.eGui;
  }

  onNewRowsLoaded(): void {
    this.computeValues();
    this.renderList();
  }

  destroy(): void {}
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[c] as string),
  );
}
