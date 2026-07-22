import { useNavigate } from 'react-router-dom';
import {
  Download, Plus, GitCompare, Calendar, User,
  BarChart3, FileCode2, Activity, Route, FileText, Globe,
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

// MOCK: 版本时间线数据
const VERSIONS = [
  { num: 'v2.3.0', date: '2026-07-20', author: '张伟', tags: ['最新', '生产'], dotType: 'latest', desc: '新增智能审批流引擎，支持多级并行审批与条件分支路由。\n履约跟踪模块增加物流实时状态轮询与异常告警推送。\n修复订单批量操作并发场景下的数据一致性问题。', chips: [{ label: '功能', cls: 'feature' }, { label: '修复', cls: 'fix' }, { label: '优化', cls: 'optimize' }] },
  { num: 'v2.2.1', date: '2026-07-15', author: '李明', tags: ['历史'], dotType: 'current', desc: '修复发票模块金额计算精度丢失问题，对齐财务系统小数位规范。\n优化订单列表分页查询性能，引入游标分页替代偏移分页。', chips: [{ label: '修复', cls: 'fix' }, { label: '优化', cls: 'optimize' }] },
  { num: 'v2.2.0', date: '2026-07-08', author: '张伟', tags: ['历史'], dotType: '', desc: '新增客户信用评分模型，基于历史订单数据自动评估客户信用等级。\n订单表单增加动态字段联动，客户类型变更自动切换表单模板。\n新增数据导出任务队列，支持异步大批量导出与下载。', chips: [{ label: '功能', cls: 'feature' }, { label: '功能', cls: 'feature' }] },
  { num: 'v2.1.0', date: '2026-06-28', author: '王芳', tags: ['历史'], dotType: '', desc: '重构订单状态机，从 5 状态扩展到 12 状态，支持更细粒度流转控制。\n新增订单操作审计日志，记录所有状态变更与字段修改轨迹。', chips: [{ label: '重构', cls: 'refactor' }, { label: '功能', cls: 'feature' }] },
  { num: 'v2.0.0', date: '2026-06-15', author: '张伟', tags: ['历史'], dotType: '', desc: '订单模块全量重构，数据模型从单表迁移到本体引擎语义建模。\nAPI 层重写，RESTful 路径规范化，废弃旧版兼容接口。\n前端表单设计器对接新版数据建模，支持复杂嵌套表单。', chips: [{ label: '重构', cls: 'breaking' }, { label: '重构', cls: 'breaking' }, { label: '重构', cls: 'breaking' }] },
  { num: 'v1.3.0', date: '2026-06-02', author: '李明', tags: ['历史'], dotType: '', desc: '新增发票管理模块，支持增值税普票与专票的自动开具与作废。\n批量导出功能支持 Excel/CSV 双格式，适配财务对账场景。', chips: [{ label: '功能', cls: 'feature' }] },
  { num: 'v1.2.0', date: '2026-05-20', author: '张伟', tags: ['历史'], dotType: '', desc: '修复审批流程在高并发下的节点状态不一致问题。\n订单列表查询性能优化，响应时间从 800ms 降至 120ms。', chips: [{ label: '修复', cls: 'fix' }, { label: '优化', cls: 'optimize' }] },
  { num: 'v1.1.0', date: '2026-05-10', author: '王芳', tags: ['历史'], dotType: '', desc: '新增客户管理模块，支持客户信息 CRUD 与分类标签管理。\n订单表单增加必填校验与跨字段联动验证规则。', chips: [{ label: '功能', cls: 'feature' }, { label: '功能', cls: 'feature' }] },
  { num: 'v1.0.0', date: '2026-04-28', author: '张伟', tags: ['历史'], dotType: '', desc: '系统初始正式版本，包含订单核心 CRUD 与基础审批流程。\n支持订单创建、编辑、提交审批与状态查看。', chips: [{ label: '功能', cls: 'feature' }] },
  { num: 'v0.9.0-beta', date: '2026-04-15', author: '张伟', tags: ['Beta'], dotType: '', desc: '项目初始化，基础框架搭建完成，包含数据建模与表单设计器原型。\n内部测试版本，仅限开发团队使用。', chips: [{ label: '初始化', cls: 'dev' }] },
];

const CHIP_STYLES: Record<string, { bg: string; color: string }> = {
  feature: { bg: 'var(--success-subtle)', color: 'var(--success)' },
  fix: { bg: 'var(--warning-subtle)', color: 'var(--warning)' },
  refactor: { bg: '#1a1420', color: '#c084fc' },
  breaking: { bg: '#2a1414', color: 'var(--destructive)' },
  optimize: { bg: '#001a2a', color: '#60a5fa' },
  dev: { bg: 'var(--muted)', color: '#888' },
};

const TAG_STYLES: Record<string, { bg: string; color: string }> = {
  '最新': { bg: 'var(--muted)', color: 'var(--muted-foreground)' },
  '生产': { bg: 'var(--success-subtle)', color: 'var(--success)' },
  '历史': { bg: 'var(--muted)', color: 'var(--muted-foreground)' },
  'Beta': { bg: '#1a1400', color: 'var(--warning)' },
};

// MOCK: 变更文件列表
const CHANGED_FILES = [
  { name: 'ApprovalFlowEngine.java', type: 'added', desc: '新增智能审批流引擎核心类，支持并行与条件分支路由' },
  { name: 'ApprovalNode.java', type: 'added', desc: '审批节点实体，定义节点类型、执行人与超时策略' },
  { name: 'ApprovalFlowController.java', type: 'added', desc: '审批流 REST API，含启动/审批/驳回/转办接口' },
  { name: 'FulfillmentTrackingService.java', type: 'added', desc: '物流实时跟踪服务，对接第三方物流 API 轮询状态' },
  { name: 'FulfillmentAlertService.java', type: 'added', desc: '物流异常告警服务，检测超时/停滞/异常签收并推送通知' },
  { name: 'OrderController.java', type: 'modified', desc: '新增批量审批入口，增加乐观锁防止并发覆盖' },
  { name: 'Order.java', type: 'modified', desc: '新增 approvalFlowId 字段，关联审批流实例' },
  { name: 'OrderService.java', type: 'modified', desc: '批量操作增加分布式锁，修复并发场景数据一致性' },
  { name: 'OrderStatusEnum.java', type: 'modified', desc: '新增 PENDING_APPROVAL / APPROVED / REJECTED 状态枚举' },
  { name: 'FulfillmentController.java', type: 'modified', desc: '新增物流状态查询与告警历史查询接口' },
  { name: 'order-form.json', type: 'modified', desc: '订单表单新增审批状态只读展示区域' },
  { name: 'fulfillment-form.json', type: 'modified', desc: '履约表单增加物流跟踪时间线与告警标识组件' },
  { name: 'process-order-approval.bpmn', type: 'added', desc: '订单审批 BPMN 流程定义，含三级审批网关' },
  { name: 'LegacyApprovalHandler.java', type: 'deleted', desc: '废弃旧版单级审批处理器，由 ApprovalFlowEngine 替代' },
  { name: 'approval-config.xml', type: 'deleted', desc: '旧版 XML 审批配置，迁移至数据库动态配置' },
];

const CHANGE_TYPE_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  added: { bg: 'var(--success-subtle)', color: 'var(--success)', label: '新增' },
  modified: { bg: 'var(--warning-subtle)', color: 'var(--warning)', label: '修改' },
  deleted: { bg: '#2a1414', color: 'var(--destructive)', label: '删除' },
};

