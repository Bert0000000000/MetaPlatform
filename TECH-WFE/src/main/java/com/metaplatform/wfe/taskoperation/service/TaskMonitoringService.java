package com.metaplatform.wfe.taskoperation.service;

import com.metaplatform.wfe.common.TenantContext;
import com.metaplatform.wfe.entity.WfeTaskEntity;
import com.metaplatform.wfe.repository.WfeTaskRepository;
import com.metaplatform.wfe.taskoperation.dto.TaskMonitoringStatistics;
import com.metaplatform.wfe.taskoperation.repository.TaskAddSignRepository;
import com.metaplatform.wfe.taskoperation.repository.TaskDelegationRepository;
import com.metaplatform.wfe.taskoperation.repository.TaskUrgeRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class TaskMonitoringService {

    private static final long OVERDUE_MINUTES_DEFAULT = 60 * 24;
    private static final int AVG_SAMPLE_SIZE = 200;
    private static final String STATUS_ACTIVE = "ACTIVE";
    private static final String STATUS_COMPLETED = "COMPLETED";

    private final WfeTaskRepository wfeTaskRepository;
    private final TaskDelegationRepository delegationRepository;
    private final TaskAddSignRepository addSignRepository;
    private final TaskUrgeRepository urgeRepository;

    @Transactional(readOnly = true)
    public TaskMonitoringStatistics statistics() {
        String tenantId = TenantContext.get();

        long active = wfeTaskRepository.countByTenantIdAndStatus(tenantId, STATUS_ACTIVE);
        long completed = wfeTaskRepository.countByTenantIdAndStatus(tenantId, STATUS_COMPLETED);

        Instant overdueThreshold = Instant.now().minus(Duration.ofMinutes(OVERDUE_MINUTES_DEFAULT));
        long overdue = wfeTaskRepository.countByTenantIdAndStatusAndCreatedAtBefore(
                tenantId, STATUS_ACTIVE, overdueThreshold);

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
            // 取最近完成（COMPLETED）的任务，按完成时间倒序取前 AVG_SAMPLE_SIZE 条
            List<WfeTaskEntity> finished = wfeTaskRepository
                    .findByStatusAndCreatedAtBefore(STATUS_COMPLETED, Instant.now());
            if (finished.isEmpty()) {
                return 0;
            }
            List<WfeTaskEntity> sample = finished.stream()
                    .filter(t -> t.getCompletedAt() != null)
                    .sorted(Comparator.comparing(WfeTaskEntity::getCompletedAt,
                            Comparator.nullsLast(Comparator.reverseOrder())))
                    .limit(AVG_SAMPLE_SIZE)
                    .toList();
            if (sample.isEmpty()) {
                return 0;
            }
            long totalMinutes = 0;
            int count = 0;
            for (WfeTaskEntity t : sample) {
                Instant start = t.getCreatedAt();
                Instant end = t.getCompletedAt();
                if (start == null || end == null) {
                    continue;
                }
                long minutes = Duration.between(start, end).toMinutes();
                if (minutes < 0) {
                    continue;
                }
                totalMinutes += minutes;
                count++;
            }
            return count == 0 ? 0 : ((double) totalMinutes) / count;
        } catch (Exception e) {
            log.warn("Failed to compute average processing minutes: {}", e.getMessage());
            return 0;
        }
    }
}
