package com.metaplatform.iam.dto.mfa;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ValidateMfaResponse {

    private String loginResult;
    private String userId;
    private String username;
    private String accessToken;
    private String refreshToken;
    private String tokenType;
    private Long expiresIn;
    private Instant loginAt;
}
