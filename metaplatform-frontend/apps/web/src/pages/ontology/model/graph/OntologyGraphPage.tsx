import { PageHeader } from '@/components/skeleton';
import OntologyGraphView from '../OntologyGraphView';
import '../../ontology.css';

/**
 * 模型工作台（保留 IA2-2 正式路由 /ontology/model/graph）。
 * 使用真实对象类型卡片、关系连线与 Inspector；实例图仍沿用各自的 ForceGraph。
 */
export default function OntologyGraphPage() {
  return (
    <>
      <PageHeader title="模型工作台" desc="定义对象、属性与关系，校验真实模型定义" />
      <OntologyGraphView />
    </>
  );
}
