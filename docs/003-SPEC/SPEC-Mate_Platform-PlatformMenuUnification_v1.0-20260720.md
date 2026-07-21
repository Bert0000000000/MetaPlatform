# Mate Platform 统一平台菜单逻辑设计规格

> 类型：SPEC（规范）  
> 模块：Mate Platform（跨 APP）  
> 主题：统一平台菜单逻辑  
> 版本：v1.0  
> 日期：2026-07-20

## 1. 背景与目标

当前 7 个前端应用（DASHBOARD / SUPERAI / DW / APPHUB / ONTSTUDIO / ARCH / MCPHUB）各自维护一份侧边栏菜单，导致：

- **DASHBOARD 一级菜单路由混乱**：使用硬编码 `http://localhost:XXXX` 的 `<a>` 外链跳转，无法感知登录态，且弹窗拦截问题已通过 native `<a>` 绕过，但仍是多 Tab 体验。
- **各 APP 二级菜单逻辑不一致**：有的用 `startsWith` 匹配（存在 `/relations` 与 `/relation-instances` 误判）、有的用精确匹配、有的无分组、有的有分组，选中状态与展开状态不可预期。
- **缺少统一平台导航**：用户进入某个模块后，无法在同一侧边栏里看到并切换到其它模块，必须返回 DASHBOARD 或打开新 Tab。

本规格目标：

1. 建立一份**平台级菜单配置**（模块 = 一级菜单，模块内页面 = 二级菜单）。
2. 在 `@mate/shared` 提供统一的 `PlatformMenu` 组件与路由匹配工具。
3. 所有 APP 的 `AppLayout` 统一替换为该平台菜单，实现左侧全局统一侧边栏。
4. 保留各 APP 头部标题，侧边栏一级菜单点击可跨应用跳转，二级菜单在应用内路由。

## 2. 设计原则

- **配置驱动**：菜单结构集中维护，避免 7 份重复代码。
- **现状优先**：不引入微前端/iframe，仍通过独立 Vite 应用 + 外链跳转实现跨模块导航。
- **兼容现有路由**：不改各 APP 内部路由定义，只统一菜单渲染与选中逻辑。
- **可扩展**：配置支持 `external` / `children` / `group` / `permission`，为后续后端驱动/权限控制留接口。

## 3. 菜单配置结构

新增 `packages/shared/src/config/platformMenu.ts`：

