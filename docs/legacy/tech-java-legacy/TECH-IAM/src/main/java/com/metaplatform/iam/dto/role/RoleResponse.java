package com.metaplatform.iam.dto.role;

import com.metaplatform.iam.entity.RoleEntity;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RoleResponse {

    private String roleId;
    private String roleCode;
    private String roleName;
    private RoleEntity.RoleType roleType;
    private String description;
    private RoleEntity.DataScope dataScope;
    private Boolean enabled;
    private Integer version;
    private Long permissionCount;
    private Long memberCount;
    private Instant createdAt;
    private Instant updatedAt;
    private String createdBy;
    private String updatedBy;
}