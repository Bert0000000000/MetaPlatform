package com.metaplatform.gw.gray.service;

import com.metaplatform.gw.common.ErrorCode;
import com.metaplatform.gw.common.PageResponse;
import com.metaplatform.gw.common.TenantContext;
import com.metaplatform.gw.gray.dto.CreateGrayReleaseRequest;
import com.metaplatform.gw.gray.dto.GrayReleaseResponse;
import com.metaplatform.gw.gray.entity.GwGrayReleaseEntity;
import com.metaplatform.gw.gray.repository.GwGrayReleaseRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Mono;
import reactor.core.scheduler.Schedulers;

import java.security.MessageDigest;
import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Random;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class GrayReleaseService {

    private final GwGrayReleaseRepository repository;

    private static final Set<String> VALID_STRATEGIES = Set.of("PERCENTAGE", "HEADER", "IP", "USER");
    private static final Set<String> VALID_STATUSES = Set.of("DRAFT", "ACTIVE", "STOPPED", "COMPLETED");
    private static final String DEFAULT_STATUS = "DRAFT";
    private static final long DEFAULT_SEED = 0L;

    public Mono<GrayReleaseResponse> create(CreateGrayReleaseRequest request) {
        return Mono.fromCallable(() -> {
            validate(request);
            LocalDateTime now = LocalDateTime.now();
            GwGrayReleaseEntity entity = GwGrayReleaseEntity.builder()
                    .id(UUID.randomUUID())
                    .tenantId(TenantContext.resolveOrDefault(request.getTenantId()))
                    .apiId(request.getApiId())
                    .name(request.getName())
                    .status(DEFAULT_STATUS)
                    .strategy(request.getStrategy())
                    .strategyConfig(request.getStrategyConfig())
                    .newVersion(request.getNewVersion())
                    .oldVersion(request.getOldVersion())
                    .startAt(request.getStartAt())
                    .endAt(request.getEndAt())
                    .createdAt(now)
                    .updatedAt(now)
                    .build();
            entity = repository.save(entity);
            return GrayReleaseResponse.fromEntity(entity);
        }).subscribeOn(Schedulers.boundedElastic());
    }

    public Mono<GrayReleaseResponse> get(UUID id) {
        return Mono.fromCallable(() -> repository.findByIdAndDeletedAtIsNull(id)
                .map(GrayReleaseResponse::fromEntity)
                .orElseThrow(() -> new GrayReleaseException(ErrorCode.NOT_FOUND)))
                .subscribeOn(Schedulers.boundedElastic());
    }

    public Mono<PageResponse<GrayReleaseResponse>> list(int page, int size, String tenantId) {
        return Mono.fromCallable(() -> {
            Pageable pageable = PageRequest.of(Math.max(page - 1, 0), size,
                    Sort.by(Sort.Direction.DESC, "createdAt"));
            Page<GwGrayReleaseEntity> entityPage = repository
                    .findByTenantIdAndDeletedAtIsNullOrderByCreatedAtDesc(
                            TenantContext.resolveOrDefault(tenantId), pageable);
            List<GrayReleaseResponse> items = entityPage.getContent().stream()
                    .map(GrayReleaseResponse::fromEntity)
                    .toList();
            return PageResponse.<GrayReleaseResponse>builder()
                    .items(items)
                    .total(entityPage.getTotalElements())
                    .page(page)
                    .size(size)
                    .totalPages(entityPage.getTotalPages())
                    .build();
        }).subscribeOn(Schedulers.boundedElastic());
    }

    public Mono<GrayReleaseResponse> update(UUID id, CreateGrayReleaseRequest request) {
        return Mono.fromCallable(() -> {
            GwGrayReleaseEntity entity = repository.findByIdAndDeletedAtIsNull(id)
                    .orElseThrow(() -> new GrayReleaseException(ErrorCode.NOT_FOUND));
            if (request.getStrategy() != null) {
                if (!VALID_STRATEGIES.contains(request.getStrategy())) {
                    throw new GrayReleaseException(ErrorCode.INVALID_FIELD_VALUE);
                }
                entity.setStrategy(request.getStrategy());
            }
            if (request.getName() != null) entity.setName(request.getName());
            if (request.getApiId() != null) entity.setApiId(request.getApiId());
            if (request.getStrategyConfig() != null) entity.setStrategyConfig(request.getStrategyConfig());
            if (request.getNewVersion() != null) entity.setNewVersion(request.getNewVersion());
            if (request.getOldVersion() != null) entity.setOldVersion(request.getOldVersion());
            if (request.getStartAt() != null) entity.setStartAt(request.getStartAt());
            if (request.getEndAt() != null) entity.setEndAt(request.getEndAt());
            entity.setUpdatedAt(LocalDateTime.now());
            entity = repository.save(entity);
            return GrayReleaseResponse.fromEntity(entity);
        }).subscribeOn(Schedulers.boundedElastic());
    }

    public Mono<GrayReleaseResponse> updateStatus(UUID id, String newStatus) {
        return Mono.fromCallable(() -> {
            if (!VALID_STATUSES.contains(newStatus)) {
                throw new GrayReleaseException(ErrorCode.INVALID_FIELD_VALUE);
            }
            GwGrayReleaseEntity entity = repository.findByIdAndDeletedAtIsNull(id)
                    .orElseThrow(() -> new GrayReleaseException(ErrorCode.NOT_FOUND));
            entity.setStatus(newStatus);
            entity.setUpdatedAt(LocalDateTime.now());
            entity = repository.save(entity);
            return GrayReleaseResponse.fromEntity(entity);
        }).subscribeOn(Schedulers.boundedElastic());
    }

    public Mono<GrayReleaseResponse> start(UUID id) {
        return updateStatus(id, "ACTIVE");
    }

    public Mono<GrayReleaseResponse> stop(UUID id) {
        return updateStatus(id, "STOPPED");
    }

    public Mono<GrayReleaseResponse> complete(UUID id) {
        return updateStatus(id, "COMPLETED");
    }

    public Mono<Void> delete(UUID id) {
        return Mono.fromRunnable(() -> {
            GwGrayReleaseEntity entity = repository.findByIdAndDeletedAtIsNull(id)
                    .orElseThrow(() -> new GrayReleaseException(ErrorCode.NOT_FOUND));
            entity.setDeletedAt(LocalDateTime.now());
            repository.save(entity);
        }).subscribeOn(Schedulers.boundedElastic()).then();
    }

    /**
     * Evaluate the request against the gray release rules for the given API.
     *
     * @return Optional containing the matched gray release (if any). When matched, the configured
     *         strategy determines whether the traffic should use the new or old version.
     */
    public java.util.Optional<GwGrayReleaseEntity> matchRequest(UUID apiId, ServerHttpRequest request) {
        if (apiId == null) return java.util.Optional.empty();
        List<GwGrayReleaseEntity> activeReleases =
                repository.findByApiIdAndStatusAndDeletedAtIsNull(apiId, "ACTIVE");
        LocalDateTime now = LocalDateTime.now();
        for (GwGrayReleaseEntity release : activeReleases) {
            if (!isWithinWindow(release, now)) continue;
            if (matchesStrategy(release, request)) {
                return java.util.Optional.of(release);
            }
        }
        return java.util.Optional.empty();
    }

    private boolean isWithinWindow(GwGrayReleaseEntity release, LocalDateTime now) {
        if (release.getStartAt() != null && now.isBefore(release.getStartAt())) return false;
        if (release.getEndAt() != null && now.isAfter(release.getEndAt())) return false;
        return true;
    }

    private boolean matchesStrategy(GwGrayReleaseEntity release, ServerHttpRequest request) {
        String strategy = release.getStrategy();
        Map<String, Object> config = release.getStrategyConfig() == null
                ? Map.of() : release.getStrategyConfig();
        switch (strategy) {
            case "PERCENTAGE":
                return matchesPercentage(config);
            case "HEADER":
                return matchesHeader(config, request);
            case "IP":
                return matchesIp(config, request);
            case "USER":
                return matchesUser(config, request);
            default:
                return false;
        }
    }

    @SuppressWarnings("unchecked")
    private boolean matchesPercentage(Map<String, Object> config) {
        Object pctObj = config.get("percentage");
        double pct = pctObj instanceof Number ? ((Number) pctObj).doubleValue() : 0d;
        if (pct <= 0) return false;
        if (pct >= 100) return true;
        long seed = config.get("seed") instanceof Number ? ((Number) config.get("seed")).longValue() : DEFAULT_SEED;
        long bucket = Math.abs(hash(String.valueOf(seed))) % 100;
        return bucket < (long) pct;
    }

    @SuppressWarnings("unchecked")
    private boolean matchesHeader(Map<String, Object> config, ServerHttpRequest request) {
        Object headerName = config.get("headerName");
        Object expectedValue = config.get("expectedValue");
        if (!(headerName instanceof String) || !(expectedValue instanceof String)) return false;
        String actual = request.getHeaders().getFirst((String) headerName);
        return expectedValue.equals(actual);
    }

    @SuppressWarnings("unchecked")
    private boolean matchesIp(Map<String, Object> config, ServerHttpRequest request) {
        Object allowedIps = config.get("allowedIps");
        if (!(allowedIps instanceof List)) return false;
        Set<String> allowed = new HashSet<>();
        for (Object o : (List<Object>) allowedIps) {
            if (o != null) allowed.add(o.toString());
        }
        String remote = request.getRemoteAddress() == null || request.getRemoteAddress().getAddress() == null
                ? null : request.getRemoteAddress().getAddress().getHostAddress();
        return remote != null && allowed.contains(remote);
    }

    @SuppressWarnings("unchecked")
    private boolean matchesUser(Map<String, Object> config, ServerHttpRequest request) {
        Object allowedUsers = config.get("allowedUsers");
        if (!(allowedUsers instanceof List)) return false;
        Set<String> allowed = new HashSet<>();
        for (Object o : (List<Object>) allowedUsers) {
            if (o != null) allowed.add(o.toString());
        }
        String userId = request.getHeaders().getFirst("X-User-Id");
        return userId != null && allowed.contains(userId);
    }

    private long hash(String key) {
        try {
            MessageDigest md = MessageDigest.getInstance("MD5");
            byte[] digest = md.digest(key.getBytes());
            long h = 0;
            for (int i = 0; i < 8 && i < digest.length; i++) {
                h = (h << 8) | (digest[i] & 0xffL);
            }
            return h;
        } catch (Exception e) {
            return new Random(key.hashCode()).nextLong();
        }
    }

    private void validate(CreateGrayReleaseRequest request) {
        if (request.getStrategy() == null || !VALID_STRATEGIES.contains(request.getStrategy())) {
            throw new GrayReleaseException(ErrorCode.INVALID_FIELD_VALUE);
        }
    }

    public static class GrayReleaseException extends RuntimeException {
        private final ErrorCode errorCode;

        public GrayReleaseException(ErrorCode errorCode) {
            super(errorCode.getMessage());
            this.errorCode = errorCode;
        }

        public ErrorCode getErrorCode() {
            return errorCode;
        }
    }
}
