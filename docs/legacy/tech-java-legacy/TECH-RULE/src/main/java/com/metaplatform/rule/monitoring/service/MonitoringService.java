package com.metaplatform.rule.monitoring.service;

import com.metaplatform.rule.common.PageResponse;
import com.metaplatform.rule.common.TenantContext;
import com.metaplatform.rule.monitoring.dto.ExecutionHistoryItem;
import com.metaplatform.rule.monitoring.dto.MonitoringOverview;
import com.metaplatform.rule.monitoring.dto.RuleStats;
import com.metaplatform.rule.monitoring.entity.ExecutionLogEntity;
import com.metaplatform.rule.monitoring.repository.ExecutionLogRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class MonitoringService {

    private final ExecutionLogRepository executionLogRepository;

    /**
     * P1-1 修复：avgExecutionTimeMs 取自全部日志的 AVG(executionTimeMs)，
     * 而非原来的 findByTenantIdAndErrorMessageIsNotNull（仅取错误日志）。
     */
    @Transactional(readOnly = true)
    public MonitoringOverview overview() {
        String tenantId = TenantContext.get();
        long total = executionLogRepository.countByTenantId(tenantId);
        long matched = executionLogRepository.countByTenantIdAndMatchedTrue(tenantId);
        long errors = executionLogRepository.countByTenantIdAndErrorMessageIsNotNull(tenantId);

        double matchRate = total > 0 ? (double) matched / total * 100 : 0;
        double errorRate = total > 0 ? (double) errors / total * 100 : 0;

        Double avgTimeRaw = executionLogRepository.findAvgExecutionTimeByTenantId(tenantId);
        double avgTime = avgTimeRaw != null ? avgTimeRaw : 0.0;

        return MonitoringOverview.builder()
                .totalExecutions(total)
                .matchedExecutions(matched)
                .errorExecutions(errors)
                .matchRate(matchRate)
                .errorRate(errorRate)
                .avgExecutionTimeMs(avgTime)
                .build();
    }

    /**
     * P1-1 修复：原实现 findAll() 跨租户全表扫描后内存过滤，
     * 改为按租户查询 distinct ruleId 后逐规则聚合（数据库侧过滤 + 聚合）。
     */
    @Transactional(readOnly = true)
    public List<RuleStats> byRule() {
        String tenantId = TenantContext.get();
        List<String> ruleIds = executionLogRepository.findDistinctRuleIdsByTenantId(tenantId);
        List<RuleStats> stats = new ArrayList<>();
        for (String ruleId : ruleIds) {
            Object[] row = executionLogRepository.aggregateByTenantIdAndRuleId(tenantId, ruleId);
            if (row == null || row.length < 4) {
                continue;
            }
            long total = ((Number) row[0]).longValue();
            long matched = ((Number) row[1]).longValue();
            long errors = ((Number) row[2]).longValue();
            double avgTime = ((Number) row[3]).doubleValue();
            stats.add(RuleStats.builder()
                    .ruleId(ruleId)
                    .totalExecutions(total)
                    .matchedExecutions(matched)
                    .errorExecutions(errors)
                    .matchRate(total > 0 ? (double) matched / total * 100 : 0)
                    .avgExecutionTimeMs(avgTime)
                    .build());
        }
        return stats;
    }

    @Transactional(readOnly = true)
    public PageResponse<ExecutionHistoryItem> errors(int page, int pageSize) {
        String tenantId = TenantContext.get();
        PageRequest pageRequest = PageRequest.of(Math.max(0, page - 1), Math.max(1, pageSize));
        Page<ExecutionLogEntity> result =
                executionLogRepository.findByTenantIdAndErrorMessageIsNotNullOrderByCreatedAtDesc(tenantId, pageRequest);

        return PageResponse.<ExecutionHistoryItem>builder()
                .items(result.getContent().stream().map(this::toHistoryItem).toList())
                .total(result.getTotalElements())
                .page(page)
                .pageSize(pageSize)
                .totalPages(result.getTotalPages())
                .build();
    }

    @Transactional(readOnly = true)
    public PageResponse<ExecutionHistoryItem> history(Instant start, Instant end, int page, int pageSize) {
        String tenantId = TenantContext.get();
        Instant now = Instant.now();
        Instant from = start != null ? start : now.minusSeconds(86400 * 7);
        Instant to = end != null ? end : now;
        PageRequest pageRequest = PageRequest.of(Math.max(0, page - 1), Math.max(1, pageSize));

        Page<ExecutionLogEntity> result =
                executionLogRepository.findByTenantIdAndCreatedAtBetweenOrderByCreatedAtDesc(
                        tenantId, from, to, pageRequest);

        return PageResponse.<ExecutionHistoryItem>builder()
                .items(result.getContent().stream().map(this::toHistoryItem).toList())
                .total(result.getTotalElements())
                .page(page)
                .pageSize(pageSize)
                .totalPages(result.getTotalPages())
                .build();
    }

    /**
     * P1-1：单规则统计也走数据库聚合（替代原 1000 条内存平均）。
     */
    @Transactional(readOnly = true)
    public RuleStats singleRuleStats(String ruleId) {
        String tenantId = TenantContext.get();
        Object[] row = executionLogRepository.aggregateByTenantIdAndRuleId(tenantId, ruleId);
        if (row == null || row.length < 4) {
            return RuleStats.builder()
                    .ruleId(ruleId)
                    .totalExecutions(0)
                    .matchedExecutions(0)
                    .errorExecutions(0)
                    .matchRate(0)
                    .avgExecutionTimeMs(0)
                    .build();
        }
        long total = ((Number) row[0]).longValue();
        long matched = ((Number) row[1]).longValue();
        long errors = ((Number) row[2]).longValue();
        double avgTime = ((Number) row[3]).doubleValue();
        return RuleStats.builder()
                .ruleId(ruleId)
                .totalExecutions(total)
                .matchedExecutions(matched)
                .errorExecutions(errors)
                .matchRate(total > 0 ? (double) matched / total * 100 : 0)
                .avgExecutionTimeMs(avgTime)
                .build();
    }

    private ExecutionHistoryItem toHistoryItem(ExecutionLogEntity entity) {
        return ExecutionHistoryItem.builder()
                .id(entity.getId())
                .ruleId(entity.getRuleId())
                .rulesetId(entity.getRulesetId())
                .matched(entity.getMatched())
                .executionTimeMs(entity.getExecutionTimeMs())
                .errorMessage(entity.getErrorMessage())
                .traceId(entity.getTraceId())
                .createdAt(entity.getCreatedAt())
                .input(entity.getInput())
                .output(entity.getOutput())
                .build();
    }
}
