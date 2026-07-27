package com.metaplatform.iam.controller;

import com.metaplatform.iam.common.ApiResponse;
import com.metaplatform.iam.common.PageResponse;
import com.metaplatform.iam.dto.sso.CreateSsoProviderRequest;
import com.metaplatform.iam.dto.sso.SsoAuthResponse;
import com.metaplatform.iam.dto.sso.SsoAuthorizeResponse;
import com.metaplatform.iam.dto.sso.SsoCallbackRequest;
import com.metaplatform.iam.dto.sso.SsoMetadataResponse;
import com.metaplatform.iam.dto.sso.SsoProviderResponse;
import com.metaplatform.iam.dto.sso.SsoTokenRequest;
import com.metaplatform.iam.dto.sso.UpdateSsoProviderRequest;
import com.metaplatform.iam.service.SsoProviderService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/iam/sso-providers")
@RequiredArgsConstructor
public class SsoProviderController {

    private final SsoProviderService ssoProviderService;

    @PostMapping
    public ApiResponse<SsoProviderResponse> create(@Valid @RequestBody CreateSsoProviderRequest request) {
        return ApiResponse.success(ssoProviderService.create(request));
    }

    @GetMapping
    public ApiResponse<PageResponse<SsoProviderResponse>> list(
            @RequestParam(required = false) String tenantId,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size) {
        return ApiResponse.success(ssoProviderService.list(tenantId, keyword, page, size));
    }

    @GetMapping("/{id}")
    public ApiResponse<SsoProviderResponse> get(@PathVariable String id) {
        return ApiResponse.success(ssoProviderService.get(id));
    }

    @PutMapping("/{id}")
    public ApiResponse<SsoProviderResponse> update(@PathVariable String id,
                                                   @Valid @RequestBody UpdateSsoProviderRequest request) {
        return ApiResponse.success(ssoProviderService.update(id, request));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable String id) {
        ssoProviderService.delete(id);
        return ApiResponse.success();
    }

    @GetMapping("/{id}/metadata")
    public ApiResponse<SsoMetadataResponse> metadata(@PathVariable String id) {
        return ApiResponse.success(ssoProviderService.getMetadata(id));
    }

    @GetMapping("/{id}/authorize")
    public ApiResponse<SsoAuthorizeResponse> authorize(@PathVariable String id) {
        return ApiResponse.success(ssoProviderService.buildAuthorizeUrl(id));
    }

    @PostMapping("/{id}/callback")
    public ApiResponse<SsoAuthResponse> callback(@PathVariable String id,
                                                 @Valid @RequestBody SsoCallbackRequest request) {
        return ApiResponse.success(ssoProviderService.handleCallback(id, request));
    }

    @PostMapping("/{id}/token")
    public ApiResponse<SsoAuthResponse> token(@PathVariable String id,
                                              @Valid @RequestBody SsoTokenRequest request) {
        return ApiResponse.success(ssoProviderService.handleTokenExchange(id, request));
    }
}
