package com.metaplatform.llmgw.audit.service;

import com.metaplatform.llmgw.audit.dto.AuditLogDto;
import com.metaplatform.llmgw.audit.dto.AuditQueryRequest;
import com.metaplatform.llmgw.audit.dto.AuditStatisticsDto;
import com.metaplatform.llmgw.entity.AuditLogEntity;
import com.metaplatform.llmgw.repository.AuditLogEntityRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.CriteriaQuery;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class AuditService {

    private final AuditLogEntityRepository auditLogEntityRepository;
    private final EntityManager entityManager;

    @Transactional(readOnly = true)
    public Page<AuditLogDto> list(Pageable pageable) {
        return auditLogEntityRepository.findAll(pageable).map(this::toDto);
    }

    @Transactional(readOnly = true)
    public AuditLogDto getById(Long id) {
        AuditLogEntity entity = auditLogEntityRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Audit log not found: " + id));
        return toDto(entity);
    }

    @Transactional(readOnly = true)
    public Page<AuditLogDto> query(AuditQueryRequest request) {
        int page = request.page() == null || request.page() < 0 ? 0 : request.page();
        int size = request.size() == null || request.size() <= 0 ? 20 : request.size();
        Pageable pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());

        CriteriaBuilder cb = entityManager.getCriteriaBuilder();
        CriteriaQuery<AuditLogEntity> query = cb.createQuery(AuditLogEntity.class);
        Root<AuditLogEntity> root = query.from(AuditLogEntity.class);
        List<Predicate> predicates = buildPredicates(cb, root, request);
        query.where(predicates.toArray(new Predicate[0]));
        query.orderBy(cb.desc(root.get("createdAt")));

        List<AuditLogEntity> entities = entityManager.createQuery(query)
                .setFirstResult((int) pageable.getOffset())
                .setMaxResults(pageable.getPageSize())
                .getResultList();

        CriteriaQuery<Long> countQuery = cb.createQuery(Long.class);
        Root<AuditLogEntity> countRoot = countQuery.from(AuditLogEntity.class);
        List<Predicate> countPredicates = buildPredicates(cb, countRoot, request);
        countQuery.select(cb.count(countRoot));
        countQuery.where(countPredicates.toArray(new Predicate[0]));
        Long total = entityManager.createQuery(countQuery).getSingleResult();

        List<AuditLogDto> dtos = entities.stream().map(this::toDto).toList();
        return new PageImpl<>(dtos, pageable, total);
    }

    @Transactional(readOnly = true)
    public AuditStatisticsDto getStatistics(LocalDateTime start, LocalDateTime end) {
        List<AuditLogEntity> entities = auditLogEntityRepository.findByCreatedAtBetween(start, end);
        long totalRequests = entities.size();
        long totalInputTokens = 0L;
        long totalOutputTokens = 0L;
        long totalTokens = 0L;
        long totalLatencyMs = 0L;
        for (AuditLogEntity entity : entities) {
            if (entity.getInputTokens() != null) {
                totalInputTokens += entity.getInputTokens();
            }
            if (entity.getOutputTokens() != null) {
                totalOutputTokens += entity.getOutputTokens();
            }
            if (entity.getTotalTokens() != null) {
                totalTokens += entity.getTotalTokens();
            }
            if (entity.getLatencyMs() != null) {
                totalLatencyMs += entity.getLatencyMs();
            }
        }
        Double averageLatencyMs = totalRequests == 0 ? 0.0 : (double) totalLatencyMs / totalRequests;
        return new AuditStatisticsDto(totalRequests, totalInputTokens, totalOutputTokens, totalTokens, totalLatencyMs, averageLatencyMs);
    }

    private List<Predicate> buildPredicates(CriteriaBuilder cb, Root<AuditLogEntity> root, AuditQueryRequest request) {
        List<Predicate> predicates = new ArrayList<>();
        if (request.userId() != null && !request.userId().isBlank()) {
            predicates.add(cb.equal(root.get("userId"), request.userId()));
        }
        if (request.modelId() != null && !request.modelId().isBlank()) {
            predicates.add(cb.equal(root.get("modelId"), request.modelId()));
        }
        if (request.startTime() != null) {
            predicates.add(cb.greaterThanOrEqualTo(root.get("createdAt"), request.startTime()));
        }
        if (request.endTime() != null) {
            predicates.add(cb.lessThanOrEqualTo(root.get("createdAt"), request.endTime()));
        }
        return predicates;
    }

    private AuditLogDto toDto(AuditLogEntity entity) {
        return new AuditLogDto(
                entity.getId(),
                entity.getTraceId(),
                entity.getUserId(),
                entity.getAppId(),
                entity.getModelId(),
                entity.getEndpoint(),
                entity.getMethod(),
                entity.getInputTokens(),
                entity.getOutputTokens(),
                entity.getTotalTokens(),
                entity.getLatencyMs(),
                entity.getStatusCode(),
                entity.getErrorMessage(),
                entity.getRequestBody(),
                entity.getResponseBody(),
                entity.getMetadata(),
                entity.getCreatedAt()
        );
    }
}
