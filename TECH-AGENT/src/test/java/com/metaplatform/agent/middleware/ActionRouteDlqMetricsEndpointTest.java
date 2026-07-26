package com.metaplatform.agent.middleware;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("P5.11 ActionRouteDlqMetricsEndpoint")
class ActionRouteDlqMetricsEndpointTest {

    private ActionRouteDlqService dlqService;
    private ActionRouteDlqMetricsEndpoint endpoint;

    @BeforeEach
    void setUp() {
        dlqService = Mockito.mock(ActionRouteDlqService.class);
        endpoint = new ActionRouteDlqMetricsEndpoint(dlqService, null);
    }

    @Test
    @DisplayName("metrics: returns service info + pending count")
    void metricsReturns() {
        whenSize(3);
        Map<String, Object> result = endpoint.metrics();
        assertEquals("agent-action-dlq", result.get("service"));
        assertEquals(3, result.get("pending_count"));
        assertEquals(false, result.get("scheduler_present"));
    }

    @Test
    @DisplayName("metrics: null dlqService returns 0")
    void metricsNullDlqService() {
        ActionRouteDlqMetricsEndpoint ep = new ActionRouteDlqMetricsEndpoint(null, null);
        Map<String, Object> result = ep.metrics();
        assertEquals(0, result.get("pending_count"));
    }

    private void whenSize(int size) {
        Mockito.when(dlqService.size()).thenReturn(size);
    }
}
