package com.metaplatform.action.statistics.service;

import com.metaplatform.action.common.ErrorCode;
import com.metaplatform.action.common.PageResponse;
import com.metaplatform.action.common.TenantContext;
import com.metaplatform.action.exception.ActionException;
import com.metaplatform.action.execution.entity.ExecutionEntity;
import com.metaplatform.action.execution.repository.ExecutionRepository;
import com.metaplatform.action.statistics.dto.ActionStats;
import com.metaplatform.action.statistics.dto.ExecutionHistoryItem;
import com.metaplatform.action.statistics.dto.StatsOverview;
import com.metaplatform.action.statistics.dto.TimelinePoint;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class StatisticsService {

    public static final String INTERVAL_HOUR = "HOUR";
    public static final String INTERVAL_DAY = "DAY";

    private static final String STATUS_COMPLETED = "COMPLETED";
    private static final String STATUS_FAILED = "FAILED";

    private final ExecutionRepository executionRepository;

    @Transactional(readOnly = true)
    public StatsOverview getOverview(String tenantId, Instant startTime, Instant endTime) {
        Instant[] range = resolveRange(startTime, endTime);
        List<ExecutionEntity> executions = executionRepository
                .findByTenantIdAndCreatedAtBetweenOrderByStartedAtDesc(tenantId, range[0], range[1]);

        long total = executions.size();
        long success = executions.stream().filter(e -> STATUS_COMPLETED.equals(e.getStatus())).count();
        long failed = executions.stream().filter(e -> STATUS_FAILED.equals(e.getStatus())).count();
        double successRate = total == 0 ? 0.0 : success * 100.0 / total;
        long avgDurationMs = (long) executions.stream()
                .map(ExecutionEntity::getDurationMs)
                .filter(java.util.Objects::nonNull)
                .mapToInt(Integer::intValue)
                .average()
                .orElse(0.0);

        return StatsOverview.builder()
                .totalExecutions(total)
                .successfulExecutions(success)
                .failedExecutions(failed)
                .successRate(Math.round(successRate * 100.0) / 100.0)
                .avgDurationMs(avgDurationMs)
                .build();
    }

    @Transactional(readOnly = true)
    public List<ActionStats> getStatsByAction(String tenantId, Instant startTime, Instant endTime) {
        Instant[] range = resolveRange(startTime, endTime);
        List<ExecutionEntity> executions = executionRepository
                .findByTenantIdAndCreatedAtBetweenOrderByStartedAtDesc(tenantId, range[0], range[1]);

        Map<String, List<ExecutionEntity>> grouped = new LinkedHashMap<>();
        for (ExecutionEntity e : executions) {
            grouped.computeIfAbsent(e.getActionId(), k -> new ArrayList<>()).add(e);
        }

        List<ActionStats> stats = new ArrayList<>();
        for (Map.Entry<String, List<ExecutionEntity>> entry : grouped.entrySet()) {
            List<ExecutionEntity> group = entry.getValue();
            long total = group.size();
            long success = group.stream().filter(e -> STATUS_COMPLETED.equals(e.getStatus())).count();
            double successRate = total == 0 ? 0.0 : success * 100.0 / total;
            long avgDurationMs = (long) group.stream()
                    .map(ExecutionEntity::getDurationMs)
                    .filter(java.util.Objects::nonNull)
                    .mapToInt(Integer::intValue)
                    .average()
                    .orElse(0.0);
            Instant lastExecutedAt = group.stream()
                    .map(ExecutionEntity::getStartedAt)
                    .filter(java.util.Objects::nonNull)
                    .max(Comparator.naturalOrder())
                    .orElse(null);
            String actionName = group.stream()
                    .map(ExecutionEntity::getActionCode)
                    .filter(java.util.Objects::nonNull)
                    .findFirst()
                    .orElse(null);

            stats.add(ActionStats.builder()
                    .actionId(entry.getKey())
                    .actionName(actionName)
                    .totalExecutions(total)
                    .successRate(Math.round(successRate * 100.0) / 100.0)
                    .avgDurationMs(avgDurationMs)
                    .lastExecutedAt(lastExecutedAt)
                    .build());
        }
        return stats;
    }

    @Transactional(readOnly = true)
    public List<TimelinePoint> getTimeline(String tenantId, Instant startTime, Instant endTime, String interval) {
        Instant[] range = resolveRange(startTime, endTime);
        ChronoUnit unit = resolveInterval(interval);
        List<ExecutionEntity> executions = executionRepository
                .findByTenantIdAndCreatedAtBetweenOrderByStartedAtDesc(tenantId, range[0], range[1]);

        Map<Instant, long[]> buckets = new LinkedHashMap<>();
        for (ExecutionEntity e : executions) {
            Instant bucket = e.getCreatedAt() == null ? range[0] : e.getCreatedAt().truncatedTo(unit);
            long[] counts = buckets.computeIfAbsent(bucket, k -> new long[3]);
            counts[0]++;
            if (STATUS_COMPLETED.equals(e.getStatus())) {
                counts[1]++;
            } else if (STATUS_FAILED.equals(e.getStatus())) {
                counts[2]++;
            }
        }

        List<TimelinePoint> points = new ArrayList<>();
        for (Map.Entry<Instant, long[]> entry : buckets.entrySet()) {
            long[] counts = entry.getValue();
            points.add(TimelinePoint.builder()
                    .timestamp(entry.getKey())
                    .executionCount(counts[0])
                    .successCount(counts[1])
                    .failureCount(counts[2])
                    .build());
        }
        points.sort(Comparator.comparing(TimelinePoint::getTimestamp));
        return points;
    }

    @Transactional(readOnly = true)
    public PageResponse<ExecutionHistoryItem> getExecutionHistory(String tenantId, String actionId,
                                                                  String status, Integer page, Integer size) {
        int p = page == null || page < 1 ? 1 : page;
        int s = size == null || size < 1 ? 20 : Math.min(size, 100);
        Pageable pageable = PageRequest.of(p - 1, s);
        Page<ExecutionEntity> result = executionRepository.searchHistory(tenantId, actionId, status, pageable);

        return PageResponse.<ExecutionHistoryItem>builder()
                .items(result.getContent().stream().map(this::toHistoryItem).toList())
                .total(result.getTotalElements())
                .page(p)
                .size(s)
                .totalPages(result.getTotalPages())
                .build();
    }

    private ExecutionHistoryItem toHistoryItem(ExecutionEntity e) {
        return ExecutionHistoryItem.builder()
                .executionId(e.getExecutionId())
                .actionId(e.getActionId())
                .actionName(e.getActionCode())
                .status(e.getStatus())
                .durationMs(e.getDurationMs())
                .startedAt(e.getStartedAt())
                .errorMessage(e.getErrorMessage())
                .build();
    }

    private ChronoUnit resolveInterval(String interval) {
        if (interval == null || interval.isBlank() || INTERVAL_HOUR.equalsIgnoreCase(interval)) {
            return ChronoUnit.HOURS;
        }
        if (INTERVAL_DAY.equalsIgnoreCase(interval)) {
            return ChronoUnit.DAYS;
        }
        throw new ActionException(ErrorCode.INVALID_PARAM, "interval 非法: " + interval + "，允许: HOUR/DAY");
    }

    private Instant[] resolveRange(Instant startTime, Instant endTime) {
        Instant start = startTime == null ? Instant.EPOCH : startTime;
        Instant end = endTime == null ? Instant.now() : endTime;
        if (start.isAfter(end)) {
            throw new ActionException(ErrorCode.INVALID_PARAM, "startTime 不能晚于 endTime");
        }
        return new Instant[]{start, end};
    }
}
