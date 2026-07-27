package com.metaplatform.ont.draft;

import com.metaplatform.ont.common.ApiResponse;
import com.metaplatform.ont.common.TenantContext;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Ontology Draft / Commit REST API（P1.3.3）。
 *
 * <ul>
 *   <li>POST /api/v1/ont/drafts/propose</li>
 *   <li>POST /api/v1/ont/drafts/{id}/approve</li>
 *   <li>POST /api/v1/ont/drafts/{id}/reject</li>
 *   <li>POST /api/v1/ont/drafts/{id}/publish</li>
 *   <li>POST /api/v1/ont/drafts/rollback</li>
 *   <li>GET  /api/v1/ont/drafts</li>
 *   <li>GET  /api/v1/ont/drafts/{id}/candidates</li>
 * </ul>
 */
@RestController
@RequestMapping("/api/v1/ont/drafts")
@RequiredArgsConstructor
public class OntologyDraftController {

    private final OntologyDraftService service;

    @PostMapping("/propose")
    public ApiResponse<OntologyDraftEntity> propose(@RequestBody OntologyDraftService.ProposeDraftRequest request) {
        if (request.getTenantId() == null) request.setTenantId(TenantContext.tenantIdOrDefault());
        return ApiResponse.success(service.proposeDraft(request));
    }

    @PostMapping("/{id}/approve")
    public ApiResponse<OntologyDraftEntity> approve(@PathVariable String id, @RequestParam String reviewer) {
        return ApiResponse.success(service.approveDraft(id, reviewer));
    }

    @PostMapping("/{id}/reject")
    public ApiResponse<OntologyDraftEntity> reject(@PathVariable String id,
                                                    @RequestParam String reviewer,
                                                    @RequestParam String reason) {
        return ApiResponse.success(service.rejectDraft(id, reviewer, reason));
    }

    @PostMapping("/{id}/publish")
    public ApiResponse<OntologyDraftEntity> publish(@PathVariable String id, @RequestParam String approver) {
        return ApiResponse.success(service.publishDraft(id, approver));
    }

    @PostMapping("/rollback")
    public ApiResponse<Boolean> rollback(@RequestParam String fromVersion,
                                         @RequestParam String toVersion,
                                         @RequestParam String operator) {
        return ApiResponse.success(service.rollback(TenantContext.tenantIdOrDefault(), fromVersion, toVersion, operator));
    }

    @GetMapping
    public ApiResponse<List<OntologyDraftEntity>> list(@RequestParam(required = false) String status) {
        return ApiResponse.success(service.listByStatus(TenantContext.tenantIdOrDefault(),
                status == null ? "PENDING_REVIEW" : status));
    }

    @GetMapping("/{id}")
    public ApiResponse<OntologyDraftEntity> get(@PathVariable String id) {
        return ApiResponse.success(service.get(id));
    }

    @GetMapping("/{id}/candidates")
    public ApiResponse<List<CandidateFactEntity>> candidates(@PathVariable String id) {
        return ApiResponse.success(service.candidates(id));
    }
}
