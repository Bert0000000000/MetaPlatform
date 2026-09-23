import { Outlet } from 'react-router-dom';
import OntologyDomainShell from '../shell/OntologyDomainShell';

/**
 * 本体域 tab 模式布局（2026-09-24 用户决策：与全站一致的横向导航）。
 *
 * <p>导航呈现回归 AppShell 的 PageTabs：主 tab = 六大功能组（domains.tsx），
 * children 胶囊行 = 各组子页面——与 ki/gov/admin 域同构。本布局只保留域壳
 * （全幅页高度约束 / gutter / ADR-0065 S2 导航上下文写入）。
 *
 * <p>IA v2 的全部正式 URL 与「路由即状态」成果不变（ADR-0069 附录）。
 */
export default function OntologyTabLayout() {
  return (
    <OntologyDomainShell>
      <Outlet />
    </OntologyDomainShell>
  );
}
