# PRD-07：Ontology Dedup

> 关联批次：MP-DEDUP-01 · 所属 Sprint：0
> 状态：`[~] Draft — 待产品评审` · 2026-08-31
> 事实基线：`docs/active/delivery/evidence/MP-DEDUP-01-ACCEPTANCE.md`

## 1. 目标与边界

防止同一租户内的 ObjectType 因 slug 重复或语义相近而持续分叉，并把合并做成可审查的业务变更。系统提供唯一约束和相似度候选，但绝不自动合并。

本期范围是 ObjectType：tenant + slug 唯一、embedding 相似度预检、候选比较、merge proposal、人工确认后的合并，以及来源类型归档。实例级实体去重、跨租户匹配、自动删除和不可追溯覆盖不在本期范围。

## 2. 用户旅程

1. 建模人员创建或编辑类型时，系统检查同租户 slug 冲突，并可请求相似候选。
2. 用户比较候选的名称、schema、属性映射、相似度和影响摘要。
3. 用户创建 merge proposal；AI 可建议，但不得直接执行。
4. 有权限的审核者确认，执行器合并 source 到 target、迁移映射允许的引用并归档 source。
5. 用户从 proposal/audit 查看结果；失败时 source 与 target 必须保持可恢复、可解释状态。

## 3. 业务规则

- `(tenant_id, slug)` 对未归档 ObjectType 唯一；预检查只改善体验，数据库唯一索引是并发竞争的最终防线。
- 相似度仅用于候选排序，不是合并决定。候选必须来自当前 tenant。
- 合并必须指定不同的 source/target，并展示 mapping 与影响摘要；不完整映射或验证错误时禁止执行。
- 合并通过 `merge_suggestion` proposal 状态机执行；确认前不得修改类型、实例或链接。
- 执行成功后 source 归档而非物理删除，审计可追溯 source、target、映射、影响和操作者。

## 4. 数据、权限与可观测性

系统保存 slug、archived 标记、候选证据、相似度版本、映射、影响摘要和 proposal/audit 引用。读取、预检、创建提议、确认和执行均校验 tenant 与角色；任何 409 冲突响应不得泄露其他租户 RID 或 schema。

对每次创建冲突、预检、proposal 和 merge 记录 trace/correlation ID。性能指标包括候选计算延迟、冲突率、合并成功率、失败分类和索引重建耗时。

## 5. 体验要求

Ontology Studio 在创建冲突时提供可行动提示，在 merge drawer 中并列展示 source/target、属性映射、受影响实例/链接与不可逆说明。确认前必须可返回并修改映射；终态 proposal 只读。页面不得把预检失败误显示为“没有重复”。

## 6. 验收标准

代码级验收覆盖 partial UNIQUE、同 tenant 冲突、跨 tenant 隔离、并发竞争的 409 处理、候选排序、proposal 守卫、归档 source 与映射/影响审计。

正式 GA 验收必须使用真实 PostgreSQL/RLS，验证并发创建、事务失败、跨租户访问、合并后引用一致性与回滚/补偿；并以真实 embedding provider 和目标数据规模提供索引与性能证据。此前状态保持 `[~]`。

## 7. 产品评审项

需要确认相似度展示阈值、归档类型的默认可见性、合并后是否支持受控撤销，以及高影响合并的双人审批策略。默认策略是只推荐、不自动合并、归档只读可见、单人显式确认。
