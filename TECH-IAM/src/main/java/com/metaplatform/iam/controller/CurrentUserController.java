package com.metaplatform.iam.controller;

import com.metaplatform.iam.common.ApiResponse;
import com.metaplatform.iam.dto.auth.CurrentUserResponse;
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
}