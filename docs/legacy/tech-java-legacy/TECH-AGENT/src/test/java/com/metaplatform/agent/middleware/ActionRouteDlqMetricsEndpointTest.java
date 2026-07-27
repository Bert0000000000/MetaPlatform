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

    private ActionRouteDlqMetrics metrics;

    @BeforeEach
    void setUp() {
        dlqService = Mockito.mock(ActionRouteDlqService.class);
        metrics = Mockito.mock(ActionRouteDlqMetrics.class);
        Mockito.when(metrics.isEnabled()).thenReturn(true);
        Mockito.when(metrics.getEnqueuedCount()).thenReturn(11.0d);
        Mockito.when(metrics.getRetrySuccessCount()).thenReturn(7.0d);
        Mockito.when(metrics.getRetryFailureCount()).thenReturn(1.0d);
        endpoint = new ActionRouteDlqMetricsEndpoint(dlqService, null, metrics);
    }

    @Test
    @DisplayName("metrics: returns service info + pending count + metrics")
    void metricsReturns() {
        whenSize(3);
        Map<String, Object> result = endpoint.metrics();
        assertEquals("agent-action-dlq", result.get("service"));
        assertEquals(3, result.get("pending_count"));
        assertEquals(false, result.get("scheduler_present"));
        // P5-ACT-13/14: Micrometer counter values surfaced from ActionRouteDlqMetrics.
        assertEquals(true, result.get("metrics_present"));
        assertEquals(true, result.get("metrics_enabled"));
        assertEquals(11.0d, result.get("enqueued_total"));
        assertEquals(7.0d, result.get("retry_success_total"));
        assertEquals(1.0d, result.get("retry_failure_total"));
    }

    @Test
    @DisplayName("metrics: null dlqService returns 0")
    void metricsNullDlqService() {
        ActionRouteDlqMetricsEndpoint ep = new ActionRouteDlqMetricsEndpoint(null, null, null);
        Map<String, Object> result = ep.metrics();
        assertEquals(0, result.get("pending_count"));
        assertEquals(false, result.get("metrics_present"));
    }

    private void whenSize(int size) {
        Mockito.when(dlqService.size()).thenReturn(size);
    }
}
