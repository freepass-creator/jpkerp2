import type { Config } from 'tailwindcss';

/**
 * Tailwind 토큰을 jpkerp CSS 변수에 1:1 매핑.
 * 나중에 테마 스위치로 "modern" 토큰셋 추가하려면 여기 var(--c-*) 값만 바꾸면 됨.
 */
const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)'],
        mono: ['var(--font-mono)'],
      },
      colors: {
        bg: 'var(--c-bg)',
        'bg-sub': 'var(--c-bg-sub)',
        'bg-hover': 'var(--c-bg-hover)',
        'bg-active': 'var(--c-bg-active)',
        surface: 'var(--c-surface)',
        border: 'var(--c-border)',
        'border-strong': 'var(--c-border-strong)',
        text: 'var(--c-text)',
        'text-sub': 'var(--c-text-sub)',
        'text-muted': 'var(--c-text-muted)',
        primary: {
          DEFAULT: 'var(--c-primary)',
          hover: 'var(--c-primary-h)',
          bg: 'var(--c-primary-bg)',
          border: 'var(--c-primary-border)',
        },
        success: {
          DEFAULT: 'var(--c-success)',
          bg: 'var(--c-success-bg)',
        },
        warn: {
          DEFAULT: 'var(--c-warn)',
          bg: 'var(--c-warn-bg)',
        },
        danger: {
          DEFAULT: 'var(--c-danger)',
          bg: 'var(--c-danger-bg)',
        },
        info: {
          DEFAULT: 'var(--c-info)',
          bg: 'var(--c-info-bg)',
        },
      },
      fontSize: {
        '2xs': ['10px', '14px'],
        xs: ['11px', '14px'],
        sm: ['11px', '14px'],
        base: ['12px', '18px'],
        md: ['12px', '18px'],
        lg: ['12px', '18px'],
        xl: ['13px', '18px'],
      },
      fontWeight: {
        normal: '400',
        medium: '500',
        bold: '600',
        heavy: '700',
      },
      borderRadius: {
        xs: '2px',
        sm: '2px',
        md: '2px',
        lg: '2px',
      },
      spacing: {
        'nav-w': 'var(--sidebar-w)',
        'topbar-h': 'var(--topbar-h)',
        'tabbar-h': 'var(--tabbar-h)',
        'context-w': 'var(--context-w)',
        'panel-head-h': 'var(--panel-head-h)',
        'ctrl-h': 'var(--ctrl-h)',
        'grid-row-h': 'var(--grid-row-h)',
      },
      transitionDuration: {
        fast: '100ms',
        normal: '200ms',
      },
    },
  },
  plugins: [],
};

export default config;
