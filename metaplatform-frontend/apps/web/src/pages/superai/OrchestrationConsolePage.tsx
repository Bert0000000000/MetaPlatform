import { useCallback, useEffect, useState } from 'react';
import { Banner, Button, Card, Col, Input, List, Row, Space, Tag, Toast, Typography } from '@douyinfe/semi-ui';
import { CheckCircle2, PlayCircle, RefreshCw, XCircle, Zap } from 'lucide-react';
import { DataTablePro, EmptyState, PageHeader } from '@/components/skeleton';
import {
  approveEvolution,
  closeSession,
  evolutionStatus,
  mountCapability,
  openSession,
  proposeEvolution,
  submitPlanTemporal,
  reviewStep,
  type EvolutionStatus,
} from '@/api/superai/orchestration';

const SESSION = 'emp-console-1';

interface MountedRow {
  key: string;
  name: string;
  ref: string;
}

/**
 * SuperAI · 编排控制台（Temporal 双轨 · 会话进化）。
 *
 * 数据面沿用 src/api/superai/orchestration：evolutionStatus 读会话快照，
 * open/close/mount/propose 是真实动作，Temporal 双轨提交走 submitPlanTemporal + reviewStep。
 * 运行日志是本次页面操作的本地记录（非后端数据），只记录真实发生的动作与返回。
 */
