# 逆向发现本体：精确同名独立提示

依据：[ADR-0083](../decisions/ADR-0083-data-driven-modeling-phase1.md)。本次修复基于 main `08a84ec1`，使用隔离分支 `codex/ontology-exact-name-check`；保留原工作区的服务、数据库、配置及未提交文件。

## 行为

原相似扫描按语义分数截取前五，不能保证同名出现。候选审核和发布决策现在从完整授权目录单独列出全部精确同名对象、RID、定义，不受语义排名或服务失败影响。名称比较仅去除首尾空白并忽略大小写，保留内部空白和标点。稳定标识仅比较对象 slug，不误匹配租户或域。

后端 `ontValidateModelingCandidate` 使用完整租户目录核对默认新建；发现同名且未明确决策时返回对象级错误。明确新增仍保留同名警告，需要原发布流程确认；复用或扩展需要显式选择。既有稳定标识冲突仍拒绝新建。`ontPrecheckV2ObjectType` 契约未改变，同名提示不依赖它的前五结果。部分发布重试只排除指纹一致的本方案已完成或 inFlight 类型，外部同名仍提示。

进入审核、发布和窗口重新获得焦点时刷新完整目录；发布准备再次读取目录，失败时不显示旧目录继续确认。审核详情显示提示，但不自动保存或更改发布决策。

## 本地证据

| 验证 | 结果 |
| --- | --- |
| 后端 publication scope + phase1 merge | 39 passed |
| 真实 PostgreSQL 建模集成，包含人员/组织/产品各六个同名及跨租户排除 | 40 passed |
| 必需数据库门禁：迁移、同步、原子性、关系并发、版本、查询 | 123 executed，0 skipped，六组完整 |
| 同步最新 main 后前端 from-data、graph、HTTP operations | 110 passed，17 files |
| TypeScript / Vite 构建 | 通过；构建保留已有 chunk size 警告 |
| Chromium 实际 FromDataPage，模拟 API，独立端口 59277 | 三种对象各六个同名位于第二页、语义结果为空仍全部显示；返回审核刷新；不写草稿；目录失败清除旧匹配并明确提示；无 pageerror |
| 代码复审 | 部分发布重试、目录过期两项发现已修复，复审未发现剩余实质问题 |

使用原工作区已锁定的依赖，通过现有 node_modules junction 和 Python 3.12 venv 执行；本轮未重装或更改锁文件。后端命令为 `python -m pytest packages/mate-tech-ont/tests/test_modeling_publication_scope.py packages/mate-tech-ont/tests/test_modeling_phase1_merge.py -q`。数据库使用独立 `pgvector/pgvector:pg16` 容器及 NOSUPERUSER / NOBYPASSRLS 业务角色，以 `scripts/ci/verify_ont_postgres.py --junit .ci/exact-name-postgres.xml` 实际采集、执行并核对身份。成功运行的容器 `ont-exact-name-pg-20261013-05c196` 已停止，仅保留本轮资源。

局部浏览器模拟不等于真实服务端端到端验收。PR/主干 CI、部署及业务验收另行登记，不能由本地测试代替。原正在运行的工作区尚未切换到本修复。

## 用户追加的子类关系问题（修复前记录）

共同关系只定义在“植物标本”上，概念上可适用于其子类，但当前平台没有完整实现关系端点的子类型兼容。`OntologyGraphView` 详情仅筛选直接端点；`v2_kernel/api.py` 的关系实例创建和 `pg_repo.py` 事务内复核均要求实例 class_rid 与关系定义端点完全相等。因此不能把图上没有子类连线解释为已自动继承父类关系。

该问题已由同分支后续修复承接，详见[子类关系交付记录](2026-10-13-inherited-relationships.md)。子类特有关系仍应直接定义在该子类。
