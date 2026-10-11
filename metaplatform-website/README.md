# MetaPlatform 官网

唯一官网内容源是 `../metaplatform-frontend/apps/web/public/website/index.html`。
本目录 `index.html` 仅为旧入口兼容页面，导航至同源 `/website/`；不要单独发布它作为官网正文。

## 与平台一起运行

在 `metaplatform-frontend` 执行 `pnpm --filter @mate/web dev`，打开其实际打印的地址下的 `/website/` 或 `/website/index.html`。
`pnpm --filter @mate/web build` 将 canonical 页面复制到 `apps/web/dist/website/index.html`。
`pnpm --filter @mate/web preview` 可验证同一构建产物。现有 Dockerfile 已复制完整 `dist`，无需额外拷贝仓库外层网站。
生产 Nginx 的既有目录索引与 `try_files` 支持 `/website/`。

官网公开；默认所有“进入平台”链接是同源 `/home`。现有 AuthGuard 把匿名访问导向 `/login`。
官网不会发起业务 API 请求，也不修改认证、代理或平台 API 配置。

## 独立静态部署

复制 canonical `index.html` 为静态服务的页面；该页面不依赖外部字体、图片或包。
设置唯一公开配置项：

```html
<meta name="metaplatform-platform-url" content="https://你的真实平台域名/home">
```

空值保持同源 `/home`；接受完整 `http://` / `https://` 地址或以单个 `/` 开头的同源路径。
公网请使用 HTTPS。不要配置访问者本机 localhost；配置目标应为已部署的真实平台地址。
拒绝 `javascript:`、`data:`、协议相对地址、带用户名/密码的 URL，以及会逃逸同源的路径。
无效值回退到 `/home`，不跳转到不安全目的地。
此项仅用于公开导航目的地，不能填写令牌、密码或其他认证信息。

默认同源链接、菜单和常见问题在禁用 JavaScript 时仍可用。独立部署请生成发布副本，将唯一配置值同时写入 meta 和四个静态入口，确保禁用 JavaScript 仍能进入真实平台：

```powershell
# 从仓库根目录执行。output 必须是新的、明确指定的发布文件；不会覆盖已有文件或 canonical 源。
node metaplatform-website/configure-platform.mjs --platform-url 'https://你的真实平台域名/home' --output './standalone-dist/index.html'
```

脚本只读取 canonical HTML，拒绝不安全 URL 和 URL 内凭据，不回显配置值；保持平台认证和 API 配置。
发布生成的 `standalone-dist/index.html`，不另行维护官网正文。网页 meta 运行时覆盖可用于支持 JavaScript 的环境，
但不能代替独立站的静态生成步骤。禁用 JavaScript 后平台 SPA 本身仍需 JavaScript 才能显示登录及业务页面。

## 验证和发布边界

在 `apps/web` 执行：`E2E_BASE_URL=<隔离预览地址> pnpm exec playwright test tests/e2e/website-entry.spec.ts --project=web`。
用例覆盖匿名官网、现有登录接续、360/390/768/1440 宽度、键盘跳过导航、移动菜单、减少动态效果、
禁用 JavaScript 的默认入口和不安全 URL 拒绝。截图输出到既有 ignored `tests/e2e/.artifacts`。

本次实现仅为仓库本地候选版；没有注册或发布公网网站，未指定 DNS 或实际公网平台域名。
订单完整业务链、真实客户端兼容、用户试用和连续试运行仍以各自验收证据为准。
