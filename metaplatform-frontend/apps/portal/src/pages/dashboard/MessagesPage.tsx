import { useLocation } from 'react-router-dom';
import {
  CheckCheck,
  Info,
  AlertTriangle,
  Clock,
  Monitor,
  CheckCircle,
  Shield,
  Users,
  Rocket,
  Wrench,
  Bot,
  GitPullRequest,
  FileCheck2,
  Zap,
  GitMerge,
  MessageSquare,
  Paperclip,
  Check,
  Reply,
  Forward,
  Archive,
  Trash2,
  FileText,
  GitBranch,
  ClipboardList,
  ChevronRight,
} from 'lucide-react';
import { SubTabs } from '@mate/shared';
import { MOCK_MESSAGES } from '@/mock'; // MOCK

const DASHBOARD_TABS = [
  { label: '工作台', path: '/dashboard' },
  { label: '我的应用', path: '/dashboard/my-apps' },
  { label: '我的数字员工', path: '/dashboard/my-agents' },
  { label: '消息', path: '/dashboard/messages' },
  { label: '门户', path: '/dashboard/portal' },
  { label: '交付材料', path: '/dashboard/deliverables' },
];

// MOCK: message list data (from HTML design, richer than MOCK_MESSAGES)
const messageList = [
  { id: 1, sender: '系统管理员', time: '10 分钟前', title: '系统升级通知', priority: 'high', unread: true, selected: true, avatarClass: 'system', icon: Info, summary: 'Mate Platform v1.2.0 已于今日凌晨完成升级，本次更新包含 SAA 全栈迁移与 MCP 协议层优化。', attachments: 2 },
  { id: 2, sender: '安全中心', time: '30 分钟前', title: '安全告警：异常登录行为检测', priority: 'high', unread: true, avatarClass: 'system', icon: AlertTriangle, summary: '检测到连续 5 次来自不同 IP 的登录尝试，已触发账户临时锁定，请核实。', attachments: 0 },
  { id: 3, sender: '工作流引擎', time: '1 小时前', title: '审批待处理：客户数据集成流程发布', priority: 'mid', unread: true, avatarClass: 'approval', icon: Clock, summary: '张三提交了数据集成流程的发布申请，需要您进行审批确认后才能上线运行。', attachments: 1 },
  { id: 4, sender: 'IAM 服务', time: '2 小时前', title: '新设备登录提醒', priority: 'high', unread: true, avatarClass: 'system', icon: Monitor, summary: '检测到您的账户在新设备上登录，IP 192.168.1.105（北京），如非本人请立即修改密码。', attachments: 0 },
  { id: 5, sender: 'Agent 运行时', time: '3 小时前', title: '数据质量巡检任务完成', priority: 'mid', unread: true, avatarClass: 'task', icon: CheckCircle, summary: '数字员工「数据质量巡检员」已完成本月第三轮检测，发现 2 个异常待处理。', attachments: 3 },
  { id: 6, sender: 'IAM 服务', time: '4 小时前', title: '审批待处理：本体引擎权限变更申请', priority: 'mid', unread: true, avatarClass: 'approval', icon: Shield, summary: '李四申请获取本体引擎模块的模型导出权限，请审批。', attachments: 0 },
  { id: 7, sender: '李明', time: '5 小时前', title: '本体模型评审邀请', priority: 'low', unread: true, avatarClass: 'collab', icon: Users, summary: '邀请您参与「产品域本体模型 v2.1」的评审会议，定于明天下午 3 点。', attachments: 0 },
  { id: 8, sender: '应用中心', time: '今天 08:15', title: '审批待处理：供应商管理应用 v3.2 发布', priority: 'mid', unread: true, avatarClass: 'approval', icon: Rocket, summary: '赵六提交了供应商管理应用的线上发布申请，包含 5 个功能更新与 2 个 Bug 修复。', attachments: 2 },
  { id: 9, sender: '运维平台', time: '昨天 22:00', title: '计划维护通知：Nacos 集群升级', priority: 'mid', unread: false, avatarClass: 'system', icon: Wrench, summary: 'Nacos 3.0 集群将于本周六 02:00-05:00 进行滚动升级，期间 MCP/A2A 注册服务可能短暂中断。', attachments: 0 },
  { id: 10, sender: '客服小助手', time: '昨天 18:30', title: 'Agent 异常告警：连续响应超时', priority: 'mid', unread: false, avatarClass: 'task', icon: Bot, summary: '客服小助手连续 3 次响应超时，已自动降级至备用模型，请关注并排查根因。', attachments: 0 },
  { id: 11, sender: '王磊', time: '昨天 14:20', title: '架构设计文档已更新', priority: 'low', unread: false, avatarClass: 'collab', icon: GitPullRequest, summary: '应用架构 v1.2 已更新，包含 SAA 迁移方案与 Nacos 3.0 Registry 设计变更。', attachments: 1 },
  { id: 12, sender: '本体引擎', time: '昨天 11:05', title: '审批已通过：产品域本体模型 v2.0', priority: 'low', unread: false, avatarClass: 'approval', icon: FileCheck2, summary: '产品域本体模型 v2.0 已通过终审，新增 12 个 G2 业务对象与 5 条推理规则。', attachments: 0 },
  { id: 13, sender: '合同审核员', time: '2 天前', title: '合同审核报告生成完毕', priority: 'low', unread: false, avatarClass: 'task', icon: Zap, summary: '已完成 3 份供应商合同的自动审核，风险摘要报告已推送至审批流。', attachments: 4 },
  { id: 14, sender: '技术中台', time: '2 天前', title: '代码合并通知：TECH-LLMGW 分支合入 main', priority: 'low', unread: false, avatarClass: 'collab', icon: GitMerge, summary: 'feature/saa-chatmodel 分支已合并至 main，包含 SAA ChatModel 适配器与多模型路由重构。', attachments: 0 },
  { id: 15, sender: '周杰', time: '3 天前', title: '知识库评论：RAG 检索策略优化建议', priority: 'low', unread: false, avatarClass: 'collab', icon: MessageSquare, summary: '周杰在「产品技术文档」知识库中评论了 RAG 混合检索策略的优化方案，@了您。', attachments: 0 },
];

