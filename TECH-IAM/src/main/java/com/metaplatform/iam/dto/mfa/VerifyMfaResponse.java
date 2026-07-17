package com.metaplatform.iam.dto.mfa;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class VerifyMfaResponse {

    private Boolean verified;
    private String userId;
    private String message;
}
