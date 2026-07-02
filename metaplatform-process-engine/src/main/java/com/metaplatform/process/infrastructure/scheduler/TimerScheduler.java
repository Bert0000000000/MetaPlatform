package com.metaplatform.process.infrastructure.scheduler;

import com.metaplatform.process.application.TimerTriggerService;
import com.metaplatform.process.domain.ProcessDefinition;
import com.metaplatform.process.domain.enums.DefinitionStatus;
import com.metaplatform.process.domain.repository.ProcessDefinitionRepository;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Spring-managed scheduler component that periodically checks
 * timer triggers and fires process instances as needed.
 *
 * On startup, loads all ACTIVE process definitions with TIMER triggers
 * from the database into the TimerTriggerService registry.
 * Then checks every minute (configurable) to see if any trigger should fire.
 */
@Component
public class TimerScheduler {

    private static final Logger log = LoggerFactory.getLogger(TimerScheduler.class);

    private final TimerTriggerService timerTriggerService;
    private final boolean enabled;

    public TimerScheduler(TimerTriggerService timerTriggerService,
                          @Value("${metaplatform.process.timer.enabled:true}") boolean enabled) {
        this.timerTriggerService = timerTriggerService;
        this.enabled = enabled;
    }

    /**
     * On startup, load all active timer triggers from the database.
     */
    @PostConstruct
    public void init() {
        if (!enabled) {
            log.info("Timer scheduler is disabled by configuration");
            return;
        }

        try {
            timerTriggerService.loadActiveTimerTriggers();
            log.info("Timer scheduler initialized with {} registered triggers",
                timerTriggerService.getRegistrySize());
        } catch (Exception e) {
            log.error("Failed to initialize timer scheduler: {}", e.getMessage(), e);
        }
    }

    /**
     * Scheduled method that runs every 60 seconds (configurable).
     * Checks all registered timer triggers and fires instances as needed.
     */
    @Scheduled(fixedRateString = "${metaplatform.process.timer.check-interval-ms:60000}")
    public void checkAndFireTimers() {
        if (!enabled) {
            return;
        }

        log.debug("Timer scheduler checking triggers...");
        try {
            timerTriggerService.checkAndFire();
        } catch (Exception e) {
            log.error("Error during timer check cycle: {}", e.getMessage(), e);
        }
    }
}
