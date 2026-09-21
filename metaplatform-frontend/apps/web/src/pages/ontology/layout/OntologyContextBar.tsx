import { Button } from '@douyinfe/semi-ui';
import { Search } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useShell } from '@/components/shell/ShellContext';
import { resolveOntologyNav } from '../navigation';

/**
 * 本体工作区上下文条（设计规格 §5.1）：当前功能域位置 ∥ 搜索入口。
 *
 * <p>IA2-1 边界（诚实登记，不做假功能）：
 * <ul>
 *   <li>本体名称 / Release 徽标：等本体元数据 API 可用时接入；</li>
 *   <li>「创建资源」下拉：只允许打开**已有真实编辑器**的项——对象类型的创建
 *       目前在建模工作台内部，跨页触发创建信号随 IA2-2 对象类型页收编时提供，
 *       本批不做「看起来能点其实进不去」的按钮。</li>
 * </ul>
 */
export default function OntologyContextBar() {
  const { setCommandOpen } = useShell();
  const { pathname } = useLocation();
  const match = resolveOntologyNav(pathname);

  return (
    <header className="mp-onto-contextbar">
      <div className="mp-onto-contextbar-crumb" aria-current="page">
        {match ? [match.group.label, match.item?.label].filter(Boolean).join(' / ') : '本体'}
      </div>
      <div className="mp-onto-contextbar-actions">
        <Button
          size="small"
          theme="borderless"
          type="tertiary"
          icon={<Search size={14} strokeWidth={1.5} />}
          onClick={() => setCommandOpen(true)}
        >
          搜索
        </Button>
      </div>
    </header>
  );
}
