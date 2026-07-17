package com.metaplatform.ea.role.dto;

import lombok.Data;

@Data
public class UpdateRoleRequest {

    private String name;
    private String description;
    private String responsibility;
}
