// ObjectTypeListPage — 概念（ObjectType）列表 + 新建 + 跳详情。
// GOVERN-12-04 A 路径：完整 ontology 模型编辑器（List 子页）。
// 数据源：mate-tech-ont v2 kernel GET /ont/v2/object-types。

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, Hexagon, Columns3 } from 'lucide-react';
import { listObjectTypes, type KernelObjectType, domainOfObjectType } from '@/api/ont/kernel';

const DOMAIN_LABELS: Record<string, string> = {
  crm: '客户关系',
  scm: '供应链',
  fin: '财务核算',
  org: '组织人力',
  hr: '人力资源',
};

export default function ObjectTypeListPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<KernelObjectType[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const ots = await listObjectTypes();
        if (!active) return;
        setItems(ots);
      } catch (e) {
        console.warn('ObjectType 列表加载失败', e);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    if (!kw) return items;
    return items.filter(
      (ot) =>
        ot.display_name.toLowerCase().includes(kw) ||
        ot.rid.toLowerCase().includes(kw),
    );
  }, [items, keyword]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', paddingBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginTop: 24, marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em' }}>概念模型</h1>
            <div style={{ fontSize: 13, color: 'var(--muted-foreground)', marginTop: 4 }}>
              管理 Ontology 中的 ObjectType（业务概念）
            </div>
          </div>
          <button className="v-btn-primary" onClick={() => navigate('/ontology/object-types/new')}>
            <Plus style={{ width: 16, height: 16 }} />新建概念
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <div style={{ flex: 1, maxWidth: 320, position: 'relative' }}>
            <Search style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 16, height: 16, color: 'var(--muted-foreground)' }} />
            <input
              type="text"
              placeholder="搜索概念名称 / rid..."
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              style={{ width: '100%', height: 34, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '0 12px 0 34px', fontSize: 13, color: 'var(--foreground)', outline: 'none' }}
            />
          </div>
        </div>

        <div className="v-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
            <h4 style={{ fontSize: 14, fontWeight: 600 }}>ObjectType 列表</h4>
          </div>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 13 }}>加载中…</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 13 }}>暂无 ObjectType</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--muted)' }}>
                  <th style={{ padding: '10px 16px', fontSize: 12, fontWeight: 500, color: 'var(--muted-foreground)', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>显示名</th>
                  <th style={{ padding: '10px 16px', fontSize: 12, fontWeight: 500, color: 'var(--muted-foreground)', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>rid</th>
                  <th style={{ padding: '10px 16px', fontSize: 12, fontWeight: 500, color: 'var(--muted-foreground)', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>领域</th>
                  <th style={{ padding: '10px 16px', fontSize: 12, fontWeight: 500, color: 'var(--muted-foreground)', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>属性数</th>
                  <th style={{ padding: '10px 16px', fontSize: 12, fontWeight: 500, color: 'var(--muted-foreground)', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((ot) => {
                  const domain = domainOfObjectType(ot.rid);
                  return (
                    <tr
                      key={ot.rid}
                      onClick={() => navigate(`/ontology/object-types/${encodeURIComponent(ot.rid)}`)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td style={{ padding: '10px 16px', fontSize: 13, borderBottom: '1px solid var(--border)' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <Hexagon style={{ width: 14, height: 14, color: 'var(--muted-foreground)' }} />
                          <span style={{ fontWeight: 500 }}>{ot.display_name}</span>
                        </span>
                      </td>
                      <td style={{ padding: '10px 16px', fontSize: 12, color: 'var(--muted-foreground)', borderBottom: '1px solid var(--border)' }}>{ot.rid}</td>
                      <td style={{ padding: '10px 16px', fontSize: 13, borderBottom: '1px solid var(--border)' }}>{DOMAIN_LABELS[domain] ?? domain}</td>
                      <td style={{ padding: '10px 16px', fontSize: 13, borderBottom: '1px solid var(--border)' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--muted-foreground)' }}>
                          <Columns3 style={{ width: 14, height: 14 }} />{ot.properties.length}
                        </span>
                      </td>
                      <td style={{ padding: '10px 16px', fontSize: 13, borderBottom: '1px solid var(--border)' }}>
                        <button
                          className="v-btn"
                          style={{ height: 28, padding: '0 10px', fontSize: 12 }}
                          onClick={(e) => { e.stopPropagation(); navigate(`/ontology/object-types/${encodeURIComponent(ot.rid)}`); }}
                        >
                          查看
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
