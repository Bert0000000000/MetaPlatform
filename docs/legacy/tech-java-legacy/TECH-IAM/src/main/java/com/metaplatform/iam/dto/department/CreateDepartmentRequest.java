package com.metaplatform.iam.dto.department;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class CreateDepartmentRequest {

    @NotBlank(message = "deptCode 不能为空")
    @Size(max = 128, message = "deptCode 长度不能超过 128")
    private String deptCode;

    @NotBlank(message = "deptName 不能为空")
    @Size(max = 256, message = "deptName 长度不能超过 256")
    private String deptName;

    private String parentId;

    private Integer sortOrder = 0;

    private String leaderId;

    private String description;

    private String tenantId;
}