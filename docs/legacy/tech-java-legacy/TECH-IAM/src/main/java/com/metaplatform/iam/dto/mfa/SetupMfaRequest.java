package com.metaplatform.iam.dto.mfa;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class SetupMfaRequest {

    @NotNull(message = "mfaType 不能为空")
    private MfaType mfaType;

    private String phone;
    private String email;
}
