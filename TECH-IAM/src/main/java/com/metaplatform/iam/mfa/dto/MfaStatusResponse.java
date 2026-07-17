package com.metaplatform.iam.mfa.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MfaStatusResponse {

    private String userId;
    private Boolean mfaEnabled;
    private List<MfaTypeStatus> methods;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class MfaTypeStatus {
        private String mfaType;
        private Boolean enabled;
        private String phone;
        private String email;
        private Instant createdAt;
    }
}
