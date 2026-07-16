package com.metaplatform.iam.dto.userdepartment;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserDepartmentResponse {

    private String id;
    private String userId;
    private String departmentId;
    private String departmentName;
    private String departmentCode;
    private String positionId;
    private Boolean isPrimary;
    private Instant createdAt;
    private String createdBy;
}