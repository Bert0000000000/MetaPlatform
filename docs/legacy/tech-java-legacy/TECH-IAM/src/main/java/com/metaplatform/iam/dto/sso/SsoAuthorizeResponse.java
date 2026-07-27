package com.metaplatform.iam.dto.sso;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SsoAuthorizeResponse {

    private String providerId;
    private String authorizeUrl;
    private String state;
}
