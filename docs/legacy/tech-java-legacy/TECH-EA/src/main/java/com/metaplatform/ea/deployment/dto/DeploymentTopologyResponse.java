package com.metaplatform.ea.deployment.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DeploymentTopologyResponse {

    private UUID id;
    private String tenantId;
    private String name;
    private String environment;
    private List<DeploymentNode> nodes;
    private List<DeploymentEdge> edges;
    private String healthStatus;
    private Instant createdAt;
    private Instant updatedAt;
}
