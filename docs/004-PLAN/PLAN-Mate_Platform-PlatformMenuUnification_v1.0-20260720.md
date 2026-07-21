# Mate Platform 统一平台菜单逻辑实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development`（推荐）或 `superpowers:executing-plans` 分任务实施。步骤使用 `- [ ]` 语法跟踪。

**Goal:** 在 `@mate/shared` 中实现配置驱动的统一平台菜单，替换 7 个 APP 各自独立的侧边栏菜单，解决一级菜单路由与二级菜单逻辑不一致问题。

**Architecture:** 将菜单配置、`PlatformMenu` 组件、路由匹配工具下沉到 `@mate/shared`；各 APP 的 `AppLayout.tsx` 仅保留应用标题、退出按钮与内容区，侧边栏统一渲染 `PlatformMenu`；跨应用跳转通过 `window.location.href` 到目标 APP 的 `appUrl + path`，同一应用内二级菜单使用 `useNavigate`。

**Tech Stack:** React 19, TypeScript 5.7, Ant Design 6.0, React Router v6, Vite 6, `@mate/shared`

---

## 文件结构

新增/修改文件清单：

| 文件 | 职责 |
|------|------|
| `packages/shared/src/config/platformMenu.ts` | 平台级菜单配置（一级模块 + 二级/三级页面） |
| `packages/shared/src/utils/menuMatcher.ts` | 根据 pathname 查找当前模块、选中项、展开项 |
| `packages/shared/src/components/PlatformMenu.tsx` | 统一侧边栏菜单组件 |
| `packages/shared/src/index.ts` | 导出新增的三个模块 |
| `APP-DASHBOARD/src/components/AppLayout.tsx` | 使用 PlatformMenu，移除硬编码外链 |
| `APP-SUPERAI/src/components/AppLayout.tsx` | 使用 PlatformMenu |
| `APP-DW/src/components/AppLayout.tsx` | 使用 PlatformMenu |
| `APP-APPHUB/src/components/AppLayout.tsx` | 使用 PlatformMenu |
| `APP-ONTSTUDIO/src/components/AppLayout.tsx` | 使用 PlatformMenu |
| `APP-ARCH/src/components/AppLayout.tsx` | 使用 PlatformMenu |
| `APP-MCPHUB/src/components/AppLayout.tsx` | 使用 PlatformMenu |

---

### Task 1: 创建平台菜单配置

**Files:**
- Create: `packages/shared/src/config/platformMenu.ts`

- [ ] **Step 1: 写入菜单配置**

```typescript
import type { ReactNode } from 'react';

export interface PlatformMenuItem {
  key: string;
  label: string;
  icon?: string;
  path?: string;
  appUrl?: string;
  external?: boolean;
  children?: PlatformMenuItem[];
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

- [ ] **Step 2: 提交**

```bash
git add packages/shared/src/config/platformMenu.ts
git commit -m "feat(shared): add platform menu configuration"
```

---

### Task 2: 创建路由匹配工具

**Files:**
- Create: `packages/shared/src/utils/menuMatcher.ts`
- Test: `packages/shared/src/utils/menuMatcher.test.ts`（可选，如项目已有测试约定）

- [ ] **Step 1: 实现匹配工具**

```typescript
import { PLATFORM_MENU, type PlatformMenuItem } from '../config/platformMenu';

export interface ActiveMenuResult {
  moduleKey: string;
  itemKey: string;
  openKeys: string[];
}

function collectPaths(
  items: PlatformMenuItem[],
  parents: string[] = []
): Array<{ item: PlatformMenuItem; moduleKey: string; openKeys: string[] }> {
  const result: Array<{ item: PlatformMenuItem; moduleKey: string; openKeys: string[] }> = [];
  for (const item of items) {
    const isModule = parents.length === 0;
    const moduleKey = isModule ? item.key : parents[0];
    const openKeys = isModule ? [item.key] : [...parents, item.key];
    if (item.children && item.children.length > 0) {
      result.push(...collectPaths(item.children, openKeys));
    } else if (item.path) {
      result.push({ item, moduleKey, openKeys });
    }
  }
  return result;
}

function pathMatches(path: string, pathname: string): boolean {
  if (path === '/') {
    return pathname === '/';
  }
  // 支持 /concepts/:id 形式（仅末尾段）
  if (path.endsWith('/:id')) {
    const prefix = path.slice(0, -4);
    return pathname.startsWith(prefix + '/') && pathname.slice(prefix.length + 1).split('/').length === 1;
  }
  return pathname === path || pathname.startsWith(path + '/');
}

