# ONT-G10 — PALANTIR 三层对齐验收（Semantic / Kinetic / Dynamic）

> 日期: 2026-09-09 · 状态: [~]（Semantic/Kinetic 对位已实现并留证；Dynamic 对位见 §3 留尾项）

## 1. Semantic Layer（语义层）— [x]

| Palantir 概念 | Mate Platform 实现 | 证据 |
|---|---|---|
| Ontology 类型（Object/Link Types） | ObjectType / LinkType（12 基元，PG 持久化）| SPRINT3-ACCEPTANCE §3（G6 12/12）|
| 属性与关系 | Property / LinkInstance | kernel types/* |
| 推理（Axiom） | Axiom 注册中心 + reasoning engine（R1/R2/R3）| ONT-G16-G13-REASONING-ACCEPTANCE |
| 数据集线（Datasets） | Dataset/DataProduct/DataJob CRD + lineage/quality | infra/helm/charts/datahub + SPRINT5-ACCEPTANCE §7 |
| 数据质量与谱系 | quality rules 执行落 PG + lineage 子图 | SPRINT5-ACCEPTANCE §7 |

## 2. Kinetic Layer（行动层）— [x]

| Palantir 概念 | Mate Platform 实现 | 证据 |
|---|---|---|
| Action Types（受控写回） | ActionType + proposal 状态机（pending→confirmed→executed→reverted）| MP-ACTION-CONFIRM-01 |
| Functions（派生计算） | Function 注册面 + kernel function_resolver（执行语义增量 PRD-30 FR-RSN-004）| SPRINT5-ACCEPTANCE §1 |
| 写回一致性 | kernel writeback 校验门（SAL §5 措施）| writeback.py + 6 单测 |
| 运行时拦截 | composition PolicyEngine deny-first | composition/policy.py |

## 3. Dynamic Layer（动态层）— [~]（ONT-G22 留尾）

- Functions on Objects SDK：ontology-sdk typed client 已提供 SDK 面（本次交付）；
  自动生成器已交付（G6，56 方法）。
- Models（ML 模型对象）与 dynamic security（marking 驱动的动态可见性）：
  marking 已在 ObjectType/Property 一等支持（SAL-06/07）；模型对象注册面留尾。

## 结论

三层对位：Semantic/Kinetic 均有实现与真实证据；Dynamic 的 SDK 面已由 G6/G11
覆盖，模型对象与动态安全联动作为 ONT-G22 增量。对齐度满足 [~]（v1.0 范围内
Semantic/Kinetic 完整、Dynamic 部分）。
