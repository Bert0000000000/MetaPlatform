package com.metaplatform.agent.evaluation;

import com.metaplatform.agent.exception.AgentException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

/**
 * 评估服务（纯内存实现）。
 *
 * <p>提供 6 维度自动评分、人工评分、报告生成、优化建议、评分规则 CRUD 等能力。
 * 评分逻辑为确定性启发式（MD5 种子），后续可替换为 LLM 调用。</p>
 */
@Slf4j
@Service
public class EvaluationService {

    // 6 评估维度
    private static final String DIM_ACCURACY = "accuracy";
    private static final String DIM_HELPFULNESS = "helpfulness";
    private static final String DIM_COMPLIANCE = "compliance";
    private static final String DIM_EFFICIENCY = "efficiency";
    private static final String DIM_TOOL_USAGE = "toolUsage";
    private static final String DIM_CONTEXT_COHERENCE = "contextCoherence";

    // conversationId → record
    private final Map<String, ConversationRecord> records = new ConcurrentHashMap<>();
    // tenantKey(tenantId:conversationId) → score
    private final Map<String, AutoScoreResult> scores = new ConcurrentHashMap<>();
    // tenantKey(tenantId:reportId) → detail
    private final Map<String, EvaluationReportDetail> reports = new ConcurrentHashMap<>();
    // tenantKey(tenantId:employeeId) → suggestions
    private final Map<String, List<Suggestion>> suggestions = new ConcurrentHashMap<>();
    // tenantId → (rubricId → rubric)
    private final Map<String, Map<String, ScoringRubric>> rubrics = new ConcurrentHashMap<>();

    // =============================================================== conversations

    public ConversationRecord saveConversation(String tenantId, ConversationRecord record) {
        records.put(record.getConversationId(), record);
        return record;
    }

    public List<ConversationRecord> listConversations(String tenantId, String employeeId) {
        List<ConversationRecord> result = new ArrayList<>(records.values());
        if (employeeId != null && !employeeId.isBlank()) {
            result = result.stream()
                    .filter(r -> employeeId.equals(r.getEmployeeId()))
                    .collect(Collectors.toList());
        }
        return result;
    }

    public ConversationRecord getConversation(String tenantId, String conversationId) {
        ConversationRecord record = records.get(conversationId);
        if (record == null) {
            throw AgentException.invalidParam("对话记录不存在: conversationId=" + conversationId);
        }
        return record;
    }

    // =============================================================== scoring

    public AutoScoreResult autoScore(String tenantId, String conversationId, String rubricId) {
        // 不存在则自动创建占位记录
        ConversationRecord record = records.get(conversationId);
        if (record == null) {
            record = ConversationRecord.builder()
                    .conversationId(conversationId)
                    .employeeId("auto")
                    .taskId("")
                    .messages(List.of())
                    .createdAt(OffsetDateTime.now())
                    .build();
            records.put(conversationId, record);
        }

        ScoringRubric rubric = getRubricInternal(tenantId, rubricId);
        List<AutoScoreResult.DimensionScore> dimensions = new ArrayList<>();
        for (ScoringRubric.RubricDimension rd : rubric.getDimensions()) {
            dimensions.add(scoreDimension(rd.getDimension(), conversationId, rd.getWeight()));
        }

        double overall = dimensions.stream()
                .mapToDouble(d -> d.getScore() * (d.getWeight() != null ? d.getWeight() : 0))
                .sum();

        AutoScoreResult result = AutoScoreResult.builder()
                .conversationId(conversationId)
                .overallScore(Math.round(overall * 10.0) / 10.0)
                .dimensions(dimensions)
                .evaluatorModel("doubao-eval-1.0")
                .evaluatedAt(OffsetDateTime.now())
                .summary(buildSummary(dimensions))
                .mode("LLM")
                .build();

        scores.put(tenantKey(tenantId, conversationId), result);

        // 回写 record 的评分
        record.setQualityScore(result.getOverallScore());
        record.setEvaluatedAt(result.getEvaluatedAt());
        record.setEvaluatedBy("llm-evaluator");
        records.put(conversationId, record);

        return result;
    }

