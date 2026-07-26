package com.metaplatform.agent.verification;

import com.fasterxml.jackson.databind.JsonNode;
import com.metaplatform.agent.middleware.AgentMiddleware;
import com.metaplatform.agent.middleware.MiddlewareChain;
import com.metaplatform.agent.middleware.MiddlewareContext;
import com.metaplatform.agent.middleware.ToolCall;
import com.metaplatform.agent.runtime.RuntimeRouter.RouteDecision;
import com.metaplatform.ont.context.OntologyContextEnvelope;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.*;

import static org.junit.jupiter.api.Assertions.*;

/**
 * 场景 A：客户详情 Object Copilot（首期 MVP）— 只读分析，不执行 Action。
 *
 * <p>验收标准来自 2026-07-26 集成与迁移方案 §9.1。</p>
 */
@DisplayName("Scenario A · 客户详情 Object Copilot")
class ScenarioA_ObjectCopilotTest {

    @Test
    @DisplayName("A1: Envelope 必须过期校验 + 用户字段过滤")
    void envelopeValidatesAndHidesDeniedFields() {
        OntologyContextEnvelope env = ScenarioTestSupport.sampleEnvelope(
                "TENANT-01", "USER-1001", "Customer", "CUST-10086");

        assertTrue(env.isValid(), "Envelope 必须 5 分钟 TTL 内有效");
        assertTrue(env.getPermission().getDeniedFields().contains("bankAccount"));
        assertTrue(env.getPermission().getDeniedFields().contains("legalIdentityNumber"));
        assertFalse(env.getPermission().getAllowedActions().contains("ModifyContract"),
                "首期 MVP 不允许高风险 Action 直接执行");
    }

    @Test
    @DisplayName("A2: 5 Middleware 按 order() 顺序触发")
    void middlewareChainExecutesInOrder() {
        List<AgentMiddleware> chain = ScenarioTestSupport.defaultOntologyMiddlewares();
        List<Integer> orders = chain.stream().map(AgentMiddleware::order).toList();
        assertEquals(List.of(100, 200, 300, 400, 500), orders,
                "Ontology Middleware 必须按 order=100..500 顺序：Context→Grounding→Permission→Evidence→ActionGuard");
    }

    @Test
    @DisplayName("A3: Grounding 把客户/订单/合同/流失关键字映射到 Concept + Metric")
    void groundingDetectsConceptsAndMetrics() {
        var ctx = ScenarioTestSupport.baseCtx("USER-1001",
                "这个客户最近为什么流失？订单下降严重",
                ScenarioTestSupport.sampleEnvelope("TENANT-01", "USER-1001", "Customer", "CUST-10086"));

        MiddlewareChain chain = ScenarioTestSupport.buildChainWith(ScenarioTestSupport.defaultOntologyMiddlewares());
        chain.runBeforeExecution(ctx);

        @SuppressWarnings("unchecked")
        List<String> concepts = (List<String>) ctx.getGrounding().get("concepts");
        @SuppressWarnings("unchecked")
        List<String> metrics = (List<String>) ctx.getGrounding().get("metrics");

        assertNotNull(concepts);
        assertTrue(concepts.contains("Customer"), "应该识别 Customer 概念");
        assertTrue(concepts.contains("Order"), "应该识别 Order 概念");
        assertNotNull(metrics);
        assertTrue(metrics.contains("customer.churn_rate"), "应该识别流失指标");
        assertFalse(ctx.isRejected(), "合法请求不应被拒");
    }

    @Test
    @DisplayName("A4: 工具白名单拦截未授权 Tool Call")
    void permissionMiddlewareBlocksUnauthorizedTool() {
        var ctx = ScenarioTestSupport.baseCtx("USER-1001",
                "分析客户",
                ScenarioTestSupport.sampleEnvelope("TENANT-01", "USER-1001", "Customer", "CUST-10086"));

        MiddlewareChain chain = ScenarioTestSupport.buildChainWith(ScenarioTestSupport.defaultOntologyMiddlewares());
        chain.runBeforeExecution(ctx);

        ToolCall illegal = ScenarioTestSupport.toolCall("bash",
                Map.of("cmd", "rm -rf /"));
        chain.runBeforeToolCall(ctx, illegal);

        assertTrue(ctx.isRejected(), "未授权 Tool 必须被拒绝");
        assertTrue(Objects.requireNonNull(ctx.getRejectionReason()).contains("bash"));
    }

