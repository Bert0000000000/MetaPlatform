#!/usr/bin/env node
/**
 * lint-design.mjs — Node 包装调用 Python lint_design.py
 *
 * 为什么要 Node 包装: 在 Windows 上 npm scripts 用 .bat 会触发 shim 警告,
 * 用 .mjs → spawn python 是最干净的方式, 跨平台.
 *
 * 用法 (通过 npm):
 *   npm run lint:design         ← 检查
 *   npm run lint:design:fix     ← 自动修复
 *   npm run lint:design:strict  ← 严格模式
 *   npm run lint:design:quiet   ← 只输出汇总
 *
 * 也可直接调用:
 *   node scripts/lint-design.mjs --fix
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SCRIPT = join(__dirname, "lint_design.py");

if (!existsSync(SCRIPT)) {
  console.error(`❌ 找不到 ${SCRIPT}`);
  process.exit(1);
}

// 解析 python 命令 (优先 python3, 否则 python)
function findPython() {
  const candidates = process.platform === "win32"
    ? ["python", "py", "python3"]
    : ["python3", "python"];
  for (const cmd of candidates) {
    const r = spawnSync(cmd, ["--version"], { stdio: "ignore" });
    if (r.status === 0) return cmd;
  }
  return null;
}

const python = findPython();
if (!python) {
  console.error("❌ 找不到 Python. 请先安装 Python 3.x 并加入 PATH.");
  process.exit(1);
}

// 透传参数 (去掉可能的 "node scripts/lint-design.mjs" 之外的 argv[0]/[1])
const args = process.argv.slice(2);

console.log(`🐍 ${python} ${SCRIPT} ${args.join(" ")}\n`);

const result = spawnSync(python, [SCRIPT, ...args], {
  stdio: "inherit",
});

process.exit(result.status ?? 1);