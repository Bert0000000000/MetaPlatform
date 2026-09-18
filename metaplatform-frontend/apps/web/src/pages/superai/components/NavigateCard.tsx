// NavigateCard - agent 说"我建好了，去看 X"之后落在聊天里的**导航卡片**（ADR-0065 §3.3）。
//
// 与 evidence / proposal 卡片同模式：agent 只发**建议**，用户点击才跳转——对齐本仓
// HITL 哲学（AI 输出皆 proposal），比 agent-native 的"UI 收到即跳"更保守。
//
// **R4（评审硬条件）**：`target.path` 是**模型产出的字符串**。直接把模型可控的字符串
// 交给前端路由 = 开放重定向 / `javascript:` 注入面。所以这里在**渲染成可点击之前**
// 过 `isAllowedNavigatePath` 白名单：不合规的一律降级为**纯文本**——渲染成一个不带
// onClick 的块，连"看起来能点"都不给。白名单规则见该函数的注释。
//
// 跳转本身用**原生 `<button>`**：dev 模式下 Semi Button 的 onClick 会被 React 18
// root delegation + vite HMR 截成 noop（CLAUDE.md 已知坑），而"点击导航"正是本卡片
// 唯一要做的事——用 Semi Button 会让整张卡片在 dev 下变成死卡。

import { Compass, ShieldAlert } from 'lucide-react';
import { isAllowedNavigatePath } from '@/api/superai/chat';

export interface NavigateCardProps {
  target: { path: string; label: string };
  /** 用户点击后由宿主执行跳转（宿主持有 router）。 */
  onNavigate: (path: string) => void;
}

export default function NavigateCard({ target, onNavigate }: NavigateCardProps) {
  const label = target.label || target.path || '查看';
  const allowed = isAllowedNavigatePath(target.path);

  if (!allowed) {
    // 降级：**不是**可点击元素，只是一个说明块。data-testid 让 negative 用例可断言
    // "它没有被渲染成按钮"。
    return (
      <div className="mp-navigate-card mp-navigate-card--blocked" data-testid="navigate-card-blocked">
        <div className="mp-navigate-head">
          <ShieldAlert size={15} strokeWidth={1.5} />
          <span className="mp-navigate-title">建议跳转（已拦截）</span>
        </div>
        <div className="mp-navigate-target">{label}</div>
        <div className="mp-navigate-blocked-note">
          目标不在应用内已知路由范围内，已降级为纯文本，不可点击。
          <code className="mp-navigate-path">{target.path || '(空)'}</code>
        </div>
      </div>
    );
  }

  return (
    <div className="mp-navigate-card" data-testid="navigate-card">
      <div className="mp-navigate-head">
        <Compass size={15} strokeWidth={1.5} />
        <span className="mp-navigate-title">建议跳转</span>
      </div>
      <div className="mp-navigate-target">{label}</div>
      <button
        type="button"
        className="mp-proposal-btn mp-proposal-btn--primary"
        data-testid="navigate-card-go"
        data-navigate-path={target.path}
        onClick={() => onNavigate(target.path)}
      >
        前往查看
      </button>
      <code className="mp-navigate-path">{target.path}</code>
    </div>
  );
}