    public AutoScoreResult manualScore(String tenantId, String conversationId, ManualScoreRequest request) {
        ConversationRecord record = records.get(conversationId);
        if (record == null) {
            record = ConversationRecord.builder()
                    .conversationId(conversationId)
                    .employeeId("manual")
                    .taskId("")
                    .messages(List.of())
                    .createdAt(OffsetDateTime.now())
                    .build();
            records.put(conversationId, record);
        }

        ScoringRubric rubric = getRubricInternal(tenantId, null);
        List<AutoScoreResult.DimensionScore> dimensions = new ArrayList<>();
        for (ScoringRubric.RubricDimension rd : rubric.getDimensions()) {
            dimensions.add(AutoScoreResult.DimensionScore.builder()
                    .dimension(rd.getDimension())
                    .score(Math.round(request.getScore() * 10.0) / 10.0)
                    .weight(rd.getWeight())
                    .reasoning("人工评分：" + request.getEvaluatedBy())
                    .build());
        }

        AutoScoreResult result = AutoScoreResult.builder()
                .conversationId(conversationId)
                .overallScore(Math.round(request.getScore() * 10.0) / 10.0)
                .dimensions(dimensions)
                .evaluatorModel("manual")
                .evaluatedAt(OffsetDateTime.now())
                .summary("人工评分 " + request.getScore() + " 分（由 " + request.getEvaluatedBy() + " 提交）")
                .mode("MANUAL")
                .build();

        scores.put(tenantKey(tenantId, conversationId), result);

        record.setQualityScore(result.getOverallScore());
        record.setEvaluatedAt(result.getEvaluatedAt());
        record.setEvaluatedBy(request.getEvaluatedBy());
        records.put(conversationId, record);

        return result;
    }

    public Map<String, Object> batchAutoScore(String tenantId, BatchAutoScoreRequest request) {
        List<ConversationRecord> recs = listConversations(tenantId, request.getEmployeeId());
        if (request.getLimit() != null) {
            recs = recs.subList(0, Math.min(request.getLimit(), recs.size()));
        }
        List<AutoScoreResult> results = new ArrayList<>();
        for (ConversationRecord r : recs) {
            results.add(autoScore(tenantId, r.getConversationId(), null));
        }
        return Map.<String, Object>of("total", recs.size(), "scored", results.size(), "results", results);
    }

    // =============================================================== reports

