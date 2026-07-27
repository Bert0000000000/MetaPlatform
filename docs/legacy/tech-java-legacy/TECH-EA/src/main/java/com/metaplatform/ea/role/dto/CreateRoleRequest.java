package com.metaplatform.ea.role.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.util.List;
import java.util.UUID;

@Data
public class CreateRoleRequest {

    @NotBlank(message = "name 不能为空")
    private String name;

    @NotBlank(message = "code 不能为空")
    private String code;

    private String description;

    private String responsibility;

    private UUID orgUnitId;

    private String domain;

    private List<UUID> iamRoleIds;
}
