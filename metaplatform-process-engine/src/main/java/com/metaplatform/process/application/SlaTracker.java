package com.metaplatform.process.application;

import com.metaplatform.process.domain.ProcessDefinition;
import com.metaplatform.process.domain.ProcessHistoryEvent;
import com.metaplatform.process.domain.ProcessInstance;
import com.metaplatform.process.domain.ProcessTask;
import com.metaplatform.process.domain.dsl.ProcessDsl;
import com.metaplatform.process.domain.dsl.ProcessNode;
import com.metaplatform.process.domain.dsl.SlaConfig;
import com.metaplatform.process.domain.enums.HistoryEventType;
import com.metaplatform.process.domain.enums.TaskStatus;
import com.metaplatform.process.domain.repository.ProcessDefinitionRepository;
import com.metaplatform.process.domain.repository.ProcessHistoryRepository;
import com.metaplatform.process.domain.repository.ProcessInstanceRepository;
import com.metaplatform.process.domain.repository.ProcessTaskRepository;
import com.metaplatform.process.infrastructure.util.JsonUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Service
public class SlaTracker {

    private static final Logger log = LoggerFactory.getLogger(SlaTracker.class);

    private final ProcessTaskRepository taskRepository;
    private final ProcessInstanceRepository instanceRepository;
    private final ProcessDefinitionRepository definitionRepository;
    private final ProcessHistoryRepository historyRepository;
    private final DslParser dslParser;

    public SlaTracker(ProcessTaskRepository taskRepository,
                       ProcessInstanceRepository instanceRepository,
                       ProcessDefinitionRepository definitionRepository,
                       ProcessHistoryRepository historyRepository,
                       DslParser dslParser) {
        this.taskRepository = taskRepository;
        this.instanceRepository = instanceRepository;
        this.definitionRepository = definitionRepository;
        this.historyRepository = historyRepository;
        this.dslParser = dslParser;
    }

    /**
     * Scheduled SLA check - every 5 minutes
     */
    @Scheduled(fixedRate = 300000)
    @Transactional
    public void checkSlaBreaches() {
        LocalDateTime now = LocalDateTime.now();

        // Find overdue PENDING tasks
        List<ProcessTask> overdueTasks = taskRepository
            .findByStatusAndDueDateBefore(TaskStatus.PENDING, now);

        for (ProcessTask task : overdueTasks) {
            try {
                handleSlaBreach(task);
            } catch (Exception e) {
                log.error("Failed to handle SLA breach for task {}: {}", task.getId(), e.getMessage(), e);
            }
        }
    }

    /**
     * Handle SLA breach
     */
    private void handleSlaBreach(ProcessTask task) {
        ProcessInstance instance = instanceRepository.findById(task.getInstanceId()).orElse(null);
        if (instance == null) return;

        // Record SLA breach history
        ProcessHistoryEvent event = new ProcessHistoryEvent();
        event.setInstanceId(instance.getId());
        event.setEventType(HistoryEventType.SLA_BREACHED);
        event.setNodeId(task.getNodeId());
        event.setActorId("SYSTEM");
        event.setDetail(JsonUtils.toJson(Map.of("taskId", task.getId(), "dueDate", task.getDueDate().toString())));
        event.setTimestamp(LocalDateTime.now());
        historyRepository.save(event);

        log.warn("SLA breached for task {} in instance {}", task.getId(), instance.getId());
    }

    /**
     * Setup SLA check (called when task is created)
     */
    public void scheduleCheck(ProcessTask task, SlaConfig slaConfig) {
        // Task dueDate is already set by ProcessEngine
        // SLA check is handled by the scheduled task above
        log.info("SLA scheduled for task {} with due date {}", task.getId(), task.getDueDate());
    }
}
