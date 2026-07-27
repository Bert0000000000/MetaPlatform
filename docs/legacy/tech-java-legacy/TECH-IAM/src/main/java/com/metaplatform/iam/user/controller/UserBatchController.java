package com.metaplatform.iam.user.controller;

import com.metaplatform.iam.common.ApiResponse;
import com.metaplatform.iam.dto.user.BatchAssignPositionRequest;
import com.metaplatform.iam.dto.user.BatchAssignResponse;
import com.metaplatform.iam.dto.user.BatchAssignRoleRequest;
import com.metaplatform.iam.dto.user.BatchImportUsersRequest;
import com.metaplatform.iam.dto.user.BatchImportUsersResponse;
import com.metaplatform.iam.user.service.UserBatchService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/iam/users/batch")
@RequiredArgsConstructor
public class UserBatchController {

    private final UserBatchService userBatchService;

    @PostMapping("/import")
    public ApiResponse<BatchImportUsersResponse> batchImport(@RequestBody BatchImportUsersRequest request) {
        return ApiResponse.success(userBatchService.batchImport(request));
    }

    @PostMapping("/assign-role")
    public ApiResponse<BatchAssignResponse> assignRole(@Valid @RequestBody BatchAssignRoleRequest request) {
        return ApiResponse.success(userBatchService.batchAssignRole(request));
    }

    @PostMapping("/assign-position")
    public ApiResponse<BatchAssignResponse> assignPosition(@Valid @RequestBody BatchAssignPositionRequest request) {
        return ApiResponse.success(userBatchService.batchAssignPosition(request));
    }
}