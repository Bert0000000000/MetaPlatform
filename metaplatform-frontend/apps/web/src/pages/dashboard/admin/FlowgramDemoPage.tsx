import { useState } from "react";
import { Radio } from "@douyinfe/semi-ui";
import { SectionCard } from "@mate/shared";
import { FlowRunner, flowDataToFlowgram, HYBRID_SUPPLIER_PRESET, HYBRID_PARALLEL_PRESET } from "@mate/shared/flow";
import { AdminLayout, StatCard, StatGrid } from "./__AdminLayout";

type FlowVariant = "serial" | "parallel";

/**
 * 流程编排 Demo —— Flowgram 混合流程画布
 * --------------------------------------------------
 * 演示"一个画布 + 按节点类型分流执行"的架构形态：
 *   - 业务活动节点（触发器 / 数据写入）→ 业务执行
 *   - Agent 协作节点（LLM / MCP 工具 / 条件分支）→ 数字员工编排
 *   - 审批节点（用户任务）→ 模拟 Flowable 审批
 *   - 人工确认节点（HITL）→ 模拟自建 proposal/token 确认
 *   - 并行 / 条件节点（condition / multiOutputs / 循环 / TryCatch）→ 官方复合容器
 */
export default function FlowgramDemoPage() {
  const [variant, setVariant] = useState<FlowVariant>("serial");

  const initialData =
    variant === "parallel"
      ? flowDataToFlowgram(HYBRID_PARALLEL_PRESET)
      : flowDataToFlowgram(HYBRID_SUPPLIER_PRESET);

  return (
    <AdminLayout title="流程编排 Demo">
      <StatGrid>
        <StatCard label="节点类别" value={5} color="success" />
        <StatCard label="可执行节点" value={7} />
        <StatCard label="人工介入节点" value={2} />
        <StatCard label="并行能力" value="支持" />
      </StatGrid>

      <SectionCard
        title="混合流程画布 · FlowRunner"
        extra={
          <Radio.Group
            type="button"
            value={variant}
            onChange={(e) => setVariant(e.target.value as FlowVariant)}
            options={[
              { label: "顺序示例（含审批 + HITL）", value: "serial" },
              { label: "并行示例（三路并行分支）", value: "parallel" },
            ]}
          />
        }
      >
        <FlowRunner key={variant} initialData={initialData} height={640} />
      </SectionCard>

      <SectionCard title="场景说明">
        <div style={{ fontSize: 13, lineHeight: 1.8, color: "var(--foreground)" }}>
          <p style={{ margin: "0 0 8px" }}>
            <b>顺序示例</b>：供应商注册事件 → AI 风险分析(LLM) → 查企业征信(MCP) → 是否高风险(条件分支)
            → 高风险走经理审批(Flowable) / 低风险直达 → 人工确认准入(HITL) → 写入供应商库 → 结束
          </p>
          <p style={{ margin: "0 0 8px" }}>
            <b>并行示例</b>：供应商注册事件 → AI 风险分析(LLM) → 并行核验（查合规库 / 查征信 MCP /
            通知财务 三路并行）→ 汇聚写入供应商库 → 结束
          </p>
          <p style={{ margin: "0 0 8px", color: "var(--muted-foreground)" }}>
            同一画布上自由组合四类节点 + 官方复合容器（condition / multiOutputs / 循环 / TryCatch），
            执行时按节点类型分流：AI / 业务节点自动执行，并行容器展开各分支执行，
            审批节点暂停等待 Flowable 审批，HITL 节点暂停展示 proposal 等待人工确认。
          </p>
        </div>
      </SectionCard>

      <SectionCard title="操作指引">
        <div style={{ fontSize: 13, lineHeight: 2, color: "var(--muted-foreground)" }}>
          <div>① 点击「运行」，观察节点逐个高亮推进（执行中=蓝 / 已完成=绿）</div>
          <div>② 左侧节点库「并行与条件」分组可拖入：条件/并行分支、多输出、多输入、循环、Try/Catch</div>
          <div>③ 到达 <b>经理审批</b> 节点：弹出 Flowable 审批弹层，可「通过」或「驳回」</div>
          <div>④ 到达 <b>人工确认</b> 节点：弹出 HITL proposal 弹层，展示 AI 将执行的变更，可「确认」或「拒绝」</div>
          <div>⑤ 右侧面板实时记录执行日志；「暂停 / 继续 / 重置 / 速度」控制执行节奏</div>
        </div>
      </SectionCard>
    </AdminLayout>
  );
}
