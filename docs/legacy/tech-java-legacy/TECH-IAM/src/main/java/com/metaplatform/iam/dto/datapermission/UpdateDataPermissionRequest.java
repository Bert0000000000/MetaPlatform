package com.metaplatform.iam.dto.datapermission;

import com.metaplatform.iam.entity.DataPermissionEntity;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.List;

@Data
public class UpdateDataPermissionRequest {

    private DataPermissionEntity.DataScope dataScope;

    private List<String> columnFilter;

    private DataPermissionEntity.Effect effect;

    @NotNull(message = "version 不能为空（乐观锁）")
    private Integer version;
}