// MOCK: 影响分析数据
const IMPACT_DATA = [
  { title: '影响的流程 (2)', icon: Route, items: [{ name: '订单提交流程', badge: '修改', dotColor: '#60a5fa' }, { name: '订单审批流程', badge: '新增', dotColor: '#60a5fa' }] },
  { title: '影响的表单 (3)', icon: FileText, items: [{ name: '订单创建表单', badge: '修改', dotColor: 'var(--success)' }, { name: '订单详情表单', badge: '修改', dotColor: 'var(--success)' }, { name: '履约跟踪表单', badge: '修改', dotColor: 'var(--success)' }] },
  { title: '影响的 API (4)', icon: Globe, items: [{ name: 'POST /order/batch-approve', badge: '新增', dotColor: '#c084fc' }, { name: 'POST /approval/{id}/start', badge: '新增', dotColor: '#c084fc' }, { name: 'GET /fulfillment/tracking/{id}', badge: '新增', dotColor: '#c084fc' }, { name: 'PUT /order/{id}/status', badge: '修改', dotColor: '#c084fc' }] },
];

export default function AppVersionPage() {
  const navigate = useNavigate();
  const { tabs, activeId } = useAppTabs();
  const active = tabs.find((t) => t.id === activeId) ?? tabs[0];
  const appId = active?.id ?? 'order-mgmt';
  const appName = active?.name ?? '订单管理系统';

  return (
    <div>
      <AppHeader appId={appId} appName={appName} subTabs={APP_SUB_TABS} />

      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 24 }}>
        <button className="v-btn"><Download style={{ width: 15, height: 15 }} />导出</button>
        <button className="v-btn-primary"><Plus style={{ width: 15, height: 15 }} />新建版本</button>
      </div>

      {/* Version Compare Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, padding: '14px 18px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--muted-foreground)', display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}><GitCompare style={{ width: 15, height: 15 }} />版本对比</span>
        <select className="v-input" style={{ fontFamily: 'var(--font-mono)', cursor: 'pointer' }} defaultValue="v2.3.0">
          {['v2.3.0', 'v2.2.1', 'v2.2.0', 'v2.1.0', 'v2.0.0', 'v1.3.0', 'v1.2.0', 'v1.1.0', 'v1.0.0', 'v0.9.0-beta'].map(v => <option key={v}>{v}</option>)}
        </select>
        <span style={{ color: 'var(--muted-foreground)', fontSize: 13, fontWeight: 500 }}>vs</span>
        <select className="v-input" style={{ fontFamily: 'var(--font-mono)', cursor: 'pointer' }} defaultValue="v2.0.0">
          {['v2.2.1', 'v2.2.0', 'v2.1.0', 'v2.0.0', 'v1.3.0', 'v1.2.0', 'v1.1.0', 'v1.0.0', 'v0.9.0-beta'].map(v => <option key={v}>{v}</option>)}
        </select>
        <button className="v-btn"><GitCompare style={{ width: 15, height: 15 }} />开始对比</button>
      </div>

      {/* Tag Filter */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20 }}>
        {['全部', '正式版', '测试版', '开发版'].map((f, i) => (
          <button key={f} style={{ background: i === 0 ? 'var(--primary)' : 'transparent', color: i === 0 ? 'var(--primary-foreground)' : 'var(--muted-foreground)', border: '1px solid', borderColor: i === 0 ? 'var(--primary)' : 'var(--border)', borderRadius: 'var(--radius)', height: 30, padding: '0 12px', fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-sans)', fontWeight: 500 }}>{f}</button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 20 }}>
        {/* Left: Timeline */}
        <div className="v-card">
          <div style={{ position: 'relative', paddingLeft: 28 }}>
            <div style={{ position: 'absolute', left: 9, top: 8, bottom: 8, width: 2, background: 'var(--border)' }} />
            {VERSIONS.map((v, i) => (
              <div key={v.num} style={{ position: 'relative', paddingBottom: i < VERSIONS.length - 1 ? 16 : 0, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ position: 'absolute', left: -28, top: 2, width: 20, height: 20, borderRadius: '50%', background: 'var(--card)', border: '2px solid', borderColor: v.dotType === 'latest' ? 'var(--primary)' : v.dotType === 'current' ? 'var(--success)' : 'var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>
                  {(v.dotType === 'latest' || v.dotType === 'current') && <div style={{ width: 8, height: 8, borderRadius: '50%', background: v.dotType === 'latest' ? 'var(--primary)' : 'var(--success)' }} />}
                </div>
                <div className="v-card" style={{ flex: 1, padding: '14px 16px', cursor: 'pointer', ...(i === 0 ? { borderColor: 'var(--foreground)' } : {}) }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 600 }}>{v.num}</span>
                    {v.tags.map(t => {
                      const ts = TAG_STYLES[t];
                      return <span key={t} style={{ fontSize: 11, padding: '2px 6px', borderRadius: 4, fontWeight: 500, background: ts.bg, color: ts.color }}>{t}</span>;
                    })}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 6 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Calendar style={{ width: 13, height: 13 }} />{v.date}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><User style={{ width: 13, height: 13 }} />{v.author}</span>
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--foreground)', lineHeight: 1.55, marginBottom: 8, whiteSpace: 'pre-line' }}>{v.desc}</div>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {v.chips.map((c, ci) => {
                      const cs = CHIP_STYLES[c.cls];
                      return <span key={ci} style={{ fontSize: 11, padding: '1px 6px', borderRadius: 4, background: cs.bg, color: cs.color }}>{c.label}</span>;
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Detail Panel */}
        <div>
          {/* Detail Header */}
          <div className="v-card" style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 700 }}>v2.3.0</span>
                <span style={{ fontSize: 12, padding: '3px 8px', borderRadius: 4, fontWeight: 500, background: 'var(--muted)', color: 'var(--muted-foreground)' }}>最新</span>
                <span style={{ fontSize: 12, padding: '3px 8px', borderRadius: 4, fontWeight: 500, background: 'var(--success-subtle)', color: 'var(--success)' }}>生产环境</span>
              </div>
              <span className="v-meta">2026-07-20 · 张伟</span>
            </div>
            <div style={{ fontSize: 13, color: 'var(--foreground)', lineHeight: 1.6, marginBottom: 12 }}>新增智能审批流引擎，支持多级并行审批与条件分支路由。履约跟踪模块增加物流实时状态轮询与异常告警推送。修复订单批量操作并发场景下的数据一致性问题。</div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, padding: '1px 6px', borderRadius: 4, background: 'var(--success-subtle)', color: 'var(--success)' }}>功能</span>
              <span style={{ fontSize: 11, padding: '1px 6px', borderRadius: 4, background: 'var(--warning-subtle)', color: 'var(--warning)' }}>修复</span>
              <span style={{ fontSize: 11, padding: '1px 6px', borderRadius: 4, background: '#001a2a', color: '#60a5fa' }}>优化</span>
            </div>
          </div>

          {/* Change Statistics */}
          <div className="v-card" style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}><BarChart3 style={{ width: 15, height: 15, color: 'var(--muted-foreground)' }} />变更统计</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
              {[
                { val: '+12', color: 'var(--success)', label: '新增文件' },
                { val: '~28', color: 'var(--warning)', label: '修改文件' },
                { val: '-3', color: 'var(--destructive)', label: '删除文件' },
                { val: '5', color: '#60a5fa', label: '影响表单' },
              ].map(s => (
                <div key={s.label} style={{ background: 'var(--muted)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: 22, fontWeight: 700, fontFamily: 'var(--font-mono)', letterSpacing: '-0.02em', color: s.color }}>{s.val}</span>
                  <span style={{ fontSize: 12, color: 'var(--muted-foreground)', fontWeight: 500 }}>{s.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Changed Files */}
          <div className="v-card" style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}><FileCode2 style={{ width: 15, height: 15, color: 'var(--muted-foreground)' }} />变更文件列表</div>
            <table className="v-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '10px 14px', fontSize: 11, fontWeight: 500, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border)' }}>文件路径</th>
                  <th style={{ textAlign: 'left', padding: '10px 14px', fontSize: 11, fontWeight: 500, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border)', width: 80 }}>操作</th>
                  <th style={{ textAlign: 'left', padding: '10px 14px', fontSize: 11, fontWeight: 500, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border)' }}>变更说明</th>
                </tr>
              </thead>
              <tbody>
                {CHANGED_FILES.map((f, i) => {
                  const cs = CHANGE_TYPE_STYLES[f.type];
                  return (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 500 }}>{f.name}</td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 4, background: cs.bg, color: cs.color }}>{cs.label}</span>
                      </td>
                      <td className="v-meta" style={{ padding: '10px 14px' }}>{f.desc}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Impact Analysis */}
          <div className="v-card">
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}><Activity style={{ width: 15, height: 15, color: 'var(--muted-foreground)' }} />关联影响分析</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              {IMPACT_DATA.map(imp => {
                const IIcon = imp.icon;
                return (
                  <div key={imp.title} style={{ background: 'var(--muted)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '14px 16px' }}>
                    <div style={{ fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--muted-foreground)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <IIcon style={{ width: 13, height: 13 }} />{imp.title}
                    </div>
                    {imp.items.map((item, ii) => (
                      <div key={ii} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', fontSize: 13, borderBottom: ii < imp.items.length - 1 ? '1px solid var(--border)' : 'none', ...(ii === 0 ? { paddingTop: 0 } : {}) }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, background: item.dotColor }} />
                        <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</span>
                        <span style={{ fontSize: 11, padding: '1px 6px', borderRadius: 4, background: 'var(--card)', color: 'var(--muted-foreground)', border: '1px solid var(--border)' }}>{item.badge}</span>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
