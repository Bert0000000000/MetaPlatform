# APP 模块详细规范索引

> **版本**: v1.0 | **日期**: 2026-07-27
> **目的**: 提供 8 份详细规范文件的导航与统一入口

---

## 1. 文件清单

| 模块 | 详细规范文件 | 大小 | 关联主 PRD | 关联 API 契约 |
|---|---|---|---|---|
| APP-APPHUB | PRD-APP-APPHUB-应用中心-详细规范_v1.0-20260727.md | 27.6KB | PRD-APP-APPHUB-应用中心_v2.2 | API-CONTRACT §3.2, §3.3 |
| APP-ARCH | PRD-APP-ARCH-架构中心-详细规范_v1.0-20260727.md | 15.7KB | PRD-APP-ARCH-架构中心_v2.2 | API-CONTRACT §3.9 |
| APP-DASHBOARD | PRD-APP-DASHBOARD-仪表盘-详细规范_v1.0-20260727.md | 18.1KB | PRD-APP-DASHBOARD-仪表盘_v2.3 | API-CONTRACT §3.6 |
| APP-DW | PRD-APP-DW-数字员工-详细规范_v1.0-20260727.md | 21.0KB | PRD-APP-DW-数字员工_v2.4 | API-CONTRACT §3.7 |
| APP-KB | PRD-APP-KB-知识库-详细规范_v1.0-20260727.md | 7.4KB | PRD-APP-KB-知识库_v1.2 | API-CONTRACT §3.8, §3.12 |
| APP-MCPHUB | PRD-APP-MCPHUB-MCP服务中心-详细规范_v1.0-20260727.md | 12.8KB | PRD-APP-MCPHUB-MCP服务中心_v2.2 | API-CONTRACT §3.10 |
| APP-ONTSTUDIO | PRD-APP-ONTSTUDIO-本体论引擎-详细规范_v1.0-20260727.md | 14.3KB | PRD-APP-ONTSTUDIO-本体论引擎_v2.2 | API-CONTRACT §3.11 |
| APP-COPILOT | PRD-APP-COPILOT-详细规范_v1.0-20260727.md | 22.3KB | PRD-APP-COPILOT_v2.3 | API-CONTRACT §3.4, §3.5, §3.13, §3.14 |

**总计 8 份详细规范，约 140KB**

---

## 2. 详细规范统一结构

每份详细规范均包含以下章节：

| 章节 | 内容 |
|---|---|
| 1. 完整数据模型 | 实体清单 + 关键实体字段定义（10-22 个实体） |
| 2. 完整 API Schema | 关键端点的 JSON Schema 2020-12 定义（10-15 个端点） |
| 3. 状态机 | 用 mermaid stateDiagram 描述关键实体的状态转移 |
| 4. 业务规则 | BR-XXX 编号规则列表（30-60 条） |
| 5. 权限矩阵 | 角色 × 资源 × 操作矩阵 |
| 6. 性能要求 | P50/P99/QPS 指标 |
| 7. 安全要求 | 鉴权、加密、审计、限流等 |
| 8. (可选)国际化 | i18n key 命名规范 |
| 9. (可选)测试要求 | 单元/集成/契约/E2E 测试 |

---

## 3. 详细规范与主 PRD 的关系

```
主 PRD（业务视角）
  ├─ 1. 模块概述
  ├─ 2. 用户动线
  ├─ 3. 功能详情（业务场景）
  ├─ 4. 增量交付计划
  ├─ 5. 依赖关系
  ├─ 6. API 接口概要（Q2=B 归属）
  ├─ 7. 数据模型概要
  └─ 8. 待补交互清单

详细规范（实现视角）
  ├─ 1. 完整数据模型（实体字段）
  ├─ 2. 完整 API Schema（JSON Schema）
  ├─ 3. 状态机
  ├─ 4. 业务规则（编号）
  ├─ 5. 权限矩阵
  ├─ 6. 性能要求
  └─ 7. 安全要求
```

**关系**: 主 PRD 是"做什么"，详细规范是"怎么做"。两者互补。

---

## 4. 使用指引

### 4.1 后端开发
- 先读 `API-CONTRACT-前端接口契约清单_v1.0-20260727.md` §3.x（端点清单）
- 再读各模块详细规范 §2（JSON Schema）和 §1（数据模型）
- 然后实现 Controller + Service + Repository

### 4.2 前端开发
- 主 PRD + 详细规范是参考；当前已基于前端代码实现
- 「待补交互清单」按 P0/P1/P2 排期补全

### 4.3 测试
- 详细规范 §5 权限矩阵 → 权限测试用例
- §4 业务规则 → 业务测试用例
- §3 状态机 → 状态转移测试用例
- §2 JSON Schema → 契约测试用例

### 4.4 运维
- 详细规范 §6 性能要求 → 性能监控指标
- §7 安全要求 → 安全审计检查点
- §1 数据模型 → 数据库设计依据

---

## 5. 关联文档

- `docs/prd/_top/API-CONTRACT-前端接口契约清单_v1.0-20260727.md` —— 141 端点契约
- `docs/prd/_top/PLAN-前后端并行开发接口边界_v1.0-20260727.md` —— 并行开发规范
- `docs/prd/_top/REPORT-前端实现与PRD差异盘点_v1.0-20260727.md` —— 差异盘点
- `docs/prd/_top/PLAN-Mate_Platform-PRD交叉验证与迭代主线规划_v3.0-20260727.md` —— 主线规划 v3.0

---

## 6. 后续维护

### 6.1 新增字段时
- 在详细规范 §1 添加字段
- 在主 PRD §7 数据模型概要同步
- 同步 API-CONTRACT.md（如涉及 API）

### 6.2 新增端点时
- 在详细规范 §2 添加 JSON Schema
- 在主 PRD §6 API 接口概要同步
- 在 API-CONTRACT.md 添加端点

### 6.3 状态机变更时
- 在详细规范 §3 更新 mermaid 图
- 同步更新业务规则

### 6.4 业务规则变更时
- 在详细规范 §4 增删改 BR-XXX
- 评估是否影响主 PRD §3 功能详情
