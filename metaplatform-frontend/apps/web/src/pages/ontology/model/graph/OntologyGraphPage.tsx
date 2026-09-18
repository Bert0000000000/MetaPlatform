import { PageHeader } from '@/components/skeleton';
import OntologyGraphView from '../OntologyGraphView';
import '../../ontology.css';

/**
 * 模型图谱（IA2-2 成正式路由 /ontology/model/graph）。
 * 节点是对象类型，边是关系类型 —— 本体即图谱（09-17 由数据中心迁入概念建模，
 * IA v2 随语义模型组获得正式 URL）。视图本体只移动不重写。
 */
export default function OntologyGraphPage() {
  return (
    <>
      <PageHeader title="模型图谱" desc="节点是对象类型，边是关系类型 —— 本体即图谱" />
      <OntologyGraphView />
    </>
  );
}
