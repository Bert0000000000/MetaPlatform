# MP-V6-DSH-DOCKER-01 — dsh Docker 镜像构建

> **Batch 状态**：Pending Acceptance
> **优先级**：🔴 P0（必做）
> **工作量**：2 周
> **团队**：AI 团队 + SRE
> **前置依赖**：MP-V6-FOUNDATION-01（镜像仓库）

---

## 1. 目标

构建 dsh Docker 镜像（多阶段），推送内部 Harbor，所有 dsh K8s 部署的基础。

## 2. 配套文档

- 技术架构 spec：[`docs/active/specs/2026-08-19-mp-v6-architecture.md`](../../specs/2026-08-19-mp-v6-architecture.md) §7.14 dsh Docker 部署设计

---

## 3. 关键交付

### 3.1 Dockerfile（多阶段）

3 个阶段：
- **deps**：装依赖（Node 22.19 + pnpm 10）
- **build**：构建（pnpm build）
- **runtime**：运行时（最小化镜像 + tini + 非 root 用户）

输出：`mp/dsh-web:v6.0.0` + `mp/dsh-scheduler:v6.0.0`

### 3.2 CI/CD（GitHub Actions）

- [ ] PR 触发：build + test + lint
- [ ] tag 触发（如 `v*`）：build + push 到 Harbor
- [ ] 镜像打 tag：`v6.0.0-<git-sha>` + `latest`

### 3.3 内部 Harbor 仓库

- [ ] 创建 Harbor 项目 `mp`
- [ ] 配置镜像扫描（trivy）
- [ ] 配置镜像签名（cosign，可选）

---

## 4. 详细任务清单

### 第 1 周：Dockerfile + CI

- [ ] 写 `Dockerfile`（多阶段）
- [ ] 写 `.dockerignore`
- [ ] 本地 build 测试（确保能跑 `pnpm dsh web`）
- [ ] 写 `.github/workflows/dsh-build.yml`
- [ ] 配置 Harbor 凭证（GitHub Secrets）

### 第 2 周：Harbor + 镜像扫描

- [ ] 部署 / 配置 Harbor（如果未部署）
- [ ] 创建项目 `mp`
- [ ] 集成 trivy 镜像扫描
- [ ] 集成 cosign 签名（可选）
- [ ] 验证：tag 触发后自动 build + push
- [ ] evidence/MP-V6-DSH-DOCKER-01-ACCEPTANCE.md

---

## 5. 关键依赖

|依赖 | 来源 |
|---|---|
| dsh 源码 | [`deepseek-ai/deepseek-harness`](https://github.com/deepseek-ai/deepseek-harness) |
| Harbor | 内部镜像仓库 |
| Node.js 22.19+ | 基础镜像 |

## 6. 验收标准

- [ ] `Dockerfile` 多阶段构建成功
- [ ] 镜像大小 ≤ 500MB
- [ ] GitHub Actions 触发构建成功
- [ ] 镜像推送到 Harbor
- [ ] trivy 扫描无 High / Critical 漏洞
- [ ] 镜像能在 K8s 跑（`pnpm dsh web`）
- [ ] evidence 文档完成
- [ ] 通知 MP-V6-DSH-K8S-01 可启动

## 7. 风险与缓解

|风险 | 缓解 |
|---|---|
| 镜像体积过大 | 多阶段 + alpine + 仅 production deps |
| 漏洞扫描失败 | 锁版本 + 定期重 build |
| Harbor 不可用 | 备选推 Docker Hub 或 GHCR |