# G8 FINAL 收口 — 2 空目录删除 prompt(给 code 模式)· 2026-08-02

> 版本:v1.0 · 2026-08-02
> 配套:验证报告 `2026-08-02-fix-verification.md` §3.6
> 状态:**Active**(code 模式立即可执行,1 分钟)

---

## 任务

你是 Mate Platform 的 code 模式执行者。任务:**G8 FINAL 收口 — 删 2 个空目录**。

这是 `2026-08-02-fix-verification.md` 验收报告中标注的最后一个遗留。1 分钟完成。

## 必读规范

- `docs/active/specs/2026-08-01-g8-legacy-infra-cleanup.md` §2.1 决策矩阵
- `docs/active/delivery/evidence/G8-FULL-ACCEPTANCE.md` §4 遗留项
- `docs/active/delivery/PROGRAM-BOARD.md` G8 行(已 Accepted,本次再确认)

## 当前状态

```
$ ls d:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\infra
argocd/    grafana/    helm/      keycloak/    lightrag/    otel/
prometheus/    tests/    traefik/    init-multiple-databases.sql
```

`infra/otel/` 与 `infra/lightrag/` 2 个空目录(文件已 `git rm` 删除,目录结构残留)。

## 修改清单

```
infra/otel/      [rmdir]  空目录,删
infra/lightrag/  [rmdir]  空目录,删

docs/active/delivery/evidence/G8-FULL-ACCEPTANCE.md  [改 §2/§4]  删"2 空目录残留"段,改"全量闭环"
docs/active/delivery/PROGRAM-BOARD.md                [改 G8 行注释]  加"2 空目录已删"标记
```

## 实施步骤

### 步骤 1:删除 2 个空目录(Windows)

```powershell
# 在 main 分支根目录(Windows PowerShell)
Remove-Item -Path "d:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\infra\otel" -Recurse -Force
Remove-Item -Path "d:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\infra\lightrag" -Recurse -Force
```

或 cmd:

```cmd
rmdir /s /q "d:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\infra\otel"
rmdir /s /q "d:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\infra\lightrag"
```

或 POSIX(若开发机是 Linux/macOS):

```bash
cd /path/to/MatePlatform
rmdir infra/otel infra/lightrag
```

### 步骤 2:验证

```powershell
# PowerShell
Get-ChildItem -Force 'd:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\infra\otel',
                          'd:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\infra\lightrag' `
  -ErrorAction SilentlyContinue
# 期望:无输出(目录已不存在)
```

### 步骤 3:commit

```bash
git add -A
git status
# 期望:仅显示 infra/otel/ 与 infra/lightrag/ 的删除
git commit -m "chore(infra): G8 FINAL 收口 - 删 otel/lightrag 2 个空目录

关联规范: docs/active/specs/2026-08-01-g8-legacy-infra-cleanup.md
关联验收: docs/active/delivery/evidence/G8-FULL-ACCEPTANCE.md §4
关联报告: docs/active/specs/2026-08-02-fix-verification.md §3.6

G8 100% 闭环:
- 3 个具体文件已删(otel-collector.yaml / Dockerfile / promtail-config.yml)
- 1 个整目录已删(promtail/)
- 2 个空目录已删(otel/ lightrag/)
- docker-compose.yml 残留引用已清(8/1 完成)
- PROFILES.md / architecture-implementation.md 引用已清(8/2 完成)
- PROGRAM-BOARD G8 → Accepted(8/2 完成)
"
```

### 步骤 4:更新 2 份 docs

**G8-FULL-ACCEPTANCE.md §2**:
- 删 2 行"空目录残留"(`infra/otel/` `infra/lightrag/`)
- 改"已删(git ls-files 无记录)"为"已删(整目录含空目录)"

**G8-FULL-ACCEPTANCE.md §4**:
- 删"遗留"段
- 改"3 目录 + docker-compose + docs 全部清理"为"G8 100% 闭环"

**PROGRAM-BOARD.md G8 行**:
- 改注释为"3 目录 + 2 文件 + 2 空目录 全部清理完成"

## 验收

```bash
ls d:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\infra
# 期望不再有 otel/ lightrag/,只剩 argocd/ grafana/ helm/ keycloak/ prometheus/ tests/ traefik/

docker compose --profile infra up -d  # 8/1 已通过
pytest infra/tests/ -v                 # 8/1 已通过
```

## 风险

- PowerShell `Remove-Item -Recurse -Force` 是 Windows 兜底命令,即便目录非空也会清(本批 2 个目录已知是空的,但建议先 ls 确认)
- 若是 Linux/macOS,`rmdir` 仅删空目录,非空会报错,改用 `rm -rf`
- 目录删除后 git tree 可能需要 refresh(Git for Windows 偶发),若 `git status` 不显示删除,执行 `git add -u`

## 工作量

**1 分钟**。

## 关联文档

- `2026-08-02-fix-verification.md` — 本次任务来源
- `2026-08-01-g8-legacy-infra-cleanup.md` — G8 规范
- `G8-FULL-ACCEPTANCE.md` — 状态文件(待最终修订)
- `PROGRAM-BOARD.md` — 状态行(待最终修订)

## 变更记录

| 日期 | 变更 | 作者 |
|---|---|---|
| 2026-08-02 | v1.0 初版(2 空目录删除 + docs 修订) | 需求层(TRAE) |