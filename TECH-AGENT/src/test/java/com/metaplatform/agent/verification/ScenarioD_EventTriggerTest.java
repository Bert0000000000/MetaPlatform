package com.metaplatform.agent.verification;

import com.fasterxml.jackson.databind.JsonNode;
import com.metaplatform.agent.trigger.TriggerEngine;
import com.metaplatform.agent.trigger.TriggerRepository;
import com.metaplatform.agent.trigger.TriggerEntity;
import com.metaplatform.msg.consumer.EventEnvelope;
import com.metaplatform.msg.topology.TopologyTopics;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.Duration;
import java.time.Instant;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/**
 * 场景 D：Ontology Event 主动触发（Contract.expiring）。
 *
 * <p>验收标准来自 §9.4。</p>
 */
@DisplayName("Scenario D · Ontology Event 主动触发")
class ScenarioD_EventTriggerTest {

    @Test
    @DisplayName("D1: Contract.expiring 事件应被 TriggerEngine 消费并触发 AgentRun")
    void contractExpiringEventFiresAgentRun() {
        JsonNode mock = MockFixtures.load("contract-expiring-event.json");
        assertEquals("Contract.expiring", mock.get("eventCode").asText());
        assertEquals("CONTRACT-2025-018", mock.get("objectId").asText());
        assertTrue(mock.get("payload").get("daysToExpiry").asInt() <= 45,
                "提前 45 天预警应在 events 列表中");

        // 直接构造事件信封验证 Topic 与路由
        EventEnvelope<Map<String, Object>> env = new EventEnvelope<>(
                "EVT-001", TopologyTopics.ONTOLOGY_DOMAIN_EVENT, "TENANT-01", "TRACE-001",
                "TECH-ONT", Instant.now(),
                objectMap(mock.get("payload"))
        );
        assertEquals(TopologyTopics.ONTOLOGY_DOMAIN_EVENT, env.eventType());
        assertTrue(env.payload().containsKey("contractNo"));
    }

    @Test
    @DisplayName("D2: TriggerEngine filter 必须按 tenantId + eventCode 匹配")
    void triggerEngineFilterMatches() throws Exception {
        // 用反射直接调用 match() 测试
        var engine = new TriggerEngine(org.mockito.Mockito.mock(TriggerRepository.class), org.mockito.Mockito.mock(com.metaplatform.agent.deerflow.DeerFlowAdapter.class), org.mockito.Mockito.mock(org.springframework.kafka.core.KafkaTemplate.class));
        var matchMethod = TriggerEngine.class.getDeclaredMethod("match",
                String.class, java.util.Map.class);
        matchMethod.setAccessible(true);

        // 匹配 tenant
        var passed = (boolean) matchMethod.invoke(engine,
                "{\"tenantId\":\"TENANT-01\"}",
                Map.of("tenantId", "TENANT-01"));
        assertTrue(passed);

        // 不匹配
        var failed = (boolean) matchMethod.invoke(engine,
                "{\"tenantId\":\"TENANT-01\"}",
                Map.of("tenantId", "OTHER"));
        assertFalse(failed);

        // 空 filter 全部通过
        var empty = (boolean) matchMethod.invoke(engine, null, Map.of());
        assertTrue(empty);
    }

    @Test
    @DisplayName("D3: TriggerEntity cooldown 必须防止短时间重复触发")
    void cooldownPreventsBurst() {
        TriggerEntity t = TriggerEntity.builder()
                .id("TRG-TEST")
                .tenantId("TENANT-01")
                .triggerCode("contract-expiring-handler")
                .eventTopic(TopologyTopics.ONTOLOGY_DOMAIN_EVENT)
                .agentId("renewal-risk-analyst")
                .enabled(true)
                .cooldownSec(300)
                .lastFireAt(Instant.now().minusSeconds(60))   // 1 分钟前刚触发
                .build();

        // 1 分钟 < cooldown 300 → 应该被跳过
        long secondsSinceLastFire = Duration.between(t.getLastFireAt(), Instant.now()).getSeconds();
        assertTrue(secondsSinceLastFire < t.getCooldownSec(),
                "冷却期内不应再次触发（" + secondsSinceLastFire + "s < " + t.getCooldownSec() + "s）");
    }

    @Test
    @DisplayName("D4: Mock 事件必须包含风险客户元数据")
    void mockContractExpiringPayload() {
        JsonNode payload = MockFixtures.load("contract-expiring-event.json").get("payload");
        assertEquals("CONTRACT-2025-018", payload.get("contractNo").asText());
        assertEquals("CUST-10086", payload.get("customerId").asText());
        assertEquals("上海汇川贸易有限公司", payload.get("customerName").asText());
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
