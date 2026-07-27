package com.metaplatform.agent.deerflow;

import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertNotNull;

/** Real Gateway smoke gate; opt in with -Ddeerflow.acceptance.url/-Ddeerflow.acceptance.token. */
class DeerFlowAdapterRealGatewayIT {
    @Test
    void createsAuthoritativeUpstreamRun() {
        String url = System.getenv("DEERFLOW_ACCEPTANCE_URL");
        String token = System.getenv("DEERFLOW_ACCEPTANCE_TOKEN");
        Assumptions.assumeTrue(url != null && token != null, "real DeerFlow acceptance is opt-in");
        DeerFlowProperties properties = new DeerFlowProperties();
        properties.setGatewayUrl(url);
        properties.setInternalToken(token);
        properties.setOwnerUserId(System.getenv().getOrDefault("DEERFLOW_ACCEPTANCE_OWNER", "metaplatform-agent"));
        DeerFlowAdapter adapter = new DeerFlowAdapter(properties);
        String runId = adapter.startRun(DeerFlowAdapter.StartRunRequest.builder()
                .tenantId("tenant-acceptance").userId("acceptance-user").agentId("lead_agent")
                .threadId("metaplatform-acceptance-thread").platformRunId("MP-ACCEPTANCE-" + System.currentTimeMillis())
                .traceId("trace-acceptance").message("Read-only recent-state analysis for customer cust-10086; do not mutate business data.")
                .ontologyEnvelope(Map.of("tenantId", "tenant-acceptance", "objectId", "cust-10086", "conceptCode", "Customer"))
                .allowedTools(List.of("ontology.get_object", "ontology.query_metric"))
                .build());
        assertNotNull(runId);
    }
}
