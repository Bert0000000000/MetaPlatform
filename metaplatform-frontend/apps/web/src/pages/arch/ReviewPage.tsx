import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Descriptions, Form, Select, Tag, Timeline, Toast, Typography } from '@douyinfe/semi-ui';
import { Check, MessageSquare, Play, Plus, RefreshCw, X } from 'lucide-react';
import type { TagColor } from '@douyinfe/semi-ui/lib/es/tag';
import {
  addReviewTicketComment,
  approveReviewTicket,
  createReviewTicket,
  listReviewTemplates,
  listReviewTickets,
  rejectReviewTicket,
  startReviewTicket,
} from '@/api/arch/governance';
import type { ReviewTicket, ReviewTemplate, ReviewScoreItem } from '@/api/arch/types';
import { DataTablePro, EmptyState, FilterBar, PageHeader, SheetDetail } from '@/components/skeleton';

const PAGE_SIZE = 10;

const STATUS_TAG: Record<string, { color: TagColor; label: string }> = {
  CREATED: { color: 'grey', label: '已创建' },
  REVIEWING: { color: 'orange', label: '评审中' },
  APPROVED: { color: 'green', label: '已通过' },
  REJECTED: { color: 'red', label: '已驳回' },
};

type ActionType = 'approve' | 'reject' | 'comment';

/**
 * 治理 · 架构评审（/governance/review-tickets）。
 * 列表承载评审工单；详情/评分/评审记录与通过、驳回、评论动作都在右侧非模态浮层完成。
 */
