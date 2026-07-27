package com.metaplatform.iam.dto.user;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import lombok.Data;

import java.util.List;

@Data
public class BatchAssignRoleRequest {

    @NotEmpty(message = "userIds 不能为空")
    private List<String> userIds;

    @NotBlank(message = "roleId 不能为空")
    private String roleId;
}