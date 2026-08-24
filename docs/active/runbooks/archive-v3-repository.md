# v3.0 仓库 Archive 操作 Runbook

> **执行人**：SRE Lead
> **时机**：Sprint 0 启动前（2026-09-XX）
> **目的**：彻底断开 v3.0 与 v6.0 的 CI 联动，节省成本，保留只读
> **耗时**：30 分钟

---

## 1. 立即动作（4 步）

### Step 1：v3.0 仓库标记 Archived（GitHub UI）

```
GitHub UI → v3.0 repo → Settings → General → Danger Zone
  ↓
Archive this repository
  ↓
输入仓库名确认
  ↓
Type "archive this repository"
  ↓
确认
```

**效果**：
- 仓库标记为 archived
- 加 banner "ARCHIVED - read-only"
- 仓库仍可访问 + 搜索 + clone（只读）
- 不能 push / merge / 改 issues
- 不能编辑 GitHub Actions 触发器（但 workflow 文件仍可见）

### Step 2：关闭 v3.0 自动 CI 触发（保留 manual）

即使 archived，workflow 仍可能因特殊事件触发。**显式关闭自动触发**：

```yaml
# v3.0 仓库 .github/workflows/*.yml（所有 CI workflow）
# 把以下改为：
on:
  workflow_dispatch:  # 仅 manual 触发
  # 删除 schedule / pull_request / push 自动触发
```

**操作**：
```bash
# 在 v3.0 仓库
cd v3.0-monorepo

# 列出所有 workflow
ls .github/workflows/

# 编辑每个 workflow，删除自动触发器
# 例如 v3-ci.yml:
#   on:
#     push: { branches: [main] }      ← 删除
#     pull_request: { branches: [main] } ← 删除
#     schedule: [...] ← 删除
#     workflow_dispatch:               ← 保留
```

### Step 3：删除 v3.0 pre-commit hook

```bash
# 在 v3.0 仓库cd v3.0-monorepo

# 删除 pre-commit 配置文件
rm .pre-commit-config.yaml
git commit -m "chore: disable pre-commit (v6.0 migration)"
git push origin main  # 最后一次 push（archived 后不可 push）
```

### Step 4：v3.0 README 加 banner

```markdown
> ⚠️ **v3.0 已停止新功能开发，仅维护 P0 漏洞**
> 新开发请使用 [MetaPlatform-v6](https://github.com/your-org/MetaPlatform-v6)
> 退役时间表：2028-Q1（v6.0 GA + 6 个月观察期后）
> 
> 归档日期：2026-09-XX
```

```bash
git commit -m "docs: add archive banner"
git push origin main
```

---

## 2. 验证动作已生效

### 验证 1：仓库已 archived

```
GitHub UI → v3.0 repo → 顶部应显示：
"⚠️ This repository has been archived. You can read its contents but cannot perform any actions on it."
```

### 验证 2：CI 不再自动触发

```
GitHub UI → v3.0 repo → Actions
应看到：
- 没有新的 workflow run（最近应该是 archive 前的）
- 所有 workflow 文件标 "Disabled" 或 "Manual only"
```

### 验证 3：pre-commit hook 已禁用

```bash
# 任何开发者本地
cd v3.0-monorepo
ls .pre-commit-config.yaml  # 应该 "No such file"
```

---

## 3. 后续保留事项（v3.0 期间）

### 3.1 保留 v3.0 GitHub Issues / PR 历史

✅ **不动** —— Issues / PR / Discussions 全部保留（历史决策可追溯）

### 3.2 保留 v3.0 Wiki / Pages

✅ **不动** —— Wiki 内容保留（合规要求）

### 3.3 保留 v3.0 Releases

✅ **不动** —— v3.0 所有 Release tag 保留（升级 / 回滚参考）

### 3.4 保留 v3.0 数据备份

✅ **不动** —— v3.0 数据库每天自动备份（与 v6.0 无关）

---

## 4. 完全退役 Checklist（Sprint 3 末 + 2028 Q1）

### 4.1 Sprint 3 末（切流量后）

```markdown
- [ ] ETL 执行成功（数据一致性验证通过）
- [ ] v6.0 接收 100% 租户
- [ ] v3.0 服务降级为应急模式（仅 manual 触发）
- [ ] v3.0 repo banner 更新："DEPRECATED - 2028-Q1 退役"
- [ ] v3.0 K8s namespace 标记 "deprecated"
```

### 4.2 2028-Q1（6 个月观察期后）

```markdown
- [ ] v6.0 稳定运行（无 P0 故障）
- [ ] 用户无投诉
- [ ] 数据完整性最终验证
- [ ] v3.0 K8s namespace 删除：
  kubectl delete namespace mp-v3-prod
  kubectl delete namespace mp-v3-staging
  kubectl delete namespace mp-v3-dev
- [ ] v3.0 Helm releases 卸载：
  helm uninstall v3-keycloak v3-flowable v3-ragflow
- [ ] v3.0 数据库最后备份：
  pg_dump v3_production > /backup/v3_final_2028_XX_XX.sql
  aws s3 cp /backup/v3_final_2028_XX_XX.sql s3://mp-cold-storage/v3-archive/
- [ ] v3.0 数据库 DROP（保留 90 天观察期）：
  DROP DATABASE v3_production;
- [ ] 90 天后 v3.0 备份从冷存储彻底删除
- [ ] v3.0 文档标记 "ARCHIVED - REMOVED"
```

---

## 5. 常见问题

### Q1：archived 仓库还能 git clone 吗？

✅ **能**。`git clone https://github.com/your-org/v3-monorepo` 仍可用。只读。

### Q2：v3.0 服务能跑多久？

✅ **1 年**（2026-Q4 ~ 2028-Q1）。期间业务不能中断。

### Q3：v3.0 业务数据怎么导出？

→ 由 **MP-V6-MIGRATION-01 Batch** 处理（Sprint 3 末）：
- 4 类数据：用户 / 租户 / 17 域 / 审计日志
- 一次性 ETL → 导入 v6.0

### Q4：v3.0 仓库可以彻底删除吗？

⚠️ **不推荐**。GitHub archived 比删除更好（保留决策历史）。

---

## 6. 一句话总结

> **Sprint 0 启动前立即执行 4 步：GitHub 标记 archived + 关闭自动 CI + 删除 pre-commit + README 加 banner。v3.0 服务继续运行 1 年，Sprint 3 末 ETL + 切流量，2028-Q1 完全退役。**

---

*v3.0 Archive Runbook完毕。*