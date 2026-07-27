package com.metaplatform.iam.dto.sso;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class SsoTokenRequest {

    @NotBlank(message = "assertion 不能为空")
    private String assertion;
}
