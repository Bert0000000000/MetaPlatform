# PRD-33 本体对齐与合并（alignment / merging / modularization）
> 版本: v1.1 · 日期: 2026-09-08 · 状态: [~]（ONT-G33 最小闭环已交付：alignment kernel（same_as 显式+词汇+结构相似，R2 并查集聚类）+ 类型合并（字段并集+冲突标记+keep_left/keep_right 策略+合并审计）+ REST 端点 2 个（契约先行 ontAlignV2Individuals / ontPreviewV2ObjectTypeMerge）+ 单测 9 全绿 + live 2 项经网关；modularization 留增量）
> 关联: 本体理论 / Sprint 5+
> FR: FR-ALIGN-001..003
FR-ALIGN-001 跨本体等价/相似对齐（same_as / 词汇匹配起点）[x] kernel `alignment.align_individuals`：explicit_pairs 显式 same_as + 词汇证据（label 规范化相等）+ 结构证据（属性 slug + 值签名 Jaccard ≥0.5，跨本体可比）；聚类复用 reasoning R2 并查集传递闭包；matched_pairs 带证据链与分数
FR-ALIGN-002 合并策略与冲突消解 [x] kernel `alignment.merge_object_types`：字段并集（按 Property rid）、同 rid 属性字段级冲突标记（type_id/nullable/format 等，含两侧值与消解值）、策略 keep_left / keep_right、合并审计（merged_from/into/strategy/added/conflicts/计数）；PK 并集满足 ObjectType 不变量；REST ontPreviewV2ObjectTypeMerge（stateless 预览，实例重映射仍走 MP-DEDUP-01 ontMergeV2ObjectTypes，二者互补）
FR-ALIGN-003 模块化抽取（modularization）[ ] 留增量（按 axioms/usage 的模块边界识别与抽取，后续批次）
