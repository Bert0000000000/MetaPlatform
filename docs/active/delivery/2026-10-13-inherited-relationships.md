# 子类关系适用与共享图谱交付记录

依据：[产品 1.1 用户授权补充](../specs/2026-10-11-metaplatform-product-v1.1.md)、[实施计划](../../superpowers/plans/2026-10-13-inherited-relationships.md)、[ADR-0083](../decisions/ADR-0083-data-driven-modeling-phase1.md)。工作树 `.ci/pr106-integration`，分支 `codex/ontology-exact-name-check`，承接同分支的精确同名独立提示修复。

## 实际行为

关系定义的源、目标类型允许同租户合法后代实例，沿权威 `parent_class` 完整上溯。HTTP、内存和 PostgreSQL 使用同一继承规则；不从接口或其他 subclass 公理推断端点兼容。缺失、归档、循环或跨租户的父链拒绝推断；父类不能反向使用子类专有关系。PostgreSQL 在原生写入事务中再次验证并共享锁定父链，保留端点及关系定义锁、幂等和原有基数约束。

`ontInspectV2Class` 的 links 新增可选 `inherited_from`，继承适用时为声明端点 RID，直接关系为空。`ontCreateV2LinkInstance` 契约说明后代兼容。父类实例查询本已包含后代，本轮回归实际核对；建模同步复用同一个原生写入入口，没有复制关系定义或实例。

候选预览和正式工作台共用渲染器：紫色实线、空心三角指向父类，表示“是一种”；业务关系使用普通箭头。默认显示直接定义，子类详情列出适用关系及声明父类。勾选“显示继承适用关系”后以虚线普通箭头投影当前子类适用关系。投影只用于展示，点击、高亮和编辑均指向原关系 RID。工作台使用完整类型及关系目录计算适用性，筛选隐藏声明父类后仍能展示子类与可见对端之间的投影。

## 外部设计依据

Palantir 官方文档描述的是 interfaces、扩展和具体对象实现时的约束映射，不能据此断言具体对象子类自动继承 LinkTypes。空心三角为本平台采用的通用建模图示，不宣称为 Palantir 强制标准。官方来源：[接口概览](https://www.palantir.com/docs/foundry/interfaces/interface-overview/)、[接口关系](https://www.palantir.com/docs/foundry/interfaces/interface-link-types-overview/)、[扩展接口](https://www.palantir.com/docs/foundry/interfaces/extend-interface/)、[实现接口](https://www.palantir.com/docs/foundry/interfaces/implement-interface/)。

## 本地验证

| 范围 | 结果 |
| --- | --- |
| 真实 PostgreSQL 建模集成和关系写入，包括内存/PG 两端多级继承、方向拒绝、跨租户、幂等、inspect、父类查询和原基数冲突 | 79 passed，0 skipped |
| 必需六组 PostgreSQL 门禁：迁移、同步、原子性、关系并发、版本、查询 | 123 passed，0 skipped；实际采集核对身份 |
| 前端 from-data 与 graph | 112 passed，17 files；包含筛选隐藏父类和原关系选中回归 |
| TypeScript / Vite 生产构建 | 退出码 0；保留既有 chunk size 警告 |
| Ruff 和 git diff --check | 通过 |
| 独立端口 59277、真实 Chromium、实际 CandidateGraph/SchemaGraphCanvas/ModelInspector、固定植物场景 | 三条继承线、按需投影、声明父类、原 RID 点击/高亮、隐藏父类后投影、浅深主题均通过，无 pageerror |
| 代码复审 | 筛选导致投影丢失问题已修复；增量复审未发现剩余实质问题 |

依赖复用原 Python 3.12 venv 和 node_modules junction，本轮没有重装或修改锁文件。数据库为本轮独立 `pgvector/pgvector:pg16` 容器、独立端口、NOSUPERUSER/NOBYPASSRLS 业务角色；执行 `test_modeling_integration.py` 和 `test_mp11_relationship_writes.py`，随后运行 `scripts/ci/verify_ont_postgres.py`，JUnit 为本地 `.ci/inherited-modeling.xml` 与 `.ci/inherited-postgres.xml`。只停止本轮创建的容器和测试前端进程，不改变用户运行服务、数据库、配置或现存工作树。

## 验收边界

浏览器固定数据烟测不能代替真实服务端 E2E。没有单独新增后代端点的 Excel 同步端到端场景；当前证据为既有真实建模同步回归和新增原生关系写入回归。PR/主干 CI、部署与业务验收单独登记，尚未记为通过。修改尚未切换到用户原运行工作区。
