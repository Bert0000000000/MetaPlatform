package com.metaplatform.action.trigger.service;

import com.metaplatform.action.trigger.entity.ActionTriggerEntity;
import com.metaplatform.action.trigger.repository.ActionTriggerRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.scheduling.support.CronExpression;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

@Slf4j
@Component
@RequiredArgsConstructor
public class TriggerScheduler {

    private static final long POLL_INTERVAL_SECONDS = 30;

    private final ActionTriggerRepository actionTriggerRepository;
    private final ActionTriggerService actionTriggerService;

    @Scheduled(fixedRate = 30_000)
    public void poll() {
        try {
            pollScheduledTriggers();
        } catch (Exception e) {
            log.error("Trigger scheduler poll failed", e);
        }
    }

    /**
     * Finds all enabled SCHEDULE triggers across tenants whose cron expression matches the current
     * poll window (last POLL_INTERVAL_SECONDS) and fires the associated action.
     */
    void pollScheduledTriggers() {
        List<ActionTriggerEntity> triggers = findAllEnabledScheduleTriggers();
        Instant now = Instant.now();
        Instant windowStart = now.minusSeconds(POLL_INTERVAL_SECONDS);
        for (ActionTriggerEntity trigger : triggers) {
            try {
                if (shouldFire(trigger.getCronExpression(), windowStart, now)) {
                    log.debug("Firing scheduled trigger {} for action {}", trigger.getTriggerId(), trigger.getActionId());
                    actionTriggerService.fire(trigger);
                }
            } catch (Exception e) {
                log.error("Failed to fire scheduled trigger {}", trigger.getTriggerId(), e);
            }
        }
    }

    /**
     * Returns true when the cron expression has a scheduled occurrence within (windowStart, now].
     */
    boolean shouldFire(String cronExpression, Instant windowStart, Instant now) {
        if (cronExpression == null || cronExpression.isBlank()) {
            return false;
        }
        try {
            CronExpression cron = CronExpression.parse(cronExpression);
            java.time.LocalDateTime next = cron.next(java.time.LocalDateTime.ofInstant(
                    windowStart, java.time.ZoneId.systemDefault()));
            if (next == null) {
                return false;
            }
            Instant nextInstant = next.atZone(java.time.ZoneId.systemDefault()).toInstant();
            return !nextInstant.isAfter(now);
        } catch (IllegalArgumentException e) {
            log.warn("Invalid cron expression {}: {}", cronExpression, e.getMessage());
            return false;
        }
    }

    List<ActionTriggerEntity> findAllEnabledScheduleTriggers() {
        return actionTriggerRepository.findAllByTriggerTypeAndEnabledAndDeletedAtIsNull(
                ActionTriggerEntity.TYPE_SCHEDULE, Boolean.TRUE);
    }

    Duration pollInterval() {
        return Duration.ofSeconds(POLL_INTERVAL_SECONDS);
    }
}
