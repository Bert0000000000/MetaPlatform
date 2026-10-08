import { PageHeader } from '@/components/skeleton';
import BackingDatasourcePanel from './BackingDatasourcePanel';
import '../data-sections.css';
import '../../ontology.css';

/** Real source declaration, property mapping and a separate materialization read. */
export default function ObjectMappingsPage() {
  return (
    <>
      <PageHeader
        title="对象映射"
        desc="来源声明 → 本体属性 → 物化样本，编辑并保存真实映射"
      />
      <BackingDatasourcePanel />
    </>
  );
}
