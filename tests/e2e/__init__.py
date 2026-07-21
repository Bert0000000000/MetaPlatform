"""跨服务 E2E 测试包（V11-11）。

本目录下的 E2E 测试覆盖 10 条核心业务链路：
  1. 数据质量监控（TECH-DATA quality）
  2. 数据血缘探索（TECH-DATA lineage）
  3. 决策表执行（TECH-RULE decision-tables，Java Mock）
  4. 效果评估全流程（TECH-AGENT evaluation）
  5. 多员工协作聚合（TECH-AGENT aggregate-report）
  6. 员工版本管理（TECH-AGENT agents）
  7. 会话历史（TECH-AGENT conversations）
  8. APPHUB 版本管理（TECH-WFE apphub versions，Java Mock）
  9. APPHUB 模板市场（TECH-WFE apphub templates，Java Mock）
  10. 跨服务 trace_id 传播验证

Python 服务（TECH-DATA / TECH-AGENT）使用真实 ASGI TestClient 跑全链路；
Java 服务（TECH-RULE / TECH-WFE / TECH-EA）通过 Mock FastAPI app 模拟响应，
用于验证链路定义、请求顺序、参数契约以及 trace_id 传播。
"""
