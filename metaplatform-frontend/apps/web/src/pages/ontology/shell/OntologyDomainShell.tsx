import type { ReactNode } from 'react';
import './shell.css';

/**
 * 本体域域级外壳。
 *
 * 只做两件事：
 *  1. 承载全幅页的高度约束（`.mp-onto-shell` / `.mp-onto-shell-main`）；
 *  2. 给非全幅页补默认 gutter，让全幅页（对象浏览器 / 数据中心）自己接管留白
 *     —— 见 shell.css 的 `:has(> .mp-page-full)` 规则。
 *
 * 2026-09-17：域内的浮动「AI 助手」入口（AIAssistantWorkspace + Trigger + 提案抽屉）
 * 已移除。AI 能力统一走顶栏的全局 SuperAI Copilot，不再在域内另起一个入口。
 */
export default function OntologyDomainShell({ children }: { children: ReactNode }) {
  return (
    <div className="mp-page-full mp-onto-shell">
      <div className="mp-onto-shell-main">{children}</div>
    </div>
  );
}