    public EvaluationReportDetail generateReport(String tenantId, GenerateReportRequest request) {
        List<ConversationRecord> recs = listConversations(tenantId, request.getEmployeeId());
        List<ConversationRecord> scored = recs.stream()
                .filter(r -> r.getQualityScore() != null)
                .collect(Collectors.toList());

        double avgScore;
        double successRate;
        double avgDuration;
        if (!scored.isEmpty()) {
            avgScore = scored.stream().mapToDouble(r -> r.getQualityScore() != null ? r.getQualityScore() : 0).average().orElse(0);
            long passed = scored.stream().filter(r -> r.getQualityScore() != null && r.getQualityScore() >= 60).count();
            successRate = (double) passed / scored.size();
            avgDuration = scored.stream().mapToInt(r -> r.getMessages() != null ? r.getMessages().size() : 0).average().orElse(0) * 12.0;
        } else {
            avgScore = 0;
            successRate = 0;
            avgDuration = 0;
        }

        // 聚合维度评分
        Map<String, List<Double>> dimMap = new LinkedHashMap<>();
        Map<String, Object> scoreBreakdown = new LinkedHashMap<>();
        for (ConversationRecord r : scored) {
            AutoScoreResult sr = scores.get(tenantKey(tenantId, r.getConversationId()));
            if (sr == null || sr.getDimensions() == null) continue;
            for (AutoScoreResult.DimensionScore d : sr.getDimensions()) {
                dimMap.computeIfAbsent(d.getDimension(), k -> new ArrayList<>()).add(d.getScore());
            }
        }

        List<AutoScoreResult.DimensionScore> dimensions = new ArrayList<>();
        for (Map.Entry<String, List<Double>> entry : dimMap.entrySet()) {
            double avg = Math.round(entry.getValue().stream().mapToDouble(v -> v).average().orElse(0) * 10.0) / 10.0;
            dimensions.add(AutoScoreResult.DimensionScore.builder()
                    .dimension(entry.getKey())
                    .score(avg)
                    .reasoning("周期内 " + entry.getValue().size() + " 条对话平均分")
                    .build());
            scoreBreakdown.put(entry.getKey(), avg);
        }

        List<String> highlights = new ArrayList<>();
        List<String> issues = new ArrayList<>();
        List<AutoScoreResult.DimensionScore> sortedDims = new ArrayList<>(dimensions);
        sortedDims.sort(Comparator.comparingDouble(AutoScoreResult.DimensionScore::getScore).reversed());
        for (AutoScoreResult.DimensionScore d : sortedDims) {
            if (d.getScore() >= 85) {
                highlights.add(d.getDimension() + " 平均 " + d.getScore() + " 分，表现稳定");
            } else if (d.getScore() < 75) {
                issues.add(d.getDimension() + " 平均 " + d.getScore() + " 分，需要优化");
            }
        }
        if (highlights.isEmpty()) highlights.add("本周期已完成全部任务评分");
        if (issues.isEmpty()) issues.add("暂无明显短板，建议持续监控趋势");

        String reportId = "rpt-" + UUID.randomUUID().toString().replace("-", "").substring(0, 16);
        OffsetDateTime now = OffsetDateTime.now();

        // 上一基线
        double prevScore = 0.0;
        for (Map.Entry<String, EvaluationReportDetail> e : reports.entrySet()) {
            if (e.getKey().startsWith(tenantId + ":") && request.getEmployeeId().equals(e.getValue().getEmployeeId())) {
                prevScore = Math.max(prevScore, e.getValue().getAvgQualityScore());
            }
        }

        Map<String, Object> comparisonBaseline = Map.<String, Object>of(
                "previousScore", Math.round(prevScore * 1000.0) / 1000.0,
                "delta", Math.round((avgScore - prevScore) * 1000.0) / 1000.0);

        EvaluationReportDetail detail = EvaluationReportDetail.builder()
                .reportId(reportId)
                .employeeId(request.getEmployeeId())
                .period(request.getPeriod())
                .totalTasks(scored.size())
                .avgQualityScore(Math.round(avgScore * 1000.0) / 1000.0)
                .successRate(Math.round(successRate * 1000.0) / 1000.0)
                .avgDuration(Math.round(avgDuration * 10.0) / 10.0)
                .highlights(highlights)
                .issues(issues)
                .createdAt(now)
                .dimensions(dimensions)
                .suggestions(defaultSuggestions().subList(0, Math.min(3, defaultSuggestions().size())))
                .autoGenerated(true)
                .scoreBreakdown(scoreBreakdown)
                .comparisonBaseline(comparisonBaseline)
                .build();

        reports.put(tenantKey(tenantId, reportId), detail);
        return detail;
    }

    public List<EvaluationReport> listReports(String tenantId, String employeeId) {
        List<EvaluationReport> result = reports.entrySet().stream()
                .filter(e -> e.getKey().startsWith(tenantId + ":"))
                .map(Map.Entry::getValue)
                .filter(d -> employeeId == null || employeeId.isBlank() || employeeId.equals(d.getEmployeeId()))
                .map(this::toBaseReport)
                .collect(Collectors.toList());
        result.sort(Comparator.comparing(EvaluationReport::getCreatedAt, Comparator.nullsLast(Comparator.reverseOrder())));
        return result;
    }

    public EvaluationReportDetail getReportDetail(String tenantId, String reportId) {
        EvaluationReportDetail detail = reports.get(tenantKey(tenantId, reportId));
        if (detail == null) {
            throw AgentException.invalidParam("报告不存在: reportId=" + reportId);
        }
        return detail;
    }

    public List<Map<String, Object>> getQualityTrend(String tenantId, String employeeId) {
        List<EvaluationReportDetail> empReports = reports.entrySet().stream()
                .filter(e -> e.getKey().startsWith(tenantId + ":"))
                .map(Map.Entry::getValue)
                .filter(d -> employeeId.equals(d.getEmployeeId()))
                .sorted(Comparator.comparing(EvaluationReportDetail::getCreatedAt, Comparator.nullsLast(Comparator.naturalOrder())))
                .collect(Collectors.toList());

        if (!empReports.isEmpty()) {
            return empReports.stream()
                    .map(r -> {
                        String date = r.getCreatedAt() != null
                                ? r.getCreatedAt().toLocalDate().toString()
                                : LocalDate.now().toString();
                        return Map.<String, Object>of("date", date, "score", r.getAvgQualityScore());
                    })
                    .collect(Collectors.toList());
        }
        // 合成 7 天平基线
        LocalDate today = LocalDate.now();
        List<Map<String, Object>> trend = new ArrayList<>();
        for (int i = 0; i < 7; i++) {
            trend.add(Map.<String, Object>of("date", today.minusDays(6 - i).toString(), "score", 0.0));
        }
        return trend;
    }

