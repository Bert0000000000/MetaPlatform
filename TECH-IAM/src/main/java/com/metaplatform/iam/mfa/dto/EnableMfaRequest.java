package com.metaplatform.iam.mfa.dto;

import com.metaplatform.iam.mfa.entity.MfaConfigEntity;
import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EnableMfaRequest {

    @NotBlank(message = "userId 不能为空")
    private String userId;

    private MfaConfigEntity.MfaType mfaType;
    private String phone;
    private String email;
}
