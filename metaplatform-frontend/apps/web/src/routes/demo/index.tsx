import { Button, Card, Descriptions, Select, Steps, Tag, Timeline, Toast } from '@douyinfe/semi-ui';
import { useState } from 'react';
import { Plus, RefreshCw } from 'lucide-react';
import {
  DataTablePro,
  EmptyState,
  FilterBar,
  PageHeader,
  SheetDetail,
  type DataTableProProps,
} from '@/components/skeleton';
import './demo.css';

interface DemoRow {
  id: string;
  name: string;
  domain: string;
  status: 'running' | 'done' | 'failed';
  owner: string;
  updatedAt: string;
}

const STATUS_META: Record<DemoRow['status'], { label: string; color: 'blue' | 'green' | 'red' }> = {
  running: { label: '进行中', color: 'blue' },
  done: { label: '已完成', color: 'green' },
  failed: { label: '失败', color: 'red' },
};

const SPACING_TOKENS: Array<{ token: string; className: string }> = [
  { token: '--mp-space-1', className: 'mp-demo-bar-1' },
  { token: '--mp-space-2', className: 'mp-demo-bar-2' },
  { token: '--mp-space-3', className: 'mp-demo-bar-3' },
  { token: '--mp-space-4', className: 'mp-demo-bar-4' },
  { token: '--mp-space-5', className: 'mp-demo-bar-5' },
  { token: '--mp-space-6', className: 'mp-demo-bar-6' },
  { token: '--mp-space-7', className: 'mp-demo-bar-7' },
  { token: '--mp-space-8', className: 'mp-demo-bar-8' },
  { token: '--mp-space-9', className: 'mp-demo-bar-9' },
  { token: '--mp-space-10', className: 'mp-demo-bar-10' },
];

function buildRows(): DemoRow[] {
  const domains = ['客户', '订单', '供应商', '产品'];
  const statuses: DemoRow['status'][] = ['running', 'done', 'failed'];
  return Array.from({ length: 12 }, (_, i) => ({
    id: `SO-${88213 + i}`,
    name: `${domains[i % domains.length]}对象实例 ${String(i + 1).padStart(3, '0')}`,
    domain: domains[i % domains.length],
    status: statuses[i % statuses.length],
    owner: ['供应链分析师-07', '订单审核员-02', '市场情报员-01'][i % 3],
    updatedAt: `2026-09-${String((i % 14) + 1).padStart(2, '0')} 09:2${i % 6}`,
  }));
}

const ROWS = buildRows();
const PAGE_SIZE = 5;

/**
 * UI-P0 组件演示页 —— 挂「平台管理 /admin/demo」。
 * 用途：验证五骨架共享组件 + 平台布局令牌在真实壳内可用；
 * 不作为业务页面，UI-P1 起各域按此契约替换内容。
 */
