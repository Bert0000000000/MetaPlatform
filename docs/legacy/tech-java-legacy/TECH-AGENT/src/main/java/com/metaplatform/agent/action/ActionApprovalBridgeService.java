package com.metaplatform.agent.action;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.agent.api.Phase1Exception;
import com.metaplatform.agent.common.TenantContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestClient;

import java.util.*;

/**
 * P5.3 ActionApprovalBridge - Tech-Agent ↔ Tech-WFE integration.
 *
 * <p>When {@link ActionExecutionService#execute} detects that the proposal
 * requires approval (HIGH/CRITICAL risk), it routes to {@link #submitForApproval}
 * which creates a WFE approval task via the WFE HTTP API. When the WFE
 * task is approved, the bridge calls back into
 * {@link ActionExecutionService#approveAndExecute} to perform the actual
 * execution.</p>
 *
 * <p>Wire format:
 * <pre>
 *   POST /api/v1/wfe/tasks/{taskId}/execute
 *   { action: APPROVE, comment: ..., externalActionProposalId: ... }
 * </pre>
 * </p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ActionApprovalBridgeService {

    private final ActionExecutionService actionExecutionService;
    private final ActionProposalRepository proposalRepository;
    private final ObjectMapper objectMapper;
    private final RestClient restClient;

    @Value("")
    private String wfeBaseUrl;

    /**
     * Submit a HIGH/CRITICAL risk proposal to WFE for approval.
     * <p>Creates a WFE process instance from the inline 'agent-action-approval'
     * flow template and waits for the manager to approve via WFE UI / API.</p>
     */
    @Transactional
    public String submitForApproval(String proposalId, String requester) {
        ActionProposalEntity proposal = proposalRepository.findById(proposalId)
                .orElseThrow(() -> Phase1Exception.notFound("PROPOSAL_NOT_FOUND", "ActionProposal not found: " + proposalId));

        if (!proposal.isApprovalRequired()) {
            log.info("[ActionApprovalBridge] proposal={} is LOW risk, no WFE routing needed", proposalId);
            return null;
        }

        String tenantId = TenantContext.getTenantIdOrDefault();
        String wfeTaskId = createWfeApprovalTask(proposal, tenantId, requester);
        log.info("[ActionApprovalBridge] submitted proposal={} to WFE task={}", proposalId, wfeTaskId);
        return wfeTaskId;
    }

    /**
     * WFE approval callback - called when manager approves the WFE task.
     * Routes back to {@link ActionExecutionService#approveAndExecute}.
     */
    @Transactional
    public ActionProposalEntity onWfeApproved(String proposalId, String approver, String reason) {
        log.info("[ActionApprovalBridge] WFE approved proposal={} by approver={}", proposalId, approver);
        return actionExecutionService.approveAndExecute(proposalId, approver, reason);
    }

    /**
     * WFE rejection callback.
     */
    @Transactional
    public ActionProposalEntity onWfeRejected(String proposalId, String approver, String reason) {
        log.info("[ActionApprovalBridge] WFE rejected proposal={} by approver={}", proposalId, approver);
        return actionExecutionService.reject(proposalId, approver, reason);
    }

    private String createWfeApprovalTask(ActionProposalEntity proposal, String tenantId, String requester) {
        try {
            String url = wfeBaseUrl + "/api/v1/wfe/tasks/from-proposal";
            Map<String, Object> body = new HashMap<>();
            body.put("tenantId", tenantId);
            body.put("processKey", "agent-action-approval");
            body.put("requester", requester);
            body.put("externalActionProposalId", proposal.getProposalId());
            body.put("actionCode", proposal.getActionCode());
            body.put("riskLevel", proposal.getRiskLevel() == null ? "HIGH" : proposal.getRiskLevel().name());
            body.put("summary", proposal.getReason());

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(body, headers);

            ResponseEntity<Map> response = restClient.post()
                    .uri(url)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve()
                    .toEntity(Map.class);
            if (response.getBody() == null) {
                throw new IllegalStateException("Empty response from WFE: " + response.getStatusCode());
            }
            Object taskId = response.getBody().get("taskId");
            return taskId == null ? null : String.valueOf(taskId);
        } catch (Exception e) {
            log.error("[ActionApprovalBridge] WFE task creation failed: {}", e.getMessage());
            throw Phase1Exception.conflict("WFE_SUBMIT_FAILED", "Failed to create WFE approval task: " + e.getMessage());
        }
    }
}
