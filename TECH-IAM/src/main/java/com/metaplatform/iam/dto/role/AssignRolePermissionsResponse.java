package com.metaplatform.iam.dto.role;

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
public class AssignRolePermissionsResponse {

    private String roleId;
    private String roleCode;
    private Integer permissionCount;
    private List<AssignedPermission> assignedPermissions;
    private Instant updatedAt;
    private String updatedBy;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class AssignedPermission {
        private String permissionId;
        private String permissionCode;
    }
}