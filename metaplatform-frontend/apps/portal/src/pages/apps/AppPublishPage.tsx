import { useNavigate } from 'react-router-dom';
import {
  History, Rocket, Check, ClipboardCheck, AlertTriangle,
  CheckCircle, XCircle, Filter, Download, Server, RotateCcw,
} from 'lucide-react';
import AppHeader from '@/components/AppHeader';
import { useAppTabs } from '@/store/appTabs';

const APP_SUB_TABS = [
  { label: '应用详情', path: '/apps/detail' },
  { label: '数据建模', path: '/apps/modeling' },
  { label: '表单设计器', path: '/apps/formdesigner' },
  { label: '流程设计器', path: '/apps/processdesigner' },
  { label: '应用配置', path: '/apps/config' },
  { label: '发布管理', path: '/apps/publish' },
  { label: '版本管理', path: '/apps/version' },
];

// MOCK: 检查清单数据
const CHECKLIST = [
  { name: '代码审查通过', detail: '3 位 Reviewer Approve，12 个 Comment 已解决', status: 'pass' },
  { name: '单元测试通过', detail: 'JUnit 5 全部 284 个用例通过，覆盖率 82%', status: 'pass' },
  { name: '集成测试通过', detail: 'Testcontainers 18 个集成场景全部通过', status: 'pass' },
  { name: '性能测试通过', detail: 'P99 延迟 218ms，吞吐量 1.4K QPS，满足基线', status: 'pass' },
  { name: '安全扫描未通过', detail: '发现 1 个中危 CVE（CVE-2026-3142），依赖 jackson-databind 升级待处理', status: 'fail' },
  { name: '数据迁移就绪', detail: 'Flyway 3 个 migration 脚本已验证，回滚脚本已准备', status: 'pass' },
  { name: '配置检查通过', detail: 'Nacos Config 32 项配置校验通过，无遗漏', status: 'pass' },
  { name: '审批流程未完成', detail: '技术负责人已审批，等待运维负责人确认（预计今日 18:00）', status: 'fail' },
];

// MOCK: 发布记录数据
const RELEASES = [
  { version: 'v2.2.0-rc.1', env: 'Staging', time: '2026-07-22 10:15', operator: '张伟', status: '进行中', statusVariant: 'v-badge-info', duration: '--', note: '预发布部署验证' },
  { version: 'v2.1.3', env: 'Production', time: '2026-07-20 14:30', operator: 'Admin', status: '成功', statusVariant: 'v-badge-success', duration: '4m 12s', note: '修复订单状态同步延迟' },
  { version: 'v2.1.3-rc.2', env: 'Staging', time: '2026-07-19 16:45', operator: '李明', status: '成功', statusVariant: 'v-badge-success', duration: '3m 38s', note: '修复后二次验证通过' },
  { version: 'v2.1.3-rc.1', env: 'Staging', time: '2026-07-18 11:20', operator: '张伟', status: '失败', statusVariant: 'v-badge-destructive', duration: '1m 05s', note: '数据库连接超时导致部署中断' },
  { version: 'v2.1.2', env: 'Production', time: '2026-07-10 09:00', operator: 'Admin', status: '已回滚', statusVariant: 'v-badge-warning', duration: '5m 30s', note: '订单查询接口异常，已回滚' },
  { version: 'v2.1.2-rc.3', env: 'Staging', time: '2026-07-09 15:30', operator: '王芳', status: '成功', statusVariant: 'v-badge-success', duration: '3m 22s', note: '审批流程优化最终版' },
  { version: 'v2.1.1', env: 'Production', time: '2026-06-28 16:00', operator: 'Admin', status: '成功', statusVariant: 'v-badge-success', duration: '4m 48s', note: '新增批量导出功能' },
  { version: 'v2.1.1-rc.1', env: 'Staging', time: '2026-06-25 10:10', operator: '张伟', status: '成功', statusVariant: 'v-badge-success', duration: '2m 56s', note: '批量导出首次验证' },
  { version: 'v2.1.0', env: 'Production', time: '2026-06-15 10:30', operator: 'Admin', status: '成功', statusVariant: 'v-badge-success', duration: '6m 15s', note: 'v2.1.0 正式版发布' },
  { version: 'v2.0.1', env: 'Production', time: '2026-06-02 14:00', operator: 'Admin', status: '成功', statusVariant: 'v-badge-success', duration: '3m 50s', note: '紧急修复支付回调异常' },
];

// MOCK: 回滚历史数据
const ROLLBACK_HISTORY = [
  { version: 'v2.1.2', time: '2026-07-10 09:05:30', reason: '订单查询接口 P99 延迟飙升至 8.2s，健康检查连续 3 次超时，触发自动回滚', operator: '系统', type: '自动', typeVariant: 'v-badge-success' },
  { version: 'v2.0.0', time: '2026-06-01 11:42:15', reason: '数据模型兼容性问题导致订单创建失败率 12%', operator: 'Admin', type: '手动', typeVariant: 'v-badge-neutral' },
  { version: 'v1.2.5', time: '2026-05-18 16:20:08', reason: 'Nacos 配置推送异常导致服务启动失败', operator: '张伟', type: '手动', typeVariant: 'v-badge-neutral' },
];