export function findActiveMenu(pathname: string): ActiveMenuResult | null {
  const allPaths = collectPaths(PLATFORM_MENU);
  // 1. 精确匹配优先
  let matched = allPaths.find(({ item }) => item.path === pathname);
  if (!matched) {
    // 2. 最长前缀匹配
    const candidates = allPaths
      .filter(({ item }) => item.path && pathMatches(item.path, pathname))
      .sort((a, b) => (b.item.path?.length || 0) - (a.item.path?.length || 0));
    matched = candidates[0];
  }
  if (!matched) return null;
  return {
    moduleKey: matched.moduleKey,
    itemKey: matched.item.key,
    openKeys: matched.openKeys,
  };
}

export function resolveMenuHref(item: PlatformMenuItem, currentAppUrl?: string): string {
  if (!item.path) return '#';
  if (item.external && item.appUrl) {
    return item.appUrl + item.path;
  }
  return item.path;
}
```

- [ ] **Step 2: 提交**

```bash
git add packages/shared/src/utils/menuMatcher.ts
git commit -m "feat(shared): add menu matcher utility"
```

---

### Task 3: 创建 PlatformMenu 组件

**Files:**
- Create: `packages/shared/src/components/PlatformMenu.tsx`

- [ ] **Step 1: 实现组件**

```tsx
import { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Menu } from 'antd';
import type { ItemType } from 'antd/es/menu/interface';
import * as Icons from '@ant-design/icons';
import { PLATFORM_MENU, type PlatformMenuItem } from '../config/platformMenu';
import { findActiveMenu, resolveMenuHref } from '../utils/menuMatcher';

export interface PlatformMenuProps {
  currentModule: string;
  currentAppUrl?: string;
  mode?: 'inline' | 'vertical';
}

const IconMap = Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>;

function renderIcon(name?: string): React.ReactNode {
  if (!name) return undefined;
  const IconComponent = IconMap[name];
  return IconComponent ? <IconComponent /> : undefined;
}

function toAntdItems(
  items: PlatformMenuItem[],
  currentModule: string,
  currentAppUrl?: string,
  onNavigate?: (path: string) => void
): ItemType[] {
  return items.map((item) => {
    const isExternalModule = item.key !== currentModule;
    const href = resolveMenuHref(item, isExternalModule ? item.appUrl : undefined);
    const label = isExternalModule && item.appUrl
      ? item.label
      : item.label;

    const base: any = {
      key: item.key,
      icon: renderIcon(item.icon),
      label,
      onClick: () => {
        if (isExternalModule && item.appUrl && item.path) {
          window.location.href = item.appUrl + item.path;
        } else if (item.path && onNavigate) {
          onNavigate(item.path);
        }
      },
    };

    if (item.children && item.children.length > 0) {
      return {
        ...base,
        children: toAntdItems(item.children, currentModule, currentAppUrl, onNavigate),
      };
    }
    return base;
  });
}

export function PlatformMenu({ currentModule, currentAppUrl, mode = 'inline' }: PlatformMenuProps) {
  const location = useLocation();
  const navigate = useNavigate();

  const active = useMemo(() => findActiveMenu(location.pathname), [location.pathname]);
  const selectedKeys = active?.moduleKey === currentModule ? [active.itemKey] : [];
  const openKeys = active?.moduleKey === currentModule ? active.openKeys : [currentModule];

  const items = useMemo(
    () => toAntdItems(PLATFORM_MENU, currentModule, currentAppUrl, (path) => navigate(path)),
    [currentModule, currentAppUrl, navigate]
  );

  return (
    <Menu
      mode={mode}
      selectedKeys={selectedKeys}
      defaultOpenKeys={openKeys}
      style={{ height: '100%', borderRight: 0 }}
      items={items}
    />
  );
}
```

- [ ] **Step 2: 提交**

```bash
git add packages/shared/src/components/PlatformMenu.tsx
git commit -m "feat(shared): add PlatformMenu component"
```

---

### Task 4: 导出共享模块

**Files:**
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: 添加导出**

在 `packages/shared/src/index.ts` 末尾追加：

```typescript
export { PLATFORM_MENU, type PlatformMenuItem } from './config/platformMenu';
export { PlatformMenu, type PlatformMenuProps } from './components/PlatformMenu';
export { findActiveMenu, resolveMenuHref, type ActiveMenuResult } from './utils/menuMatcher';
```

- [ ] **Step 2: 提交**

```bash
git add packages/shared/src/index.ts
git commit -m "feat(shared): export platform menu modules"
```

---

### Task 5: 改造 APP-DASHBOARD

**Files:**
- Modify: `APP-DASHBOARD/src/components/AppLayout.tsx`

- [ ] **Step 1: 替换菜单为 PlatformMenu**

完整替换文件内容：

```tsx
import { Outlet, useNavigate } from 'react-router-dom';
import { Layout, theme, Typography, Button, Space, Avatar } from 'antd';
import { UserOutlined, LogoutOutlined } from '@ant-design/icons';
import { PlatformMenu } from '@mate/shared';
import { removeToken, getUser } from '@/utils/auth';
import NotificationBell from '@/components/NotificationBell';
import GlobalSearch from '@/components/GlobalSearch';