```typescript
export interface PlatformMenuItem {
  key: string;            // 唯一标识，如 'superai'
  label: string;          // 显示文本
  icon?: string;          // antd icon 名称，统一用字符串避免 icons 包体积问题
  path?: string;          // 应用入口路径，如 '/chat'（用于内部跳转）
  appUrl?: string;        // 开发/生产环境应用根地址，如 'http://localhost:9301'
  external?: boolean;     // 是否跨应用跳转
  children?: PlatformMenuItem[];
  defaultOpen?: boolean;
}

export const PLATFORM_MENU: PlatformMenuItem[] = [
  {
    key: 'dashboard',
    label: '工作台',
    icon: 'DashboardOutlined',
    path: '/dashboard',
    appUrl: 'http://localhost:9202',
    children: [
      { key: 'dashboard-home', label: '工作台', path: '/dashboard' },
      { key: 'dashboard-notifications', label: '消息中心', path: '/notifications' },
      { key: 'dashboard-deliverables', label: '历史交付物', path: '/deliverables' },
      { key: 'dashboard-settings', label: '个性化设置', path: '/settings' },
    ],
  },
  {
    key: 'superai',
    label: '超级 AI',
    icon: 'MessageOutlined',
    path: '/chat',
    appUrl: 'http://localhost:9301',
    children: [
      { key: 'superai-chat', label: '智能对话', path: '/chat' },
      { key: 'superai-analysis', label: '数据分析', path: '/analysis' },
      { key: 'superai-schedule', label: '任务编排', path: '/schedule/orchestration' },
      { key: 'superai-plan', label: '执行计划', path: '/schedule/plan' },
      { key: 'superai-parallel', label: '并行执行监控', path: '/schedule/parallel' },
      { key: 'superai-aggregate', label: '结果汇聚', path: '/schedule/aggregate' },
      { key: 'superai-templates', label: '任务模板', path: '/schedule/templates' },
      { key: 'superai-intent', label: '意图识别', path: '/schedule/intent' },
      { key: 'superai-match', label: '员工匹配', path: '/schedule/match' },
      { key: 'superai-plan-card', label: '计划卡片', path: '/schedule/plan-card' },
      { key: 'superai-execution', label: '执行面板', path: '/schedule/execution' },
      { key: 'superai-execution-detail', label: '执行详情', path: '/schedule/execution/detail' },
      { key: 'superai-result', label: '结果汇总', path: '/schedule/result' },
      { key: 'superai-export', label: '报告导出', path: '/schedule/export' },
      { key: 'superai-manual-select', label: '手动选员', path: '/schedule/manual-select' },
      { key: 'superai-a2a', label: 'A2A 协作', path: '/schedule/a2a' },
    ],
  },
  {
    key: 'dw',
    label: '数字员工',
    icon: 'RobotOutlined',
    path: '/dw/employees',
    appUrl: 'http://localhost:9401',
    children: [
      { key: 'dw-employees', label: '数字员工', path: '/dw/employees' },
      { key: 'dw-tasks', label: '任务中心', path: '/dw/tasks' },
      { key: 'dw-evaluation', label: '效果评估', path: '/dw/evaluation' },
      { key: 'dw-collaborations', label: '多员工协作', path: '/dw/collaborations' },
      { key: 'dw-external-agents', label: 'A2A 外部协作', path: '/dw/external-agents' },
    ],
  },
  {
    key: 'apphub',
    label: '应用中心',
    icon: 'AppstoreOutlined',
    path: '/apps',
    appUrl: 'http://localhost:9201',
    children: [
      { key: 'apphub-apps', label: '应用管理', path: '/apps' },
    ],
  },
  {
    key: 'ontstudio',
    label: '本体论引擎',
    icon: 'ApartmentOutlined',
    path: '/concepts',
    appUrl: 'http://localhost:9101',
    children: [
      { key: 'ontstudio-concepts', label: '本体管理', path: '/concepts' },
      { key: 'ontstudio-entities', label: '实体管理', path: '/entities' },
      { key: 'ontstudio-relations', label: '关系类型', path: '/relations' },
      { key: 'ontstudio-relation-instances', label: '关系实例', path: '/relation-instances' },
      { key: 'ontstudio-rules', label: '规则管理', path: '/rules' },
      { key: 'ontstudio-versions', label: '版本管理', path: '/versions' },
      { key: 'ontstudio-datasources', label: '数据源', path: '/datasources' },
      { key: 'ontstudio-mappings', label: '数据映射', path: '/mappings' },
      { key: 'ontstudio-quality', label: '数据质量', path: '/quality' },
      { key: 'ontstudio-lineage', label: '数据血缘', path: '/lineage' },
      { key: 'ontstudio-actions', label: 'Action 定义', path: '/actions' },
      { key: 'ontstudio-orchestrations', label: 'Action 编排', path: '/orchestrations' },
      { key: 'ontstudio-triggers', label: '触发器', path: '/triggers' },
      { key: 'ontstudio-executions', label: '执行监控', path: '/executions' },
      { key: 'ontstudio-graph', label: '知识图谱', path: '/graph' },
    ],
  },
  {
    key: 'arch',
    label: '架构中心',
    icon: 'PartitionOutlined',
    path: '/arch',
    appUrl: 'http://localhost:9206',
    children: [
      {
        key: 'arch-business',
        label: '业务架构',
        children: [
          { key: 'arch-overview', label: '架构总览', path: '/arch' },
          { key: 'arch-capabilities', label: '能力地图', path: '/arch/capabilities' },
          { key: 'arch-applications', label: '应用系统', path: '/arch/applications' },
          { key: 'arch-value-streams', label: '价值流', path: '/arch/value-streams' },
          { key: 'arch-processes', label: '业务流程', path: '/arch/processes' },
          { key: 'arch-org-roles', label: '组织与角色', path: '/arch/org-roles' },
        ],
      },
      {
        key: 'arch-data',
        label: '数据架构',
        children: [
          { key: 'arch-data-overview', label: '数据域/实体', path: '/arch/data' },
          { key: 'arch-data-flows', label: '数据流', path: '/arch/data/flows' },
          { key: 'arch-data-standards', label: '数据标准', path: '/arch/data/standards' },
          { key: 'arch-data-assets', label: '资产目录', path: '/arch/data/assets' },
        ],
      },
      {
        key: 'arch-tech',
        label: '技术架构',
        children: [
          { key: 'arch-tech-overview', label: '技术架构总览', path: '/arch/tech' },
          { key: 'arch-tech-components', label: '技术组件库', path: '/arch/tech-components' },
          { key: 'arch-tech-stacks', label: '技术栈画像', path: '/arch/tech-stacks' },
          { key: 'arch-deployment-topologies', label: '部署拓扑', path: '/arch/deployment-topologies' },
          { key: 'arch-tech-radar', label: '技术雷达', path: '/arch/tech-radar' },
        ],
      },
      {
        key: 'arch-governance',
        label: '架构治理',
        children: [
          { key: 'arch-principles', label: '原则与标准', path: '/arch/principles' },
          { key: 'arch-review-templates', label: '评审模板', path: '/arch/review-templates' },
          { key: 'arch-reviews', label: '评审流程', path: '/arch/reviews' },
          { key: 'arch-tech-debt', label: '技术债务', path: '/arch/tech-debt' },
        ],
      },
      {
        key: 'arch-integration',
        label: '集成',
        children: [
          { key: 'arch-ontology-mapping', label: '本体映射', path: '/arch/ontology-mapping' },
        ],
      },
    ],
  },
  {
    key: 'mcphub',
    label: 'MCP 服务中心',
    icon: 'ApiOutlined',
    path: '/',
    appUrl: 'http://localhost:9501',
    children: [
      { key: 'mcphub-overview', label: '概览', path: '/' },
      { key: 'mcphub-tools', label: '工具注册中心', path: '/tools' },
      { key: 'mcphub-servers', label: 'MCP Server', path: '/servers' },
      { key: 'mcphub-debugger', label: '调试器', path: '/debugger' },
      { key: 'mcphub-clients', label: 'MCP Client', path: '/clients' },
      {
        key: 'mcphub-permissions',
        label: '权限控制',
        children: [
          { key: 'mcphub-permissions-rules', label: '规则管理', path: '/permissions' },
          { key: 'mcphub-policies', label: 'ABAC 策略', path: '/policies' },
          { key: 'mcphub-matrix', label: '权限矩阵', path: '/matrix' },
        ],
      },
      { key: 'mcphub-resources', label: '资源配置', path: '/resources' },
      { key: 'mcphub-prompts', label: 'Prompt 模板', path: '/prompts' },
      { key: 'mcphub-audit', label: '调用审计', path: '/audit' },
      { key: 'mcphub-integrations', label: '外部对接', path: '/integrations' },
      { key: 'mcphub-ide-config', label: 'IDE 配置', path: '/ide-config' },
      { key: 'mcphub-connection-monitor', label: '连接监控', path: '/connection-monitor' },
    ],
  },
];
```

