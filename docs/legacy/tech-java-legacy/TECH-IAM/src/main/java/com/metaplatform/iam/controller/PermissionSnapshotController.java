package com.metaplatform.iam.controller;

import com.metaplatform.iam.common.ApiResponse;
import com.metaplatform.iam.dto.snapshot.PermissionSnapshotDto;
import com.metaplatform.iam.security.CurrentUserHolder;
import com.metaplatform.iam.service.PermissionSnapshotService;
import com.metaplatform.iam.service.PermissionSnapshotService.SnapshotCandidates;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * PermissionSnapshot 对外 API。
 *
 * <ul>
 *   <li>POST /api/v1/iam/permission-snapshots/build</li>
 *   <li>GET  /api/v1/iam/permission-snapshots/{snapshotId}</li>
 * </ul>
 */
@RestController
@RequestMapping("/api/v1/iam/permission-snapshots")
@RequiredArgsConstructor
public class PermissionSnapshotController {

    private final PermissionSnapshotService snapshotService;

    /**
     * 构建快照。
     * 请求体：{ "conceptCode": "Customer", "objectId": "CUST-10086", "candidates": { ... } }
     */
    @PostMapping("/build")
    public ApiResponse<Map<String, String>> build(@RequestBody BuildRequest request) {
        String userId = CurrentUserHolder.requireUserId();
        String tenantId = CurrentUserHolder.tenantIdOrDefault();
        SnapshotCandidates candidates = SnapshotCandidates.builder()
                .candidateActions(request.candidates == null ? java.util.List.of() : request.candidates.get("actions"))
                .candidateRelations(request.candidates == null ? java.util.List.of() : request.candidates.get("relations"))
                .concepts(request.candidates == null ? java.util.List.of() : request.candidates.get("concepts"))
                .metrics(request.candidates == null ? java.util.List.of() : request.candidates.get("metrics"))
                .regions(request.candidates == null ? java.util.List.of() : request.candidates.get("regions"))
                .build();
        String snapshotId = snapshotService.buildSnapshot(tenantId, userId, request.conceptCode,
                request.objectId, candidates);
        return ApiResponse.success(Map.of(
                "snapshotId", snapshotId,
                "ttlSeconds", "300"
        ));
    }

    @GetMapping("/{snapshotId}")
    public ApiResponse<PermissionSnapshotDto> get(@PathVariable String snapshotId) {
        return snapshotService.getSnapshot(snapshotId)
                .map(ApiResponse::success)
                .orElseGet(() -> ApiResponse.error(404, "快照不存在或已过期"));
    }

    /** 请求体 DTO */
    @lombok.Data
    @lombok.NoArgsConstructor
    @lombok.AllArgsConstructor
    public static class BuildRequest {
        private String conceptCode;
        private String objectId;
        private Map<String, java.util.List<String>> candidates;
    }
}
