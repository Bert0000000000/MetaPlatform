package com.metaplatform.ea.governance.review.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.metaplatform.ea.common.ErrorCode;
import com.metaplatform.ea.common.TenantContext;
import com.metaplatform.ea.exception.EaException;
import com.metaplatform.ea.governance.review.dto.*;
import com.metaplatform.ea.governance.review.entity.ReviewTemplateEntity;
import com.metaplatform.ea.governance.review.entity.ReviewTicketEntity;
import com.metaplatform.ea.governance.review.repository.ReviewTemplateRepository;
import com.metaplatform.ea.governance.review.repository.ReviewTicketRepository;
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
public class ReviewTicketService {

    private static final Set<String> TERMINAL_STATUSES = Set.of("APPROVED", "REJECTED");
    private static final Set<String> ALLOWED_STATUSES = Set.of("CREATED", "REVIEWING", "APPROVED", "REJECTED");

    private final ReviewTicketRepository repository;
    private final ReviewTemplateRepository templateRepository;
    private final ObjectMapper objectMapper;

    @Transactional
    public ReviewTicketResponse create(CreateReviewTicketRequest request) {
        String tenantId = TenantContext.getOrDefault();
        validateTemplate(tenantId, request.getTemplateId());
        validateJson(request.getMetadata(), "metadata");

        Instant now = Instant.now();
        ReviewTicketEntity entity = ReviewTicketEntity.builder()
                .tenantId(tenantId)
                .title(request.getTitle())
                .templateId(request.getTemplateId())
                .targetType(request.getTargetType())
                .targetId(request.getTargetId())
                .applicant(request.getApplicant())
                .reviewer(request.getReviewer())
                .status("CREATED")
                .scores("[]")
                .comments("[]")
                .metadata(normalizeJson(request.getMetadata(), "{}"))
                .createdAt(now)
                .updatedAt(now)
                .build();
        return toResponse(repository.save(entity));
    }