    @Test
    @DisplayName("A5: EvidenceMiddleware 把 ontology.* 调用结果自动绑定到 Claim")
    void evidenceMiddlewareAttachesClaims() {
        var ctx = ScenarioTestSupport.baseCtx("USER-1001",
                "分析客户",
                ScenarioTestSupport.sampleEnvelope("TENANT-01", "USER-1001", "Customer", "CUST-10086"));

        MiddlewareChain chain = ScenarioTestSupport.buildChainWith(ScenarioTestSupport.defaultOntologyMiddlewares());
        chain.runBeforeExecution(ctx);

        // 模拟 ontology.search_objects 返回 3 条命中
        Map<String, Object> toolResult = Map.of("data", List.of(
                Map.of("objectId", "CUST-10086", "concept", "Customer"),
                Map.of("objectId", "ORD-2026-Q3-0115", "concept", "Order"),
                Map.of("objectId", "TKT-2026-0612", "concept", "Ticket")
        ));
        chain.runAfterToolCall(ctx,
                ScenarioTestSupport.toolCall("ontology.search_objects", Map.of()),
                toolResult);

        assertEquals(1, ctx.getClaims().size(),
                "ontology.search_objects 应产出 1 条 Claim，且该 Claim 包含 3 个 evidence");
        Map<String, Object> claim = ctx.getClaims().get(0);
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> evs = (List<Map<String, Object>>) claim.get("evidence");
        assertEquals(3, evs.size(), "每条 Claim 必须有 evidence 引用");
        assertEquals("FACT", claim.get("type"));
        assertEquals("ONTOLOGY_OBJECT", evs.get(0).get("type"));
    }

    @Test
    @DisplayName("A6: ActionGuard 给高风险 Action 打 requiresApproval")
    void actionGuardFlagsApprovalRequired() {
        var ctx = ScenarioTestSupport.baseCtx("USER-1001",
                "申请 10% 优惠",
                ScenarioTestSupport.sampleEnvelope("TENANT-01", "USER-1001", "Customer", "CUST-10086"));

        ctx.getActionProposals().add(Map.of(
                "actionCode", "RequestDiscount",
                "riskLevel", "HIGH",
                "targetObjectId", "CUST-10086",
                "reason", "续约谈判"
        ));

        MiddlewareChain chain = ScenarioTestSupport.buildChainWith(ScenarioTestSupport.defaultOntologyMiddlewares());
        chain.runAfterExecution(ctx);

        Map<String, Object> proposal = ctx.getActionProposals().get(0);
        assertEquals(Boolean.TRUE, proposal.get("requiresApproval"),
                "HIGH 风险 Action 必须标记 requiresApproval（首期 MVP 不自动执行）");
    }

    @Test
    @DisplayName("A7: 短问题路由到 Fast Query，长问题路由到 Deep Task")
    void routerSplitsFastAndDeep() {
        var router = ScenarioTestSupport.router();
        RouteDecision fast = ScenarioTestSupport.decide(router, "查客户姓名");
        RouteDecision deep = ScenarioTestSupport.decide(router,
                "分析华东区过去 6 个月的客户销售下降原因，并对比同行业其他公司表现");
        assertEquals(RouteDecision.FAST, fast);
        assertEquals(RouteDecision.DEEP, deep);
    }

    @Test
    @DisplayName("A8: Mock 数据 Customer CUST-10086 必含 4 类相关对象")
    void mockCustomerDataShape() {
        JsonNode customer = MockFixtures.load("customer-cust-10086.json");
        assertEquals("CUST-10086", customer.get("objectId").asText());
        assertEquals("KEY_ACCOUNT", customer.get("attributes").get("customerLevel").asText());
        JsonNode related = customer.get("relatedObjects");
        assertTrue(related.has("HAS_ORDER"));
        assertTrue(related.has("HAS_CONTRACT"));
        assertTrue(related.has("HAS_TICKET"));
        JsonNode metrics = customer.get("metrics");
        assertTrue(metrics.has("customer.churn_risk_score"));
        assertTrue(metrics.get("customer.churn_risk_score").asDouble() > 0.5,
                "流失风险分应 > 0.5 才算高风险客户");
    }
}
