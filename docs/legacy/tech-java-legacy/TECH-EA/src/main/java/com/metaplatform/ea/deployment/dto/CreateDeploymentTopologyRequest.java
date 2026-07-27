package com.metaplatform.ea.deployment.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.util.List;

@Data
public class CreateDeploymentTopologyRequest {

    @NotBlank(message = "部署拓扑名称不能为空")
    private String name;

    @NotBlank(message = "环境不能为空")
    private String environment;

    private List<DeploymentNode> nodes;
    private List<DeploymentEdge> edges;
    private String healthStatus;
}
