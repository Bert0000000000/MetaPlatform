package com.metaplatform.agent.learning;

import com.metaplatform.agent.common.ApiResponse;
import com.metaplatform.agent.common.PageResponse;
import com.metaplatform.agent.exception.AgentException;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * 数字员工自学习端点（V15-03）。
 */
@RestController
@RequestMapping("/api/v1/agent/learning")
@RequiredArgsConstructor
public class LearningController {

    private final LearningService learningService;

    @PostMapping("/feedback")
    public ApiResponse<FeedbackRecord> recordFeedback(@Valid @RequestBody FeedbackCreateRequest request) {
        return ApiResponse.success(learningService.recordFeedback(request));
    }

    @GetMapping("/feedback")
    public ApiResponse<PageResponse<FeedbackRecord>> listFeedback(
            @RequestParam(required = false) String employeeId,
            @RequestParam(required = false) String taskId,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int pageSize) {
        List<FeedbackRecord> all = learningService.listFeedback(employeeId, taskId);
        int total = all.size();
        int start = Math.min((page - 1) * pageSize, total);
        int end = Math.min(start + pageSize, total);
        return ApiResponse.success(PageResponse.of(all.subList(start, end), total, page, pageSize));
    }

    @PutMapping("/feedback/{feedbackId}/tags")
    public ApiResponse<FeedbackRecord> updateFeedbackTags(
            @PathVariable String feedbackId,
            @RequestBody Map<String, List<String>> body) {
        List<String> tags = body.getOrDefault("tags", List.of());
        FeedbackRecord updated = learningService.updateFeedbackTags(feedbackId, tags);
        if (updated == null) {
            throw AgentException.invalidParam("反馈记录不存在: feedbackId=" + feedbackId);
        }
        return ApiResponse.success(updated);
    }

    @PostMapping("/extract")
    public ApiResponse<Map<String, List<LearnedKnowledge>>> extractKnowledge(@Valid @RequestBody KnowledgeExtractRequest request) {
        List<FeedbackRecord> records = learningService.listFeedback(request.getEmployeeId(), null);
        if (request.getFeedbackIds() != null && !request.getFeedbackIds().isEmpty()) {
            records = records.stream()
                    .filter(r -> request.getFeedbackIds().contains(r.getFeedbackId()))
                    .toList();
        }
        List<LearnedKnowledge> knowledge = learningService.extractKnowledge(records);
        return ApiResponse.success(Map.of("knowledge", knowledge));
    }

    @GetMapping("/employees/{employeeId}/knowledge")
    public ApiResponse<Map<String, List<LearnedKnowledge>>> listKnowledge(
            @PathVariable String employeeId,
            @RequestParam(defaultValue = "false") boolean syncedOnly) {
        return ApiResponse.success(Map.of("items", learningService.listKnowledge(employeeId, syncedOnly)));
    }

    @PostMapping("/employees/{employeeId}/sync-to-kb")
    public ApiResponse<KnowledgeSyncResult> syncToKnowledgeBase(@PathVariable String employeeId) {
        return ApiResponse.success(learningService.syncToKnowledgeBase(employeeId));
    }

    @GetMapping("/employees/{employeeId}/stats")
    public ApiResponse<LearningStats> getStats(@PathVariable String employeeId) {
        return ApiResponse.success(learningService.getStats(employeeId));
    }
}
