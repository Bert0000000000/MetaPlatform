package com.metaplatform.iam.sso.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SsoCallbackRequest {

    @NotBlank(message = "code 不能为空")
    private String code;

    private String state;
}
