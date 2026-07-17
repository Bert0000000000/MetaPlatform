package com.metaplatform.iam.dto.mfa;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class ValidateMfaRequest {

    @NotBlank(message = "userId 不能为空")
    private String userId;

    @NotNull(message = "mfaType 不能为空")
    private MfaType mfaType;

    @NotBlank(message = "code 不能为空")
    private String code;
}
