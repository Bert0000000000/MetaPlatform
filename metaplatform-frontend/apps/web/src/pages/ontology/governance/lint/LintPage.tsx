import { Link } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { EmptyState, PageHeader } from '@/components/skeleton';
import '../../ontology.css';

/**
 * 模型检查（IA2-6 治理组入口页）：正式路由 /ontology/governance/lint。
 *
 * <p>反模式 lint（god_object / kitchen_sink / misnomer / action_sprawl）的
 * **实现在语义模型**（/ontology/model/validation，IA2-2 迁入）——本页只留入口
 * 链接，不重复实现（设计规格 §7.6）。
 */
export default function LintPage() {
  return (
    <>
      <PageHeader
        title="模型检查"
        desc="反模式检查（god_object / kitchen_sink / misnomer / action_sprawl）"
      />
      <EmptyState
        illustration="no-content"
        title="模型检查在语义模型组"
        desc="反模式检查与模型定义同源，已随 IA2-2 迁往语义模型组的「模型校验」页。"
        actions={
          <Link to="/ontology/model/validation" className="mp-onto-btn mp-onto-btn--lg">
            <span className="mp-inline-flex mp-items-center mp-gap-1">
              <ShieldAlert size={12} />
              前往模型校验
            </span>
          </Link>
        }
      />
    </>
  );
}
