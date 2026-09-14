import { Button, Card } from '@douyinfe/semi-ui';
import { useLocation } from 'react-router-dom';
import { Sparkles, X } from 'lucide-react';
import { resolveDomain, resolveDomainTab } from './domains';
import { useShell } from './ShellContext';

/**
 * Copilot 全局侧栏（DESIGN-SPEC §6.2）。
 * UI-P0 范围：仅挂载 + 开合；对话逻辑、计划卡片留给后续批次，
 * 因此这里只呈现「当前页面上下文」与占位说明，不伪造对话内容。
 */
export default function CopilotDock() {
  const location = useLocation();
  const { copilotOpen, toggleCopilot } = useShell();

  const domain = resolveDomain(location.pathname);
  const tab = domain ? resolveDomainTab(domain, location.pathname) : undefined;
  const contextLabel = domain ? `${domain.label} / ${tab?.label ?? '—'}` : '当前页面';

  return (
    <aside className="mp-dock" aria-label="SuperAI Copilot" aria-hidden={!copilotOpen}>
      <div className="mp-dock-head">
        <span className="mp-dock-name">
          <Sparkles size={16} strokeWidth={1.5} />
          SuperAI Copilot
        </span>
        <span className="mp-dock-ctx" title={contextLabel}>
          {contextLabel}
        </span>
        <Button
          theme="borderless"
          type="tertiary"
          icon={<X size={16} strokeWidth={1.5} />}
          aria-label="收起 Copilot"
          onClick={toggleCopilot}
        />
      </div>

      <div className="mp-dock-body">
        <Card>
          <p className="mp-dock-note">
            已感知当前页面：<strong>{contextLabel}</strong>
          </p>
          <p className="mp-dock-note">
            UI-P0 只交付侧栏壳体与开合。对话、计划卡片（AI proposal + HITL）在后续批次接入，
            这里不会展示任何模拟内容。
          </p>
        </Card>
      </div>

      <div className="mp-dock-foot">
        {/* 输入框在 P0 不接线，禁用态避免误导为可用 */}
        <Button block disabled>
          向 SuperAI 提问（P0 未接入）
        </Button>
      </div>
    </aside>
  );
}
