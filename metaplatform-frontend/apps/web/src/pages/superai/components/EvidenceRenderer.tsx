import { useState } from 'react';
import { Card, Tag, Typography } from '@douyinfe/semi-ui';
import { Database, FileText, Link } from 'lucide-react';
import type { Evidence } from '@/api/superai/types';
import { EmptyState, SheetDetail } from '@/components/skeleton';

const { Text, Paragraph } = Typography;

export interface EvidenceRendererProps {
  evidenceList: Evidence[];
  emptyText?: string;
}

/** evidence 类型 → 图标样式类（颜色全在 CSS 里）。 */
function iconClassFor(type: Evidence['type']): string {
  switch (type) {
    case 'ONTOLOGY_OBJECT':
    case 'ONTOLOGY_METRIC':
    case 'ONTOLOGY_RELATION':
      return 'is-ontology';
    case 'DOCUMENT':
    case 'KB_CHUNK':
      return 'is-document';
    default:
      return 'is-external';
  }
}

function iconFor(type: Evidence['type']) {
  switch (type) {
    case 'ONTOLOGY_OBJECT':
    case 'ONTOLOGY_METRIC':
    case 'ONTOLOGY_RELATION':
      return <Database size={16} strokeWidth={1.5} />;
    case 'DOCUMENT':
    case 'KB_CHUNK':
      return <FileText size={16} strokeWidth={1.5} />;
    default:
      return <Link size={16} strokeWidth={1.5} />;
  }
}

/**
 * P4.5 EvidenceRenderer - 渲染 Evidence 列表，点开右侧非模态详情浮层。
 * 详情统一走 P0 的 SheetDetail（456px / mask=false / Esc 关闭）。
 */
export function EvidenceRenderer({ evidenceList, emptyText }: EvidenceRendererProps) {
  const [activeEvidence, setActiveEvidence] = useState<Evidence | null>(null);

  if (evidenceList.length === 0) {
    return (
      <EmptyState
        illustration="no-content"
        title={emptyText || '暂无证据'}
        desc="回答引用的证据会在生成过程中逐条出现。"
      />
    );
  }

  return (
    <>
      <div className="mp-evidence-list">
        {evidenceList.map((e) => (
          <Card key={e.evidenceId} className="mp-evidence">
            <div onClick={() => setActiveEvidence(e)} data-evidence-id={e.evidenceId}>
              <div className="mp-evidence-head">
                <span className={`mp-evidence-icon ${iconClassFor(e.type)}`}>{iconFor(e.type)}</span>
                <Text strong className="mp-evidence-ref">
                  {e.ref}
                </Text>
                <Tag color="grey" type="light">
                  {e.type}
                </Tag>
              </div>
              {e.concept ? (
                <Text type="tertiary" className="mp-evidence-sub">
                  {e.concept}
                  {e.objectId ? ` / ${e.objectId}` : ''}
                </Text>
              ) : null}
              {e.fragment ? (
                <Paragraph type="tertiary" ellipsis={{ rows: 2 }} className="mp-evidence-fragment">
                  {e.fragment}
                </Paragraph>
              ) : null}
            </div>
          </Card>
        ))}
      </div>

      <SheetDetail
        title={activeEvidence ? `Evidence · ${activeEvidence.evidenceId}` : 'Evidence'}
        open={activeEvidence !== null}
        onClose={() => setActiveEvidence(null)}
        footer={<Text type="tertiary">证据由执行链落库，只读</Text>}
      >
        {activeEvidence ? (
          <div className="mp-evidence-sheet">
            <div>
              <div className="mp-evidence-field-label">Type</div>
              <Tag color="grey" type="light">
                {activeEvidence.type}
              </Tag>
            </div>
            <div>
              <div className="mp-evidence-field-label">Reference</div>
              <code className="mp-evidence-code">{activeEvidence.ref}</code>
            </div>
            {activeEvidence.concept ? (
              <div>
                <div className="mp-evidence-field-label">Concept / Object</div>
                <Text>
                  {activeEvidence.concept}
                  {activeEvidence.objectId ? ` / ${activeEvidence.objectId}` : ''}
                </Text>
              </div>
            ) : null}
            {activeEvidence.fragment ? (
              <div>
                <div className="mp-evidence-field-label">Fragment</div>
                <Paragraph copyable className="mp-evidence-fragment-box">
                  {activeEvidence.fragment}
                </Paragraph>
              </div>
            ) : null}
            <div>
              <div className="mp-evidence-field-label">Captured at</div>
              <Text>{activeEvidence.capturedAt}</Text>
            </div>
            <div>
              <div className="mp-evidence-field-label">Envelope</div>
              <code className="mp-evidence-code">{activeEvidence.envelopeId}</code>
            </div>
            {activeEvidence.toolCallId ? (
              <div>
                <div className="mp-evidence-field-label">Tool call</div>
                <code className="mp-evidence-code">{activeEvidence.toolCallId}</code>
              </div>
            ) : null}
          </div>
        ) : null}
      </SheetDetail>
    </>
  );
}

export default EvidenceRenderer;