export default function DemoPage() {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<string>('all');
  const [selectedKeys, setSelectedKeys] = useState<Array<string | number>>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [detail, setDetail] = useState<DemoRow | null>(null);
  const [showEmpty, setShowEmpty] = useState(false);

  const filtered = ROWS.filter(
    (r) =>
      (status === 'all' || r.status === status) &&
      (query.trim() === '' || r.name.toLowerCase().includes(query.trim().toLowerCase())),
  );
  const paged = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const columns: DataTableProProps<DemoRow>['columns'] = [
    { title: '编号', dataIndex: 'id', width: 140, sorter: (a: DemoRow, b: DemoRow) => (a.id > b.id ? 1 : -1) },
    { title: '名称', dataIndex: 'name', width: 260, ellipsis: true },
    { title: '对象域', dataIndex: 'domain', width: 120 },
    {
      title: '状态',
      dataIndex: 'status',
      width: 120,
      filters: [
        { text: '进行中', value: 'running' },
        { text: '已完成', value: 'done' },
        { text: '失败', value: 'failed' },
      ],
      onFilter: (value: unknown, record: DemoRow) => record.status === value,
      render: (_: unknown, record: DemoRow) => {
        const meta = STATUS_META[record.status];
        return (
          <Tag color={meta.color} type="light">
            {meta.label}
          </Tag>
        );
      },
    },
    { title: '负责人', dataIndex: 'owner', width: 180, ellipsis: true },
    { title: '更新时间', dataIndex: 'updatedAt', width: 180 },
  ];

  return (
    <div className="mp-demo">
      <PageHeader
        title="组件演示 · 五骨架"
        desc="UI-P0 交付物：PageHeader / FilterBar / DataTablePro / SheetDetail / EmptyState。仅用平台布局令牌间距。"
        actions={
          <>
            <Button
              icon={<RefreshCw size={15} strokeWidth={1.5} />}
              onClick={() => {
                setSelectedKeys([]);
                setCurrentPage(1);
              }}
            >
              重置
            </Button>
            <Button
              theme="solid"
              type="primary"
              icon={<Plus size={15} strokeWidth={1.5} />}
              onClick={() => Toast.info('演示页不落库：UI-P1 起接入真实 ActionType')}
            >
              新建
            </Button>
          </>
        }
      />

      <Card className="mp-demo-card">
        <FilterBar
          search={{ value: query, onChange: setQuery, placeholder: '搜索实例名称' }}
          filters={
            <Select value={status} onChange={(v) => setStatus(String(v))} placeholder="对象域">
              <Select.Option value="all">全部状态</Select.Option>
              <Select.Option value="running">进行中</Select.Option>
              <Select.Option value="done">已完成</Select.Option>
              <Select.Option value="failed">失败</Select.Option>
            </Select>
          }
          right={
            <Button onClick={() => setShowEmpty((v) => !v)}>
              {showEmpty ? '显示表格' : '显示空状态'}
            </Button>
          }
        />

        {showEmpty ? (
          <EmptyState
            illustration="no-result"
            title="没有匹配的实例"
            desc="调整筛选条件，或新建一个对象实例。"
            actions={
              <Button
                theme="solid"
                type="primary"
                onClick={() => {
                  setQuery('');
                  setStatus('all');
                  setShowEmpty(false);
                }}
              >
                清除筛选
              </Button>
            }
          />
        ) : (
          <DataTablePro<DemoRow>
            columns={columns}
            dataSource={paged}
            rowKey="id"
            rowSelection={{ selectedRowKeys: selectedKeys, onChange: setSelectedKeys }}
            pagination={{
              currentPage,
              pageSize: PAGE_SIZE,
              total: filtered.length,
              onChange: setCurrentPage,
            }}
            onRow={(record) => ({ onClick: () => setDetail(record) })}
          />
        )}
      </Card>

      <Card className="mp-demo-card" title="平台布局令牌（10 档间距）">
        <ul className="mp-demo-tokens">
          {SPACING_TOKENS.map(({ token, className }) => (
            <li key={token} className="mp-demo-token">
              <span className={`mp-demo-swatch ${className}`} />
              <code>{token}</code>
            </li>
          ))}
        </ul>
      </Card>

      <SheetDetail
        title={detail ? `实例详情 · ${detail.id}` : '实例详情'}
        open={detail !== null}
        onClose={() => setDetail(null)}
        footer={
          <>
            <Button onClick={() => setDetail(null)}>关闭</Button>
            <Button theme="solid" type="primary">
              在新标签页打开
            </Button>
          </>
        }
      >
        {detail ? (
          <>
            <Descriptions
              row
              data={[
                { key: '编号', value: detail.id },
                { key: '名称', value: detail.name },
                { key: '对象域', value: detail.domain },
                { key: '状态', value: STATUS_META[detail.status].label },
                { key: '负责人', value: detail.owner },
                { key: '更新时间', value: detail.updatedAt },
              ]}
            />
            <Steps direction="vertical" current={1} size="small">
              <Steps.Step title="创建实例" description="ActionType.apply" />
              <Steps.Step title="校验不变式" description="postflight 通过" />
              <Steps.Step title="写入本体" description="待确认" />
            </Steps>
            <Timeline mode="left">
              <Timeline.Item time="09:12">AI 生成提案</Timeline.Item>
              <Timeline.Item time="09:20">人工确认执行</Timeline.Item>
              <Timeline.Item time="09:21">落库完成</Timeline.Item>
            </Timeline>
          </>
        ) : null}
      </SheetDetail>
    </div>
  );
}
