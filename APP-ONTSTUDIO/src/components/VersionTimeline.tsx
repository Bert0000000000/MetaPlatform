import { Timeline, Tag, Typography } from 'antd';
import type { OntologyVersion } from '@/api/versions';

interface VersionTimelineProps {
  versions: OntologyVersion[];
  selectedId?: string;
  onSelect: (id: string) => void;
}

const STATUS_COLOR: Record<OntologyVersion['status'], string> = {
  DRAFT: 'gray',
  PUBLISHED: 'green',
  ARCHIVED: 'orange',
};

export default function VersionTimeline({ versions, selectedId, onSelect }: VersionTimelineProps) {
  return (
    <Timeline
      items={versions.map((v) => ({
        color:
          v.status === 'PUBLISHED' ? 'green' : v.status === 'ARCHIVED' ? 'gray' : 'blue',
        children: (
          <div
            onClick={() => onSelect(v.versionId)}
            style={{
              cursor: 'pointer',
              background: selectedId === v.versionId ? '#e6f4ff' : 'transparent',
              padding: 8,
              borderRadius: 4,
            }}
          >
            <Typography.Text strong>v{v.code}</Typography.Text>
            <Tag color={STATUS_COLOR[v.status]} style={{ marginLeft: 8 }}>
              {v.status}
            </Tag>
            <div>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {v.description || '无说明'} - {new Date(v.createdAt).toLocaleString()}
              </Typography.Text>
            </div>
          </div>
        ),
      }))}
    />
  );
}
