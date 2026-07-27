package com.metaplatform.ea.techstack.dto;

import lombok.Data;

import java.util.List;

@Data
public class UpdateTechnologyStackRequest {

    private String name;
    private String applicationId;
    private String description;
    private List<TechnologyStackComponentRef> components;
    private String status;
}