export default function ReviewPage() {
  const [tickets, setTickets] = useState<ReviewTicket[]>([]);
  const [templates, setTemplates] = useState<ReviewTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState<string | undefined>(undefined);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const handlePageSizeChange = useCallback((next: number) => {
    setPageSize(next);
    setPage(1);
  }, []);

  const [createOpen, setCreateOpen] = useState(false);
  const [detail, setDetail] = useState<ReviewTicket | null>(null);
  const [actionType, setActionType] = useState<ActionType>('comment');
  const [actionOpen, setActionOpen] = useState(false);
  const [acting, setActing] = useState(false);
  const [ticketForm] = Form.useForm<Partial<ReviewTicket>>();
  const [actionForm] = Form.useForm<{
    reviewer: string;
    comment: string;
    decision: string;
    scores: string;
  }>();

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [t, tpl] = await Promise.all([listReviewTickets(status), listReviewTemplates()]);
      setTickets(t ?? []);
      setTemplates(tpl ?? []);
    } catch (e) {
      setTickets([]);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [keyword, status]);

  const filtered = useMemo(
    () =>
      tickets.filter((t) =>
        keyword
          ? `${t.title} ${t.applicant ?? ''} ${t.reviewer ?? ''}`.toLowerCase().includes(keyword.toLowerCase())
          : true,
      ),
    [tickets, keyword],
  );

  const paged = useMemo(() => filtered.slice((page - 1) * pageSize, page * pageSize), [filtered, page, pageSize]);

  const openCreate = () => {
    ticketForm.reset();
    setCreateOpen(true);
  };

  const submitCreate = async () => {
    setActing(true);
    try {
      const values = await ticketForm.validate();
      await createReviewTicket(values);
      Toast.success('已提交评审');
      setCreateOpen(false);
      ticketForm.reset();
      await load();
    } catch (e) {
      Toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setActing(false);
    }
  };

  const handleStart = async (ticket: ReviewTicket) => {
    try {
      await startReviewTicket(ticket.id, ticket.reviewer || 'system');
      Toast.success('评审已启动');
      await load();
    } catch (e) {
      Toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  const openAction = (ticket: ReviewTicket, type: ActionType) => {
    setDetail(ticket);
    setActionType(type);
    actionForm.reset();
    setActionOpen(true);
  };

  const parseScores = (text: string, template: ReviewTemplate | undefined): ReviewScoreItem[] => {
    const lines = text
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    const dimensions = template?.dimensions || [];
    return lines.map((line, index) => {
      const [dimPart, scorePart] = line.split(':');
      const dimension = dimPart?.trim() || dimensions[index]?.name || line;
      const score = scorePart ? Number.parseInt(scorePart.trim(), 10) : undefined;
      return { dimension, score };
    });
  };

  const submitAction = async () => {
    if (!detail) return;
    setActing(true);
    try {
      const values = await actionForm.validate();
      const template = templates.find((t) => t.id === detail.templateId);
      const scores = parseScores(values.scores || '', template);
      if (actionType === 'comment') {
        await addReviewTicketComment(detail.id, values.reviewer, values.comment);
        Toast.success('评论已添加');
      } else if (actionType === 'approve') {
        await approveReviewTicket(detail.id, values.reviewer, scores, values.comment, values.decision);
        Toast.success('已通过');
      } else {
        await rejectReviewTicket(detail.id, values.reviewer, scores, values.comment, values.decision);
        Toast.success('已驳回');
      }
      setActionOpen(false);
      setDetail(null);
      actionForm.reset();
      await load();
    } catch (e) {
      Toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setActing(false);
    }
  };

  const columns = [
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      width: 260,
      ellipsis: true,
      render: (v: string, row: ReviewTicket) => (
        <Typography.Text link onClick={() => setDetail(row)}>
          {v}
        </Typography.Text>
      ),
    },
    {
      title: '模板',
      dataIndex: 'templateName',
      key: 'templateName',
      width: 160,
      ellipsis: true,
      render: (v?: string) => v || '—',
    },
    {
      title: '申请人',
      dataIndex: 'applicant',
      key: 'applicant',
      width: 120,
      render: (v?: string) => v || '—',
    },
    {
      title: '评审人',
      dataIndex: 'reviewer',
      key: 'reviewer',
      width: 120,
      render: (v?: string) => v || '—',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: (s: string) => (
        <Tag color={STATUS_TAG[s]?.color ?? 'grey'} type="light">
          {STATUS_TAG[s]?.label ?? s}
        </Tag>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (v?: string) => (v ? new Date(v).toLocaleString('zh-CN') : '—'),
    },
    {
      title: '',
      dataIndex: '__actions__',
      key: '__actions__',
      width: 230,
      render: (_: unknown, row: ReviewTicket) => (
        <>
          {row.status === 'CREATED' ? (
            <Button
              theme="borderless"
              type="primary"
              size="small"
              icon={<Play size={14} strokeWidth={1.5} />}
              onClick={() => void handleStart(row)}
            >
              启动
            </Button>
          ) : null}
          {row.status === 'REVIEWING' ? (
            <>
              <Button
                theme="borderless"
                type="primary"
                size="small"
                icon={<MessageSquare size={14} strokeWidth={1.5} />}
                onClick={() => openAction(row, 'comment')}
              >
                评论
              </Button>
              <Button
                theme="borderless"
                type="primary"
                size="small"
                icon={<Check size={14} strokeWidth={1.5} />}
                onClick={() => openAction(row, 'approve')}
              >
                通过
              </Button>
              <Button
                theme="borderless"
                type="danger"
                size="small"
                icon={<X size={14} strokeWidth={1.5} />}
                onClick={() => openAction(row, 'reject')}
              >
                驳回
              </Button>
            </>
          ) : null}
        </>
      ),
    },
  ];

  const scoreColumns = [
    { title: '维度', dataIndex: 'dimension', key: 'dimension', width: 200, ellipsis: true },
    {
      title: '得分',
      dataIndex: 'score',
      key: 'score',
      width: 90,
      render: (v?: number) => (v === undefined || v === null ? '—' : v),
    },
  ];

  return (
    <>
      <PageHeader
        title="架构评审"
        desc={`${tickets.length} 张工单 · 提案经评审通过后方可落地`}
        actions={
          <>
            <Button icon={<RefreshCw size={15} strokeWidth={1.5} />} loading={loading} onClick={() => void load()}>
              刷新
            </Button>
            <Button theme="solid" type="primary" icon={<Plus size={15} strokeWidth={1.5} />} onClick={openCreate}>
              提交评审
            </Button>
          </>
        }
      />

      <FilterBar
        search={{ value: keyword, onChange: setKeyword, placeholder: '搜索标题、申请人、评审人…' }}
        filters={
          <Select value={status ?? ''} onChange={(v) => setStatus(v ? String(v) : undefined)} placeholder="全部状态">
            <Select.Option value="">全部状态</Select.Option>
            {(Object.keys(STATUS_TAG) as string[]).map((s) => (
              <Select.Option key={s} value={s}>
                {STATUS_TAG[s].label}
              </Select.Option>
            ))}
          </Select>
        }
      />

      <DataTablePro<ReviewTicket>
        columns={columns}
        dataSource={paged}
        rowKey="id"
        loading={loading}
        pagination={{
          currentPage: page,
          pageSize,
          total: filtered.length,
          onChange: setPage,
          onPageSizeChange: handlePageSizeChange,
        }}
        empty={
          error ? (
            <EmptyState illustration="failure" title="评审工单加载失败" desc={error} />
          ) : (
            <EmptyState
              illustration="no-content"
              title="暂无评审工单"
              desc="提交架构提案，指定模板与评审人。"
              actions={
                <Button theme="solid" type="primary" onClick={openCreate}>
                  提交评审
                </Button>
              }
            />
          )
        }
      />

      <SheetDetail
        title={detail ? `评审详情 · ${detail.title}` : '评审详情'}
        open={detail !== null && !actionOpen}
        onClose={() => setDetail(null)}
        footer={<Button onClick={() => setDetail(null)}>关闭</Button>}
      >
        {detail ? (
          <div>
            <Descriptions
              row
              data={[
                { key: '标题', value: detail.title },
                { key: '模板', value: detail.templateName || '—' },
                { key: '申请人', value: detail.applicant || '—' },
                { key: '评审人', value: detail.reviewer || '—' },
                { key: '状态', value: STATUS_TAG[detail.status]?.label ?? detail.status },
                { key: '决议', value: detail.decision || '—' },
              ]}
            />

            <div>
              <Typography.Text strong>评分</Typography.Text>
              <DataTablePro<ReviewScoreItem>
                columns={scoreColumns}
                dataSource={detail.scores ?? []}
                rowKey="dimension"
                columnSettings={false}
                empty={<EmptyState illustration="no-content" title="暂无评分" />}
              />
            </div>

            <div>
              <Typography.Text strong>评审记录</Typography.Text>
              {(detail.comments ?? []).length === 0 ? (
                <EmptyState illustration="no-content" title="暂无评审记录" />
              ) : (
                <Timeline
                  dataSource={(detail.comments ?? []).map((c) => ({
                    color: c.action === 'APPROVE' ? 'green' : c.action === 'REJECT' ? 'red' : 'grey',
                    content: (
                      <div>
                        <Typography.Text strong>{c.author || '匿名'}</Typography.Text>{' '}
                        <Tag type="light">{c.action}</Tag>
                        <Typography.Paragraph>{c.content}</Typography.Paragraph>
                        <Typography.Text type="tertiary">{new Date(c.createdAt).toLocaleString('zh-CN')}</Typography.Text>
                      </div>
                    ),
                  }))}
                />
              )}
            </div>
          </div>
        ) : null}
      </SheetDetail>

      <SheetDetail
        title="提交评审"
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        footer={
          <>
            <Button onClick={() => setCreateOpen(false)}>取消</Button>
            <Button theme="solid" type="primary" loading={acting} onClick={() => void submitCreate()}>
              提交
            </Button>
          </>
        }
      >
        <Form form={ticketForm} labelPosition="left" labelWidth={92}>
          <Form.Input field="title" label="标题" rules={[{ required: true, message: '请输入标题' }]} placeholder="新增订单服务提案" />
          <Form.Select
            field="templateId"
            label="评审模板"
            showClear
            placeholder="选择模板"
            optionList={templates.map((t) => ({ value: t.id, label: t.name }))}
          />
          <Form.Input field="targetType" label="对象类型" placeholder="APPLICATION / TECH_STACK" />
          <Form.Input field="targetId" label="对象 ID" placeholder="选填" />
          <Form.Input field="applicant" label="申请人" placeholder="选填" />
          <Form.Input field="reviewer" label="指定评审人" placeholder="选填" />
        </Form>
      </SheetDetail>

      <SheetDetail
        title={actionType === 'approve' ? '通过评审' : actionType === 'reject' ? '驳回评审' : '添加评论'}
        open={actionOpen}
        onClose={() => {
          setActionOpen(false);
          actionForm.reset();
        }}
        footer={
          <>
            <Button
              onClick={() => {
                setActionOpen(false);
                actionForm.reset();
              }}
            >
              取消
            </Button>
            <Button theme="solid" type="primary" loading={acting} onClick={() => void submitAction()}>
              确认
            </Button>
          </>
        }
      >
        <Form form={actionForm} labelPosition="left" labelWidth={92}>
          <Form.Input
            field="reviewer"
            label="评审人"
            rules={[{ required: true, message: '请输入评审人' }]}
            initValue={detail?.reviewer || ''}
          />
          {actionType !== 'comment' ? (
            <Form.TextArea field="scores" label="评分" rows={3} placeholder={'每行：维度:得分\n可扩展性:90\n安全性:85'} />
          ) : null}
          {actionType !== 'comment' ? <Form.Input field="decision" label="决议" placeholder="通过 / 有条件通过" /> : null}
          <Form.TextArea
            field="comment"
            label={actionType === 'comment' ? '评论' : '评审意见'}
            rules={[{ required: true, message: '请输入内容' }]}
            rows={3}
          />
        </Form>
      </SheetDetail>
    </>
  );
}
