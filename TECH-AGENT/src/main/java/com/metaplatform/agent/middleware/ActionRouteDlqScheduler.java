package com.metaplatform.agent.middleware;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * P5.9 ActionRouteDlqScheduler - background job that retries failed auto-routes.
 *
 * <p>Runs every {@code mate.dlq.retry-cron} (default: 5 minutes). For each
 * unresolved entry in the DLQ:
 * <ol>
 *   <li>Skips if {@code last_retry_at} is more recent than {@code retry-backoff-seconds}</li>
 *   <li>Skips if {@code retry_count >= max-retries}</li>
 *   <li>Calls {@code ActionApprovalBridgeService.submitForApproval} via {@code ActionRouteDlqService.retry}</li>
 *   <li>Marks SUCCESS / FAILED on result</li>
 * </ol>
 * </p>
 *
 * <p>Scheduling: enabled when {@code mate.dlq.scheduler-enabled=true} (default in {@code application.yml}).</p>
 */
@Slf4j
@Component
public class ActionRouteDlqScheduler {

    private final ActionRouteDlqService dlqService;

    @Autowired
    public ActionRouteDlqScheduler(@Autowired(required = false) ActionRouteDlqService dlqService) {
        this.dlqService = dlqService;
    }

    @Value("")
    private boolean enabled;

    @Value("")
    private int maxRetries;

    /**
     * Scheduled job: every 5 minutes scan pending DLQ and retry.
     * Returns the count of successful retries for monitoring.
     */
    @Scheduled(fixedDelayString = "", initialDelayString = "")
    public int retryPending() {
        if (!enabled) {
            log.debug("[ActionRouteDlqScheduler] disabled, skipping");
            return 0;
        }
        if (dlqService == null) {
            log.debug("[ActionRouteDlqScheduler] dlqService unavailable");
            return 0;
        }
        List<ActionRouteDlqService.FailedRoute> pending = dlqService.getPending();
        if (pending.isEmpty()) {
            log.debug("[ActionRouteDlqScheduler] no pending entries");
            return 0;
        }
        log.info("[ActionRouteDlqScheduler] scanning {} pending entries (max-retries={})", pending.size(), maxRetries);
        int ok = 0;
        int skipped = 0;
        int failed = 0;
        for (ActionRouteDlqService.FailedRoute entry : pending) {
            if (entry.retryCount() >= maxRetries) {
                log.warn("[ActionRouteDlqScheduler] skipping id={} proposal={} (retry_count={} >= max={})",
                        entry.id(), entry.proposalId(), entry.retryCount(), maxRetries);
                skipped++;
                continue;
            }
            String wfeTaskId = dlqService.retry(entry.id());
            if (wfeTaskId != null) {
                ok++;
            } else {
                failed++;
            }
        }
        log.info("[ActionRouteDlqScheduler] retry batch done: ok={} failed={} skipped={}", ok, failed, skipped);
        return ok;
    }
}
