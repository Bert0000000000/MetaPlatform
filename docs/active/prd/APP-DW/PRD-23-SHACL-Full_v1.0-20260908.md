# PRD-23 SHACL 完整实现（W3C SHACL Core）
> 版本: v1.1 · 日期: 2026-09-08 · 状态: [x]（G14 第三批收口：Core 关键约束 + W3C 全集增量 severity 分级/sh:not/sh:languageIn/sh:qualifiedValueShape 全部落地——kernel 单测 30（16 Core + 14 增量）+ REST live 4 项经网关；仍未覆盖项见下方清单，均已如实登记）
> 关联: 蓝图 §7.4 / v3.2 阶段 2 / ONT-G14
> FR: FR-SHACL-001..005
FR-SHACL-001 NodeShape/PropertyShape 声明面 [x]
FR-SHACL-002 Core Constraint 组件（minCount/maxCount/datatype/class/pattern 等）[x]
FR-SHACL-003 验证报告（conforms + violations 结构化输出 + severity_counts）[x]
FR-SHACL-004 与 ontValidateV2* 集成（ontValidateV2Shacl 已交付）[x]
FR-SHACL-005 W3C 全集增量 [x]：severity 分级（Violation/Warning/Info，仅 Violation 影响 conforms，W3C 语义）/ sh:not（内嵌 shape 节点级取反）/ sh:languageIn（"@lang" 后缀与 {"@value","@language"} 双载体，无标签=违例）/ sh:qualifiedValueShape（qualifiedMinCount/qualifiedMaxCount）

## 覆盖清单（已实现约束）
- minCount / maxCount / datatype / pattern（仅字符串值适用）/ class / closed(+ignoredProperties)
- severity 分级 + severity_counts 报告聚合
- sh:not（PropertyShape 内嵌，节点级：datatype/pattern/class/languageIn）
- sh:languageIn
- sh:qualifiedValueShape + qualifiedMinCount/qualifiedMaxCount

## 未覆盖清单（如实，留后续增量）
- sh:node / sh:property 递归嵌套 shape 引用
- 路径表达式（sh:path 仅支持直接谓词；不支持 sh:alternativePath/inversePath/零或一）
- sh:in / sh:minLength / sh:maxLength / sh:minExclusive 等数值与字符串组件族
- sh:targetNode / sh:targetSubjectsOf / sh:targetObjectsOf（target 仅 class）
- W3C SHACL Test Suite 全量 conformance 套件（PRD-34）
- 报告 GRAPH 格式（当前为 JSON 结构化报告，非 RDF graph）
