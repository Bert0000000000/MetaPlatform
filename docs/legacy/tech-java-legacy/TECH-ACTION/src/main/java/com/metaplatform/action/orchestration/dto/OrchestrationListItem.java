package com.metaplatform.action.orchestration.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OrchestrationListItem {

    private String orchestrationId;
    private String code;
    private String name;
    private String status;
    private Integer version;
    private Instant createdAt;
    private Instant updatedAt;
}
