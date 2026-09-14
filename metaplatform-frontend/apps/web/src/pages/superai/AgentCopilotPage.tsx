import { useEffect, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { Tag } from '@douyinfe/semi-ui';
import { InteractionContextProvider } from '@/api/superai/types';
import { PageHeader } from '@/components/skeleton';
import AgentChatPanelImpl from './components/AgentChatPanel';

/**
 * P4.2 AgentCopilotPage - ontology-native Agent Run 的独立页。
 *
 * 版式：PageHeader（标题 + 说明 + 主体标签）+ AgentChatPanel。
 * 保留原数据接线：读取 ?concept=&objectId= 作为 InteractionContext 的 subject。
 */
export default function AgentCopilotPage() {
  const [params] = useSearchParams();
  const location = useLocation();
  const [subject, setSubject] = useState<{ conceptCode: string; objectId: string } | undefined>(
    undefined,
  );

  useEffect(() => {
    const concept = params.get('concept');
    const objectId = params.get('objectId');
    if (concept && objectId) {
      setSubject({ conceptCode: concept, objectId });
    }
  }, [params, location.pathname]);

  return (
    <InteractionContextProvider
      appCode="DW"
      pageCode="agent-copilot"
      pageUrl="/agent-copilot"
      initialSubject={subject}
    >
      <PageHeader
        title="Object Copilot"
        desc="Stream 实时 RunEvents · Claim/Evidence 绑定 · 统一 OntologyContextEnvelope 签名"
        actions={
          subject ? (
            <Tag color="blue" type="light">
              {subject.conceptCode}#{subject.objectId}
            </Tag>
          ) : undefined
        }
      />
      <AgentChatPanelImpl placeholder="分析当前对象的最近情况，或直接问业务问题" />
    </InteractionContextProvider>
  );
}
