import type { ReactNode } from 'react';
import { Banner, Button, Card, Space, Tag, Typography } from '@douyinfe/semi-ui';
import { Row, Col } from '@douyinfe/semi-ui/lib/es/grid';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  WarningOutlined,
  CloudUploadOutlined,
} from '@ant-design/icons';
import { IconTick, IconClose } from '@douyinfe/semi-icons';
import type { FlowValidationResult } from '@/api/apphub/types';

interface PublishValidationProps {
  result: FlowValidationResult;
  onPublish: () => void;
  publishing: boolean;
}

/** Semi 无 Statistic，自建：label + 大数字（可选前缀图标与颜色） */
function StatTile({
  title,
  value,
  prefix,
  color,
}: {
  title: string;
  value: ReactNode;
  prefix?: ReactNode;
  color?: string;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>{title}</span>
      <div
        style={{
          fontSize: 24,
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          color,
        }}
      >
        {prefix}
        {value}
      </div>
    </div>
  );
}

export default function PublishValidation({ result, onPublish, publishing }: PublishValidationProps) {
  return (
    <Card bodyStyle={{ padding: 12 }} style={{ marginBottom: 16 }}>
      <Row gutter={16} style={{ marginBottom: 12 }}>
        <Col span={8}>
          <StatTile
            title="通过"
            value={result.valid ? <IconTick style={{ color: 'var(--success)' }} /> : <IconClose style={{ color: 'var(--destructive)' }} />}
            color={result.valid ? 'var(--success)' : 'var(--destructive)'}
          />
        </Col>
        <Col span={8}>
          <StatTile
            title="错误"
            value={result.errors.length}
            prefix={<CloseCircleOutlined />}
            color={result.errors.length > 0 ? 'var(--destructive)' : 'var(--muted-foreground)'}
          />
        </Col>
        <Col span={8}>
          <StatTile
            title="警告"
            value={result.warnings.length}
            prefix={<WarningOutlined />}
            color={result.warnings.length > 0 ? 'var(--warning)' : 'var(--muted-foreground)'}
          />
        </Col>
      </Row>

      <Space vertical spacing="tight" style={{ width: '100%' }}>
        {/* Banner 无 action 插槽，发布按钮放到右侧 */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <Banner
            type={result.valid ? 'success' : 'danger'}
            icon={result.valid ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
            title={
              result.valid
                ? '流程校验通过，可以发布'
                : `流程校验失败：${result.errors.length} 个错误`
            }
            style={{ flex: 1 }}
          />
          {result.valid && (
            <Button
              theme="solid"
              type="primary"
              size="small"
              icon={<CloudUploadOutlined />}
              loading={publishing}
              onClick={onPublish}
            >
              发布
            </Button>
          )}
        </div>

        {result.errors.length > 0 && (
          <div>
            <Typography.Text type="danger" strong>
              <CloseCircleOutlined /> 错误（{result.errors.length}）
            </Typography.Text>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {result.errors.map((error) => (
                <div key={error.code} style={{ padding: '4px 0' }}>
                  <Space>
                    <Tag color="red">{error.code}</Tag>
                    <Typography.Text>{error.message}</Typography.Text>
                    {error.nodeId && (
                      <Typography.Text type="tertiary" style={{ fontSize: 12 }}>
                        [节点: {error.nodeId}]
                      </Typography.Text>
                    )}
                  </Space>
                </div>
              ))}
            </div>
          </div>
        )}

        {result.warnings.length > 0 && (
          <div>
            <Typography.Text type="warning" strong>
              <WarningOutlined /> 警告（{result.warnings.length}）
            </Typography.Text>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {result.warnings.map((warning) => (
                <div key={warning.code} style={{ padding: '4px 0' }}>
                  <Space>
                    <Tag color="orange">{warning.code}</Tag>
                    <Typography.Text>{warning.message}</Typography.Text>
                  </Space>
                </div>
              ))}
            </div>
          </div>
        )}
      </Space>
    </Card>
  );
}
