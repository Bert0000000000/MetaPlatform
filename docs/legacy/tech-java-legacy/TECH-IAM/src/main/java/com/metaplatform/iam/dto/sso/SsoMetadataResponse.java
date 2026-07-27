package com.metaplatform.iam.dto.sso;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SsoMetadataResponse {

    private String providerType;
    private String metadata;
}
