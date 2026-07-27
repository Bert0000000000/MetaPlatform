package com.metaplatform.iam.dto.auth;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CurrentUserResponse {

    private String id;
    private String username;
    private String email;
    private String realName;
    private String tenantId;
    private List<String> roles;
    private List<PermissionSummary> permissions;
    private List<DepartmentSummary> departments;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PermissionSummary {
        private String permissionId;
        private String permissionCode;
        private String permissionName;
        private String resourceType;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class DepartmentSummary {
        private String departmentId;
        private String departmentCode;
        private String departmentName;
        private Boolean isPrimary;
    }
}