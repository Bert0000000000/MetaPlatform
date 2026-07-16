package com.metaplatform.iam.dto.role;

import com.metaplatform.iam.entity.RoleEntity;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class CreateRoleRequest {

    @NotBlank(message = "roleCode 不能为空")
    @Size(max = 128, message = "roleCode 长度不能超过 128")
    private String roleCode;

    @NotBlank(message = "roleName 不能为空")
    @Size(max = 256, message = "roleName 长度不能超过 256")
    private String roleName;

    private RoleEntity.RoleType roleType;

    private String description;

    private RoleEntity.DataScope dataScope;

    private Boolean enabled;

    private String tenantId;
}