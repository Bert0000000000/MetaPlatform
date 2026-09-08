# PRD-03 Marketplace 第三方订阅（MP-MKT-INSTALL-01）
> 版本: v1.0 · 日期: 2026-09-08 · 状态: [x] 消费面已收口（EMP-EVOLVE FR-008 通过 SessionEvolution mount/unmount 映射；完整 install 事务由 MARKETPLACE-CONSUMER-01 收口）
> 关联: ADR-0020 / PRD-01 FR-008 / Sprint 4
> FR: FR-MKT-001..004
## 验收
FR-MKT-001 browse 第三方能力 ✅（marketplace API）
FR-MKT-002 subscribe 订阅 ✅（composition mount 语义）
FR-MKT-003 install 事务化 ✅（MCP-REGISTER + OntologyMarketplaceClient）
FR-MKT-004 uninstall 回滚 ✅（composition unmount 反应式失活）
