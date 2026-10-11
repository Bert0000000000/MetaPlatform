# Reverse Model Assurance Implementation Plan

**Goal:** 提升逆向模型业务审核质量，保护既有平台能力及已发布本体。

**Architecture:** modeling 严格 Schema 增加可选审核元数据；结构与数据独立校验。assurance 模块负责只读复用对比和发布验收。前端沿用 Semi UI；原生接口、数据库表、正向行为不变。

**Tech Stack:** FastAPI/Pydantic/PostgreSQL16、React/TypeScript/Semi UI、pytest/Vitest/Playwright。

## Global Constraints
- 仅修改隔离工作树的逆向能力，不停止原环境，不自动确认、合并或重新发布真实本体。
- 旧字段缺省为 legacy，明确缺少证据；新基数规则需人工确认，未知可保存但不能作为已确认规则发布。
- entity 关联必须覆盖身份或经确认的替代唯一键；group 明确匹配集合，不能声称每个来源只有一个目标。
- 样本空值不决定业务身份；候选身份、已确认规则、来源记录策略和未确定状态分别记录。
- AI 审查可选；确定性校验、人工审核、原生 WIP/版本/指纹保护保持。

## Task 1 — Contract and deterministic rules
Files: modeling/core.py, contracts/openapi/services/ont.yaml, modeling_proposal.py, tests/test_modeling_assurance.py。
- [x] 契约：身份状态/候选/粒度/依据、替代唯一键、结构化证据；关系基数/状态/依据/关联模式。
- [x] 失败测试：复合键漏条件、替代唯一键、未知基数、身份缺值仅影响数据、实际基数超限、旧候选兼容。
- [x] 实现规则及 AI 输出去确认逻辑；同步前验证替代键和基数，无效时无写入。

## Task 2 — Native preview and acceptance
Files: modeling/assurance.py, publication.py, api.py, tests/test_modeling_integration.py。
- [x] 发布传递审核基数，兼容旧规则并警告；传递规则不宣称平台额外强制约束。
- [x] 只读复用对比返回定义/身份/属性类型/继承差异，禁止自动选定同名概念。
- [x] 方案显示增量；发布后重新读取核对原生定义，新增只读验收接口检测漂移。
- [x] PG 覆盖基数持久化、验收漂移和原有 WIP/指纹保护。

## Task 3 — Review UI
Files: api/ont/modeling.ts, from-data/{IdentityReview,RelationshipReview,ReuseComparison,PublicationAcceptance,DraftEditor,FromDataPage}.tsx。
- [x] 审核粒度、身份状态/候选/依据、基数/唯一键/关联模式，修改取消确认。
- [ ] 展示结构化证据与推断、复合键提示、复用对比和发布前后核验；同步仍可选。
- [x] 单测验证审核保存、冲突定位、发布完成及新增门禁。

## Task 4 — Verification
- [x] 核心/AI/ACL、Ruff、OpenAPI 解析与引用。
- [x] 逆向 PG 与原生六组门禁串行运行，不并发初始化共享回归库。
- [x] 前端类型、单测、构建、浏览器审核→发布→验收→重复同步。
- [x] 真实已发布来源仅只读核验，更新验收证据。

用户已批准范围，沿用 executing-plans 在当前会话实施，无需再次请求许可。
