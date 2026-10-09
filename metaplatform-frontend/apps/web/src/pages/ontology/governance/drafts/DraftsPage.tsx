import { PageHeader } from '@/components/skeleton';
import SchemaWipCard from '../../components/SchemaWipCard';
import '../governance.css';
import '../../ontology.css';
export default function DraftsPage() {
  return (
    <>
      <PageHeader
        title="模型草稿"
        desc="审阅草稿 → 定义校验 → 影响预览 → 确认发布；模型发布与实例迁移分别执行"
      />
      <SchemaWipCard />
    </>
  );
}
