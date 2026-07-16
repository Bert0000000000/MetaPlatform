package com.metaplatform.iam.dto.userdepartment;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class UserDepartmentAssignmentRequest {

    @NotNull(message = "departmentId 不能为空")
    private String departmentId;

    private Boolean isPrimary;
}