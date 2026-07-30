# Cowork ↔ Claude Code 协作约定

> 目的：把 Cowork 出的方案，无缝交给 Claude Code 实现，再把结果回写给 Cowork。
> 两者**没有实时通道**，全靠本目录下的 Markdown / 文件约定。

---

## 目录

```
docs/handoff/
├── inbox/    # Cowork 产出方案，Claude Code 只读
├── outbox/   # Claude Code 完成后回写，交付报告 / commit 引用
└── README.md # 本文件
```

---

## 流转（单向）

```
Cowork  ──写──>  inbox/TASK-YYYYMMDD-NNN-<slug>.md
                          │
                          ▼
                  用户在 Claude Code 会话中：
                  “读 inbox/TASK-... 并按验收标准实现”
                          │
                          ▼
Claude Code ──写──> outbox/TASK-YYYYMMDD-NNN-<slug>-result.md
                          │
                          ▼
                   用户把 outbox 内容回贴给 Cowork
```

---

## 命名规范

- `TASK-YYYYMMDD-NNN-<slug>.md`
  - 日期：UTC+8 当天
  - NNN：当天从 001 起三位顺序号
  - slug：小写、连字符、短
  - 示例：`TASK-20260729-001-iam-permission-list-api.md`

---

## 角色职责

### Cowork（方案侧）
- 只写 `inbox/`
- 必须按 [`TASK-TEMPLATE.md`](./TASK-TEMPLATE.md) 模板写
- 不写代码、不改业务文件

### Claude Code（实现侧）
- 只读 `inbox/`，只写 `outbox/` 与业务代码
- 实现后必须按 [`RESULT-TEMPLATE.md`](./RESULT-TEMPLATE.md) 写回执
- commit 必须在 `outbox/result` 里用 SHA 引用

### 用户（中介）
- 把 Cowork 输出复制到 `inbox/`
- 把 Claude Code 输出复制回 Cowork
- 解决两边对同一文件的冲突（不该发生，约定里禁止）

---

## 禁止事项

- ❌ 同一文件两边同时改
- ❌ 任务粒度过大（>1 个服务、>1 个 PR）
- ❌ 方案里只写“修改 IAM 模块”，不写具体路径
- ❌ 接口契约只给文字，不给 OpenAPI / TS 类型片段
- ❌ 没有验收标准

---

## 给 Claude Code 的标准提示词

把下面这段贴到 Claude Code 会话即可：

```
请读 docs/handoff/inbox/TASK-YYYYMMDD-NNN-<slug>.md，
按里面的验收标准实现：
- 涉及的文件必须实际修改，不要只描述
- 写完跑相关单测 / typecheck
- 完成后把 commit SHA、变更摘要、未通过项写到
  docs/handoff/outbox/TASK-YYYYMMDD-NNN-<slug>-result.md
- 不要修改 inbox/ 下任何文件
```
