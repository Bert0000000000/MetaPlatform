import { Alert, Typography, Space, Tag, Button, List, Card, Row, Col, Statistic } from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  WarningOutlined,
  CloudUploadOutlined,
} from '@ant-design/icons';
import type { FlowValidationResult } from '@/types';

interface PublishValidationProps {
  result: FlowValidationResult;
  onPublish: () => void;
  publishing: boolean;
}

export default function PublishValidation({ result, onPublish, publishing }: PublishValidationProps) {
  return (
    <Card size="small" style={{ marginBottom: 16 }}>
      <Row gutter={16} style={{ marginBottom: 12 }}>
        <Col span={8}>
          <Statistic
            title="通过"
            value={result.valid ? '✓' : '✗'}
            valueStyle={{ color: result.valid ? '#52c41a' : '#f5222d' }}
          />
        </Col>
        <Col span={8}>
          <Statistic
            title="错误"
            value={result.errors.length}
            valueStyle={{ color: result.errors.length > 0 ? '#f5222d' : '#999' }}
            prefix={<CloseCircleOutlined />}
          />
        </Col>
        <Col span={8}>
          <Statistic
            title="警告"
            value={result.warnings.length}
            valueStyle={{ color: result.warnings.length > 0 ? '#faad14' : '#999' }}
            prefix={<WarningOutlined />}
          />
        </Col>
      </Row>

      <Space direction="vertical" style={{ width: '100%' }} size="small">
        <Alert
          type={result.valid ? 'success' : 'error'}
          message={
            result.valid
              ? '流程校验通过，可以发布'
              : `流程校验失败：${result.errors.length} 个错误`
          }
          showIcon
          icon={result.valid ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
          action={
            result.valid && (
              <Button
                type="primary"
                size="small"
                icon={<CloudUploadOutlined />}
                loading={publishing}
                onClick={onPublish}
              >
                发布
              </Button>
            )
          }
        />

        {result.errors.length > 0 && (
          <div>
            <Typography.Text danger strong>
              <CloseCircleOutlined /> 错误（{result.errors.length}）
            </Typography.Text>
            <List
              size="small"
              dataSource={result.errors}
              renderItem={(error) => (
                <List.Item>
                  <Space>
                    <Tag color="red">{error.code}</Tag>
                    <Typography.Text>{error.message}</Typography.Text>
                    {error.nodeId && (
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        [节点: {error.nodeId}]
                      </Typography.Text>
                    )}
                  </Space>
                </List.Item>
              )}
            />
          </div>
        )}

        {result.warnings.length > 0 && (
          <div>
            <Typography.Text type="warning" strong>
              <WarningOutlined /> 警告（{result.warnings.length}）
            </Typography.Text>
            <List
              size="small"
              dataSource={result.warnings}
              renderItem={(warning) => (
                <List.Item>
                  <Space>
                    <Tag color="orange">{warning.code}</Tag>
                    <Typography.Text>{warning.message}</Typography.Text>
                  </Space>
                </List.Item>
              )}
            />
          </div>
        )}
      </Space>
    </Card>
  );
}