## 4. 共享组件设计

### 4.1 `packages/shared/src/components/PlatformMenu.tsx`

Props：

```typescript
interface PlatformMenuProps {
  currentModule: string;   // 当前所在模块 key，如 'superai'
  currentAppUrl?: string;  // 当前应用根地址，用于生成跨应用链接
  mode?: 'inline' | 'vertical';
}
```

职责：

- 遍历 `PLATFORM_MENU` 渲染一级模块菜单项。
- 当前模块展开其二级（及三级）菜单，其它模块收起。
- 点击非当前模块：使用 `window.location.href = appUrl + (path || '')` 跳转（保留登录态，因为已统一 token key）。
- 点击当前模块的二级项：使用 `useNavigate` 进行内部路由跳转。
- 路由匹配：使用 `findMenuByPathname` 工具，按最长前缀匹配，避免 `/relations` 与 `/relation-instances` 误判。

### 4.2 `packages/shared/src/utils/menuMatcher.ts`

```typescript
export function findActiveMenu(pathname: string): {
  moduleKey: string;
  itemKey: string;
  openKeys: string[];
} | null;

export function resolveMenuHref(item: PlatformMenuItem, currentAppUrl?: string): string;
```

匹配规则：

- 二级/三级路径精确匹配优先。
- 其次按最长路径前缀匹配（`startsWith`）。
- 支持 `/:id` 动态参数（如 `/concepts/:id` 匹配 `/concepts/abc`）。

