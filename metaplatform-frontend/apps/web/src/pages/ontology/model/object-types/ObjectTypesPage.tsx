import { useState } from 'react';
import { Button } from '@douyinfe/semi-ui';
import { Plus } from 'lucide-react';
import { PageHeader } from '@/components/skeleton';
import OntologyModelingPage from '../../OntologyModelingPage';
import '../../ontology.css';

/**
 * 对象类型工作台（IA2-2 从 ModelingPage 的 object 分支独立成页）：
 * 正式路由 /ontology/model/object-types。
 *
 * <p>原样承载完整建模工作台（OntologyModelingPage：领域树 / 概念表 / 详情 /
 * V2 编辑器 / 相似合并）——只移动不重写。「新建本体」按钮与创建抽屉状态
 * 随本页收编（其他基元页没有真实编辑器，不放创建入口——ADR-0069 §2.4）。
 */
export default function ObjectTypesPage() {
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <>
      <PageHeader
        title="对象类型"
        desc="对象类型的完整建模工作台：领域树、概念表、属性与关系、相似概念合并"
        actions={
          <Button
            theme="solid"
            type="primary"
            icon={<Plus size={15} strokeWidth={1.5} />}
            onClick={() => setCreateOpen(true)}
          >
            新建本体
          </Button>
        }
      />
      <OntologyModelingPage createOpen={createOpen} setCreateOpen={setCreateOpen} />
    </>
  );
}
