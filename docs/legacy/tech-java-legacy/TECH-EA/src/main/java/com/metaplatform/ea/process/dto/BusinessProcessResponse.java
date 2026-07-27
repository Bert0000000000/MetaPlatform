package com.metaplatform.ea.process.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BusinessProcessResponse {

    private UUID id;
    private String tenantId;
    private String name;
    private String code;
    private String description;
    private UUID valueStreamId;
    private String processType;
    private String frequency;
    private List<String> capabilities;
    private List<String> applicationIds;
    private List<String> responsibleRoleIds;
    private List<Map<String, Object>> processSteps;
    private String bpmnXml;
    private Integer version;
    private String status;
    private Instant createdAt;
    private Instant updatedAt;
}
