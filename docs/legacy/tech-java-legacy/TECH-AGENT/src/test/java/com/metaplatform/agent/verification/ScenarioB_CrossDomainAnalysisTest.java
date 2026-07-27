package com.metaplatform.agent.verification;

import com.fasterxml.jackson.databind.JsonNode;
import com.metaplatform.agent.middleware.MiddlewareChain;
import com.metaplatform.agent.subagent.SubAgentContextBuilder;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.*;

import static org.junit.jupiter.api.Assertions.*;

/**
 * 场景 B：跨域深度分析（华东区销售下降）。
 *
 * <p>验收标准来自 §9.2。</p>
 */
@DisplayName("Scenario B · 跨域深度分析")
class ScenarioB_CrossDomainAnalysisTest {

    @Test
    @DisplayName("B1: Grounding 把地区 + 销售 + 下降识别为多 Concept")
    void groundingMultiConcept() {
        var ctx = ScenarioTestSupport.baseCtx("USER-1001",
                "分析华东区销售下降原因",
                ScenarioTestSupport.sampleEnvelope("TENANT-01", "USER-1001", "Customer", "CUST-10086"));

        MiddlewareChain chain = ScenarioTestSupport.buildChainWith(ScenarioTestSupport.defaultOntologyMiddlewares());
        chain.runBeforeExecution(ctx);

        @SuppressWarnings("unchecked")
        List<String> concepts = (List<String>) ctx.getGrounding().get("concepts");
        @SuppressWarnings("unchecked")
        List<String> metrics = (List<String>) ctx.getGrounding().get("metrics");
        @SuppressWarnings("unchecked")
        List<String> candidates = (List<String>) ctx.getGrounding().get("actionCandidates");

        assertTrue(concepts.contains("Customer") || concepts.contains("Metric"));
        assertTrue(metrics.contains("customer.count") || metrics.contains("customer.churn_rate"),
                "必须识别销售/流失相关 Metric");
        // 跨域：customer + 流失/销售 至少一个
        assertTrue(candidates == null || candidates.isEmpty() || candidates.contains("CreateFollowUpTask"),
                "跨域分析允许产出 CreateFollowUpTask 候选");
    }

    @Test
    @DisplayName("B2: Sub-Agent 上下文必须裁剪（不共享全量父上下文）")
    void subAgentContextIsTrimmed() {
        var parent = ScenarioTestSupport.baseCtx("USER-1001",
                "分析华东区销售下降原因",
                ScenarioTestSupport.sampleEnvelope("TENANT-01", "USER-1001", "Customer", "CUST-10086"));
        // 给父 agent 一个较大的 allowedTools
        parent.setAllowedTools(new ArrayList<>(List.of(
                "ontology.describe_concept",
                "ontology.search_objects",
                "ontology.query_metric",
                "ontology.action.CreateFollowUpTask",
                "ontology.action.RequestDiscount",
                "rag.search",
                "bash"   // 不应该传给 Sub-Agent
        )));

        var builder = ScenarioTestSupport.subAgentBuilder();
        var child = builder.buildChildContext(
                parent,
                "分析销售指标",
                List.of("Customer", "Metric"),
                List.of("ontology.query_metric"),
                4000);

        assertNotNull(child.getAllowedTools(), "Sub-Agent 必须继承工具白名单");
        assertTrue(child.getAllowedTools().size() <= parent.getAllowedTools().size(),
                "Sub-Agent 工具数量 ≤ 父 agent 工具数量");
        assertFalse(child.getAllowedTools().contains("bash"),
                "敏感工具 bash 必须从 Sub-Agent 上下文剔除");
        assertTrue(child.getAllowedTools().stream().anyMatch(t -> t.startsWith("ontology.")),
                "Sub-Agent 必须保留 ontology.* 工具");
        assertEquals("分析销售指标", child.getUserMessage(),
                "Sub-Agent 任务描述应作为 userMessage");
        assertTrue(child.getRunId().endsWith(parent.getRunId())
                        || child.getRunId().contains(parent.getRunId()),
                "Sub-Agent RunId 应与父 Run 关联");
    }

    @Test
    @DisplayName("B3: Mock 数据 sales-decline-east-china 必含 3 个 Sub-Agent 期望")
    void mockSalesDeclineDataShape() {
        JsonNode mock = MockFixtures.load("sales-decline-east-china.json");
        assertEquals("EAST_CHINA", mock.get("region").asText());
        JsonNode sub = mock.get("expectedSubAgents");
        assertEquals(3, sub.size(), "预期 3 个 Sub-Agent：销售/客户/服务");
        JsonNode customers = mock.get("expectedRiskCustomers");
        assertEquals(3, customers.size(), "预期识别 3 个风险客户");
        boolean hasHuicun = false;
        for (JsonNode c : customers) {
            if ("CUST-10086".equals(c.get("customerId").asText())) {
                hasHuicun = true;
                assertTrue(c.get("riskScore").asDouble() > 0.7,
                        "上海汇川 CUST-10086 应被识别为高风险（score > 0.7）");
            }
        }
        assertTrue(hasHuicun, "Mock 数据必须包含 CUST-10086 上海汇川");
        JsonNode artifacts = mock.get("expectedReportArtifacts");
        assertEquals(2, artifacts.size(), "至少生成 2 个 Artifact（Markdown + CSV）");
    }

    @Test
    @DisplayName("B4: Deep Task 路由判定")
    void deepTaskRouting() {
        var router = ScenarioTestSupport.router();
        var decision = ScenarioTestSupport.decide(router, "分析华东区销售下降原因");
        assertEquals(com.metaplatform.agent.runtime.RuntimeRouter.RouteDecision.DEEP, decision,
                "跨域分析应该走 Deep Task 路径");
    }

    @Test
    @DisplayName("B5: 多个 ontology.* 工具调用应各自绑定 Claim + Evidence")
    void multipleToolCallsEachProduceClaim() {
        var ctx = ScenarioTestSupport.baseCtx("USER-1001",
                "分析华东区销售下降原因",
                ScenarioTestSupport.sampleEnvelope("TENANT-01", "USER-1001", "Customer", "CUST-10086"));

        MiddlewareChain chain = ScenarioTestSupport.buildChainWith(ScenarioTestSupport.defaultOntologyMiddlewares());
        chain.runBeforeExecution(ctx);

        // Sub-Agent 1: sales
        chain.runAfterToolCall(ctx,
                ScenarioTestSupport.toolCall("ontology.query_metric", Map.of("metricCode", "sales.revenue_total")),
                Map.of("data", List.of(Map.of("region", "EAST_CHINA", "value", 48000000, "decline_pct", -0.18))));
        // Sub-Agent 2: customer
        chain.runAfterToolCall(ctx,
                ScenarioTestSupport.toolCall("ontology.query_metric", Map.of("metricCode", "customer.churn_rate")),
                Map.of("data", List.of(Map.of("region", "EAST_CHINA", "value", 0.22))));
        // Sub-Agent 3: service
        chain.runAfterToolCall(ctx,
                ScenarioTestSupport.toolCall("ontology.search_objects", Map.of()),
                Map.of("data", List.of(Map.of("objectId", "TKT-2026-0612"))));

        assertEquals(3, ctx.getClaims().size(), "3 个 Sub-Agent 调用 → 3 条 Claim");
        for (var claim : ctx.getClaims()) {
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> evs = (List<Map<String, Object>>) claim.get("evidence");
            assertNotNull(evs);
            assertTrue(evs.size() >= 1, "每条 Claim 必须至少 1 条 evidence");
        }
    }
}
