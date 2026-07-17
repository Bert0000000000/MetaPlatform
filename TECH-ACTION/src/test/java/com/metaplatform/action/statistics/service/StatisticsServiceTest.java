package com.metaplatform.action.statistics.service;

import com.metaplatform.action.common.ErrorCode;
import com.metaplatform.action.common.PageResponse;
import com.metaplatform.action.exception.ActionException;
import com.metaplatform.action.execution.entity.ExecutionEntity;
import com.metaplatform.action.execution.repository.ExecutionRepository;
import com.metaplatform.action.statistics.dto.ActionStats;
import com.metaplatform.action.statistics.dto.ExecutionHistoryItem;
import com.metaplatform.action.statistics.dto.StatsOverview;
import com.metaplatform.action.statistics.dto.TimelinePoint;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class StatisticsServiceTest {

    @Mock
    private ExecutionRepository executionRepository;

    @InjectMocks
    private StatisticsService statisticsService;

    @Test
    void getOverview_shouldAggregateExecutions() {
        Instant start = Instant.parse("2026-01-01T00:00:00Z");
        Instant end = Instant.parse("2026-01-02T00:00:00Z");
        when(executionRepository.findByTenantIdAndCreatedAtBetweenOrderByStartedAtDesc("tenant-default", start, end))
                .thenReturn(List.of(
                        buildExecution("exec-1", "act-1", "sendNotification", "COMPLETED", 100, start),
                        buildExecution("exec-2", "act-1", "sendNotification", "COMPLETED", 200, start),
                        buildExecution("exec-3", "act-2", "sendEmail", "FAILED", 50, start)));

        StatsOverview overview = statisticsService.getOverview("tenant-default", start, end);

        assertThat(overview.getTotalExecutions()).isEqualTo(3);
        assertThat(overview.getSuccessfulExecutions()).isEqualTo(2);
        assertThat(overview.getFailedExecutions()).isEqualTo(1);
        assertThat(overview.getSuccessRate()).isEqualTo(66.67);
        assertThat(overview.getAvgDurationMs()).isEqualTo(116L);
    }

    @Test
    void getOverview_shouldReturnZeros_whenNoData() {
        Instant start = Instant.parse("2026-01-01T00:00:00Z");
        Instant end = Instant.parse("2026-01-02T00:00:00Z");
        when(executionRepository.findByTenantIdAndCreatedAtBetweenOrderByStartedAtDesc("tenant-default", start, end))
                .thenReturn(List.of());

        StatsOverview overview = statisticsService.getOverview("tenant-default", start, end);

        assertThat(overview.getTotalExecutions()).isZero();
        assertThat(overview.getSuccessRate()).isZero();
        assertThat(overview.getAvgDurationMs()).isZero();
    }

    @Test
    void getStatsByAction_shouldGroupByActionId() {
        Instant start = Instant.parse("2026-01-01T00:00:00Z");
        Instant end = Instant.parse("2026-01-02T00:00:00Z");
        when(executionRepository.findByTenantIdAndCreatedAtBetweenOrderByStartedAtDesc("tenant-default", start, end))
                .thenReturn(List.of(
                        buildExecution("exec-1", "act-1", "sendNotification", "COMPLETED", 100, start),
                        buildExecution("exec-2", "act-1", "sendNotification", "FAILED", 200, start.plusSeconds(60)),
                        buildExecution("exec-3", "act-2", "sendEmail", "COMPLETED", 50, start)));

        List<ActionStats> stats = statisticsService.getStatsByAction("tenant-default", start, end);

        assertThat(stats).hasSize(2);
        ActionStats act1 = stats.stream().filter(s -> s.getActionId().equals("act-1")).findFirst().orElseThrow();
        assertThat(act1.getTotalExecutions()).isEqualTo(2);
        assertThat(act1.getSuccessRate()).isEqualTo(50.0);
        assertThat(act1.getAvgDurationMs()).isEqualTo(150L);
        assertThat(act1.getActionName()).isEqualTo("sendNotification");
    }

    @Test
    void getTimeline_shouldBucketByHour() {
        Instant start = Instant.parse("2026-01-01T00:00:00Z");
        Instant end = Instant.parse("2026-01-01T03:00:00Z");
        Instant hour0 = Instant.parse("2026-01-01T00:30:00Z");
        Instant hour1 = Instant.parse("2026-01-01T01:15:00Z");
        when(executionRepository.findByTenantIdAndCreatedAtBetweenOrderByStartedAtDesc("tenant-default", start, end))
                .thenReturn(List.of(
                        buildExecution("exec-1", "act-1", "sendNotification", "COMPLETED", 100, hour0),
                        buildExecution("exec-2", "act-1", "sendNotification", "FAILED", 200, hour1)));

        List<TimelinePoint> points = statisticsService.getTimeline("tenant-default", start, end, "HOUR");

        assertThat(points).hasSize(2);
        assertThat(points.get(0).getTimestamp()).isEqualTo(Instant.parse("2026-01-01T00:00:00Z"));
        assertThat(points.get(0).getExecutionCount()).isEqualTo(1);
        assertThat(points.get(0).getSuccessCount()).isEqualTo(1);
        assertThat(points.get(1).getTimestamp()).isEqualTo(Instant.parse("2026-01-01T01:00:00Z"));
        assertThat(points.get(1).getFailureCount()).isEqualTo(1);
    }

    @Test
    void getTimeline_shouldThrow_whenIntervalInvalid() {
        Instant start = Instant.parse("2026-01-01T00:00:00Z");
        Instant end = Instant.parse("2026-01-02T00:00:00Z");

        assertThatThrownBy(() -> statisticsService.getTimeline("tenant-default", start, end, "MINUTE"))
                .isInstanceOf(ActionException.class)
                .satisfies(e -> assertThat(((ActionException) e).getErrorCode())
                        .isEqualTo(ErrorCode.INVALID_PARAM));
    }

    @Test
    void getExecutionHistory_shouldReturnPagedResult() {
        Instant start = Instant.parse("2026-01-01T00:00:00Z");
        Page<ExecutionEntity> page = new PageImpl<>(List.of(
                buildExecution("exec-1", "act-1", "sendNotification", "COMPLETED", 100, start)));
        when(executionRepository.searchHistory(eq("tenant-default"), eq("act-1"), eq(null), any(Pageable.class)))
                .thenReturn(page);

        PageResponse<ExecutionHistoryItem> result =
                statisticsService.getExecutionHistory("tenant-default", "act-1", null, 1, 20);

        assertThat(result.getTotal()).isEqualTo(1);
        assertThat(result.getPage()).isEqualTo(1);
        assertThat(result.getItems()).hasSize(1);
        assertThat(result.getItems().get(0).getExecutionId()).isEqualTo("exec-1");
        assertThat(result.getItems().get(0).getActionName()).isEqualTo("sendNotification");
    }

    private ExecutionEntity buildExecution(String executionId, String actionId, String actionCode,
                                           String status, int durationMs, Instant createdAt) {
        return ExecutionEntity.builder()
                .tenantId("tenant-default")
                .executionId(executionId)
                .actionId(actionId)
                .actionCode(actionCode)
                .status(status)
                .input("{}")
                .traceId("trace-1")
                .durationMs(durationMs)
                .startedAt(createdAt)
                .createdAt(createdAt)
                .updatedAt(createdAt)
                .build();
    }
}
