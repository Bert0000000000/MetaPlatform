package com.metaplatform.ea.application.dto;

import lombok.Data;

import java.util.List;

@Data
public class UpdateApplicationRequest {

    private String name;
    private String description;
    private String appType;
    private String status;
    private List<String> techStack;
    private List<String> dependencies;
}
