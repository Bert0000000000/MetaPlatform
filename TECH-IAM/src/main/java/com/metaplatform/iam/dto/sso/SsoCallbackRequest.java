package com.metaplatform.iam.dto.sso;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class SsoCallbackRequest {

    @NotBlank(message = "code 不能为空")
    private String code;

    private String state;
}