const { Header, Sider, Content } = Layout;

export default function AppLayout() {
  const navigate = useNavigate();
  const user = getUser();
  const {
    token: { colorBgContainer, borderRadiusLG, colorBorderSecondary },
  } = theme.useToken();

  const handleLogout = () => {
    removeToken();
    navigate('/login');
  };

  const displayName = user?.username || 'Guest';
  const initials = displayName.charAt(0).toUpperCase();

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: colorBgContainer,
          padding: '0 24px',
          borderBottom: `1px solid ${colorBorderSecondary}`,
        }}
      >
        <Space>
          <Typography.Title level={4} style={{ margin: 0 }}>
            Mate 工作台
          </Typography.Title>
          <GlobalSearch />
        </Space>
        <Space size="middle">
          <NotificationBell />
          <Space size="small" style={{ cursor: 'pointer' }} onClick={() => navigate('/settings')}>
            <Avatar size="small" icon={<UserOutlined />} style={{ backgroundColor: '#1677ff' }}>
              {initials}
            </Avatar>
            <Typography.Text>{displayName}</Typography.Text>
          </Space>
          <Button type="text" icon={<LogoutOutlined />} onClick={handleLogout}>
            退出
          </Button>
        </Space>
      </Header>
      <Layout>
        <Sider width={240} style={{ background: colorBgContainer }}>
          <PlatformMenu currentModule="dashboard" currentAppUrl="http://localhost:9202" />
        </Sider>
        <Layout style={{ padding: '16px 24px' }}>
          <Content
            style={{
              background: colorBgContainer,
              padding: 24,
              margin: 0,
              borderRadius: borderRadiusLG,
              minHeight: 280,
              overflow: 'auto',
            }}
          >
            <Outlet />
          </Content>
        </Layout>
      </Layout>
    </Layout>
  );
}
```

- [ ] **Step 2: 提交**

```bash
git add APP-DASHBOARD/src/components/AppLayout.tsx
git commit -m "feat(dashboard): use PlatformMenu for unified sidebar"
```

---

### Task 6: 改造 APP-SUPERAI

**Files:**
- Modify: `APP-SUPERAI/src/components/AppLayout.tsx`

- [ ] **Step 1: 替换菜单为 PlatformMenu**

完整替换文件内容：

```tsx
import { Outlet, useNavigate } from 'react-router-dom';
import { Layout, theme, Typography, Button } from 'antd';
import { LogoutOutlined } from '@ant-design/icons';
import { PlatformMenu } from '@mate/shared';
import { removeToken } from '@/utils/auth';

const { Header, Sider, Content } = Layout;

