import {
  ChevronDown, Upload, RefreshCw, Plus, TrendingUp, HardDrive,
  Library, BookOpen, MessageCircle, FileText, Server, Blocks,
  Code, GraduationCap, BarChart3, Search, Settings, MoreHorizontal,
  FileUp,
} from 'lucide-react';
import { SubTabs, type SubTabItem } from '@mate/shared';
import { useLocation } from 'react-router-dom';
import { MOCK_KNOWLEDGE_BASES } from '@/mock'; // MOCK

// MOCK: 知识库图标映射
const KB_ICONS: Record<string, typeof BookOpen> = {
  '产品技术文档': BookOpen,
  '客户服务 FAQ': MessageCircle,
  '合同条款库': FileText,
  '运维知识库': Server,
  '架构设计文档': Blocks,
  'API 参考手册': Code,
  '培训材料': GraduationCap,
  '竞品分析报告': BarChart3,
};

// MOCK: 状态映射
const STATUS_MAP: Record<string, { text: string; type: string }> = {
  indexed: { text: '已索引', type: 'success' },
  indexing: { text: '索引中', type: 'warning' },
  partial: { text: '部分索引', type: 'info' },
};

// MOCK: 检索配置
const CONFIG_ITEMS = [
  { label: '混合检索', value: '已启用', toggle: true },
  { label: 'Top-K', value: '10' },
  { label: '相似度阈值', value: '0.75' },
  { label: 'Reranker', value: 'bge-reranker-large' },
  { label: '显示引用来源', value: '已启用', toggle: true },
  { label: '分块最大长度', value: '512 tokens' },
];

// MOCK: 最近上传文档
const RECENT_DOCS = [
  { name: 'API网关设计文档.pdf', kb: '产品技术文档', size: '2.4MB', strategy: '按标题+段落', status: '已处理', statusType: 'success', time: '10分钟前' },
  { name: '客户投诉处理流程.docx', kb: '客户服务 FAQ', size: '890KB', strategy: '按 QA 对', status: '处理中', statusType: 'warning', progress: 45, time: '25分钟前' },
  { name: 'SLA服务等级协议.pdf', kb: '合同条款库', size: '1.1MB', strategy: '按条款', status: '已处理', statusType: 'success', time: '1小时前' },
  { name: '微服务部署手册.md', kb: '运维知识库', size: '156KB', strategy: '按章节', status: '已处理', statusType: 'success', time: '2小时前' },
  { name: 'Q3产品路线图.pptx', kb: '架构设计文档', size: '3.8MB', strategy: '按幻灯片', status: '队列中', statusType: 'neutral', time: '3小时前' },
];

const KB_TABS: SubTabItem[] = [
  { label: '知识库列表', path: '/knowledge' },
  { label: '文档管理', path: '/knowledge/docs' },
  { label: '检索测试', path: '/knowledge/test' },
  { label: '检索配置', path: '/knowledge/config' },
];

