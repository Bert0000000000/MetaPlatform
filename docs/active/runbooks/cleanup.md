# Cleanup Runbook (ST-7.7.3)

## 流程

1. **保留期**：v_{n-1} 镜像保留 7 天
2. **每日提醒**：keepalive-alert.sh 每日运行
3. **到期清理**：cleanup-old-releases.sh 自动删镜像 + deployment
4. **手动 cron**：
   ```cron
   0 9 * * * /opt/mate-platform/scripts/blue-green/51-keepalive-alert.sh
   0 10 * * * /opt/mate-platform/scripts/blue-green/52-cleanup-old-releases.sh tech-msg
   ```

## 安全检查

清理前确认：
- v_{n-1} 7 天内无任何生产 P0/P1
- 当前 v_n 流量 ≥ 99%
- on-call 团队已知情

## 回滚应急

```bash
# 立即恢复 v_{n-1} 镜像
docker pull ghcr.io/mate/tech-msg:previous
docker tag ghcr.io/mate/tech-msg:previous ghcr.io/mate/tech-msg:latest
docker push ghcr.io/mate/tech-msg:latest
kubectl -n mate-prod rollout restart deployment/tech-msg
```

## 保留 vs 清理

| 阶段 | 保留 | 清理 |
|---|---|---|
| 0-7 天 | v_n + v_{n-1} | 提醒 |
| 7-30 天 | v_n only | 自动删 v_{n-1} |
| > 30 天 | 全部清理 | — |