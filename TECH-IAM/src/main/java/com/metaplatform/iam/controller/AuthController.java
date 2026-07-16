package com.metaplatform.iam.controller;

import com.metaplatform.iam.common.ApiResponse;
import com.metaplatform.iam.dto.AuthResponse;
import com.metaplatform.iam.dto.LoginRequest;
import com.metaplatform.iam.dto.RegisterRequest;
import com.metaplatform.iam.service.AuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/iam/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @PostMapping("/register")
    public ApiResponse<AuthResponse> register(@Valid @RequestBody RegisterRequest request) {
        return ApiResponse.success(authService.register(request));
    }

    @PostMapping("/login")
    public ApiResponse<AuthResponse> login(@Valid @RequestBody LoginRequest request) {
        return ApiResponse.success(authService.login(request));
    }
}