    // =============================================================== aggregate report

    public AggregateReportResponse aggregateReport(String tenantId, AggregateReportRequest request) {
        List<String> uniqueEmployeeIds = request.getEmployeeIds().stream().distinct().collect(Collectors.toList());

        List<ConversationRecord> allRecords = new ArrayList<>();
        for (String empId : uniqueEmployeeIds) {
            allRecords.addAll(listConversations(tenantId, empId));
        }

        List<ConversationRecord> scored = allRecords.stream()
                .filter(r -> r.getQualityScore() != null)
                .collect(Collectors.toList());

        double avgScore;
        double successRate;
        if (!scored.isEmpty()) {
            avgScore = scored.stream().mapToDouble(ConversationRecord::getQualityScore).average().orElse(0);
            long passed = scored.stream().filter(r -> r.getQualityScore() >= 60).count();
            successRate = (double) passed / scored.size();
        } else {
            avgScore = 0;
            successRate = 0;
        }

        // 聚合维度评分
        Map<String, List<Double>> dimMap = new LinkedHashMap<>();
        for (ConversationRecord r : scored) {
            AutoScoreResult sr = scores.get(tenantKey(tenantId, r.getConversationId()));
            if (sr == null || sr.getDimensions() == null) continue;
            for (AutoScoreResult.DimensionScore d : sr.getDimensions()) {
                dimMap.computeIfAbsent(d.getDimension(), k -> new ArrayList<>()).add(d.getScore());
            }
        }

        List<AutoScoreResult.DimensionScore> dimensions = new ArrayList<>();
        for (Map.Entry<String, List<Double>> entry : dimMap.entrySet()) {
            double avg = Math.round(entry.getValue().stream().mapToDouble(v -> v).average().orElse(0) * 10.0) / 10.0;
            dimensions.add(AutoScoreResult.DimensionScore.builder()
                    .dimension(entry.getKey())
                    .score(avg)
                    .reasoning("跨 " + entry.getValue().size() + " 条对话聚合平均")
                    .build());
        }

        List<String> highlights = new ArrayList<>();
        List<String> issues = new ArrayList<>();
        List<AutoScoreResult.DimensionScore> sortedDims = new ArrayList<>(dimensions);
        sortedDims.sort(Comparator.comparingDouble(AutoScoreResult.DimensionScore::getScore).reversed());
        for (AutoScoreResult.DimensionScore d : sortedDims) {
            if (d.getScore() >= 85) {
                highlights.add(d.getDimension() + " 平均 " + d.getScore() + " 分，整体表现稳定");
            } else if (d.getScore() < 75) {
                issues.add(d.getDimension() + " 平均 " + d.getScore() + " 分，需重点优化");
            }
        }
        if (highlights.isEmpty()) highlights.add("已聚合 " + scored.size() + " 条对话评估");
        if (issues.isEmpty()) issues.add("暂无明显短板，建议持续监控趋势");

        String report = renderAggregateReport(
                request.getCollaborationId(), uniqueEmployeeIds, scored.size(),
                avgScore, successRate, dimensions, highlights, issues, request.getPeriod());

        return AggregateReportResponse.builder()
                .collaborationId(request.getCollaborationId())
                .employeeIds(uniqueEmployeeIds)
                .totalEmployees(uniqueEmployeeIds.size())
                .totalConversations(scored.size())
                .avgQualityScore(Math.round(avgScore * 1000.0) / 1000.0)
                .successRate(Math.round(successRate * 1000.0) / 1000.0)
                .dimensions(dimensions)
                .highlights(highlights)
                .issues(issues)
                .report(report)
                .generatedAt(OffsetDateTime.now())
                .build();
    }

    // =============================================================== suggestions

