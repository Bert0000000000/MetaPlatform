package com.metaplatform.iam.mfa.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EnableMfaResponse {

    private String mfaConfigId;
    private String mfaType;
    private String secret;
    private String qrPayload;
    private String otpAuthUri;
    private List<String> backupCodes;
    private Boolean enabled;
}
