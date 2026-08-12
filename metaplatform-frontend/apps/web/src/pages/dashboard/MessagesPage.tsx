import { useLocation } from 'react-router-dom';
import { Button, Card } from '@douyinfe/semi-ui';
import { useState, useEffect, useMemo } from 'react';
import {
  Paperclip, CheckCheck, Check, Reply, Forward, Archive, Trash2,
  ChevronRight, FileText, GitBranch, ClipboardList,
  FileCheck2, BarChart3, AlertTriangle, MessageSquare, Settings, Activity,
  GitMerge, Zap, Sparkles, type LucideIcon,
} from 'lucide-react';
import { getMessages, type MessageItem } from '@/api/dashboard/workbench';


const MSG_ICON_MAP: Record<string, LucideIcon> = {
  FileCheck2, BarChart3, AlertTriangle, MessageSquare, Settings, Activity,
  GitMerge, Zap, Sparkles,
};
const getMsgIcon = (name: string | null | undefined): LucideIcon => {
  if (!name) return MessageSquare;
  return MSG_ICON_MAP[name] ?? MessageSquare;
};

// API priority 转换 (medium/normal → mid，因为原 mock 用 mid)
const PRIORITY_API_MAP: Record<string, 'low' | 'mid' | 'high'> = {
  low: 'low', medium: 'mid', normal: 'mid', high: 'high',
};

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

// FALLBACK：API 不可达时使用
const FALLBACK_MESSAGES: MessageItem[] = [
  { msg_id: 'm01', sender: '系统管理员', avatar_class: 'system', icon: 'Settings', title: '系统升级通知', summary: 'Mate Platform 已于今日凌晨 02:00 - 04:00 完成 v1.2.0 版本升级，详见发布说明。', time: '10 分钟前', priority: 'high', unread: true, attachments: 2 },
  { msg_id: 'm02', sender: '安全中心', avatar_class: 'system', icon: 'AlertTriangle', title: '安全告警：异常登录行为检测', summary: '检测到非常用 IP 的登录尝试，已自动触发账户保护。', time: '30 分钟前', priority: 'high', unread: true, attachments: 0 },
  { msg_id: 'm03', sender: '工作流引擎', avatar_class: 'approval', icon: 'FileCheck2', title: '审批待处理：客户数据集成流程发布', summary: '客户数据集成流程 v2.3 已通过测试，请尽快审批上线。', time: '1 小时前', priority: 'medium', unread: true, attachments: 1 },
  { msg_id: 'm04', sender: 'IAM 服务', avatar_class: 'system', icon: 'Activity', title: '新设备登录提醒', summary: '检测到您的账户在新设备登录，如非本人操作请立即修改密码。', time: '2 小时前', priority: 'high', unread: true, attachments: 0 },
  { msg_id: 'm05', sender: 'Agent 运行时', avatar_class: 'task', icon: 'Zap', title: '数据质量巡检任务完成', summary: '巡检员完成今日全量数据表检查，输出 3 项异常与修复建议。', time: '3 小时前', priority: 'medium', unread: true, attachments: 0 },
  { msg_id: 'm06', sender: 'IAM 服务', avatar_class: 'approval', icon: 'FileCheck2', title: '审批待处理：本体引擎权限变更申请', summary: '本体引擎申请新增 3 个 G2 业务对象的写权限，请评估风险。', time: '4 小时前', priority: 'medium', unread: true, attachments: 0 },
  { msg_id: 'm07', sender: '李明', avatar_class: 'collab', icon: 'MessageSquare', title: '本体模型评审邀请', summary: '邀请您参与产品域本体模型 v2.1 的评审会议，明天上午 10 点。', time: '5 小时前', priority: 'low', unread: true, attachments: 0 },
  { msg_id: 'm08', sender: '应用中心', avatar_class: 'approval', icon: 'FileCheck2', title: '审批待处理：供应商管理应用 v3.2 发布', summary: '供应商管理应用 v3.2 已通过灰度测试，建议尽快审核发布。', time: '今天 08:15', priority: 'medium', unread: true, attachments: 0 },
  { msg_id: 'm09', sender: '运维平台', avatar_class: 'system', icon: 'Settings', title: '计划维护通知：Nacos 集群升级', summary: 'Nacos 集群将于今晚 23:00 升级至 3.0.3，预计停机 30 分钟。', time: '昨天 22:00', priority: 'medium', unread: false, attachments: 0 },
  { msg_id: 'm10', sender: '客服小助手', avatar_class: 'task', icon: 'AlertTriangle', title: 'Agent 异常告警：连续响应超时', summary: '客服助手连续 3 次响应超过 5 秒，请检查 LLM Gateway 状态。', time: '昨天 18:30', priority: 'medium', unread: false, attachments: 0 },
  { msg_id: 'm11', sender: '王磊', avatar_class: 'collab', icon: 'GitMerge', title: '架构设计文档已更新', summary: 'architecture/microservices.md 已更新到 v1.3，请查阅。', time: '昨天 14:20', priority: 'low', unread: false, attachments: 0 },
  { msg_id: 'm12', sender: '本体引擎', avatar_class: 'approval', icon: 'FileCheck2', title: '审批已通过：产品域本体模型 v2.0', summary: '产品域本体模型 v2.0 已通过终审，新增 12 个 G2 业务对象。', time: '昨天 11:05', priority: 'low', unread: false, attachments: 0 },
  { msg_id: 'm13', sender: '合同审核员', avatar_class: 'task', icon: 'Zap', title: '合同审核报告生成完毕', summary: '已完成 3 份供应商合同的自动审核，风险摘要报告已推送至审批流。', time: '2 天前', priority: 'low', unread: false, attachments: 4 },
  { msg_id: 'm14', sender: '技术中台', avatar_class: 'collab', icon: 'GitMerge', title: '代码合并通知：TECH-LLMGW 分支合入 main', summary: 'feature/saa-chatmodel 已合入 main，含 SAA ChatModel 适配器。', time: '2 天前', priority: 'low', unread: false, attachments: 0 },
  { msg_id: 'm15', sender: '周杰', avatar_class: 'collab', icon: 'MessageSquare', title: '知识库评论：RAG 检索策略优化建议', summary: '周杰在产品技术文档库中评论了 RAG 检索策略的优化方案。', time: '3 天前', priority: 'low', unread: false, attachments: 0 },
];

