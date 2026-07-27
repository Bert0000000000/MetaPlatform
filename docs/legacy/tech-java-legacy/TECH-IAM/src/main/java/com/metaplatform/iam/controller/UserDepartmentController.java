package com.metaplatform.iam.controller;

import com.metaplatform.iam.common.ApiResponse;
import com.metaplatform.iam.dto.userdepartment.UserDepartmentAssignmentRequest;
import com.metaplatform.iam.dto.userdepartment.UserDepartmentResponse;
import com.metaplatform.iam.service.UserDepartmentService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/iam/users/{userId}/departments")
@RequiredArgsConstructor
public class UserDepartmentController {

    private final UserDepartmentService userDepartmentService;

    @PostMapping
    public ApiResponse<UserDepartmentResponse> assign(
            @PathVariable String userId,
            @Valid @RequestBody UserDepartmentAssignmentRequest request) {
        return ApiResponse.success(userDepartmentService.assign(userId, request));
    }

    @GetMapping
    public ApiResponse<List<UserDepartmentResponse>> list(@PathVariable String userId) {
        return ApiResponse.success(userDepartmentService.listByUser(userId));
    }
}