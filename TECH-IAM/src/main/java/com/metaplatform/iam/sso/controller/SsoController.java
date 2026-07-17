package com.metaplatform.iam.sso.controller;

import com.metaplatform.iam.common.ApiResponse;
import com.metaplatform.iam.common.PageResponse;
import com.metaplatform.iam.sso.dto.AuthorizeUrlResponse;
import com.metaplatform.iam.sso.dto.CreateSsoConfigRequest;
import com.metaplatform.iam.sso.dto.SamlAssertionRequest;
import com.metaplatform.iam.sso.dto.SsoCallbackRequest;
import com.metaplatform.iam.sso.dto.SsoConfigResponse;
import com.metaplatform.iam.sso.dto.SsoLoginResponse;
import com.metaplatform.iam.sso.dto.UpdateSsoConfigRequest;
import com.metaplatform.iam.sso.service.SsoService;
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
@RequestMapping("/api/v1/iam/sso")
@RequiredArgsConstructor
public class SsoController {

    private final SsoService ssoService;

    @PostMapping("/configs")
    public ApiResponse<SsoConfigResponse> create(@Valid @RequestBody CreateSsoConfigRequest request) {
        return ApiResponse.success(ssoService.create(request));
    }

    @GetMapping("/configs")
    public ApiResponse<PageResponse<SsoConfigResponse>> list(
            @RequestParam(required = false) String tenantId,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size) {
        return ApiResponse.success(ssoService.list(tenantId, keyword, page, size));
    }

    @GetMapping("/configs/{id}")
    public ApiResponse<SsoConfigResponse> get(@PathVariable String id) {
        return ApiResponse.success(ssoService.get(id));
    }

    @PutMapping("/configs/{id}")
    public ApiResponse<SsoConfigResponse> update(@PathVariable String id,
                                                  @Valid @RequestBody UpdateSsoConfigRequest request) {
        return ApiResponse.success(ssoService.update(id, request));
    }

    @DeleteMapping("/configs/{id}")
    public ApiResponse<Void> delete(@PathVariable String id) {
        ssoService.softDelete(id);
        return ApiResponse.success();
    }

    @GetMapping("/{provider}/authorize")
    public ApiResponse<AuthorizeUrlResponse> authorize(@PathVariable String provider) {
        return ApiResponse.success(ssoService.getAuthorizeUrl(provider));
    }

    @PostMapping("/{provider}/callback")
    public ApiResponse<SsoLoginResponse> callback(@PathVariable String provider,
                                                   @Valid @RequestBody SsoCallbackRequest request) {
        return ApiResponse.success(ssoService.handleCallback(provider, request));
    }

    @PostMapping("/{provider}/saml/assertion")
    public ApiResponse<SsoLoginResponse> samlAssertion(@PathVariable String provider,
                                                        @Valid @RequestBody SamlAssertionRequest request) {
        return ApiResponse.success(ssoService.handleSamlAssertion(provider, request));
    }
}
