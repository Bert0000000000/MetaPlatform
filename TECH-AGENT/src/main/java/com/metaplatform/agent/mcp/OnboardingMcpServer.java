package com.metaplatform.agent.mcp;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.*;

/**
 * Ontology 工具集 MCP Server（P3.3.3）。
 *
 * <p>把 21 个 Ontology 工具以 MCP 协议注册给 DeerFlow Adapter。
 * DeerFlow 通过 MCP Client 发现工具并允许 Agent 调用。</p>
 *
 * <p>P3.3 阶段以静态列表形式暴露；P5.1 接 ActionPolicy.yaml 后增加风险等级过滤。</p>
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class OnboardingMcpServer {

    /**
     * 返回所有 Ontology 工具定义（OpenAI Function Calling 格式，
     * 兼容 DeerFlow MCP Client）。
     */
    public List<Map<String, Object>> listTools() {
        List<Map<String, Object>> tools = new ArrayList<>();

        // ============ Schema ============
        tools.add(tool("ontology.describe_concept",
                "获取 Ontology Concept 的完整定义（属性、关系、Metric、Action）",
                Map.of("conceptCode", stringParam("Concept 编码", true))));
        tools.add(tool("ontology.describe_relationship",
                "获取 Ontology 关系类型的语义与端点 Concept",
                Map.of("relationshipCode", stringParam("关系编码", true))));
        tools.add(tool("ontology.describe_metric",
                "解释 Metric 的计算口径、维度和返回类型",
                Map.of("metricCode", stringParam("指标编码", true))));
        tools.add(tool("ontology.get_available_actions",
                "列出当前 Concept 上可用的 Action 列表",
                Map.of("conceptCode", stringParam("Concept 编码", true))));

        // ============ Object ============
        tools.add(tool("ontology.resolve_object",
                "通过外部 ID / 业务键解析到 Ontology Object",
                Map.of("conceptCode", stringParam("Concept 编码", true),
                        "externalId", stringParam("外部 ID", true))));
        tools.add(tool("ontology.get_object",
                "按 ID 获取 Ontology Object 的属性",
                Map.of("conceptCode", stringParam("Concept 编码", true),
                        "objectId", stringParam("Object ID", true))));
        tools.add(tool("ontology.search_objects",
                "按 Concept + 过滤条件搜索 Object",
                Map.of("conceptCode", stringParam("Concept 编码", true),
                        "filters", objectParam("过滤条件 JSON", false))));
        tools.add(tool("ontology.get_related_objects",
                "沿指定关系获取关联对象",
                Map.of("conceptCode", stringParam("起点 Concept", true),
                        "objectId", stringParam("起点 Object ID", true),
                        "relationship", stringParam("关系编码", true))));
        tools.add(tool("ontology.get_object_timeline",
                "获取 Object 的历史变更时间线",
                Map.of("conceptCode", stringParam("Concept 编码", true),
                        "objectId", stringParam("Object ID", true))));

        // ============ Query ============
        tools.add(tool("ontology.query_objects",
                "DSL 查询：按 Concept + 条件集合查询",
                Map.of("conceptCode", stringParam("Concept 编码", true),
                        "filters", objectParam("过滤条件", false))));
        tools.add(tool("ontology.query_metric",
                "执行 Ontology Metric 查询",
                Map.of("metricCode", stringParam("指标编码", true),
                        "objectId", stringParam("Object ID", false),
                        "params", objectParam("额外参数", false))));
        tools.add(tool("ontology.compare_objects",
                "对比两个 Object 的属性差异",
                Map.of("conceptCode", stringParam("Concept 编码", true),
                        "leftId", stringParam("左侧 Object ID", true),
                        "rightId", stringParam("右侧 Object ID", true))));
        tools.add(tool("ontology.aggregate_metric",
                "按维度聚合 Metric",
                Map.of("metricCode", stringParam("指标编码", true),
                        "groupBy", arrayParam("分组维度", false))));
        tools.add(tool("ontology.explain_metric",
                "解释 Metric 的计算逻辑（自然语言）",
                Map.of("metricCode", stringParam("指标编码", true))));

        // ============ Action ============
        tools.add(tool("ontology.propose_action",
                "提出 Action Proposal（需走 ActionGuard）",
                Map.of("actionCode", stringParam("Action 编码", true),
                        "targetObjectId", stringParam("目标 Object ID", true),
                        "parameters", objectParam("参数", false))));
        tools.add(tool("ontology.simulate_action",
                "模拟执行 Action，预测影响范围",
                Map.of("actionCode", stringParam("Action 编码", true),
                        "targetObjectId", stringParam("目标 Object ID", true),
                        "parameters", objectParam("参数", false))));
        tools.add(tool("ontology.request_action_approval",
                "把 Action 提交审批（高风险 Action）",
                Map.of("proposalId", stringParam("Proposal ID", true))));
        tools.add(tool("ontology.execute_action",
                "执行已审批的 Action（低风险自动执行）",
                Map.of("proposalId", stringParam("Proposal ID", true))));
        tools.add(tool("ontology.get_action_status",
                "查询 Action 执行状态",
                Map.of("proposalId", stringParam("Proposal ID", true))));

        // ============ Evidence ============
        tools.add(tool("ontology.attach_evidence",
                "为 Claim 绑定 Evidence",
                Map.of("claimId", stringParam("Claim ID", true),
                        "type", stringParam("Evidence 类型", true),
                        "ref", stringParam("引用", true))));
        tools.add(tool("ontology.get_provenance",
                "获取 Object 的数据来源链",
                Map.of("conceptCode", stringParam("Concept 编码", true),
                        "objectId", stringParam("Object ID", true))));
        tools.add(tool("ontology.create_candidate_fact",
                "把 LLM 抽取的事实转为 Ontology Candidate Fact",
                Map.of("conceptCode", stringParam("Concept 编码", true),
                        "objectId", stringParam("Object ID", false),
                        "property", stringParam("属性", true),
                        "value", objectParam("值", true),
                        "evidenceRefs", arrayParam("证据引用", false),
                        "confidence", numberParam("置信度", false))));

        log.info("[OnboardingMcpServer] exposed {} Ontology tools", tools.size());
        return tools;
    }

    private static Map<String, Object> tool(String name, String desc, Map<String, Object> properties) {
        Map<String, Object> t = new LinkedHashMap<>();
        t.put("name", name);
        t.put("description", desc);
        t.put("parameters", Map.of(
                "type", "object",
                "properties", properties,
                "required", properties.entrySet().stream()
                        .filter(e -> Boolean.TRUE.equals(((Map<String, Object>) e.getValue()).get("required")))
                        .map(Map.Entry::getKey).toList()
        ));
        return t;
    }

    private static Map<String, Object> stringParam(String desc, boolean required) {
        return param("string", desc, required);
    }
    private static Map<String, Object> numberParam(String desc, boolean required) {
        return param("number", desc, required);
    }
    private static Map<String, Object> objectParam(String desc, boolean required) {
        return param("object", desc, required);
    }
    private static Map<String, Object> arrayParam(String desc, boolean required) {
        return param("array", desc, required);
    }
    private static Map<String, Object> param(String type, String desc, boolean required) {
        Map<String, Object> p = new LinkedHashMap<>();
        p.put("type", type);
        p.put("description", desc);
        p.put("required", required);
        return p;
    }
}
