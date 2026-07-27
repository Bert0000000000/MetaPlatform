package com.metaplatform.iam.dto.role;

import jakarta.validation.constraints.NotEmpty;
import lombok.Data;

import java.util.List;

@Data
public class AssignRolePermissionsRequest {

    @NotEmpty(message = "permissionIds 不能为空")
    private List<String> permissionIds;

    private Boolean replaceMode;
}