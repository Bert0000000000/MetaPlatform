# PRD-14 ObjectSet 编译器一等算子
> 版本: v1.0 · 日期: 2026-09-09 · 状态: [x]（aggregate/traverse/filter live 已验 + 双后端对拍 3/3；media 属性一等支持降级为后续，归 PropertyFormat 扩展）
> 关联: SAL G1 P0 / ONT-G1
> FR: FR-OS-001..004
FR-OS-001 aggregate（sum/avg/count/group_by）
FR-OS-002 traverse links（LinkType 边遍历一等算子）
FR-OS-003 filter 表达式（精确/组合）
FR-OS-004 双后端对拍（PG ≡ InMemory 同 IR 同结果）

证据：test_objectset_parity.py + PG execute_object_query 经网关 live（真数据聚合/遍历/过滤）。
