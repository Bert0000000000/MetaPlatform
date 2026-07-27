package com.metaplatform.iam.dto.datapermission;

import com.metaplatform.iam.entity.DataPermissionEntity;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DataPermissionResponse {

    private String dataPermissionId;
    private String roleId;
    private String resourceType;
    private String resourceId;
    private DataPermissionEntity.DataScope dataScope;
    private List<String> columnFilter;
    private DataPermissionEntity.Effect effect;
    private Integer version;
    private Instant createdAt;
    private Instant updatedAt;
    private String createdBy;
    private String updatedBy;
}
