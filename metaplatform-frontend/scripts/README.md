# lint_design — MetaPlatform 设计规范自动检查器

自动扫描 `src/` 下的 `.tsx/.ts/.jsx/.js` 文件, 检测是否违反 `.design_library/metaplatform/` 中定义的设计规范.

## 🚀 快速使用

通过 npm script (推荐):

```bash
# 检查 — 输出所有违规细节
npm run lint:design

# 自动修复 — 修复 font-size / radius / 渐变 / 违规彩色 / hex 颜色
npm run lint:design:fix

# 严格模式 — 任何违规都失败 (CI 用)
npm run lint:design:strict

# 安静模式 — 只输出汇总
npm run lint:design:quiet
```

直接调用 Python (任意 cwd):

```bash
python scripts/lint_design.py [选项]
```

## 📋 规则 (10 条)

| # | 规则 | 严重度 | 自动修复 |
|---|------|--------|---------|
| 1 | `text-[Npx]` 任意字号 | ❌ error | ✅ → text-xs/sm/base/lg/xl/2xl |
| 2 | `rounded-[Npx]` 任意圆角 | ❌ error | ✅ → rounded-sm/md/lg/full |
| 3 | `shadow-[custom]` 任意阴影 | ⚠️ warning | — (inset 用于 tab 允许) |
| 4 | `bg-gradient-to-*` 渐变 | ❌ error | ✅ → bg-primary |
| 5 | `bg-amber/violet/cyan/pink/...` 违规彩色 | ❌ error | ✅ → bg-primary |
| 6 | 自定义彩色 badge (colored-type-badges) | ❌ error | — |
| 7 | `hover:shadow-lg/xl` 阴影过大 | ⚠️ warning | — |
| 8 | `border-[#hex]` 任意颜色 | ❌ error | ✅ → border-border |
| 9 | `text-[#hex]` 任意颜色 | ❌ error | ✅ → text-foreground |
| 10 | `bg-[#hex]` 任意颜色 | ❌ error | ✅ → bg-card |

## 📊 当前状态

```
📊 结果:
   ❌ 错误: 0
   ⚠️  警告: 15
✅ 没有错误, 只有警告
```

警告 15 个全部是 `hover:shadow-lg/xl` (允许, 但建议后续优化)

## 🔧 自动修复的安全性

`--fix` 模式内置 JSX 完整性检查:

```python
# 修复前后比较 `<` 数量, 不一致则跳过 (避免破坏 JSX 标签)
if new_line.count("<") != v["raw"].count("<"):
    continue
```

## 🚫 豁免

- `.design_library/` 文件 (设计库本身)
- `src/components/ui/` shadcn 基础组件
- 注释行 (以 `//` / `*` 开头)
- 显式豁免标记: `// design-allow <rule>`

## 🔗 相关

- `.design_library/metaplatform/components/*.json` — 组件规范
- `.design_library/metaplatform/colors_and_type.css` — 颜色/字号 token
- `.design_library/metaplatform/SKILL.md` — 工具型 SKILL 文档

## 🛠 维护

新增规则? 编辑 `RULES` 列表:

```python
{
    "name": "my-rule",
    "regex": re.compile(r"\bmy-pattern\b"),
    "severity": "error",  # or "warning"
    "message": "提示信息",
    "fix_to": "token-name",  # or {N: "token"} for numbered
}
```