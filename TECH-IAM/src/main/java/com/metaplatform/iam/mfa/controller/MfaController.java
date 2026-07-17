package com.metaplatform.iam.mfa.controller;

import com.metaplatform.iam.common.ApiResponse;
import com.metaplatform.iam.mfa.dto.DisableMfaRequest;
import com.metaplatform.iam.mfa.dto.EnableMfaRequest;
import com.metaplatform.iam.mfa.dto.EnableMfaResponse;
import com.metaplatform.iam.mfa.dto.MfaStatusResponse;
import com.metaplatform.iam.mfa.dto.VerifyMfaRequest;
import com.metaplatform.iam.mfa.dto.VerifyMfaResponse;
import com.metaplatform.iam.mfa.service.MfaService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/iam/mfa")
@RequiredArgsConstructor
public class MfaController {

    private final MfaService mfaService;

    @PostMapping("/enable")
    public ApiResponse<EnableMfaResponse> enable(@Valid @RequestBody EnableMfaRequest request) {
        return ApiResponse.success(mfaService.enable(request));
    }

    @PostMapping("/verify")
    public ApiResponse<VerifyMfaResponse> verify(@Valid @RequestBody VerifyMfaRequest request) {
        return ApiResponse.success(mfaService.verify(request));
    }

    @PostMapping("/disable")
    public ApiResponse<Void> disable(@Valid @RequestBody DisableMfaRequest request) {
        mfaService.disable(request);
        return ApiResponse.success();
    }

    @GetMapping("/status/{userId}")
    public ApiResponse<MfaStatusResponse> status(@PathVariable String userId) {
        return ApiResponse.success(mfaService.status(userId));
    }
}
