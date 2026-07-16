package com.metaplatform.iam.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.iam.common.ErrorCode;
import com.metaplatform.iam.common.PageResponse;
import com.metaplatform.iam.dto.permission.CreatePermissionRequest;
import com.metaplatform.iam.dto.permission.PermissionResponse;
import com.metaplatform.iam.dto.permission.UpdatePermissionRequest;
import com.metaplatform.iam.entity.PermissionEntity;
import com.metaplatform.iam.exception.IamException;
import com.metaplatform.iam.repository.PermissionRepository;
import com.metaplatform.iam.repository.RolePermissionRepository;
import com.metaplatform.iam.security.CurrentUserHolder;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class PermissionService {

    private static final List<String> VALID_ACTIONS = Arrays.asList(
            "READ", "CREATE", "UPDATE", "DELETE", "EXPORT", "IMPORT", "ADMIN");

    private final PermissionRepository permissionRepository;
    private final RolePermissionRepository rolePermissionRepository;
    private final ObjectMapper objectMapper;

    @Transactional
    public PermissionResponse create(CreatePermissionRequest request) {
        String tenantId = resolveTenantId(request.getTenantId());
        validateActions(request.getActions());
        if (permissionRepository.existsByTenantIdAndPermissionCodeAndDeletedFalse(tenantId, request.getPermissionCode())) {
            throw new IamException(ErrorCode.USER_ALREADY_EXISTS, "权限编码在该租户下已存在");
        }
        String operator = currentOperator();
        PermissionEntity entity = PermissionEntity.builder()
                .id(UUID.randomUUID().toString())
                .tenantId(tenantId)
                .permissionCode(request.getPermissionCode())
                .permissionName(request.getPermissionName())
                .resourceType(request.getResourceType())
                .resourceId(request.getResourceId())
                .actions(writeJson(request.getActions()))
                .effect(request.getEffect() == null ? PermissionEntity.Effect.ALLOW : request.getEffect())
                .description(request.getDescription())
                .deleted(false)
                .createdBy(operator)
                .updatedBy(operator)
                .version(1)
                .build();
        PermissionEntity saved = permissionRepository.save(entity);
        return toResponse(saved, 0L);
    }

    @Transactional(readOnly = true)
    public PageResponse<PermissionResponse> list(String tenantId,
                                                 String keyword,
                                                 String resourceType,
                                                 Integer page,
                                                 Integer size) {
        String tid = resolveTenantId(tenantId);
        int p = page == null || page < 1 ? 1 : page;
        int s = size == null || size < 1 ? 20 : Math.min(size, 100);
        Pageable pageable = PageRequest.of(p - 1, s, Sort.by(Sort.Direction.ASC, "permissionCode"));

        Page<PermissionEntity> result;
        boolean hasKeyword = keyword != null && !keyword.isBlank();
        if (resourceType != null && !resourceType.isBlank()) {
            result = permissionRepository.findByTenantIdAndResourceTypeAndDeletedFalse(tid, resourceType, pageable);
        } else if (hasKeyword) {
            result = permissionRepository.searchByKeyword(tid, keyword.trim(), pageable);
        } else {
            result = permissionRepository.findByTenantIdAndDeletedFalse(tid, pageable);
        }
        List<PermissionResponse> items = result.getContent().stream()
                .map(p2 -> toResponse(p2, rolePermissionRepository.countByRoleIdAndDeletedFalse(p2.getId())))
                .toList();
        return PageResponse.<PermissionResponse>builder()
                .items(items)
                .total(result.getTotalElements())
                .page(p)
                .size(s)
                .totalPages(result.getTotalPages())
                .build();
    }

    @Transactional(readOnly = true)
    public PermissionResponse get(String id) {
        PermissionEntity entity = permissionRepository.findByIdAndDeletedFalse(id)
                .orElseThrow(() -> new IamException(ErrorCode.NOT_FOUND, "权限不存在"));
        return toResponse(entity, rolePermissionRepository.countByRoleIdAndDeletedFalse(id));
    }

    @Transactional
    public PermissionResponse update(String id, UpdatePermissionRequest request) {
        PermissionEntity entity = permissionRepository.findByIdAndDeletedFalse(id)
                .orElseThrow(() -> new IamException(ErrorCode.NOT_FOUND, "权限不存在"));
        if (!entity.getVersion().equals(request.getVersion())) {
            throw new IamException(ErrorCode.VERSION_CONFLICT, "权限版本不匹配");
        }
        if (request.getPermissionName() != null) {
            entity.setPermissionName(request.getPermissionName());
        }
        if (request.getActions() != null) {
            validateActions(request.getActions());
            entity.setActions(writeJson(request.getActions()));
        }
        if (request.getEffect() != null) {
            entity.setEffect(request.getEffect());
        }
        if (request.getDescription() != null) {
            entity.setDescription(request.getDescription());
        }
        entity.setUpdatedBy(currentOperator());
        PermissionEntity saved = permissionRepository.save(entity);
        return toResponse(saved, rolePermissionRepository.countByRoleIdAndDeletedFalse(id));
    }

    @Transactional
    public void softDelete(String id, Boolean force) {
        PermissionEntity entity = permissionRepository.findByIdAndDeletedFalse(id)
                .orElseThrow(() -> new IamException(ErrorCode.NOT_FOUND, "权限不存在"));
        long refCount = rolePermissionRepository.countByRoleIdAndDeletedFalse(id);
        if (refCount > 0 && (force == null || !force)) {
            throw new IamException(ErrorCode.BUSINESS_RULE_VIOLATION,
                    "权限已被角色引用，需 force=true 才能删除");
        }
        entity.setDeleted(true);
        entity.setDeletedAt(Instant.now());
        entity.setUpdatedBy(currentOperator());
        permissionRepository.save(entity);
    }

    private void validateActions(List<String> actions) {
        if (actions == null || actions.isEmpty()) {
            throw new IamException(ErrorCode.INVALID_PARAM, "actions 不能为空");
        }
        for (String a : actions) {
            if (!VALID_ACTIONS.contains(a)) {
                throw new IamException(ErrorCode.INVALID_FIELD_VALUE,
                        "不支持的操作类型: " + a + "，仅支持 " + VALID_ACTIONS);
            }
        }
    }

    private String writeJson(List<String> list) {
        try {
            return objectMapper.writeValueAsString(list);
        } catch (JsonProcessingException e) {
            log.warn("actions 序列化失败，使用降级方案", e);
            return "[\"" + String.join("\",\"", list) + "\"]";
        }
    }

    private List<String> readJson(String json) {
        if (json == null || json.isBlank()) {
            return Collections.emptyList();
        }
        try {
            return objectMapper.readValue(json, objectMapper.getTypeFactory()
                    .constructCollectionType(List.class, String.class));
        } catch (JsonProcessingException e) {
            log.warn("actions 反序列化失败: {}", json, e);
            return Collections.emptyList();
        }
    }

    private PermissionResponse toResponse(PermissionEntity e, Long roleCount) {
        return PermissionResponse.builder()
                .permissionId(e.getId())
                .permissionCode(e.getPermissionCode())
                .permissionName(e.getPermissionName())
                .resourceType(e.getResourceType())
                .resourceId(e.getResourceId())
                .actions(readJson(e.getActions()))
                .effect(e.getEffect())
                .description(e.getDescription())
                .version(e.getVersion())
                .roleCount(roleCount)
                .createdAt(e.getCreatedAt())
                .updatedAt(e.getUpdatedAt())
                .createdBy(e.getCreatedBy())
                .updatedBy(e.getUpdatedBy())
                .build();
    }

    private String resolveTenantId(String requestTenantId) {
        return (requestTenantId == null || requestTenantId.isBlank()) ? "tenant-default" : requestTenantId;
    }

    private String currentOperator() {
        try {
            return CurrentUserHolder.requireUserId();
        } catch (IamException ex) {
            return "system";
        }
    }
}