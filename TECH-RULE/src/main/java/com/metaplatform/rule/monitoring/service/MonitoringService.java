package com.metaplatform.rule.monitoring.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
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
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class MonitoringService {

    private final ExecutionLogRepository executionLogRepository;
    private final ObjectMapper objectMapper;

    @Transactional(readOnly = true)
    public MonitoringOverview overview() {
        String tenantId = TenantContext.get();
        long total = executionLogRepository.countByTenantId(tenantId);
        long matched = executionLogRepository.countByTenantIdAndMatchedTrue(tenantId);
        long errors = executionLogRepository.countByTenantIdAndErrorMessageIsNotNull(tenantId);

        double matchRate = total > 0 ? (double) matched / total * 100 : 0;
        double errorRate = total > 0 ? (double) errors / total * 100 : 0;

        double avgTime = executionLogRepository.findByTenantIdAndErrorMessageIsNotNullOrderByCreatedAtDesc(
                        tenantId, PageRequest.of(0, 1)).stream()
                .findFirst()
                .map(e -> e.getExecutionTimeMs() != null ? (double) e.getExecutionTimeMs() : 0.0)
                .orElse(0.0);

        return MonitoringOverview.builder()
                .totalExecutions(total)
                .matchedExecutions(matched)
                .errorExecutions(errors)
                .matchRate(matchRate)
                .errorRate(errorRate)
                .avgExecutionTimeMs(avgTime)
                .build();
    }

    @Transactional(readOnly = true)
    public List<RuleStats> byRule() {
        String tenantId = TenantContext.get();
        List<ExecutionLogEntity> all = executionLogRepository.findAll(Sort.by(Sort.Direction.DESC, "createdAt"))
                .stream()
                .filter(e -> tenantId.equals(e.getTenantId()))
                .toList();

        Map<String, List<ExecutionLogEntity>> byRule = all.stream()
                .filter(e -> e.getRuleId() != null)
                .collect(Collectors.groupingBy(ExecutionLogEntity::getRuleId));

        List<RuleStats> stats = new ArrayList<>();
        for (Map.Entry<String, List<ExecutionLogEntity>> entry : byRule.entrySet()) {
            List<ExecutionLogEntity> logs = entry.getValue();
            long total = logs.size();
            long matched = logs.stream().filter(l -> Boolean.TRUE.equals(l.getMatched())).count();
            long errors = logs.stream().filter(l -> l.getErrorMessage() != null).count();
            double avgTime = logs.stream()
                    .filter(l -> l.getExecutionTimeMs() != null)
                    .mapToLong(ExecutionLogEntity::getExecutionTimeMs)
                    .average()
                    .orElse(0);
            stats.add(RuleStats.builder()
                    .ruleId(entry.getKey())
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

    @Transactional(readOnly = true)
    public RuleStats singleRuleStats(String ruleId) {
        String tenantId = TenantContext.get();
        List<ExecutionLogEntity> logs =
                executionLogRepository.findByTenantIdAndRuleIdOrderByCreatedAtDesc(tenantId, ruleId, PageRequest.of(0, 1000));

        long total = logs.size();
        long matched = logs.stream().filter(l -> Boolean.TRUE.equals(l.getMatched())).count();
        long errors = logs.stream().filter(l -> l.getErrorMessage() != null).count();
        double avgTime = logs.stream()
                .filter(l -> l.getExecutionTimeMs() != null)
                .mapToLong(ExecutionLogEntity::getExecutionTimeMs)
                .average()
                .orElse(0);

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
                .input(readMap(entity.getInput()))
                .output(readMap(entity.getOutput()))
                .build();
    }

    private Map<String, Object> readMap(String json) {
        if (json == null || json.isBlank()) return null;
        try {
            return objectMapper.readValue(json, new TypeReference<>() {});
        } catch (Exception e) {
            return null;
        }
    }
}
