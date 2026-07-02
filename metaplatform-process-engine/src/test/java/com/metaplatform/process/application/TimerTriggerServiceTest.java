package com.metaplatform.process.application;

import com.metaplatform.process.domain.ProcessDefinition;
import com.metaplatform.process.domain.ProcessInstance;
import com.metaplatform.process.domain.enums.DefinitionStatus;
import com.metaplatform.process.domain.repository.ProcessDefinitionRepository;
import com.metaplatform.process.domain.repository.ProcessHistoryRepository;
import com.metaplatform.process.domain.repository.ProcessInstanceRepository;
import com.metaplatform.process.infrastructure.exception.ProcessEngineException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Unit tests for timer trigger registration and firing.
 */
@ExtendWith(MockitoExtension.class)
class TimerTriggerServiceTest {

    @Mock
    private ProcessDefinitionRepository definitionRepository;
    @Mock
    private ProcessEngine processEngine;
    @Mock
    private ProcessInstanceRepository instanceRepository;
    @Mock
    private ProcessHistoryRepository historyRepository;

    private TimerTriggerService timerTriggerService;

    @BeforeEach
    void setUp() {
        timerTriggerService = new TimerTriggerService(
            definitionRepository, processEngine, instanceRepository, historyRepository);
    }

    @Test
    void registerTimerSuccessfully() {
        // Setup
        ProcessDefinition def = new ProcessDefinition();
        def.setId(1L);
        def.setCode("daily_report");
        def.setStatus(DefinitionStatus.ACTIVE);

        when(definitionRepository.findById(1L)).thenReturn(Optional.of(def));

        // Execute
        timerTriggerService.registerTimer(1L, "0 0 8 * * *");

        // Verify
        assertEquals(1, timerTriggerService.getRegistrySize());
        assertTrue(timerTriggerService.getRegisteredTimers().containsKey(1L));

        TimerTriggerService.TimerRegistration registration = timerTriggerService.getRegisteredTimers().get(1L);
        assertEquals("daily_report", registration.definitionCode());
        assertEquals("0 0 8 * * *", registration.cronExpression());
    }

    @Test
    void registerTimerWithInvalidCronThrows() {
        when(definitionRepository.findById(1L)).thenReturn(Optional.of(new ProcessDefinition()));

        assertThrows(ProcessEngineException.class,
            () -> timerTriggerService.registerTimer(1L, "invalid cron"));
    }

    @Test
    void registerTimerWithNullDefinitionIdThrows() {
        assertThrows(ProcessEngineException.class,
            () -> timerTriggerService.registerTimer(null, "0 0 8 * * *"));
    }

    @Test
    void registerTimerWithEmptyCronThrows() {
        assertThrows(ProcessEngineException.class,
            () -> timerTriggerService.registerTimer(1L, ""));
        assertThrows(ProcessEngineException.class,
            () -> timerTriggerService.registerTimer(1L, null));
    }

    @Test
    void registerTimerWithNonexistentDefinitionThrows() {
        when(definitionRepository.findById(999L)).thenReturn(Optional.empty());

        assertThrows(ProcessEngineException.class,
            () -> timerTriggerService.registerTimer(999L, "0 0 8 * * *"));
    }

    @Test
    void unregisterTimerRemovesFromRegistry() {
        // Setup
        ProcessDefinition def = new ProcessDefinition();
        def.setId(1L);
        def.setCode("daily_report");

        when(definitionRepository.findById(1L)).thenReturn(Optional.of(def));
        timerTriggerService.registerTimer(1L, "0 0 8 * * *");
        assertEquals(1, timerTriggerService.getRegistrySize());

        // Execute
        timerTriggerService.unregisterTimer(1L);

        // Verify
        assertEquals(0, timerTriggerService.getRegistrySize());
        assertFalse(timerTriggerService.getRegisteredTimers().containsKey(1L));
    }

    @Test
    void checkAndFireTriggersRegisteredProcess() {
        // Setup: register a timer that fires every minute
        ProcessDefinition def = new ProcessDefinition();
        def.setId(1L);
        def.setCode("minute_process");

        when(definitionRepository.findById(1L)).thenReturn(Optional.of(def));
        timerTriggerService.registerTimer(1L, "0 * * * * *");

        ProcessInstance instance = new ProcessInstance();
        instance.setId(100L);

        when(processEngine.startProcess(eq("minute_process"), eq("TIMER_SYSTEM"),
            anyString(), anyMap()))
            .thenReturn(instance);

        // Execute
        timerTriggerService.checkAndFire();

        // Verify: process was started
        verify(processEngine).startProcess(eq("minute_process"), eq("TIMER_SYSTEM"),
            anyString(), anyMap());
    }

    @Test
    void loadActiveTimerTriggersFromDatabase() {
        // Setup
        ProcessDefinition def1 = new ProcessDefinition();
        def1.setId(1L);
        def1.setCode("daily_report");
        def1.setTriggerType("TIMER");
        def1.setTriggerConfig("0 0 8 * * *");

        ProcessDefinition def2 = new ProcessDefinition();
        def2.setId(2L);
        def2.setCode("weekly_summary");
        def2.setTriggerType("TIMER");
        def2.setTriggerConfig("0 0 9 * * MON");

        when(definitionRepository.findByTriggerTypeAndStatus("TIMER", DefinitionStatus.ACTIVE))
            .thenReturn(List.of(def1, def2));

        // Execute
        timerTriggerService.loadActiveTimerTriggers();

        // Verify
        assertEquals(2, timerTriggerService.getRegistrySize());
        verify(definitionRepository).findByTriggerTypeAndStatus("TIMER", DefinitionStatus.ACTIVE);
    }

    @Test
    void loadActiveTimerTriggersSkipsDefinitionsWithoutCron() {
        // Setup
        ProcessDefinition def1 = new ProcessDefinition();
        def1.setId(1L);
        def1.setCode("daily_report");
        def1.setTriggerType("TIMER");
        def1.setTriggerConfig(null); // no cron

        when(definitionRepository.findByTriggerTypeAndStatus("TIMER", DefinitionStatus.ACTIVE))
            .thenReturn(List.of(def1));

        // Execute
        timerTriggerService.loadActiveTimerTriggers();

        // Verify: skipped because no cron expression
        assertEquals(0, timerTriggerService.getRegistrySize());
    }

    @Test
    void multipleTimerRegistrations() {
        // Setup
        for (long i = 1; i <= 5; i++) {
            ProcessDefinition def = new ProcessDefinition();
            def.setId(i);
            def.setCode("process_" + i);
            when(definitionRepository.findById(i)).thenReturn(Optional.of(def));
            timerTriggerService.registerTimer(i, "0 0 " + i + " * * *");
        }

        // Verify
        assertEquals(5, timerTriggerService.getRegistrySize());
    }
}
