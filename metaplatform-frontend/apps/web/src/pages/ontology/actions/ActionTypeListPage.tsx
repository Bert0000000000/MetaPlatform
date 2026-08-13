// ActionTypeListPage — Action 列表 + 执行历史（demo seed）。
// GOVERN-12-04 A 路径：完整 ontology 模型编辑器（Action 子页）。
// 数据源：mate-tech-ont v2 kernel GET /ont/v2/action-types + 本地 SEED_EXECUTION_HISTORY。

import { useEffect, useMemo, useState } from 'react';
import { Card } from '@douyinfe/semi-ui';
import { Search, Zap, Clock } from 'lucide-react';
import { listActionTypes, type KernelActionType } from '@/api/ont/kernel';
import { SEED_EXECUTION_HISTORY, type SeedExecution } from '@/pages/ontology/actions/executionHistory';

export default function ActionTypeListPage() {
  const [items, setItems] = useState<KernelActionType[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState('');
  const history = SEED_EXECUTION_HISTORY;

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const ats = await listActionTypes();
        if (!active) return;
        setItems(ats);
      } catch (e) {
        console.warn('ActionType 列表加载失败', e);
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
      (at) => at.rid.toLowerCase().includes(kw) || at.function_ref.toLowerCase().includes(kw),
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
              placeholder="搜索 rid / function_ref..."
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              style={{ width: '100%', height: 34, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '0 12px 0 34px', fontSize: 13, color: 'var(--foreground)', outline: 'none' }}
            />
          </div>
        </div>

        <Card style={{ padding: 0, overflow: 'hidden', marginBottom: 16 }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
            <h4 style={{ fontSize: 14, fontWeight: 600 }}>ActionType 列表</h4>
          </div>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 13 }}>加载中…</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 13 }}>暂无 ActionType</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--muted)' }}>
                  <th style={{ padding: '10px 16px', fontSize: 12, fontWeight: 500, color: 'var(--muted-foreground)', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>rid</th>
                  <th style={{ padding: '10px 16px', fontSize: 12, fontWeight: 500, color: 'var(--muted-foreground)', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>function_ref</th>
                  <th style={{ padding: '10px 16px', fontSize: 12, fontWeight: 500, color: 'var(--muted-foreground)', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>on</th>
                  <th style={{ padding: '10px 16px', fontSize: 12, fontWeight: 500, color: 'var(--muted-foreground)', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>side_effects</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((at) => (
                  <tr key={at.rid}>
                    <td style={{ padding: '10px 16px', fontSize: 13, fontWeight: 500, borderBottom: '1px solid var(--border)' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <Zap style={{ width: 14, height: 14, color: 'var(--muted-foreground)' }} />{at.rid}
                      </span>
                    </td>
                    <td style={{ padding: '10px 16px', fontSize: 12, color: 'var(--muted-foreground)', borderBottom: '1px solid var(--border)' }}>{at.function_ref}</td>
                    <td style={{ padding: '10px 16px', fontSize: 12, color: 'var(--muted-foreground)', borderBottom: '1px solid var(--border)' }}>{at.on.join(', ')}</td>
                    <td style={{ padding: '10px 16px', fontSize: 12, color: 'var(--muted-foreground)', borderBottom: '1px solid var(--border)' }}>{at.side_effects.join(', ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
            <h4 style={{ fontSize: 14, fontWeight: 600 }}>执行历史</h4>
            <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>最近 {history.length} 条</span>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--muted)' }}>
                <th style={{ padding: '10px 16px', fontSize: 12, fontWeight: 500, color: 'var(--muted-foreground)', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>时间</th>
                <th style={{ padding: '10px 16px', fontSize: 12, fontWeight: 500, color: 'var(--muted-foreground)', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>触发器</th>
                <th style={{ padding: '10px 16px', fontSize: 12, fontWeight: 500, color: 'var(--muted-foreground)', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>输入</th>
                <th style={{ padding: '10px 16px', fontSize: 12, fontWeight: 500, color: 'var(--muted-foreground)', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>输出</th>
                <th style={{ padding: '10px 16px', fontSize: 12, fontWeight: 500, color: 'var(--muted-foreground)', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>耗时</th>
                <th style={{ padding: '10px 16px', fontSize: 12, fontWeight: 500, color: 'var(--muted-foreground)', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>状态</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h, idx) => (
                <tr key={`${h.time}-${idx}`}>
                  <td style={{ padding: '10px 16px', fontSize: 12, color: 'var(--muted-foreground)', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <Clock style={{ width: 12, height: 12 }} />{h.time}
                    </span>
                  </td>
                  <td style={{ padding: '10px 16px', fontSize: 13, borderBottom: '1px solid var(--border)' }}>{h.trigger}</td>
                  <td style={{ padding: '10px 16px', fontSize: 12, color: 'var(--muted-foreground)', borderBottom: '1px solid var(--border)' }}>{h.input}</td>
                  <td style={{ padding: '10px 16px', fontSize: 12, color: 'var(--muted-foreground)', borderBottom: '1px solid var(--border)' }}>{h.output}</td>
                  <td style={{ padding: '10px 16px', fontSize: 12, color: 'var(--muted-foreground)', borderBottom: '1px solid var(--border)' }}>{h.duration}</td>
                  <td style={{ padding: '10px 16px', fontSize: 12, borderBottom: '1px solid var(--border)', color: h.status === 'success' ? 'var(--success)' : 'var(--destructive)' }}>{h.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}
