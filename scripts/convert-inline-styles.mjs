/**
 * 인라인 fontSize/color → Tailwind 클래스 일괄 변환 스크립트
 *
 * 변환 대상:
 *   style={{ fontSize: 11 }}  →  className="text-xs"
 *   style={{ fontSize: 11, color: 'var(--c-text-muted)' }}  →  className="text-xs text-text-muted"
 *   style={{ fontSize: 11, padding: 4 }}  →  className="text-xs" style={{ padding: 4 }}
 *
 * 건드리지 않는 것:
 *   - AG Grid cellStyle (함수/객체 — JSX style이 아님)
 *   - 동적 표현식 (삼항, 변수 등)
 *   - fontSize/color 외에 다른 속성만 있는 style
 */

import fs from 'fs';
import path from 'path';
import { glob } from 'fs/promises';

const FONT_MAP = {
  10: 'text-2xs',
  11: 'text-xs',
  12: 'text-base',
  13: 'text-xl',
  14: 'text-[14px]',
  15: 'text-[15px]',
  16: 'text-[16px]',
  18: 'text-[18px]',
  20: 'text-[20px]',
  22: 'text-[22px]',
  24: 'text-[24px]',
};

const COLOR_MAP = {
  "var(--c-text-muted)": 'text-text-muted',
  "var(--c-text-sub)": 'text-text-sub',
  "var(--c-text)": 'text-text',
  "var(--c-danger)": 'text-danger',
  "var(--c-success)": 'text-success',
  "var(--c-warn)": 'text-warn',
  "var(--c-primary)": 'text-primary',
  "var(--c-info)": 'text-info',
};

// Quick token for 'Xpx' string values too
const FONT_PX_MAP = {};
for (const [num, cls] of Object.entries(FONT_MAP)) {
  FONT_PX_MAP[`${num}px`] = cls;
}

let totalConverted = 0;
let totalFiles = 0;

/**
 * Parse a style object literal string like `{ fontSize: 11, color: 'var(--c-text-muted)', padding: 4 }`
 * Returns { extractable: [{prop, twClass}], remaining: [{prop, value}], raw }
 */
