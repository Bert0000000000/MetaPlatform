package com.metaplatform.iam.position.service;

import com.metaplatform.iam.common.ErrorCode;
import com.metaplatform.iam.common.PageResponse;
import com.metaplatform.iam.exception.IamException;
import com.metaplatform.iam.position.dto.CreatePositionRequest;
import com.metaplatform.iam.position.dto.PositionResponse;
import com.metaplatform.iam.position.dto.UpdatePositionRequest;
import com.metaplatform.iam.position.entity.PositionEntity;
import com.metaplatform.iam.position.repository.PositionRepository;
import com.metaplatform.iam.security.CurrentUserHolder;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class PositionService {

    private static final String DEFAULT_TENANT_ID = "tenant-default";
    private static final int MAX_DEPTH = 10;

    private final PositionRepository positionRepository;

    @Transactional
    public PositionResponse create(CreatePositionRequest request) {
        String tenantId = resolveTenantId(null);
        if (positionRepository.existsByTenantIdAndCodeAndDeletedFalse(tenantId, request.getCode())) {
            throw new IamException(ErrorCode.USER_ALREADY_EXISTS, "岗位编码在该租户下已存在");
        }
        int level = request.getLevel() == null ? 1 : request.getLevel();
        String parentId = request.getParentId();
        if (parentId != null && !parentId.isBlank()) {
            PositionEntity parent = positionRepository.findByIdAndDeletedFalse(parentId)
                    .orElseThrow(() -> new IamException(ErrorCode.NOT_FOUND, "上级岗位不存在"));
            level = parent.getLevel() + 1;
            if (level > MAX_DEPTH) {
                throw new IamException(ErrorCode.BUSINESS_RULE_VIOLATION, "岗位层级超过最大深度（默认 10 层）");
            }
        }
        String operator = currentOperator();
        PositionEntity entity = PositionEntity.builder()
                .id(UUID.randomUUID().toString())
                .tenantId(tenantId)
                .code(request.getCode())
                .name(request.getName())
                .level(level)
                .parentId(parentId)
                .description(request.getDescription())
                .deleted(false)
                .createdBy(operator)
                .updatedBy(operator)
                .version(1)
                .build();
        return toResponse(positionRepository.save(entity));
    }

    @Transactional(readOnly = true)
    public PageResponse<PositionResponse> list(String tenantId, String keyword, Integer page, Integer size) {
        String tid = resolveTenantId(tenantId);
        int p = page == null || page < 1 ? 1 : page;
        int s = size == null || size < 1 ? 20 : Math.min(size, 100);
        Pageable pageable = PageRequest.of(p - 1, s, Sort.by(Sort.Direction.ASC, "level", "id"));
        Page<PositionEntity> result;
        if (keyword != null && !keyword.isBlank()) {
            result = positionRepository.searchByKeyword(tid, keyword.trim(), pageable);
        } else {
            result = positionRepository.findByTenantIdAndDeletedFalse(tid, pageable);
        }
        return PageResponse.<PositionResponse>builder()
                .items(result.getContent().stream().map(this::toResponse).toList())
                .total(result.getTotalElements())
                .page(p)
                .size(s)
                .totalPages(result.getTotalPages())
                .build();
    }

    @Transactional(readOnly = true)
    public PositionResponse get(String id) {
        return toResponse(positionRepository.findByIdAndDeletedFalse(id)
                .orElseThrow(() -> new IamException(ErrorCode.NOT_FOUND, "岗位不存在")));
    }

    @Transactional
    public PositionResponse update(String id, UpdatePositionRequest request) {
        PositionEntity entity = positionRepository.findByIdAndDeletedFalse(id)
                .orElseThrow(() -> new IamException(ErrorCode.NOT_FOUND, "岗位不存在"));
        if (request.getVersion() != null && !entity.getVersion().equals(request.getVersion())) {
            throw new IamException(ErrorCode.VERSION_CONFLICT, "岗位版本不匹配");
        }
        if (request.getName() != null) entity.setName(request.getName());
        if (request.getLevel() != null) entity.setLevel(request.getLevel());
        if (request.getParentId() != null && !request.getParentId().equals(entity.getParentId())) {
            if (request.getParentId().equals(id)) {
                throw new IamException(ErrorCode.BUSINESS_RULE_VIOLATION, "不能将岗位移动到自身下");
            }
            PositionEntity parent = positionRepository.findByIdAndDeletedFalse(request.getParentId())
                    .orElseThrow(() -> new IamException(ErrorCode.NOT_FOUND, "上级岗位不存在"));
            entity.setParentId(parent.getId());
            entity.setLevel(parent.getLevel() + 1);
        }
        if (request.getDescription() != null) entity.setDescription(request.getDescription());
        entity.setUpdatedBy(currentOperator());
        return toResponse(positionRepository.save(entity));
    }

    @Transactional
    public void softDelete(String id) {
        PositionEntity entity = positionRepository.findByIdAndDeletedFalse(id)
                .orElseThrow(() -> new IamException(ErrorCode.NOT_FOUND, "岗位不存在"));
        entity.setDeleted(true);
        entity.setDeletedAt(Instant.now());
        entity.setUpdatedBy(currentOperator());
        positionRepository.save(entity);
    }

    private PositionResponse toResponse(PositionEntity e) {
        return PositionResponse.builder()
                .id(e.getId())
                .code(e.getCode())
                .name(e.getName())
                .level(e.getLevel())
                .parentId(e.getParentId())
                .description(e.getDescription())
                .version(e.getVersion())
                .createdAt(e.getCreatedAt())
                .updatedAt(e.getUpdatedAt())
                .createdBy(e.getCreatedBy())
                .updatedBy(e.getUpdatedBy())
                .build();
    }

    private String resolveTenantId(String requestTenantId) {
        return (requestTenantId == null || requestTenantId.isBlank()) ? DEFAULT_TENANT_ID : requestTenantId;
    }

    private String currentOperator() {
        try {
            return CurrentUserHolder.requireUserId();
        } catch (IamException ex) {
            return "system";
        }
    }
}