export default function OrchestrationConsolePage() {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<EvolutionStatus>();
  const [statusError, setStatusError] = useState('');
  const [mountName, setMountName] = useState('');
  const [mountRef, setMountRef] = useState('');
  const [propName, setPropName] = useState('');
  const [busy, setBusy] = useState(false);
  const [runLog, setRunLog] = useState<string[]>([]);

  const log = useCallback((line: string) => {
    setRunLog((prev) => [`${new Date().toLocaleTimeString()}  ${line}`, ...prev].slice(0, 30));
  }, []);

  const refresh = useCallback(async () => {
    setStatusError('');
    try {
      setStatus(await evolutionStatus(SESSION));
      setOpen(true);
    } catch (e) {
      setOpen(false);
      setStatus(undefined);
      setStatusError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const withBusy = async (fn: () => Promise<void>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      Toast.success(ok);
      await refresh();
    } catch (cause) {
      Toast.error(cause instanceof Error ? cause.message : '操作失败');
    } finally {
      setBusy(false);
    }
  };

  const openSess = () =>
    withBusy(async () => {
      await openSession(SESSION);
      log(`会话 ${SESSION} 已打开`);
    }, '会话已打开');

  const closeSess = () =>
    withBusy(async () => {
      await closeSession(SESSION);
      log(`会话 ${SESSION} 已关闭（快照还原）`);
      setOpen(false);
    }, '会话已关闭（快照还原）');

  const mount = () =>
    withBusy(async () => {
      await mountCapability(SESSION, mountName, mountRef);
      log(`挂载能力 ${mountName} → ${mountRef}`);
      setMountName('');
      setMountRef('');
    }, '能力已挂载');

  const propose = () =>
    withBusy(async () => {
      const p = await proposeEvolution(SESSION, propName, `ref:${propName}`, '页面提议');
      const a = await approveEvolution(SESSION, p.proposal_id);
      log(`提案 ${p.proposal_id} → ${a.status}`);
      setPropName('');
    }, '提案已批准并挂载');

  const runTemporal = () =>
    withBusy(async () => {
      const submitted = await submitPlanTemporal([
        { step_id: 's1', kind: 'run_function', target: 'inline', payload: { source: "print('console-e2e')" } },
        { step_id: 's2', kind: 'run_function', target: 'inline', payload: { source: "print('done')" }, requires_hitl: true },
      ]);
      log(`Temporal 提交 ${submitted.plan_id} → ${submitted.status}`);
      const step = submitted.status.startsWith('hitl_waiting')
        ? submitted.status.split(':', 2)[1] || 's2'
        : 's2';
      const reviewed = await reviewStep(submitted.plan_id, step, true);
      log(`审批后 → ${reviewed.status}`);
      if (reviewed.status !== 'completed') throw new Error(`终态 ${reviewed.status}`);
    }, 'Temporal 双轨往返 PASS');

  const mountedRows: MountedRow[] = Object.entries(status?.mounted ?? {}).map(([name, ref]) => ({
    key: name,
    name,
    ref,
  }));

  return (
    <>
      <PageHeader
        title="编排控制台"
        desc="Temporal 双轨编排（ADR-0061）· 会话能力热进化（PRD-01）"
        actions={
          <Button
            icon={<RefreshCw size={15} strokeWidth={1.5} />}
            loading={busy}
            onClick={() => void refresh()}
          >
            刷新
          </Button>
        }
      />

      <div className="mp-exec-col">
        <Card
          title="1. 员工会话进化域"
          headerExtraContent={
            <Space>
              {!open ? (
                <Button onClick={openSess} loading={busy}>
                  打开会话
                </Button>
              ) : (
                <Button type="danger" onClick={closeSess} loading={busy}>
                  关闭会话（还原）
                </Button>
              )}
            </Space>
          }
        >
          {statusError ? (
            <Banner
              type="warning"
              closeIcon={null}
              description={`未能读取会话状态（${statusError}）。可尝试「打开会话」或刷新。`}
            />
          ) : null}
          <div className="mp-exec-col">
            <Space>
              <Typography.Text>
                会话 <Tag type="light" color="blue">{SESSION}</Tag>
              </Typography.Text>
              {open ? (
                <Tag type="light" color="green">
                  OPEN · 快照角色 {status?.snapshot_roles.length ?? 0}
                </Tag>
              ) : (
                <Tag type="light">未打开</Tag>
              )}
            </Space>

            {open ? (
              <>
                <Row gutter={12}>
                  <Col span={9}>
                    <Input value={mountName} onChange={setMountName} placeholder="能力名（如 hot_skill）" />
                  </Col>
                  <Col span={9}>
                    <Input value={mountRef} onChange={setMountRef} placeholder="ref（如 sk_1）" />
                  </Col>
                  <Col span={6}>
                    <Button onClick={mount} disabled={!mountName || busy} loading={busy}>
                      直接挂载
                    </Button>
                  </Col>
                </Row>

                <Row gutter={12}>
                  <Col span={18}>
                    <Input value={propName} onChange={setPropName} placeholder="提案能力名" />
                  </Col>
                  <Col span={6}>
                    <Button
                      type="primary"
                      icon={<Zap size={14} strokeWidth={1.5} />}
                      onClick={propose}
                      disabled={!propName || busy}
                      loading={busy}
                    >
                      提案 + 批准
                    </Button>
                  </Col>
                </Row>

                <DataTablePro<MountedRow>
                  columns={[
                    { title: '已挂载能力', dataIndex: 'name' },
                    { title: 'ref', dataIndex: 'ref' },
                  ]}
                  dataSource={mountedRows}
                  rowKey="key"
                  columnSettings={false}
                  empty={<EmptyState illustration="no-content" title="暂无挂载" desc="挂载能力后会出现在这里。" />}
                />
              </>
            ) : (
              <EmptyState
                illustration="idle"
                title="会话未打开"
                desc="打开会话后才能挂载能力或发起进化提案。"
              />
            )}
          </div>
        </Card>

        <Card
          title="2. Temporal 双轨往返（run_function → HITL → 审批）"
          headerExtraContent={
            <Button
              type="primary"
              icon={<PlayCircle size={14} strokeWidth={1.5} />}
              onClick={runTemporal}
              disabled={busy}
              loading={busy}
            >
              运行 E2E
            </Button>
          }
        >
          <Typography.Text type="tertiary">
            提交 2 步 plan（engine=temporal）→ HITL 挂起 → 审批 → completed
          </Typography.Text>
        </Card>

        <Card title="3. 运行日志">
          {runLog.length === 0 ? (
            <EmptyState illustration="idle" title="暂无记录" desc="执行上面的动作后会在这里留下操作记录。" />
          ) : (
            <List
              dataSource={runLog}
              renderItem={(line) => (
                <List.Item
                  main={
                    <Typography.Text type={line.includes('PASS') ? 'success' : 'secondary'}>
                      {line}
                    </Typography.Text>
                  }
                />
              )}
            />
          )}
        </Card>

        <Card title="说明">
          <Typography.Paragraph type="tertiary">
            本页对接 Sprint 1A（ADR-0061 双轨编排）与 PRD-01（会话能力热进化 + 提案闸）REST。
            后端端点：/api/v1/orchestrator/plans?engine=temporal · /sessions/&#123;id&#125;/open|capabilities|evolve-proposals|close|sweep。
          </Typography.Paragraph>
          <span className="mp-exec-chips">
            <Tag type="light" color="green">
              <CheckCircle2 size={12} strokeWidth={1.5} /> completed
            </Tag>
            <Tag type="light" color="red">
              <XCircle size={12} strokeWidth={1.5} /> aborted
            </Tag>
          </span>
        </Card>
      </div>
    </>
  );
}
