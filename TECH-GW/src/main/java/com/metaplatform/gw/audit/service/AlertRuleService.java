package com.metaplatform.gw.audit.service;

import com.metaplatform.gw.audit.dto.AlertRuleResponse;
import com.metaplatform.gw.audit.dto.CreateAlertRuleRequest;
import com.metaplatform.gw.audit.entity.GwAuditAlertRuleEntity;
import com.metaplatform.gw.audit.repository.GwAuditAlertRuleRepository;
import com.metaplatform.gw.common.ErrorCode;
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
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class AlertRuleService {

    private final GwAuditAlertRuleRepository repository;

    private static final Set<String> VALID_TYPES = Set.of("SLOW_REQUEST", "HIGH_ERROR_RATE", "HIGH_TRAFFIC");

    public Mono<AlertRuleResponse> create(CreateAlertRuleRequest request) {
        return Mono.fromCallable(() -> {
            if (!VALID_TYPES.contains(request.getConditionType())) {
                throw new AlertRuleException(ErrorCode.INVALID_FIELD_VALUE);
            }

            LocalDateTime now = LocalDateTime.now();
            GwAuditAlertRuleEntity entity = GwAuditAlertRuleEntity.builder()
                    .id(UUID.randomUUID())
                    .tenantId(TenantContext.resolveOrDefault(request.getTenantId()))
                    .name(request.getName())
                    .conditionType(request.getConditionType())
                    .thresholdMs(request.getThresholdMs())
                    .thresholdErrorRate(request.getThresholdErrorRate())
                    .thresholdRps(request.getThresholdRps())
                    .enabled(request.getEnabled() != null ? request.getEnabled() : Boolean.TRUE)
                    .notificationConfig(request.getNotificationConfig())
                    .createdAt(now)
                    .updatedAt(now)
                    .build();
            entity = repository.save(entity);
            return AlertRuleResponse.fromEntity(entity);
        }).subscribeOn(Schedulers.boundedElastic());
    }

    public Mono<AlertRuleResponse> get(UUID id) {
        return Mono.fromCallable(() -> repository.findByIdAndDeletedAtIsNull(id)
                .map(AlertRuleResponse::fromEntity)
                .orElseThrow(() -> new AlertRuleException(ErrorCode.NOT_FOUND)))
                .subscribeOn(Schedulers.boundedElastic());
    }

    public Mono<PageResponse<AlertRuleResponse>> list(int page, int size, String tenantId) {
        return Mono.fromCallable(() -> {
            Pageable pageable = PageRequest.of(Math.max(page - 1, 0), size,
                    Sort.by(Sort.Direction.DESC, "createdAt"));
            Page<GwAuditAlertRuleEntity> entityPage = repository
                    .findByTenantIdAndDeletedAtIsNullOrderByCreatedAtDesc(
                            TenantContext.resolveOrDefault(tenantId), pageable);
            List<AlertRuleResponse> items = entityPage.getContent().stream()
                    .map(AlertRuleResponse::fromEntity)
                    .toList();
            return PageResponse.<AlertRuleResponse>builder()
                    .items(items)
                    .total(entityPage.getTotalElements())
                    .page(page)
                    .size(size)
                    .totalPages(entityPage.getTotalPages())
                    .build();
        }).subscribeOn(Schedulers.boundedElastic());
    }

    public Mono<AlertRuleResponse> update(UUID id, CreateAlertRuleRequest request) {
        return Mono.fromCallable(() -> {
            GwAuditAlertRuleEntity entity = repository.findByIdAndDeletedAtIsNull(id)
                    .orElseThrow(() -> new AlertRuleException(ErrorCode.NOT_FOUND));
            if (request.getConditionType() != null && !VALID_TYPES.contains(request.getConditionType())) {
                throw new AlertRuleException(ErrorCode.INVALID_FIELD_VALUE);
            }
            if (request.getName() != null) entity.setName(request.getName());
            if (request.getConditionType() != null) entity.setConditionType(request.getConditionType());
            if (request.getThresholdMs() != null) entity.setThresholdMs(request.getThresholdMs());
            if (request.getThresholdErrorRate() != null) entity.setThresholdErrorRate(request.getThresholdErrorRate());
            if (request.getThresholdRps() != null) entity.setThresholdRps(request.getThresholdRps());
            if (request.getEnabled() != null) entity.setEnabled(request.getEnabled());
            if (request.getNotificationConfig() != null) entity.setNotificationConfig(request.getNotificationConfig());
            entity.setUpdatedAt(LocalDateTime.now());
            entity = repository.save(entity);
            return AlertRuleResponse.fromEntity(entity);
        }).subscribeOn(Schedulers.boundedElastic());
    }

    public Mono<Void> delete(UUID id) {
        return Mono.fromRunnable(() -> {
            GwAuditAlertRuleEntity entity = repository.findByIdAndDeletedAtIsNull(id)
                    .orElseThrow(() -> new AlertRuleException(ErrorCode.NOT_FOUND));
            entity.setDeletedAt(LocalDateTime.now());
            repository.save(entity);
        }).subscribeOn(Schedulers.boundedElastic()).then();
    }

    public Mono<Boolean> checkSlowRequests(long durationMs) {
        return Mono.fromCallable(() -> repository.findByEnabledAndDeletedAtIsNull(Boolean.TRUE).stream()
                        .filter(r -> "SLOW_REQUEST".equals(r.getConditionType()))
                        .filter(r -> r.getThresholdMs() != null && durationMs >= r.getThresholdMs())
                        .findFirst()
                        .isPresent())
                .subscribeOn(Schedulers.boundedElastic());
    }

    public static class AlertRuleException extends RuntimeException {
        private final ErrorCode errorCode;

        public AlertRuleException(ErrorCode errorCode) {
            super(errorCode.getMessage());
            this.errorCode = errorCode;
        }

        public ErrorCode getErrorCode() {
            return errorCode;
        }
    }
}
