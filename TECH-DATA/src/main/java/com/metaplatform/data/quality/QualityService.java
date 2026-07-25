package com.metaplatform.data.quality;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.core.type.TypeReference;
import com.metaplatform.data.common.ErrorCode;
import com.metaplatform.data.common.PageResponse;
import com.metaplatform.data.common.TenantContext;
import com.metaplatform.data.entity.QualityCheckEntity;
import com.metaplatform.data.entity.QualityRuleEntity;
import com.metaplatform.data.exception.DataException;
import com.metaplatform.data.quality.dto.CreateQualityRuleRequest;
import com.metaplatform.data.quality.dto.QualityCheckResultResponse;
import com.metaplatform.data.quality.dto.QualityIssueResponse;
import com.metaplatform.data.quality.dto.QualityOverviewResponse;
import com.metaplatform.data.quality.dto.QualityReportResponse;
import com.metaplatform.data.quality.dto.QualityRuleResponse;
import com.metaplatform.data.repository.QualityCheckRepository;
import com.metaplatform.data.repository.QualityRuleRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Example;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * 数据质量服务：规则 CRUD + overview/issues/run/checks/reports/dashboard。
 *
 * <p>对应 Python app/quality/service.py 的 QualityService。</p>
 *
 * <p>持久化存储（quality_rule / quality_check 表）；6 维度评分卡。</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class QualityService {

    private static final List<String> DIMENSIONS = List.of(
            "completeness", "uniqueness", "consistency", "accuracy", "timeliness", "validity");

    private final ObjectMapper objectMapper;
    private final QualityRuleRepository qualityRuleRepository;
    private final QualityCheckRepository qualityCheckRepository;

    /**
     * 创建质量规则。
     */
    @Transactional
    public QualityRuleResponse createRule(CreateQualityRuleRequest request) {
        String tenantId = TenantContext.getTenantIdOrDefault();
        String ruleId = "qr-" + UUID.randomUUID().toString().replace("-", "");
        QualityRuleEntity entity = new QualityRuleEntity();
        entity.setId(ruleId);
        entity.setTenantId(tenantId);
        entity.setName(request.getName());
        entity.setTargetAssetId(request.getTargetAssetId());
        entity.setType(request.getRuleType());
        entity.setSeverity(request.getSeverity());
        entity.setExpression(request.getExpression() != null ? request.getExpression() : "");
        entity.setDescription(request.getDescription());
        entity.setEnabled(true);

        QualityRuleEntity saved = qualityRuleRepository.save(entity);
        log.info("质量规则创建 | tenant={} id={} name={}", tenantId, ruleId, request.getName());
        return toResponse(saved);
    }

    @Transactional(readOnly = true)
    public PageResponse<QualityRuleResponse> listRules(String targetAssetId, String ruleType, int page, int pageSize) {
        String tenantId = TenantContext.getTenantIdOrDefault();
        PageRequest pageable = PageRequest.of(Math.max(page - 1, 0), pageSize,
                Sort.by(Sort.Direction.DESC, "createdAt"));

        QualityRuleEntity probe = new QualityRuleEntity();
        probe.setTenantId(tenantId);
        if (targetAssetId != null && !targetAssetId.isBlank()) {
            probe.setTargetAssetId(targetAssetId);
        }
        if (ruleType != null && !ruleType.isBlank()) {
            probe.setType(ruleType);
        }
        Page<QualityRuleEntity> result = qualityRuleRepository.findAll(Example.of(probe), pageable);

        return PageResponse.of(
                result.getContent().stream().map(this::toResponse).toList(),
                result.getTotalElements(), page, pageSize);
    }

    @Transactional(readOnly = true)
    public QualityRuleResponse getRule(String ruleId) {
        return toResponse(requireRule(ruleId));
    }

    @Transactional
    public boolean deleteRule(String ruleId) {
        QualityRuleEntity entity = requireRule(ruleId);
        qualityRuleRepository.delete(entity);
        return true;
    }

    /**
     * 质量概览（从 QualityCheckRepository 聚合真实指标）。
     */
    @Transactional(readOnly = true)
    public QualityOverviewResponse overview() {
        String tenantId = TenantContext.getTenantIdOrDefault();

        long totalRules = qualityRuleRepository.findByTenantId(tenantId,
                PageRequest.of(0, 1, Sort.by(Sort.Direction.DESC, "createdAt"))).getTotalElements();
        long activeRules = qualityRuleRepository.findByTenantIdAndEnabled(tenantId, true,
                PageRequest.of(0, 1, Sort.by(Sort.Direction.DESC, "createdAt"))).getTotalElements();

        long totalChecks = qualityCheckRepository.findByTenantId(tenantId,
                PageRequest.of(0, 1, Sort.by(Sort.Direction.DESC, "checkedAt"))).getTotalElements();
        long passedChecks = qualityCheckRepository.findByTenantIdAndStatus(tenantId, "PASS",
                PageRequest.of(0, 1)).getTotalElements();
        long failedChecks = qualityCheckRepository.findByTenantIdAndStatus(tenantId, "FAIL",
                PageRequest.of(0, 1)).getTotalElements();

        double overallPassRate = totalChecks > 0 ? (double) passedChecks / totalChecks : 1.0;

        Map<String, Double> scores = new LinkedHashMap<>();
        List<QualityOverviewResponse.DimensionScore> dimensionScores = new ArrayList<>();
        for (String dim : DIMENSIONS) {
            scores.put(dim, overallPassRate);
            dimensionScores.add(QualityOverviewResponse.DimensionScore.builder()
                    .dimension(dim)
                    .score(overallPassRate)
                    .status(overallPassRate >= 0.95 ? "GOOD" : overallPassRate >= 0.8 ? "WARNING" : "BAD")
                    .lastChecked(OffsetDateTime.now())
                    .build());
        }

        return QualityOverviewResponse.builder()
                .totalRules((int) totalRules)
                .activeRules((int) activeRules)
                .totalChecks(totalChecks)
                .passedChecks(passedChecks)
                .failedChecks(failedChecks)
                .overallPassRate(overallPassRate)
                .dimensionScores(scores)
                .dimensions(dimensionScores)
                .build();
    }

    /**
     * 问题列表（stub：无独立问题存储，返回空）。
     */
    @Transactional(readOnly = true)
    public PageResponse<QualityIssueResponse> issues(String targetAssetId, int page, int pageSize) {
        return PageResponse.empty(page, pageSize);
    }

    /**
     * 触发规则运行（stub：真实 JDBC 执行由外部模块覆盖，结果保存到 QualityCheckRepository）。
     */
    @Transactional
    public QualityCheckResultResponse run(String ruleId) {
        QualityRuleEntity rule = requireRule(ruleId);
        String tenantId = TenantContext.getTenantIdOrDefault();
        String checkId = "qc-" + UUID.randomUUID().toString().replace("-", "");

        QualityCheckEntity checkEntity = new QualityCheckEntity();
        checkEntity.setId(checkId);
        checkEntity.setTenantId(tenantId);
        checkEntity.setRuleId(ruleId);
        checkEntity.setAssetId(rule.getTargetAssetId());
        checkEntity.setStatus("PASS");
        checkEntity.setPassedRecords(0L);
        checkEntity.setFailedRecords(0L);
        checkEntity.setTotalRecords(0L);
        checkEntity.setPassRate(1.0);
        checkEntity.setErrorSamples(null);
        checkEntity.setCheckedAt(OffsetDateTime.now());

        qualityCheckRepository.save(checkEntity);
        log.info("质量规则运行 | rule={} check={} status=PASS", ruleId, checkId);
        return toCheckResponse(checkEntity);
    }

    /**
     * 规则历史检查记录。
     */
    @Transactional(readOnly = true)
    public PageResponse<QualityCheckResultResponse> checks(String ruleId, int page, int pageSize) {
        String tenantId = TenantContext.getTenantIdOrDefault();
        requireRule(ruleId);
        PageRequest pageable = PageRequest.of(Math.max(page - 1, 0), pageSize);
        Page<QualityCheckEntity> result = qualityCheckRepository
                .findByTenantIdAndRuleIdOrderByCheckedAtDesc(tenantId, ruleId, pageable);
        return PageResponse.of(
                result.getContent().stream().map(this::toCheckResponse).toList(),
                result.getTotalElements(), page, pageSize);
    }

    /**
     * 生成报告（stub）。
     */
    @Transactional(readOnly = true)
    public QualityReportResponse generateReport(String targetAssetId) {
        return QualityReportResponse.builder()
                .reportId("qrep-" + UUID.randomUUID().toString().replace("-", ""))
                .tenantId(TenantContext.getTenantIdOrDefault())
                .targetAssetId(targetAssetId)
                .generatedAt(OffsetDateTime.now())
                .overallScore(1.0)
                .dimensionScores(Collections.emptyMap())
                .issues(Collections.emptyList())
                .checks(Collections.emptyList())
                .build();
    }

    /**
     * 仪表盘。
     */
    @Transactional(readOnly = true)
    public QualityOverviewResponse dashboard() {
        return overview();
    }

    // =====================================================================
    // 内部辅助方法
    // =====================================================================

    private QualityRuleEntity requireRule(String ruleId) {
        String tenantId = TenantContext.getTenantIdOrDefault();
        return qualityRuleRepository.findByIdAndTenantId(ruleId, tenantId)
                .orElseThrow(() -> new DataException(ErrorCode.QUALITY_RULE_NOT_FOUND, "质量规则不存在: " + ruleId));
    }

    private QualityRuleResponse toResponse(QualityRuleEntity entity) {
        return QualityRuleResponse.builder()
                .id(entity.getId())
                .tenantId(entity.getTenantId())
                .name(entity.getName())
                .targetAssetId(entity.getTargetAssetId())
                .ruleType(entity.getType())
                .expression(entity.getExpression())
                .severity(entity.getSeverity())
                .config(objectMapper.createObjectNode())
                .status(Boolean.TRUE.equals(entity.getEnabled()) ? "ACTIVE" : "INACTIVE")
                .description(entity.getDescription())
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .build();
    }

    private QualityCheckResultResponse toCheckResponse(QualityCheckEntity entity) {
        return QualityCheckResultResponse.builder()
                .checkId(entity.getId())
                .ruleId(entity.getRuleId())
                .targetAssetId(entity.getAssetId())
                .status(entity.getStatus())
                .totalRows(entity.getTotalRecords() != null ? entity.getTotalRecords() : 0L)
                .passedRows(entity.getPassedRecords() != null ? entity.getPassedRecords() : 0L)
                .failedRows(entity.getFailedRecords() != null ? entity.getFailedRecords() : 0L)
                .passRate(entity.getPassRate() != null ? entity.getPassRate() : 1.0)
                .metrics(parseMap(entity.getErrorSamples()))
                .checkedAt(entity.getCheckedAt())
                .build();
    }

    private Map<String, Object> parseMap(String json) {
        if (json == null || json.isBlank()) return Collections.emptyMap();
        try {
            return objectMapper.readValue(json, new TypeReference<Map<String, Object>>() {});
        } catch (Exception e) {
            return Collections.emptyMap();
        }
    }
}
