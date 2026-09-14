import { createContext, useContext, useState, type ReactNode } from 'react';
import { AIAssistantTrigger, AIAssistantWorkspace } from '@mate/shared';
import ProposalConfirmDrawer from '../components/ProposalConfirmDrawer';
import { useOntologyAssistant, type ProposalFromStream } from '../hooks/useOntologyAssistant';
import './shell.css';

/**
 * 本体域域级外壳：把「AI 助手 + proposal 确认」这套 HITL 能力挂在域的 4 个页内 tab 之上。
 *
 * 为什么不是 PageRoot：本域的对象浏览器（B 骨架）与数据中心（F 骨架）是全幅页，
 * 需要直接接管 .mp-page 的留白（见 shell.css 的 :has 规则）。这里因此只做
 * 「助手面板 + 浮动入口 + proposal 抽屉」的包夹，不引入额外的滚动容器与页头。
 */
const RefreshContext = createContext(0);

/** proposal 执行成功后的刷新信号（页面可作为 useEffect 依赖）。 */
export function useOntologyRefreshKey(): number {
  return useContext(RefreshContext);
}

export default function OntologyDomainShell({ children }: { children: ReactNode }) {
  const [pendingProposal, setPendingProposal] = useState<ProposalFromStream | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const assistant = useOntologyAssistant({
    employeeId: 'ontology-modeler',
    employeeName: '本体建模数字员工',
    employeeDescription: '统一调度本体引擎各模块的数字员工',
    moduleLabel: 'Ontology 引擎',
    welcomeMessage:
      '你好，我是本体 AI。可以协助你管理对象 / 数据 / 建模 / 运维各模块，输入自然语言描述即可生成概念提案。',
    suggestions: [
      '帮我设计一个「数字员工档案」概念',
      '把「客户档案」和「企业客户」合并',
      '当前本体有多少概念',
      'CDC 同步状态如何',
    ],
    baseContext: {
      interaction: {
        appCode: 'mate-platform',
        pageCode: 'ontology-domain',
        pageUrl: '/ontology',
      },
    },
    onProposal: (proposal) => setPendingProposal(proposal),
    onError: (msg) => {
      // 流式失败兜底（toast 由 shared client interceptor 统一处理）
      console.warn('[OntologyAssistant] stream failed:', msg);
    },
  });

  return (
    <RefreshContext.Provider value={refreshKey}>
      <div className="mp-page-full mp-onto-shell">
        <AIAssistantWorkspace assistant={assistant}>
          <div className="mp-onto-shell-main">{children}</div>
        </AIAssistantWorkspace>

        <div className="mp-onto-ai-dock">
          <AIAssistantTrigger open={assistant.isOpen} onClick={assistant.toggle} />
        </div>

        <ProposalConfirmDrawer
          open={pendingProposal !== null}
          proposalId={pendingProposal?.proposal_id ?? null}
          initialKind={pendingProposal?.kind}
          onExecuted={(proposalId) => {
            if (proposalId) setRefreshKey((k) => k + 1);
          }}
          onClosed={() => setPendingProposal(null)}
        />
      </div>
    </RefreshContext.Provider>
  );
}
