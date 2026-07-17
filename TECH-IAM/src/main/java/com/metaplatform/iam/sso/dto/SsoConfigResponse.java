package com.metaplatform.iam.sso.dto;

import com.metaplatform.iam.sso.entity.SsoConfigEntity;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SsoConfigResponse {

    private String id;
    private String tenantId;
    private String providerName;
    private SsoConfigEntity.ProviderType providerType;
    private String clientId;
    private String redirectUri;
    private String scopes;
    private String config;
    private Boolean enabled;
    private Integer version;
    private Instant createdAt;
    private Instant updatedAt;
    private String createdBy;
    private String updatedBy;
}
