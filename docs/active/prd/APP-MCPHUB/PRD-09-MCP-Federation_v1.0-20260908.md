# PRD-09 MCP Federation 真实化
> 版本: v1.0 · 日期: 2026-09-08 · 状态: [~] 单 server 联邦 live ✅（ont_list_classes tool_call 200）；多 server 策略路由留增量
> 关联: federation_routes.py / Sprint 4
> FR: FR-FED-001..004

## 验收
FR-FED-001 注册外部 MCP server ✅（ federation_routes POST /servers）
FR-FED-002 tools/list 跨 server 聚合 ✅
FR-FED-003 tools/call 代理调用 ✅
FR-FED-004 策略路由（按能力/标签/租户）留增量
