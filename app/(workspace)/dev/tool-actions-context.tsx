'use client';

import { createContext, useContext, useEffect } from 'react';
import { createPortal } from 'react-dom';

/**
 * 도구가 panel-head에 액션 버튼을 끼워넣음 (Portal).
 */
export const ToolActionsHost = createContext<HTMLElement | null>(null);

export function ToolActions({ children }: { children: React.ReactNode }) {
  const host = useContext(ToolActionsHost);
  if (!host) return null;
  return createPortal(children, host);
}

/**
 * 도구가 Panel 3(설명/상세패널) 전체를 takeover — 기본 DevHelp 대신 자기 내용 렌더.
 */
interface DetailCtx {
  host: HTMLElement | null;
  setTakeover: (active: boolean) => void;
}
export const ToolDetailHost = createContext<DetailCtx | null>(null);

/**
 * 조건부 takeover — active=true일 때만 Panel 3 차지. false면 기본 DevHelp 유지.
 * 언마운트 시 자동 복귀.
 */
export function ToolDetail({ active, children }: { active: boolean; children: React.ReactNode }) {
  const ctx = useContext(ToolDetailHost);
  useEffect(() => {
    if (!ctx) return;
    ctx.setTakeover(active);
    return () => ctx.setTakeover(false);
  }, [ctx, active]);
  if (!active || !ctx?.host) return null;
  return createPortal(children, ctx.host);
}
