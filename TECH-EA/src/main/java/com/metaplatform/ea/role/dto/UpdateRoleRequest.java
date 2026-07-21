package com.metaplatform.ea.role.dto;

import lombok.Data;

import java.util.List;
import java.util.UUID;

@Data
public class UpdateRoleRequest {

    private String name;
    private String description;
    private String responsibility;
    private UUID orgUnitId;
    private String domain;
    private List<UUID> iamRoleIds;
}
