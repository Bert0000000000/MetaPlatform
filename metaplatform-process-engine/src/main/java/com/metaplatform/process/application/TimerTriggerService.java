package com.metaplatform.process.application;

import com.metaplatform.process.domain.ProcessDefinition;
import com.metaplatform.process.domain.ProcessInstance;
import com.metaplatform.process.domain.dsl.ProcessDsl;
import com.metaplatform.process.domain.enums.DefinitionStatus;
import com.metaplatform.process.domain.enums.HistoryEventType;
import com.metaplatform.process.domain.repository.ProcessDefinitionRepository;
import com.metaplatform.process.domain.repository.ProcessHistoryRepository;
import com.metaplatform.process.domain.repository.ProcessInstanceRepository;
import com.metaplatform.process.infrastructure.exception.ProcessEngineException;
import com.metaplatform.process.infrastructure.util.JsonUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.support.CronExpression;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Service for managing timer/CRON-based process triggers.
 * Maintains an in-memory registry of timer triggers and checks
 * periodically whether any trigger should fire.
 */
@Service
public class TimerTriggerService {

    private static final Logger log = LoggerFactory.getLogger(TimerTriggerService.class);

    private final ProcessDefinitionRepository definitionRepository;
    private final ProcessEngine processEngine;
    private final ProcessInstanceRepository instanceRepository;
    private final ProcessHistoryRepository historyRepository;

    /** Registry of timer triggers: definitionId -> cron details */
    private final Map<Long, TimerRegistration> timerRegistry = new ConcurrentHashMap<>();

    /** Track last fire time per definition to prevent double-firing */
    private final Map<Long, LocalDateTime> lastFireTime = new ConcurrentHashMap<>();

    public TimerTriggerService(ProcessDefinitionRepository definitionRepository,
                                ProcessEngine processEngine,
                                ProcessInstanceRepository instanceRepository,
                                ProcessHistoryRepository historyRepository) {
        this.definitionRepository = definitionRepository;
        this.processEngine = processEngine;
        this.instanceRepository = instanceRepository;
        this.historyRepository = historyRepository;
    }

    /**
     * Register a timer trigger for a process definition.
     *
     * @param definitionId   the process definition ID
     * @param cronExpression the cron expression (Spring 6 cron format: sec min hour day month weekday)
     */
    public void registerTimer(Long definitionId, String cronExpression) {
        if (definitionId == null) {
            throw new ProcessEngineException("Definition ID cannot be null");
        }
        if (cronExpression == null || cronExpression.isBlank()) {
            throw new ProcessEngineException("Cron expression cannot be null or empty");
        }

        // Validate cron expression
        try {
            CronExpression.parse(cronExpression);
        } catch (Exception e) {
            throw new ProcessEngineException("Invalid cron expression: " + cronExpression + " - " + e.getMessage(), e);
        }

        // Verify definition exists
        ProcessDefinition definition = definitionRepository.findById(definitionId)
            .orElseThrow(() -> new ProcessEngineException("Process definition not found: " + definitionId));

        TimerRegistration registration = new TimerRegistration(
            definitionId, definition.getCode(), cronExpression, LocalDateTime.now());
        timerRegistry.put(definitionId, registration);

        log.info("Registered timer trigger for definition '{}' (id={}): cron='{}'",
            definition.getCode(), definitionId, cronExpression);
    }

    /**
     * Unregister a timer trigger.
     */
    public void unregisterTimer(Long definitionId) {
        timerRegistry.remove(definitionId);
        lastFireTime.remove(definitionId);
        log.info("Unregistered timer trigger for definition id={}", definitionId);
    }

    /**
     * Called periodically by the scheduler. Checks all registered timer triggers
     * and fires instances for those whose cron expression matches the current time.
     */
    public void checkAndFire() {
        LocalDateTime now = LocalDateTime.now();
        log.debug("Checking {} timer triggers at {}", timerRegistry.size(), now);

        for (Map.Entry<Long, TimerRegistration> entry : timerRegistry.entrySet()) {
            Long definitionId = entry.getKey();
            TimerRegistration registration = entry.getValue();

            try {
                CronExpression cron = CronExpression.parse(registration.cronExpression());
                LocalDateTime lastRun = lastFireTime.get(definitionId);

                // Check if we should fire at this minute
                LocalDateTime nextFireTime = cron.next(
                    lastRun != null ? lastRun : now.minusMinutes(1));

                if (nextFireTime != null && !nextFireTime.isAfter(now)) {
                    // Prevent double-firing within the same minute
                    LocalDateTime existing = lastFireTime.putIfAbsent(definitionId, now);
                    if (existing != null && existing.plusMinutes(1).isAfter(now)) {
                        continue;
                    }

                    fireProcess(definitionId, registration);
                    lastFireTime.put(definitionId, now);
                }
            } catch (Exception e) {
                log.error("Error checking timer trigger for definition '{}' (id={}): {}",
                    registration.definitionCode(), definitionId, e.getMessage(), e);
            }
        }
    }

    /**
     * Fire a new process instance for the given definition.
     */
    private void fireProcess(Long definitionId, TimerRegistration registration) {
        log.info("Timer trigger fired for definition '{}' (id={})",
            registration.definitionCode(), definitionId);

        try {
            ProcessInstance instance = processEngine.startProcess(
                registration.definitionCode(),
                "TIMER_SYSTEM",
                "timer-" + definitionId + "-" + System.currentTimeMillis(),
                Map.of("triggerType", "TIMER", "firedAt", LocalDateTime.now().toString())
            );

            log.info("Timer-triggered process instance created: instanceId={}", instance.getId());
        } catch (Exception e) {
            log.error("Failed to fire timer-triggered process for definition '{}' (id={}): {}",
                registration.definitionCode(), definitionId, e.getMessage(), e);
        }
    }

    /**
     * Load all active definitions with TIMER triggers from the database
     * and register them.
     */
    public void loadActiveTimerTriggers() {
        List<ProcessDefinition> timerDefinitions =
            definitionRepository.findByTriggerTypeAndStatus("TIMER", DefinitionStatus.ACTIVE);

        for (ProcessDefinition def : timerDefinitions) {
            String cronExpr = def.getTriggerConfig();
            if (cronExpr != null && !cronExpr.isBlank()) {
                registerTimer(def.getId(), cronExpr);
            }
        }

        log.info("Loaded {} active timer triggers from database", timerDefinitions.size());
    }

    /**
     * Get current registry size.
     */
    public int getRegistrySize() {
        return timerRegistry.size();
    }

    /**
     * Get all registered timer definitions.
     */
    public Map<Long, TimerRegistration> getRegisteredTimers() {
        return Collections.unmodifiableMap(timerRegistry);
    }

    /**
     * Timer registration record.
     */
    public record TimerRegistration(
        Long definitionId,
        String definitionCode,
        String cronExpression,
        LocalDateTime registeredAt
    ) {}
}
