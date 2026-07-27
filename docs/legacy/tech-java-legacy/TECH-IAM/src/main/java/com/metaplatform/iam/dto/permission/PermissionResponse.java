package com.metaplatform.iam.dto.permission;

import com.metaplatform.iam.entity.PermissionEntity;
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
public class PermissionResponse {

    private String permissionId;
    private String permissionCode;
    private String permissionName;
    private String resourceType;
    private String resourceId;
    private List<String> actions;
    private PermissionEntity.Effect effect;
    private String description;
    private Integer version;
    private Long roleCount;
    private Instant createdAt;
    private Instant updatedAt;
    private String createdBy;
    private String updatedBy;
}