## 5. 各 APP AppLayout 改造

每个 APP 的 `AppLayout.tsx` 简化为：

```tsx
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Layout, theme, Typography, Button } from 'antd';
import { LogoutOutlined } from '@ant-design/icons';
import { PlatformMenu } from '@mate/shared';
import { removeToken } from '@/utils/auth';

const { Header, Sider, Content } = Layout;
const CURRENT_MODULE = 'superai'; // 每个 APP 不同
const CURRENT_APP_URL = 'http://localhost:9301'; // 可抽为 env

export default function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { token } = theme.useToken();

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ ... }}>
        <Typography.Title level={4}>SuperAI</Typography.Title>
        <Button onClick={() => { removeToken(); navigate('/login'); }}>退出</Button>
      </Header>
      <Layout>
        <Sider width={240} style={{ background: token.colorBgContainer }}>
          <PlatformMenu
            currentModule={CURRENT_MODULE}
            currentAppUrl={CURRENT_APP_URL}
          />
        </Sider>
        <Content>...</Content>
      </Layout>
    </Layout>
  );
}
```

DASHBOARD 也使用 `PlatformMenu`，只是 `currentModule='dashboard'`。

## 6. 跨应用跳转与登录态

- 已统一 `localStorage` key：`mate_platform_token`、`mate_platform_user`。
- 跨应用跳转使用 `window.location.href` 到 `appUrl + path`。
- 目标应用读取相同 key 的 token，若已登录则直接进入，未登录则跳转登录页。
- 开发环境 `appUrl` 使用 `http://localhost:PORT`；生产环境通过 `import.meta.env.VITE_APP_BASE_URL` 或统一域名配置。

## 7. 选中与展开状态

- 通过 `useLocation().pathname` 调用 `findActiveMenu`。
- `selectedKeys` 为当前匹配到的叶子菜单项 `key`。
- `openKeys` 为当前模块 key + 所有父级分组 key（支持 ARCH 的三级分组）。
- 切换模块时，新页面自动计算新的选中/展开状态。

## 8. 改造范围与任务拆解

| 任务 | 范围 | 说明 |
|------|------|------|
| T1 | `@mate/shared` | 新增 `platformMenu.ts`、`PlatformMenu.tsx`、`menuMatcher.ts` |
| T2 | `APP-DASHBOARD` | 替换 `AppLayout` 菜单为 `PlatformMenu`，移除硬编码 `<a>` 外链 |
| T3 | `APP-SUPERAI` | 替换 `AppLayout` 菜单 |
| T4 | `APP-DW` | 替换 `AppLayout` 菜单 |
| T5 | `APP-APPHUB` | 替换 `AppLayout` 菜单 |
| T6 | `APP-ONTSTUDIO` | 替换 `AppLayout` 菜单 |
| T7 | `APP-ARCH` | 替换 `AppLayout` 菜单，保留三级分组 |
| T8 | `APP-MCPHUB` | 替换 `AppLayout` 菜单，保留三级分组 |
| T9 | 验证 | 运行 `inspect_login2.py` 或扩展脚本，验证所有 APP 菜单跳转与选中 |

## 9. 风险与回退

- **风险**：共享包改动需重新编译，各 APP 需重新启动才能生效。
- **回退**：如线上验证发现问题，可快速切回各 APP 原有 `AppLayout` 菜单（保留旧文件备份或 git 回滚）。
- **兼容性**：不改各 APP 内部路由，只改菜单渲染，回滚成本低。

## 10. 验收标准

- [ ] DASHBOARD 左侧边栏展示所有模块，点击模块跳转到对应 APP。
- [ ] 进入 SUPERAI 后，左侧边栏仍展示所有模块，当前模块（超级 AI）展开二级菜单，其它模块收起。
- [ ] 点击当前模块的二级菜单，页面正常路由，菜单选中状态正确。
- [ ] 点击其它模块，跳转到目标 APP 并展开其二级菜单。
- [ ] ONTSTUDIO 中 `/relations` 与 `/relation-instances` 选中不互相误判。
- [ ] ARCH / MCPHUB 三级分组展开与选中正常。