export default function AppLayout() {
  const navigate = useNavigate();
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  const handleLogout = () => {
    removeToken();
    navigate('/login');
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: colorBgContainer,
          padding: '0 24px',
          borderBottom: '1px solid #f0f0f0',
        }}
      >
        <Typography.Title level={4} style={{ margin: 0 }}>
          SuperAI
        </Typography.Title>
        <Button type="text" icon={<LogoutOutlined />} onClick={handleLogout}>
          退出
        </Button>
      </Header>
      <Layout>
        <Sider width={240} style={{ background: colorBgContainer }}>
          <PlatformMenu currentModule="superai" currentAppUrl="http://localhost:9301" />
        </Sider>
        <Layout style={{ padding: '16px 24px' }}>
          <Content
            style={{
              background: colorBgContainer,
              padding: 24,
              margin: 0,
              borderRadius: borderRadiusLG,
              minHeight: 280,
              overflow: 'auto',
            }}
          >
            <Outlet />
          </Content>
        </Layout>
      </Layout>
    </Layout>
  );
}
```

- [ ] **Step 2: 提交**

```bash
git add APP-SUPERAI/src/components/AppLayout.tsx
git commit -m "feat(superai): use PlatformMenu for unified sidebar"
```

---

### Task 7: 改造 APP-DW

**Files:**
- Modify: `APP-DW/src/components/AppLayout.tsx`

- [ ] **Step 1: 替换菜单为 PlatformMenu**

完整替换文件内容：

```tsx
import { Outlet, useNavigate } from 'react-router-dom';
import { Layout, theme, Typography, Button } from 'antd';
import { LogoutOutlined } from '@ant-design/icons';
import { PlatformMenu } from '@mate/shared';
import { removeToken } from '@/utils/auth';

const { Header, Sider, Content } = Layout;

export default function AppLayout() {
  const navigate = useNavigate();
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  const handleLogout = () => {
    removeToken();
    navigate('/login');
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: colorBgContainer,
          padding: '0 24px',
          borderBottom: '1px solid #f0f0f0',
        }}
      >
        <Typography.Title level={4} style={{ margin: 0 }}>
          数字员工工作台
        </Typography.Title>
        <Button type="text" icon={<LogoutOutlined />} onClick={handleLogout}>
          退出
        </Button>
      </Header>
      <Layout>
        <Sider width={240} style={{ background: colorBgContainer }}>
          <PlatformMenu currentModule="dw" currentAppUrl="http://localhost:9401" />
        </Sider>
        <Layout style={{ padding: '16px 24px' }}>
          <Content
            style={{
              background: colorBgContainer,
              padding: 24,
              margin: 0,
              borderRadius: borderRadiusLG,
              minHeight: 280,
              overflow: 'auto',
            }}
          >
            <Outlet />
          </Content>
        </Layout>
      </Layout>
    </Layout>
  );
}
```

- [ ] **Step 2: 提交**

```bash
git add APP-DW/src/components/AppLayout.tsx
git commit -m "feat(dw): use PlatformMenu for unified sidebar"
```

---

### Task 8: 改造 APP-APPHUB

**Files:**
- Modify: `APP-APPHUB/src/components/AppLayout.tsx`

- [ ] **Step 1: 替换菜单为 PlatformMenu**

完整替换文件内容：

```tsx
import { Outlet, useNavigate } from 'react-router-dom';
import { Layout, theme, Typography, Button } from 'antd';
import { LogoutOutlined } from '@ant-design/icons';
import { PlatformMenu } from '@mate/shared';
import { removeToken } from '@/utils/auth';

const { Header, Sider, Content } = Layout;

export default function AppLayout() {
  const navigate = useNavigate();
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  const handleLogout = () => {
    removeToken();
    navigate('/login');
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: colorBgContainer,
          padding: '0 24px',
          borderBottom: '1px solid #f0f0f0',
        }}
      >
        <Typography.Title level={4} style={{ margin: 0 }}>
          应用中心
        </Typography.Title>
        <Button type="text" icon={<LogoutOutlined />} onClick={handleLogout}>
          退出
        </Button>
      </Header>
      <Layout>
        <Sider width={240} style={{ background: colorBgContainer }}>
          <PlatformMenu currentModule="apphub" currentAppUrl="http://localhost:9201" />
        </Sider>
        <Layout style={{ padding: '16px 24px' }}>
          <Content
            style={{
              background: colorBgContainer,
              padding: 24,
              margin: 0,
              borderRadius: borderRadiusLG,
              minHeight: 280,
              overflow: 'auto',
            }}
          >
            <Outlet />
          </Content>
        </Layout>
      </Layout>
    </Layout>
  );
}
```

- [ ] **Step 2: 提交**

```bash
git add APP-APPHUB/src/components/AppLayout.tsx
git commit -m "feat(apphub): use PlatformMenu for unified sidebar"
```

---

### Task 9: 改造 APP-ONTSTUDIO

**Files:**
- Modify: `APP-ONTSTUDIO/src/components/AppLayout.tsx`

- [ ] **Step 1: 替换菜单为 PlatformMenu**

完整替换文件内容：

```tsx
import { Outlet, useNavigate } from 'react-router-dom';
import { Layout, theme, Typography } from 'antd';
import { PlatformMenu } from '@mate/shared';
import GlobalSearch from './GlobalSearch';

