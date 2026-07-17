package com.metaplatform.iam.controller;

import com.metaplatform.iam.common.ApiResponse;
import com.metaplatform.iam.dto.mfa.ChallengeMfaRequest;
import com.metaplatform.iam.dto.mfa.ChallengeMfaResponse;
import com.metaplatform.iam.dto.mfa.SetupMfaRequest;
import com.metaplatform.iam.dto.mfa.SetupMfaResponse;
import com.metaplatform.iam.dto.mfa.ValidateMfaRequest;
import com.metaplatform.iam.dto.mfa.ValidateMfaResponse;
import com.metaplatform.iam.dto.mfa.VerifyMfaRequest;
import com.metaplatform.iam.dto.mfa.VerifyMfaResponse;
import com.metaplatform.iam.service.UserMfaService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/iam/auth/mfa")
@RequiredArgsConstructor
public class MfaAuthController {

    private final UserMfaService userMfaService;

    @PostMapping("/setup")
    public ApiResponse<SetupMfaResponse> setup(@Valid @RequestBody SetupMfaRequest request) {
        return ApiResponse.success(userMfaService.setup(request));
    }

    @PostMapping("/verify")
    public ApiResponse<VerifyMfaResponse> verify(@Valid @RequestBody VerifyMfaRequest request) {
        return ApiResponse.success(userMfaService.verify(request));
    }

    @PostMapping("/challenge")
    public ApiResponse<ChallengeMfaResponse> challenge(@Valid @RequestBody ChallengeMfaRequest request) {
        return ApiResponse.success(userMfaService.challenge(request));
    }

    @PostMapping("/validate")
    public ApiResponse<ValidateMfaResponse> validate(@Valid @RequestBody ValidateMfaRequest request) {
        return ApiResponse.success(userMfaService.validate(request));
    }
}
