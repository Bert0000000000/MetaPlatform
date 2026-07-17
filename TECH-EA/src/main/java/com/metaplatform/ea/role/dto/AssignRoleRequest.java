package com.metaplatform.ea.role.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.UUID;

@Data
public class AssignRoleRequest {

    @NotNull(message = "roleId 不能为空")
    private UUID roleId;

    @NotBlank(message = "relationship 不能为空")
    private String relationship;
}
