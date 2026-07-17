package com.metaplatform.iam.dto.apikey;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

/**
 * 验证 API Key 权限请求。
 */
@Data
public class ValidateRequest {

    @NotBlank(message = "apiKey 不能为空")
    private String apiKey;

    @NotBlank(message = "resource 不能为空")
    private String resource;

    @NotBlank(message = "action 不能为空")
    private String action;
}
