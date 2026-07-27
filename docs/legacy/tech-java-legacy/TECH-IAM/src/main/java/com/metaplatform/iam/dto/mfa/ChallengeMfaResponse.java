package com.metaplatform.iam.dto.mfa;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ChallengeMfaResponse {

    private String userId;
    private MfaType mfaType;
    private Boolean challenged;
    private String message;
}
