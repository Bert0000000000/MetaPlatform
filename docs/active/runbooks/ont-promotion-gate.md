# Runbook — 本体实例化生产门（ONT-G5 · staging/kind）

> **日期**: 2026-09-08 · **关联**: PRD-16 / ONT-G5 / V1.0-RELEASE-PLAN Sprint 3
> **前置**: ont 服务可达（staging: `http://<ont-host>:8007` 或经网关 `/api/v1/ont/v2`）、admin 凭证

## 1. 导出 bundle（源环境）

```bash
TOKEN=$(curl -s -X POST $GW/api/v1/iam/auth/login -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"***"}' | python -c "import sys,json;print(json.load(sys.stdin)['accessToken'])")
curl -s "$GW/api/v1/ont/v2/object-types/<TYPE_RID>/export" \
  -H "X-Tenant-Id: tenant-default" -H "Authorization: Bearer $TOKEN" > bundle.json
```

可选 Turtle 形态：`?format=turtle`（owl:Class/DatatypeProperty 序列）。

## 2. staging（kind）应用

kind 集群（3 节点 Ready）内以 pod 消费宿主网关：

```bash
kubectl run ont-apply --image=curlimages/curl:latest --restart=Never \
  --command -- sh -c "curl -s -X POST $GW/api/v1/ont/v2/object-types/import \
    -H 'Content-Type: application/json' -H 'X-Tenant-Id: tenant-default' \
    -H \"Authorization: Bearer $TOKEN\" --data-binary @bundle.json"
# 网络受限时退化为在 staging 宿主直接执行同一 import（语义等价）
curl -s -X POST $STAGING_GW/api/v1/ont/v2/object-types/import \
  -H 'Content-Type: application/json' -H 'X-Tenant-Id: tenant-default' \
  -H "Authorization: Bearer $TOKEN" --data @bundle.json
```

## 3. 验证

```bash
curl -s -o /dev/null -w '%{http_code}' \
  "$GW/api/v1/ont/v2/object-types/<TYPE_RID>" \
  -H "X-Tenant-Id: tenant-default" -H "Authorization: Bearer $TOKEN"
# 期望 200
```

## 4. 回滚

```bash
# staging 侧删除该类型（apply 前该 rid 不存在时即回到 apply 前状态）
docker exec <pg> psql -U meta -d metaplatform_ont \
  -c "DELETE FROM ont_object_type WHERE rid='<TYPE_RID>'"
# 或对已存在类型：先 branch 快照 → rollback（ONT-G8 端点）
```

## 5. 演练记录（2026-09-08）

export ver-demo.v1 bundle → staging 删除（GET 404 路径实测）→ import → GET 200 ✅。
kind 集群 3 节点 Ready（desktop-control-plane/worker/worker2）；pod 网络路径受限时
以宿主直连 import（语义等价）完成演练，runbook 保留两条路径。

## 6. 回顾/注意

- bundle 含属性全签名；不携带实例数据（实例迁移走 ONT-G3 脚本）。
- import 为 upsert 语义，重复 apply 幂等。
- 生产（RKE2/Flux）接入时把「kubectl run」替换为 GitOps 渲染 bundle 为 Provider 配置，流程不变。
