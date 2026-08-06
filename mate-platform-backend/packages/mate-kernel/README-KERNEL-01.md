# MP-ONT-KERNEL-01 启动包

> 起草：2026-08-06 · 状态：骨架就绪
>
> 关联：蓝图 `docs/active/specs/2026-08-06-ontology-kernel-blueprint.md` v0.4 §3 · ADR-0021 · ADR-0040 · ADR-0041
> Worktree：`.worktrees/mp-ont-kernel-01`，分支 `refactor/mp-ont-kernel-01`

## 1. 进度

| 阶段 | 状态 | 说明 |
|---|---|---|
| 12 基元 Protocol/dataclass 骨架 | ✅ 落档 | `src/mate_kernel/ontology/{identity,types,instances,reasoning,query}/` |
| 单元测试起步集 | ✅ 43 tests pass | `tests/test_ontology_primitives.py` |
| 60 tests 全量 | ⏳ | 当前 43；M1 第 2 周扩到 ≥60 |
| OWL 迁移 v2 | ⏳ | M1 第 5-6 周 |
| 双租户上下文统一 | ⏳ | M1 第 7-8 周 |
| OpenAPI 先行 | ⏳ | M1 第 3-4 周 |
| 验收证据 ACCEPTANCE.md | ⏳ | M1 结束前 |

## 2. 文件清单

```
mate-kernel/src/mate_kernel/ontology/
├── __init__.py             # 12 基元聚合入口
├── identity/               # 标识层（2 个基元）
│   ├── __init__.py
│   ├── class_ref.py        # 基元 1：ClassRef
│   └── version.py          # 基元 2：Version
├── types/                  # 类型层（5 个基元）
│   ├── __init__.py
│   ├── property_.py        # 基元 3：Property（含 PropertyFormat）
│   ├── object_type.py      # 基元 4：ObjectType
│   ├── link_type.py        # 基元 5：LinkType（含 Cardinality / Directionality）
│   ├── action_type.py      # 基元 6：ActionType
│   └── interface.py        # 基元 7：Interface
├── instances/              # 实例层（2 个基元）
│   ├── __init__.py
│   ├── individual.py       # 基元 8：Individual（可变）
│   └── link_instance.py    # 基元 9：LinkInstance（可变）
├── reasoning/              # 推理 + 函数层（2 个基元）
│   ├── __init__.py
│   ├── axiom.py            # 基元 10：Axiom（含 AxiomKind）
│   └── function.py         # 基元 11：Function（含 FunctionLanguage）
└── query/                  # 查询层（1 个基元）
    ├── __init__.py
    └── object_set.py       # 基元 12：ObjectSet
```

## 3. 跑测试

```bash
cd .worktrees/mp-ont-kernel-01/mate-platform-backend/packages/mate-kernel
python -m pytest tests/test_ontology_primitives.py -v
```

期望输出：`43 passed in 0.08s`。

## 4. 12 基元速查

| # | 基元 | rid 形如 | 可变？ |
|---|---|---|---|
| 1 | `ClassRef` | `ont.<tenant>.<kind>.<rest>` | — |
| 2 | `Version` | `ont.<tenant>.ver.<class_ref>.<tag>.v<n>` | 否（不可变快照） |
| 3 | `Property` | `ont.<tenant>.prop.<type>.<slug>` | 否 |
| 4 | `ObjectType` | `ont.<tenant>.obj.<slug>` | 否 |
| 5 | `LinkType` | `ont.<tenant>.link.<slug>` | 否 |
| 6 | `ActionType` | `ont.<tenant>.act.<slug>` | 否 |
| 7 | `Interface` | `ont.<tenant>.if.<slug>` | 否 |
| 8 | `Individual` | `ont.<tenant>.ind.<type>.<pk>` | **是** |
| 9 | `LinkInstance` | `ont.<tenant>.lnk.<link>.<sid>.<did>` | **是** |
| 10 | `Axiom` | `ont.<tenant>.ax.<kind>.<slug>` | 否 |
| 11 | `Function` | `ont.<tenant>.fn.<slug>.v<n>` | 否 |
| 12 | `ObjectSet` | `ont.<tenant>.oset.<hash>` | 一次性 |

## 5. 关键不变量（由 `__post_init__` 强制）

- `ClassRef.rid` 必须匹配 `^ont\.[a-z0-9_-]{1,64}\.(cls|ver|prop|obj|link|act|if|ind|lnk|ax|fn|oset)\.[a-z0-9_:\-.]+$`
- `ObjectType.primary_key` 非空且所有 pk 都在 `properties` 里
- `Individual.rid` 必须以 `ont.<tenant>.ind.` 起头；`primary_key` 非空
- `LinkInstance.rid` 必须以 `ont.<tenant>.lnk.` 起头；`src != dst`
- `ObjectSet.paging_offset >= 0`；`1 <= paging_limit <= 10000`

## 6. M1 后续 7 周任务拆分

| 周 | 任务 | 交付 |
|---|---|---|
| W1 | 12 基元骨架 + 起步测试 | ✅ 当前状态 |
| W2 | 扩到 ≥60 tests（含错误路径、跨基元交互） | +17 tests |
| W3 | OpenAPI 先行：12 基元 schema 入 `ont.yaml` | `contracts/openapi/services/ont.yaml` 扩到 ~32 端点 |
| W4 | 工具函数：rid 编解码、跨 rid 比较、序列化（to_dict/from_dict） | `mate_kernel/ontology/serde.py` |
| W5 | OWL 数据迁移脚本（v1 旧表 → v2 新表） | `mate-tech-ont/alembic/versions/2026_08_v2_migration.py` |
| W6 | 旧表 deprecate + 双租户上下文统一（移除 `mate-tech-ont/security/tenant.py`） | CI 加 `forbid_legacy_tenant_ctx.py` |
| W7 | 13 硬规则对位 + `MP-ONT-KERNEL-01-ACCEPTANCE.md` 收口 | evidence 落档 |

## 7. 接力指引

1. 切 worktree：`cd .worktrees/mp-ont-kernel-01`
2. 跑基线：`cd mate-platform-backend/packages/mate-kernel && python -m pytest tests/test_ontology_primitives.py -v`
3. 按 W2-W7 顺序推进；每个 PR 引用 ADR-0021 + operationId + 验收证据
4. 不要新增"基元"——12 基元已冻结；要加只能走新 ADR

## 8. 自建原则

> 本启动包不依赖 Palantir 任何官方开源组件。全部基元用 Python stdlib + `dataclasses` + `enum` 实现。