    public Map<String, Object> generateSuggestions(String tenantId, GenerateSuggestionsRequest request) {
        String basedOnReportId = request.getReportId();
        if (basedOnReportId == null) {
            List<EvaluationReport> reps = listReports(tenantId, request.getEmployeeId());
            if (!reps.isEmpty()) {
                basedOnReportId = reps.get(0).getReportId();
            }
        }

        List<Suggestion> sug = defaultSuggestions();
        suggestions.put(tenantKey(tenantId, request.getEmployeeId()), sug);
        return Map.<String, Object>of(
                "suggestions", sug,
                "generatedAt", OffsetDateTime.now(),
                "basedOnReportId", basedOnReportId != null ? basedOnReportId : "");
    }

    public List<Suggestion> listSuggestions(String tenantId, String employeeId, String period) {
        List<Suggestion> sug = suggestions.get(tenantKey(tenantId, employeeId));
        return sug != null ? sug : defaultSuggestions();
    }

    // =============================================================== rubrics

    public List<ScoringRubric> listRubrics(String tenantId) {
        Map<String, ScoringRubric> tenantRubrics = rubrics.computeIfAbsent(tenantId, k -> new ConcurrentHashMap<>());
        if (!tenantRubrics.containsKey("rubric-default")) {
            ScoringRubric defaultRubric = buildDefaultRubric();
            tenantRubrics.put(defaultRubric.getId(), defaultRubric);
        }
        return new ArrayList<>(tenantRubrics.values());
    }

    public ScoringRubric saveRubric(String tenantId, ScoringRubric rubric) {
        if (rubric.getId() == null || rubric.getId().isBlank()) {
            rubric.setId("rubric-" + UUID.randomUUID().toString().replace("-", "").substring(0, 16));
        }
        rubric.setUpdatedAt(OffsetDateTime.now());
        rubrics.computeIfAbsent(tenantId, k -> new ConcurrentHashMap<>()).put(rubric.getId(), rubric);
        return rubric;
    }

    // =============================================================== internal

    private ScoringRubric getRubricInternal(String tenantId, String rubricId) {
        Map<String, ScoringRubric> tenantRubrics = rubrics.computeIfAbsent(tenantId, k -> new ConcurrentHashMap<>());
        if (tenantRubrics.isEmpty()) {
            ScoringRubric def = buildDefaultRubric();
            tenantRubrics.put(def.getId(), def);
        }
        if (rubricId == null || rubricId.isBlank()) {
            return tenantRubrics.getOrDefault("rubric-default",
                    tenantRubrics.values().iterator().next());
        }
        ScoringRubric rubric = tenantRubrics.get(rubricId);
        if (rubric == null) {
            throw AgentException.invalidParam("评分规则不存在: rubricId=" + rubricId);
        }
        return rubric;
    }

    private ScoringRubric buildDefaultRubric() {
        return ScoringRubric.builder()
                .id("rubric-default")
                .name("默认评估规则 v1")
                .updatedAt(OffsetDateTime.now())
                .dimensions(List.of(
                        ScoringRubric.RubricDimension.builder().dimension(DIM_ACCURACY).weight(0.25).description("事实、数据、规则引用是否正确").build(),
                        ScoringRubric.RubricDimension.builder().dimension(DIM_HELPFULNESS).weight(0.20).description("是否真正解决用户问题").build(),
                        ScoringRubric.RubricDimension.builder().dimension(DIM_COMPLIANCE).weight(0.20).description("是否符合安全/政策约束").build(),
                        ScoringRubric.RubricDimension.builder().dimension(DIM_EFFICIENCY).weight(0.15).description("步骤是否冗余、耗时是否合理").build(),
                        ScoringRubric.RubricDimension.builder().dimension(DIM_TOOL_USAGE).weight(0.10).description("工具调用是否恰当、参数是否正确").build(),
                        ScoringRubric.RubricDimension.builder().dimension(DIM_CONTEXT_COHERENCE).weight(0.10).description("多轮是否保持一致、是否遗忘前提").build()))
                .build();
    }

