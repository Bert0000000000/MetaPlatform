import { Card, Empty, Tag, Timeline, Typography } from 'antd';

interface VersionEntry {
  version: string;
  timestamp: string;
  changeLog: string;
}

interface EmployeeVersionHistoryProps {
  employeeId: string;
}

const MOCK_VERSIONS: VersionEntry[] = [
  { version: '1.0.0', timestamp: '2026-07-01T10:00:00Z', changeLog: '初始创建' },
  { version: '1.1.0', timestamp: '2026-07-05T14:00:00Z', changeLog: '增加 SQL 查询工具，调整温度参数' },
  { version: '1.2.0', timestamp: '2026-07-10T09:00:00Z', changeLog: '知识库从财务切到 HR' },
];

export default function EmployeeVersionHistory({ employeeId }: EmployeeVersionHistoryProps) {
  return (
    <Card title="版本历史">
      {MOCK_VERSIONS.length === 0 ? (
        <Empty description="暂无版本" />
      ) : (
        <Timeline
          items={MOCK_VERSIONS.map((v) => ({
            color: 'blue',
            children: (
              <div>
                <Typography.Text strong>v{v.version}</Typography.Text>
                <Tag color="blue" style={{ marginLeft: 8 }}>{new Date(v.timestamp).toLocaleDateString()}</Tag>
                <div>
                  <Typography.Text type="secondary">{v.changeLog}</Typography.Text>
                </div>
              </div>
            ),
          }))}
        />
      )}
    </Card>
  );
}
