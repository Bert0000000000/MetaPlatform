package com.metaplatform.ea.review.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.metaplatform.ea.common.ErrorCode;
import com.metaplatform.ea.common.TenantContext;
import com.metaplatform.ea.exception.EaException;
import com.metaplatform.ea.review.dto.ArchitectureReviewResponse;
import com.metaplatform.ea.review.dto.CreateArchitectureReviewRequest;
import com.metaplatform.ea.review.dto.ReviewActionRequest;
import com.metaplatform.ea.review.dto.UpdateArchitectureReviewRequest;
import com.metaplatform.ea.review.entity.ArchitectureReviewEntity;
import com.metaplatform.ea.review.repository.ArchitectureReviewRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ArchitectureReviewService {

    private static final Set<String> ALLOWED_TYPES = Set.of(
            "APPLICATION", "TECH_STACK", "INFRASTRUCTURE", "BUSINESS_PROCESS", "DATA_DOMAIN", "DATA_ENTITY");
    private static final Set<String> TERMINAL_STATUSES = Set.of("APPROVED", "REJECTED");

    private final ArchitectureReviewRepository repository;
    private final ObjectMapper objectMapper;

    @Transactional
    public ArchitectureReviewResponse create(CreateArchitectureReviewRequest request) {
        String tenantId = TenantContext.getOrDefault();
        validateReviewType(request.getReviewType());
        validateJson(request.getMetadata(), "metadata");

        Instant now = Instant.now();
        ArchitectureReviewEntity entity = ArchitectureReviewEntity.builder()
                .tenantId(tenantId)
                .title(request.getTitle())
                .reviewType(request.getReviewType())
                .targetId(request.getTargetId())
                .targetType(request.getTargetType())
                .status("DRAFT")
                .summary(request.getSummary())
                .decision(null)
                .comments("[]")
                .attachments("[]")
                .createdBy(null)
                .reviewer(request.getReviewer())
                .submittedAt(null)
                .decidedAt(null)
                .metadata(normalizeJson(request.getMetadata(), "{}"))
                .createdAt(now)
                .updatedAt(now)
                .build();
        return toResponse(repository.save(entity));
    }

    @Transactional(readOnly = true)
    public List<ArchitectureReviewResponse> list(String status, UUID targetId, String targetType) {
        String tenantId = TenantContext.getOrDefault();
        List<ArchitectureReviewEntity> items;
        if (targetId != null && StringUtils.hasText(targetType)) {
            items = repository.findByTenantIdAndTargetIdAndTargetTypeAndDeletedAtIsNull(tenantId, targetId, targetType);
        } else if (StringUtils.hasText(status)) {
            items = repository.findByTenantIdAndStatusAndDeletedAtIsNull(tenantId, status);
        } else {
            items = repository.findByTenantIdAndDeletedAtIsNull(tenantId);
        }
        return items.stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public ArchitectureReviewResponse get(UUID id) {
        return toResponse(findById(id));
    }

    @Transactional
    public ArchitectureReviewResponse update(UUID id, UpdateArchitectureReviewRequest request) {
        ArchitectureReviewEntity entity = findById(id);
        if (TERMINAL_STATUSES.contains(entity.getStatus())) {
            throw new EaException(ErrorCode.STATE_CONFLICT, "评审已结束，无法修改");
        }
        if (StringUtils.hasText(request.getTitle())) entity.setTitle(request.getTitle());
        if (request.getSummary() != null) entity.setSummary(request.getSummary());
        if (request.getDecision() != null) entity.setDecision(request.getDecision());
        if (request.getReviewer() != null) entity.setReviewer(request.getReviewer());
        if (request.getMetadata() != null) {
            validateJson(request.getMetadata(), "metadata");
            entity.setMetadata(normalizeJson(request.getMetadata(), "{}"));
        }
        entity.setUpdatedAt(Instant.now());
        return toResponse(repository.save(entity));
    }

    @Transactional
    public void delete(UUID id) {
        ArchitectureReviewEntity entity = findById(id);
        Instant now = Instant.now();
        entity.setDeletedAt(now);
        entity.setUpdatedAt(now);
        repository.save(entity);
    }

    @Transactional
    public ArchitectureReviewResponse submit(UUID id, ReviewActionRequest request) {
        ArchitectureReviewEntity entity = findById(id);
        if (!"DRAFT".equals(entity.getStatus())) {
            throw new EaException(ErrorCode.STATE_CONFLICT, "仅 DRAFT 状态的评审可提交");
        }
        appendComment(entity, "SUBMIT", request.getComment(), request.getReviewer());
        entity.setStatus("SUBMITTED");
        entity.setSubmittedAt(Instant.now());
        entity.setUpdatedAt(Instant.now());
        return toResponse(repository.save(entity));
    }

    @Transactional
    public ArchitectureReviewResponse approve(UUID id, ReviewActionRequest request) {
        ArchitectureReviewEntity entity = findById(id);
        if (!"SUBMITTED".equals(entity.getStatus())) {
            throw new EaException(ErrorCode.STATE_CONFLICT, "仅 SUBMITTED 状态的评审可通过");
        }
        appendComment(entity, "APPROVE", request.getComment(), request.getReviewer());
        entity.setStatus("APPROVED");
        entity.setDecision(StringUtils.hasText(request.getDecision()) ? request.getDecision() : "APPROVED");
        entity.setDecidedAt(Instant.now());
        entity.setUpdatedAt(Instant.now());
        if (request.getReviewer() != null) entity.setReviewer(request.getReviewer());
        return toResponse(repository.save(entity));
    }

    @Transactional
    public ArchitectureReviewResponse reject(UUID id, ReviewActionRequest request) {
        ArchitectureReviewEntity entity = findById(id);
        if (!"SUBMITTED".equals(entity.getStatus())) {
            throw new EaException(ErrorCode.STATE_CONFLICT, "仅 SUBMITTED 状态的评审可驳回");
        }
        appendComment(entity, "REJECT", request.getComment(), request.getReviewer());
        entity.setStatus("REJECTED");
        entity.setDecision(StringUtils.hasText(request.getDecision()) ? request.getDecision() : "REJECTED");
        entity.setDecidedAt(Instant.now());
        entity.setUpdatedAt(Instant.now());
        if (request.getReviewer() != null) entity.setReviewer(request.getReviewer());
        return toResponse(repository.save(entity));
    }

    @Transactional
    public ArchitectureReviewResponse addComment(UUID id, ReviewActionRequest request) {
        ArchitectureReviewEntity entity = findById(id);
        appendComment(entity, "COMMENT", request.getComment(), request.getReviewer());
        entity.setUpdatedAt(Instant.now());
        return toResponse(repository.save(entity));
    }

    public ArchitectureReviewEntity findById(UUID id) {
        String tenantId = TenantContext.getOrDefault();
        return repository.findByIdAndDeletedAtIsNull(id)
                .filter(e -> e.getTenantId().equals(tenantId))
                .orElseThrow(() -> new EaException(ErrorCode.NOT_FOUND, "架构评审不存在"));
    }

    private void appendComment(ArchitectureReviewEntity entity, String action, String comment, String author) {
        if (!StringUtils.hasText(comment)) {
            throw new EaException(ErrorCode.INVALID_PARAM, "评论内容不能为空");
        }
        try {
            ArrayNode array;
            String current = entity.getComments();
            if (current == null || current.isBlank()) {
                array = objectMapper.createArrayNode();
            } else {
                JsonNode parsed = objectMapper.readTree(current);
                if (!(parsed instanceof ArrayNode existing)) {
                    throw new EaException(ErrorCode.INTERNAL_ERROR, "comments 字段不是数组");
                }
                array = existing;
            }
            com.fasterxml.jackson.databind.node.ObjectNode node = objectMapper.createObjectNode();
            node.put("action", action);
            node.put("comment", comment);
            if (StringUtils.hasText(author)) node.put("author", author);
            node.put("createdAt", Instant.now().toString());
            array.add(node);
            entity.setComments(objectMapper.writeValueAsString(array));
        } catch (EaException e) {
            throw e;
        } catch (Exception e) {
            throw new EaException(ErrorCode.INTERNAL_ERROR, "评论追加失败: " + e.getMessage());
        }
    }

    private ArchitectureReviewResponse toResponse(ArchitectureReviewEntity entity) {
        return ArchitectureReviewResponse.builder()
                .id(entity.getId())
                .tenantId(entity.getTenantId())
                .title(entity.getTitle())
                .reviewType(entity.getReviewType())
                .targetId(entity.getTargetId())
                .targetType(entity.getTargetType())
                .status(entity.getStatus())
                .summary(entity.getSummary())
                .decision(entity.getDecision())
                .comments(entity.getComments())
                .attachments(entity.getAttachments())
                .createdBy(entity.getCreatedBy())
                .reviewer(entity.getReviewer())
                .submittedAt(entity.getSubmittedAt())
                .decidedAt(entity.getDecidedAt())
                .metadata(entity.getMetadata())
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .build();
    }

    private void validateReviewType(String type) {
        if (!StringUtils.hasText(type) || !ALLOWED_TYPES.contains(type)) {
            throw new EaException(ErrorCode.INVALID_PARAM,
                    "reviewType 必须为: " + ALLOWED_TYPES);
        }
    }

    private void validateJson(String value, String field) {
        if (value == null || value.isBlank()) {
            return;
        }
        try {
            objectMapper.readTree(value);
        } catch (Exception e) {
            throw new EaException(ErrorCode.INVALID_PARAM, field + " 不是合法的 JSON");
        }
    }

    private String normalizeJson(String value, String defaultValue) {
        if (value == null || value.isBlank()) {
            return defaultValue;
        }
        return value;
    }
}