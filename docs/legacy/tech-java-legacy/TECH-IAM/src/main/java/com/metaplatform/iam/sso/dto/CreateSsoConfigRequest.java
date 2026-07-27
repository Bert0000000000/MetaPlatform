package com.metaplatform.iam.sso.dto;

import com.metaplatform.iam.sso.entity.SsoConfigEntity;
import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CreateSsoConfigRequest {

    private String tenantId;

    @NotBlank(message = "providerName 不能为空")
    private String providerName;

    private SsoConfigEntity.ProviderType providerType;

    private String clientId;
    private String clientSecret;
    private String redirectUri;
    private String scopes;
    private String config;
    private Boolean enabled;
}
