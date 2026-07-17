package com.metaplatform.gw.api.service;

import com.metaplatform.gw.api.dto.ApiListItem;
import com.metaplatform.gw.api.dto.ApiResponse;
import com.metaplatform.gw.api.dto.CreateApiRequest;
import com.metaplatform.gw.api.dto.UpdateApiRequest;
import com.metaplatform.gw.api.entity.GwApiEntity;
import com.metaplatform.gw.api.repository.GwApiRepository;
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
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class ApiService {

    private final GwApiRepository apiRepository;

    private static final String DEFAULT_GROUP = "default";
    private static final String DEFAULT_VERSION = "v1";
    private static final String DEFAULT_STATUS = "ACTIVE";
    private static final List<String> VALID_METHODS = List.of("GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS");
    private static final List<String> VALID_STATUSES = List.of("ACTIVE", "DEPRECATED", "DISABLED");

    public Mono<ApiResponse> createApi(CreateApiRequest request) {
        return Mono.fromCallable(() -> {
            validateMethod(request.getMethod());
            validateStatus(request.getStatus());

            String tenantId = TenantContext.resolveOrDefault(request.getTenantId());

            if (apiRepository.existsByTenantIdAndPathAndMethodAndVersionAndDeletedAtIsNull(
                    tenantId, request.getPath(), request.getMethod(),
                    request.getVersion() != null ? request.getVersion() : DEFAULT_VERSION)) {
                throw new ApiException(ErrorCode.ROUTE_ALREADY_EXISTS);
            }

            LocalDateTime now = LocalDateTime.now();
            GwApiEntity entity = GwApiEntity.builder()
                    .id(UUID.randomUUID())
                    .tenantId(tenantId)
                    .name(request.getName())
                    .path(request.getPath())
                    .method(request.getMethod())
                    .groupName(request.getGroupName() != null ? request.getGroupName() : DEFAULT_GROUP)
                    .version(request.getVersion() != null ? request.getVersion() : DEFAULT_VERSION)
                    .targetService(request.getTargetService())
                    .description(request.getDescription())
                    .status(request.getStatus() != null ? request.getStatus() : DEFAULT_STATUS)
                    .metadata(request.getMetadata())
                    .requestSchema(request.getRequestSchema())
                    .responseSchema(request.getResponseSchema())
                    .parameters(request.getParameters())
                    .examples(request.getExamples())
                    .createdAt(now)
                    .updatedAt(now)
                    .build();

            entity = apiRepository.save(entity);
            return ApiResponse.fromEntity(entity);
        }).subscribeOn(Schedulers.boundedElastic());
    }

    public Mono<PageResponse<ApiListItem>> listApis(int page, int size, String tenantId,
                                                    String groupName, String version, String keyword) {
        return Mono.fromCallable(() -> {
            String tid = TenantContext.resolveOrDefault(tenantId);
            Pageable pageable = PageRequest.of(Math.max(page - 1, 0), size,
                    Sort.by(Sort.Direction.DESC, "createdAt"));
            Page<GwApiEntity> entityPage = apiRepository.searchApis(tid, groupName, version, keyword, pageable);

            List<ApiListItem> items = entityPage.getContent().stream()
                    .map(ApiService::toListItem)
                    .toList();

            return PageResponse.<ApiListItem>builder()
                    .items(items)
                    .total(entityPage.getTotalElements())
                    .page(page)
                    .size(size)
                    .totalPages(entityPage.getTotalPages())
                    .build();
        }).subscribeOn(Schedulers.boundedElastic());
    }

    public Mono<PageResponse<ApiListItem>> listByGroup(String groupName, int page, int size, String tenantId) {
        return Mono.fromCallable(() -> {
            String tid = TenantContext.resolveOrDefault(tenantId);
            Pageable pageable = PageRequest.of(Math.max(page - 1, 0), size,
                    Sort.by(Sort.Direction.DESC, "createdAt"));
            Page<GwApiEntity> entityPage = apiRepository
                    .findByTenantIdAndGroupNameAndDeletedAtIsNullOrderByCreatedAtDesc(tid, groupName, pageable);

            List<ApiListItem> items = entityPage.getContent().stream()
                    .map(ApiService::toListItem)
                    .toList();

            return PageResponse.<ApiListItem>builder()
                    .items(items)
                    .total(entityPage.getTotalElements())
                    .page(page)
                    .size(size)
                    .totalPages(entityPage.getTotalPages())
                    .build();
        }).subscribeOn(Schedulers.boundedElastic());
    }

    public Mono<ApiResponse> getApi(UUID id) {
        return Mono.fromCallable(() -> {
            GwApiEntity entity = apiRepository.findByIdAndDeletedAtIsNull(id)
                    .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND));
            return ApiResponse.fromEntity(entity);
        }).subscribeOn(Schedulers.boundedElastic());
    }

    public Mono<ApiResponse> updateApi(UUID id, UpdateApiRequest request) {
        return Mono.fromCallable(() -> {
            GwApiEntity entity = apiRepository.findByIdAndDeletedAtIsNull(id)
                    .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND));

            if (request.getMethod() != null) {
                validateMethod(request.getMethod());
            }
            if (request.getStatus() != null) {
                validateStatus(request.getStatus());
            }

            if (request.getName() != null) entity.setName(request.getName());
            if (request.getPath() != null) entity.setPath(request.getPath());
            if (request.getMethod() != null) entity.setMethod(request.getMethod());
            if (request.getGroupName() != null) entity.setGroupName(request.getGroupName());
            if (request.getVersion() != null) entity.setVersion(request.getVersion());
            if (request.getTargetService() != null) entity.setTargetService(request.getTargetService());
            if (request.getDescription() != null) entity.setDescription(request.getDescription());
            if (request.getStatus() != null) entity.setStatus(request.getStatus());
            if (request.getMetadata() != null) entity.setMetadata(request.getMetadata());
            if (request.getRequestSchema() != null) entity.setRequestSchema(request.getRequestSchema());
            if (request.getResponseSchema() != null) entity.setResponseSchema(request.getResponseSchema());
            if (request.getParameters() != null) entity.setParameters(request.getParameters());
            if (request.getExamples() != null) entity.setExamples(request.getExamples());
            entity.setUpdatedAt(LocalDateTime.now());

            entity = apiRepository.save(entity);
            return ApiResponse.fromEntity(entity);
        }).subscribeOn(Schedulers.boundedElastic());
    }

    public Mono<Void> deleteApi(UUID id) {
        return Mono.fromRunnable(() -> {
            GwApiEntity entity = apiRepository.findByIdAndDeletedAtIsNull(id)
                    .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND));
            entity.setDeletedAt(LocalDateTime.now());
            apiRepository.save(entity);
        }).subscribeOn(Schedulers.boundedElastic()).then();
    }

    public Mono<List<ApiListItem>> findByGroup(String groupName, String tenantId) {
        return Mono.fromCallable(() -> apiRepository
                        .findByTenantIdAndGroupNameAndDeletedAtIsNull(
                                TenantContext.resolveOrDefault(tenantId), groupName).stream()
                        .map(ApiService::toListItem).toList())
                .subscribeOn(Schedulers.boundedElastic());
    }

    public static ApiListItem toListItem(GwApiEntity entity) {
        return ApiListItem.builder()
                .id(entity.getId() != null ? entity.getId().toString() : null)
                .tenantId(entity.getTenantId())
                .name(entity.getName())
                .path(entity.getPath())
                .method(entity.getMethod())
                .groupName(entity.getGroupName())
                .version(entity.getVersion())
                .targetService(entity.getTargetService())
                .description(entity.getDescription())
                .status(entity.getStatus())
                .createdAt(entity.getCreatedAt() != null ? entity.getCreatedAt().toString() : null)
                .updatedAt(entity.getUpdatedAt() != null ? entity.getUpdatedAt().toString() : null)
                .build();
    }

    private void validateMethod(String method) {
        if (method == null || !VALID_METHODS.contains(method)) {
            throw new ApiException(ErrorCode.INVALID_FIELD_VALUE);
        }
    }

    private void validateStatus(String status) {
        if (status != null && !VALID_STATUSES.contains(status)) {
            throw new ApiException(ErrorCode.INVALID_FIELD_VALUE);
        }
    }

    public static class ApiException extends RuntimeException {
        private final ErrorCode errorCode;

        public ApiException(ErrorCode errorCode) {
            super(errorCode.getMessage());
            this.errorCode = errorCode;
        }

        public ErrorCode getErrorCode() {
            return errorCode;
        }
    }
}
