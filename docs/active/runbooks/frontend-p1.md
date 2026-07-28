# Frontend P1 batch Runbook (ontstudio + kb + mcphub)

## 启动

```bash
pnpm --filter @mate/ontstudio dev   # 5175
pnpm --filter @mate/kb dev         # 5176
pnpm --filter @mate/mcphub dev     # 5177
```

## ontstudio (ST-6.2.1-6)

- `/` — 主页（侧栏布局）
- `/ontology/:id` — 本体详情（属性 / 实例 / 关系 3 tab）
- `/sparql` — SPARQL 编辑器（Monaco）
- `/sparql/:id` — EXPLAIN

## kb (ST-6.2.7-12)

- `/` — 知识库列表
- `/upload` — 拖拽上传 + 分块进度 SSE
- `/search` — Query + 结果 + 引用高亮

## mcphub (ST-6.2.13-18)

- `/` — 工具列表
- `/tool/:name` — 工具详情（Try It）
- `/resources` — 资源浏览（ontology://{class_id}）
- `/prompts` — 提示模板（summarize_doc / extract_entities / plan_task）

## 故障排查

| 现象 | 排查 |
|---|---|
| 5175/5176/5177 冲突 | 检查 vite.config.ts port |
| 工具 401 | 检查 token / BFF |
| SPARQL 400 | 检查 WHERE 语法 |
| 全文检索 miss | 检查 token 切分 |