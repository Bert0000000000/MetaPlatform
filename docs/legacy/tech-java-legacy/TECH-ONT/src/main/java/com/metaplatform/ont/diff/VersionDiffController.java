package com.metaplatform.ont.diff;

import com.metaplatform.ont.common.ApiResponse;
import com.metaplatform.ont.common.TenantContext;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Version Diff REST API（P1.1.5）。
 */
@RestController
@RequestMapping("/api/v1/ont/diff")
@RequiredArgsConstructor
public class VersionDiffController {

    private final VersionDiffService service;

    @PostMapping
    public ApiResponse<VersionDiffEntity> record(@RequestBody RecordRequest req) {
        return ApiResponse.success(service.record(
                TenantContext.tenantIdOrDefault(),
                req.fromVersion,
                req.toVersion,
                VersionDiffEntity.DiffType.valueOf(req.diffType),
                req.changes
        ));
    }

    /**
     * 拉取两版本之间的 diff。fromVersion 可空（表示 v1 之前的全部）。
     */
    @GetMapping
    public ApiResponse<List<VersionDiffEntity>> diff(@RequestParam String toVersion,
                                                     @RequestParam(required = false) String fromVersion) {
        return ApiResponse.success(service.diff(TenantContext.tenantIdOrDefault(), fromVersion, toVersion));
    }

    @lombok.Data
    @lombok.NoArgsConstructor
    @lombok.AllArgsConstructor
    public static class RecordRequest {
        private String fromVersion;
        private String toVersion;
        private String diffType;
        private Object changes;
    }
}
