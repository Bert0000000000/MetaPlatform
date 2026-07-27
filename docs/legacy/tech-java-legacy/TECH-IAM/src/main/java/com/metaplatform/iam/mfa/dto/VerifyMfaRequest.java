package com.metaplatform.iam.mfa.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class VerifyMfaRequest {

    @NotBlank(message = "userId 不能为空")
    private String userId;

    @NotBlank(message = "code 不能为空")
    private String code;

    private String mfaType;
}
