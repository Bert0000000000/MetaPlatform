import React from 'react';
import { Card, Col, Row, Typography, Space, Divider, Alert, Tag } from 'antd';
import { ClaimRenderer } from '../ClaimRenderer';
import { EvidenceRenderer } from '../EvidenceRenderer';
import AgentChatPanel from '../AgentChatPanel';
import { InteractionContextProvider } from '@/hooks';
import type { Claim, Evidence } from '@/hooks';

const { Title, Paragraph } = Typography;

/**
 * P4.4 Storybook-style demo page for the new ontology-native components.
 *
 * Mount at /__storybook or render via dev server to validate the UI.
 */
export function StorybookDemo() {
    // Sample data
    const sampleClaims: Claim[] = [
        {
            claimId: 'CLM-001',
            type: 'FACT',
            text: 'CUST-10086 最近 30 天的销售收入为 4,800,000 元，同比下降 18%。',
            confidence: 0.95,
            evidenceRefs: ['EVD-001', 'EVD-002'],
        },
        {
            claimId: 'CLM-002',
            type: 'INFERENCE',
            text: '收入下降主要由华东区（华东-1 区域）的客户流失引起，流失率从 5% 上升至 22%。',
            confidence: 0.82,
            evidenceRefs: ['EVD-003'],
        },
        {
            claimId: 'CLM-003',
            type: 'RECOMMENDATION',
            text: '建议立即创建跟进任务，对高风险客户进行 7 天内回访。',
            confidence: 0.75,
            evidenceRefs: ['EVD-004'],
        },
    ];

    const sampleEvidence: Evidence[] = [
        {
            evidenceId: 'EVD-001',
            type: 'ONTOLOGY_METRIC',
            ref: 'metric://customer.revenue_30d?customerId=CUST-10086',
            fragment: '当前值 4,800,000 元；上期值 5,850,000 元；变化率 -18.0%',
            capturedAt: '2026-07-26T08:00:00Z',
            concept: 'Customer',
            objectId: 'CUST-10086',
            envelopeId: 'ENV-001',
        },
        {
            evidenceId: 'EVD-002',
            type: 'ONTOLOGY_OBJECT',
            ref: 'ontology://Customer/CUST-10086',
            fragment: 'customerLevel: KEY_ACCOUNT；region: EAST_CHINA；',
            capturedAt: '2026-07-26T08:00:00Z',
            concept: 'Customer',
            objectId: 'CUST-10086',
            envelopeId: 'ENV-001',
        },
        {
            evidenceId: 'EVD-003',
            type: 'ONTOLOGY_METRIC',
            ref: 'metric://customer.churn_rate?region=EAST_CHINA',
            fragment: '当前流失率 22%；历史均值 5%；',
            capturedAt: '2026-07-26T08:01:00Z',
            envelopeId: 'ENV-002',
        },
        {
            evidenceId: 'EVD-004',
            type: 'DOCUMENT',
            ref: 'doc://KB-PLAYBOOK-001',
            fragment: '高风险客户 7 天回访标准 SOP',
            capturedAt: '2026-07-20T00:00:00Z',
            envelopeId: 'ENV-003',
        },
    ];

    return (
        <div style={{ padding: 24, background: '#f5f5f5', minHeight: '100vh' }}>
            <Title level={2}>SuperAI Storybook Demo</Title>
            <Paragraph type="secondary">
                P4.4 验证 ClaimRenderer / EvidenceRenderer / AgentChatPanel UI。
                所有数据均为 sample，无真实业务语义。
            </Paragraph>

            <Divider titlePlacement="left">ClaimRenderer (3 类型)</Divider>
            <Row gutter={16}>
                {sampleClaims.map((claim) => (
                    <Col key={claim.claimId} span={8}>
                        <Card title={claim.type} size="small">
                            <ClaimRenderer claim={claim} />
                        </Card>
                    </Col>
                ))}
            </Row>

            <Divider titlePlacement="left">EvidenceRenderer (列表 + Drawer)</Divider>
            <Card>
                <EvidenceRenderer evidenceList={sampleEvidence} />
            </Card>

            <Divider titlePlacement="left">Edge cases</Divider>
            <Space direction="vertical" style={{ width: '100%' }}>
                <Card title="Empty evidence" size="small">
                    <EvidenceRenderer evidenceList={[]} emptyText="No evidence" />
                </Card>
                <Card title="Single FACT claim with no evidence" size="small">
                    <ClaimRenderer
                        claim={{
                            claimId: 'CLM-005',
                            type: 'FACT',
                            text: '测试无证据的 Claim 渲染',
                            confidence: 1.0,
                            evidenceRefs: [],
                        }}
                    />
                </Card>
            </Space>

            <Divider titlePlacement="left">AgentChatPanel (with InteractionContextProvider)</Divider>
            <Alert
                type="info"
                showIcon
                message="P6.5 流式 UI 演示"
                description="实际接 SSE 需要 TECH-AGENT 在 8511 端口运行；此处仅展示控件布局"
                style={{ marginBottom: 16 }}
            />
            <Card>
                <InteractionContextProvider
                    appCode="DW"
                    pageCode="agent-copilot"
                    pageUrl="/agent-copilot"
                >
                    <AgentChatPanel placeholder="演示：输入任意问题查看 UI 反馈（无后端时为空事件）" />
                </InteractionContextProvider>
            </Card>
        </div>
    );
}

export default StorybookDemo;
