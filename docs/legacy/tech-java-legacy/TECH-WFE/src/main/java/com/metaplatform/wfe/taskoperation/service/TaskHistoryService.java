package com.metaplatform.wfe.taskoperation.service;

import com.metaplatform.wfe.common.TenantContext;
import com.metaplatform.wfe.entity.WfeActivityLogEntity;
import com.metaplatform.wfe.entity.WfeTaskEntity;
import com.metaplatform.wfe.entity.WfeTaskHistoryEntity;
import com.metaplatform.wfe.repository.WfeActivityLogRepository;
import com.metaplatform.wfe.repository.WfeTaskHistoryRepository;
import com.metaplatform.wfe.repository.WfeTaskRepository;
import com.metaplatform.wfe.taskoperation.dto.TaskHistoryEntry;
import com.metaplatform.wfe.taskoperation.entity.TaskAddSignEntity;
import com.metaplatform.wfe.taskoperation.entity.TaskDelegationEntity;
import com.metaplatform.wfe.taskoperation.entity.TaskUrgeEntity;
import com.metaplatform.wfe.taskoperation.repository.TaskAddSignRepository;
import com.metaplatform.wfe.taskoperation.repository.TaskDelegationRepository;
import com.metaplatform.wfe.taskoperation.repository.TaskUrgeRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class TaskHistoryService {

    private final WfeTaskRepository wfeTaskRepository;
    private final WfeTaskHistoryRepository wfeTaskHistoryRepository;
    private final WfeActivityLogRepository wfeActivityLogRepository;
    private final TaskDelegationRepository delegationRepository;
    private final TaskAddSignRepository addSignRepository;
    private final TaskUrgeRepository urgeRepository;

    @Transactional(readOnly = true)
    public List<TaskHistoryEntry> getHistory(String taskId) {
        String tenantId = TenantContext.get();
        List<TaskHistoryEntry> entries = new ArrayList<>();

        // 1. 本地操作历史：DELEGATE / ADDSIGN / URGE
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

        // 2. 任务实例生命周期：从自研任务表取任务创建/完成时间
        wfeTaskRepository.findById(taskId).ifPresent(task -> {
            entries.add(TaskHistoryEntry.builder()
                    .type("TASK_CREATED")
                    .operator(task.getAssignee())
                    .timestamp(task.getCreatedAt())
                    .build());
            if (task.getCompletedAt() != null) {
                entries.add(TaskHistoryEntry.builder()
                        .type("TASK_COMPLETED")
                        .operator(task.getAssignee())
                        .timestamp(task.getCompletedAt())
                        .build());
            }
        });

        // 3. 任务操作历史：APPROVE / REJECT / TRANSFER / RETURN
        for (WfeTaskHistoryEntity h : wfeTaskHistoryRepository
                .findByTenantIdAndTaskIdOrderByCreatedAtDesc(tenantId, taskId)) {
            entries.add(TaskHistoryEntry.builder()
                    .type(h.getAction())
                    .operator(h.getOperator())
                    .reason(h.getComment())
                    .timestamp(h.getCreatedAt())
                    .build());
        }

        // 4. 活动日志：ACTIVITY_xxx（流程级别的活动记录，按 taskId 过滤）
        wfeTaskRepository.findById(taskId).ifPresent(task -> {
            if (task.getProcessInstanceId() != null) {
                List<WfeActivityLogEntity> activities = wfeActivityLogRepository
                        .findByTenantIdAndProcessInstanceIdAndTaskId(
                                tenantId, task.getProcessInstanceId(), taskId);
                for (WfeActivityLogEntity a : activities) {
                    entries.add(TaskHistoryEntry.builder()
                            .type("ACTIVITY_" + (a.getActivityType() != null ? a.getActivityType() : "UNKNOWN"))
                            .operator(a.getAssignee())
                            .timestamp(a.getEnteredAt())
                            .build());
                }
            }
        });

        entries.sort(Comparator.comparing(TaskHistoryEntry::getTimestamp,
                Comparator.nullsLast(Comparator.naturalOrder())));
        return entries;
    }
}
