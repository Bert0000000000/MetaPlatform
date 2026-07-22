import { useNavigate, useLocation } from 'react-router-dom';
import { useMemo } from 'react';
import {
  LayoutDashboard,
  Sparkles,
  GitBranch,
  Boxes,
  Database,
  BookOpen,
  Plug,
  Bot,
  Settings,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  key: string;
  label: string;
  icon: LucideIcon;
  path: string;
}

/** 9 个一级导航菜单，与 UI 设计稿完全一致 */
export const NAV_ITEMS: NavItem[] = [
  { key: 'dashboard', label: '工作台', icon: LayoutDashboard, path: '/dashboard' },
  { key: 'superai', label: 'SuperAI', icon: Sparkles, path: '/superai' },
  { key: 'arch', label: '架构中心', icon: GitBranch, path: '/arch' },
  { key: 'apps', label: '应用中心', icon: Boxes, path: '/apps' },
  { key: 'ontology', label: '本体引擎', icon: Database, path: '/ontology' },
  { key: 'knowledge', label: '知识库', icon: BookOpen, path: '/knowledge' },
  { key: 'mcp', label: 'MCP 中心', icon: Plug, path: '/mcp' },
  { key: 'agents', label: '数字员工', icon: Bot, path: '/agents' },
  { key: 'admin', label: '后台管理', icon: Settings, path: '/admin' },
];

interface PlatformMenuProps {
  currentModule?: string;
}

export default function PlatformMenu({ currentModule }: PlatformMenuProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const selectedKey = useMemo(() => {
    const pathname = location.pathname;
    // 匹配最长前缀
    let bestMatch: NavItem | undefined;
    for (const item of NAV_ITEMS) {
      if (pathname === item.path || pathname.startsWith(item.path + '/')) {
        if (!bestMatch || item.path.length > bestMatch.path.length) {
          bestMatch = item;
        }
      }
    }
    return bestMatch?.key ?? (currentModule ?? '');
  }, [location.pathname, currentModule]);

  return (
    <nav className="v-sidebar-nav" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const isActive = item.key === selectedKey;
        return (
          <a
            key={item.key}
            className={`v-sidebar-item${isActive ? ' active' : ''}`}
            onClick={(e) => {
              e.preventDefault();
              navigate(item.path);
            }}
            style={{ cursor: 'pointer' }}
          >
            <Icon style={{ width: 18, height: 18, strokeWidth: 1.5, flexShrink: 0 }} />
            <span>{item.label}</span>
          </a>
        );
      })}
    </nav>
  );
}
