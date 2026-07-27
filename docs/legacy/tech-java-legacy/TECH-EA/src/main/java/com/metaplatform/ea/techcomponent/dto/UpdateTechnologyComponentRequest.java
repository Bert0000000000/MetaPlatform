package com.metaplatform.ea.techcomponent.dto;

import lombok.Data;

@Data
public class UpdateTechnologyComponentRequest {

    private String name;
    private String type;
    private String version;
    private String description;
    private String owner;
    private String status;
}
