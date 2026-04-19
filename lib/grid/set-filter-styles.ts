/**
 * JpkSetFilter 관련 CSS를 DOM에 주입 (1회만).
 * freepasserp pls-filter-dd 참조.
 */

const CSS = `
.jpk-set-filter {
  display: flex; flex-direction: column;
  width: 220px; max-height: 340px;
  font-size: 12px;
  background: var(--c-surface);
  letter-spacing: -0.02em;
}

/* 정렬 버튼 행 */
.jpk-set-filter .jpk-set-sort-row {
  display: flex; gap: 4px;
  padding: 6px;
  border-bottom: 1px solid rgba(0,0,0,0.06);
}
.jpk-set-filter .jpk-set-sort-btn {
  flex: 1;
  height: 24px;
  border: 1px solid var(--c-border);
  border-radius: 2px;
  background: var(--c-surface);
  font-size: 11px;
  color: var(--c-text-sub);
  cursor: pointer;
  font-family: inherit;
  letter-spacing: -0.02em;
  transition: all var(--t-fast);
}
.jpk-set-filter .jpk-set-sort-btn:hover {
  background: var(--c-bg-hover);
  color: var(--c-text);
}
.jpk-set-filter .jpk-set-sort-btn[data-dir="asc"].is-active {
  background: #fef2f2;
  border-color: #fca5a5;
  color: #dc2626;
  font-weight: 700;
}
.jpk-set-filter .jpk-set-sort-btn[data-dir="desc"].is-active {
  background: #eff6ff;
  border-color: #93c5fd;
  color: #2563eb;
  font-weight: 700;
}

/* 검색 */
.jpk-set-filter .jpk-set-search {
  position: relative;
  padding: 6px;
  border-bottom: 1px solid rgba(0,0,0,0.06);
}
.jpk-set-filter .jpk-set-search input {
  width: 100%;
  height: 26px;
  padding: 0 46px 0 8px;
  border: 1px solid var(--c-border);
  border-radius: 2px;
  font-size: 12px;
  font-family: inherit;
  background: var(--c-surface);
  color: var(--c-text);
  outline: none;
  letter-spacing: -0.02em;
  box-sizing: border-box;
}
.jpk-set-filter .jpk-set-search input:focus {
  border-color: var(--c-primary);
  box-shadow: 0 0 0 2px rgba(35, 131, 226, 0.12);
}
.jpk-set-filter .jpk-set-search input::placeholder {
  color: var(--c-text-muted);
}
.jpk-set-filter .jpk-set-match-count {
  position: absolute;
  right: 14px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 10px;
  color: var(--c-text-muted);
  font-variant-numeric: tabular-nums;
  pointer-events: none;
}

/* 리스트 */
.jpk-set-filter .jpk-set-list {
  flex: 1;
  overflow-y: auto;
  padding: 2px 0;
  min-height: 120px;
  max-height: 220px;
}
.jpk-set-filter .jpk-set-item {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 26px;
  padding: 0 10px;
  cursor: pointer;
  font-size: 12px;
  color: var(--c-text);
  letter-spacing: -0.02em;
}
.jpk-set-filter .jpk-set-item:hover {
  background: var(--c-bg-hover);
}
.jpk-set-filter .jpk-set-item.is-checked {
  background: #f8fafc;
}
.jpk-set-filter .jpk-set-item input[type="checkbox"] {
  margin: 0;
  flex-shrink: 0;
  width: 13px;
  height: 13px;
  cursor: pointer;
  accent-color: var(--c-primary);
}
.jpk-set-filter .jpk-set-label {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.jpk-set-filter .jpk-set-count {
  color: var(--c-text-muted);
  font-variant-numeric: tabular-nums;
  font-size: 10px;
  flex-shrink: 0;
}

/* 하단 액션 */
.jpk-set-filter .jpk-set-actions {
  display: flex;
  gap: 4px;
  padding: 6px;
  border-top: 1px solid rgba(0,0,0,0.06);
  background: var(--c-surface);
  position: sticky;
  bottom: 0;
}
.jpk-set-filter .jpk-set-actions button {
  flex: 1;
  height: 24px;
  border: 1px solid var(--c-border);
  border-radius: 2px;
  background: var(--c-surface);
  font-size: 11px;
  font-family: inherit;
  color: var(--c-text-sub);
  cursor: pointer;
  letter-spacing: -0.02em;
  transition: all var(--t-fast);
}
.jpk-set-filter .jpk-set-actions button:hover {
  background: var(--c-bg-hover);
  color: var(--c-text);
}
.jpk-set-filter .jpk-set-reset {
  font-weight: 600;
}
`;

if (typeof window !== 'undefined') {
  const ID = 'jpk-set-filter-style';
  if (!document.getElementById(ID)) {
    const el = document.createElement('style');
    el.id = ID;
    el.textContent = CSS;
    document.head.appendChild(el);
  } else {
    // HMR 시 기존 스타일 갱신
    const el = document.getElementById(ID);
    if (el && el.textContent !== CSS) el.textContent = CSS;
  }
}

export {};
