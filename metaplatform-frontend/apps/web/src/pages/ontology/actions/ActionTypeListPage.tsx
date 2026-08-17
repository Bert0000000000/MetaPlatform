// ActionTypeListPage — Action 列表（真实 kernel 数据）。
// GOVERN-12-04 A 路径：完整 ontology 模型编辑器（Action 子页）。
// 数据源：mate-tech-ont v2 kernel GET /ont/v2/action-types。
// 执行历史：kernel 尚无执行记录查询接口，展示空态引导（不再使用 demo seed 假数据）。

import { useEffect, useMemo, useState } from 'react';
import { Card, Tag } from '@douyinfe/semi-ui';
import { Search, Zap } from 'lucide-react';
import {
  listActionTypes, listObjectTypes,
  slugAndVersionOfObjectType,
  type KernelActionType, type KernelObjectType,
} from '@/api/ont/kernel';

// rid 末段 slug → 中文名兜底（后端 title 缺失时）
const SLUG_LABELS: Record<string, string> = {
  'approve-leave': '审批请假',
  'close-ticket': '关闭工单',
  'approve-contract': '审批合同',
  'superai-orchestrate': 'SuperAI 编排调度',
};

export function actionDisplayName(at: Pick<KernelActionType, 'rid' | 'title'>): string {
  if (at.title) return at.title;
  const m = at.rid.match(/act\.([^.]+)\.v\d+$/);
  if (m && SLUG_LABELS[m[1]]) return SLUG_LABELS[m[1]];
  if (m) return m[1];
  return at.rid;
}

export default function ActionTypeListPage() {
  const [items, setItems] = useState<KernelActionType[]>([]);
  const [objectTypes, setObjectTypes] = useState<KernelObjectType[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [ats, ots] = await Promise.all([
          listActionTypes().catch(() => [] as KernelActionType[]),
          listObjectTypes().catch(() => [] as KernelObjectType[]),
        ]);
        if (!active) return;
        setItems(ats);
        setObjectTypes(ots);
      } catch (e) {
        console.warn('ActionType 列表加载失败', e);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const otName = (rid: string) => {
    const ot = objectTypes.find((o) => o.rid === rid);
    if (ot) return ot.display_name || slugAndVersionOfObjectType(rid).slug;
    return rid.split('.').slice(-2, -1)[0] ?? rid;
  };

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    if (!kw) return items;
    return items.filter(
      (at) => at.rid.toLowerCase().includes(kw)
        || (at.title ?? '').toLowerCase().includes(kw)
        || at.function_ref.toLowerCase().includes(kw),
    );
  }, [items, keyword]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', paddingBottom: 24 }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 24, marginBottom: 16 }}>
          <div style={{ flex: 1, maxWidth: 320, position: 'relative' }}>
            <Search style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 16, height: 16, color: 'var(--muted-foreground)' }} />
            <input
              type="text"
              placeholder="搜索名称 / rid / function_ref..."
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              style={{ width: '100%', height: 34, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '0 12px 0 34px', fontSize: 13, color: 'var(--foreground)', outline: 'none' }}
            />
          </div>
        </div>

        <Card style={{overflow: 'hidden'}} bodyStyle={{padding: 0}}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h4 style={{ fontSize: 14, fontWeight: 600 }}>ActionType 列表</h4>
            <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>{items.length} 个动作类型</span>
          </div>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 13 }}>加载中…</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 13 }}>暂无 ActionType</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--muted)' }}>
                  {['名称', '描述', '作用对象', '参数', '副作用', 'rid'].map((h) => (
                    <th key={h} style={{ padding: '10px 16px', fontSize: 12, fontWeight: 500, color: 'var(--muted-foreground)', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((at) => (
                  <tr key={at.rid}>
                    <td style={{ padding: '10px 16px', fontSize: 13, fontWeight: 500, borderBottom: '1px solid var(--border)' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <Zap style={{ width: 14, height: 14, color: 'var(--muted-foreground)' }} />{actionDisplayName(at)}
                      </span>
                    </td>
                    <td style={{ padding: '10px 16px', fontSize: 12, color: 'var(--muted-foreground)', borderBottom: '1px solid var(--border)', maxWidth: 320 }}>{at.description || '—'}</td>
                    <td style={{ padding: '10px 16px', fontSize: 12, borderBottom: '1px solid var(--border)' }}>
                      {at.on.length === 0 ? <span style={{ color: 'var(--muted-foreground)' }}>—</span> : at.on.map((rid) => (
                        <Tag key={rid} style={{ marginRight: 4 }}>{otName(rid)}</Tag>
                      ))}
                    </td>
                    <td style={{ padding: '10px 16px', fontSize: 12, color: 'var(--muted-foreground)', borderBottom: '1px solid var(--border)' }}>{at.parameters.length}</td>
                    <td style={{ padding: '10px 16px', fontSize: 12, color: 'var(--muted-foreground)', borderBottom: '1px solid var(--border)' }}>
                      {at.side_effects.length === 0 ? '—' : at.side_effects.join(', ')}
                    </td>
                    <td style={{ padding: '10px 16px', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--muted-foreground)', borderBottom: '1px solid var(--border)' }}>{at.rid}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card style={{overflow: 'hidden', marginTop: 16}} bodyStyle={{padding: 0}}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
            <h4 style={{ fontSize: 14, fontWeight: 600 }}>执行历史</h4>
          </div>
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 13 }}>
            暂无执行记录
            <div style={{ fontSize: 12, marginTop: 6 }}>
              在概念详情页或 SuperAI 编排中触发 ActionType.apply 后，执行记录将在此展示
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
