package com.metaplatform.ea.application.dto;

import lombok.Data;

import java.util.Map;

@Data
public class UpdateApplicationRequest {

    private String name;
    private String description;
    private String appType;
    private String status;
    private Map<String, Object> techStack;
    private Map<String, Object> dependencies;
    private Map<String, Object> capabilityIds;
}