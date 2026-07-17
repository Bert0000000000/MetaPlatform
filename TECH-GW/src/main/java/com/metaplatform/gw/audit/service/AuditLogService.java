package com.metaplatform.gw.audit.service;

import com.metaplatform.gw.audit.dto.AuditLogResponse;
import com.metaplatform.gw.audit.dto.AuditLogStatistics;
import com.metaplatform.gw.audit.dto.LatencyStats;
import com.metaplatform.gw.audit.dto.RecordAuditLogRequest;
import com.metaplatform.gw.audit.entity.GwAuditLogEntity;
import com.metaplatform.gw.audit.repository.GwAuditLogRepository;
import com.metaplatform.gw.common.PageResponse;
import com.metaplatform.gw.common.TenantContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Mono;
import reactor.core.scheduler.Schedulers;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class AuditLogService {

    private final GwAuditLogRepository auditLogRepository;

    public Mono<AuditLogResponse> record(RecordAuditLogRequest request) {
        return Mono.fromCallable(() -> {
            GwAuditLogEntity entity = GwAuditLogEntity.builder()
                    .id(UUID.randomUUID())
                    .tenantId(TenantContext.resolveOrDefault(request.getTenantId()))
                    .apiId(parseUuid(request.getApiId()))
                    .path(request.getPath())
                    .method(request.getMethod())
                    .statusCode(request.getStatusCode())
                    .requestSize(request.getRequestSize())
                    .responseSize(request.getResponseSize())
                    .durationMs(request.getDurationMs() != null ? request.getDurationMs() : 0L)
                    .userId(request.getUserId())
                    .traceId(request.getTraceId())
                    .clientIp(request.getClientIp())
                    .errorMessage(request.getErrorMessage())
                    .isError(Boolean.TRUE.equals(request.getIsError()))
                    .createdAt(LocalDateTime.now())
                    .build();
            entity = auditLogRepository.save(entity);
            return AuditLogResponse.fromEntity(entity);
        }).subscribeOn(Schedulers.boundedElastic());
    }

    public Mono<PageResponse<AuditLogResponse>> query(String tenantId, String path, String method,
                                                      Integer statusCode, String userId, String traceId,
                                                      Boolean isError, int page, int size) {
        return Mono.fromCallable(() -> {
            Pageable pageable = PageRequest.of(Math.max(page - 1, 0), size,
                    Sort.by(Sort.Direction.DESC, "createdAt"));
            Page<GwAuditLogEntity> entityPage = auditLogRepository.search(
                    TenantContext.resolveOrDefault(tenantId), path, method, statusCode, userId, traceId, isError, pageable);
            List<AuditLogResponse> items = entityPage.getContent().stream()
                    .map(AuditLogResponse::fromEntity)
                    .toList();
            return PageResponse.<AuditLogResponse>builder()
                    .items(items)
                    .total(entityPage.getTotalElements())
                    .page(page)
                    .size(size)
                    .totalPages(entityPage.getTotalPages())
                    .build();
        }).subscribeOn(Schedulers.boundedElastic());
    }

    public Mono<List<AuditLogResponse>> findSlowRequests(long thresholdMs, String tenantId, int limit) {
        return Mono.fromCallable(() -> {
            Pageable pageable = PageRequest.of(0, limit > 0 ? limit : 100);
            return auditLogRepository.findSlowRequests(TenantContext.resolveOrDefault(tenantId), thresholdMs, pageable)
                    .stream()
                    .map(AuditLogResponse::fromEntity)
                    .toList();
        }).subscribeOn(Schedulers.boundedElastic());
    }

    public Mono<List<AuditLogResponse>> findByTraceId(String traceId) {
        return Mono.fromCallable(() -> auditLogRepository.findByTraceIdOrderByCreatedAtAsc(traceId)
                .stream()
                .map(AuditLogResponse::fromEntity)
                .toList()).subscribeOn(Schedulers.boundedElastic());
    }

    public Mono<AuditLogStatistics> getStatistics(String tenantId, LocalDateTime start, LocalDateTime end) {
        return Mono.fromCallable(() -> {
            Pageable pageable = PageRequest.of(0, 1000);
            List<Object[]> aggregates = auditLogRepository.aggregateLatency(
                    TenantContext.resolveOrDefault(tenantId), start, end, pageable);

            long totalRequests = 0L;
            long totalErrors = 0L;
            List<LatencyStats> perPath = aggregates.stream().map(row -> {
                String path = row[0] != null ? row[0].toString() : null;
                long pathTotal = row[1] != null ? ((Number) row[1]).longValue() : 0L;
                Double avgDuration = row[2] != null ? ((Number) row[2]).doubleValue() : null;
                long maxDuration = row[3] != null ? ((Number) row[3]).longValue() : 0L;
                long errors = row[4] != null ? ((Number) row[4]).longValue() : 0L;
                totalRequests += pathTotal;
                totalErrors += errors;
                return LatencyStats.builder()
                        .path(path)
                        .totalRequests(pathTotal)
                        .avgDurationMs(avgDuration)
                        .maxDurationMs(maxDuration)
                        .errorCount(errors)
                        .errorRate(pathTotal == 0 ? 0.0 : (double) errors / pathTotal)
                        .build();
            }).toList();

            Double overallErrorRate = totalRequests == 0 ? 0.0 : (double) totalErrors / totalRequests;
            return AuditLogStatistics.builder()
                    .perPath(perPath)
                    .totalRequests(totalRequests)
                    .totalErrors(totalErrors)
                    .overallErrorRate(overallErrorRate)
                    .windowStart(start != null ? start.toString() : null)
                    .windowEnd(end != null ? end.toString() : null)
                    .build();
        }).subscribeOn(Schedulers.boundedElastic());
    }

    public Mono<List<AuditLogResponse>> exportRange(String tenantId, LocalDateTime start, LocalDateTime end) {
        return Mono.fromCallable(() ->
                auditLogRepository.exportRange(TenantContext.resolveOrDefault(tenantId), start, end)
                        .stream()
                        .map(AuditLogResponse::fromEntity)
                        .toList()).subscribeOn(Schedulers.boundedElastic());
    }

    private UUID parseUuid(String value) {
        if (value == null || value.isBlank()) return null;
        try {
            return UUID.fromString(value);
        } catch (IllegalArgumentException e) {
            return null;
        }
    }
}
