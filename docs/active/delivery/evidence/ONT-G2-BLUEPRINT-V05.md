# ONT-G2 — 蓝图 v0.5 任务（Palantir 核心页正文补抓 + 可证伪行替换）

> 日期: 2026-09-09 · 状态: [~]（七页摘录已落盘 + 蓝图 §0 已替换可证伪行；逐字全文需登录 Palantir 账号抓取，边界如实）

## 交付

1. **七页摘录**：`docs/active/specs/palantir_ontology_dump/`
   - object-types / link-types / action-types / functions / interfaces /
     markings / aip-agents-overview
   - 来源与抓取方式在每个文件头部注明（搜索快照摘录；非逐字全文——
     palantir.com 直连在本网络不可达，docs 站 301 至需登录门户）。
2. **蓝图 §0 替换**：`2026-08-06-ontology-kernel-blueprint.md` 的「待补抓」
   段已替换为「已补抓 + 五点对位」：
   - link 基数 1:1/1:N/N:N → LinkType
   - interfaces 共享 shape 多态 → Interface 基元
   - markings 强制控制 + 血缘传播 → marking + SAL-06
   - actions 变更集 + 副作用 → ActionType + proposal 状态机
   - AIP agents = Ontology SDK + 工具编辑 → SuperAI agent loop + MCP

## 与实现的对位验证

| Palantir 概念 | 蓝图/实现对位 | 状态 |
|---|---|---|
| object type = schema definition of entity/event | ObjectType + ClassRef | [x] |
| link type 1:1/1:N/N:N | LinkType（基数已支持）| [x] |
| action type = governed edits + side effects | ActionType + proposal 状态机（confirm→execute→revert）| [x] |
| functions on objects | Function 基元 + resolver（执行语义增量 PRD-30）| [~] |
| interfaces polymorphism | Interface 基元 + SAL-07 | [x] |
| markings mandatory control + propagate | marking + SAL-06 可见性 | [x] |
| AIP agents = Ontology SDK + tools | SuperAI agent loop + MCP 工具面 | [x] |
| dynamic security / models | models.py 注册 + 动态可见性（G22）| [~] |

## 边界

搜索摘录不能替代逐字全文引用（Palantir 文档门户需登录）；若需逐字引用，
在可登录 palantir.com 的网络环境重跑抓取并覆盖 dump 文件即可。
