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
  // null = 필터 비활성(전체 보임), Set = 선택된 값만 보임
  private selected: Set<string> | null = null;
  private search = '';
  private values: Array<[string, number]> = [];
  private eGui!: HTMLDivElement;
  private eSearch!: HTMLInputElement;
  private eList!: HTMLDivElement;
  private eSortAsc!: HTMLButtonElement;
  private eSortDesc!: HTMLButtonElement;
  private eMatchCount!: HTMLSpanElement;
  private eReset!: HTMLButtonElement;

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
        <button type="button" class="jpk-set-reset">초기화</button>
        <button type="button" class="jpk-set-apply">적용</button>
      </div>
    `;
    this.eSearch = this.eGui.querySelector('input[type="text"]') as HTMLInputElement;
    this.eList = this.eGui.querySelector('.jpk-set-list') as HTMLDivElement;
    this.eSortAsc = this.eGui.querySelector('[data-dir="asc"]') as HTMLButtonElement;
    this.eSortDesc = this.eGui.querySelector('[data-dir="desc"]') as HTMLButtonElement;
    this.eMatchCount = this.eGui.querySelector('.jpk-set-match-count') as HTMLSpanElement;
    this.eReset = this.eGui.querySelector('.jpk-set-reset') as HTMLButtonElement;

    // 검색 — 입력 즉시 매칭 항목만 선택 + 필터 적용
    this.eSearch.addEventListener('input', () => {
      this.search = this.eSearch.value.trim().toLowerCase();
      if (this.search) {
        // 검색어 있으면 매칭되는 값만 선택
        this.selected = new Set(
          this.values.filter(([v]) => v.toLowerCase().includes(this.search)).map(([v]) => v),
        );
        this.params.filterChangedCallback();
      } else {
        // 검색어 비우면 필터 해제 (전체 보임)
        this.selected = null;
        this.params.filterChangedCallback();
      }
      this.renderList();
    });

    // 정렬 버튼
    this.eSortAsc.addEventListener('click', () => this.applySort('asc'));
    this.eSortDesc.addEventListener('click', () => this.applySort('desc'));

    // 적용 — 필터 팝업 닫기
    const eApply = this.eGui.querySelector('.jpk-set-apply') as HTMLButtonElement;
    eApply.addEventListener('click', () => {
      this.params.api.hidePopupMenu();
    });

    // 초기화 (null — 필터 OFF, 전체 보임)
    this.eReset.addEventListener('click', () => {
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
        const checked = sel !== null && sel.has(v);
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

    // 초기화 버튼 활성/비활성
    const hasFilter = this.selected !== null;
    this.eReset.disabled = !hasFilter;
    this.eReset.style.opacity = hasFilter ? '1' : '0.35';
  }

  private onToggle(cb: HTMLInputElement): void {
    const v = decodeURIComponent(cb.dataset.v ?? '');
    if (this.selected === null) {
      this.selected = new Set<string>();
    }
    if (cb.checked) this.selected.add(v);
    else this.selected.delete(v);
    // 전부 해제되면 필터 비활성 (전체 보임)
    if (this.selected.size === 0) this.selected = null;
    this.params.filterChangedCallback();
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
