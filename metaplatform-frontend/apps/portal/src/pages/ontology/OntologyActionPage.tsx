import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  TestTube, Plus, Search, Calculator, Bell, GitBranch, Plug, Webhook,
  Copy, Trash2, Save,
} from 'lucide-react';
import { SubTabs } from '@mate/shared';

const ONTOLOGY_TABS = [
  { label: '本体论管理', path: '/ontology' },
  { label: '数据中心', path: '/ontology/datacenter' },
  { label: 'Action 编排', path: '/ontology/action' },
  { label: '知识图谱', path: '/ontology/graph' },
];

// MOCK: Action 列表
const ACTIONS = [
  { id: 'act-1', name: '客户信息查询', type: '查询', icon: Search, enabled: true },
  { id: 'act-2', name: '风险评估计算', type: '计算', icon: Calculator, enabled: true },
  { id: 'act-3', name: '发送审批通知', type: '通知', icon: Bell, enabled: true },
  { id: 'act-4', name: '合同审批流程', type: '审批', icon: GitBranch, enabled: true },
  { id: 'act-5', name: 'ERP 数据同步', type: '数据同步', icon: Plug, enabled: true },
  { id: 'act-6', name: 'Webhook 外部集成', type: '集成', icon: Webhook, enabled: false },
];

// MOCK: 输入参数
const INPUT_PARAMS = [
  { name: 'recipient_id', type: 'String', required: true, desc: '接收人 ID' },
  { name: 'approval_data', type: 'Object', required: true, desc: '审批数据体' },
  { name: 'channel', type: 'Enum', required: false, desc: '通知渠道 (im/email/sms)' },
  { name: 'priority', type: 'Integer', required: false, desc: '优先级 1-5，默认 3' },
];

// MOCK: 执行历史
const EXEC_HISTORY = [
  { trigger: '系统', time: '14:32:08', input: 'recipient: 张三, channel: im', output: 'msg_id: msg_29f3a', duration: '72ms', status: 'success' },
  { trigger: '审批流', time: '14:28:15', input: 'recipient: 李四, channel: email', output: 'msg_id: msg_18c2b', duration: '95ms', status: 'success' },
  { trigger: '数字员工', time: '14:15:42', input: 'recipient: 王五, channel: sms', output: 'msg_id: msg_07d1a', duration: '118ms', status: 'success' },
  { trigger: '定时任务', time: '13:50:00', input: 'recipient: 赵六, channel: im', output: 'msg_id: msg_44e9c', duration: '63ms', status: 'success' },
  { trigger: 'API 调用', time: '13:22:31', input: 'recipient: 孙七', output: 'error: timeout', duration: '3000ms', status: 'error' },
];

// MOCK: 关联本体概念
const RELATED_CONCEPTS = ['审批流程', '通知事件', '组织人员'];

// MOCK: 关联触发器
const RELATED_TRIGGERS = ['审批流程 - 提交节点', '审批流程 - 催办节点'];