    private AutoScoreResult.DimensionScore scoreDimension(String dimension, String conversationId, double weight) {
        String seed = conversationId + ":" + dimension;
        double score;
        String reasoning;
        List<String> evidence;

        switch (dimension) {
            case DIM_ACCURACY:
                score = stableNoise(seed, 85.0, 10.0, 70.0, 95.0);
                reasoning = "事实、数据、规则引用基本准确，未出现重大事实性错误。";
                evidence = List.of("assistant: 订单 #20260718-8842 状态查询正确。");
                break;
            case DIM_HELPFULNESS:
                score = stableNoise(seed, 80.0, 12.0, 68.0, 92.0);
                reasoning = "给出了可执行的方案，但未主动追问用户对方案的接受度。";
                evidence = List.of("assistant: 您可以进入「我的订单」→ 点击「申请退货」。");
                break;
            case DIM_COMPLIANCE:
                score = stableNoise(seed, 92.0, 6.0, 85.0, 98.0);
                reasoning = "未泄露内部系统信息，敏感字段（手机号）做了脱敏处理。";
                evidence = List.of("assistant: 您的联系方式 138****5621 我们已记录。");
                break;
            case DIM_EFFICIENCY:
                score = stableNoise(seed, 72.0, 14.0, 60.0, 85.0);
                reasoning = "完成方案确认共耗时 4 轮对话，存在重复工具调用，可压缩。";
                evidence = List.of("tool: query_order 被调用了 2 次，参数完全相同。");
                break;
            case DIM_TOOL_USAGE:
                score = stableNoise(seed, 76.0, 12.0, 65.0, 88.0);
                reasoning = "工具选择合理，但 query_order 入参拼写错误一次后自动重试。";
                evidence = List.of("tool: query_order args: {\"orderId\": ...} -> 400 error，重试成功。");
                break;
            default: // contextCoherence
                score = stableNoise(seed, 88.0, 8.0, 75.0, 95.0);
                reasoning = "全程保持主线，正确继承了用户在第 1 轮给出的商品类型与原因。";
                evidence = List.of("user: 我买的蓝色连衣裙想退货。 → assistant: 关于您蓝色连衣裙的退货...");
                break;
        }

        return AutoScoreResult.DimensionScore.builder()
                .dimension(dimension)
                .score(Math.round(score * 10.0) / 10.0)
                .weight(weight)
                .reasoning(reasoning)
                .evidence(evidence)
                .build();
    }

    private String buildSummary(List<AutoScoreResult.DimensionScore> dimensions) {
        AutoScoreResult.DimensionScore highest = dimensions.stream()
                .max(Comparator.comparingDouble(AutoScoreResult.DimensionScore::getScore))
                .orElse(dimensions.get(0));
        AutoScoreResult.DimensionScore lowest = dimensions.stream()
                .min(Comparator.comparingDouble(AutoScoreResult.DimensionScore::getScore))
                .orElse(dimensions.get(0));
        return "整体表现：" + highest.getDimension() + " 突出（" + highest.getScore() + "），"
                + lowest.getDimension() + " 有优化空间（" + lowest.getScore() + "）。";
    }

    private EvaluationReport toBaseReport(EvaluationReportDetail d) {
        return EvaluationReport.builder()
                .reportId(d.getReportId())
                .employeeId(d.getEmployeeId())
                .period(d.getPeriod())
                .totalTasks(d.getTotalTasks())
                .avgQualityScore(d.getAvgQualityScore())
                .successRate(d.getSuccessRate())
                .avgDuration(d.getAvgDuration())
                .highlights(d.getHighlights())
                .issues(d.getIssues())
                .createdAt(d.getCreatedAt())
                .build();
    }

    private String renderAggregateReport(String collaborationId, List<String> employeeIds,
                                         int totalConversations, double avgScore, double successRate,
                                         List<AutoScoreResult.DimensionScore> dimensions,
                                         List<String> highlights, List<String> issues, String period) {
        List<String> lines = new ArrayList<>();
        lines.add("# 多员工协作聚合报告");
        if (collaborationId != null) lines.add("- 协作任务: " + collaborationId);
        if (period != null) lines.add("- 周期: " + period);
        lines.add("- 参与员工数: " + employeeIds.size());
        lines.add("- 聚合对话数: " + totalConversations);
        lines.add("- 平均质量分: " + Math.round(avgScore * 100.0) / 100.0);
        lines.add("- 成功率: " + Math.round(successRate * 1000.0) / 10.0 + "%");
        lines.add("");
        lines.add("## 参与员工");
        for (String eid : employeeIds) lines.add("- " + eid);
        lines.add("");
        if (!dimensions.isEmpty()) {
            lines.add("## 维度评分");
            for (AutoScoreResult.DimensionScore d : dimensions) {
                lines.add("- " + d.getDimension() + ": " + d.getScore());
            }
            lines.add("");
        }
        lines.add("## 亮点");
        for (String h : highlights) lines.add("- " + h);
        lines.add("");
        lines.add("## 待改进");
        for (String i : issues) lines.add("- " + i);
        return String.join("\n", lines);
    }

