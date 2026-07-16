package com.metaplatform.iam.dto.department;

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
public class DepartmentResponse {

    private String deptId;
    private String deptCode;
    private String deptName;
    private String parentId;
    private String parentName;
    private String parentPath;
    private String fullPath;
    private Integer level;
    private Integer sortOrder;
    private Leader leader;
    private Long memberCount;
    private Long childCount;
    private String description;
    private Integer version;
    private Instant createdAt;
    private Instant updatedAt;
    private String createdBy;
    private String updatedBy;

    private List<DepartmentResponse> children;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Leader {
        private String userId;
        private String realName;
        private String username;
    }
}