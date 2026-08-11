// RelationshipTypeListPage — 关系（LinkType）列表。
// GOVERN-12-04 A 路径：完整 ontology 模型编辑器（关系子页）。
// 数据源：mate-tech-ont v2 kernel GET /ont/v2/link-types。

import { useEffect, useMemo, useState } from 'react';
import { Search, GitBranch } from 'lucide-react';
import { listLinkTypes, type KernelLinkType } from '@/api/ont/kernel';

export default function RelationshipTypeListPage() {
  const [items, setItems] = useState<KernelLinkType[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const lts = await listLinkTypes();
        if (!active) return;
        setItems(lts);
      } catch (e) {
        console.warn('LinkType 列表加载失败', e);
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
      (lt) => lt.rid.toLowerCase().includes(kw) || lt.src.toLowerCase().includes(kw) || lt.dst.toLowerCase().includes(kw),
    );
  }, [items, keyword]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', paddingBottom: 24 }}>
        <div style={{ marginTop: 24, marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em' }}>关系模型</h1>
          <div style={{ fontSize: 13, color: 'var(--muted-foreground)', marginTop: 4 }}>
            管理 Ontology 中的 LinkType（概念间关系）
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <div style={{ flex: 1, maxWidth: 320, position: 'relative' }}>
            <Search style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 16, height: 16, color: 'var(--muted-foreground)' }} />
            <input
              type="text"
              placeholder="搜索 rid / src / dst..."
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              style={{ width: '100%', height: 34, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '0 12px 0 34px', fontSize: 13, color: 'var(--foreground)', outline: 'none' }}
            />
          </div>
        </div>

        <div className="v-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
            <h4 style={{ fontSize: 14, fontWeight: 600 }}>LinkType 列表</h4>
          </div>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 13 }}>加载中…</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 13 }}>暂无 LinkType</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--muted)' }}>
                  <th style={{ padding: '10px 16px', fontSize: 12, fontWeight: 500, color: 'var(--muted-foreground)', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>rid</th>
                  <th style={{ padding: '10px 16px', fontSize: 12, fontWeight: 500, color: 'var(--muted-foreground)', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>src</th>
                  <th style={{ padding: '10px 16px', fontSize: 12, fontWeight: 500, color: 'var(--muted-foreground)', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>dst</th>
                  <th style={{ padding: '10px 16px', fontSize: 12, fontWeight: 500, color: 'var(--muted-foreground)', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>cardinality</th>
                  <th style={{ padding: '10px 16px', fontSize: 12, fontWeight: 500, color: 'var(--muted-foreground)', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>directionality</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((lt) => (
                  <tr key={lt.rid}>
                    <td style={{ padding: '10px 16px', fontSize: 13, fontWeight: 500, borderBottom: '1px solid var(--border)' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <GitBranch style={{ width: 14, height: 14, color: 'var(--muted-foreground)' }} />{lt.rid}
                      </span>
                    </td>
                    <td style={{ padding: '10px 16px', fontSize: 13, color: 'var(--muted-foreground)', borderBottom: '1px solid var(--border)' }}>{lt.src}</td>
                    <td style={{ padding: '10px 16px', fontSize: 13, color: 'var(--muted-foreground)', borderBottom: '1px solid var(--border)' }}>{lt.dst}</td>
                    <td style={{ padding: '10px 16px', fontSize: 13, borderBottom: '1px solid var(--border)' }}>{lt.cardinality}</td>
                    <td style={{ padding: '10px 16px', fontSize: 13, borderBottom: '1px solid var(--border)' }}>{lt.directionality}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
