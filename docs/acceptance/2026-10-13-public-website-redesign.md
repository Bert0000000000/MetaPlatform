# 官网首页重设计：本地验证记录

日期：2026-10-13，Asia/Shanghai。工作树：`3c64/2026-07-02-MetaPlatform`，开始时 HEAD `2ee6ce0e`，detached HEAD，无在途修改。

## 范围与内容

- 唯一正文源：[官网 HTML](../../metaplatform-frontend/apps/web/public/website/index.html)。
- 主线：平台定位 → 企业挑战 → 平台架构 → 联系与合作，各章配同一黑白银灰视觉体系的原创示意图；首屏有球形智能网络与轻量轨道动效。
- 架构依据：[联邦数字员工目标架构](../superpowers/specs/2026-08-31-federated-digital-employee-platform-design.md)、[产品模块规格](../superpowers/specs/2026-09-01-metaplatform-product-modules-design.md)。中央定义与治理、租户运行与数据分别呈现，保留目标架构和具体可用能力的边界。
- 保留四个平台入口及既有 URL 安全配置、登录接续、旧锚点、版本规划、FAQ。产品进展收进原生折叠资料。
- 用户明确联系方式“先待定”：显示“官方联系方式 · 待公布”，不填虚构邮箱、电话、微信，不创建咨询提交接口。
- 参考：[Linear](https://linear.app/)、[Vercel](https://vercel.com/)。配图全部内联，不依赖远程图像、字体或追踪脚本。

## 实际环境准备

- 在本工作树前端工作区执行 `pnpm install --frozen-lockfile --ignore-scripts`，643 个依赖安装完成；`pnpm rebuild puppeteer esbuild` 退出 0；锁文件无修改。
- 验证使用隔离缓存中的 Node **22.23.3**、pnpm **11.15.1**、锁文件中的 Playwright **1.61.1** 与已安装 Chromium。没有变更系统 Node 安装或其他工作树依赖。
- 启动本轮独立 Vite：`127.0.0.1:19364`，使用 `--strictPort`。现有服务、数据库和工作树保留。

## 本地结果

| 检查 | 实际结果 |
| --- | --- |
| `pnpm --filter @mate/web typecheck` | 退出 0 |
| `pnpm --filter @mate/web build` | 退出 0；Vite 构建完成，保留既有 SPA 大 chunk 提示 |
| `E2E_BASE_URL=http://127.0.0.1:19364` 下执行 `tests/e2e/website-entry.spec.ts --project=web` | 最终执行 22 passed，0 failed，0 skipped，13.0 秒；包含实际轨道动效的减少动态效果检查 |
| 官网根路径 `/` | HTTP 200，返回新版官网正文 |
| 官网构建副本 | `dist/website/index.html` 与唯一正文源 SHA256 一致 |
| 响应式 | 360 / 390 / 768 / 1440 px 无横向溢出，四章导航、移动菜单、键盘跳过导航实际通过 |
| 原有入口回归 | 匿名官网、AuthGuard 登录接续、禁用 JavaScript、独立站生成、合法 URL / 非法 URL 拒绝均通过 |

浏览器截图在本工作树既有 ignored `metaplatform-frontend/apps/web/tests/e2e/.artifacts/MP11-website-dev-{width}.png` 及 `-hero.png`，已查看桌面与手机完整页面。
最终浏览器执行日志及桌面/手机截图另存到 ignored `.tmp/website-redesign-20261013/`，供本轮预览。

这是本地页面候选版的验证，没有执行 PR/主干 CI、合并、公网部署或业务链验收。本次不涉及后端、数据库、模型迁移或认证修改，不把未运行的数据库/业务测试记为通过。
