package com.metaplatform.iam.dto.sso;

import lombok.Data;

import java.util.Map;

@Data
public class UpdateSsoProviderRequest {

    private SsoProviderType providerType;
    private String name;
    private String clientId;
    private String clientSecret;
    private String issuerUrl;
    private String authorizationEndpoint;
    private String tokenEndpoint;
    private String userInfoEndpoint;
    private String scopes;
    private Boolean enabled;
    private Map<String, Object> config;
    private Integer version;
}
