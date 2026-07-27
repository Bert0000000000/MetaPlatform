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
public class NodeStateDto {

    private String nodeId;
    private String actionCode;
    private String status;
    private Instant startedAt;
    private Instant completedAt;
    private String error;
    private String compensationStatus;
}
