package com.metaplatform.wfe.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ProcessDefinitionResponse {

    private String id;
    private String tenantId;
    private String processKey;
    private String name;
    private Integer version;
    private String bpmnXml;
    private String status;
    private String deployedBy;
    private Instant createdAt;
    private Instant updatedAt;
}