    @SuppressWarnings("unchecked")
    private List<Suggestion> defaultSuggestions() {
        return List.of(
                Suggestion.builder().id("sug-prompt-001").category("prompt").priority("high")
                        .title("在 system prompt 中强制工具入参 schema")
                        .description("多次对话中 query_order 入参字段名不一致（orderId vs order_id）导致首次调用失败后重试，平均增加 1.2s 延迟。")
                        .action("在 system prompt 追加：「调用 query_order 时必须使用 snake_case 入参 order_id，禁止使用 camelCase。」并给出一个 few-shot 示例。")
                        .expectedImpact("预计减少 80% 的工具重试，单对话平均耗时下降 1.0-1.5s。")
                        .relatedEvidence(List.of("conv-001: query_order 首次调用 400，重试成功", "conv-004: 同样问题重复出现")).build(),
                Suggestion.builder().id("sug-tool-001").category("tool").priority("medium")
                        .title("合并订单查询与状态查询为单一工具")
                        .description("query_order 与 query_order_status 在 60% 的对话中被先后调用，参数完全相同，存在重复查询。")
                        .action("将 query_order_status 能力合并入 query_order 返回结果，并在响应中包含 status 字段。")
                        .expectedImpact("减少 1 次工具调用/对话，效率维度评分预计提升 8-10 分。")
                        .relatedEvidence(List.of("conv-001: 连续 2 次 query_order，参数相同")).build(),
                Suggestion.builder().id("sug-knowledge-001").category("knowledge").priority("high")
                        .title("补充「预售商品退货」知识切片")
                        .description("在 12 条涉及预售商品退货的对话中，客服给出的退货窗口与普通商品混淆（预售应 15 天，普通 7 天），准确性被扣分。")
                        .action("在知识库 kb-product 中新增「预售商品退货政策」文档，并在 system prompt 中提示优先检索该切片。")
                        .expectedImpact("涉及预售的对话准确性评分预计从 72 提升至 88+。")
                        .relatedEvidence(List.of("conv-007: 错误告知预售商品 7 天可退", "conv-011: 同类错误")).build(),
                Suggestion.builder().id("sug-parameter-001").category("parameter").priority("medium")
                        .title("调低 temperature 至 0.3")
                        .description("当前 temperature=0.7 导致部分事实性回答（订单状态、退货政策）出现轻微漂移，影响准确性。")
                        .action("将 capability.temperature 从 0.7 调整为 0.3，保留 topP=0.9 不变。")
                        .expectedImpact("准确性维度评分预计提升 3-5 分，创新性场景可通过单独的 employee 配置覆盖。")
                        .relatedEvidence(List.of()).build(),
                Suggestion.builder().id("sug-workflow-001").category("workflow").priority("low")
                        .title("在退货流程中前置确认「商品类型」")
                        .description("当前流程在未确认是否为预售商品的情况下直接告知 7 天退货政策，导致后续需要纠正，增加对话轮次。")
                        .action("在退货意图识别后，增加一个「商品类型判断」节点，预售商品走分支 A，普通商品走分支 B。")
                        .expectedImpact("平均对话轮次从 4.2 降至 3.0，效率维度评分预计提升 12 分。")
                        .relatedEvidence(List.of("conv-007: 第 2 轮才追问是否预售")).build());
    }

    private static String tenantKey(String tenantId, String id) {
        return tenantId + ":" + id;
    }

    private static double stableNoise(String seed, double base, double span, double lo, double hi) {
        try {
            MessageDigest md5 = MessageDigest.getInstance("MD5");
            byte[] hash = md5.digest(seed.getBytes(StandardCharsets.UTF_8));
            // 取前 4 字节作为 0..1 的噪声
            long n = ((hash[0] & 0xFFL) << 24) | ((hash[1] & 0xFFL) << 16)
                    | ((hash[2] & 0xFFL) << 8) | (hash[3] & 0xFFL);
            double ratio = n / 0xFFFFFFFFL;
            double val = base + (ratio - 0.5) * span;
            return Math.max(lo, Math.min(hi, val));
        } catch (NoSuchAlgorithmException e) {
            return base;
        }
    }
}
