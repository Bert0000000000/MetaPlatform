package com.metaplatform.ea.deployment.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DeploymentEdge {

    private String id;
    private String source;
    private String target;
    private String label;
    private String status;
}
