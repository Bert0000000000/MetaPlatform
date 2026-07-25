/**
 * KnowledgeDocsPage
 * --------------------------------------------------
 * 知识库模块 → 文档管理 tab
 * 路由：/knowledge/docs
 */
import { SubTabs, type SubTabItem } from '@mate/shared';
import { useLocation } from 'react-router-dom';
import { FileText, FileUp, Clock, Search } from 'lucide-react';

const KB_TABS: SubTabItem[] = [
  { label: '知识库列表', path: '/knowledge' },
  { label: '文档管理', path: '/knowledge/docs' },
  { label: '检索测试', path: '/knowledge/test' },
  { label: '检索配置', path: '/knowledge/config' },
];

// MOCK: 文档列表（与 KnowledgeBasePage 共享同一份 mock 数据；R2 接 TECH-KB 后端）
const DOCS = [
  { name: 'API 网关设计文档.pdf', kb: '产品技术文档', size: '2.4MB', strategy: '按标题+段落', status: '已处理', statusType: 'success', uploadedBy: '张磊', time: '10 分钟前' },
  { name: '客户投诉处理流程.docx', kb: '客户服务 FAQ', size: '890KB', strategy: '按 QA 对', status: '处理中', statusType: 'warning', progress: 45, uploadedBy: '李婷', time: '25 分钟前' },
  { name: 'SLA 服务等级协议.pdf', kb: '合同条款库', size: '1.1MB', strategy: '按条款', status: '已处理', statusType: 'success', uploadedBy: '王刚', time: '1 小时前' },
  { name: '微服务部署手册.md', kb: '运维知识库', size: '156KB', strategy: '按章节', status: '已处理', statusType: 'success', uploadedBy: '陈静', time: '2 小时前' },
  { name: 'Q3 产品路线图.pptx', kb: '架构设计文档', size: '3.8MB', strategy: '按幻灯片', status: '队列中', statusType: 'neutral', uploadedBy: '赵明', time: '3 小时前' },
  { name: '客户成功案例集.docx', kb: '客户服务 FAQ', size: '2.1MB', strategy: '按段落', status: '已处理', statusType: 'success', uploadedBy: '李婷', time: '昨天' },
  { name: '数据合规手册.pdf', kb: '合同条款库', size: '4.2MB', strategy: '按章节', status: '失败', statusType: 'destructive', uploadedBy: '王刚', time: '昨天' },
  { name: 'OnCall 应急响应 SOP.md', kb: '运维知识库', size: '78KB', strategy: '按章节', status: '已处理', statusType: 'success', uploadedBy: '陈静', time: '2 天前' },
];

export default function KnowledgeDocsPage() {
  const location = useLocation();

  return (
    <div>
      <SubTabs items={KB_TABS} activePath={location.pathname} />

      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 24, marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em' }}>文档管理</h1>
          <div style={{ fontSize: 13, color: 'var(--muted-foreground)', marginTop: 4 }}>统一管理所有知识库的源文档，支持批量上传、分块策略、重处理</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="v-btn"><FileUp style={{ width: 16, height: 16 }} />批量上传</button>
          <button className="v-btn-primary">新建文档</button>
        </div>
      </div>

      {/* 搜索 + 过滤 */}
      <div className="v-card" style={{ marginBottom: 16, padding: 14, display: 'flex', gap: 12, alignItems: 'center' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <Search style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: 'var(--muted-foreground)' }} />
          <input
            type="text"
            placeholder="搜索文档名 / 上传人 / 知识库..."
            style={{
              width: '100%', padding: '7px 10px 7px 32px', background: 'var(--muted)',
              border: '1px solid var(--border)', borderRadius: 'var(--radius)',
              color: 'var(--foreground)', fontSize: 13, outline: 'none', fontFamily: 'var(--font-sans)',
            }}
          />
        </div>
        <select
          style={{
            padding: '7px 28px 7px 10px', background: 'var(--muted)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius)', color: 'var(--foreground)', fontSize: 13,
            outline: 'none', appearance: 'none', cursor: 'pointer',
          }}
        >
          <option>全部状态</option>
          <option>已处理</option>
          <option>处理中</option>
          <option>队列中</option>
          <option>失败</option>
        </select>
      </div>

      {/* 文档表格 */}
      <div className="v-card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="v-table">
          <thead>
            <tr>
              <th>文档名</th><th>所属知识库</th><th>大小</th><th>分块策略</th>
              <th>上传人</th><th>上传时间</th><th>状态</th><th>操作</th>
            </tr>
          </thead>
          <tbody>
            {DOCS.map((doc) => (
              <tr key={doc.name}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 4, background: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <FileText style={{ width: 14, height: 14, color: 'var(--muted-foreground)' }} />
                    </div>
                    <div style={{ fontWeight: 500 }}>{doc.name}</div>
                  </div>
                </td>
                <td>{doc.kb}</td>
                <td className="v-meta">{doc.size}</td>
                <td className="v-meta">{doc.strategy}</td>
                <td className="v-meta">{doc.uploadedBy}</td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--muted-foreground)', fontSize: 12 }}>
                    <Clock style={{ width: 12, height: 12 }} />{doc.time}
                  </div>
                </td>
                <td>
                  <span className={`v-badge v-badge-${doc.statusType}`}>{doc.status}</span>
                  {doc.progress !== undefined && (
                    <span className="v-meta" style={{ marginLeft: 8 }}>{doc.progress}%</span>
                  )}
                </td>
                <td>
                  <button style={{ background: 'transparent', border: 'none', color: 'var(--info)', cursor: 'pointer', padding: 4, fontSize: 12 }}>查看</button>
                  <button style={{ background: 'transparent', border: 'none', color: 'var(--muted-foreground)', cursor: 'pointer', padding: 4, fontSize: 12 }}>重处理</button>
                  <button style={{ background: 'transparent', border: 'none', color: 'var(--destructive)', cursor: 'pointer', padding: 4, fontSize: 12 }}>删除</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}