    @Transactional(readOnly = true)
    public List<ReviewTicketResponse> list(String status) {
        String tenantId = TenantContext.getOrDefault();
        List<ReviewTicketEntity> items;
        if (StringUtils.hasText(status)) {
            items = repository.findByTenantIdAndStatusAndDeletedAtIsNull(tenantId, status.toUpperCase());
        } else {
            items = repository.findByTenantIdAndDeletedAtIsNull(tenantId);
        }
        return items.stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public ReviewTicketResponse get(UUID id) {
        return toResponse(findById(id));
    }

    @Transactional
    public ReviewTicketResponse update(UUID id, UpdateReviewTicketRequest request) {
        ReviewTicketEntity entity = findById(id);
        if (TERMINAL_STATUSES.contains(entity.getStatus())) {
            throw new EaException(ErrorCode.STATE_CONFLICT, "评审工单已结束，无法修改");
        }
        if (StringUtils.hasText(request.getTitle())) entity.setTitle(request.getTitle());
        if (request.getTemplateId() != null) {
            validateTemplate(entity.getTenantId(), request.getTemplateId());
            entity.setTemplateId(request.getTemplateId());
        }
        if (request.getTargetType() != null) entity.setTargetType(request.getTargetType());
        if (request.getTargetId() != null) entity.setTargetId(request.getTargetId());
        if (request.getApplicant() != null) entity.setApplicant(request.getApplicant());
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
        ReviewTicketEntity entity = findById(id);
        Instant now = Instant.now();
        entity.setDeletedAt(now);
        entity.setUpdatedAt(now);
        repository.save(entity);
    }

    @Transactional
    public ReviewTicketResponse startReview(UUID id, String reviewer) {
        ReviewTicketEntity entity = findById(id);
        if (!"CREATED".equals(entity.getStatus())) {
            throw new EaException(ErrorCode.STATE_CONFLICT, "仅 CREATED 状态可开始评审");
        }
        entity.setStatus("REVIEWING");
        if (StringUtils.hasText(reviewer)) entity.setReviewer(reviewer);
        entity.setSubmittedAt(Instant.now());
        entity.setUpdatedAt(Instant.now());
        return toResponse(repository.save(entity));
    }

    @Transactional
    public ReviewTicketResponse approve(UUID id, ReviewTicketScoreRequest request) {
        ReviewTicketEntity entity = findById(id);
        if (!"REVIEWING".equals(entity.getStatus())) {
            throw new EaException(ErrorCode.STATE_CONFLICT, "仅 REVIEWING 状态可通过");
        }
        applyScoresAndComment(entity, request, "APPROVE");
        entity.setStatus("APPROVED");
        entity.setDecision(StringUtils.hasText(request.getDecision()) ? request.getDecision() : "APPROVED");
        entity.setDecidedAt(Instant.now());
        entity.setUpdatedAt(Instant.now());
        return toResponse(repository.save(entity));
    }

    @Transactional
    public ReviewTicketResponse reject(UUID id, ReviewTicketScoreRequest request) {
        ReviewTicketEntity entity = findById(id);
        if (!"REVIEWING".equals(entity.getStatus())) {
            throw new EaException(ErrorCode.STATE_CONFLICT, "仅 REVIEWING 状态可驳回");
        }
        applyScoresAndComment(entity, request, "REJECT");
        entity.setStatus("REJECTED");
        entity.setDecision(StringUtils.hasText(request.getDecision()) ? request.getDecision() : "REJECTED");
        entity.setDecidedAt(Instant.now());
        entity.setUpdatedAt(Instant.now());
        return toResponse(repository.save(entity));
    }

    @Transactional
    public ReviewTicketResponse addComment(UUID id, String reviewer, String comment) {
        ReviewTicketEntity entity = findById(id);
        appendComment(entity, "COMMENT", comment, reviewer);
        entity.setUpdatedAt(Instant.now());
        return toResponse(repository.save(entity));
    }

    public ReviewTicketEntity findById(UUID id) {
        String tenantId = TenantContext.getOrDefault();
        return repository.findByIdAndDeletedAtIsNull(id)
                .filter(e -> e.getTenantId().equals(tenantId))
                .orElseThrow(() -> new EaException(ErrorCode.NOT_FOUND, "评审工单不存在"));
    }

    private void applyScoresAndComment(ReviewTicketEntity entity, ReviewTicketScoreRequest request, String action) {
        if (StringUtils.hasText(request.getReviewer())) entity.setReviewer(request.getReviewer());
        if (request.getScores() != null) {
            entity.setScores(writeValueAsString(request.getScores()));
        }
        if (StringUtils.hasText(request.getComment())) {
            appendComment(entity, action, request.getComment(), request.getReviewer());
        }
    }

    private void appendComment(ReviewTicketEntity entity, String action, String comment, String author) {
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
            ObjectNode node = objectMapper.createObjectNode();
            node.put("action", action);
            node.put("content", comment);
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

    private void validateTemplate(String tenantId, UUID templateId) {
        if (templateId == null) return;
        ReviewTemplateEntity template = templateRepository.findByIdAndDeletedAtIsNull(templateId)
                .orElseThrow(() -> new EaException(ErrorCode.NOT_FOUND, "评审模板不存在"));
        if (!template.getTenantId().equals(tenantId)) {
            throw new EaException(ErrorCode.PERMISSION_DENIED, "无权访问该评审模板");
        }
    }

    private void validateJson(String value, String field) {
        if (value == null || value.isBlank()) return;
        try {
            objectMapper.readTree(value);
        } catch (Exception e) {
            throw new EaException(ErrorCode.INVALID_PARAM, field + " 不是合法的 JSON");
        }
    }

    private String normalizeJson(String value, String defaultValue) {
        if (value == null || value.isBlank()) return defaultValue;
        return value;
    }

    private String writeValueAsString(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (Exception e) {
            throw new EaException(ErrorCode.INTERNAL_ERROR, "JSON 序列化失败: " + e.getMessage());
        }
    }

    private ReviewTicketResponse toResponse(ReviewTicketEntity entity) {
        String templateName = null;
        if (entity.getTemplateId() != null) {
            templateName = templateRepository.findByIdAndDeletedAtIsNull(entity.getTemplateId())
                    .map(ReviewTemplateEntity::getName)
                    .orElse(null);
        }
        return ReviewTicketResponse.builder()
                .id(entity.getId())
                .tenantId(entity.getTenantId())
                .title(entity.getTitle())
                .templateId(entity.getTemplateId())
                .templateName(templateName)
                .targetType(entity.getTargetType())
                .targetId(entity.getTargetId())
                .applicant(entity.getApplicant())
                .reviewer(entity.getReviewer())
                .status(entity.getStatus())
                .scores(entity.getScores())
                .comments(entity.getComments())
                .decision(entity.getDecision())
                .submittedAt(entity.getSubmittedAt())
                .decidedAt(entity.getDecidedAt())
                .metadata(entity.getMetadata())
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .build();
    }
}
