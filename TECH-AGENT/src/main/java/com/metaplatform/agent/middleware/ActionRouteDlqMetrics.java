package com.metaplatform.agent.middleware;

import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.util.function.Supplier;

/**
 * P5-ACT-13 / P5-ACT-14 Micrometer metrics for the ActionRoute DLQ.
 *
 * <p>Exposes four metrics through the standard MeterRegistry:
 * <ul>
 *   <li>mate_agent_dlq_enqueued_total - counter, increments on each enqueue()</li>
 *   <li>mate_agent_dlq_retry_success_total - counter, increments on successful retry()</li>
 *   <li>mate_agent_dlq_retry_failure_total - counter, increments on retry() that still failed</li>
 *   <li>mate_agent_dlq_pending - gauge, reflects the current in-memory queue size</li>
 * </ul>
 *
 * If MeterRegistry is unavailable (or no actuator on the classpath), the counters
 * are wired to an internal SimpleMeterRegistry so callers can still invoke the
 * record*() methods safely; the metrics endpoint will simply report zero changes.
 */
@Slf4j
@Component
public class ActionRouteDlqMetrics {

    static final String METRIC_ENQUEUED      = "mate.agent.dlq.enqueued";
    static final String METRIC_RETRY_SUCCESS = "mate.agent.dlq.retry.success";
    static final String METRIC_RETRY_FAILURE = "mate.agent.dlq.retry.failure";
    static final String METRIC_PENDING       = "mate.agent.dlq.pending";

    private final Counter enqueuedCounter;
    private final Counter retrySuccessCounter;
    private final Counter retryFailureCounter;

    private final boolean enabled;
    private final java.util.concurrent.atomic.AtomicReference<ActionRouteDlqService> dlqService = new java.util.concurrent.atomic.AtomicReference<>();
    @Autowired
    public void bindService(ActionRouteDlqService service) { this.dlqService.set(service); }

    @Autowired
    public ActionRouteDlqMetrics(
            @Autowired(required = false) MeterRegistry meterRegistry) {
        if (meterRegistry != null) {
            this.enqueuedCounter = Counter.builder(METRIC_ENQUEUED)
                    .description("Total number of failed auto-routes enqueued into the DLQ")
                    .register(meterRegistry);
            this.retrySuccessCounter = Counter.builder(METRIC_RETRY_SUCCESS)
                    .description("Total number of DLQ retry attempts that succeeded (WFE accepted)")
                    .register(meterRegistry);
            this.retryFailureCounter = Counter.builder(METRIC_RETRY_FAILURE)
                    .description("Total number of DLQ retry attempts that still failed")
                    .register(meterRegistry);
            Supplier<Number> pendingSupplier = () -> { ActionRouteDlqService d = dlqService.get(); return d == null ? 0d : (double) d.size(); };
            Gauge.builder(METRIC_PENDING, pendingSupplier)
                    .description("Current number of pending (unresolved) DLQ entries")
                    .register(meterRegistry);
            this.enabled = true;
            log.info("[ActionRouteDlqMetrics] Micrometer metrics registered under {} namespace",
                    "mate.agent.dlq.*");
        } else {
            // No MeterRegistry -> keep harmless no-op counters so callers can still invoke
            // record*(); the values will live on an internal SimpleMeterRegistry that nothing
            // scrapes (this branch should only occur in tests / dev runs without actuator).
            SimpleMeterRegistry noop = new SimpleMeterRegistry();
            this.enqueuedCounter      = Counter.builder(METRIC_ENQUEUED + ".noop").register(noop);
            this.retrySuccessCounter  = Counter.builder(METRIC_RETRY_SUCCESS + ".noop").register(noop);
            this.retryFailureCounter  = Counter.builder(METRIC_RETRY_FAILURE + ".noop").register(noop);
            this.enabled = false;
            log.info("[ActionRouteDlqMetrics] No MeterRegistry found; metrics disabled");
        }
    }

    public void recordEnqueue() {
        if (!enabled) return; // true no-op when no MeterRegistry is wired
        try { enqueuedCounter.increment(); } catch (Exception ignored) { /* defensive */ }
    }

    public void recordRetrySuccess() {
        if (!enabled) return;
        try { retrySuccessCounter.increment(); } catch (Exception ignored) { /* defensive */ }
    }

    public void recordRetryFailure() {
        if (!enabled) return;
        try { retryFailureCounter.increment(); } catch (Exception ignored) { /* defensive */ }
    }

    public double getEnqueuedCount() {
        return enqueuedCounter == null ? 0d : enqueuedCounter.count();
    }

    public double getRetrySuccessCount() {
        return retrySuccessCounter == null ? 0d : retrySuccessCounter.count();
    }

    public double getRetryFailureCount() {
        return retryFailureCounter == null ? 0d : retryFailureCounter.count();
    }

    public boolean isEnabled() {
        return enabled;
    }
}
