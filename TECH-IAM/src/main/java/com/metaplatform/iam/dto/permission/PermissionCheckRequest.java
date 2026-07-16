package com.metaplatform.iam.dto.permission;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.util.Map;

@Data
public class PermissionCheckRequest {

    @NotBlank(message = "userId 不能为空")
    private String userId;

    @NotBlank(message = "resource 不能为空")
    private String resource;

    @NotBlank(message = "action 不能为空")
    private String action;

    private Map<String, Object> context;
}
