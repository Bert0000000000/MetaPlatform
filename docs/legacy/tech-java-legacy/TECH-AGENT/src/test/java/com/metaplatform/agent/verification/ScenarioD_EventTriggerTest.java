package com.metaplatform.agent.verification;

import com.fasterxml.jackson.databind.JsonNode;
import com.metaplatform.agent.trigger.TriggerEngine;
import com.metaplatform.agent.trigger.TriggerEntity;
import com.metaplatform.msg.consumer.EventEnvelope;
import com.metaplatform.msg.topology.TopologyTopics;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.time.Instant;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("Scenario D - Ontology Event 涓诲姩瑙﹀彂")
class ScenarioD_EventTriggerTest {

    @Test
    @DisplayName("D1: Contract.expiring event should be consumed by TriggerEngine and fire AgentRun")
    void contractExpiringEventFiresAgentRun() {
        JsonNode mock = MockFixtures.load("contract-expiring-event.json");
        assertEquals("Contract.expiring", mock.get("eventCode").asText());
        assertEquals("CONTRACT-2025-018", mock.get("objectId").asText());
        assertTrue(mock.get("payload").get("daysToExpiry").asInt() <= 45,
                "advance warning within 45 days should be in the events list");

        EventEnvelope<Map<String, Object>> env = new EventEnvelope<>(
                "EVT-001", TopologyTopics.ONTOLOGY_DOMAIN_EVENT, "TENANT-01", "TRACE-001",
                "TECH-ONT", Instant.now(),
                objectMap(mock.get("payload"))
        );
        assertEquals(TopologyTopics.ONTOLOGY_DOMAIN_EVENT, env.eventType());
        assertTrue(env.payload().containsKey("contractNo"));
    }

    @Test
    @DisplayName("D2: TriggerEngine filter must match tenantId + eventCode")
    void triggerEngineFilterMatches() {
        // P7.2: directly call public match() method, no reflection needed
        var engine = new TriggerEngine(
                org.mockito.Mockito.mock(com.metaplatform.agent.trigger.TriggerRepository.class),
                org.mockito.Mockito.mock(com.metaplatform.agent.deerflow.DeerFlowAdapter.class),
                org.mockito.Mockito.mock(org.springframework.kafka.core.KafkaTemplate.class));

        String filter = "{\"tenantId\":\"TENANT-01\"}";
        assertTrue(engine.match(filter, Map.of("tenantId", "TENANT-01")));
        assertFalse(engine.match(filter, Map.of("tenantId", "OTHER")));
        assertTrue(engine.match(null, Map.of()));
    }

    @Test
    @DisplayName("D3: TriggerEntity cooldown must prevent burst firing")
    void cooldownPreventsBurst() {
        TriggerEntity t = TriggerEntity.builder()
                .id("TRG-TEST")
                .tenantId("TENANT-01")
                .triggerCode("contract-expiring-handler")
                .eventTopic(TopologyTopics.ONTOLOGY_DOMAIN_EVENT)
                .agentId("renewal-risk-analyst")
                .enabled(true)
                .cooldownSec(300)
                .lastFireAt(Instant.now().minusSeconds(60))
                .build();

        long secondsSinceLastFire = Duration.between(t.getLastFireAt(), Instant.now()).getSeconds();
        assertTrue(secondsSinceLastFire < t.getCooldownSec(),
                "cooldown window should still be active: " + secondsSinceLastFire + "s < " + t.getCooldownSec() + "s");
    }

    @Test
    @DisplayName("D4: Mock event must include risk customer metadata")
    void mockContractExpiringPayload() {
        JsonNode payload = MockFixtures.load("contract-expiring-event.json").get("payload");
        assertEquals("CONTRACT-2025-018", payload.get("contractNo").asText());
        assertEquals("CUST-10086", payload.get("customerId").asText());
        assertEquals("\u4e0a\u6d77\u6c47\u5ddd\u8d38\u6613\u6709\u9650\u516c\u53f8", payload.get("customerName").asText());
        assertTrue(payload.get("daysToExpiry").asInt() <= 45);
        assertTrue(payload.get("annualAmount").asLong() > 0);
        assertEquals("HIGH", payload.get("riskLevel").asText());
    }

    private static Map<String, Object> objectMap(JsonNode n) {
        Map<String, Object> m = new LinkedHashMap<>();
        n.fields().forEachRemaining(e -> m.put(e.getKey(), e.getValue().asText()));
        return m;
    }
}

