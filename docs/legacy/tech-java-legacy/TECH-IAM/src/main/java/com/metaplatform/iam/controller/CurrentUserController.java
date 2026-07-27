package com.metaplatform.iam.controller;

import com.metaplatform.iam.common.ApiResponse;
import com.metaplatform.iam.dto.auth.CurrentUserResponse;
import com.metaplatform.iam.dto.auth.UserPermissionsResponse;
import com.metaplatform.iam.service.CurrentUserService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/iam/auth")
@RequiredArgsConstructor
public class CurrentUserController {

    private final CurrentUserService currentUserService;

    @GetMapping("/me")
    public ApiResponse<CurrentUserResponse> me() {
        return ApiResponse.success(currentUserService.current());
    }

    /**
     * 当前用户权限聚合：对齐 SPEC-TECH-IAM 3.5.8。
     * 供前端个人中心「权限查看」与按钮级权限控制使用。
     */
    @GetMapping("/me/permissions")
    public ApiResponse<UserPermissionsResponse> mePermissions() {
        return ApiResponse.success(currentUserService.currentPermissions());
    }
}
