import { ConfigProvider, App as AntApp } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import enUS from 'antd/locale/en_US';
import {
  LayoutDashboard,
  MessageSquare,
  GitBranch,
  Blocks,
  Cpu,
  Plug,
  Bot,
  Settings,
  ArrowUpRight,
} from 'lucide-react';
import { AppLayout, getAntdTheme, useThemeMode } from '@mate/shared';
import type { LucideIcon } from 'lucide-react';

interface ModuleCard {
  key: string;
  title: string;
  description: string;
  icon: LucideIcon;
  url: string;
}

const modules: ModuleCard[] = [
  {
    key: 'dashboard',
    title: '工作台',
    description: '指标看板、待办、快捷入口',
    icon: LayoutDashboard,
    url: 'http://localhost:9230/dashboard',
  },
  {
    key: 'superai',
    title: 'SuperAI',
    description: 'AI 对话、任务编排、智能分析',
    icon: MessageSquare,
    url: 'http://localhost:9231/superai',
  },
  {
    key: 'arch',
    title: '架构中心',
    description: '业务、应用、数据、技术架构治理',
    icon: GitBranch,
    url: 'http://localhost:9232/arch',
  },
  {
    key: 'apphub',
    title: '应用中心',
    description: '应用建模、表单、流程、发布',
    icon: Blocks,
    url: 'http://localhost:9233/apphub',
  },
  {
    key: 'ontstudio',
    title: '本体引擎',
    description: '本体论管理、数据中心、知识图谱',
    icon: Cpu,
    url: 'http://localhost:9220/',
  },
  {
    key: 'mcphub',
    title: 'MCP 中心',
    description: 'MCP Server / Client、调试与审计',
    icon: Plug,
    url: 'http://localhost:9234/mcphub',
  },
  {
    key: 'dw',
    title: '数字员工',
    description: '数字员工、任务、协作、效果评估',
    icon: Bot,
    url: 'http://localhost:9235/dw',
  },
  {
    key: 'admin',
    title: '后台管理',
    description: '用户、权限、组织、日志、配置',
    icon: Settings,
    url: 'http://localhost:9236/admin',
  },
];

function HomePage() {
  return (
    <div className="v-portal-home">
      <header className="v-page-header">
        <div>
          <h1 className="v-page-title">统一入口</h1>
          <p className="v-page-desc">选择下方模块进入对应子应用</p>
        </div>
      </header>

      <section className="v-portal-grid">
        {modules.map((module) => {
          const Icon = module.icon;
          return (
            <a
              key={module.key}
              href={module.url}
              className="v-portal-card v-card"
              rel="noopener noreferrer"
            >
              <div className="v-portal-card-icon">
                <Icon style={{ width: 24, height: 24, strokeWidth: 1.5 }} />
              </div>
              <div className="v-portal-card-body">
                <div className="v-portal-card-title">
                  {module.title}
                  <ArrowUpRight
                    className="v-portal-card-arrow"
                    style={{ width: 16, height: 16, strokeWidth: 1.5 }}
                  />
                </div>
                <div className="v-portal-card-desc">{module.description}</div>
              </div>
            </a>
          );
        })}
      </section>
    </div>
  );
}

function App() {
  const { resolvedTheme, language } = useThemeMode();
  const locale = language === 'en-US' ? enUS : zhCN;
  const { theme } = getAntdTheme(resolvedTheme, locale);

  return (
    <ConfigProvider locale={locale} theme={theme}>
      <AntApp>
        <AppLayout module="portal">
          <HomePage />
        </AppLayout>
      </AntApp>
    </ConfigProvider>
  );
}

export default App;
