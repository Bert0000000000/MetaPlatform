# DATA-D7 v2 — 统一 PII 脱敏引擎 ACCEPTANCE

> 批次:DATA-D0-D8 D7
> 日期:2026-08-01
> 关联 ADR:ADR-0016 §3.3
> 状态:**Accepted (D7 v2)**

## 1. 范围

D7 统一平台两套独立 PII 实现(mate-clients + llmgw)为一个策略驱动的引擎:
- 7 种 PII 模式:phone_cn / id_card_cn / email / credit_card / phone_us / ssn / ip_v4
- per-tenant 策略(enabled_kinds / reversible / mask_token)
- 修复原 llmgw 中文边界 bug(`\b` 对中文字符无效 → 改用 lookaround)

## 2. 改动清单

- `alembic/versions/20260801_0011_pii_policy.py` — **新建**:pii_policy 表(per-tenant)
- `mate-platform/src/mate_platform/security/pii.py` — **新建**:PIIEngine + PIIPolicy + 7 patterns + mask_pii/has_pii 兼容
- `mate-platform/src/mate_platform/security/__init__.py` — **新建**:public API
- `tests/test_data_d0_d8_d7.py` — **新建**:16 e2e tests

## 3. 测试结果

```
test_data_d0_d8_d7.py: 16 passed
- TestDetection: 5 tests(CN phone / ID card / email / multi / clean)
- TestMasking: 5 tests(token replace / preserve text / reversible / compat / has_pii)
- TestPolicyControl: 3 tests(disabled kind / custom token / all kinds)
- TestDictRedaction: 2 tests(all fields / scoped fields)
- TestAlembic0011Schema: 1 test
```

## 4. 状态

- **D7:Accepted v2** ✅
- D0-D6:Accepted ✅
- D8:🟡 模块在(待 e2e)
