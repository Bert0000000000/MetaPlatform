package com.metaplatform.agent.authoring;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * P6-AUTH-06 AuthoringBatchFlushScheduler - periodically drains
 * {@link AuthoringBatchAccumulator}.
 *
 * <p>Operator surfaces:
 * <ul>
 *   <li>Disabled by default; enable with
 *       {@code mate.authoring.batch-scheduler-enabled=true}</li>
 *   <li>Flush interval: {@code mate.authoring.batch-flush-millis} (default 30000)</li>
 *   <li>Age window: {@code mate.authoring.batch-max-age-millis} (default 15000)
 *       - candidates older than this from first-enqueue time will be submitted
 *       even if their document is still receiving more</li>
 * </ul>
 *
 * <p>If {@link AuthoringBatchAccumulator} is not wired (e.g. disabled profile),
 * the bean is harmless (no-ops).</p>
 */
@Slf4j
@Component
@ConditionalOnProperty(
        name = "mate.authoring.batch-scheduler-enabled",
        havingValue = "true",
        matchIfMissing = false)
public class AuthoringBatchFlushScheduler {

    private final AuthoringBatchAccumulator accumulator;
    private final AuthoringService authoringService;

    @Autowired
    public AuthoringBatchFlushScheduler(
            @Autowired(required = false) AuthoringBatchAccumulator accumulator,
            @Autowired(required = false) AuthoringService authoringService) {
        this.accumulator = accumulator;
        this.authoringService = authoringService;
    }

    @Value("${mate.authoring.batch-max-age-millis:15000}")
    private long maxAgeMillis;

    /**
     * Scheduled flush. Default every 30s; configurable via
     * {@code mate.authoring.batch-flush-millis}.
     */
    @Scheduled(fixedDelayString = "${mate.authoring.batch-flush-millis:30000}",
               initialDelayString = "${mate.authoring.batch-initial-delay-millis:10000}")
    public int flushPending() {
        if (accumulator == null || authoringService == null) {
            log.debug("[AuthoringBatchFlushScheduler] bean unavailable, skipping");
            return 0;
        }
        int pending = accumulator.size();
        if (pending == 0) {
            log.debug("[AuthoringBatchFlushScheduler] buffer empty");
            return 0;
        }
        int submitted = accumulator.flushDue(authoringService, maxAgeMillis);
        log.info("[AuthoringBatchFlushScheduler] pending={} submitted={} maxAgeMs={}",
                pending, submitted, maxAgeMillis);
        return submitted;
    }
}
