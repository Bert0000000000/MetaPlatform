package com.metaplatform.wfe.taskoperation.service;

import com.metaplatform.wfe.common.TenantContext;
import com.metaplatform.wfe.taskoperation.dto.TaskHistoryEntry;
import com.metaplatform.wfe.taskoperation.entity.TaskAddSignEntity;
import com.metaplatform.wfe.taskoperation.entity.TaskDelegationEntity;
import com.metaplatform.wfe.taskoperation.entity.TaskUrgeEntity;
import com.metaplatform.wfe.taskoperation.repository.TaskAddSignRepository;
import com.metaplatform.wfe.taskoperation.repository.TaskDelegationRepository;
import com.metaplatform.wfe.taskoperation.repository.TaskUrgeRepository;
import lombok.RequiredArgsConstructor;
import org.flowable.engine.HistoryService;
import org.flowable.engine.history.HistoricActivityInstance;
import org.flowable.task.api.history.HistoricTaskInstance;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.Date;
import java.util.List;

@Service
@RequiredArgsConstructor
public class TaskHistoryService {

    private final HistoryService historyService;
    private final TaskDelegationRepository delegationRepository;
    private final TaskAddSignRepository addSignRepository;
    private final TaskUrgeRepository urgeRepository;

    @Transactional(readOnly = true)
    public List<TaskHistoryEntry> getHistory(String taskId) {
        String tenantId = TenantContext.get();
        List<TaskHistoryEntry> entries = new ArrayList<>();

        for (TaskDelegationEntity e : delegationRepository.findByTenantIdAndTaskIdOrderByCreatedAtDesc(tenantId, taskId)) {
            entries.add(TaskHistoryEntry.builder()
                    .type("DELEGATE")
                    .operator(e.getFromUser())
                    .targetUser(e.getToUser())
                    .reason(e.getReason())
                    .timestamp(e.getCreatedAt())
                    .build());
        }
        for (TaskAddSignEntity e : addSignRepository.findByTenantIdAndTaskIdOrderByCreatedAtDesc(tenantId, taskId)) {
            entries.add(TaskHistoryEntry.builder()
                    .type("ADDSIGN")
                    .targetUser(e.getAddsignUser())
                    .reason(e.getReason())
                    .status(e.getStatus())
                    .timestamp(e.getCreatedAt())
                    .build());
        }
        for (TaskUrgeEntity e : urgeRepository.findByTenantIdAndTaskIdOrderByCreatedAtDesc(tenantId, taskId)) {
            entries.add(TaskHistoryEntry.builder()
                    .type("URGE")
                    .targetUser(e.getUrgedUser())
                    .message(e.getMessage())
                    .timestamp(e.getCreatedAt())
                    .build());
        }

        // 叠加 Flowable 历史：审批意见 + 任务实例生命周期
        HistoricTaskInstance historic = historyService.createHistoricTaskInstanceQuery()
                .taskId(taskId).singleResult();
        if (historic != null) {
            entries.add(TaskHistoryEntry.builder()
                    .type("TASK_CREATED")
                    .operator(historic.getAssignee())
                    .timestamp(toInstant(historic.getCreateTime()))
                    .build());
            if (historic.getEndTime() != null) {
                entries.add(TaskHistoryEntry.builder()
                        .type("TASK_COMPLETED")
                        .operator(historic.getAssignee())
                        .timestamp(toInstant(historic.getEndTime()))
                        .build());
            }
            if (historic.getProcessInstanceId() != null) {
                List<HistoricActivityInstance> activities = historyService.createHistoricActivityInstanceQuery()
                        .processInstanceId(historic.getProcessInstanceId())
                        .list();
                for (HistoricActivityInstance a : activities) {
                    if (a.getEndTime() != null && taskId.equals(a.getTaskId())) {
                        entries.add(TaskHistoryEntry.builder()
                                .type("ACTIVITY_" + (a.getActivityType() != null ? a.getActivityType() : "UNKNOWN"))
                                .operator(a.getAssignee())
                                .timestamp(toInstant(a.getEndTime()))
                                .build());
                    }
                }
            }
        }

        entries.sort(Comparator.comparing(TaskHistoryEntry::getTimestamp,
                Comparator.nullsLast(Comparator.naturalOrder())));
        return entries;
    }

    private java.time.Instant toInstant(Date date) {
        return date != null ? date.toInstant() : null;
    }
}