const FALLBACK_TIMELINE = [
  { time: '2026-07-22 09:45', text: 'Admin 查看了此通知', user: 'Admin' },
  { time: '2026-07-22 04:12', text: '运维平台 自动确认升级后健康检查通过，所有 17 个微服务状态正常', user: '运维平台' },
  { time: '2026-07-22 02:00', text: '系统管理员 发起 v1.2.0 滚动升级，预计耗时 2 小时', user: '系统管理员' },
];

const FALLBACK_RELATED_LINKS = [
  { icon: FileText, title: 'v1.2.0 升级说明文档', desc: 'docs/001-ARCH/ · 更新于 2026-07-21' },
  { icon: GitBranch, title: 'release/v1.2.0 代码分支', desc: 'GitHub · 47 commits · 12 文件变更' },
  { icon: ClipboardList, title: 'SAA 迁移评估报告', desc: 'docs/005-RD/ · 2026-07-21' },
];

// 简单骨架占位
const SkeletonLine: React.FC<{ width?: string; height?: string; style?: React.CSSProperties }> = ({ width = '100%', height = '14px', style }) => (
  <div
    style={{
      width, height,
      background: 'linear-gradient(90deg, var(--muted) 0%, var(--border) 50%, var(--muted) 100%)',
      backgroundSize: '200% 100%',
      animation: 'workbench-shimmer 1.4s ease-in-out infinite',
      borderRadius: 4, ...style,
    }}
  />
);

