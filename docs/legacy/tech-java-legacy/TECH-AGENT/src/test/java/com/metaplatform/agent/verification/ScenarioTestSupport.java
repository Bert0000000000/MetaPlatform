package com.metaplatform.agent.verification;

import com.metaplatform.agent.deerflow.DeerFlowAdapter;
import com.metaplatform.agent.middleware.AgentMiddleware;
import com.metaplatform.agent.middleware.MiddlewareChain;
import com.metaplatform.agent.middleware.MiddlewareContext;
import com.metaplatform.agent.middleware.OntologyActionGuardMiddleware;
import com.metaplatform.agent.middleware.OntologyContextMiddleware;
import com.metaplatform.agent.middleware.OntologyEvidenceMiddleware;
import com.metaplatform.agent.middleware.OntologyGroundingMiddleware;
import com.metaplatform.agent.middleware.OntologyPermissionMiddleware;
import com.metaplatform.agent.middleware.ToolCall;
import com.metaplatform.agent.runtime.RuntimeRouter;
import com.metaplatform.agent.runtime.RuntimeRouter.RouteDecision;
import com.metaplatform.agent.subagent.SubAgentContextBuilder;
import com.metaplatform.ont.context.OntologyContextEnvelope;

import java.util.*;

/**
 * 5 个场景共用的轻量测试桩：不启动 Spring，仅直接实例化被测对象。
 */
public final class ScenarioTestSupport {

    public static OntologyContextEnvelope sampleEnvelope(String tenantId, String userId, String concept, String objectId) {
        return OntologyContextEnvelope.builder()
                .envelopeId("ENV-TEST")
                .tenantId(tenantId)
                .userId(userId)
                .runId("RUN-TEST")
                .subject(OntologyContextEnvelope.Subject.builder().conceptCode(concept).objectId(objectId).build())
                .schema(OntologyContextEnvelope.Schema.builder()
                        .properties(List.of("name", "customerLevel", "revenue12m", "riskLevel"))
                        .relationships(List.of("HAS_ORDER", "HAS_CONTRACT", "HAS_TICKET"))
                        .availableActions(List.of("CreateFollowUpTask", "RequestDiscount"))
                        .build())
                .permission(OntologyContextEnvelope.PermissionRef.builder()
                        .snapshotId("SNAP-TEST")
                        .dataScope("DEPARTMENT_TREE")
                        .deniedFields(List.of("bankAccount", "legalIdentityNumber"))
                        .allowedActions(List.of("CreateFollowUpTask", "RequestDiscount"))
                        .approvalRequiredActions(List.of("RequestDiscount", "SendOfficialOffer"))
                        .allowedRelations(List.of("HAS_ORDER", "HAS_CONTRACT", "HAS_TICKET"))
                        .build())
                .allowedTools(List.of(
                        "ontology.describe_concept",
                        "ontology.search_objects",
                        "ontology.query_metric",
                        "ontology.get_object_timeline",
                        "ontology.get_related_objects",
                        "rag.search",
                        "ontology.action.CreateFollowUpTask"
                ))
                .metrics(List.of("customer.revenue_12m", "customer.order_decline_rate"))
                .concepts(List.of("Customer"))
                .expiresAt(java.time.Instant.now().plusSeconds(300))
                .build();
    }

    public static MiddlewareChain buildChainWith(List<AgentMiddleware> middlewares) {
        MiddlewareChain chain = new MiddlewareChain(middlewares);
        return chain;
    }

    public static MiddlewareContext baseCtx(String userId, String message, OntologyContextEnvelope env) {
        return MiddlewareContext.builder()
                .tenantId("TENANT-01")
                .userId(userId)
                .agentId("customer-copilot")
                .threadId("THREAD-1")
                .runId("RUN-1")
                .userMessage(message)
                .ontologyEnvelope(toMap(env))
                .allowedTools(env.getAllowedTools())
                .claims(new ArrayList<>())
                .actionProposals(new ArrayList<>())
                .build();
    }

    public static Map<String, Object> toMap(OntologyContextEnvelope env) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("envelopeId", env.getEnvelopeId());
        m.put("tenantId", env.getTenantId());
        m.put("subject", Map.of("conceptCode", env.getSubject().getConceptCode(), "objectId", env.getSubject().getObjectId()));
        m.put("expiresAt", env.getExpiresAt());
        return m;
    }

    public static RuntimeRouter router() {
        return new RuntimeRouter();
    }

    public static List<AgentMiddleware> defaultOntologyMiddlewares() {
        return List.of(
                new OntologyContextMiddleware(),
                new OntologyGroundingMiddleware(),
                new OntologyPermissionMiddleware(),
                new OntologyEvidenceMiddleware(),
                new OntologyActionGuardMiddleware()
        );
    }

    public static DeerFlowAdapter stubDeerFlow() {
        // 不真正启动外部依赖；通过 Spring 注入或手动 new
        return new DeerFlowAdapter();
    }

    public static SubAgentContextBuilder subAgentBuilder() {
        return new SubAgentContextBuilder();
    }

    public static ToolCall toolCall(String name, Map<String, Object> args) {
        return ToolCall.builder().toolName(name).arguments(args).idempotencyKey(UUID.randomUUID().toString()).build();
    }

    public static RouteDecision decide(RuntimeRouter r, String message) {
        return r.route(baseCtx("USER-1001", message, sampleEnvelope("TENANT-01", "USER-1001", "Customer", "CUST-10086")));
    }
}