const avatarBgMap: Record<string, string> = {
  system: 'var(--muted)',
  approval: 'var(--warning-subtle)',
  task: 'var(--success-subtle)',
  collab: 'rgba(96,165,250,0.12)',
};
const avatarColorMap: Record<string, string> = {
  system: 'var(--muted-foreground)',
  approval: 'var(--warning)',
  task: 'var(--success)',
  collab: '#60a5fa',
};

const priorityMap: Record<string, { label: string; bg: string; color: string }> = {
  high: { label: '高', bg: 'rgba(255,97,102,0.15)', color: 'var(--destructive)' },
  mid: { label: '中', bg: 'var(--warning-subtle)', color: 'var(--warning)' },
  low: { label: '低', bg: 'var(--muted)', color: 'var(--muted-foreground)' },
};

// MOCK: timeline data for detail panel
const timelineItems = [
  { time: '2026-07-22 09:45', text: 'Admin 查看了此通知', user: 'Admin' },
  { time: '2026-07-22 04:12', text: '运维平台 自动确认升级后健康检查通过，所有 17 个微服务状态正常', user: '运维平台' },
  { time: '2026-07-22 02:00', text: '系统管理员 发起 v1.2.0 滚动升级，预计耗时 2 小时', user: '系统管理员' },
];

// MOCK: related links data
const relatedLinks = [
  { icon: FileText, title: 'v1.2.0 升级说明文档', desc: 'docs/001-ARCH/ · 更新于 2026-07-21' },
  { icon: GitBranch, title: 'release/v1.2.0 代码分支', desc: 'GitHub · 47 commits · 12 文件变更' },
  { icon: ClipboardList, title: 'SAA 迁移评估报告', desc: 'docs/005-RD/ · 2026-07-21' },
];

