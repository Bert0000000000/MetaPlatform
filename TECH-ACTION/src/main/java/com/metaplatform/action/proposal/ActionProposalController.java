package com.metaplatform.action.proposal;

import com.metaplatform.action.common.ApiResponse;
import com.metaplatform.action.common.TenantContext;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/action/proposals")
@RequiredArgsConstructor
public class ActionProposalController {

    private final ActionProposalService service;

    @PostMapping
    public ApiResponse<ActionProposalEntity> propose(@RequestBody ActionProposalService.ProposeRequest req) {
        if (req.getTenantId() == null) req.setTenantId(TenantContext.getTenantIdOrDefault());
        return ApiResponse.success(service.propose(req));
    }

    @PostMapping("/{id}/approve")
    public ApiResponse<ActionProposalEntity> approve(@PathVariable String id, @RequestParam String approver) {
        return ApiResponse.success(service.approve(id, approver));
    }

    @PostMapping("/{id}/reject")
    public ApiResponse<ActionProposalEntity> reject(@PathVariable String id,
                                                    @RequestParam String approver,
                                                    @RequestParam String reason) {
        return ApiResponse.success(service.reject(id, approver, reason));
    }

    @PostMapping("/{id}/execute")
    public ApiResponse<ActionProposalEntity> execute(@PathVariable String id) {
        return ApiResponse.success(service.execute(id));
    }

    @GetMapping("/{id}")
    public ApiResponse<ActionProposalEntity> get(@PathVariable String id) {
        return ApiResponse.success(service.get(id));
    }

    @GetMapping("/by-run/{runId}")
    public ApiResponse<List<ActionProposalEntity>> byRun(@PathVariable String runId) {
        return ApiResponse.success(service.listByRun(runId));
    }
}
