package com.metaplatform.iam.controller;

import com.metaplatform.iam.common.ApiResponse;
import com.metaplatform.iam.dto.settings.UserSettingsResponse;
import com.metaplatform.iam.dto.settings.UserSettingsUpdateRequest;
import com.metaplatform.iam.service.UserSettingsService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/iam/settings")
@RequiredArgsConstructor
public class UserSettingsController {

    private final UserSettingsService userSettingsService;

    @GetMapping
    public ApiResponse<UserSettingsResponse> get(@RequestParam String userId) {
        return ApiResponse.success(userSettingsService.getByUserId(userId));
    }

    @PutMapping
    public ApiResponse<UserSettingsResponse> update(@Valid @RequestBody UserSettingsUpdateRequest request) {
        return ApiResponse.success(userSettingsService.update(request));
    }
}
