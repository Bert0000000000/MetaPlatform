package com.metaplatform.wfe.controller;

import com.metaplatform.wfe.common.ApiResponse;
import com.metaplatform.wfe.common.PageResponse;
import com.metaplatform.wfe.dto.TaskActionRequest;
import com.metaplatform.wfe.dto.TaskActionResponse;
import com.metaplatform.wfe.dto.TaskResponse;
import com.metaplatform.wfe.service.WfeTaskService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/wfe/tasks")
@RequiredArgsConstructor
public class TaskController {

    private final WfeTaskService wfeTaskService;

    @GetMapping("/todo")
    public ApiResponse<PageResponse<TaskResponse>> getTodoTasks(
            @RequestParam String userId,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ApiResponse.success(wfeTaskService.getTodoTasks(userId, page, size));
    }

    @GetMapping("/done")
    public ApiResponse<PageResponse<TaskResponse>> getDoneTasks(
            @RequestParam String userId,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ApiResponse.success(wfeTaskService.getDoneTasks(userId, page, size));
    }

    @GetMapping("/{id}")
    public ApiResponse<TaskResponse> getTaskById(@PathVariable String id) {
        return ApiResponse.success(wfeTaskService.getTaskById(id));
    }

    @PostMapping("/{id}/action")
    public ApiResponse<TaskActionResponse> executeAction(
            @PathVariable String id,
            @Valid @RequestBody TaskActionRequest request) {
        return ApiResponse.success(wfeTaskService.executeAction(id, request));
    }

    /**
     * P5.3 Create an approval task from an external Action Proposal.
     * Body: { tenantId, processKey, requester, externalActionProposalId, actionCode, riskLevel, summary }
     */
    @PostMapping("/from-proposal")
    public ApiResponse<java.util.Map<String, Object>> createFromProposal(
            @RequestBody java.util.Map<String, Object> body) {
        String tenantId = body.get("tenantId") == null ? "tenant-default" : String.valueOf(body.get("tenantId"));
        String requester = body.get("requester") == null ? "system" : String.valueOf(body.get("requester"));
        String summary = body.get("summary") == null ? "Action approval" : String.valueOf(body.get("summary"));
        String externalId = body.get("externalActionProposalId") == null ? null : String.valueOf(body.get("externalActionProposalId"));
        String actionCode = body.get("actionCode") == null ? "unknown" : String.valueOf(body.get("actionCode"));
        String riskLevel = body.get("riskLevel") == null ? "HIGH" : String.valueOf(body.get("riskLevel"));

        // Delegate to a manager-approval direct task creation (no BPMN template required).
        return ApiResponse.success(wfeTaskService.createDirectApprovalTask(
                tenantId, requester, summary, externalId, actionCode, riskLevel));
    }

    /**
     * P5.4 Approve an external Action Proposal (called by the WFE UI when manager approves).
     * Forwards to TECH-AGENT via HTTP so the original proposal can be EXECUTED.
     */
    @PostMapping("/approve-external")
    public ApiResponse<java.util.Map<String, Object>> approveExternal(
            @RequestBody java.util.Map<String, Object> body) {
        String taskId = body.get("taskId") == null ? null : String.valueOf(body.get("taskId"));
        String approver = body.get("approver") == null ? "wfe-manager" : String.valueOf(body.get("approver"));
        String reason = body.get("reason") == null ? "WFE approved" : String.valueOf(body.get("reason"));
        return ApiResponse.success(wfeTaskService.approveExternalAction(taskId, approver, reason));
    }

    /**
     * P5.4 Reject an external Action Proposal (called by the WFE UI when manager rejects).
     */
    @PostMapping("/reject-external")
    public ApiResponse<java.util.Map<String, Object>> rejectExternal(
            @RequestBody java.util.Map<String, Object> body) {
        String taskId = body.get("taskId") == null ? null : String.valueOf(body.get("taskId"));
        String approver = body.get("approver") == null ? "wfe-manager" : String.valueOf(body.get("approver"));
        String reason = body.get("reason") == null ? "WFE rejected" : String.valueOf(body.get("reason"));
        return ApiResponse.success(wfeTaskService.rejectExternalAction(taskId, approver, reason));
    }
}
