package com.metaplatform.iam.dto.permission;

import com.metaplatform.iam.entity.PermissionEntity;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.List;

@Data
public class UpdatePermissionRequest {

    private String permissionName;

    private List<String> actions;

    private PermissionEntity.Effect effect;

    private String description;

    @NotNull(message = "version 不能为空（乐观锁）")
    private Integer version;
}