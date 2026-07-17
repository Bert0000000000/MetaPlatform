package com.metaplatform.gw.ratelimit.service;

import com.metaplatform.gw.common.ErrorCode;
import com.metaplatform.gw.common.PageResponse;
import com.metaplatform.gw.common.TraceContext;
import com.metaplatform.gw.ratelimit.dto.*;
import com.metaplatform.gw.ratelimit.entity.GwRateLimitRuleEntity;
import com.metaplatform.gw.ratelimit.repository.GwRateLimitRuleRepository;
import com.metaplatform.gw.route.entity.GwRouteEntity;
import com.metaplatform.gw.route.repository.GwRouteRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.redis.core.ReactiveStringRedisTemplate;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Mono;
import reactor.core.scheduler.Schedulers;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class RateLimitRuleService {

    private final GwRateLimitRuleRepository rateLimitRepository;
    private final GwRouteRepository routeRepository;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private ReactiveStringRedisTemplate redisTemplate;

    private static final String DEFAULT_TENANT = "tenant-default";
    private static final String DEFAULT_STATUS = "ENABLED";
    private static final String DEFAULT_TOKEN_WINDOW = "DAILY";
    private static final BigDecimal DEFAULT_BURST_FACTOR = BigDecimal.valueOf(1.0);
    private static final int DEFAULT_QUOTA_ALERT_THRESHOLD = 80;

    private static final Set<String> VALID_SCOPES = Set.of("GLOBAL", "USER", "IP", "APP");
    private static final Set<String> VALID_LIMIT_TYPES = Set.of("QPS", "CONCURRENT", "TOKEN");
    private static final Set<String> VALID_STATUSES = Set.of("ENABLED", "DISABLED");
    private static final Set<String> VALID_TOKEN_WINDOWS = Set.of("DAILY", "HOURLY", "MONTHLY");
    private static final Set<String> VALID_RESET_TYPES = Set.of("ALL", "QPS", "CONCURRENT", "TOKEN");

    public Mono<RateLimitResponse> createRule(CreateRateLimitRequest request) {
        return Mono.fromCallable(() -> {
            validateCreateRequest(request);

            String tenantId = DEFAULT_TENANT;
            String currentUser = getCurrentUser();

            if (rateLimitRepository.existsByTenantIdAndRuleNameAndDeletedAtIsNull(tenantId, request.getRuleName())) {
                throw new RateLimitException(ErrorCode.RATE_LIMIT_ALREADY_EXISTS);
            }

            if (request.getRouteId() != null && !routeRepository.existsByTenantIdAndRouteId(tenantId, request.getRouteId())) {
                throw new RateLimitException(ErrorCode.ROUTE_NOT_FOUND);
            }

            if (rateLimitRepository.existsByTenantIdAndRouteIdAndScopeAndLimitTypeAndDeletedAtIsNull(
                    tenantId, request.getRouteId(), request.getScope(), request.getLimitType())) {
                throw new RateLimitException(ErrorCode.RATE_LIMIT_ALREADY_EXISTS);
            }

            LocalDateTime now = LocalDateTime.now();
            GwRateLimitRuleEntity entity = GwRateLimitRuleEntity.builder()
                    .id(UUID.randomUUID().toString())
                    .tenantId(tenantId)
                    .ruleId("rl-" + UUID.randomUUID().toString().replace("-", "").substring(0, 20))
                    .ruleName(request.getRuleName())
                    .description(request.getDescription())
                    .routeId(request.getRouteId())
                    .scope(request.getScope())
                    .limitType(request.getLimitType())
                    .qpsLimit(request.getQpsLimit())
                    .concurrentLimit(request.getConcurrentLimit())
                    .tokenLimit(request.getTokenLimit())
                    .tokenWindow(resolveTokenWindow(request.getTokenWindow(), request.getLimitType()))
                    .burstFactor(resolveBurstFactor(request.getBurstFactor()))
                    .quotaAlertThreshold(resolveQuotaAlertThreshold(request.getQuotaAlertThreshold()))
                    .status(request.getStatus() != null ? request.getStatus() : DEFAULT_STATUS)
                    .version(1)
                    .createdAt(now)
                    .createdBy(currentUser)
                    .updatedAt(now)
                    .updatedBy(currentUser)
                    .build();

            entity = rateLimitRepository.save(entity);
            return toResponse(entity);
        }).subscribeOn(Schedulers.boundedElastic());
    }

    public Mono<PageResponse<RateLimitListItemResponse>> listRules(
            int page, int size, String sort,
            String keyword, String status, String routeId, String scope, String limitType) {
        return Mono.fromCallable(() -> {
            String tenantId = DEFAULT_TENANT;
            if (status != null && !VALID_STATUSES.contains(status)) {
                throw new RateLimitException(ErrorCode.INVALID_FIELD_VALUE);
            }
            if (scope != null && !VALID_SCOPES.contains(scope)) {
                throw new RateLimitException(ErrorCode.INVALID_FIELD_VALUE);
            }
            if (limitType != null && !VALID_LIMIT_TYPES.contains(limitType)) {
                throw new RateLimitException(ErrorCode.UNSUPPORTED_LIMIT_TYPE);
            }

            int pageIndex = Math.max(page - 1, 0);
            Pageable pageable = PageRequest.of(pageIndex, size, resolveSort(sort));
            Page<GwRateLimitRuleEntity> entityPage = rateLimitRepository.searchRules(
                    tenantId, keyword, status, routeId, scope, limitType, pageable);

            List<RateLimitListItemResponse> items = entityPage.getContent().stream()
                    .map(this::toListItemResponse)
                    .toList();

            return PageResponse.<RateLimitListItemResponse>builder()
                    .items(items)
                    .total(entityPage.getTotalElements())
                    .page(page)
                    .size(size)
                    .totalPages(entityPage.getTotalPages())
                    .build();
        }).subscribeOn(Schedulers.boundedElastic());
    }

    public Mono<RateLimitResponse> getRule(String ruleId) {
        return Mono.fromCallable(() -> {
            GwRateLimitRuleEntity entity = findActiveRule(ruleId);
            return toResponse(entity);
        }).subscribeOn(Schedulers.boundedElastic());
    }

    public Mono<RateLimitResponse> updateRule(String ruleId, UpdateRateLimitRequest request) {
        return Mono.fromCallable(() -> {
            GwRateLimitRuleEntity entity = findActiveRule(ruleId);

            if (request.getVersion() == null || !request.getVersion().equals(entity.getVersion())) {
                throw new RateLimitException(ErrorCode.VERSION_MISMATCH);
            }

            validateUpdateRequest(request);

            String tenantId = entity.getTenantId();
            String currentUser = getCurrentUser();

            String newRuleName = request.getRuleName() != null ? request.getRuleName() : entity.getRuleName();
            String newScope = request.getScope() != null ? request.getScope() : entity.getScope();
            String newLimitType = request.getLimitType() != null ? request.getLimitType() : entity.getLimitType();
            String newRouteId = entity.getRouteId();

            if (!newRuleName.equals(entity.getRuleName())
                    && rateLimitRepository.existsByTenantIdAndRuleNameAndDeletedAtIsNull(tenantId, newRuleName)) {
                throw new RateLimitException(ErrorCode.RATE_LIMIT_ALREADY_EXISTS);
            }

            if ((request.getScope() != null || request.getLimitType() != null)
                    && rateLimitRepository.existsByTenantIdAndRouteIdAndScopeAndLimitTypeAndDeletedAtIsNull(
                    tenantId, newRouteId, newScope, newLimitType)) {
                GwRateLimitRuleEntity conflict = findConflictRule(
                        tenantId, newRouteId, newScope, newLimitType).orElse(null);
                if (conflict == null || !conflict.getRuleId().equals(entity.getRuleId())) {
                    throw new RateLimitException(ErrorCode.RATE_LIMIT_ALREADY_EXISTS);
                }
            }

            entity.setRuleName(newRuleName);
            entity.setDescription(request.getDescription() != null ? request.getDescription() : entity.getDescription());
            entity.setScope(newScope);
            entity.setLimitType(newLimitType);
            entity.setQpsLimit(request.getQpsLimit() != null ? request.getQpsLimit() : entity.getQpsLimit());
            entity.setConcurrentLimit(request.getConcurrentLimit() != null ? request.getConcurrentLimit() : entity.getConcurrentLimit());
            entity.setTokenLimit(request.getTokenLimit() != null ? request.getTokenLimit() : entity.getTokenLimit());
            entity.setTokenWindow(request.getTokenWindow() != null
                    ? resolveTokenWindow(request.getTokenWindow(), newLimitType)
                    : entity.getTokenWindow());
            entity.setBurstFactor(request.getBurstFactor() != null ? resolveBurstFactor(request.getBurstFactor()) : entity.getBurstFactor());
            entity.setQuotaAlertThreshold(request.getQuotaAlertThreshold() != null
                    ? resolveQuotaAlertThreshold(request.getQuotaAlertThreshold())
                    : entity.getQuotaAlertThreshold());
            entity.setVersion(entity.getVersion() + 1);
            entity.setUpdatedAt(LocalDateTime.now());
            entity.setUpdatedBy(currentUser);

            entity = rateLimitRepository.save(entity);
            return toResponse(entity);
        }).subscribeOn(Schedulers.boundedElastic());
    }

    public Mono<RateLimitDeleteResponse> deleteRule(String ruleId, String reason) {
        return Mono.fromCallable(() -> {
            GwRateLimitRuleEntity entity = findActiveRule(ruleId);
            String currentUser = getCurrentUser();
            LocalDateTime now = LocalDateTime.now();

            entity.setDeletedAt(now);
            entity.setUpdatedAt(now);
            entity.setUpdatedBy(currentUser);
            rateLimitRepository.save(entity);

            clearRedisCounters(entity.getRuleId());

            return RateLimitDeleteResponse.builder()
                    .ruleId(entity.getRuleId())
                    .ruleName(entity.getRuleName())
                    .deletedAt(now)
                    .deletedBy(currentUser)
                    .build();
        }).subscribeOn(Schedulers.boundedElastic());
    }

    public Mono<RateLimitStateResponse> updateState(String ruleId, RateLimitStateRequest request) {
        return Mono.fromCallable(() -> {
            if (request.getStatus() == null || !VALID_STATUSES.contains(request.getStatus())) {
                throw new RateLimitException(ErrorCode.INVALID_FIELD_VALUE);
            }

            GwRateLimitRuleEntity entity = findActiveRule(ruleId);
            String currentUser = getCurrentUser();
            String previousStatus = entity.getStatus();

            entity.setStatus(request.getStatus());
            entity.setUpdatedAt(LocalDateTime.now());
            entity.setUpdatedBy(currentUser);
            rateLimitRepository.save(entity);

            return RateLimitStateResponse.builder()
                    .ruleId(entity.getRuleId())
                    .previousStatus(previousStatus)
                    .currentStatus(entity.getStatus())
                    .updatedAt(entity.getUpdatedAt())
                    .updatedBy(currentUser)
                    .build();
        }).subscribeOn(Schedulers.boundedElastic());
    }

    public Mono<RateLimitResetResponse> resetCounters(String ruleId, RateLimitResetRequest request) {
        return Mono.fromCallable(() -> {
            GwRateLimitRuleEntity entity = findActiveRule(ruleId);
            String resetType = request.getResetType() != null ? request.getResetType() : "ALL";
            if (!VALID_RESET_TYPES.contains(resetType)) {
                throw new RateLimitException(ErrorCode.INVALID_FIELD_VALUE);
            }

            String currentUser = getCurrentUser();
            LocalDateTime now = LocalDateTime.now();

            clearRedisCounters(entity.getRuleId(), resetType, request.getScopeId());

            return RateLimitResetResponse.builder()
                    .ruleId(entity.getRuleId())
                    .resetType(resetType)
                    .scopeId(request.getScopeId())
                    .resetAt(now)
                    .resetBy(currentUser)
                    .build();
        }).subscribeOn(Schedulers.boundedElastic());
    }

    public Mono<RateLimitStatsResponse> getStats(String startTime, String endTime, String routeId,
                                                  String scope, String limitType, String granularity) {
        return Mono.fromCallable(() -> {
            LocalDateTime start = parseIsoTime(startTime);
            LocalDateTime end = parseIsoTime(endTime);
            if (start == null || end == null) {
                throw new RateLimitException(ErrorCode.INVALID_PARAM);
            }
            if (end.isBefore(start)) {
                throw new RateLimitException(ErrorCode.INVALID_FIELD_VALUE);
            }

            return RateLimitStatsResponse.builder()
                    .summary(RateLimitStatsResponse.Summary.builder()
                            .totalRequests(0L)
                            .blockedRequests(0L)
                            .blockedRate(0.0)
                            .triggeredRules(0)
                            .activeRules(0)
                            .build())
                    .byRule(List.of())
                    .timeline(List.of())
                    .build();
        }).subscribeOn(Schedulers.boundedElastic());
    }

    public Mono<RateLimitRuleStatsResponse> getRuleStats(String ruleId, String startTime, String endTime, String granularity) {
        return Mono.fromCallable(() -> {
            GwRateLimitRuleEntity entity = findActiveRule(ruleId);
            LocalDateTime start = startTime != null ? parseIsoTime(startTime) : LocalDateTime.now().minusHours(24);
            LocalDateTime end = endTime != null ? parseIsoTime(endTime) : LocalDateTime.now();
            if (start == null || end == null || end.isBefore(start)) {
                throw new RateLimitException(ErrorCode.INVALID_FIELD_VALUE);
            }

            return RateLimitRuleStatsResponse.builder()
                    .ruleId(entity.getRuleId())
                    .ruleName(entity.getRuleName())
                    .limitType(entity.getLimitType())
                    .qpsLimit(entity.getQpsLimit())
                    .concurrentLimit(entity.getConcurrentLimit())
                    .tokenLimit(entity.getTokenLimit())
                    .currentQps(0L)
                    .currentConcurrent(0L)
                    .summary(RateLimitRuleStatsResponse.Summary.builder()
                            .totalRequests(0L)
                            .blockedRequests(0L)
                            .blockedRate(0.0)
                            .maxQps(0L)
                            .avgQps(0L)
                            .triggeredCount(0L)
                            .build())
                    .timeline(List.of())
                    .build();
        }).subscribeOn(Schedulers.boundedElastic());
    }

    private GwRateLimitRuleEntity findActiveRule(String ruleId) {
        return rateLimitRepository.findByRuleIdAndDeletedAtIsNull(ruleId)
                .orElseThrow(() -> new RateLimitException(ErrorCode.RATE_LIMIT_NOT_FOUND));
    }

    private Optional<GwRateLimitRuleEntity> findConflictRule(
            String tenantId, String routeId, String scope, String limitType) {
        return rateLimitRepository.findAll().stream()
                .filter(r -> r.getTenantId().equals(tenantId)
                        && (routeId == null ? r.getRouteId() == null : routeId.equals(r.getRouteId()))
                        && r.getScope().equals(scope)
                        && r.getLimitType().equals(limitType)
                        && r.getDeletedAt() == null)
                .findFirst();
    }

    private void validateCreateRequest(CreateRateLimitRequest request) {
        if (request.getRuleName() == null || request.getRuleName().isBlank()
                || request.getRuleName().length() > 128) {
            throw new RateLimitException(ErrorCode.INVALID_PARAM);
        }
        if (request.getDescription() != null && request.getDescription().length() > 1024) {
            throw new RateLimitException(ErrorCode.INVALID_PARAM);
        }
        if (request.getScope() == null || !VALID_SCOPES.contains(request.getScope())) {
            throw new RateLimitException(ErrorCode.INVALID_FIELD_VALUE);
        }
        if (request.getLimitType() == null || !VALID_LIMIT_TYPES.contains(request.getLimitType())) {
            throw new RateLimitException(ErrorCode.UNSUPPORTED_LIMIT_TYPE);
        }

        validateLimitValues(request.getLimitType(), request.getQpsLimit(), request.getConcurrentLimit(), request.getTokenLimit());

        if (request.getTokenWindow() != null && !VALID_TOKEN_WINDOWS.contains(request.getTokenWindow())) {
            throw new RateLimitException(ErrorCode.INVALID_FIELD_VALUE);
        }
        if (request.getBurstFactor() != null && (request.getBurstFactor() < 1.0 || request.getBurstFactor() > 5.0)) {
            throw new RateLimitException(ErrorCode.INVALID_FIELD_VALUE);
        }
        if (request.getQuotaAlertThreshold() != null
                && (request.getQuotaAlertThreshold() < 50 || request.getQuotaAlertThreshold() > 99)) {
            throw new RateLimitException(ErrorCode.INVALID_FIELD_VALUE);
        }
        if (request.getStatus() != null && !VALID_STATUSES.contains(request.getStatus())) {
            throw new RateLimitException(ErrorCode.INVALID_FIELD_VALUE);
        }
    }

    private void validateUpdateRequest(UpdateRateLimitRequest request) {
        if (request.getRuleName() != null && (request.getRuleName().isBlank() || request.getRuleName().length() > 128)) {
            throw new RateLimitException(ErrorCode.INVALID_PARAM);
        }
        if (request.getDescription() != null && request.getDescription().length() > 1024) {
            throw new RateLimitException(ErrorCode.INVALID_PARAM);
        }
        if (request.getScope() != null && !VALID_SCOPES.contains(request.getScope())) {
            throw new RateLimitException(ErrorCode.INVALID_FIELD_VALUE);
        }
        if (request.getLimitType() != null && !VALID_LIMIT_TYPES.contains(request.getLimitType())) {
            throw new RateLimitException(ErrorCode.UNSUPPORTED_LIMIT_TYPE);
        }

        validateLimitValues(request.getLimitType(), request.getQpsLimit(), request.getConcurrentLimit(), request.getTokenLimit());

        if (request.getTokenWindow() != null && !VALID_TOKEN_WINDOWS.contains(request.getTokenWindow())) {
            throw new RateLimitException(ErrorCode.INVALID_FIELD_VALUE);
        }
        if (request.getBurstFactor() != null && (request.getBurstFactor() < 1.0 || request.getBurstFactor() > 5.0)) {
            throw new RateLimitException(ErrorCode.INVALID_FIELD_VALUE);
        }
        if (request.getQuotaAlertThreshold() != null
                && (request.getQuotaAlertThreshold() < 50 || request.getQuotaAlertThreshold() > 99)) {
            throw new RateLimitException(ErrorCode.INVALID_FIELD_VALUE);
        }
    }

    private void validateLimitValues(String limitType, Integer qpsLimit, Integer concurrentLimit, Long tokenLimit) {
        if ("QPS".equals(limitType)) {
            if (qpsLimit == null || qpsLimit < 1 || qpsLimit > 100000) {
                throw new RateLimitException(ErrorCode.INVALID_PARAM);
            }
        }
        if ("CONCURRENT".equals(limitType)) {
            if (concurrentLimit == null || concurrentLimit < 1 || concurrentLimit > 10000) {
                throw new RateLimitException(ErrorCode.INVALID_PARAM);
            }
        }
        if ("TOKEN".equals(limitType)) {
            if (tokenLimit == null || tokenLimit < 1 || tokenLimit > 100000000L) {
                throw new RateLimitException(ErrorCode.INVALID_PARAM);
            }
        }
    }

    private String resolveTokenWindow(String tokenWindow, String limitType) {
        if (tokenWindow != null) {
            return tokenWindow;
        }
        return "TOKEN".equals(limitType) ? DEFAULT_TOKEN_WINDOW : null;
    }

    private BigDecimal resolveBurstFactor(Double burstFactor) {
        if (burstFactor != null) {
            return BigDecimal.valueOf(burstFactor).setScale(1, RoundingMode.HALF_UP);
        }
        return DEFAULT_BURST_FACTOR;
    }

    private int resolveQuotaAlertThreshold(Integer threshold) {
        return threshold != null ? threshold : DEFAULT_QUOTA_ALERT_THRESHOLD;
    }

    private Sort resolveSort(String sort) {
        if (sort == null || sort.isBlank()) {
            return Sort.by(Sort.Direction.DESC, "createdAt");
        }
        String[] parts = sort.split(":");
        String field = parts[0];
        Sort.Direction direction = (parts.length > 1 && "asc".equalsIgnoreCase(parts[1]))
                ? Sort.Direction.ASC : Sort.Direction.DESC;
        return Sort.by(direction, field);
    }

    private LocalDateTime parseIsoTime(String time) {
        if (time == null || time.isBlank()) {
            return null;
        }
        try {
            return java.time.Instant.parse(time).atZone(java.time.ZoneId.systemDefault()).toLocalDateTime();
        } catch (Exception e) {
            try {
                return LocalDateTime.parse(time);
            } catch (Exception ex) {
                return null;
            }
        }
    }

    private String getCurrentUser() {
        String userId = TraceContext.getOrCreate();
        return userId != null && !userId.isBlank() ? userId : "system";
    }

    private String resolveRouteName(String routeId) {
        if (routeId == null) {
            return null;
        }
        return routeRepository.findByTenantIdAndRouteId(DEFAULT_TENANT, routeId)
                .map(GwRouteEntity::getName)
                .orElse(null);
    }

    private RateLimitResponse toResponse(GwRateLimitRuleEntity entity) {
        return RateLimitResponse.builder()
                .ruleId(entity.getRuleId())
                .ruleName(entity.getRuleName())
                .description(entity.getDescription())
                .routeId(entity.getRouteId())
                .routeName(resolveRouteName(entity.getRouteId()))
                .scope(entity.getScope())
                .limitType(entity.getLimitType())
                .qpsLimit(entity.getQpsLimit())
                .concurrentLimit(entity.getConcurrentLimit())
                .tokenLimit(entity.getTokenLimit())
                .tokenWindow(entity.getTokenWindow())
                .burstFactor(entity.getBurstFactor() != null ? entity.getBurstFactor().doubleValue() : null)
                .quotaAlertThreshold(entity.getQuotaAlertThreshold())
                .status(entity.getStatus())
                .version(entity.getVersion())
                .currentStats(RateLimitResponse.CurrentStats.builder()
                        .currentQps(0L)
                        .maxQps(0L)
                        .triggeredCount(0L)
                        .totalRequests(0L)
                        .blockedRequests(0L)
                        .build())
                .createdAt(entity.getCreatedAt())
                .createdBy(entity.getCreatedBy())
                .updatedAt(entity.getUpdatedAt())
                .updatedBy(entity.getUpdatedBy())
                .build();
    }

    private RateLimitListItemResponse toListItemResponse(GwRateLimitRuleEntity entity) {
        return RateLimitListItemResponse.builder()
                .ruleId(entity.getRuleId())
                .ruleName(entity.getRuleName())
                .description(entity.getDescription())
                .routeId(entity.getRouteId())
                .routeName(resolveRouteName(entity.getRouteId()))
                .scope(entity.getScope())
                .limitType(entity.getLimitType())
                .qpsLimit(entity.getQpsLimit())
                .concurrentLimit(entity.getConcurrentLimit())
                .tokenLimit(entity.getTokenLimit())
                .status(entity.getStatus())
                .currentQps(0L)
                .currentConcurrent(0L)
                .triggeredCount(0L)
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .build();
    }

    private void clearRedisCounters(String ruleId) {
        if (redisTemplate == null) {
            return;
        }
        try {
            redisTemplate.delete("gw:ratelimit:" + ruleId + ":*").subscribe();
        } catch (Exception e) {
            log.warn("Failed to clear redis counters for rule {}", ruleId, e);
        }
    }

    private void clearRedisCounters(String ruleId, String resetType, String scopeId) {
        if (redisTemplate == null) {
            return;
        }
        try {
            if ("ALL".equals(resetType)) {
                redisTemplate.delete("gw:ratelimit:" + ruleId + ":*").subscribe();
            } else if (scopeId != null) {
                redisTemplate.delete("gw:ratelimit:" + ruleId + ":" + resetType.toLowerCase() + ":" + scopeId).subscribe();
            } else {
                redisTemplate.delete("gw:ratelimit:" + ruleId + ":" + resetType.toLowerCase() + ":*").subscribe();
            }
        } catch (Exception e) {
            log.warn("Failed to clear redis counters for rule {} resetType {}", ruleId, resetType, e);
        }
    }

    public static class RateLimitException extends RuntimeException {
        private final ErrorCode errorCode;

        public RateLimitException(ErrorCode errorCode) {
            super(errorCode.getMessage());
            this.errorCode = errorCode;
        }

        public ErrorCode getErrorCode() {
            return errorCode;
        }
    }
}
