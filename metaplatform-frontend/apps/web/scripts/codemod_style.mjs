/**
 * Inline style → 令牌工具类 codemod（UI-P2d 收尾）。
 *
 * 安全设计：
 *  1. 只在**同一 JSX 标签的属性区**内找已有 className（用带字符串/花括号感知的
 *     scanner 定位标签边界，避免 `=>` 里的 `>` 或泛型里的 `<` 误判）。
 *  2. 已有 className 是动态表达式（`className={...}`）时**跳过**该处，不猜。
 *  3. 每个文件改完后用 esbuild 以 tsx 语法重新解析；**解析失败就整文件回退**。
 *
 * 用法： node codemod_style.mjs [--apply]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const SRC = path.join(path.dirname(fileURLToPath(import.meta.url)), '../src');
// apps/web/node_modules 下直接可解析（esbuild 只在 pnpm 的 .pnpm 里，够不着）
const require = createRequire(path.join(SRC, '../package.json'));
const ts = require('typescript');
const APPLY = process.argv.includes('--apply');

const SPACE = { 4: 1, 8: 2, 12: 3, 16: 4, 20: 5, 24: 6, 32: 7, 40: 8, 48: 9, 64: 10 };
const FONT = { 11: 'mp-text-xs', 12: 'mp-text-sm', 13: 'mp-text-body', 14: 'mp-text-md', 16: 'mp-text-lg', 20: 'mp-text-xl' };
const COLOR = {
  'var(--semi-color-text-0)': 'mp-text-1',
  'var(--semi-color-text-1)': 'mp-text-1',
  'var(--semi-color-text-2)': 'mp-text-2',
  'var(--semi-color-text-3)': 'mp-text-3',
  'var(--semi-color-danger)': 'mp-text-danger',
  'var(--semi-color-success)': 'mp-text-success',
  'var(--semi-color-warning)': 'mp-text-warning',
  'var(--semi-color-primary)': 'mp-text-primary',
};
const ICON = new Set([12, 14, 16, 18, 20]);
const WIDTHS = new Set([120, 140, 160, 180, 200, 240, 280, 320, 360]);
const FONT_KEYS = Object.keys(FONT).map(Number);
const SPACE_KEYS = Object.keys(SPACE).map(Number);

/** 非令牌数值吸附到最近的档位（并列取小）——DESIGN-SPEC §4.1 只允许这 10 个值。 */
function snap(n, keys) {
  let best = keys[0];
  for (const k of keys) if (Math.abs(k - n) < Math.abs(best - n)) best = k;
  return best;
}

/** 顶层逗号切分（忽略引号/括号内的逗号）。 */
function splitProps(body) {
  const out = [];
  let buf = '', depth = 0, quote = null;
  for (const ch of body) {
    if (quote) { buf += ch; if (ch === quote) quote = null; continue; }
    if (ch === '"' || ch === "'" || ch === '`') { quote = ch; buf += ch; continue; }
    if ('([{'.includes(ch)) depth++;
    else if (')]}'.includes(ch)) depth--;
    if (ch === ',' && depth === 0) { out.push(buf); buf = ''; continue; }
    buf += ch;
  }
  if (buf.trim()) out.push(buf);
  return out.map((s) => s.trim()).filter(Boolean);
}

const unquote = (v) => { v = v.trim(); return v.length > 1 && (v[0] === '"' || v[0] === "'") && v.at(-1) === v[0] ? v.slice(1, -1) : v; };
const numOf = (v) => (/^\d+$/.test(v.trim()) ? parseInt(v.trim(), 10) : null);