export default function MessagesPage() {
  const location = useLocation();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <SubTabs items={DASHBOARD_TABS} activePath={location.pathname} />

      <div style={{ padding: '24px 0', flex: 1, minHeight: 0, overflowY: 'auto' }}>
      {/* Page header */}
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 4 }}>消息</h1>
          <p style={{ fontSize: 14, color: 'var(--muted-foreground)' }}>系统通知和消息提醒</p>
        </div>
        <button className="v-btn" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <CheckCheck style={{ width: 14, height: 14 }} />全部已读
        </button>
      </div>

      {/* Content layout */}
      <div style={{ display: 'flex', gap: 20, height: 'calc(100vh - 180px)' }}>
        {/* Category panel */}
        <div style={{ width: 200, flexShrink: 0 }}>
          <div className="v-card" style={{ height: '100%', padding: 8, display: 'flex', flexDirection: 'column' }}>
            {/* Quick filters */}
            <div style={{ display: 'flex', gap: 4, padding: '8px 8px 4px', borderBottom: '1px solid var(--border)', marginBottom: 4 }}>
              {[
                { count: '8', label: '未读', active: true },
                { count: '5', label: '今日', active: false },
                { count: '3', label: '重要', active: false },
              ].map((f, i) => (
                <div key={i} style={{
                  flex: 1, padding: '6px 4px', borderRadius: 4, cursor: 'pointer', fontSize: 11, textAlign: 'center',
                  color: f.active ? 'var(--foreground)' : 'var(--muted-foreground)',
                  background: f.active ? 'var(--muted)' : 'transparent',
                  border: `1px solid ${f.active ? 'var(--border)' : 'transparent'}`,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--foreground)' }}>{f.count}</span>
                  <span style={{ fontSize: 10 }}>{f.label}</span>
                </div>
              ))}
            </div>
            {/* Category list */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2, paddingTop: 4 }}>
              {[
                { label: '全部', count: '23', active: true },
                { label: '系统通知', count: '8', active: false },
                { label: '审批通知', count: '5', active: false },
                { label: '任务通知', count: '6', active: false },
                { label: '协作通知', count: '4', active: false },
              ].map((c, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 12px', borderRadius: 4, cursor: 'pointer', fontSize: 13,
                  color: c.active ? 'var(--foreground)' : 'var(--muted-foreground)',
                  background: c.active ? 'var(--muted)' : 'transparent',
                  border: `1px solid ${c.active ? 'var(--border)' : 'transparent'}`,
                }}>
                  <span>{c.label}</span>
                  <span style={{
                    fontSize: 11, padding: '1px 6px', borderRadius: 9999, minWidth: 20, textAlign: 'center',
                    background: c.active ? 'var(--border)' : 'var(--muted)',
                    color: c.active ? 'var(--foreground)' : 'var(--muted-foreground)',
                  }}>{c.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Message panel */}
        <div style={{ flex: 1, minWidth: 0, overflowY: 'auto' }}>
          <div className="v-card" style={{ height: '100%', overflowY: 'auto', padding: '0 20px' }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {messageList.map((msg) => {
                const Icon = msg.icon;
                const prio = priorityMap[msg.priority];
                return (
                  <div key={msg.id} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 12,
                    borderBottom: '1px solid var(--border)', cursor: 'pointer', position: 'relative',
                    background: msg.selected ? 'var(--muted)' : 'transparent',
                    margin: msg.selected ? '0 -20px' : '0',
                    padding: msg.selected ? '14px 20px' : '14px 0',
                  }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0, fontSize: 13, fontWeight: 600,
                      background: avatarBgMap[msg.avatarClass], color: avatarColorMap[msg.avatarClass],
                    }}>
                      <Icon style={{ width: 18, height: 18 }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                        <span style={{ fontSize: 13, fontWeight: 500 }}>{msg.sender}</span>
                        <span style={{ fontSize: 12, color: 'var(--muted-foreground)', flexShrink: 0, marginLeft: 12 }}>{msg.time}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                        <span style={{
                          fontSize: 13, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                          fontWeight: msg.unread ? 600 : 400,
                          color: msg.unread ? 'var(--foreground)' : 'var(--muted-foreground)',
                        }}>{msg.title}</span>
                        <span style={{
                          fontSize: 10, padding: '1px 5px', borderRadius: 4, fontWeight: 500, flexShrink: 0, lineHeight: 1.4,
                          background: prio.bg, color: prio.color,
                        }}>{prio.label}</span>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--muted-foreground)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', opacity: 0.7 }}>{msg.summary}</div>
                      {msg.attachments > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: 'var(--muted-foreground)', opacity: 0.7, marginTop: 2 }}>
                          <Paperclip style={{ width: 11, height: 11 }} /> {msg.attachments} 个附件
                        </div>
                      )}
                    </div>
                    {msg.unread && (
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--primary)', flexShrink: 0, marginTop: 6 }} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Detail panel */}
        <div style={{ width: 400, flexShrink: 0, overflowY: 'auto' }}>
          <div className="v-card" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* Detail header */}
            <div style={{ paddingBottom: 16, borderBottom: '1px solid var(--border)', marginBottom: 16 }}>
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, lineHeight: 1.4 }}>系统升级通知</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--muted-foreground)', flexWrap: 'wrap' }}>
                <span>系统管理员</span>
                <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'var(--muted-foreground)' }} />
                <span>2026-07-22 09:32</span>
                <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'var(--muted-foreground)' }} />
                <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 4, fontWeight: 500, background: 'rgba(255,97,102,0.15)', color: 'var(--destructive)' }}>高优先级</span>
                <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'var(--muted-foreground)' }} />
                <span>2 个附件</span>
              </div>
            </div>

            {/* Detail content */}
            <div style={{ flex: 1, fontSize: 14, lineHeight: 1.7, color: 'var(--card-foreground)', overflowY: 'auto' }}>
              <p style={{ marginBottom: 12 }}>Mate Platform 已于今日凌晨 02:00 - 04:00 完成 v1.2.0 版本升级。</p>
              <p style={{ marginBottom: 12 }}><strong>本次更新内容：</strong></p>
              <p style={{ marginBottom: 12 }}>1. Spring AI Alibaba 1.1.2.0 全栈迁移完成，6 个 Python 后端服务已重写为 Java + SAA 架构。</p>
              <p style={{ marginBottom: 12 }}>2. MCP 协议适配服务升级至 spring-ai-alibaba Nacos MCP，支持 Nacos 3.0+ Registry 动态注册与发现。</p>
              <p style={{ marginBottom: 12 }}>3. A2A 协议适配服务升级至 spring-ai-alibaba-starter-a2a-nacos，支持跨 Agent 协作与 Action 节点集成。</p>
              <p style={{ marginBottom: 12 }}>4. 修复了本体引擎在大规模并发推理场景下的连接池泄漏问题。</p>
              <p style={{ marginBottom: 12 }}>5. 优化了 LLM Gateway 的多模型路由策略，新增按 Token 用量的智能调度。</p>
              <p style={{ marginBottom: 12 }}>如遇到任何问题，请联系技术支持团队或提交工单。</p>

              {/* Timeline */}
              <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>操作历史</div>
                <div style={{ display: 'flex', flexDirection: 'column', position: 'relative', paddingLeft: 20 }}>
                  <div style={{ position: 'absolute', left: 5, top: 4, bottom: 4, width: 1, background: 'var(--border)' }} />
                  {timelineItems.map((item, i) => (
                    <div key={i} style={{ position: 'relative', paddingBottom: 16 }}>
                      <div style={{
                        position: 'absolute', left: -20, top: 4, width: 11, height: 11, borderRadius: '50%',
                        border: '2px solid var(--border)',
                        borderColor: i === 0 ? '#60a5fa' : 'var(--border)',
                        background: i === 0 ? '#60a5fa' : 'var(--card)',
                      }} />
                      <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginBottom: 2 }}>{item.time}</div>
                      <div style={{ fontSize: 13, color: 'var(--card-foreground)', lineHeight: 1.5 }}><strong>{item.user}</strong> {item.text.replace(item.user + ' ', '')}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Related links */}
              <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>关联资源</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {relatedLinks.map((link, i) => {
                    const Icon = link.icon;
                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer' }}>
                        <div style={{ width: 32, height: 32, borderRadius: 4, background: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: 'var(--muted-foreground)' }}>
                          <Icon style={{ width: 16, height: 16 }} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{link.title}</div>
                          <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 1 }}>{link.desc}</div>
                        </div>
                        <ChevronRight style={{ width: 14, height: 14, color: 'var(--muted-foreground)', flexShrink: 0 }} />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Detail actions */}
            <div style={{ display: 'flex', gap: 8, marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)', flexWrap: 'wrap' }}>
              <button className="v-btn" style={{ height: 28, padding: '0 10px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Check style={{ width: 12, height: 12 }} />标记已读
              </button>
              <button className="v-btn" style={{ height: 28, padding: '0 10px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Reply style={{ width: 12, height: 12 }} />回复
              </button>
              <button className="v-btn" style={{ height: 28, padding: '0 10px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Forward style={{ width: 12, height: 12 }} />转发
              </button>
              <button className="v-btn" style={{ height: 28, padding: '0 10px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Archive style={{ width: 12, height: 12 }} />归档
              </button>
              <button className="v-btn" style={{ height: 28, padding: '0 10px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4, borderColor: 'var(--destructive)', color: 'var(--destructive)' }}>
                <Trash2 style={{ width: 12, height: 12 }} />删除
              </button>
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
