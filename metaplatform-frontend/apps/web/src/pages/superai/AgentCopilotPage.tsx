import React, { useEffect, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { Card, Space, Typography, Tag } from '@douyinfe/semi-ui';
import { InteractionContextProvider } from '@/api/superai/types';
import AgentChatPanelImpl from './components/AgentChatPanel';

const { Title, Text } = Typography;

/**
 * P4.2 AgentCopilotPage - dedicated page for ontology-native Agent Run.
 *
 * <p>Wired into the SuperAI sidebar; reads optional ?concept=Customer&objectId=CUST-10086
 * query params to seed the InteractionContext subject.</p>
 */
export default function AgentCopilotPage() {
  const [params] = useSearchParams();
  const location = useLocation();
  const [subject, setSubject] = useState<{ conceptCode: string; objectId: string } | undefined>(undefined);

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
      <div style={{ padding: 16, flex: 1, minHeight: 0, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 12, margin: '0 -24px' }}>
        <Space>
          <Title heading={4} style={{ margin: 0 }}>Object Copilot</Title>
          {subject && (
            <Tag color="blue">
              {subject.conceptCode}#{subject.objectId}
            </Tag>
          )}
        </Space>
        <Text type="secondary">
          Stream 实时 RunEvents · Claim/Evidence 绑定 · 统一 OntologyContextEnvelope 签名
        </Text>
        <div style={{ flex: 1, minHeight: 0 }}>
          <AgentChatPanelImpl placeholder="分析当前对象的最近情况，或直接问业务问题" />
        </div>
      </div>
    </InteractionContextProvider>
  );
}
