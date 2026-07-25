package com.metaplatform.llmgw.cost.service;

import com.metaplatform.llmgw.cost.dto.*;
import com.metaplatform.llmgw.entity.CostRecordEntity;
import com.metaplatform.llmgw.entity.ModelEntity;
import com.metaplatform.llmgw.repository.CostRecordEntityRepository;
import com.metaplatform.llmgw.repository.ModelEntityRepository;
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

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CostService {

    private final CostRecordEntityRepository costRecordEntityRepository;
    private final ModelEntityRepository modelEntityRepository;
    private final EntityManager entityManager;

    @Transactional(readOnly = true)
    public Page<CostRecordDto> list(Pageable pageable) {
        return costRecordEntityRepository.findAll(pageable).map(this::toDto);
    }

    @Transactional(readOnly = true)
    public Page<CostRecordDto> query(CostQueryRequest request) {
        int page = request.page() == null || request.page() < 0 ? 0 : request.page();
        int size = request.size() == null || request.size() <= 0 ? 20 : request.size();
        Pageable pageable = PageRequest.of(page, size, Sort.by("billingDate").descending());

        CriteriaBuilder cb = entityManager.getCriteriaBuilder();
        CriteriaQuery<CostRecordEntity> query = cb.createQuery(CostRecordEntity.class);
        Root<CostRecordEntity> root = query.from(CostRecordEntity.class);
        List<Predicate> predicates = buildPredicates(cb, root, request);
        query.where(predicates.toArray(new Predicate[0]));
        query.orderBy(cb.desc(root.get("billingDate")));

        List<CostRecordEntity> entities = entityManager.createQuery(query)
                .setFirstResult((int) pageable.getOffset())
                .setMaxResults(pageable.getPageSize())
                .getResultList();

        CriteriaQuery<Long> countQuery = cb.createQuery(Long.class);
        Root<CostRecordEntity> countRoot = countQuery.from(CostRecordEntity.class);
        List<Predicate> countPredicates = buildPredicates(cb, countRoot, request);
        countQuery.select(cb.count(countRoot));
        countQuery.where(countPredicates.toArray(new Predicate[0]));
        Long total = entityManager.createQuery(countQuery).getSingleResult();

        List<CostRecordDto> dtos = entities.stream().map(this::toDto).toList();
        return new PageImpl<>(dtos, pageable, total);
    }

    @Transactional(readOnly = true)
    public CostSummaryDto getSummary(LocalDate start, LocalDate end) {
        List<CostRecordEntity> records = costRecordEntityRepository.findByBillingDateBetween(start, end);
        return aggregateSummary(start, end, records);
    }

    @Transactional(readOnly = true)
    public List<CostByModelDto> getSummaryByModel(LocalDate start, LocalDate end) {
        List<CostRecordEntity> records = costRecordEntityRepository.findByBillingDateBetween(start, end);
        Map<String, List<CostRecordEntity>> grouped = records.stream().collect(Collectors.groupingBy(CostRecordEntity::getModelId));
        return grouped.entrySet().stream()
                .map(entry -> {
                    CostSummaryDto summary = aggregateSummary(start, end, entry.getValue());
                    return new CostByModelDto(
                            entry.getKey(),
                            summary.totalInputTokens(),
                            summary.totalOutputTokens(),
                            summary.totalCost(),
                            summary.currency(),
                            summary.recordCount()
                    );
                })
                .toList();
    }

    @Transactional(readOnly = true)
    public List<CostByUserDto> getSummaryByUser(LocalDate start, LocalDate end) {
        List<CostRecordEntity> records = costRecordEntityRepository.findByBillingDateBetween(start, end);
        Map<String, List<CostRecordEntity>> grouped = records.stream()
                .collect(Collectors.groupingBy(r -> r.getUserId() == null ? "anonymous" : r.getUserId()));
        return grouped.entrySet().stream()
                .map(entry -> {
                    CostSummaryDto summary = aggregateSummary(start, end, entry.getValue());
                    return new CostByUserDto(
                            entry.getKey(),
                            summary.totalInputTokens(),
                            summary.totalOutputTokens(),
                            summary.totalCost(),
                            summary.currency(),
                            summary.recordCount()
                    );
                })
                .toList();
    }

    @Transactional(readOnly = true)
    public BigDecimal calculateCost(String modelId, int inputTokens, int outputTokens) {
        ModelEntity model = modelEntityRepository.findByModelId(modelId)
                .orElseThrow(() -> new IllegalArgumentException("Model not found: " + modelId));
        BigDecimal inputPrice = model.getInputPricePer1k() == null ? BigDecimal.ZERO : model.getInputPricePer1k();
        BigDecimal outputPrice = model.getOutputPricePer1k() == null ? BigDecimal.ZERO : model.getOutputPricePer1k();
        BigDecimal inputCost = inputPrice.multiply(BigDecimal.valueOf(inputTokens))
                .divide(BigDecimal.valueOf(1000), 6, RoundingMode.HALF_UP);
        BigDecimal outputCost = outputPrice.multiply(BigDecimal.valueOf(outputTokens))
                .divide(BigDecimal.valueOf(1000), 6, RoundingMode.HALF_UP);
        return inputCost.add(outputCost).setScale(6, RoundingMode.HALF_UP);
    }

    private CostSummaryDto aggregateSummary(LocalDate start, LocalDate end, List<CostRecordEntity> records) {
        long totalInputTokens = 0L;
        long totalOutputTokens = 0L;
        BigDecimal totalCost = BigDecimal.ZERO;
        String currency = "CNY";
        for (CostRecordEntity record : records) {
            if (record.getInputTokens() != null) {
                totalInputTokens += record.getInputTokens();
            }
            if (record.getOutputTokens() != null) {
                totalOutputTokens += record.getOutputTokens();
            }
            if (record.getTotalCost() != null) {
                totalCost = totalCost.add(record.getTotalCost());
            }
            if (record.getCurrency() != null) {
                currency = record.getCurrency();
            }
        }
        return new CostSummaryDto(start, end, totalInputTokens, totalOutputTokens, totalCost, currency, (long) records.size());
    }

    private List<Predicate> buildPredicates(CriteriaBuilder cb, Root<CostRecordEntity> root, CostQueryRequest request) {
        List<Predicate> predicates = new ArrayList<>();
        if (request.startDate() != null) {
            predicates.add(cb.greaterThanOrEqualTo(root.get("billingDate"), request.startDate()));
        }
        if (request.endDate() != null) {
            predicates.add(cb.lessThanOrEqualTo(root.get("billingDate"), request.endDate()));
        }
        if (request.userId() != null && !request.userId().isBlank()) {
            predicates.add(cb.equal(root.get("userId"), request.userId()));
        }
        if (request.modelId() != null && !request.modelId().isBlank()) {
            predicates.add(cb.equal(root.get("modelId"), request.modelId()));
        }
        if (request.provider() != null && !request.provider().isBlank()) {
            predicates.add(cb.equal(root.get("provider"), request.provider()));
        }
        return predicates;
    }

    private CostRecordDto toDto(CostRecordEntity entity) {
        return new CostRecordDto(
                entity.getId(),
                entity.getTraceId(),
                entity.getUserId(),
                entity.getAppId(),
                entity.getModelId(),
                entity.getProvider(),
                entity.getInputTokens(),
                entity.getOutputTokens(),
                entity.getInputCost(),
                entity.getOutputCost(),
                entity.getTotalCost(),
                entity.getCurrency(),
                entity.getBillingDate(),
                entity.getCreatedAt()
        );
    }
}
