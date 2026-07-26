package com.metaplatform.agent.middleware;

import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import static org.junit.jupiter.api.Assertions.*;

/**
 * P5-ACT-13 / P5-ACT-14 Micrometer-backed DLQ metrics.
 *
 * <p>Verifies that:
 * <ol>
 *   <li>A SimpleMeterRegistry-backed instance increments the three counters</li>
 *   <li>A null MeterRegistry fallback does NOT throw on record*() calls</li>
 *   <li>The pending gauge reads live values from dlqService.size()</li>
 * </ol>
 */
@DisplayName("P5-ACT-13/14 ActionRouteDlqMetrics")
class ActionRouteDlqMetricsTest {

    private MeterRegistry registry;
    private ActionRouteDlqService dlqService;
    private ActionRouteDlqMetrics metrics;

    @BeforeEach
    void setUp() {
        registry = new SimpleMeterRegistry();
        dlqService = Mockito.mock(ActionRouteDlqService.class);
        Mockito.when(dlqService.size()).thenReturn(0);
        metrics = new ActionRouteDlqMetrics(registry, dlqService);
    }

    @Test
    @DisplayName("recordEnqueue increments enqueued counter")
    void enqueueIncrements() {
        metrics.recordEnqueue();
        metrics.recordEnqueue();
        metrics.recordEnqueue();
        assertEquals(3.0d, metrics.getEnqueuedCount(), 0.0001d);
    }

    @Test
    @DisplayName("recordRetrySuccess / Failure each track separately")
    void retryCountersTracked() {
        metrics.recordRetrySuccess();
        metrics.recordRetrySuccess();
        metrics.recordRetryFailure();
        assertEquals(2.0d, metrics.getRetrySuccessCount(), 0.0001d);
        assertEquals(1.0d, metrics.getRetryFailureCount(), 0.0001d);
        assertEquals(0.0d, metrics.getEnqueuedCount(), 0.0001d);
    }

    @Test
    @DisplayName("Meters visible in registry under standard names")
    void registeredInRegistry() {
        metrics.recordEnqueue();
        metrics.recordRetrySuccess();
        assertNotNull(registry.find("mate.agent.dlq.enqueued").counter());
        assertNotNull(registry.find("mate.agent.dlq.retry.success").counter());
        assertNotNull(registry.find("mate.agent.dlq.retry.failure").counter());
        assertNotNull(registry.find("mate.agent.dlq.pending").gauge());
        assertEquals(1.0d, registry.find("mate.agent.dlq.enqueued").counter().count(), 0.0001d);
    }

    @Test
    @DisplayName("Pending gauge tracks dlqService.size()")
    void pendingGaugeTracksSize() {
        Mockito.when(dlqService.size()).thenReturn(0);
        assertEquals(0.0d, registry.find("mate.agent.dlq.pending").gauge().value(), 0.0001d);
        Mockito.when(dlqService.size()).thenReturn(7);
        assertEquals(7.0d, registry.find("mate.agent.dlq.pending").gauge().value(), 0.0001d);
    }

    @Test
    @DisplayName("Null MeterRegistry -> isEnabled() == false, record*() does not throw")
    void nullRegistryIsNoop() {
        ActionRouteDlqMetrics nullMetrics = new ActionRouteDlqMetrics(null, null);
        assertFalse(nullMetrics.isEnabled());
        // Should not throw even though no real registry is wired:
        nullMetrics.recordEnqueue();
        nullMetrics.recordRetrySuccess();
        nullMetrics.recordRetryFailure();
        assertEquals(0.0d, nullMetrics.getEnqueuedCount(), 0.0001d);
    }
}