export default function MessagesPage() {
  
  // 数据状态
  const [messages, setMessages] = useState<MessageItem[]>(FALLBACK_MESSAGES);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<'api' | 'fallback'>('fallback');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getMessages()
      .then((res) => {
        if (cancelled) return;
        setMessages(res);
        setSource('api');
      })
      .catch(() => {
        if (cancelled) return;
        setSource('fallback');
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  // 派生数据
  const unreadCount = useMemo(() => messages.filter(m => m.unread).length, [messages]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>

      <div style={{ padding: '24px 0', flex: 1, minHeight: 0, overflowY: 'auto' }}>
        <div style={{ marginBottom: 24, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 4 }}>消息</h1>
              <p style={{ fontSize: 14, color: 'var(--muted-foreground)' }}>系统通知和消息提醒（{unreadCount} 条未读）</p>
            </div>
            {source === 'fallback' && !loading && (
              <span title="API 不可达，使用本地兜底数据" style={{ fontSize: 10, padding: '1px 6px', borderRadius: 9999, background: 'var(--warning-subtle)', color: 'var(--warning)' }}>本地数据</span>
            )}
          </div>
          <Button theme="light" type="secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <CheckCheck style={{ width: 14, height: 14 }} />全部已读
          </Button>
        </div>

        {/* Content layout */}
        <div style={{ display: 'flex', gap: 20, height: 'calc(100vh - 180px)' }}>
          {/* Category panel */}
          <div style={{ width: 200, flexShrink: 0 }}>
            <Card style={{ height: '100%', padding: 8, display: 'flex', flexDirection: 'column' }}>
              {/* Quick filters */}
              <div style={{ display: 'flex', gap: 4, padding: '8px 8px 4px', borderBottom: '1px solid var(--border)', marginBottom: 4 }}>
                {[
                  { count: String(unreadCount), label: '未读', active: true },
                  { count: String(messages.filter(m => m.time.includes('今天')).length), label: '今日', active: false },
                  { count: String(messages.filter(m => m.priority === 'high').length), label: '重要', active: false },
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
                  { label: '全部', count: String(messages.length), active: true },
                  { label: '系统通知', count: String(messages.filter(m => m.avatar_class === 'system').length), active: false },
                  { label: '审批通知', count: String(messages.filter(m => m.avatar_class === 'approval').length), active: false },
                  { label: '任务通知', count: String(messages.filter(m => m.avatar_class === 'task').length), active: false },
                  { label: '协作通知', count: String(messages.filter(m => m.avatar_class === 'collab').length), active: false },
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
            </Card>
          </div>

          {/* Message panel */}
          <div style={{ flex: 1, minWidth: 0, overflowY: 'auto' }}>
            <Card style={{ height: '100%', overflowY: 'auto', padding: '0 20px' }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {loading
                  ? Array.from({ length: 8 }).map((_, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 0', borderBottom: '1px solid var(--border)' }}>
                        <SkeletonLine width="36px" height="36px" style={{ borderRadius: '50%' }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                            <SkeletonLine width="30%" height="13px" />
                            <SkeletonLine width="15%" height="12px" />
                          </div>
                          <SkeletonLine width="80%" height="13px" style={{ marginBottom: 6 }} />
                          <SkeletonLine width="50%" height="11px" />
                        </div>
                      </div>
                    ))
                  : messages.length === 0
                    ? <div style={{ padding: 40, color: 'var(--muted-foreground)', fontSize: 13, textAlign: 'center' }}>暂无消息</div>
                    : messages.map((msg) => {
                        const Icon = getMsgIcon(msg.icon);
                        const prioKey = PRIORITY_API_MAP[msg.priority] ?? msg.priority as 'low' | 'mid' | 'high';
                        const prio = priorityMap[prioKey];
                        return (
                          <div key={msg.msg_id} style={{
                            display: 'flex', alignItems: 'flex-start', gap: 12,
                            borderBottom: '1px solid var(--border)', cursor: 'pointer', position: 'relative',
                            padding: '14px 0',
                          }}>
                            <div style={{
                              width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                              flexShrink: 0, fontSize: 13, fontWeight: 600,
                              background: avatarBgMap[msg.avatar_class], color: avatarColorMap[msg.avatar_class],
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
                              <div style={{ fontSize: 12, color: 'var(--muted-foreground)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{msg.summary}</div>
                              {msg.attachments > 0 && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: 'var(--muted-foreground)', opacity: 0.8, marginTop: 4 }}>
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
            </Card>
          </div>

          {/* Detail panel (硬编码详情，作为"系统升级通知"的示例展示) */}
          <div style={{ width: 400, flexShrink: 0, overflowY: 'auto' }}>
            <Card style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <div style={{ paddingBottom: 16, borderBottom: '1px solid var(--border)', marginBottom: 16 }}>
                <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, lineHeight: 1.4 }}>系统升级通知</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--muted-foreground)', flexWrap: 'wrap' }}>
                  <span>系统管理员</span>
                  <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'var(--muted-foreground)' }} />
                  <span>2026-07-22 09:32</span>
                  <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'var(--muted-foreground)' }} />
                  <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 4, fontWeight: 500, background: 'rgba(255,97,102,0.15)', color: 'var(--destructive)' }}>高</span>
                  <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'var(--muted-foreground)' }} />
                  <span>2 个附件</span>
                </div>
              </div>

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
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>时间线</div>
                  <div style={{ display: 'flex', flexDirection: 'column', position: 'relative', paddingLeft: 20 }}>
                    <div style={{ position: 'absolute', left: 5, top: 4, bottom: 4, width: 1, background: 'var(--border)' }} />
                    {FALLBACK_TIMELINE.map((item, i) => (
                      <div key={i} style={{ position: 'relative', paddingBottom: 16 }}>
                        <div style={{
                          position: 'absolute', left: -20, top: 4, width: 11, height: 11, borderRadius: '50%',
                          border: '2px solid var(--border)',
                          borderColor: i === 0 ? '#60a5fa' : 'var(--border)',
                          background: i === 0 ? '#60a5fa' : 'var(--card)',
                        }} />
                        <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginBottom: 2 }}>{item.time}</div>
                        <div style={{ fontSize: 13, color: 'var(--card-foreground)', lineHeight: 1.5 }}><strong>{item.user}</strong> {item.text}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Related links */}
                <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>相关链接</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {FALLBACK_RELATED_LINKS.map((link, i) => {
                      const Icon = link.icon;
                      return (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer' }}>
                          <div style={{ width: 32, height: 32, borderRadius: 4, background: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
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

              <div style={{ display: 'flex', gap: 8, marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)', flexWrap: 'wrap' }}>
                <Button theme="light" type="secondary" style={{ height: 28, padding: '0 10px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <Check style={{ width: 12, height: 12 }} />标记已读
                </Button>
                <Button theme="light" type="secondary" style={{ height: 28, padding: '0 10px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <Reply style={{ width: 12, height: 12 }} />回复
                </Button>
                <Button theme="light" type="secondary" style={{ height: 28, padding: '0 10px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <Forward style={{ width: 12, height: 12 }} />转发
                </Button>
                <Button theme="light" type="secondary" style={{ height: 28, padding: '0 10px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <Archive style={{ width: 12, height: 12 }} />归档
                </Button>
                <Button theme="light" type="secondary" style={{ height: 28, padding: '0 10px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <Trash2 style={{ width: 12, height: 12 }} />删除
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}