export default function AppPublishPage() {
  const navigate = useNavigate();
  const { tabs, activeId } = useAppTabs();
  const active = tabs.find((t) => t.id === activeId) ?? tabs[0];
  const appId = active?.id ?? 'order-mgmt';
  const appName = active?.name ?? '订单管理系统';

  const steps = [
    { label: '开发', sub: 'v2.2.0-dev', state: 'completed' },
    { label: '测试', sub: '全部用例通过', state: 'completed' },
    { label: '预发布', sub: '部署验证中', state: 'active' },
    { label: '生产', sub: '待发布', state: '' },
  ];

  return (
    <div>
      <AppHeader appId={appId} appName={appName} subTabs={APP_SUB_TABS} />

      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 24 }}>
        <button className="v-btn"><History style={{ width: 15, height: 15 }} />发布历史</button>
        <button className="v-btn-primary"><Rocket style={{ width: 15, height: 15 }} />新建发布</button>
      </div>

      {/* Steps */}
      <div className="v-card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 0, padding: '0 20px' }}>
          {steps.map((s, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', border: '1px solid', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 600, flexShrink: 0,
                  ...(s.state === 'completed' ? { background: 'var(--success-subtle)', borderColor: 'var(--success)', color: 'var(--success)' } : {}),
                  ...(s.state === 'active' ? { background: 'var(--primary)', borderColor: 'var(--primary)', color: 'var(--primary-foreground)' } : {}),
                  ...(s.state === '' ? { borderColor: 'var(--border)', color: 'var(--muted-foreground)', background: 'var(--card)' } : {}),
                }}>
                  {s.state === 'completed' ? <Check style={{ width: 14, height: 14 }} /> : i + 1}
                </div>
                <div>
                  <span style={{ fontSize: 13, color: s.state === '' ? 'var(--muted-foreground)' : 'var(--foreground)', fontWeight: s.state === 'active' ? 500 : 400 }}>{s.label}</span>
                  <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 1 }}>{s.sub}</div>
                </div>
              </div>
              {i < steps.length - 1 && <div style={{ flex: 1, height: 1, background: s.state === 'completed' ? 'var(--success)' : 'var(--border)', minWidth: 24 }} />}
            </div>
          ))}
        </div>
      </div>

      {/* Checklist */}
      <div className="v-card" style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <ClipboardCheck style={{ width: 16, height: 16, color: 'var(--muted-foreground)' }} />发布检查清单
          <span className="v-badge v-badge-warning" style={{ marginLeft: 'auto' }}><AlertTriangle style={{ width: 12, height: 12 }} /> 6/8 通过 (75%)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 16px', borderBottom: '1px solid var(--border)', background: 'var(--muted)', margin: '16px -20px 0' }}>
          <div style={{ flex: 1, height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: '75%', background: 'var(--success)', borderRadius: 3 }} />
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted-foreground)', whiteSpace: 'nowrap' }}><strong style={{ color: 'var(--foreground)' }}>6</strong> 项通过 / <strong style={{ color: 'var(--foreground)' }}>2</strong> 项未通过</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 0 }}>
          {CHECKLIST.map((c, i) => {
            const isPass = c.status === 'pass';
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: i < CHECKLIST.length - 1 ? '1px solid var(--border)' : 'none', margin: '0 -20px', paddingLeft: 36, paddingRight: 36 }}>
                <div style={{ width: 20, height: 20, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, ...(isPass ? { background: 'var(--success-subtle)', color: 'var(--success)' } : { background: '#2a1414', color: 'var(--destructive)' }) }}>
                  {isPass ? <CheckCircle style={{ width: 14, height: 14 }} /> : <XCircle style={{ width: 14, height: 14 }} />}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{c.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginTop: 2 }}>{c.detail}</div>
                </div>
                <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 4, fontWeight: 500, flexShrink: 0, ...(isPass ? { background: 'var(--success-subtle)', color: 'var(--success)' } : { background: '#2a1414', color: 'var(--destructive)' }) }}>{isPass ? '通过' : c.status === 'fail' ? '未通过' : '未完成'}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Release Records Table */}
      <div className="v-card" style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><History style={{ width: 16, height: 16, color: 'var(--muted-foreground)' }} />发布记录</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="v-btn" style={{ height: 30, fontSize: 12 }}><Filter style={{ width: 13, height: 13 }} />筛选</button>
            <button className="v-btn" style={{ height: 30, fontSize: 12 }}><Download style={{ width: 13, height: 13 }} />导出</button>
          </div>
        </div>
        <table className="v-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['版本号', '环境', '发布时间', '操作人', '状态', '耗时', '备注', '操作'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontSize: 12, fontWeight: 500, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {RELEASES.map((r, i) => (
              <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', fontWeight: 500 }}>{r.version}</td>
                <td style={{ padding: '10px 14px' }}>
                  <span className={`v-badge ${r.env === 'Production' ? 'v-badge-success' : 'v-badge-info'}`}>{r.env}</span>
                </td>
                <td style={{ padding: '10px 14px' }}>{r.time}</td>
                <td style={{ padding: '10px 14px' }}>{r.operator}</td>
                <td style={{ padding: '10px 14px' }}>
                  <span className={`v-badge ${r.statusVariant}`}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', display: 'inline-block', marginRight: 4, background: r.status === '成功' ? 'var(--success)' : r.status === '失败' ? 'var(--destructive)' : r.status === '已回滚' ? 'var(--warning)' : '#60a5fa' }} />
                    {r.status}
                  </span>
                </td>
                <td style={{ padding: '10px 14px', color: 'var(--muted-foreground)' }}>{r.duration}</td>
                <td style={{ padding: '10px 14px', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--muted-foreground)' }}>{r.note}</td>
                <td style={{ padding: '10px 14px' }}>
                  <button className="v-btn" style={{ height: 28, padding: '0 10px', fontSize: 12 }}>{r.status === '进行中' || r.status === '失败' ? '查看日志' : '回滚至此'}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Env Config */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
        {[
          { title: '预发布环境', rows: [
            { label: '访问地址', val: 'staging.order.mate.dev' },
            { label: '数据库', val: 'pg-staging-01:5432/order_staging' },
            { label: 'Nacos 命名空间', val: 'staging-order-mgmt' },
            { label: 'Kubernetes 集群', val: 'k8s-staging-east-1' },
            { label: '最后部署时间', val: '2026-07-22 10:15:32' },
            { label: '当前版本', val: 'v2.2.0-rc.1' },
          ]},
          { title: '生产环境', rows: [
            { label: '访问地址', val: 'order.mate.dev' },
            { label: '数据库', val: 'pg-prod-01:5432/order_prod (主从)' },
            { label: 'Nacos 命名空间', val: 'production-order-mgmt' },
            { label: 'Kubernetes 集群', val: 'k8s-prod-east-1 (3 节点)' },
            { label: '最后部署时间', val: '2026-07-20 14:30:18' },
            { label: '当前版本', val: 'v2.1.3' },
          ]},
        ].map(env => (
          <div key={env.title} className="v-card" style={{ marginBottom: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}><Server style={{ width: 16, height: 16 }} />{env.title}</div>
              <span className="v-badge v-badge-success"><span style={{ width: 8, height: 8, borderRadius: '50%', display: 'inline-block', marginRight: 4, background: 'var(--success)' }} />运行中</span>
            </div>
            {env.rows.map(r => (
              <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>{r.label}</span>
                <span style={{ fontSize: 13, fontFamily: 'var(--font-mono)', textAlign: 'right', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.val}</span>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Rollback Strategy */}
      <div className="v-card" style={{ marginTop: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}><RotateCcw style={{ width: 16, height: 16, color: 'var(--muted-foreground)' }} />回滚策略</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20, marginBottom: 20 }}>
          {[
            { label: '当前回滚策略', val: '自动回滚', valColor: 'var(--success)', desc: '健康检查连续 3 次失败后自动触发回滚' },
            { label: '最大回滚时间窗口', val: '30 分钟', desc: '发布后 30 分钟内可执行自动或手动回滚' },
            { label: '历史回滚成功率', val: '100%', desc: '共执行 3 次回滚，全部成功恢复服务' },
          ].map(s => (
            <div key={s.label} style={{ padding: 16, border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
              <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 500 }}>{s.label}</div>
              <div style={{ fontSize: 15, fontWeight: 600, ...(s.valColor ? { color: s.valColor } : {}) }}>{s.val}</div>
              <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginTop: 4 }}>{s.desc}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>最近回滚记录</div>
        {ROLLBACK_HISTORY.map((r, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: i < ROLLBACK_HISTORY.length - 1 ? '1px solid var(--border)' : 'none', ...(i === 0 ? { background: 'var(--muted)' } : {}) }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 500, minWidth: 100 }}>{r.version}</span>
            <span style={{ fontSize: 12, color: 'var(--muted-foreground)', minWidth: 150 }}>{r.time}</span>
            <span style={{ fontSize: 12, color: 'var(--muted-foreground)', flex: 1 }}>{r.reason}</span>
            <span style={{ fontSize: 12, color: 'var(--muted-foreground)', minWidth: 60, textAlign: 'right' }}>{r.operator}</span>
            <span className={`v-badge ${r.typeVariant}`} style={{ fontSize: 11 }}>{r.type}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
