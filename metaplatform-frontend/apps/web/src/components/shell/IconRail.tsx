import { Nav } from '@douyinfe/semi-ui';
import { useNavigate } from 'react-router-dom';
import { Moon, Sparkles, Sun } from 'lucide-react';
import { useSettings } from '@/contexts/SettingsContext';
import { DOMAINS, type DomainDef, type DomainKey } from './domains';
import { useShell } from './ShellContext';

export interface IconRailProps {
  /** 当前域；无匹配时为 undefined（例如处于未知路径） */
  active?: DomainDef;
}

/**
 * 一级图标导航栏（DESIGN-SPEC §3 模式 A）。
 * 用 Semi Nav(vertical + isCollapsed) 承载：仅图标 + 悬浮提示，
 * 底部 Copilot / 主题开关走 Nav footer，与菜单区在视觉上分离。
 */
export default function IconRail({ active }: IconRailProps) {
  const navigate = useNavigate();
  const { toggleCopilot, copilotOpen } = useShell();
  const { resolvedTheme, setTheme } = useSettings();

  const items = DOMAINS.map((d) => ({
    itemKey: d.key,
    text: d.label,
    icon: d.icon,
  }));

  const nextTheme = resolvedTheme === 'dark' ? 'light' : 'dark';

  const footer = (
    <div className="mp-rail-foot">
      <button
        type="button"
        className={`mp-rail-icon${copilotOpen ? ' is-on' : ''}`}
        title="SuperAI Copilot"
        aria-label="SuperAI Copilot"
        onClick={toggleCopilot}
      >
        <Sparkles size={17} strokeWidth={1.5} />
      </button>
      <button
        type="button"
        className="mp-rail-icon"
        title={`切换到${nextTheme === 'dark' ? '深色' : '浅色'}主题`}
        aria-label="切换主题"
        onClick={() => {
          // 本地主题立即生效；远端同步失败（未登录 / 离线）不阻断切换
          void setTheme(nextTheme).catch(() => undefined);
        }}
      >
        {resolvedTheme === 'dark' ? (
          <Sun size={17} strokeWidth={1.5} />
        ) : (
          <Moon size={17} strokeWidth={1.5} />
        )}
      </button>
    </div>
  );

  return (
    <Nav
      className="mp-rail-nav"
      mode="vertical"
      isCollapsed
      items={items}
      selectedKeys={active ? [active.key as DomainKey] : []}
      footer={footer}
      onClick={({ itemKey }) => {
        const target = DOMAINS.find((d) => d.key === itemKey);
        if (target) navigate(target.path);
      }}
    />
  );
}
