import { useNavigate } from 'react-router-dom';
import { Moon, Sparkles, Sun } from 'lucide-react';
import { useSettings } from '@/contexts/SettingsContext';
import { primaryDomains, type DomainDef } from './domains';
import { useShell } from './ShellContext';

export interface IconRailProps {
  /** 当前域；无匹配时为 undefined（例如处于未知路径） */
  active?: DomainDef;
}

/** Dark labeled product rail in the existing Semi dark theme scope. */
export default function IconRail({ active }: IconRailProps) {
  const navigate = useNavigate();
  const { toggleCopilot, copilotOpen } = useShell();
  const { resolvedTheme, setTheme } = useSettings();

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
    <nav className="mp-rail-nav" aria-label="平台导航">
      <button className="mp-rail-brand" type="button" aria-label="MetaPlatform 工作台" onClick={() => navigate('/home')}>M</button>
      <div role="menu" aria-label="平台入口" className="mp-rail-entries">
        {primaryDomains().map(domain => <button key={domain.key} type="button" role="menuitem"
          className="mp-rail-entry" aria-current={active?.key === domain.key ? 'page' : undefined}
          onClick={() => navigate(domain.path)}>
          {domain.icon}<span>{domain.label}</span>
        </button>)}
      </div>
      {footer}
    </nav>
  );
}