function mapProps(props) {
  const seen = {};
  for (const p of props) {
    const i = p.indexOf(':');
    if (i < 0) continue;
    seen[p.slice(0, i).trim()] = unquote(p.slice(i + 1));
  }
  let classes = [];
  const consumed = new Set();

  const w = numOf(seen.width ?? ''), h = numOf(seen.height ?? '');
  if (w !== null && w === h && ICON.has(w)) { classes.push(`mp-icon-${w}`); consumed.add('width').add('height'); }
  if (w === null && (seen.width ?? '').trim() === "'100%'") { }
  if (unquote(seen.width ?? '') === '100%') { classes.push('mp-w-full'); consumed.add('width'); }
  if (unquote(seen.height ?? '') === '100%') { classes.push('mp-h-full'); consumed.add('height'); }

  const BORDER = {
    '1px solid var(--semi-color-border)': 'mp-border',
    '1px solid var(--semi-color-text-2)': 'mp-border',
  };
  const single = {
    display: { flex: 'mp-flex', 'inline-flex': 'mp-inline-flex', block: 'mp-block', grid: 'mp-grid' },
    alignItems: { center: 'mp-items-center' },
    justifyContent: { 'space-between': 'mp-justify-between', 'flex-end': 'mp-justify-end', center: 'mp-justify-center' },
    textAlign: { center: 'mp-text-center' },
    overflow: { hidden: 'mp-hidden', auto: 'mp-overflow-auto' },
    overflowY: { auto: 'mp-overflow-y-auto' },
    fontWeight: { 500: 'mp-fw-500', 600: 'mp-fw-600' },
    fontVariantNumeric: { 'tabular-nums': 'mp-num' },
    cursor: { pointer: 'mp-clickable' },
    whiteSpace: { nowrap: 'mp-nowrap' },
    flexWrap: { wrap: 'mp-wrap' },
    wordBreak: { 'break-all': 'mp-break-all' },
    position: { relative: 'mp-relative', absolute: 'mp-absolute' },
    border: BORDER,
    borderBottom: BORDER,
    borderTop: BORDER,
  };
  for (const [name, table] of Object.entries(single)) {
    if (consumed.has(name) || !(name in seen)) continue;
    const v = seen[name];
    if (table[v]) { classes.push(table[v]); consumed.add(name); }
  }

  if (seen.flexShrink === '0') { classes.push('mp-shrink-0'); consumed.add('flexShrink'); }
  if (seen.minHeight === '0') { classes.push('mp-min-h-0'); consumed.add('minHeight'); }
  if (seen.maxWidth === '100%') { classes.push('mp-max-w-full'); consumed.add('maxWidth'); }
  if (seen.marginLeft === 'auto') { classes.push('mp-ml-auto'); consumed.add('marginLeft'); }

  // 单值 margin / 轴向 padding
  if ('margin' in seen && seen.margin !== '0') {
    const n = numOf(seen.margin);
    if (n !== null && n >= 8) { classes.push(`mp-m-${SPACE[snap(n, SPACE_KEYS)]}`); consumed.add('margin'); }
  }
  for (const [name, tpl] of [['marginLeft', 'mp-ml-'], ['marginRight', 'mp-mr-'], ['paddingBottom', 'mp-pb-'], ['paddingTop', 'mp-pt-']]) {
    if (consumed.has(name) || !(name in seen)) continue;
    const n = numOf(seen[name]);
    if (n !== null) { classes.push(tpl + SPACE[snap(n, SPACE_KEYS)]); consumed.add(name); }
  }
  // 双值 padding：'14px 20px' -> 纵向 + 横向
  if (!consumed.has('padding') && 'padding' in seen) {
    const m2 = /^(\d+)px\s+(\d+)px$/.exec(seen.padding.trim());
    if (m2) {
      classes.push(`mp-py-${SPACE[snap(+m2[1], SPACE_KEYS)]}`, `mp-px-${SPACE[snap(+m2[2], SPACE_KEYS)]}`);
      consumed.add('padding');
    }
  }

  // 固定宽度（旧页面的输入框 / 下拉宽度）
  if (!consumed.has('width')) {
    const n = numOf(seen.width ?? '');
    if (n !== null && WIDTHS.has(n)) { classes.push(`mp-w-${n}`); consumed.add('width'); }
  }
  if (seen.maxWidth === '720') { classes.push('mp-max-w-720'); consumed.add('maxWidth'); }

  // 图标成对尺寸：不在标准集里的吸附到最近的档
  if (!consumed.has('width') && !consumed.has('height')) {
    const w2 = numOf(seen.width ?? ''), h2 = numOf(seen.height ?? '');
    if (w2 !== null && w2 === h2 && w2 <= 24) {
      classes.push(`mp-icon-${snap(w2, [...ICON])}`); consumed.add('width').add('height');
    }
  }

  const misc = {
    fontFamily: { monospace: 'mp-mono', 'var(--mp-font-mono)': 'mp-mono', 'var(--mp-font-sans)': 'mp-sans' },
    background: { 'var(--semi-color-fill-0)': 'mp-bg-fill-0', 'var(--semi-color-fill-1)': 'mp-bg-fill-1', 'var(--semi-color-bg-1)': 'mp-bg-1' },
    alignItems: { 'flex-start': 'mp-items-start', 'flex-end': 'mp-items-end' },
    height: { 'fit-content': 'mp-h-fit' },
    gridTemplateColumns: { '1fr 1fr': 'mp-grid-2' },
    animation: { 'osp-spin 1s linear infinite': 'mp-spin', 'mp-spin 1s linear infinite': 'mp-spin' },
    textAlign: { right: 'mp-text-right', left: 'mp-text-left' },
    pointerEvents: { none: 'mp-pe-none' },
    border: { none: 'mp-border-none' },
    opacity: { '0.6': 'mp-opacity-60', '0.7': 'mp-opacity-70' },
    maxHeight: { '320': 'mp-max-h-320', '480': 'mp-max-h-480' },
    minWidth: { '0': 'mp-min-w-0' },
  };
  for (const [name, table] of Object.entries(misc)) {
    if (consumed.has(name) || !(name in seen)) continue;
    const v = seen[name];
    if (table[v]) { classes.push(table[v]); consumed.add(name); }
  }
  if (!consumed.has('flexDirection') && seen.flexDirection === 'column') {
    classes.push('mp-flex-col'); consumed.add('flexDirection');
  }
  if (seen.lineHeight === '1.6') { classes.push('mp-lh-16'); consumed.add('lineHeight'); }
  if (!consumed.has('textOverflow') && seen.textOverflow === 'ellipsis') {
    classes.push('mp-ellipsis-text'); consumed.add('textOverflow');
  }
  if (seen.borderRadius === 'var(--semi-border-radius-medium)') { classes.push('mp-rounded'); consumed.add('borderRadius'); }
  if (seen.borderRadius === 'var(--semi-border-radius-large)') { classes.push('mp-rounded-lg'); consumed.add('borderRadius'); }
  if (!consumed.has('borderRadius') && 'borderRadius' in seen) {
    const n = numOf(seen.borderRadius);
    if (n !== null) {
      classes.push(n <= 4 ? 'mp-rounded-sm' : n <= 8 ? 'mp-rounded' : 'mp-rounded-lg');
      consumed.add('borderRadius');
    }
  }

  // display:flex + flexDirection:column -> 收敛成 mp-flex-col（自带 display:flex）
  if (seen.display === 'flex' && seen.flexDirection === 'column') {
    classes = classes.filter((c) => c !== 'mp-flex');
    classes.push('mp-flex-col');
    consumed.add('display').add('flexDirection');
  }

  // overflow/textOverflow/whiteSpace 三件套 -> mp-ellipsis
  if (seen.textOverflow === 'ellipsis' && seen.overflow === 'hidden' && seen.whiteSpace === 'nowrap') {
    classes = classes.filter((c) => c !== 'mp-hidden' && c !== 'mp-nowrap');
    classes.push('mp-ellipsis');
    consumed.add('textOverflow').add('overflow').add('whiteSpace');
  }

  if (seen.flex === '1') {
    classes.push('mp-flex-1'); consumed.add('flex');
    if (seen.minWidth === '0') consumed.add('minWidth');
  }

  for (const [name, tpl] of [['marginTop', 'mp-mt-'], ['marginBottom', 'mp-mb-'], ['gap', 'mp-gap-'], ['padding', 'mp-p-']]) {
    if (name in seen) {
      const n = numOf(seen[name]);
      if (n !== null) { classes.push(tpl + SPACE[snap(n, SPACE_KEYS)]); consumed.add(name); }
    }
  }
  if (seen.margin === '0') { classes.push('mp-m-0'); consumed.add('margin'); }

  if ('fontSize' in seen) {
    const n = numOf(seen.fontSize);
    if (n !== null) { classes.push(FONT[snap(n, FONT_KEYS)]); consumed.add('fontSize'); }
  }
  if (seen.color && COLOR[seen.color]) { classes.push(COLOR[seen.color]); consumed.add('color'); }

  if (classes.includes('mp-flex') && classes.includes('mp-items-center')) {
    classes = classes.filter((c) => c !== 'mp-flex' && c !== 'mp-items-center');
    classes.push('mp-flex-center');
  }

  const leftover = props.filter((p) => {
    const i = p.indexOf(':');
    return i < 0 || !consumed.has(p.slice(0, i).trim());
  });
  return { classes, leftover };
}