const { Header, Sider, Content } = Layout;

export default function AppLayout() {
  const navigate = useNavigate();
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: colorBgContainer,
          padding: '0 24px',
          borderBottom: '1px solid #f0f0f0',
        }}
      >
        <Typography.Title level={4} style={{ margin: 0 }}>
          Ontology Studio
        </Typography.Title>
        <GlobalSearch />
      </Header>
      <Layout>
        <Sider width={240} style={{ background: colorBgContainer }}>
          <PlatformMenu currentModule="ontstudio" currentAppUrl="http://localhost:9101" />
        </Sider>
        <Layout style={{ padding: '16px 24px' }}>
          <Content
            style={{
              background: colorBgContainer,
              padding: 24,
              margin: 0,
              borderRadius: borderRadiusLG,
              minHeight: 280,
              overflow: 'auto',
            }}
          >
            <Outlet />
          </Content>
        </Layout>
      </Layout>
    </Layout>
  );
}
```

- [ ] **Step 2: 提交**

```bash
git add APP-ONTSTUDIO/src/components/AppLayout.tsx
git commit -m "feat(ontstudio): use PlatformMenu for unified sidebar"
```

---

### Task 10: 改造 APP-ARCH

**Files:**
- Modify: `APP-ARCH/src/components/AppLayout.tsx`

- [ ] **Step 1: 替换菜单为 PlatformMenu**

完整替换文件内容：

```tsx
import { Outlet, useNavigate } from 'react-router-dom';
import { Layout, theme, Typography, Button } from 'antd';
import { LogoutOutlined } from '@ant-design/icons';
import { PlatformMenu } from '@mate/shared';
import { removeToken } from '@/utils/auth';

const { Header, Sider, Content } = Layout;

export default function AppLayout() {
  const navigate = useNavigate();
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  const handleLogout = () => {
    removeToken();
    navigate('/login');
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: colorBgContainer,
          padding: '0 24px',
          borderBottom: '1px solid #f0f0f0',
        }}
      >
        <Typography.Title level={4} style={{ margin: 0 }}>
          架构中心
        </Typography.Title>
        <Button type="text" icon={<LogoutOutlined />} onClick={handleLogout}>
          退出
        </Button>
      </Header>
      <Layout>
        <Sider width={240} style={{ background: colorBgContainer, overflow: 'auto' }}>
          <PlatformMenu currentModule="arch" currentAppUrl="http://localhost:9206" />
        </Sider>
        <Layout style={{ padding: '16px 24px' }}>
          <Content
            style={{
              background: colorBgContainer,
              padding: 24,
              margin: 0,
              borderRadius: borderRadiusLG,
              minHeight: 280,
              overflow: 'auto',
            }}
          >
            <Outlet />
          </Content>
        </Layout>
      </Layout>
    </Layout>
  );
}
```

- [ ] **Step 2: 提交**

```bash
git add APP-ARCH/src/components/AppLayout.tsx
git commit -m "feat(arch): use PlatformMenu for unified sidebar"
```

---

### Task 11: 改造 APP-MCPHUB

**Files:**
- Modify: `APP-MCPHUB/src/components/AppLayout.tsx`

- [ ] **Step 1: 替换菜单为 PlatformMenu**

完整替换文件内容：

```tsx
import { Outlet, useNavigate } from 'react-router-dom';
import { Layout, theme, Typography, Button } from 'antd';
import { LogoutOutlined } from '@ant-design/icons';
import { PlatformMenu } from '@mate/shared';
import { removeToken } from '@/utils/auth';

const { Header, Sider, Content } = Layout;

