package com.metaplatform.rule.statistics.service;

import com.metaplatform.rule.common.PageResponse;
import com.metaplatform.rule.common.TenantContext;
import com.metaplatform.rule.statistics.dto.ErrorItem;
import com.metaplatform.rule.statistics.dto.StatisticsOverview;
import com.metaplatform.rule.statistics.dto.TargetStats;
import com.metaplatform.rule.statistics.dto.TimelinePoint;
import com.metaplatform.rule.statistics.entity.RuleExecutionStatEntity;
import com.metaplatform.rule.statistics.repository.RuleExecutionStatRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class StatisticsService {

    private final RuleExecutionStatRepository statRepository;

    @Transactional
    public void recordExecution(String targetType, String targetId, boolean hit, boolean error, long durationMs) {
        String tenantId = TenantContext.get();
        LocalDate date = LocalDate.now();
        RuleExecutionStatEntity stat = statRepository
                .findByTenantIdAndTargetTypeAndTargetIdAndExecutionDate(tenantId, targetType, targetId, date)
                .orElseGet(() -> RuleExecutionStatEntity.builder()
                        .id(UUID.randomUUID().toString())
                        .tenantId(tenantId)
                        .targetType(targetType)
                        .targetId(targetId)
                        .executionDate(date)
                        .totalCount(0)
                        .hitCount(0)
                        .missCount(0)
                        .errorCount(0)
                        .avgDurationMs(0L)
                        .build());

        stat.setTotalCount(stat.getTotalCount() + 1);
        if (error) {
            stat.setErrorCount(stat.getErrorCount() + 1);
        } else if (hit) {
            stat.setHitCount(stat.getHitCount() + 1);
        } else {
            stat.setMissCount(stat.getMissCount() + 1);
        }
        long currentAvg = stat.getAvgDurationMs() != null ? stat.getAvgDurationMs() : 0L;
        stat.setAvgDurationMs((currentAvg * (stat.getTotalCount() - 1) + durationMs) / stat.getTotalCount());
        statRepository.save(stat);
    }

    @Transactional(readOnly = true)
    public StatisticsOverview overview() {
        String tenantId = TenantContext.get();
        LocalDate end = LocalDate.now();
        LocalDate start = end.minusDays(30);
        List<RuleExecutionStatEntity> stats = statRepository.findByTenantIdAndExecutionDateBetween(tenantId, start, end);

        long total = stats.stream().mapToLong(RuleExecutionStatEntity::getTotalCount).sum();
        long hit = stats.stream().mapToLong(RuleExecutionStatEntity::getHitCount).sum();
        long miss = stats.stream().mapToLong(RuleExecutionStatEntity::getMissCount).sum();
        long error = stats.stream().mapToLong(RuleExecutionStatEntity::getErrorCount).sum();

        long avg = total > 0
                ? stats.stream().mapToLong(s -> (s.getAvgDurationMs() != null ? s.getAvgDurationMs() : 0L) * s.getTotalCount()).sum() / total
                : 0L;

        return StatisticsOverview.builder()
                .totalExecutions(total)
                .hitExecutions(hit)
                .missExecutions(miss)
                .errorExecutions(error)
                .hitRate(total > 0 ? (double) hit / total * 100 : 0)
                .errorRate(total > 0 ? (double) error / total * 100 : 0)
                .avgDurationMs(avg)
                .targetCount((int) stats.stream().map(s -> s.getTargetType() + ":" + s.getTargetId()).distinct().count())
                .build();
    }

    @Transactional(readOnly = true)
    public List<TargetStats> byTarget() {
        String tenantId = TenantContext.get();
        LocalDate end = LocalDate.now();
        LocalDate start = end.minusDays(30);
        List<RuleExecutionStatEntity> stats = statRepository.findByTenantIdAndExecutionDateBetween(tenantId, start, end);

        Map<String, List<RuleExecutionStatEntity>> grouped = stats.stream()
                .collect(Collectors.groupingBy(s -> s.getTargetType() + ":" + s.getTargetId()));

        List<TargetStats> result = new ArrayList<>();
        for (Map.Entry<String, List<RuleExecutionStatEntity>> entry : grouped.entrySet()) {
            List<RuleExecutionStatEntity> list = entry.getValue();
            long total = list.stream().mapToLong(RuleExecutionStatEntity::getTotalCount).sum();
            long hit = list.stream().mapToLong(RuleExecutionStatEntity::getHitCount).sum();
            long miss = list.stream().mapToLong(RuleExecutionStatEntity::getMissCount).sum();
            long error = list.stream().mapToLong(RuleExecutionStatEntity::getErrorCount).sum();
            long durationSum = list.stream().mapToLong(s -> (s.getAvgDurationMs() != null ? s.getAvgDurationMs() : 0L) * s.getTotalCount()).sum();
            RuleExecutionStatEntity first = list.get(0);
            result.add(TargetStats.builder()
                    .targetType(first.getTargetType())
                    .targetId(first.getTargetId())
                    .totalExecutions(total)
                    .hitExecutions(hit)
                    .missExecutions(miss)
                    .errorExecutions(error)
                    .hitRate(total > 0 ? (double) hit / total * 100 : 0)
                    .errorRate(total > 0 ? (double) error / total * 100 : 0)
                    .avgDurationMs(total > 0 ? durationSum / total : 0L)
                    .build());
        }
        return result;
    }

    @Transactional(readOnly = true)
    public List<TimelinePoint> timeline(LocalDate start, LocalDate end) {
        String tenantId = TenantContext.get();
        LocalDate now = LocalDate.now();
        LocalDate from = start != null ? start : now.minusDays(30);
        LocalDate to = end != null ? end : now;
        List<RuleExecutionStatEntity> stats = statRepository.findByTenantIdAndExecutionDateBetween(tenantId, from, to);

        Map<LocalDate, List<RuleExecutionStatEntity>> byDate = stats.stream()
                .collect(Collectors.groupingBy(RuleExecutionStatEntity::getExecutionDate));

        List<TimelinePoint> result = new ArrayList<>();
        for (Map.Entry<LocalDate, List<RuleExecutionStatEntity>> entry : byDate.entrySet()) {
            List<RuleExecutionStatEntity> list = entry.getValue();
            long total = list.stream().mapToLong(RuleExecutionStatEntity::getTotalCount).sum();
            long hit = list.stream().mapToLong(RuleExecutionStatEntity::getHitCount).sum();
            long miss = list.stream().mapToLong(RuleExecutionStatEntity::getMissCount).sum();
            long error = list.stream().mapToLong(RuleExecutionStatEntity::getErrorCount).sum();
            result.add(TimelinePoint.builder()
                    .date(entry.getKey())
                    .totalExecutions(total)
                    .hitExecutions(hit)
                    .missExecutions(miss)
                    .errorExecutions(error)
                    .build());
        }
        return result.stream().sorted((a, b) -> b.getDate().compareTo(a.getDate())).toList();
    }

    @Transactional(readOnly = true)
    public PageResponse<RuleExecutionStatEntity> history(int page, int pageSize) {
        String tenantId = TenantContext.get();
        PageRequest pageRequest = PageRequest.of(Math.max(0, page - 1), Math.max(1, pageSize));
        Page<RuleExecutionStatEntity> result =
                statRepository.findByTenantIdOrderByExecutionDateDescTargetTypeAscTargetIdAsc(tenantId, pageRequest);
        return PageResponse.<RuleExecutionStatEntity>builder()
                .items(result.getContent())
                .total(result.getTotalElements())
                .page(page)
                .pageSize(pageSize)
                .totalPages(result.getTotalPages())
                .build();
    }

    @Transactional(readOnly = true)
    public PageResponse<ErrorItem> errors(int page, int pageSize) {
        String tenantId = TenantContext.get();
        PageRequest pageRequest = PageRequest.of(Math.max(0, page - 1), Math.max(1, pageSize));
        Page<RuleExecutionStatEntity> result =
                statRepository.findByTenantIdAndErrorCountGreaterThanOrderByExecutionDateDesc(tenantId, 0, pageRequest);

        List<ErrorItem> items = result.getContent().stream().map(s -> ErrorItem.builder()
                .id(s.getId())
                .targetType(s.getTargetType())
                .targetId(s.getTargetId())
                .executionDate(s.getExecutionDate())
                .errorCount(s.getErrorCount())
                .totalCount(s.getTotalCount())
                .errorRate(s.getTotalCount() > 0 ? (double) s.getErrorCount() / s.getTotalCount() * 100 : 0)
                .build()).toList();

        return PageResponse.<ErrorItem>builder()
                .items(items)
                .total(result.getTotalElements())
                .page(page)
                .pageSize(pageSize)
                .totalPages(result.getTotalPages())
                .build();
    }

    @Transactional(readOnly = true)
    public TargetStats single(String targetType, String targetId) {
        String tenantId = TenantContext.get();
        LocalDate end = LocalDate.now();
        LocalDate start = end.minusDays(30);
        List<RuleExecutionStatEntity> stats = statRepository.findByTenantIdAndTargetTypeAndTargetId(
                tenantId, targetType, targetId);

        long total = stats.stream().mapToLong(RuleExecutionStatEntity::getTotalCount).sum();
        long hit = stats.stream().mapToLong(RuleExecutionStatEntity::getHitCount).sum();
        long miss = stats.stream().mapToLong(RuleExecutionStatEntity::getMissCount).sum();
        long error = stats.stream().mapToLong(RuleExecutionStatEntity::getErrorCount).sum();
        long durationSum = stats.stream().mapToLong(s -> (s.getAvgDurationMs() != null ? s.getAvgDurationMs() : 0L) * s.getTotalCount()).sum();

        return TargetStats.builder()
                .targetType(targetType)
                .targetId(targetId)
                .totalExecutions(total)
                .hitExecutions(hit)
                .missExecutions(miss)
                .errorExecutions(error)
                .hitRate(total > 0 ? (double) hit / total * 100 : 0)
                .errorRate(total > 0 ? (double) error / total * 100 : 0)
                .avgDurationMs(total > 0 ? durationSum / total : 0L)
                .build();
    }
}
