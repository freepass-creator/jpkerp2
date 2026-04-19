'use client';

import { useEffect, useState } from 'react';

const KEY = 'jpk.theme';

type Theme = 'light' | 'dark';

function apply(t: Theme) {
  const root = document.documentElement;
  if (t === 'dark') root.classList.add('dark');
  else root.classList.remove('dark');
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('light');

  useEffect(() => {
    const saved = (localStorage.getItem(KEY) as Theme) || 'light';
    setTheme(saved);
    apply(saved);
  }, []);

  const toggle = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    apply(next);
    try { localStorage.setItem(KEY, next); } catch {}
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="테마 전환"
      className="btn btn-icon"
      title={theme === 'light' ? '다크모드' : '라이트모드'}
    >
      <i className={`ph ${theme === 'light' ? 'ph-moon' : 'ph-sun'}`} />
    </button>
  );
}
