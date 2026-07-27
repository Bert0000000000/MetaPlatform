package com.metaplatform.iam.dto.department;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class UpdateDepartmentRequest {

    private String deptName;

    private String parentId;

    private Integer sortOrder;

    private String leaderId;

    private String description;

    @NotNull(message = "version 不能为空（乐观锁）")
    private Integer version;
}