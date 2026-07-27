package com.metaplatform.iam.sso.dto;

import com.metaplatform.iam.sso.entity.SsoConfigEntity;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UpdateSsoConfigRequest {

    private Integer version;
    private String clientId;
    private String clientSecret;
    private String redirectUri;
    private String scopes;
    private String config;
    private SsoConfigEntity.ProviderType providerType;
    private Boolean enabled;
}
