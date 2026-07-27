package com.metaplatform.ea.deployment.dto;

import lombok.Data;

import java.util.List;

@Data
public class UpdateDeploymentTopologyRequest {

    private String name;
    private String environment;
    private List<DeploymentNode> nodes;
    private List<DeploymentEdge> edges;
    private String healthStatus;
}