function parseStyleObject(raw) {
  // Trim outer braces
  const inner = raw.slice(1, -1).trim();
  if (!inner) return null;

  // Split by comma — but respect nested parens/quotes
  const props = [];
  let depth = 0;
  let inStr = null;
  let cur = '';
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i];
    if (inStr) {
      cur += ch;
      if (ch === inStr && inner[i - 1] !== '\\') inStr = null;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      inStr = ch;
      cur += ch;
      continue;
    }
    if (ch === '(' || ch === '{' || ch === '[') { depth++; cur += ch; continue; }
    if (ch === ')' || ch === '}' || ch === ']') { depth--; cur += ch; continue; }
    if (ch === ',' && depth === 0) {
      props.push(cur.trim());
      cur = '';
      continue;
    }
    cur += ch;
  }
  if (cur.trim()) props.push(cur.trim());

  const extractable = [];
  const remaining = [];

  for (const prop of props) {
    const colonIdx = prop.indexOf(':');
    if (colonIdx === -1) { remaining.push(prop); continue; }

    const key = prop.slice(0, colonIdx).trim();
    const val = prop.slice(colonIdx + 1).trim();

    if (key === 'fontSize') {
      // Check numeric value
      const num = Number(val);
      if (FONT_MAP[num]) {
        extractable.push({ prop: key, twClass: FONT_MAP[num] });
        continue;
      }
      // Check string value like '11px'
      const strVal = val.replace(/^['"]|['"]$/g, '');
      if (FONT_PX_MAP[strVal]) {
        extractable.push({ prop: key, twClass: FONT_PX_MAP[strVal] });
        continue;
      }
    }

    if (key === 'color') {
      const strVal = val.replace(/^['"]|['"]$/g, '');
      if (COLOR_MAP[strVal]) {
        extractable.push({ prop: key, twClass: COLOR_MAP[strVal] });
        continue;
      }
    }

    remaining.push(prop);
  }

  return { extractable, remaining, raw };
}

/**
 * Process a single file
 */
function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');
  let converted = 0;

  // Match style={{ ... }} in JSX — but NOT cellStyle, headerStyle, etc.
  // We look for ` style={{...}}` patterns preceded by JSX context indicators
  // Strategy: find all `style={{...}}` that are JSX props (not object properties)

  // Regex to find style={{ ... }} — balanced braces matching
  const styleRegex = /(\s)(style)=\{\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}\}/g;

  let result = '';
  let lastIdx = 0;
  let match;

  while ((match = styleRegex.exec(content)) !== null) {
    const fullMatch = match[0];
    const leadingSpace = match[1];
    const styleKey = match[2];
    const innerContent = match[3];

    // Skip if this looks like AG Grid cellStyle (check context — preceding text)
    const precedingChunk = content.slice(Math.max(0, match.index - 80), match.index);
    if (/cellStyle|headerStyle|cellRendererParams|getRowStyle/.test(precedingChunk)) {
      continue;
    }

    const parsed = parseStyleObject(`{${innerContent}}`);
    if (!parsed || parsed.extractable.length === 0) continue;

    const twClasses = parsed.extractable.map(e => e.twClass).join(' ');

    // Check if there's already a className on this element
    // Look backwards from the style prop to find the opening tag
    const beforeStyle = content.slice(lastIdx, match.index + leadingSpace.length);

    let replacement;
    if (parsed.remaining.length === 0) {
      // All props extracted — remove style entirely, add/merge className
      replacement = `${leadingSpace}className="${twClasses}"`;
    } else {
      // Some props remain
      const remainStr = parsed.remaining.join(', ');
      replacement = `${leadingSpace}className="${twClasses}" style={{ ${remainStr} }}`;
    }

    // Now we need to handle existing className on the same element
    // We'll do a post-processing step for that
    result += content.slice(lastIdx, match.index) + replacement;
    lastIdx = match.index + fullMatch.length;
    converted++;
  }

  result += content.slice(lastIdx);

  if (converted === 0) return 0;

  // Post-process: merge duplicate className props on same element
  // Pattern: className="existing classes" ... className="new classes"
  // or: className="new classes" ... className="existing classes"
  // We need to find elements with two className props and merge them

  // Find elements with multiple className — look for patterns like:
  // className="A" className="B" → className="A B"
  result = result.replace(
    /className="([^"]*?)"\s+className="([^"]*?)"/g,
    (_, a, b) => `className="${a} ${b}"`
  );

  // Also handle: className={`...`} followed by className="..."
  result = result.replace(
    /className=\{`([^`]*?)`\}\s+className="([^"]*?)"/g,
    (_, a, b) => `className={\`${a} ${b}\`}`
  );

  // Handle: className={clsx(...)} followed by className="..."
  // This is harder — skip for now, manual review needed

  fs.writeFileSync(filePath, result, 'utf-8');
  totalConverted += converted;
  return converted;
}

// Main
const rootDir = 'C:/dev/jpkerp2';
const patterns = [
  'app/**/*.tsx',
  'components/**/*.tsx',
];

console.log('=== 인라인 스타일 → Tailwind 클래스 변환 시작 ===\n');

for (const pattern of patterns) {
  const fullPattern = path.join(rootDir, pattern).replace(/\\/g, '/');
  for await (const filePath of glob(fullPattern)) {
    const rel = path.relative(rootDir, filePath);
    // Skip node_modules
    if (rel.includes('node_modules')) continue;

    const content = fs.readFileSync(filePath, 'utf-8');
    // Quick check: does this file have inline fontSize or color styles?
    if (!/style=\{\{[^}]*(?:fontSize|color:\s*'var\(--c-)/.test(content)) continue;

    const count = processFile(filePath);
    if (count > 0) {
      console.log(`  ✓ ${rel} — ${count}건 변환`);
      totalFiles++;
    }
  }
}

console.log(`\n=== 완료: ${totalFiles}개 파일, ${totalConverted}건 변환 ===`);
