package com.metaplatform.iam.dto.permission;

import com.metaplatform.iam.entity.PermissionEntity;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.List;

@Data
public class CreatePermissionRequest {

    @NotBlank(message = "permissionCode 不能为空")
    @Size(max = 256, message = "permissionCode 长度不能超过 256")
    private String permissionCode;

    @NotBlank(message = "permissionName 不能为空")
    @Size(max = 256, message = "permissionName 长度不能超过 256")
    private String permissionName;

    @NotBlank(message = "resourceType 不能为空")
    @Size(max = 64, message = "resourceType 长度不能超过 64")
    private String resourceType;

    private String resourceId;

    @NotEmpty(message = "actions 不能为空")
    private List<String> actions;

    private PermissionEntity.Effect effect;

    private String description;

    private String tenantId;
}