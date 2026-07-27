package com.metaplatform.iam.dto.datapermission;

import com.metaplatform.iam.entity.DataPermissionEntity;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.List;

@Data
public class CreateDataPermissionRequest {

    @NotBlank(message = "roleId 不能为空")
    @Size(max = 64, message = "roleId 长度不能超过 64")
    private String roleId;

    @NotBlank(message = "resourceType 不能为空")
    @Size(max = 64, message = "resourceType 长度不能超过 64")
    private String resourceType;

    private String resourceId;

    private DataPermissionEntity.DataScope dataScope;

    private List<String> columnFilter;

    private DataPermissionEntity.Effect effect;

    private String tenantId;
}
