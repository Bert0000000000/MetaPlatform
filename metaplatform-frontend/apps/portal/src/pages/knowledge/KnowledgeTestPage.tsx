/**
 * KnowledgeTestPage
 * --------------------------------------------------
 * 知识库模块 → 检索测试 tab
 * 路由：/knowledge/test
 * 用于现场调试 RAG 检索质量（混合检索 / Top-K / Reranker）。
 */
import { useState } from 'react';
import { SubTabs, type SubTabItem } from '@mate/shared';
import { useLocation } from 'react-router-dom';
import { Search, Sparkles, FileText, ChevronRight } from 'lucide-react';

const KB_TABS: SubTabItem[] = [
  { label: '知识库列表', path: '/knowledge' },
  { label: '文档管理', path: '/knowledge/docs' },
  { label: '检索测试', path: '/knowledge/test' },
  { label: '检索配置', path: '/knowledge/config' },
];

// MOCK: 检索结果
const MOCK_RESULTS = [
  {
    score: 0.92,
    kb: '产品技术文档',
    doc: 'API 网关设计文档.pdf',
    chunk: '§3.2 路由策略 · 基于路径前缀的路由分发，支持正则匹配与权重负载均衡...',
    highlights: ['路径前缀', '权重负载均衡', '正则匹配'],
  },
  {
    score: 0.87,
    kb: '运维知识库',
    doc: '微服务部署手册.md',
    chunk: '## 灰度发布 · 通过 Nginx upstream + Consul 健康检查实现金丝雀...',
    highlights: ['灰度发布', '金丝雀', '健康检查'],
  },
  {
    score: 0.81,
    kb: '架构设计文档',
    doc: 'Q3 产品路线图.pptx',
    chunk: 'Slide 14 · API 网关在 9 月完成多租户隔离，10 月对接 Service Mesh...',
    highlights: ['多租户隔离', 'Service Mesh'],
  },
];

export default function KnowledgeTestPage() {
  const location = useLocation();
  const [query, setQuery] = useState('API 网关的路由策略是怎么实现的？');
  const [selectedKB, setSelectedKB] = useState('all');

  return (
    <div>
      <SubTabs items={KB_TABS} activePath={location.pathname} />

      {/* Page Header */}
      <div style={{ marginTop: 24, marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em' }}>检索测试</h1>
        <div style={{ fontSize: 13, color: 'var(--muted-foreground)', marginTop: 4 }}>实时调试 RAG 检索质量，对比不同 Top-K / Reranker / 分块策略下的命中片段</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 16 }}>
        {/* 左侧：查询输入 + 配置 */}
        <div className="v-card" style={{ padding: 18 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Search style={{ width: 14, height: 14, color: 'var(--muted-foreground)' }} />查询输入
          </div>
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            rows={5}
            style={{
              width: '100%', padding: 10, background: 'var(--muted)',
              border: '1px solid var(--border)', borderRadius: 'var(--radius)',
              color: 'var(--foreground)', fontSize: 13, outline: 'none',
              fontFamily: 'var(--font-sans)', resize: 'vertical', boxSizing: 'border-box',
            }}
          />

          <div style={{ fontSize: 13, fontWeight: 600, marginTop: 16, marginBottom: 8 }}>知识库范围</div>
          <select
            value={selectedKB}
            onChange={(e) => setSelectedKB(e.target.value)}
            style={{
              width: '100%', padding: '7px 10px', background: 'var(--muted)',
              border: '1px solid var(--border)', borderRadius: 'var(--radius)',
              color: 'var(--foreground)', fontSize: 13, outline: 'none', cursor: 'pointer',
            }}
          >
            <option value="all">全部知识库</option>
            <option value="kb-product-tech">产品技术文档</option>
            <option value="kb-customer-faq">客户服务 FAQ</option>
            <option value="kb-contract">合同条款库</option>
            <option value="kb-ops">运维知识库</option>
            <option value="kb-arch">架构设计文档</option>
          </select>

          <div style={{ fontSize: 13, fontWeight: 600, marginTop: 16, marginBottom: 8 }}>检索参数</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginBottom: 4 }}>Top-K</div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>10</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginBottom: 4 }}>相似度阈值</div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>0.75</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginBottom: 4 }}>混合检索</div>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--success)' }}>已启用</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginBottom: 4 }}>Reranker</div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>bge-reranker-large</div>
            </div>
          </div>

          <button className="v-btn-primary" style={{ width: '100%', marginTop: 18, justifyContent: 'center' }}>
            <Sparkles style={{ width: 14, height: 14 }} />执行检索
          </button>
        </div>

        {/* 右侧：检索结果 */}
        <div className="v-card" style={{ padding: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>命中片段（{MOCK_RESULTS.length}）</div>
            <div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>耗时 142ms · 命中 3 / 10</div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {MOCK_RESULTS.map((r, i) => (
              <div
                key={i}
                style={{
                  border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                  padding: 12, background: 'var(--muted)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{
                      fontSize: 11, fontFamily: 'var(--font-mono)',
                      color: r.score >= 0.85 ? 'var(--success)' : 'var(--info)',
                      fontWeight: 600,
                    }}>
                      {r.score.toFixed(2)}
                    </span>
                    <ChevronRight style={{ width: 12, height: 12, color: 'var(--muted-foreground)' }} />
                    <FileText style={{ width: 14, height: 14, color: 'var(--muted-foreground)' }} />
                    <span style={{ fontSize: 12, fontWeight: 500 }}>{r.doc}</span>
                    <span className="v-badge v-badge-info" style={{ fontSize: 10 }}>{r.kb}</span>
                  </div>
                </div>
                <div style={{ fontSize: 12, color: 'var(--foreground)', lineHeight: 1.6 }}>
                  {r.chunk.split(/(路径前缀|权重负载均衡|正则匹配|灰度发布|金丝雀|健康检查|多租户隔离|Service Mesh)/g).map((part, idx) => {
                    const isHl = r.highlights.includes(part);
                    return isHl ? (
                      <mark key={idx} style={{ background: 'rgba(98,209,120,0.2)', color: 'var(--success)', padding: '0 2px', borderRadius: 2 }}>{part}</mark>
                    ) : (
                      <span key={idx}>{part}</span>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}