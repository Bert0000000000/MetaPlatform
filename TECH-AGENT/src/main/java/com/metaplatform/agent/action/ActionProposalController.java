package com.metaplatform.agent.action;

import com.metaplatform.agent.action.dto.*;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/agent/action-proposals")
@RequiredArgsConstructor
public class ActionProposalController {
    private final ActionProposalService service;
    private final ActionExecutionService executionService;
    @PostMapping
    public ResponseEntity<ActionProposalDto> create(@Valid @RequestBody ActionProposalCreateRequest request) {
        return ResponseEntity.status(201).body(service.create(request));
    }
    @GetMapping("/{proposalId}")
    public ActionProposalDto get(@PathVariable String proposalId) { return service.get(proposalId); }

    /**
     * P5.4 Internal callback from TECH-WFE: when manager approves the WFE task,
     * the WFE calls back here to actually execute the Action Proposal.
     */
    @PostMapping("/internal/wfe-approved")
    public ResponseEntity<ActionProposalEntity> onWfeApproved(
            @org.springframework.web.bind.annotation.RequestBody java.util.Map<String, String> body) {
        String proposalId = body.get("proposalId");
        String approver = body.get("approver") == null ? "wfe-manager" : body.get("approver");
        String reason = body.get("reason") == null ? "WFE approved" : body.get("reason");
        return ResponseEntity.ok(executionService.approveAndExecute(proposalId, approver, reason));
    }

    /**
     * P5.4 Internal callback from TECH-WFE: rejection.
     */
    @PostMapping("/internal/wfe-rejected")
    public ResponseEntity<ActionProposalEntity> onWfeRejected(
            @org.springframework.web.bind.annotation.RequestBody java.util.Map<String, String> body) {
        String proposalId = body.get("proposalId");
        String approver = body.get("approver") == null ? "wfe-manager" : body.get("approver");
        String reason = body.get("reason") == null ? "WFE rejected" : body.get("reason");
        return ResponseEntity.ok(executionService.reject(proposalId, approver, reason));
    }
}
