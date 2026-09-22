import { PageHeader } from '@/components/skeleton';
import BackingDatasourcePanel from './BackingDatasourcePanel';
import '../data-sections.css';
import '../../ontology.css';

/**
 * 对象映射（IA2-3 从 DatacenterPage 的 ingest 分支独立成页）：
 * 正式路由 /ontology/data/mappings。
 *
 * <p>承载背挂数据源声明（DATA-14/15）——「某个对象类型的数据从哪张表来」：
 * 声明数据源 + 字段映射（属性 → 列）+ 手动触发同步。只移动不重写。
 */
export default function ObjectMappingsPage() {
  return (
    <>
      <PageHeader
        title="对象映射"
        desc="背挂数据源声明 · 对象类型的数据从哪张表来 · 字段映射（属性 → 列）"
      />
      <div className="mp-onto-canvas-stage">
        <div className="mp-onto-canvas-scroll">
          <section className="mp-dc-section">
            <h3 className="mp-dc-section-title">背挂数据源</h3>
            <p className="mp-dc-section-desc">同步健康与背挂数据源声明</p>
            <BackingDatasourcePanel />
          </section>
        </div>
      </div>
    </>
  );
}
