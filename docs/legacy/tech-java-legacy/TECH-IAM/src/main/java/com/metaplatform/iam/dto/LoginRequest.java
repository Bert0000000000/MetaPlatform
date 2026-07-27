package com.metaplatform.iam.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.Data;

@Data
public class LoginRequest {

    @NotBlank(message = "用户名不能为空")
    private String username;

    @NotBlank(message = "密码不能为空")
    private String password;

    @Pattern(regexp = "^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$",
            message = "租户 ID 必须是小写字母、数字、连字符，3-64 位")
    private String tenantId;
}
