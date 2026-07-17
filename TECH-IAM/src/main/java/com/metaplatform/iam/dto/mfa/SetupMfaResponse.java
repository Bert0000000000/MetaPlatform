package com.metaplatform.iam.dto.mfa;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SetupMfaResponse {

    private String mfaId;
    private MfaType mfaType;
    private String secret;
    private String qrPayload;
    private String otpAuthUri;
    private Boolean enabled;
    private String message;
}
