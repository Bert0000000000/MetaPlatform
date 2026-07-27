package com.metaplatform.agent.verification;

import com.metaplatform.agent.middleware.MiddlewareChain;
import com.metaplatform.agent.middleware.MiddlewareContext;
import com.metaplatform.agent.middleware.ToolCall;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/**
 * §17.4 Claim <-> Evidence binding at runtime.
 *
 * <p>Drives the full ontology middleware chain via runAfterToolCall(ctx, toolCall, result)
 * with mocked LLM tool results, then asserts that EVERY produced Claim carries at least
 * one Evidence entry. This is what guarantees the runtime half of important Claim 100%
 * bound to Evidence.</p>
 */
@DisplayName("Scenario F - Claim Evidence runtime binding")
class ScenarioF_ClaimEvidenceBindingTest {

    /** Helper: build a tool-call result Map that OntologyEvidenceMiddleware expects. */
    @SuppressWarnings("unchecked")
    private static Map<String, Object> result(Object... refs) {
        java.util.List<Map<String, Object>> data = new java.util.ArrayList<>();
        for (Object r : refs) {
            if (r instanceof Map<?, ?> m) data.add((Map<String, Object>) m);
            else data.add(Map.of("id", String.valueOf(r)));
        }
        return Map.of("data", data);
    }

    private static ToolCall call(String toolName) {
        return ToolCall.builder().toolName(toolName).arguments(Map.of()).build();
    }

    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> evidenceOf(Map<String, Object> claim) {
        Object ev = claim.get("evidence");
        return ev == null ? List.of() : (List<Map<String, Object>>) ev;
    }

    @Test
    @DisplayName("F1: ontology.search_objects -> Claim bound to >=1 Evidence")
    void searchObjectsBindsEvidence() {
        var ctx = ScenarioTestSupport.baseCtx("U1", "find customers",
                ScenarioTestSupport.sampleEnvelope("T", "U1", "Customer", "CUST-1"));
        MiddlewareChain chain = ScenarioTestSupport.buildChainWith(ScenarioTestSupport.defaultOntologyMiddlewares());
        chain.runAfterToolCall(ctx, call("ontology.search_objects"),
                result(Map.of("objectId", "CUST-1", "concept", "Customer"),
                       Map.of("objectId", "CUST-2", "concept", "Customer")));
        assertFalse(ctx.getClaims().isEmpty(), "ontology.* result must produce a Claim");
        for (Map<String, Object> claim : ctx.getClaims()) {
            assertNotNull(claim.get("tool"));
            assertNotNull(claim.get("type"));
            List<Map<String, Object>> ev = evidenceOf(claim);
            assertFalse(ev.isEmpty(), "every Claim must carry >=1 Evidence");
            for (Map<String, Object> e : ev) {
                assertNotNull(e.get("type"));
                assertNotNull(e.get("ref"));
            }
        }
    }

    @Test
    @DisplayName("F2: ontology.query_metric -> Claim bound to Evidence (>=1)")
    void queryMetricBindsEvidence() {
        var ctx = ScenarioTestSupport.baseCtx("U1", "Q4 revenue",
                ScenarioTestSupport.sampleEnvelope("T", "U1", "Customer", "CUST-1"));
        MiddlewareChain chain = ScenarioTestSupport.buildChainWith(ScenarioTestSupport.defaultOntologyMiddlewares());
        chain.runAfterToolCall(ctx, call("ontology.query_metric"),
                result(Map.of("value", 48000000, "metric", "customer.revenue_12m")));
        assertEquals(1, ctx.getClaims().size());
        List<Map<String, Object>> ev = evidenceOf(ctx.getClaims().get(0));
        assertFalse(ev.isEmpty());
    }

    @Test
    @DisplayName("F3: rag.search is NOT ontology.* -> no Claim produced by middleware")
    void ragSearchDoesNotAutoBind() {
        var ctx = ScenarioTestSupport.baseCtx("U1", "doc search",
                ScenarioTestSupport.sampleEnvelope("T", "U1", "Customer", "CUST-1"));
        MiddlewareChain chain = ScenarioTestSupport.buildChainWith(ScenarioTestSupport.defaultOntologyMiddlewares());
        chain.runAfterToolCall(ctx, call("rag.search"),
                result("kb-doc-1", "kb-doc-2", "kb-doc-3"));
        assertTrue(ctx.getClaims().isEmpty(),
                "rag.search is intentionally NOT bound to ontology.* prefix; no Claim auto-emitted");
    }

    @Test
    @DisplayName("F4: ontology.* tool with empty data list -> no Claim (no false binding)")
    void emptyResultDoesNotProduceClaim() {
        var ctx = ScenarioTestSupport.baseCtx("U1", "empty",
                ScenarioTestSupport.sampleEnvelope("T", "U1", "Customer", "CUST-1"));
        MiddlewareChain chain = ScenarioTestSupport.buildChainWith(ScenarioTestSupport.defaultOntologyMiddlewares());
        Map<String, Object> emptyResult = Map.of("data", List.of());
        chain.runAfterToolCall(ctx, call("ontology.search_objects"), emptyResult);
        assertTrue(ctx.getClaims().isEmpty());
    }

    @Test
    @DisplayName("F5: consecutive tool calls accumulate Claims and each one carries Evidence")
    void consecutiveCallsAccumulateClaimsWithEvidence() {
        var ctx = ScenarioTestSupport.baseCtx("U1", "deep analysis",
                ScenarioTestSupport.sampleEnvelope("T", "U1", "Customer", "CUST-1"));
        MiddlewareChain chain = ScenarioTestSupport.buildChainWith(ScenarioTestSupport.defaultOntologyMiddlewares());
        chain.runAfterToolCall(ctx, call("ontology.search_objects"),
                result(Map.of("objectId", "CUST-1")));
        chain.runAfterToolCall(ctx, call("ontology.query_metric"),
                result(Map.of("value", 12, "metric", "customer.order_count")));
        chain.runAfterToolCall(ctx, call("ontology.get_object_timeline"),
                result(Map.of("ts", "2026-06-01"), Map.of("ts", "2026-07-01")));
        assertEquals(3, ctx.getClaims().size(), "three ontology tools -> three Claims");
        for (Map<String, Object> claim : ctx.getClaims()) {
            assertFalse(evidenceOf(claim).isEmpty(),
                    "Claim from " + claim.get("tool") + " must carry Evidence");
        }
    }

    @Test
    @DisplayName("F6: rejected context halts afterToolCall chain (no Claim)")
    void rejectedContextStopsChain() {
        var ctx = ScenarioTestSupport.baseCtx("U1", "denied",
                ScenarioTestSupport.sampleEnvelope("T", "U1", "Customer", "CUST-1"));
        ctx.setRejected(true);
        ctx.setRejectionReason("denied-upstream");
        MiddlewareChain chain = ScenarioTestSupport.buildChainWith(ScenarioTestSupport.defaultOntologyMiddlewares());
        chain.runAfterToolCall(ctx, call("ontology.search_objects"),
                result(Map.of("objectId", "CUST-1")));
        assertTrue(ctx.getClaims().isEmpty(), "rejected upstream -> no Claim");
    }
}
