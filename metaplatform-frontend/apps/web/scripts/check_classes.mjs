/**
 * 校验：TSX 里用到的每个 mp-* 类是否都有 CSS 定义。
 * 用途：codemod 与多人并行搬运样式时，最可能的回归是「类名写了但样式没落地」
 * （tsc 不会报，只会静默失效）。这个脚本把这类悬挂类抓出来。
 *
 * 用法： node scripts/check_classes.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOTS = [
  path.join(HERE, '../src'),
  path.join(HERE, '../../../packages/shared/src'),
];

const defined = new Set();
const usedIn = new Map(); // class -> [files]
// 已知豁免：
//  - mp-attr-badge 定义在 OntologyModelingPage 的内联 <style> 块里（本脚本只扫 .css）
//  - mp-home-card-* 是 P1b 留下的 Playwright 选择器钩子，刻意不带样式
const EXTRA_DEFINED = new Set([
  'mp-attr-badge',
  'mp-home-card-feed',
  'mp-home-card-links',
  'mp-home-card-todos',
  'mp-home-card-agents',
]);
const dynamicBases = new Set(); // `mp-x--${tone}` 这类动态类的静态前缀
// 变量形式使用（className={`x ${cond ? 'y' : ''}`}）也算命中
const USED_RE = /className=(?:"([^"]*)"|\{`([^`]*)`\}|\{'([^']*)'\})/g;
const CLASS_RE = /\b(mp-[a-zA-Z0-9-]+)\b/g;
// 出现在 `${` 之前的类名片段不是完整类名
const DYNAMIC_RE = /(mp-[a-zA-Z0-9-]*?)-(?=\$\{)/g;

function* walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else yield p;
  }
}

// 1) 收集所有 CSS 里定义的 .mp-* 类（含 :hover / --modifier 等后缀变体）
for (const root of ROOTS) {
  for (const p of walk(root)) {
    if (!p.endsWith('.css')) continue;
    const src = fs.readFileSync(p, 'utf8');
    for (const m of src.matchAll(/\.((?:mp|om)-[a-zA-Z0-9_-]+)/g)) defined.add(m[1]);
  }
}

// 2) 收集 TSX/TS 里用到的 mp-* 类
let total = 0;
for (const root of ROOTS) {
  for (const p of walk(root)) {
    if (!p.endsWith('.tsx') && !p.endsWith('.ts')) continue;
    const src = fs.readFileSync(p, 'utf8');
    for (const m of src.matchAll(DYNAMIC_RE)) dynamicBases.add(m[1].replace(/-+$/, ''));
    for (const m of src.matchAll(USED_RE)) {
      const raw = m[1] ?? m[2] ?? m[3] ?? '';
      // 模板串里可能夹着表达式，按 token 拆
      for (const c of raw.matchAll(CLASS_RE)) {
        total++;
        if (!usedIn.has(c[1])) usedIn.set(c[1], new Set());
        usedIn.get(c[1]).add(path.relative(HERE, p));
      }
    }
  }
}

const missing = [...usedIn.entries()].filter(
  ([c]) => !defined.has(c) && !dynamicBases.has(c) && !EXTRA_DEFINED.has(c),
);
console.log(`类引用实例: ${total}  唯一类: ${usedIn.size}  已定义: ${defined.size}`);
if (missing.length === 0) {
  console.log('OK：所有引用的类都有 CSS 定义');
} else {
  console.log(`\n悬挂类 ${missing.length} 个（写了类名但没有样式落地）：`);
  for (const [c, files] of missing.sort()) {
    console.log(`  ${c}  <- ${[...files].slice(0, 4).join(', ')}${files.size > 4 ? ` …(+${files.size - 4})` : ''}`);
  }
  process.exitCode = 1;
}