/** 从 pos 处的 style={{ 定位所在标签的 [start, end)（对字符串/花括号/JSX 感知）。 */
function enclosingTag(src, pos) {
  // 向前找标签起始的 '<'（跳过字符串与花括号表达式里的 '<'）
  let i = pos - 1, depthBr = 0, quote = null, tagStart = -1;
  for (; i >= 0; i--) {
    const ch = src[i];
    if (quote) { if (ch === quote && src[i - 1] !== '\\') quote = null; continue; }
    if (ch === '"' || ch === "'" || ch === '`') { quote = ch; continue; }
    if (ch === '}') depthBr++;
    else if (ch === '{') { if (depthBr === 0) return null; depthBr--; }
    else if (ch === '<' && depthBr === 0) { tagStart = i; break; }
  }
  if (tagStart < 0) return null;
  // 向后找标签结束的 '>'（同一层）
  let j = pos, d = 0, q2 = null;
  for (; j < src.length; j++) {
    const ch = src[j];
    if (q2) { if (ch === q2 && src[j - 1] !== '\\') q2 = null; continue; }
    if (ch === '"' || ch === "'" || ch === '`') { q2 = ch; continue; }
    if (ch === '{') d++;
    else if (ch === '}') d--;
    else if (ch === '>' && d === 0) return { start: tagStart, end: j };
  }
  return null;
}

