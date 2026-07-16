package com.metaplatform.iam.dto.role;

import com.metaplatform.iam.entity.RoleEntity;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class UpdateRoleRequest {

    private String roleName;

    private String description;

    private RoleEntity.DataScope dataScope;

    private Boolean enabled;

    @NotNull(message = "version 不能为空（乐观锁）")
    private Integer version;
}