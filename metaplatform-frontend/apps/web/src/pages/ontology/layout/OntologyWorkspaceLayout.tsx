import { Outlet } from 'react-router-dom';
import OntologyDomainShell from '../shell/OntologyDomainShell';
import OntologyContextBar from './OntologyContextBar';
import OntologySideNav from './OntologySideNav';
import './ontology-workspace.css';

/**
 * 本体工作区布局（ADR-0069 §2.1 / 设计规格 §5.1）：
 *
 * <pre>
 * ┌──────────────────────────────────────────────────────┐
 * │ ContextBar：当前位置 ∥ 搜索                            │
 * ├───────────────┬──────────────────────────────────────┤
 * │ Ontology Nav  │ OntologyDomainShell（Outlet）         │
 * └───────────────┴──────────────────────────────────────┘
 * </pre>
 *
 * <p>`OntologyDomainShell` 继续承担它原有的两件事（全幅页高度约束 + ADR-0065 S2
 * 导航上下文写入），工作区只是把左侧导航放到它旁边——壳的职责不因布局重构而复制。
 */
export default function OntologyWorkspaceLayout() {
  return (
    <div className="mp-onto-workspace">
      <OntologyContextBar />
      <div className="mp-onto-workspace-body">
        <OntologySideNav />
        <OntologyDomainShell>
          <Outlet />
        </OntologyDomainShell>
      </div>
    </div>
  );
}
