package com.metaplatform.iam.dto.user;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import lombok.Data;

import java.util.List;

@Data
public class BatchAssignPositionRequest {

    @NotEmpty(message = "userIds 不能为空")
    private List<String> userIds;

    @NotBlank(message = "positionId 不能为空")
    private String positionId;

    @NotBlank(message = "departmentId 不能为空")
    private String departmentId;

    private Boolean isPrimary;
}