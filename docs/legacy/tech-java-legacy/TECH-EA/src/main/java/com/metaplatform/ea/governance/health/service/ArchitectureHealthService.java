package com.metaplatform.ea.governance.health.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.ea.application.entity.ApplicationEntity;
import com.metaplatform.ea.application.repository.ApplicationRepository;
import com.metaplatform.ea.capability.repository.BusinessCapabilityRepository;
import com.metaplatform.ea.capabilitymap.repository.CapabilityMapRepository;
import com.metaplatform.ea.common.ErrorCode;
import com.metaplatform.ea.common.TenantContext;
import com.metaplatform.ea.dataarchitecture.repository.DataEntityRepository;
import com.metaplatform.ea.dataarchitecture.repository.DataFlowRepository;
import com.metaplatform.ea.dataarchitecture.repository.DataStandardRepository;
import com.metaplatform.ea.debt.entity.TechDebtEntity;
import com.metaplatform.ea.debt.repository.TechDebtRepository;
import com.metaplatform.ea.debt.repository.TechStandardRepository;
import com.metaplatform.ea.exception.EaException;
import com.metaplatform.ea.governance.health.dto.*;
import com.metaplatform.ea.governance.health.entity.HealthScoreEntity;
import com.metaplatform.ea.governance.health.repository.HealthScoreRepository;
import com.metaplatform.ea.governance.principle.repository.ArchitecturePrincipleRepository;
import com.metaplatform.ea.governance.review.entity.ReviewTicketEntity;
import com.metaplatform.ea.governance.review.repository.ReviewTicketRepository;
import com.metaplatform.ea.mapping.repository.CapabilityConceptMappingRepository;
import com.metaplatform.ea.ontmapping.repository.ConceptMappingRuleRepository;
import com.metaplatform.ea.process.repository.BusinessProcessRepository;
import com.metaplatform.ea.techarchitecture.repository.InfrastructureRepository;
import com.metaplatform.ea.techradar.entity.TechnologyRadarEntity;
import com.metaplatform.ea.techradar.repository.TechnologyRadarRepository;
import com.metaplatform.ea.techstack.repository.TechnologyStackRepository;
import com.metaplatform.ea.valuestream.repository.ValueStreamRepository;
import com.metaplatform.ea.valuestream.repository.ValueStreamStageRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.Instant;
import java.time.LocalDate;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class ArchitectureHealthService {

    public static final String DIM_BUSINESS = "business";
    public static final String DIM_APPLICATION = "application";
    public static final String DIM_DATA = "data";
    public static final String DIM_TECHNOLOGY = "technology";
    public static final String DIM_GOVERNANCE = "governance";
    public static final String DIM_OVERALL = "overall";

    private static final Set<String> VALID_DIMENSIONS = Set.of(
            DIM_BUSINESS, DIM_APPLICATION, DIM_DATA, DIM_TECHNOLOGY, DIM_GOVERNANCE);

    private final CapabilityMapRepository capabilityMapRepository;
    private final BusinessCapabilityRepository capabilityRepository;
    private final CapabilityConceptMappingRepository capabilityMappingRepository;
    private final ValueStreamRepository valueStreamRepository;
    private final ValueStreamStageRepository valueStreamStageRepository;
    private final BusinessProcessRepository businessProcessRepository;
    private final ApplicationRepository applicationRepository;
    private final TechDebtRepository techDebtRepository;
    private final DataEntityRepository dataEntityRepository;
    private final DataFlowRepository dataFlowRepository;
    private final DataStandardRepository dataStandardRepository;
    private final TechStandardRepository techStandardRepository;
    private final TechnologyStackRepository techStackRepository;
    private final TechnologyRadarRepository technologyRadarRepository;
    private final InfrastructureRepository infrastructureRepository;
    private final ArchitecturePrincipleRepository principleRepository;
    private final ReviewTicketRepository reviewTicketRepository;
    private final ConceptMappingRuleRepository conceptMappingRuleRepository;
    private final HealthScoreRepository healthScoreRepository;
    private final ObjectMapper objectMapper;

    // ---------- 对外查询 ----------

    @Transactional(readOnly = true)
    public HealthOverviewResponse getOverview() {
        String tenantId = TenantContext.getOrDefault();
        LocalDate today = LocalDate.now();

        List<HealthScoreEntity> todayScores = healthScoreRepository.findByTenantIdAndScoreDate(tenantId, today);
        Map<String, Double> dimensionScores = new LinkedHashMap<>();
        if (todayScores.isEmpty()) {
            Map<String, DimensionResult> results = computeAllDimensions(tenantId);
            for (Map.Entry<String, DimensionResult> entry : results.entrySet()) {
                dimensionScores.put(entry.getKey(), entry.getValue().score());
            }
        } else {
            for (HealthScoreEntity hs : todayScores) {
                if (!DIM_OVERALL.equals(hs.getDimension())) {
                    dimensionScores.put(hs.getDimension(), hs.getScore() != null ? hs.getScore() : 0.0);
                }
            }
        }

        double overall = dimensionScores.values().stream()
                .mapToDouble(Double::doubleValue).average().orElse(0.0);
        overall = Math.round(overall * 100.0) / 100.0;

        List<TrendPoint> recentTrend = loadTrend(tenantId, 7);
        List<RiskItemResponse> risks = identifyRisks(tenantId, dimensionScores);

        return HealthOverviewResponse.builder()
                .overallScore(overall)
                .dimensionScores(dimensionScores)
                .recentTrend(recentTrend)
                .keyRisks(risks)
                .assessedDate(today)
                .build();
    }

    @Transactional(readOnly = true)
    public DimensionHealthResponse getDimensionDetail(String dimension) {
        validateDimension(dimension);
        String tenantId = TenantContext.getOrDefault();
        DimensionResult result = computeDimension(tenantId, dimension);
        return DimensionHealthResponse.builder()
                .dimension(dimension)
                .score(result.score())
                .metrics(result.metrics())
                .improvementSuggestions(result.suggestions())
                .build();
    }

    @Transactional(readOnly = true)
    public List<RiskItemResponse> getRisks(String severity) {
        String tenantId = TenantContext.getOrDefault();
        LocalDate today = LocalDate.now();
        List<HealthScoreEntity> todayScores = healthScoreRepository.findByTenantIdAndScoreDate(tenantId, today);
        Map<String, Double> dimensionScores = new LinkedHashMap<>();
        if (todayScores.isEmpty()) {
            Map<String, DimensionResult> results = computeAllDimensions(tenantId);
            for (Map.Entry<String, DimensionResult> entry : results.entrySet()) {
                dimensionScores.put(entry.getKey(), entry.getValue().score());
            }
        } else {
            for (HealthScoreEntity hs : todayScores) {
                if (!DIM_OVERALL.equals(hs.getDimension())) {
                    dimensionScores.put(hs.getDimension(), hs.getScore() != null ? hs.getScore() : 0.0);
                }
            }
        }
        List<RiskItemResponse> allRisks = identifyRisks(tenantId, dimensionScores);
        if (StringUtils.hasText(severity)) {
            return allRisks.stream().filter(r -> severity.equalsIgnoreCase(r.severity())).toList();
        }
        return allRisks;
    }

    @Transactional(readOnly = true)
    public HealthTrendResponse getTrends(int days) {
        String tenantId = TenantContext.getOrDefault();
        int safeDays = Math.max(1, Math.min(days, 365));
        List<TrendPoint> trends = loadTrend(tenantId, safeDays);
        return HealthTrendResponse.builder()
                .days(safeDays)
                .trends(trends)
                .build();
    }

    // ---------- 定时计算并缓存 ----------

    @Scheduled(cron = "0 0 1 * * *")
    @Transactional
    public void calculateAndCacheDailyHealth() {
        String tenantId = TenantContext.getOrDefault();
        LocalDate today = LocalDate.now();
        log.info("Calculating architecture health scores for tenant={}, date={}", tenantId, today);

        Map<String, DimensionResult> results = computeAllDimensions(tenantId);
        double overall = results.values().stream()
                .mapToDouble(DimensionResult::score).average().orElse(0.0);
        overall = Math.round(overall * 100.0) / 100.0;

        saveScore(tenantId, today, DIM_OVERALL, overall, Map.of("dimensions", results.keySet()));
        for (Map.Entry<String, DimensionResult> entry : results.entrySet()) {
            saveScore(tenantId, today, entry.getKey(), entry.getValue().score(), entry.getValue().metrics());
        }
    }

    private void saveScore(String tenantId, LocalDate date, String dimension, double score, Map<String, Object> metrics) {
        Optional<HealthScoreEntity> existing = healthScoreRepository
                .findByTenantIdAndScoreDateAndDimension(tenantId, date, dimension);
        String metricsJson = serializeMetrics(metrics);
        if (existing.isPresent()) {
            HealthScoreEntity entity = existing.get();
            entity.setScore(score);
            entity.setMetrics(metricsJson);
            healthScoreRepository.save(entity);
        } else {
            HealthScoreEntity entity = HealthScoreEntity.builder()
                    .tenantId(tenantId)
                    .scoreDate(date)
                    .dimension(dimension)
                    .score(score)
                    .metrics(metricsJson)
                    .createdAt(Instant.now())
                    .build();
            healthScoreRepository.save(entity);
        }
    }

    // ---------- 维度计算 ----------

    private Map<String, DimensionResult> computeAllDimensions(String tenantId) {
        Map<String, DimensionResult> results = new LinkedHashMap<>();
        results.put(DIM_BUSINESS, computeBusiness(tenantId));
        results.put(DIM_APPLICATION, computeApplication(tenantId));
        results.put(DIM_DATA, computeData(tenantId));
        results.put(DIM_TECHNOLOGY, computeTechnology(tenantId));
        results.put(DIM_GOVERNANCE, computeGovernance(tenantId));
        return results;
    }

    private DimensionResult computeDimension(String tenantId, String dimension) {
        return switch (dimension) {
            case DIM_BUSINESS -> computeBusiness(tenantId);
            case DIM_APPLICATION -> computeApplication(tenantId);
            case DIM_DATA -> computeData(tenantId);
            case DIM_TECHNOLOGY -> computeTechnology(tenantId);
            case DIM_GOVERNANCE -> computeGovernance(tenantId);
            default -> throw new EaException(ErrorCode.INVALID_PARAM, "不支持的维度: " + dimension);
        };
    }

    private DimensionResult computeBusiness(String tenantId) {
        Map<String, Object> metrics = new LinkedHashMap<>();

        // 能力地图覆盖率：有根能力的能力地图 / 总能力地图
        long totalMaps = capabilityMapRepository.findByTenantIdAndDeletedAtIsNull(tenantId).size();
        long mapsWithRoot = capabilityMapRepository.findByTenantIdAndDeletedAtIsNull(tenantId).stream()
                .filter(m -> m.getRootCapabilityId() != null).count();
        double mapCoverage = ratioOrHundred(mapsWithRoot, totalMaps);
        metrics.put("capabilityMapCoverage", mapCoverage);
        metrics.put("totalMaps", totalMaps);
        metrics.put("mapsWithRootCapability", mapsWithRoot);

        // 价值流完整度：有价值流阶段的价值流 / 总价值流
        long totalValueStreams = valueStreamRepository.findByTenantIdAndDeletedAtIsNull(tenantId).size();
        long valueStreamsWithStages = valueStreamRepository.findByTenantIdAndDeletedAtIsNull(tenantId).stream()
                .filter(vs -> !valueStreamStageRepository
                        .findByValueStreamIdAndDeletedAtIsNullOrderBySortOrderAsc(vs.getId()).isEmpty())
                .count();
        double valueStreamCompleteness = ratioOrHundred(valueStreamsWithStages, totalValueStreams);
        metrics.put("valueStreamCompleteness", valueStreamCompleteness);
        metrics.put("totalValueStreams", totalValueStreams);

        // 业务流程文档化率：有描述或 BPMN 的流程 / 总流程
        long totalProcesses = businessProcessRepository.findByTenantIdAndDeletedAtIsNull(tenantId).size();
        long documentedProcesses = businessProcessRepository.findByTenantIdAndDeletedAtIsNull(tenantId).stream()
                .filter(p -> StringUtils.hasText(p.getDescription()) || StringUtils.hasText(p.getBpmnXml()))
                .count();
        double processDocRate = ratioOrHundred(documentedProcesses, totalProcesses);
        metrics.put("processDocumentationRate", processDocRate);
        metrics.put("totalProcesses", totalProcesses);

        double score = avg(mapCoverage, valueStreamCompleteness, processDocRate);
        List<String> suggestions = new ArrayList<>();
        if (mapCoverage < 80) suggestions.add("为更多能力地图设置根能力以提升覆盖率");
        if (valueStreamCompleteness < 80) suggestions.add("补充价值流的阶段定义，提升完整度");
        if (processDocRate < 80) suggestions.add("为业务流程补充描述文档与 BPMN 流程图");

        return new DimensionResult(score, metrics, suggestions);
    }

    private DimensionResult computeApplication(String tenantId) {
        Map<String, Object> metrics = new LinkedHashMap<>();
        List<ApplicationEntity> apps = applicationRepository.findByTenantIdAndDeletedAtIsNull(tenantId);

        // 应用-能力对齐率：有 capability_ids 的应用 / 总应用
        long totalApps = apps.size();
        long appsWithCapabilities = apps.stream()
                .filter(a -> a.getCapabilityIds() != null && !a.getCapabilityIds().isEmpty())
                .count();
        double alignmentRate = ratioOrHundred(appsWithCapabilities, totalApps);
        metrics.put("applicationCapabilityAlignment", alignmentRate);
        metrics.put("totalApplications", totalApps);

        // 应用依赖合理性：有描述的应用 / 总应用
        long appsWithDocs = apps.stream()
                .filter(a -> StringUtils.hasText(a.getDescription()))
                .count();
        double dependencyReasonableness = ratioOrHundred(appsWithDocs, totalApps);
        metrics.put("dependencyReasonableness", dependencyReasonableness);

        // 技术债密度：技术债数量 / 应用数量（反向：越低越好）
        List<TechDebtEntity> debts = techDebtRepository.findByTenantIdAndDeletedAtIsNull(tenantId);
        long highSeverityDebts = debts.stream()
                .filter(d -> "HIGH".equalsIgnoreCase(d.getSeverity())).count();
        double techDebtDensity = totalApps > 0 ? Math.max(0, 100 - (highSeverityDebts * 10.0 / totalApps) * 100) : 100;
        techDebtDensity = Math.max(0, Math.min(100, techDebtDensity));
        metrics.put("techDebtDensity", techDebtDensity);
        metrics.put("totalTechDebts", debts.size());
        metrics.put("highSeverityDebts", highSeverityDebts);

        double score = avg(alignmentRate, dependencyReasonableness, techDebtDensity);
        List<String> suggestions = new ArrayList<>();
        if (alignmentRate < 80) suggestions.add("为应用关联业务能力，提升应用-能力对齐率");
        if (techDebtDensity < 70) suggestions.add("清理高严重度技术债务，降低技术债密度");

        return new DimensionResult(score, metrics, suggestions);
    }

    private DimensionResult computeData(String tenantId) {
        Map<String, Object> metrics = new LinkedHashMap<>();

        // 数据实体 Ontology 映射率
        long totalDataEntities = dataEntityRepository.findByTenantIdAndDeletedAtIsNull(tenantId).size();
        long dataEntityMappings = conceptMappingRuleRepository
                .findByTenantIdAndAssetTypeAndDeletedAtIsNull(tenantId, "DATA_ENTITY").size();
        double entityMappingRate = ratioOrHundred(dataEntityMappings, totalDataEntities);
        metrics.put("dataEntityOntologyMappingRate", entityMappingRate);
        metrics.put("totalDataEntities", totalDataEntities);

        // 数据流文档化率
        long totalDataFlows = dataFlowRepository.findByTenantIdAndDeletedAtIsNull(tenantId).size();
        long documentedFlows = dataFlowRepository.findByTenantIdAndDeletedAtIsNull(tenantId).stream()
                .filter(f -> StringUtils.hasText(f.getDescription()))
                .count();
        double flowDocRate = ratioOrHundred(documentedFlows, totalDataFlows);
        metrics.put("dataFlowDocumentationRate", flowDocRate);
        metrics.put("totalDataFlows", totalDataFlows);

        // 数据标准覆盖率
        long totalStandards = dataStandardRepository.findByTenantIdAndDeletedAtIsNull(tenantId).size();
        double standardCoverage = totalDataEntities > 0
                ? Math.min(100, (totalStandards * 100.0) / totalDataEntities) : 100;
        metrics.put("dataStandardCoverage", standardCoverage);
        metrics.put("totalDataStandards", totalStandards);

        double score = avg(entityMappingRate, flowDocRate, standardCoverage);
        List<String> suggestions = new ArrayList<>();
        if (entityMappingRate < 80) suggestions.add("为数据实体建立 Ontology 概念映射");
        if (standardCoverage < 80) suggestions.add("扩充数据标准覆盖范围");

        return new DimensionResult(score, metrics, suggestions);
    }

    private DimensionResult computeTechnology(String tenantId) {
        Map<String, Object> metrics = new LinkedHashMap<>();

        // 技术栈标准化率
        long totalStacks = techStackRepository.findByTenantIdAndDeletedAtIsNull(tenantId).size();
        long stacksWithDocs = techStackRepository.findByTenantIdAndDeletedAtIsNull(tenantId).stream()
                .filter(s -> StringUtils.hasText(s.getDescription()))
                .count();
        double stackStandardization = ratioOrHundred(stacksWithDocs, totalStacks);
        metrics.put("techStackStandardization", stackStandardization);
        metrics.put("totalTechStacks", totalStacks);

        // 技术雷达采纳率：活跃状态的雷达文档占比（雷达 status=active 表示正在维护）
        List<TechnologyRadarEntity> radars = technologyRadarRepository.findByTenantIdAndDeletedAtIsNull(tenantId);
        long activeRadarCount = radars.stream()
                .filter(r -> "active".equalsIgnoreCase(r.getStatus()))
                .count();
        double radarAdoption = ratioOrHundred(activeRadarCount, radars.size());
        metrics.put("techRadarAdoption", radarAdoption);
        metrics.put("totalRadarDocuments", radars.size());
        metrics.put("activeRadarDocuments", activeRadarCount);

        // 基础设施文档化率
        long totalInfra = infrastructureRepository.findByTenantIdAndDeletedAtIsNull(tenantId).size();
        long documentedInfra = infrastructureRepository.findByTenantIdAndDeletedAtIsNull(tenantId).stream()
                .filter(i -> StringUtils.hasText(i.getDescription()))
                .count();
        double infraDocRate = ratioOrHundred(documentedInfra, totalInfra);
        metrics.put("infrastructureDocumentationRate", infraDocRate);
        metrics.put("totalInfrastructure", totalInfra);

        double score = avg(stackStandardization, radarAdoption, infraDocRate);
        List<String> suggestions = new ArrayList<>();
        if (stackStandardization < 80) suggestions.add("为技术栈补充描述与标准化文档");
        if (radarAdoption < 80) suggestions.add("推动更多技术组件进入采纳/试用环");

        return new DimensionResult(score, metrics, suggestions);
    }

    private DimensionResult computeGovernance(String tenantId) {
        Map<String, Object> metrics = new LinkedHashMap<>();

        // 架构原则合规率
        long totalPrinciples = principleRepository.findByTenantIdAndDeletedAtIsNull(tenantId).size();
        long activePrinciples = principleRepository.findByTenantIdAndDeletedAtIsNull(tenantId).stream()
                .filter(p -> "ACTIVE".equalsIgnoreCase(p.getStatus()))
                .count();
        double principleCompliance = ratioOrHundred(activePrinciples, totalPrinciples);
        metrics.put("principleComplianceRate", principleCompliance);
        metrics.put("totalPrinciples", totalPrinciples);

        // 评审闭环率：已决议的评审工单 / 总工单
        List<ReviewTicketEntity> tickets = reviewTicketRepository.findByTenantIdAndDeletedAtIsNull(tenantId);
        long closedTickets = tickets.stream()
                .filter(t -> "APPROVED".equalsIgnoreCase(t.getStatus())
                        || "REJECTED".equalsIgnoreCase(t.getStatus()))
                .count();
        double reviewClosureRate = ratioOrHundred(closedTickets, tickets.size());
        metrics.put("reviewClosureRate", reviewClosureRate);
        metrics.put("totalReviewTickets", tickets.size());

        // 标准覆盖度
        long totalTechStandards = techStandardRepository.findByTenantIdAndDeletedAtIsNull(tenantId).size();
        long totalStacks = techStackRepository.findByTenantIdAndDeletedAtIsNull(tenantId).size();
        double standardCoverage = totalStacks > 0
                ? Math.min(100, (totalTechStandards * 100.0) / totalStacks) : 100;
        metrics.put("standardCoverage", standardCoverage);
        metrics.put("totalTechStandards", totalTechStandards);

        double score = avg(principleCompliance, reviewClosureRate, standardCoverage);
        List<String> suggestions = new ArrayList<>();
        if (principleCompliance < 80) suggestions.add("激活更多架构原则，提升合规覆盖");
        if (reviewClosureRate < 80) suggestions.add("推进未闭环的架构评审工单完成决议");

        return new DimensionResult(score, metrics, suggestions);
    }

    // ---------- 风险识别 ----------

    private List<RiskItemResponse> identifyRisks(String tenantId, Map<String, Double> dimensionScores) {
        List<RiskItemResponse> risks = new ArrayList<>();
        Instant now = Instant.now();

        for (Map.Entry<String, Double> entry : dimensionScores.entrySet()) {
            String dim = entry.getKey();
            double score = entry.getValue();
            if (score < 60) {
                risks.add(RiskItemResponse.builder()
                        .dimension(dim)
                        .severity("HIGH")
                        .title(dimLabel(dim) + "健康度严重不足")
                        .description(String.format("%s维度健康度评分仅 %.1f，低于 60 分阈值", dimLabel(dim), score))
                        .recommendation("立即排查" + dimLabel(dim) + "维度的关键指标并制定改进计划")
                        .identifiedAt(now)
                        .build());
            } else if (score < 80) {
                risks.add(RiskItemResponse.builder()
                        .dimension(dim)
                        .severity("MEDIUM")
                        .title(dimLabel(dim) + "健康度需关注")
                        .description(String.format("%s维度健康度评分 %.1f，存在改进空间", dimLabel(dim), score))
                        .recommendation("定期复查" + dimLabel(dim) + "维度指标，持续优化")
                        .identifiedAt(now)
                        .build());
            }
        }

        // 技术债高严重度风险
        long highDebts = techDebtRepository.findByTenantIdAndSeverityAndDeletedAtIsNull(tenantId, "HIGH").size();
        if (highDebts > 0) {
            risks.add(RiskItemResponse.builder()
                    .dimension(DIM_APPLICATION)
                    .severity("HIGH")
                    .title("存在 " + highDebts + " 项高严重度技术债")
                    .description("高严重度技术债务可能影响系统稳定性与可维护性")
                    .recommendation("优先制定高严重度技术债的偿还计划")
                    .identifiedAt(now)
                    .build());
        }

        return risks;
    }

    // ---------- 趋势加载 ----------

    private List<TrendPoint> loadTrend(String tenantId, int days) {
        LocalDate end = LocalDate.now();
        LocalDate start = end.minusDays(days - 1L);
        List<HealthScoreEntity> scores = healthScoreRepository
                .findByTenantIdAndDimensionAndScoreDateBetweenOrderByScoreDateAsc(tenantId, DIM_OVERALL, start, end);
        return scores.stream()
                .map(hs -> TrendPoint.builder()
                        .date(hs.getScoreDate())
                        .score(hs.getScore() != null ? hs.getScore() : 0.0)
                        .dimension(hs.getDimension())
                        .build())
                .toList();
    }

    // ---------- 工具方法 ----------

    private void validateDimension(String dimension) {
        if (!VALID_DIMENSIONS.contains(dimension)) {
            throw new EaException(ErrorCode.INVALID_PARAM,
                    "维度必须为: " + String.join("/", VALID_DIMENSIONS));
        }
    }

    private double ratioOrHundred(long numerator, long denominator) {
        if (denominator == 0) return 100.0;
        return Math.round((numerator * 100.0 / denominator) * 100.0) / 100.0;
    }

    private double avg(double... values) {
        if (values.length == 0) return 0.0;
        double sum = 0;
        for (double v : values) sum += v;
        return Math.round((sum / values.length) * 100.0) / 100.0;
    }

    private String dimLabel(String dim) {
        return switch (dim) {
            case DIM_BUSINESS -> "业务架构";
            case DIM_APPLICATION -> "应用架构";
            case DIM_DATA -> "数据架构";
            case DIM_TECHNOLOGY -> "技术架构";
            case DIM_GOVERNANCE -> "治理";
            default -> dim;
        };
    }

    private String serializeMetrics(Map<String, Object> metrics) {
        try {
            return objectMapper.writeValueAsString(metrics);
        } catch (Exception e) {
            log.warn("Failed to serialize metrics", e);
            return "{}";
        }
    }

    private record DimensionResult(double score, Map<String, Object> metrics, List<String> suggestions) {
    }
}