export default function KnowledgeBasePage() {
  const location = useLocation();

  return (
    <div>
      <SubTabs items={KB_TABS} activePath={location.pathname} />

      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 24, marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em' }}>知识库</h1>
          <div style={{ fontSize: 13, color: 'var(--muted-foreground)', marginTop: 4 }}>企业级 RAG 知识库管理，统一文档索引与语义检索</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="v-btn" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(98,209,120,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, color: 'var(--success)' }}>AI</div>
            <span style={{ fontSize: 13 }}>AI 助手</span>
            <ChevronDown style={{ width: 14, height: 14, color: 'var(--muted-foreground)' }} />
          </button>
          <button className="v-btn"><Upload style={{ width: 16, height: 16 }} />批量导入</button>
          <button className="v-btn"><RefreshCw style={{ width: 16, height: 16 }} />重建索引</button>
          <button className="v-btn-primary"><Plus style={{ width: 16, height: 16 }} />新建知识库</button>
        </div>
      </div>

      {/* 统计概览 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        <div className="v-card">
          <div className="v-eyebrow">知识库总数</div>
          <div className="v-value" style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 4 }}>12</div>
          <div style={{ fontSize: 12, color: 'var(--success)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}><TrendingUp style={{ width: 14, height: 14 }} />较上月 +2</div>
        </div>
        <div className="v-card">
          <div className="v-eyebrow">文档总数</div>
          <div className="v-value" style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 4 }}>2,847</div>
          <div style={{ fontSize: 12, color: 'var(--success)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}><TrendingUp style={{ width: 14, height: 14 }} />本周新增 126</div>
        </div>
        <div className="v-card">
          <div className="v-eyebrow">向量索引大小</div>
          <div className="v-value" style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 4 }}>1.2GB</div>
          <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}><HardDrive style={{ width: 14, height: 14 }} />Milvus 2.5</div>
        </div>
        <div className="v-card">
          <div className="v-eyebrow">检索准确率</div>
          <div className="v-value" style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 4 }}>98.6%</div>
          <div style={{ fontSize: 12, color: 'var(--success)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}><TrendingUp style={{ width: 14, height: 14 }} />+0.3% vs 上周</div>
        </div>
      </div>

      {/* 知识库列表 */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Library style={{ width: 18, height: 18, color: 'var(--muted-foreground)' }} />知识库列表
        </div>
        <table className="v-table">
          <thead>
            <tr>
              <th>知识库名称</th><th>文档数</th><th>向量维度</th><th>Embedding 模型</th><th>索引状态</th><th>更新时间</th><th>操作</th>
            </tr>
          </thead>
          <tbody>
            {MOCK_KNOWLEDGE_BASES.map((kb) => {
              const Icon = KB_ICONS[kb.name] || BookOpen;
              const status = STATUS_MAP[kb.status];
              return (
                <tr key={kb.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 28, height: 28, borderRadius: 4, background: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Icon style={{ width: 14, height: 14, color: 'var(--muted-foreground)' }} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 500 }}>{kb.name}</div>
                        <div className="v-meta">{kb.desc}</div>
                      </div>
                    </div>
                  </td>
                  <td>{kb.docs}</td>
                  <td>{kb.dim}</td>
                  <td>{kb.model}</td>
                  <td>
                    <span className={`v-badge v-badge-${status.type}`}>{status.text}</span>
                    {kb.status === 'indexing' && (
                      <>
                        <div style={{ width: 80, height: 4, borderRadius: 2, background: 'var(--border)', overflow: 'hidden', display: 'inline-block', verticalAlign: 'middle', marginLeft: 8 }}>
                          <div style={{ height: '100%', borderRadius: 2, width: `${kb.progress}%`, background: 'var(--warning)' }} />
                        </div>
                        <span className="v-meta" style={{ marginLeft: 4 }}>{kb.progress}%</span>
                      </>
                    )}
                    {kb.status === 'partial' && (
                      <>
                        <div style={{ width: 80, height: 4, borderRadius: 2, background: 'var(--border)', overflow: 'hidden', display: 'inline-block', verticalAlign: 'middle', marginLeft: 8 }}>
                          <div style={{ height: '100%', borderRadius: 2, width: `${kb.progress}%`, background: '#60a5fa' }} />
                        </div>
                        <span className="v-meta" style={{ marginLeft: 4 }}>{kb.progress}%</span>
                      </>
                    )}
                  </td>
                  <td className="v-meta">{kb.updatedAt}</td>
                  <td>
                    <button style={{ background: 'transparent', border: 'none', color: 'var(--muted-foreground)', cursor: 'pointer', padding: 4, borderRadius: 4, display: 'inline-flex', alignItems: 'center' }}><Search style={{ width: 16, height: 16 }} /></button>
                    <button style={{ background: 'transparent', border: 'none', color: 'var(--muted-foreground)', cursor: 'pointer', padding: 4, borderRadius: 4, display: 'inline-flex', alignItems: 'center' }}><Settings style={{ width: 16, height: 16 }} /></button>
                    <button style={{ background: 'transparent', border: 'none', color: 'var(--muted-foreground)', cursor: 'pointer', padding: 4, borderRadius: 4, display: 'inline-flex', alignItems: 'center' }}><MoreHorizontal style={{ width: 16, height: 16 }} /></button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 检索配置 */}
      <div style={{ marginBottom: 24 }}>
        <div className="v-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em' }}>检索策略配置</h3>
            <button className="v-btn"><Settings style={{ width: 16, height: 16 }} />高级设置</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {CONFIG_ITEMS.map((item) => (
              <div key={item.label} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>{item.label}</div>
                <div style={{ fontSize: 14, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8 }}>
                  {item.toggle ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 36, height: 20, borderRadius: 10, background: 'var(--success)', position: 'relative', display: 'inline-block', flexShrink: 0 }}>
                        <div style={{ position: 'absolute', width: 14, height: 14, borderRadius: '50%', background: '#fff', top: 3, right: 3 }} />
                      </div>
                      <span>{item.value}</span>
                    </div>
                  ) : (
                    <span>{item.value}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 最近上传文档 */}
      <div>
        <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <FileUp style={{ width: 18, height: 18, color: 'var(--muted-foreground)' }} />最近上传文档
        </div>
        <table className="v-table">
          <thead>
            <tr>
              <th>文档名</th><th>知识库</th><th>大小</th><th>分块策略</th><th>状态</th><th>上传时间</th>
            </tr>
          </thead>
          <tbody>
            {RECENT_DOCS.map((doc) => (
              <tr key={doc.name}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 4, background: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <FileText style={{ width: 14, height: 14, color: 'var(--muted-foreground)' }} />
                    </div>
                    {doc.name}
                  </div>
                </td>
                <td>{doc.kb}</td>
                <td>{doc.size}</td>
                <td>{doc.strategy}</td>
                <td>
                  <span className={`v-badge v-badge-${doc.statusType}`}>{doc.status}</span>
                  {doc.progress !== undefined && (
                    <>
                      <div style={{ width: 80, height: 4, borderRadius: 2, background: 'var(--border)', overflow: 'hidden', display: 'inline-block', verticalAlign: 'middle', marginLeft: 8 }}>
                        <div style={{ height: '100%', borderRadius: 2, width: `${doc.progress}%`, background: 'var(--warning)' }} />
                      </div>
                      <span className="v-meta" style={{ marginLeft: 4 }}>{doc.progress}%</span>
                    </>
                  )}
                </td>
                <td className="v-meta">{doc.time}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
