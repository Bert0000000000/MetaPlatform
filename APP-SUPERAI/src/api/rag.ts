import { get, post } from './client';
import type { KnowledgeBase, RagSearchResult } from '@/types';

const STORAGE_KEY = 'app_superai_kbs';

const MOCK_KBS: KnowledgeBase[] = [
  { id: 'kb-platform', name: '平台架构知识库', description: 'Mate Platform 架构与技术选型文档', documentCount: 15, status: 'active' },
  { id: 'kb-ontology', name: '本体论引擎知识库', description: 'OWL、RDF、Cypher 相关文档', documentCount: 8, status: 'active' },
  { id: 'kb-rag', name: 'RAG 检索知识库', description: '检索增强生成相关论文与实践', documentCount: 12, status: 'active' },
  { id: 'kb-workflow', name: '工作流知识库', description: 'BPMN、审批流、Agent 编排文档', documentCount: 6, status: 'building' },
];

function loadKbs(): KnowledgeBase[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(MOCK_KBS));
    return MOCK_KBS;
  }
  try {
    return JSON.parse(raw) as KnowledgeBase[];
  } catch {
    return MOCK_KBS;
  }
}

export async function listKnowledgeBases(): Promise<KnowledgeBase[]> {
  try {
    return await get<KnowledgeBase[]>('/v1/rag/knowledge-bases');
  } catch {
    return loadKbs();
  }
}

export async function search(
  query: string,
  knowledgeBaseIds?: string[],
): Promise<RagSearchResult[]> {
  try {
    return await post<RagSearchResult[]>('/v1/rag/search', { query, knowledgeBaseIds });
  } catch {
    return mockSearch(query, knowledgeBaseIds);
  }
}

function mockSearch(query: string, knowledgeBaseIds?: string[]): RagSearchResult[] {
  const kbs = loadKbs();
  const targetKbs = knowledgeBaseIds && knowledgeBaseIds.length > 0
    ? kbs.filter((kb) => knowledgeBaseIds.includes(kb.id))
    : kbs;

  const results: RagSearchResult[] = [];
  const queryLower = query.toLowerCase();

  const mockDocs: Record<string, Array<{ title: string; content: string; source: string; type: string }>> = {
    'kb-platform': [
      { title: 'Mate Platform 总览', content: 'Mate Platform 是基于 Ontology 本体论引擎的企业级决策与运营提效平台。', source: 'docs/README.md', type: 'DOC' },
      { title: '应用架构设计', content: '平台采用分层架构：应用层、技术服务层、基础设施层。AI 能力作为 Substrate 贯穿所有模块。', source: 'docs/001-ARCH/', type: 'PDF' },
    ],
    'kb-ontology': [
      { title: 'OWL 本体论调研', content: 'OWL（Web Ontology Language）是 W3C 标准的本体描述语言，支持丰富的语义表达。', source: 'docs/005-RD/', type: 'DOC' },
      { title: 'Cypher 查询入门', content: 'Cypher 是 Neo4j 图数据库的声明式查询语言，使用模式匹配进行图遍历。', source: 'neo4j-docs', type: 'DOC' },
    ],
    'kb-rag': [
      { title: 'RAG 检索增强生成', content: 'RAG 通过检索相关文档并注入上下文，提升 LLM 回答的准确性和可溯源性。', source: 'rag-paper', type: 'PDF' },
      { title: '混合检索策略', content: '混合检索结合向量检索和关键词检索，兼顾语义相似性和精确匹配。', source: 'rag-practice', type: 'DOC' },
    ],
    'kb-workflow': [
      { title: 'BPMN 2.0 规范', content: 'BPMN 2.0 是业务流程建模标注标准，定义了开始、结束、网关、任务等节点类型。', source: 'bpmn-spec', type: 'PDF' },
    ],
  };

  for (const kb of targetKbs) {
    const docs = mockDocs[kb.id] || [];
    for (const doc of docs) {
      const score = Math.round(70 + Math.random() * 30);
      const snippet = doc.content;
      if (queryLower === '' || doc.title.toLowerCase().includes(queryLower) || doc.content.toLowerCase().includes(queryLower)) {
        results.push({
          id: `${kb.id}-${doc.title}`,
          title: doc.title,
          content: doc.content,
          score,
          source: doc.source,
          type: doc.type,
          snippet,
        });
      }
    }
  }

  if (results.length === 0) {
    for (const kb of targetKbs.slice(0, 2)) {
      const docs = mockDocs[kb.id] || [];
      for (const doc of docs) {
        results.push({
          id: `${kb.id}-${doc.title}`,
          title: doc.title,
          content: doc.content,
          score: Math.round(60 + Math.random() * 20),
          source: doc.source,
          type: doc.type,
          snippet: doc.content.slice(0, 100) + '...',
        });
      }
    }
  }

  return results.sort((a, b) => b.score - a.score).slice(0, 5);
}
