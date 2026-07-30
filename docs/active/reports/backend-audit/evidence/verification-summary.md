# 验证结果（2026-07-30）

- `pytest -q`：PASS，246 passed，24 warnings，耗时 104.98s。
- 警告包括 FastAPI `on_event` 弃用、IAM 测试使用不足 32 字节的 HMAC key，以及 pytest cache 无写权限。
- `ruff check . --output-format concise`：FAIL，627 errors。包含 Agent 重定义函数、生产代码质量/安全问题，以及大量测试中的常量自证断言。
- `pyright`：FAIL，701 errors，1 warning。技术规范要求 strict，但当前全仓未通过。
- 当前 pytest 默认 `testpaths = ["packages"]`，不会运行 `mate-platform-backend/tests/integration/`；因此“246 passed”不代表集成测试门禁已通过。
- 默认 pytest 未启用 coverage 参数，不能证明单元测试覆盖率 ≥80%。
- 显式 `pytest tests/integration -q`：FAIL，3 failed、229 passed、12 skipped、7 errors；失败包括缺少 mock fixtures、PG/Redis 镜像版本解析错误和 routing table 仅 8 个 unique paths；12 个真实 Testcontainers 用例因需要 Docker 被跳过。
