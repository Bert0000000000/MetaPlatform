package com.metaplatform.iam.dto.auth;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * 当前用户权限聚合响应：用于前端个人中心「权限查看」与按钮级权限控制。
 * 字段设计对齐 SPEC-TECH-IAM 3.5.8。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserPermissionsResponse {

    private String userId;
    private String tenantId;

    /** 权限编码列表（去重），便于前端按钮级判断 `permissionCodes.includes('xxx:read')`。 */
    private List<String> permissionCodes;

    /** 权限明细列表（已按 resourceType 升序、permissionCode 升序排序）。 */
    private List<PermissionDetail> permissions;

    /** 当前用户拥有的角色摘要。 */
    private List<RoleSummary> roles;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PermissionDetail {
        private String permissionId;
        private String permissionCode;
        private String permissionName;
        private String resourceType;
        /** 操作列表：READ/CREATE/UPDATE/DELETE/EXPORT/IMPORT/ADMIN。 */
        private List<String> actions;
        /** ALLOW / DENY。 */
        private String effect;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RoleSummary {
        private String roleId;
        private String roleCode;
        private String roleName;
        /** ALL / DEPT / DEPT_AND_SUB / SELF / CUSTOM。 */
        private String dataScope;
    }
}
