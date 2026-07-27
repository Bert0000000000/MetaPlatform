package com.metaplatform.iam.controller;

import com.metaplatform.iam.common.ApiResponse;
import com.metaplatform.iam.common.PageResponse;
import com.metaplatform.iam.dto.user.AvatarUploadRequest;
import com.metaplatform.iam.dto.user.CreateUserRequest;
import com.metaplatform.iam.dto.user.PasswordChangeRequest;
import com.metaplatform.iam.dto.user.PasswordResetRequest;
import com.metaplatform.iam.dto.user.UpdateUserRequest;
import com.metaplatform.iam.dto.user.UserResponse;
import com.metaplatform.iam.dto.user.UserStatusUpdateRequest;
import com.metaplatform.iam.service.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/iam/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    @GetMapping
    public ApiResponse<PageResponse<UserResponse>> list(
            @RequestParam(required = false) String tenantId,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String departmentId,
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size) {
        return ApiResponse.success(userService.list(tenantId, keyword, status, departmentId, page, size));
    }

    @GetMapping("/{userId}")
    public ApiResponse<UserResponse> get(@PathVariable String userId) {
        return ApiResponse.success(userService.getById(userId));
    }

    @PostMapping
    public ApiResponse<UserResponse> create(@Valid @RequestBody CreateUserRequest request) {
        return ApiResponse.success(userService.create(request));
    }

    @PutMapping("/{userId}")
    public ApiResponse<UserResponse> update(@PathVariable String userId,
                                            @Valid @RequestBody UpdateUserRequest request) {
        return ApiResponse.success(userService.update(userId, request));
    }

    @DeleteMapping("/{userId}")
    public ApiResponse<Void> delete(@PathVariable String userId) {
        userService.delete(userId);
        return ApiResponse.success();
    }

    @PatchMapping("/{userId}/status")
    public ApiResponse<UserResponse> updateStatus(@PathVariable String userId,
                                                  @Valid @RequestBody UserStatusUpdateRequest request) {
        return ApiResponse.success(userService.updateStatus(userId, request.getStatus()));
    }

    @PostMapping("/{userId}/password/reset")
    public ApiResponse<Void> resetPassword(@PathVariable String userId,
                                           @Valid @RequestBody PasswordResetRequest request) {
        userService.resetPassword(userId, request);
        return ApiResponse.success();
    }

    @PostMapping("/{userId}/password/change")
    public ApiResponse<Void> changePassword(@PathVariable String userId,
                                            @Valid @RequestBody PasswordChangeRequest request) {
        userService.changePassword(userId, request);
        return ApiResponse.success();
    }

    @PostMapping("/{userId}/avatar")
    public ApiResponse<UserResponse> uploadAvatar(@PathVariable String userId,
                                                  @Valid @RequestBody AvatarUploadRequest request) {
        return ApiResponse.success(userService.uploadAvatar(userId, request.getAvatarUrl()));
    }
}
