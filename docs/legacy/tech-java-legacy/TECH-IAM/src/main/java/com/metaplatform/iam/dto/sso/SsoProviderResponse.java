package com.metaplatform.iam.dto.sso;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SsoProviderResponse {

    private String id;
    private String tenantId;
    private SsoProviderType providerType;
    private String name;
    private String clientId;
    private String issuerUrl;
    private String authorizationEndpoint;
    private String tokenEndpoint;
    private String userInfoEndpoint;
    private String scopes;
    private Boolean enabled;
    private Map<String, Object> config;
    private Integer version;
    private Instant createdAt;
    private Instant updatedAt;
    private String createdBy;
    private String updatedBy;
}
