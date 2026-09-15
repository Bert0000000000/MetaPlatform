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
    <div className="mp-flex mp-flex-1 mp-min-h-0 mp-flex-col" >
      <div className="mp-flex-1 mp-overflow-y-auto mp-min-h-0 mp-pb-6" >

        <div className="mp-mt-6 mp-mb-4 mp-flex-center mp-gap-2" >
          <div className="mp-flex-1 mp-relative mp-onto-search-box">
            <Search className="mp-icon-16 mp-text-2 mp-absolute mp-onto-search-icon" />
            <input
              type="text"
              placeholder="搜索名称 / rid / function_ref..."
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              className="mp-w-full mp-onto-input mp-onto-input--search"
            />
          </div>
        </div>

        <Card className="mp-hidden" bodyStyle={{padding: 0}}>
          <div className="mp-justify-between mp-flex-center mp-border mp-py-3 mp-px-5" >
            <h4 className="mp-fw-600 mp-text-md">ActionType 列表</h4>
            <span className="mp-text-sm mp-text-2">{items.length} 个动作类型</span>
          </div>
          {loading ? (
            <div className="mp-text-center mp-p-8 mp-text-body mp-text-2">加载中…</div>
          ) : filtered.length === 0 ? (
            <div className="mp-text-center mp-p-8 mp-text-body mp-text-2">暂无 ActionType</div>
          ) : (
            <table className="mp-w-full mp-onto-table">
              <thead>
                <tr className="mp-bg-fill-0">
                  {['名称', '描述', '作用对象', '参数', '副作用', 'rid'].map((h) => (
                    <th key={h} className="mp-fw-500 mp-text-sm mp-text-2 mp-border mp-py-2 mp-px-4 mp-text-left" >{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((at) => (
                  <tr key={at.rid}>
                    <td className="mp-fw-500 mp-text-body mp-border mp-py-2 mp-px-4" >
                      <span className="mp-inline-flex mp-items-center mp-gap-1" >
                        <Zap className="mp-icon-14 mp-text-2" />{actionDisplayName(at)}
                      </span>
                    </td>
                    <td className="mp-text-sm mp-text-2 mp-border mp-py-2 mp-px-4 mp-onto-col-320">{at.description || '—'}</td>
                    <td className="mp-text-sm mp-border mp-py-2 mp-px-4" >
                      {at.on.length === 0 ? <span className="mp-text-2">—</span> : at.on.map((rid) => (
                        <Tag key={rid} className="mp-mr-1">{otName(rid)}</Tag>
                      ))}
                    </td>
                    <td className="mp-text-sm mp-text-2 mp-border mp-py-2 mp-px-4" >{at.parameters.length}</td>
                    <td className="mp-text-sm mp-text-2 mp-border mp-py-2 mp-px-4" >
                      {at.side_effects.length === 0 ? '—' : at.side_effects.join(', ')}
                    </td>
                    <td className="mp-text-xs mp-text-2 mp-border mp-py-2 mp-px-4 mp-mono" >{at.rid}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card className="mp-hidden mp-mt-4" bodyStyle={{padding: 0}}>
          <div className="mp-justify-between mp-flex-center mp-border mp-py-3 mp-px-5" >
            <h4 className="mp-fw-600 mp-text-md">执行历史</h4>
          </div>
          <div className="mp-text-center mp-p-8 mp-text-body mp-text-2">
            暂无执行记录
            <div className="mp-text-sm mp-mt-1" >
              在概念详情页或 SuperAI 编排中触发 ActionType.apply 后，执行记录将在此展示
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