export default function AppLayout() {
  const navigate = useNavigate();
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  const handleLogout = () => {
    removeToken();
    navigate('/login');
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: colorBgContainer,
          padding: '0 24px',
          borderBottom: '1px solid #f0f0f0',
        }}
      >
        <Typography.Title level={4} style={{ margin: 0 }}>
          MCP Hub
        </Typography.Title>
        <Button type="text" icon={<LogoutOutlined />} onClick={handleLogout}>
          退出
        </Button>
      </Header>
      <Layout>
        <Sider width={240} style={{ background: colorBgContainer }}>
          <PlatformMenu currentModule="mcphub" currentAppUrl="http://localhost:9501" />
        </Sider>
        <Layout style={{ padding: '16px 24px' }}>
          <Content
            style={{
              background: colorBgContainer,
              padding: 24,
              margin: 0,
              borderRadius: borderRadiusLG,
              minHeight: 280,
              overflow: 'auto',
            }}
          >
            <Outlet />
          </Content>
        </Layout>
      </Layout>
    </Layout>
  );
}
```

- [ ] **Step 2: 提交**

```bash
git add APP-MCPHUB/src/components/AppLayout.tsx
git commit -m "feat(mcphub): use PlatformMenu for unified sidebar"
```

---

### Task 12: 编译共享包并检查类型

**Files:**
- All of the above

- [ ] **Step 1: 构建 @mate/shared**

```bash
cd packages/shared
npm run build
```

Expected: build succeeds with no TypeScript errors.

- [ ] **Step 2: 检查各 APP 类型**

```bash
cd APP-DASHBOARD && npx tsc --noEmit
cd ../APP-SUPERAI && npx tsc --noEmit
cd ../APP-DW && npx tsc --noEmit
cd ../APP-APPHUB && npx tsc --noEmit
cd ../APP-ONTSTUDIO && npx tsc --noEmit
cd ../APP-ARCH && npx tsc --noEmit
cd ../APP-MCPHUB && npx tsc --noEmit
```

Expected: all pass with no errors.

- [ ] **Step 3: 提交（如仅修复构建问题）**

```bash
git add -A
git commit -m "fix(shared): build and type check fixes for PlatformMenu"
```

---

### Task 13: 重启前端服务

**Files:**
- Running processes

- [ ] **Step 1: 停止所有前端进程**

```bash
.\docs\006-TMP\stop-frontends.ps1
```

- [ ] **Step 2: 启动所有前端**

```bash
.\docs\006-TMP\start-frontends.ps1
```

- [ ] **Step 3: 确认端口监听**

```bash
$ports = @(9101,9201,9202,9206,9301,9401,9501)
foreach ($p in $ports) { $r = Test-NetConnection -ComputerName localhost -Port $p -WarningAction SilentlyContinue; Write-Host "$p : $($r.TcpTestSucceeded)" }
```

Expected: all ports return True.

---

### Task 14: 验证菜单功能

**Files:**
- `docs/006-TMP/inspect_login2.py`（已存在，可扩展）

- [ ] **Step 1: 运行登录与页面加载验证**

```bash
python docs\006-TMP\inspect_login2.py
```

Expected: 5 个 APP 均登录成功并加载首页。

- [ ] **Step 2: 手动验证关键场景**

1. 打开 http://localhost:9202（DASHBOARD），确认左侧显示所有 7 个模块。
2. 点击「超级 AI」，页面跳转到 http://localhost:9301/chat，左侧仍显示所有模块，「超级 AI」展开二级菜单。
3. 在 SUPERAI 中点击「执行详情」(`/schedule/execution/detail`)，确认选中状态正确。
4. 点击「本体论引擎」，跳转到 ONTSTUDIO；点击「关系类型」(`/relations`) 与「关系实例」(`/relation-instances`)，确认选中互不干扰。
5. 进入 ARCH，确认「业务架构 / 数据架构 / 技术架构」分组正常展开，三级菜单选中正确。
6. 进入 MCPHUB，确认「权限控制」分组下三级菜单选中正确。

- [ ] **Step 3: 提交验证脚本（如扩展了菜单验证）**

```bash
git add docs/006-TMP/inspect_menu.py
git commit -m "test: add menu navigation verification script"
```

---

## 自我检查

- [ ] Spec 覆盖：所有 7 个 APP 的 AppLayout 替换、共享组件、路由匹配、跨应用跳转均已对应到任务。
- [ ] 无占位符：所有代码块均为完整可执行代码，无 TBD/TODO。
- [ ] 类型一致：`PlatformMenuProps` / `PlatformMenuItem` / `ActiveMenuResult` 在 Task 1-4 中定义，后续任务直接使用。
- [ ] 回退路径：各 APP 旧 AppLayout 可通过 git 回滚恢复。
