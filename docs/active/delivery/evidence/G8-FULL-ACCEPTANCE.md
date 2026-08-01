# G8 FULL — 旧 infra 清理收口 ACCEPTANCE

> 批次:G8 FULL(承接 G8-ACCEPTANCE-FINAL)
> 日期:2026-08-02
> 状态:**Accepted (G8 FULL)** ✅

## 1. 范围

G8 FULL 承接 G8-ACCEPTANCE-FINAL(8/1 docker-compose 残留清理),扩展到:
- 3 目录本体删除确认(infra/otel/ infra/lightrag/ infra/promtail/)
- docs 引用清理(PROFILES.md)
- PROGRAM-BOARD G8 状态确认 Accepted

## 2. 清理清单

| 项目 | 状态 | 关联 commit |
|---|---|---|
| infra/otel/ 目录删除 | ✅ 已删(git ls-files 无记录) | P3-W6 wave |
| infra/lightrag/ 目录删除 | ✅ 已删 | P3-W6 wave |
| infra/promtail/ 目录删除 | ✅ 已删 | P3-W6 wave |
| docker-compose.yml 残留引用 | ✅ 4 处清除(lightrag/promtail/otel) | ef8c4105 |
| PROFILES.md 引用清理 | ✅ 本批次 | 本 commit |
| architecture-implementation.md | ✅ 无残留(grep 0 匹配) | N/A |

## 3. grep 验证

```
grep "infra/otel" docker-compose.yml → 0 匹配 ✅
grep "infra/lightrag" docker-compose.yml → 0 匹配 ✅
grep "infra/promtail" docker-compose.yml → 0 匹配 ✅
git ls-files infra/otel/ infra/lightrag/ infra/promtail/ → 空 ✅
```

## 4. 结论

G8 全量闭环:3 目录 + docker-compose + docs 全部清理完成。
