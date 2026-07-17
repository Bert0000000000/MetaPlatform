package com.metaplatform.gw.api.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UpdateApiRequest {

    private String name;
    private String path;
    private String method;
    private String groupName;
    private String version;
    private String targetService;
    private String description;
    private String status;
    private Map<String, Object> metadata;
    private Map<String, Object> requestSchema;
    private Map<String, Object> responseSchema;
    private Map<String, Object> parameters;
    private Map<String, Object> examples;
}
