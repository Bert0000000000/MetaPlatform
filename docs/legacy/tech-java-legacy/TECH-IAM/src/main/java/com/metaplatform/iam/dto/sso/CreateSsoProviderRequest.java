package com.metaplatform.iam.dto.sso;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.Map;

@Data
public class CreateSsoProviderRequest {

    @NotNull(message = "providerType 不能为空")
    private SsoProviderType providerType;

    @NotBlank(message = "name 不能为空")
    private String name;

    private String tenantId;
    private String clientId;
    private String clientSecret;
    private String issuerUrl;
    private String authorizationEndpoint;
    private String tokenEndpoint;
    private String userInfoEndpoint;
    private String scopes;
    private Boolean enabled;
    private Map<String, Object> config;
}
