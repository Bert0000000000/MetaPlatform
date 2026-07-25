package com.metaplatform.agent.evaluation;

import com.metaplatform.agent.common.ApiResponse;
import com.metaplatform.agent.common.TenantContext;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Agent 效果评估端点（V11-04 APP-DW 效果评估后端化）。
 *
 * <p>所有路由挂载在 {@code /api/v1/agent/evaluations} 下，避免与
 * agent-runtime 的 {@code /conversations} 端点冲突。</p>
 */
@RestController
@RequestMapping("/api/v1/agent/evaluations")
@RequiredArgsConstructor
public class EvaluationController {

    private final EvaluationService evaluationService;

    // --------------------------------------------------------------- conversations

    @PostMapping("/conversations")
    public ApiResponse<ConversationRecord> saveConversation(@RequestBody ConversationRecord record) {
        return ApiResponse.success(evaluationService.saveConversation(
                TenantContext.getTenantIdOrDefault(), record));
    }

    @GetMapping("/conversations")
    public ApiResponse<List<ConversationRecord>> listConversations(
            @RequestParam(required = false) String employeeId) {
        return ApiResponse.success(evaluationService.listConversations(
                TenantContext.getTenantIdOrDefault(), employeeId));
    }

    @GetMapping("/conversations/{conversationId}")
    public ApiResponse<ConversationRecord> getConversation(@PathVariable String conversationId) {
        return ApiResponse.success(evaluationService.getConversation(
                TenantContext.getTenantIdOrDefault(), conversationId));
    }

    @PostMapping("/conversations/{conversationId}/score")
    public ApiResponse<AutoScoreResult> manualScore(
            @PathVariable String conversationId,
            @Valid @RequestBody ManualScoreRequest request) {
        return ApiResponse.success(evaluationService.manualScore(
                TenantContext.getTenantIdOrDefault(), conversationId, request));
    }

    @PostMapping("/conversations/{conversationId}/auto-score")
    public ApiResponse<AutoScoreResult> autoScore(
            @PathVariable String conversationId,
            @RequestBody(required = false) AutoScoreRequest body) {
        String rubricId = body != null ? body.getRubricId() : null;
        return ApiResponse.success(evaluationService.autoScore(
                TenantContext.getTenantIdOrDefault(), conversationId, rubricId));
    }

    @PostMapping("/conversations/batch-auto-score")
    public ApiResponse<Map<String, Object>> batchAutoScore(@Valid @RequestBody BatchAutoScoreRequest request) {
        return ApiResponse.success(evaluationService.batchAutoScore(
                TenantContext.getTenantIdOrDefault(), request));
    }

    // --------------------------------------------------------------- suggestions

    @PostMapping("/suggestions/generate")
    public ApiResponse<Map<String, Object>> generateSuggestions(@Valid @RequestBody GenerateSuggestionsRequest request) {
        return ApiResponse.success(evaluationService.generateSuggestions(
                TenantContext.getTenantIdOrDefault(), request));
    }

    @GetMapping("/suggestions")
    public ApiResponse<List<Suggestion>> listSuggestions(
            @RequestParam String employeeId,
            @RequestParam(required = false) String period) {
        return ApiResponse.success(evaluationService.listSuggestions(
                TenantContext.getTenantIdOrDefault(), employeeId, period));
    }

    // --------------------------------------------------------------- reports

    @PostMapping("/reports/generate")
    public ApiResponse<EvaluationReportDetail> generateReport(@Valid @RequestBody GenerateReportRequest request) {
        return ApiResponse.success(evaluationService.generateReport(
                TenantContext.getTenantIdOrDefault(), request));
    }

    @GetMapping("/reports")
    public ApiResponse<List<EvaluationReport>> listReports(
            @RequestParam(required = false) String employeeId) {
        return ApiResponse.success(evaluationService.listReports(
                TenantContext.getTenantIdOrDefault(), employeeId));
    }

    @GetMapping("/reports/quality-trend")
    public ApiResponse<List<Map<String, Object>>> getQualityTrend(@RequestParam String employeeId) {
        return ApiResponse.success(evaluationService.getQualityTrend(
                TenantContext.getTenantIdOrDefault(), employeeId));
    }

    @GetMapping("/reports/{reportId}")
    public ApiResponse<EvaluationReportDetail> getReportDetail(@PathVariable String reportId) {
        return ApiResponse.success(evaluationService.getReportDetail(
                TenantContext.getTenantIdOrDefault(), reportId));
    }

    @PostMapping("/aggregate-report")
    public ApiResponse<AggregateReportResponse> aggregateReport(@Valid @RequestBody AggregateReportRequest request) {
        return ApiResponse.success(evaluationService.aggregateReport(
                TenantContext.getTenantIdOrDefault(), request));
    }

    // --------------------------------------------------------------- rubrics

    @GetMapping("/rubrics")
    public ApiResponse<List<ScoringRubric>> listRubrics() {
        return ApiResponse.success(evaluationService.listRubrics(
                TenantContext.getTenantIdOrDefault()));
    }

    @PostMapping("/rubrics")
    public ApiResponse<ScoringRubric> saveRubric(@RequestBody ScoringRubric rubric) {
        return ApiResponse.success(evaluationService.saveRubric(
                TenantContext.getTenantIdOrDefault(), rubric));
    }
}
