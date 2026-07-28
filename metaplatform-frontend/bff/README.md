# @mate/bff

Mate Platform BFF.

## API_MODE 切换

| Mode | 行为 |
|---|---|
| mock | 所有返回 mock |
| live | 透传到 UPSTREAM_BASE |
| hybrid | GET mock, POST/PUT/DELETE live |

## 启动

```bash
API_MODE=mock pnpm dev
API_MODE=live UPSTREAM_BASE=http://localhost:8000 pnpm dev
```