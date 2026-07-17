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
public class BusinessProcessVersionResponse {
    private UUID id;
    private UUID processId;
    private Integer version;
    private List<Map<String, Object>> processSteps;
    private Map<String, Object> flowchart;
    private String changeNote;
    private String createdBy;
    private Instant createdAt;
}