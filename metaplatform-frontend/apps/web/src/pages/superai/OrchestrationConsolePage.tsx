import { useCallback, useEffect, useState } from 'react';
import { Button, Card, Input, Space, Table, Tag, Toast, Typography } from '@douyinfe/semi-ui';
import { CheckCircle2, RefreshCw, XCircle, Zap } from 'lucide-react';
import { PageRoot } from '@mate/shared';
import {
  approveEvolution,
  closeSession,
  evolutionStatus,
  mountCapability,
  openSession,
  proposeEvolution,
  rejectEvolution,
  submitPlanTemporal,
  reviewStep,
  type EvolutionStatus,
} from '@/api/superai/orchestration';

const SESSION = 'emp-console-1';

export default function OrchestrationConsolePage() {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<EvolutionStatus>();
  const [mountName, setMountName] = useState('');
  const [mountRef, setMountRef] = useState('');
  const [propName, setPropName] = useState('');
  const [busy, setBusy] = useState(false);
  const [runLog, setRunLog] = useState<string[]>([]);

  const log = (line: string) => setRunLog((prev) => [`${new Date().toLocaleTimeString()}  ${line}`, ...prev].slice(0, 30));

  const refresh = useCallback(async () => {
    try {
      setStatus(await evolutionStatus(SESSION));
      setOpen(true);
    } catch {
      setOpen(false);
      setStatus(undefined);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const withBusy = async (fn: () => Promise<void>, ok: string) => {
    setBusy(true);
    try { await fn(); Toast.success(ok); await refresh(); }
    catch (cause) { Toast.error(cause instanceof Error ? cause.message : '操作失败'); }
    finally { setBusy(false); }
  };

  const openSess = () => withBusy(async () => {
    await openSession(SESSION);
    await refresh();
  }, '会话已打开');

  const closeSess = () => withBusy(async () => {
    await closeSession(SESSION);
    setOpen(false);
  }, '会话已关闭（快照还原）');

  const mount = () => withBusy(async () => {
    await mountCapability(SESSION, mountName, mountRef);
    setMountName(''); setMountRef('');
  }, '能力已挂载');

  const propose = () => withBusy(async () => {
    const p = await proposeEvolution(SESSION, propName, `ref:${propName}`, '页面提议');
    // 提案闸：演示页直接批准（生产走审批中心）
    const a = await approveEvolution(SESSION, p.proposal_id);
    log(`提案 ${p.proposal_id} → ${a.status}`);
    setPropName('');
  }, '提案已批准并挂载');

  const runTemporal = () => withBusy(async () => {
    const submitted = await submitPlanTemporal([
      { step_id: 's1', kind: 'run_function', target: 'inline',
        payload: { source: "print('console-e2e')" } },
      { step_id: 's2', kind: 'run_function', target: 'inline',
        payload: { source: "print('done')" }, requires_hitl: true },
    ]);
    log(`Temporal 提交 ${submitted.plan_id} → ${submitted.status}`);
    const step = submitted.status.startsWith('hitl_waiting')
      ? submitted.status.split(':', 1)[1] || 's2' : 's2';
    const reviewed = await reviewStep(submitted.plan_id, step, true);
    log(`审批后 → ${reviewed.status}`);
    if (reviewed.status !== 'completed') throw new Error(`终态 ${reviewed.status}`);
  }, 'Temporal 双轨往返 PASS');

  const mountedKeys = Object.keys(status?.mounted ?? {});
  const proposals = runLog.filter((l) => l.includes('提案'));

  return (
    <PageRoot>
      <Space vertical style={{ width: '100%' }} spacing={12}>
        <Typography.Title heading={4}>编排控制台（Temporal 双轨 · 会话进化）</Typography.Title>
        <Card title="1. 员工会话进化域" headerExtraContent={
          <Space>
            {!open
              ? <Button onClick={openSess} loading={busy}>打开会话</Button>
              : <Button type="danger" onClick={closeSess} loading={busy}>关闭会话（还原）</Button>}
            <Button icon={<RefreshCw size={14} />} onClick={() => void refresh()}>刷新</Button>
          </Space>
        }>
          <Typography.Text>会话 <Tag color="blue">{SESSION}</Tag>
            {open ? <Tag color="green">OPEN · 快照角色 {status?.snapshot_roles.length ?? 0}</Tag>
                  : <Tag color="grey">未打开</Tag>}
          </Typography.Text>
          {open && (
            <Space vertical style={{ width: '100%', marginTop: 12 }} spacing={8}>
              <Space>
                <Input value={mountName} onChange={setMountName} placeholder="能力名（如 hot_skill）" style={{ width: 200 }} />
                <Input value={mountRef} onChange={setMountRef} placeholder="ref（如 sk_1）" style={{ width: 160 }} />
                <Button onClick={mount} disabled={!mountName || busy}>直接挂载</Button>
              </Space>
              <Space>
                <Input value={propName} onChange={setPropName} placeholder="提案能力名" style={{ width: 200 }} />
                <Button type="primary" icon={<Zap size={14} />} onClick={propose} disabled={!propName || busy}>
                  提案 + 批准（演示）
                </Button>
              </Space>
              <Table
                size="small"
                dataSource={mountedKeys.map((k) => ({ key: k, name: k, ref: status!.mounted[k] }))}
                columns={[
                  { title: '已挂载能力', dataIndex: 'name' },
                  { title: 'ref', dataIndex: 'ref' },
                ]}
                empty="暂无挂载"
                pagination={false}
              />
            </Space>
          )}
        </Card>

        <Card title="2. Temporal 双轨往返（run_function → HITL → 审批）"
              headerExtraContent={<Button type="primary" onClick={runTemporal} disabled={busy}>运行 E2E</Button>}>
          <Typography.Text type="tertiary">
            提交 2 步 plan（engine=temporal）→ HITL 挂起 → 审批 → completed
          </Typography.Text>
        </Card>

        <Card title="3. 运行日志">
          {proposals.length === 0 && runLog.length === 0
            ? <Typography.Text type="tertiary">暂无记录</Typography.Text>
            : <Space vertical spacing={2} style={{ width: '100%' }}>
                {runLog.map((l, i) => (
                  <Typography.Text key={i} type={l.includes('PASS') ? 'success' : 'secondary'}
                    icon={l.includes('PASS') ? <CheckCircle2 size={12} /> : undefined}>
                    {l}
                  </Typography.Text>
                ))}
              </Space>}
        </Card>

        <Card title="说明">
          <Typography.Paragraph type="tertiary" style={{ marginBottom: 0 }}>
            本页对接 Sprint 1A（ADR-0061 双轨编排）与 PRD-01（会话能力热进化 + 提案闸）REST。
            后端端点：/api/v1/orchestrator/plans?engine=temporal · /sessions/&#123;id&#125;/open|capabilities|evolve-proposals|close|sweep。
          </Typography.Paragraph>
          <Space style={{ marginTop: 8 }}>
            <Tag color="green"><CheckCircle2 size={12} /> completed</Tag>
            <Tag color="red"><XCircle size={12} /> aborted</Tag>
          </Space>
        </Card>
      </Space>
    </PageRoot>
  );
}
