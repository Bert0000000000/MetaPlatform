package com.metaplatform.wfe.taskoperation.service;

import com.metaplatform.wfe.common.TenantContext;
import com.metaplatform.wfe.taskoperation.dto.TaskMonitoringStatistics;
import com.metaplatform.wfe.taskoperation.repository.TaskAddSignRepository;
import com.metaplatform.wfe.taskoperation.repository.TaskDelegationRepository;
import com.metaplatform.wfe.taskoperation.repository.TaskUrgeRepository;
import lombok.RequiredArgsConstructor;
import org.flowable.engine.HistoryService;
import org.flowable.engine.TaskService;
import org.flowable.task.api.TaskQuery;
import org.flowable.task.api.history.HistoricTaskInstance;
import org.flowable.task.api.history.HistoricTaskInstanceQuery;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Date;
import java.util.List;

@Service
@RequiredArgsConstructor
public class TaskMonitoringService {

    private static final long OVERDUE_MINUTES_DEFAULT = 60 * 24;

    private final TaskService taskService;
    private final HistoryService historyService;
    private final TaskDelegationRepository delegationRepository;
    private final TaskAddSignRepository addSignRepository;
    private final TaskUrgeRepository urgeRepository;

    @Transactional(readOnly = true)
    public TaskMonitoringStatistics statistics() {
        String tenantId = TenantContext.get();

        TaskQuery activeQuery = taskService.createTaskQuery().active();
        long active = activeQuery.count();

        HistoricTaskInstanceQuery completedQuery = historyService.createHistoricTaskInstanceQuery()
                .finished();
        long completed = completedQuery.count();

        Instant overdueThreshold = Instant.now().minus(Duration.ofMinutes(OVERDUE_MINUTES_DEFAULT));
        long overdue = taskService.createTaskQuery()
                .active()
                .taskCreatedBefore(Date.from(overdueThreshold))
                .count();

        double avgMinutes = averageProcessingMinutes();

        return TaskMonitoringStatistics.builder()
                .totalActive(active)
                .totalCompleted(completed)
                .totalOverdue(overdue)
                .avgProcessingMinutes(avgMinutes)
                .delegations(delegationRepository.count())
                .addSigns(addSignRepository.count())
                .urges(urgeRepository.count())
                .build();
    }

    private double averageProcessingMinutes() {
        try {
            List<HistoricTaskInstance> recent = historyService.createHistoricTaskInstanceQuery()
                    .finished()
                    .orderByHistoricTaskInstanceEndTime()
                    .desc()
                    .listPage(0, 200);
            if (recent.isEmpty()) {
                return 0;
            }
            long totalMinutes = 0;
            int count = 0;
            Instant now = Instant.now();
            for (HistoricTaskInstance h : recent) {
                Date start = h.getCreateTime();
                Date end = h.getEndTime();
                if (start == null || end == null) continue;
                long minutes = Duration.between(start.toInstant(), end.toInstant()).toMinutes();
                if (minutes < 0) continue;
                totalMinutes += minutes;
                count++;
            }
            return count == 0 ? 0 : ((double) totalMinutes) / count;
        } catch (Exception e) {
            return 0;
        }
    }
}