export default function OntologyActionPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [selectedAction, setSelectedAction] = useState(2); // 发送审批通知 selected

  const codeStyle: React.CSSProperties = {
    fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--foreground)',
    background: 'var(--muted)', padding: '2px 6px', borderRadius: 3,
  };

  return (
    <div>
      <SubTabs items={ONTOLOGY_TABS} activePath={location.pathname} />

      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em' }}>Action 编排</h1>
          <div style={{ fontSize: 13, color: 'var(--muted-foreground)', marginTop: 4 }}>定义和编排业务动作</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="v-btn"><TestTube style={{ width: 16, height: 16 }} />测试运行</button>
          <button className="v-btn-primary"><Plus style={{ width: 16, height: 16 }} />新建 Action</button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
        <div style={{ flex: 1, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '16px 20px' }}>
          <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.2 }}>45</div>
          <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginTop: 4 }}>Action 总数</div>
        </div>
        <div style={{ flex: 1, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '16px 20px' }}>
          <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.2 }}>38</div>
          <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginTop: 4 }}>已启用</div>
          <div style={{ fontSize: 11, color: 'var(--success)', marginTop: 4 }}>84.4%</div>
        </div>
        <div style={{ flex: 1, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '16px 20px' }}>
          <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.2 }}>1,234</div>
          <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginTop: 4 }}>今日执行</div>
          <div style={{ fontSize: 11, color: 'var(--success)', marginTop: 4 }}>+12.3% 较昨日</div>
        </div>
        <div style={{ flex: 1, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '16px 20px' }}>
          <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.2 }}>86<span style={{ fontSize: 14, fontWeight: 400, color: 'var(--muted-foreground)' }}>ms</span></div>
          <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginTop: 4 }}>平均耗时</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 24 }}>
        {/* Left: Action list */}
        <div style={{ width: 240, flexShrink: 0 }}>
          <div className="v-card" style={{ height: 'fit-content', maxHeight: 'calc(100vh - 340px)', overflowY: 'auto' }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Actions</h3>
            {ACTIONS.map((a, i) => (
              <div
                key={a.id}
                onClick={() => setSelectedAction(i)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                  borderRadius: 4, cursor: 'pointer', fontSize: 13,
                  color: i === selectedAction ? 'var(--foreground)' : 'var(--muted-foreground)',
                  background: i === selectedAction ? 'var(--muted)' : 'transparent',
                  marginBottom: 2, transition: 'background .15s',
                }}
              >
                <a.icon style={{ width: 16, height: 16, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.name}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                    <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: 'var(--background)', color: 'var(--muted-foreground)' }}>{a.type}</span>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, background: a.enabled ? 'var(--success)' : 'var(--muted-foreground)' }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Detail */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="v-card" style={{ marginBottom: 20 }}>
            {/* Section header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600 }}>{ACTIONS[selectedAction].name}</h3>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="v-btn" style={{ height: 32, padding: '0 12px', fontSize: 12 }}><Copy style={{ width: 14, height: 14 }} />复制</button>
                <button className="v-btn" style={{ height: 32, padding: '0 12px', fontSize: 12 }}><Trash2 style={{ width: 14, height: 14 }} />删除</button>
                <button className="v-btn-primary" style={{ height: 32, padding: '0 12px', fontSize: 12 }}><Save style={{ width: 14, height: 14 }} />保存</button>
              </div>
            </div>

            {/* Basic info */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)', marginBottom: 12 }}>基本信息</div>
              <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: '12px 16px', alignItems: 'start' }}>
                <div style={{ fontSize: 12, color: 'var(--muted-foreground)', paddingTop: 3 }}>名称</div>
                <div style={{ fontSize: 13, color: 'var(--foreground)' }}>发送审批通知</div>
                <div style={{ fontSize: 12, color: 'var(--muted-foreground)', paddingTop: 3 }}>标识符</div>
                <div style={{ fontSize: 13, color: 'var(--foreground)' }}><code style={codeStyle}>action.approval.notify</code></div>
                <div style={{ fontSize: 12, color: 'var(--muted-foreground)', paddingTop: 3 }}>类型</div>
                <div style={{ fontSize: 13, color: 'var(--foreground)' }}><span className="v-badge v-badge-neutral">通知</span></div>
                <div style={{ fontSize: 12, color: 'var(--muted-foreground)', paddingTop: 3 }}>状态</div>
                <div style={{ fontSize: 13, color: 'var(--foreground)' }}><span className="v-badge v-badge-success">已启用</span></div>
              </div>
            </div>

            {/* Input params */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)', marginBottom: 12 }}>输入参数</div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: 12, fontWeight: 500, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border)', background: 'var(--muted)' }}>参数名</th>
                    <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: 12, fontWeight: 500, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border)', background: 'var(--muted)' }}>类型</th>
                    <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: 12, fontWeight: 500, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border)', background: 'var(--muted)' }}>必填</th>
                    <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: 12, fontWeight: 500, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border)', background: 'var(--muted)' }}>说明</th>
                  </tr>
                </thead>
                <tbody>
                  {INPUT_PARAMS.map((p) => (
                    <tr key={p.name}>
                      <td style={{ padding: '8px 12px', fontSize: 13, borderBottom: '1px solid var(--border)' }}><code style={codeStyle}>{p.name}</code></td>
                      <td style={{ padding: '8px 12px', color: 'var(--muted-foreground)', fontSize: 12, borderBottom: '1px solid var(--border)' }}>{p.type}</td>
                      <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)' }}><span style={{ color: p.required ? 'var(--destructive)' : 'var(--muted-foreground)', fontSize: 12 }}>{p.required ? '是' : '否'}</span></td>
                      <td style={{ padding: '8px 12px', color: 'var(--muted-foreground)', fontSize: 12, borderBottom: '1px solid var(--border)' }}>{p.desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Output definition */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)', marginBottom: 12 }}>输出定义</div>
              <div style={{ background: 'var(--muted)', borderRadius: 'var(--radius)', padding: '12px 16px', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--muted-foreground)', lineHeight: 1.8 }}>
                {'{'}<br />
                &nbsp;&nbsp;"success": "boolean",<br />
                &nbsp;&nbsp;"message_id": "string",<br />
                &nbsp;&nbsp;"sent_at": "datetime",<br />
                &nbsp;&nbsp;"channel": "string"<br />
                {'}'}
              </div>
            </div>

            {/* Related ontology concepts */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)', marginBottom: 12 }}>关联本体概念</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {RELATED_CONCEPTS.map((c) => (
                  <span key={c} style={{ padding: '4px 10px', background: 'var(--muted)', border: '1px solid var(--border)', borderRadius: 4, fontSize: 12, color: 'var(--foreground)', cursor: 'pointer' }}>{c}</span>
                ))}
              </div>
            </div>

            {/* Related triggers */}
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)', marginBottom: 12 }}>关联触发器</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {RELATED_TRIGGERS.map((t) => (
                  <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: 'var(--muted)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 12, color: 'var(--foreground)' }}>
                    <GitBranch style={{ width: 14, height: 14, color: 'var(--muted-foreground)' }} />{t}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Execution history */}
          <div className="v-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600 }}>执行历史</h3>
              <button className="v-btn" style={{ height: 28, padding: '0 10px', fontSize: 11 }}>查看全部</button>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['触发者', '时间', '输入摘要', '输出摘要', '耗时', '状态'].map((h) => (
                    <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontSize: 11, fontWeight: 500, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border)', background: 'var(--muted)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {EXEC_HISTORY.map((r, i) => (
                  <tr key={i}>
                    <td style={{ padding: '8px 12px', fontSize: 12, color: 'var(--foreground)', fontWeight: 500, borderBottom: '1px solid var(--border)' }}>{r.trigger}</td>
                    <td style={{ padding: '8px 12px', fontSize: 12, color: 'var(--muted-foreground)', borderBottom: '1px solid var(--border)' }}>{r.time}</td>
                    <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)' }}><code style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted-foreground)', background: 'var(--background)', padding: '1px 6px', borderRadius: 3 }}>{r.input}</code></td>
                    <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)' }}><code style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted-foreground)', background: 'var(--background)', padding: '1px 6px', borderRadius: 3 }}>{r.output}</code></td>
                    <td style={{ padding: '8px 12px', fontSize: 12, color: 'var(--foreground)', borderBottom: '1px solid var(--border)' }}>{r.duration}</td>
                    <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)' }}>
                      <span style={{ fontSize: 11, padding: '1px 6px', borderRadius: 9999, background: r.status === 'success' ? 'rgba(98,209,120,0.12)' : 'rgba(255,97,102,0.15)', color: r.status === 'success' ? 'var(--success)' : 'var(--destructive)' }}>
                        {r.status === 'success' ? '成功' : '失败'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
