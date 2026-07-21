package com.metaplatform.ea.deployment.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DeploymentNode {

    private String id;
    private String name;
    private String type;
    private Double x;
    private Double y;
    private String status;
    private Map<String, Object> metadata;
}
