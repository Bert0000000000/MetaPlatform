# Frontend P2 batch Runbook (apphub + arch + dw + superai)

## 启动

```bash
pnpm --filter @mate/apphub dev     # 5178
pnpm --filter @mate/arch dev       # 5179
pnpm --filter @mate/dw dev         # 5180
pnpm --filter @mate/superai dev    # 5181
```

## apphub (ST-6.3.1-5)

- `/` — 应用市场（卡片网格）
- `/category/:cat` — 分类过滤
- `/app/:id` — 应用详情 + 安装

## arch (ST-6.3.6-10)

- `/` — 架构画布
- `/templates` — 模板库
- 拖拽节点 + 连线 + 保存

## dw (ST-6.3.11-15)

- `/` — DataWorks 画布
- 节点库侧栏（10 个内置）
- 节点配置面板 + 运行触发

## superai (ST-6.3.16-20)

- `/` — 统一 AI 入口
- 流式对话（SSE）
- 历史 + 收藏 + 标签