const CN_RE = /className="([^"{}]*)"/g;

/**
 * 把 `{...}` 区域整体替换成等长空格，长度不变故索引可直接复用。
 * 用途：标签属性区里可能嵌着 JSX（`title={<span className="x" />}`），
 * 掩码后只剩**本元素自己的**顶层属性，避免把类名合并到嵌套元素上。
 */
function maskBraces(seg) {
  let out = '', d = 0;
  for (const ch of seg) {
    if (ch === '{') { d++; out += ' '; continue; }
    if (ch === '}') { d = Math.max(0, d - 1); out += ' '; continue; }
    out += d > 0 ? (ch === '\n' ? '\n' : ' ') : ch;
  }
  return out;
}

function transform(src) {
  const spans = [];
  const re = /style=\{\{/g;
  let m;
  while ((m = re.exec(src))) {
    const i = m.index + m[0].length;
    let depth = 0, j = i;
    for (; j < src.length; j++) {
      const ch = src[j];
      if (ch === '{') depth++;
      else if (ch === '}') { if (depth === 0) break; depth--; }
    }
    if (src[j] !== '}' || src[j + 1] !== '}') continue;
    const body = src.slice(i, j);
    if (body.length > 2000) continue; // 异常长的对象多半不是纯样式，留给人工
    spans.push({ start: m.index, end: j + 2, body });
  }
  if (!spans.length) return { out: src, hits: 0 };

  let out = src, hits = 0;
  for (const sp of spans.reverse()) {
    const props = splitProps(sp.body);
    const { classes, leftover } = mapProps(props);
    if (!classes.length) continue;
    const cls = classes.join(' ');
    const style = leftover.length ? `style={{ ${leftover.join(', ')} }}` : '';

    const tag = enclosingTag(out, sp.start);
    if (!tag) continue;

    // 该标签属性区内已有的静态 className？（先掩掉嵌套 {…}，只看本元素顶层属性）
    const seg = out.slice(tag.start, tag.end);
    const masked = maskBraces(seg);
    CN_RE.lastIndex = 0;
    let found = null, mm;
    while ((mm = CN_RE.exec(masked))) found = { text: seg.substr(mm.index, mm[0].length), idx: mm.index, value: mm[1] };
    if (/className=\{/.test(masked)) {
      // 动态 className：不猜，整处跳过
      continue;
    }
    if (found) {
      const absStart = tag.start + found.idx;
      const merged = `${found.value} ${cls}`.trim();
      out = out.slice(0, absStart) + `className="${merged}"` + out.slice(absStart + found.text.length, sp.start) + style + out.slice(sp.end);
    } else {
      out = out.slice(0, sp.start) + `className="${cls}"` + (style ? ` ${style}` : '') + out.slice(sp.end);
    }
    hits++;
  }
  return { out, hits };
}

function validate(code) {
  const res = ts.transpileModule(code, {
    fileName: 'candidate.tsx',
    reportDiagnostics: true,
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ESNext, isolatedModules: true },
  });
  return !(res.diagnostics ?? []).some((d) => d.category === ts.DiagnosticCategory.Error);
}

let files = 0, hits = 0, skipped = 0;
for (const root of walk(SRC)) {
  const p = path.join(root);
  const src = fs.readFileSync(p, 'utf8');
  if (!src.includes('style={{')) continue;
  const { out, hits: n } = transform(src);
  if (!n) continue;
  if (!validate(out)) {
    skipped++;
    const dump = p + '.invalid';
    fs.writeFileSync(dump, out);
    console.log('  SKIP (invalid after transform):', path.relative(SRC, p), '->', path.relative(SRC, dump));
    continue;
  }
  files++; hits += n;
  if (APPLY) fs.writeFileSync(p, out);
}

function* walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else if (e.name.endsWith('.tsx')) yield p;
  }
}

console.log(`${APPLY ? 'APPLIED' : 'DRY-RUN'}: files=${files} conversions=${hits} skipped=${skipped}`);
