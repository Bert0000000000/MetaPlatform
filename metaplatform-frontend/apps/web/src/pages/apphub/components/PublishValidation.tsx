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

function StatTile({
  title,
  value,
  prefix,
  tone,
}: {
  title: string;
  value: ReactNode;
  prefix?: ReactNode;
  /** 语义色类名（mp-text-success / -danger / -warning / -2） */
  tone?: string;
}) {
  return (
    <div className="mp-flex mp-gap-1 mp-flex-col" >
      <span className="mp-text-body mp-text-2">{title}</span>
      <div
        className={`mp-fw-600 mp-gap-1 mp-text-xl mp-flex-center${tone ? ` ${tone}` : ''}`}
      >
        {prefix}
        {value}
      </div>
    </div>
  );
}

export default function PublishValidation({ result, onPublish, publishing }: PublishValidationProps) {
  return (
    <Card bodyStyle={{ padding: 12 }} className="mp-mb-4">
      <Row gutter={16} className="mp-mb-3">
        <Col span={8}>
          <StatTile
            title="通过"
            value={result.valid ? <IconTick className="mp-text-success" /> : <IconClose className="mp-text-danger" />}
            tone={result.valid ? 'mp-text-success' : 'mp-text-danger'}
          />
        </Col>
        <Col span={8}>
          <StatTile
            title="错误"
            value={result.errors.length}
            prefix={<CloseCircleOutlined />}
            tone={result.errors.length > 0 ? 'mp-text-danger' : 'mp-text-2'}
          />
        </Col>
        <Col span={8}>
          <StatTile
            title="警告"
            value={result.warnings.length}
            prefix={<WarningOutlined />}
            tone={result.warnings.length > 0 ? 'mp-text-warning' : 'mp-text-2'}
          />
        </Col>
      </Row>

      <Space vertical spacing="tight" className="mp-w-full">
        {/* Banner 无 action 插槽，发布按钮放到右侧 */}
        <div className="mp-flex mp-gap-2 mp-items-start" >
          <Banner
            type={result.valid ? 'success' : 'danger'}
            icon={result.valid ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
            title={
              result.valid
                ? '流程校验通过，可以发布'
                : `流程校验失败：${result.errors.length} 个错误`
            }
            className="mp-flex-1"
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
            <div className="mp-flex mp-gap-1 mp-flex-col" >
              {result.errors.map((error) => (
                <div key={error.code} className="mp-py-1">
                  <Space>
                    <Tag color="red">{error.code}</Tag>
                    <Typography.Text>{error.message}</Typography.Text>
                    {error.nodeId && (
                      <Typography.Text type="tertiary" className="mp-text-sm">
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
            <div className="mp-flex mp-gap-1 mp-flex-col" >
              {result.warnings.map((warning) => (
                <div key={warning.code} className="mp-py-1">
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


import type { PublicationCheck } from '@/api/apphub/runtime';
const CHECK_LABELS: Record<string, string> = { bindings: '数据绑定', reference_versions: '引用版本', access: '访问权限', components: '必要组件', action_policy: '动作策略', runtime: '可加载运行页' };
export function ApplicationPublishValidation({ result, error, publishing, onPublish, onRetry }: {
  result: PublicationCheck | null; error: string; publishing: boolean; onPublish: () => void; onRetry: () => void;
}) {
  return <section aria-label="应用发布检查" className="mp-mb-4">
    <h3>应用发布检查</h3>
    {result && <p>草稿版本 {result.draft_version} · 检查时间 {result.checked_at} · 发布时将再次验证</p>}
    {error && <p role="alert">{error}；当前保存内容保留，请重试检查。</p>}
    <ul>{Object.entries(CHECK_LABELS).map(([key, label]) => {
      const check = result?.checks.find(item => item.key === key);
      const status = error ? 'unknown' : check?.status ?? 'unknown';
      return <li key={key}>{label}：{({ pass: '通过', fail: '失败', unknown: '未知' })[status]} — {check?.message ?? '等待服务端检查'}
        {check?.next_step && <p>下一步：{check.next_step}</p>}</li>;
    })}</ul>
    <button onClick={onRetry} disabled={publishing}>重新检查</button>
    <button onClick={onPublish} disabled={publishing || !!error || !result?.can_publish}>确认发布</button>
  </section>;
}
